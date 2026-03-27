'use strict';
/**
 * ModpackManager — підтримує два формати manifest.json:
 *
 * 1. ZIP-архіви (рекомендовано для великих модпаків):
 *    { "archives": [ { name, url, extractTo, sha1, version } ] }
 *
 * 2. Окремі файли (для невеликих оновлень):
 *    { "files": [ { name, path, url, sha1 } ] }
 *
 * Обидва формати можна комбінувати в одному маніфесті.
 */

const { EventEmitter } = require('events');
const path   = require('path');
const fs     = require('fs');
const https  = require('https');
const http   = require('http');
const crypto = require('crypto');
const os     = require('os');

class ModpackManager extends EventEmitter {
  constructor(gameDir, manifestUrl, log) {
    super();
    this.gameDir     = gameDir;
    this.manifestUrl = manifestUrl;
    this.log         = log;
    this.localMeta   = path.join(gameDir, '.modpack-meta.json');
  }

  // ── Перевірка наявності оновлень ────────────────────────────────────────
  async checkForUpdates() {
    this._status('Перевірка оновлень модпаку…');
    let remote;
    try {
      remote = await this._fetchJSON(this.manifestUrl);
    } catch (e) {
      this.log.warn('ModpackManager: manifest недоступний:', e.message);
      return { upToDate: true, offline: true };
    }

    const local = this._loadMeta();

    if (!local || local.version !== remote.version) {
      return {
        upToDate:      false,
        remoteVersion: remote.version,
        localVersion:  local?.version || 'немає',
        hasArchives:   !!(remote.archives?.length),
        hasFiles:      !!(remote.files?.length)
      };
    }

    return { upToDate: true, version: remote.version };
  }

  // ── Повне оновлення ──────────────────────────────────────────────────────
  async update() {
    this._status('Отримання маніфесту модпаку…');
    const manifest = await this._fetchJSON(this.manifestUrl);

    fs.mkdirSync(this.gameDir, { recursive: true });

    // ── Формат 1: ZIP-архіви ──────────────────────────────────────────────
    if (manifest.archives?.length) {
      await this._processArchives(manifest.archives);
    }

    // ── Формат 2: Окремі файли ────────────────────────────────────────────
    if (manifest.files?.length) {
      await this._processFiles(manifest.files);
    }

    // Зберігаємо мета-дані
    this._saveMeta({ version: manifest.version, updatedAt: Date.now() });
    this._status('Модпак актуальний!', true);
    return { version: manifest.version };
  }

  // ── Обробка ZIP-архівів ──────────────────────────────────────────────────
  async _processArchives(archives) {
    const meta  = this._loadMeta() || {};
    const total = archives.length;

    for (let i = 0; i < archives.length; i++) {
      const arc = archives[i];
      this._status(`Перевірка ${arc.name} (${i + 1}/${total})…`);

      const destDir  = path.join(this.gameDir, arc.extractTo || arc.name);
      const tempZip  = path.join(os.tmpdir(), `ycraft-${arc.name}-${Date.now()}.zip`);

      // Пропускаємо якщо версія не змінилась
      const cachedVer = meta[`archive_${arc.name}`];
      if (cachedVer && cachedVer === arc.version) {
        this.emit('progress', {
          file: arc.name, current: i + 1, total,
          percent: Math.round(((i + 1) / total) * 100),
          status: 'актуальний'
        });
        continue;
      }

      // Завантажуємо ZIP
      this._status(`Завантаження ${arc.name}.zip…`);
      await this._dlProgress(arc.url, tempZip, arc.size || null, arc.name + '.zip');

      // Перевіряємо SHA1
      if (arc.sha1) {
        const hash = await this._hashFile(tempZip);
        if (hash !== arc.sha1.toLowerCase()) {
          fs.unlinkSync(tempZip);
          throw new Error(
            `SHA1 не збігається для ${arc.name}: очікувалось ${arc.sha1}, отримано ${hash}`
          );
        }
      }

      // Очищуємо папку призначення (видаляємо старі файли)
      this._status(`Розпакування ${arc.name}…`);
      if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
      }
      fs.mkdirSync(destDir, { recursive: true });

      // Розпаковуємо
      await this._extractZip(tempZip, destDir);

      // Прибираємо тимчасовий файл
      try { fs.unlinkSync(tempZip); } catch {}

      // Зберігаємо версію в мета
      meta[`archive_${arc.name}`] = arc.version;
      this._saveMeta({ ...meta, version: meta.version });

      this.emit('progress', {
        file: arc.name, current: i + 1, total,
        percent: Math.round(((i + 1) / total) * 100),
        status: 'оновлено'
      });

      this.log.info(`[Modpack] ${arc.name} оновлено до v${arc.version}`);
    }
  }

  // ── Обробка окремих файлів ───────────────────────────────────────────────
  async _processFiles(files) {
    const total = files.length;

    // Видаляємо файли яких немає в маніфесті
    await this._removeObsolete(files);

    for (let i = 0; i < total; i++) {
      const f    = files[i];
      const dest = path.join(this.gameDir, f.path);

      // Пропускаємо якщо SHA1 збігається
      if (f.sha1 && fs.existsSync(dest)) {
        const hash = await this._hashFile(dest);
        if (hash === f.sha1.toLowerCase()) {
          this.emit('progress', {
            file: f.name || path.basename(f.path),
            current: i + 1, total,
            percent: Math.round(((i + 1) / total) * 100),
            status: 'skip'
          });
          continue;
        }
      }

      this.emit('progress', {
        file: f.name || path.basename(f.path),
        current: i + 1, total,
        percent: Math.round(((i + 1) / total) * 100),
        status: 'завантаження'
      });

      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await this._dlProgress(f.url, dest, f.size || null, f.name || path.basename(f.path));
    }
  }

  // ── Видалення застарілих файлів ──────────────────────────────────────────
  async _removeObsolete(remoteFiles) {
    const validPaths = new Set(remoteFiles.map(f => path.join(this.gameDir, f.path)));
    const modsDir    = path.join(this.gameDir, 'mods');
    if (!fs.existsSync(modsDir)) return;

    for (const f of fs.readdirSync(modsDir)) {
      const full = path.join(modsDir, f);
      if (!validPaths.has(full)) {
        fs.rmSync(full, { force: true });
        this.log.info('[Modpack] Видалено застарілий файл:', f);
      }
    }
  }

  // ── Розпакування ZIP ─────────────────────────────────────────────────────
  async _extractZip(zipPath, destDir) {
    // Спробуємо node-stream-zip
    try {
      const StreamZip = require('node-stream-zip');
      const zip = new StreamZip.async({ file: zipPath });
      const entries = await zip.entries();
      const total   = Object.keys(entries).length;
      let done = 0;

      for (const [name, entry] of Object.entries(entries)) {
        if (entry.isDirectory) continue;
        const dest = path.join(destDir, name);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        await zip.extract(name, dest);
        done++;
        if (done % 10 === 0) {
          this.emit('progress', {
            file:    'Розпакування…',
            percent: Math.round((done / total) * 100),
            current: done, total
          });
        }
      }
      await zip.close();
      return;
    } catch (e) {
      this.log.warn('[Modpack] node-stream-zip недоступний, спробуємо системний unzip:', e.message);
    }

    // Fallback — системна утиліта
    await this._extractZipSystem(zipPath, destDir);
  }

  _extractZipSystem(zipPath, destDir) {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      let proc;

      if (process.platform === 'win32') {
        // PowerShell є на всіх Windows 7+
        proc = spawn('powershell', [
          '-NoProfile', '-NonInteractive', '-Command',
          `Expand-Archive -Force -LiteralPath '${zipPath}' -DestinationPath '${destDir}'`
        ]);
      } else {
        proc = spawn('unzip', ['-o', '-q', zipPath, '-d', destDir]);
      }

      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`Розпакування завершилось з кодом ${code}`));
      });
      proc.on('error', reject);
    });
  }

  // ── Утиліти ─────────────────────────────────────────────────────────────
  _loadMeta() {
    if (!fs.existsSync(this.localMeta)) return null;
    try { return JSON.parse(fs.readFileSync(this.localMeta, 'utf8')); }
    catch { return null; }
  }

  _saveMeta(data) {
    try { fs.writeFileSync(this.localMeta, JSON.stringify(data, null, 2)); }
    catch (e) { this.log.warn('[Modpack] saveMeta failed:', e.message); }
  }

  _status(msg, done = false) {
    this.emit('status', { message: msg, done });
    this.log.info('[Modpack]', done ? '(done)' : msg.slice(0, 40));
  }

  _hashFile(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha1');
      fs.createReadStream(filePath)
        .on('data', d  => hash.update(d))
        .on('end',  () => resolve(hash.digest('hex')))
        .on('error', reject);
    });
  }

  _dlProgress(url, dest, totalSize, label) {
    return new Promise((resolve, reject) => {
      const doReq = (reqUrl) => {
        const lib  = reqUrl.startsWith('https') ? https : http;
        const file = fs.createWriteStream(dest);
        let received = 0;

        const req = lib.get(reqUrl, { headers: { 'User-Agent': 'YCraft-Launcher/1.0' } }, (res) => {
          const { statusCode, headers } = res;
          if ([301,302,303,307,308].includes(statusCode)) {
            res.resume(); file.close(); fs.unlink(dest, () => {});
            const next = headers.location.startsWith('http')
              ? headers.location
              : new URL(headers.location, reqUrl).href;
            return doReq(next);
          }
          if (statusCode !== 200) {
            res.resume(); file.close(); fs.unlink(dest, () => {});
            return reject(new Error(`HTTP ${statusCode} для ${label}`));
          }
          const total = totalSize || parseInt(headers['content-length'] || '0', 10);
          res.on('data', chunk => {
            received += chunk.length;
            file.write(chunk);
            if (total > 0) {
              this.emit('progress', {
                file: label,
                percent: Math.round((received / total) * 100),
                received: this._fmt(received),
                total:    this._fmt(total)
              });
            }
          });
          res.on('end',   () => { file.close(); resolve(); });
          res.on('error', e  => { file.close(); fs.unlink(dest, () => {}); reject(e); });
        });
        req.on('error', e => { file.close(); fs.unlink(dest, () => {}); reject(e); });
        req.setTimeout(60_000, () => { req.destroy(); reject(new Error('Timeout: ' + label)); });
      };
      doReq(url);
    });
  }

  _fetchJSON(url) {
    return new Promise((resolve, reject) => {
      const doReq = (reqUrl) => {
        const lib = reqUrl.startsWith('https') ? https : http;
        lib.get(reqUrl, { headers: { 'User-Agent': 'YCraft-Launcher/1.0' }, timeout: 15000 }, (res) => {
          const { statusCode, headers } = res;
          if ([301,302,303,307,308].includes(statusCode)) {
            res.resume();
            return doReq(headers.location.startsWith('http')
              ? headers.location
              : new URL(headers.location, reqUrl).href);
          }
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            try   { resolve(JSON.parse(data)); }
            catch { reject(new Error('Некоректний JSON з ' + reqUrl)); }
          });
          res.on('error', reject);
        }).on('error', reject);
      };
      doReq(url);
    });
  }

  _fmt(b = 0) {
    if (b < 1024)          return b + ' Б';
    if (b < 1_048_576)     return (b / 1024).toFixed(1)        + ' КБ';
    if (b < 1_073_741_824) return (b / 1_048_576).toFixed(1)   + ' МБ';
    return (b / 1_073_741_824).toFixed(2) + ' ГБ';
  }
}

module.exports = { ModpackManager };
