'use strict';

const { EventEmitter } = require('events');
const path    = require('path');
const fs      = require('fs');
const https   = require('https');
const http    = require('http');
const crypto  = require('crypto');
const os      = require('os');
const { spawn, spawnSync } = require('child_process');

const MC_VERSION    = '1.20.1';
const FORGE_VERSION = '47.4.10';

const FORGE_INSTALLER_URL =
  `https://maven.minecraftforge.net/net/minecraftforge/forge/` +
  `${MC_VERSION}-${FORGE_VERSION}/` +
  `forge-${MC_VERSION}-${FORGE_VERSION}-installer.jar`;

const FORGE_INSTALLER_URL_2 =
  `https://files.minecraftforge.net/maven/net/minecraftforge/forge/` +
  `${MC_VERSION}-${FORGE_VERSION}/` +
  `forge-${MC_VERSION}-${FORGE_VERSION}-installer.jar`;

const VANILLA_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';

const MAVEN_REPOS = [
  'https://maven.minecraftforge.net/',
  'https://files.minecraftforge.net/maven/',
  'https://repo1.maven.org/maven2/',
  'https://libraries.minecraft.net/',
  'https://maven.fabricmc.net/',
];

class ForgeInstaller extends EventEmitter {
  constructor(gameDir, mcVersion, forgeVersion, log) {
    super();
    this.gameDir      = gameDir;
    this.mcVersion    = mcVersion    || MC_VERSION;
    this.forgeVersion = forgeVersion || FORGE_VERSION;
    this.versionId    = `${this.mcVersion}-forge-${this.forgeVersion}`;
    this.log          = log;
    this.installerJar = path.join(gameDir, 'forge-installer.jar');
    this.installerDir = path.join(os.tmpdir(), `ycraft-forge-${Date.now()}`);
    this._storedJava  = '';
  }

  setJavaPath(p) { this._storedJava = p || ''; }

  isInstalled() {

    const vJson = path.join(
      this.gameDir, 'versions', this.versionId, `${this.versionId}.json`
    );
    const forgeClient = path.join(
      this.gameDir, 'libraries',
      'net', 'minecraftforge', 'forge',
      `${this.mcVersion}-${this.forgeVersion}`,
      `forge-${this.mcVersion}-${this.forgeVersion}-client.jar`
    );
    return fs.existsSync(vJson) && fs.existsSync(forgeClient)
      && fs.statSync(forgeClient).size > 0;
  }

  async install() {
    fs.mkdirSync(this.gameDir,    { recursive: true });
    fs.mkdirSync(this.installerDir, { recursive: true });

    try {

      const vanillaJson = await this._ensureVanilla();

      await this._ensureAssets(vanillaJson);

      this._status('Завантаження Forge installer…', 2, 5);
      await this._downloadInstaller();

      this._status('Розпакування Forge installer…', 3, 5);
      const { installProfile, forgeVersionJson } = await this._extractInstaller();

      this._status('Завантаження бібліотек Forge…', 4, 6);
      const allLibs = [
        ...(installProfile.libraries || []),
        ...(forgeVersionJson.libraries || []),
      ];
      await this._downloadDependencies(allLibs);

      this._createLauncherProfiles();

      this._status('Forge processors... (1-5 хвилин, не закривайте)', 5, 6);
      await this._runForgeInstaller();

      this._status('Завершення встановлення...', 6, 6);
      await this._setupVersionDir(forgeVersionJson);

      this._status('Forge успішно встановлено!', 5, 5, true);

    } finally {

      try { fs.rmSync(this.installerDir, { recursive: true, force: true }); } catch {}
    }
  }

  async _ensureVanilla() {
    const versionsDir = path.join(this.gameDir, 'versions', this.mcVersion);
    const jarPath     = path.join(versionsDir, `${this.mcVersion}.jar`);
    const jsonPath    = path.join(versionsDir, `${this.mcVersion}.json`);
    fs.mkdirSync(versionsDir, { recursive: true });

    this._status('Перевірка Minecraft…', 0, 5);

    let vJson;
    if (fs.existsSync(jsonPath)) {
      try { vJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); }
      catch { vJson = null; }
    }
    if (!vJson?.downloads?.client) {
      const manifest = await this._fetchJSON(VANILLA_MANIFEST_URL);
      const entry    = manifest.versions.find(v => v.id === this.mcVersion);
      if (!entry) throw new Error(`Minecraft ${this.mcVersion} не знайдено`);
      vJson = await this._fetchJSON(entry.url);
      fs.writeFileSync(jsonPath, JSON.stringify(vJson, null, 2));
    }

    const { url: clientUrl, sha1: clientSha1, size: clientSize } = vJson.downloads.client;
    let needJar = !fs.existsSync(jarPath);
    if (!needJar && clientSha1) {
      const actual = await this._sha1(jarPath);
      if (actual !== clientSha1) { fs.unlinkSync(jarPath); needJar = true; }
    }
    if (needJar) {
      this._status('Завантаження Minecraft.jar…', 1, 5);
      await this._dlRetry(clientUrl, jarPath, clientSize, `minecraft-${this.mcVersion}.jar`);
    }

    await this._downloadVanillaLibs(vJson);
    return vJson;
  }

  async _downloadVanillaLibs(vJson) {
    const libsDir = path.join(this.gameDir, 'libraries');
    const osName  = process.platform === 'win32' ? 'windows'
                  : process.platform === 'darwin' ? 'osx' : 'linux';
    const libs    = (vJson.libraries || []).filter(lib => {
      if (!lib.rules) return true;
      return lib.rules.every(r =>
        r.action === 'allow'
          ? (!r.os || r.os.name === osName)
          : (r.os && r.os.name !== osName)
      );
    });
    let done = 0;
    for (const lib of libs) {
      const art = lib.downloads?.artifact;
      if (!art?.url) { done++; continue; }
      const dest = path.join(libsDir, art.path);
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        await this._dl(art.url, dest).catch(e =>
          this.log.warn('[FI] lib skip:', path.basename(art.path), e.message)
        );
      }
      done++;
      if (done % 10 === 0)
        this.emit('progress', { file: 'Бібліотеки MC', percent: Math.round(done/libs.length*100), current: done, total: libs.length });
    }
  }

  async _ensureAssets(vJson) {
    const assetsDir  = path.join(this.gameDir, 'assets');
    const indexesDir = path.join(assetsDir, 'indexes');
    const objectsDir = path.join(assetsDir, 'objects');
    fs.mkdirSync(indexesDir, { recursive: true });
    fs.mkdirSync(objectsDir, { recursive: true });

    const ai = vJson.assetIndex;
    if (!ai) return;
    const indexFile = path.join(indexesDir, `${ai.id}.json`);

    let index;
    if (fs.existsSync(indexFile)) {
      try { index = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch { index = null; }
    }
    if (!index) {
      index = await this._fetchJSON(ai.url);
      fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
    }

    const missing = Object.entries(index.objects || {})
      .filter(([, {hash}]) => !fs.existsSync(path.join(objectsDir, hash.slice(0,2), hash)));

    if (!missing.length) return;
    this._status(`Завантаження ресурсів (${missing.length})…`, 1, 5);

    let done = 0;
    const BATCH = 8;
    for (let i = 0; i < missing.length; i += BATCH) {
      await Promise.all(missing.slice(i, i + BATCH).map(async ([name, {hash}]) => {
        const sub  = hash.slice(0, 2);
        const dest = path.join(objectsDir, sub, hash);
        fs.mkdirSync(path.join(objectsDir, sub), { recursive: true });
        if (!fs.existsSync(dest)) {
          try {
            await this._dl(
              `https://resources.download.minecraft.net/${sub}/${hash}`,
              dest
            );
          } catch (e) {
            this.log.warn('[FI] asset skip:', name, e.message);
          }
        }
        done++;
      }));
      this.emit('progress', {
        file: `Ресурси (${done}/${missing.length})`,
        percent: Math.round(done / missing.length * 100),
        current: done, total: missing.length
      });
    }
  }

  async _downloadInstaller() {
    const MIN = 2_000_000;
    if (fs.existsSync(this.installerJar) && fs.statSync(this.installerJar).size >= MIN) return;
    if (fs.existsSync(this.installerJar)) fs.unlinkSync(this.installerJar);

    const urls = [FORGE_INSTALLER_URL, FORGE_INSTALLER_URL_2];
    let lastErr;
    for (const url of urls) {
      try {
        await this._dlRetry(url, this.installerJar, null, 'forge-installer.jar', 3);
        if (fs.existsSync(this.installerJar) && fs.statSync(this.installerJar).size >= MIN) return;
      } catch (e) { lastErr = e; }
      if (fs.existsSync(this.installerJar)) fs.unlinkSync(this.installerJar);
    }
    throw lastErr || new Error('Не вдалося завантажити Forge installer');
  }

  _createLauncherProfiles() {
    const profilesPath = path.join(this.gameDir, 'launcher_profiles.json');
    if (fs.existsSync(profilesPath)) return;

    const profiles = {
      profiles: {
        forge: {
          name: 'Y-Craft (Forge)',
          type: 'custom',
          created: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          lastVersionId: `${this.mcVersion}-forge-${this.forgeVersion}`,
          gameDir: this.gameDir,
          icon: 'Furnace',
        }
      },
      selectedProfile: 'forge',
      clientToken: crypto.randomUUID ? crypto.randomUUID() : 'ycraft-launcher-token',
      authenticationDatabase: {},
      settings: { enableSnapshots: false, enableAdvanced: false, keepLauncherOpen: false, showGameLog: false },
      launcherVersion: { name: '2.1.0', format: 21 }
    };

    fs.mkdirSync(this.gameDir, { recursive: true });
    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2), 'utf8');
    this.log.info('[FI] Created launcher_profiles.json');
  }

  _runForgeInstaller() {
    return new Promise((resolve, reject) => {
      const java = this._findJava();
      const libsDir = path.join(this.gameDir, 'libraries');
      const args = [
        '-Xmx1g', '-Xms256m',
        '-Djava.awt.headless=true',
        '-Dforge.installer.nogui=true',

        `-Dmaven.repo.local=${libsDir}`,

        `-Dforge.installer.home=${this.gameDir}`,
        '-jar', this.installerJar,
        '--installClient', this.gameDir,
      ];
      this.log.info('[FI] java:', java);
      this.log.info('[FI] libs:', libsDir);
      const env = { ...process.env };
      delete env.JAVA_TOOL_OPTIONS;
      delete env._JAVA_OPTIONS;
      delete env.JDK_JAVA_OPTIONS;
      const proc = spawn(java, args, {
        cwd: this.gameDir, stdio: ['ignore', 'pipe', 'pipe'], env,
      });
      const allOutput = [];
      const onData = (d, isErr) => {
        const lines = d.toString().split(/\r?\n/).filter(l => l.trim());
        for (const line of lines) {
          allOutput.push(line);
          if (isErr || /error|exception|failed|warn/i.test(line)) {
            this.log.warn('[FI-ERR]', line.slice(0, 200));
          } else {
            this.log.info('[FI]', line.slice(0, 120));
          }
          const m = line.match(/\[(\d+)\/(\d+)\]/);
          if (m) {
            this.emit('progress', {
              file: line.replace(/\[.*?\]\s*/, '').slice(0, 70),
              percent: Math.round((parseInt(m[1]) / parseInt(m[2])) * 100),
              current: parseInt(m[1]), total: parseInt(m[2])
            });
          } else if (line.length < 120) {
            this.emit('progress', { message: line });
          }
        }
      };
      proc.stdout.on('data', d => onData(d, false));
      proc.stderr.on('data', d => onData(d, true));
      proc.on('close', (code) => {
        const libsDir = path.join(this.gameDir, 'libraries');
        const forgeClient = path.join(
          libsDir, 'net', 'minecraftforge', 'forge',
          `${this.mcVersion}-${this.forgeVersion}`,
          `forge-${this.mcVersion}-${this.forgeVersion}-client.jar`
        );
        const srgJar = path.join(
          libsDir, 'net', 'minecraft', 'client',
          `${this.mcVersion}-20230612.114412`,
          `client-${this.mcVersion}-20230612.114412-srg.jar`
        );
        const clientOk = fs.existsSync(forgeClient) && fs.statSync(forgeClient).size > 0;
        const srgOk    = fs.existsSync(srgJar)       && fs.statSync(srgJar).size > 0;
        this.log.info('[FI] exit:', code, '| forge-client:', clientOk, '| srg:', srgOk);
        if (code === 0 || (clientOk && srgOk)) { resolve(); return; }
        const logPath = path.join(this.gameDir, 'forge-install.log');
        try { fs.writeFileSync(logPath, allOutput.join('\n')); } catch {}
        const errLine = allOutput.filter(l => /error|exception|failed/i.test(l)).pop()
          || allOutput.slice(-3).join(' ') || 'unknown';
        reject(new Error(
          `Forge installer завершився з кодом ${code}.\nПричина: ${errLine}\nЛог: ${logPath}`
        ));
      });
      proc.on('error', (err) => {
        reject(err.code === 'ENOENT'
          ? new Error('Java не знайдено! Встановіть Java 17+ та вкажіть шлях у Налаштуваннях.')
          : err);
      });
    });
  }

  async _extractInstaller() {

    await this._unzipFile(this.installerJar, this.installerDir);

    const ipPath = path.join(this.installerDir, 'install_profile.json');
    if (!fs.existsSync(ipPath))
      throw new Error('install_profile.json не знайдено в installer.jar — пошкоджений архів?');
    const installProfile = JSON.parse(fs.readFileSync(ipPath, 'utf8'));

    const vpPath = path.join(this.installerDir, 'version.json');
    if (!fs.existsSync(vpPath))
      throw new Error('version.json не знайдено в installer.jar');
    const forgeVersionJson = JSON.parse(fs.readFileSync(vpPath, 'utf8'));

    return { installProfile, forgeVersionJson };
  }

  async _unzipFile(zipPath, destDir) {

    try {
      const StreamZip = require('node-stream-zip');
      const zip = new StreamZip.async({ file: zipPath });
      const entries = await zip.entries();
      let done = 0;
      const total = Object.keys(entries).length;
      for (const [name, entry] of Object.entries(entries)) {
        const dest = path.join(destDir, ...name.split('/'));
        if (entry.isDirectory) {
          fs.mkdirSync(dest, { recursive: true });
        } else {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          await zip.extract(name, dest);
        }
        done++;
        if (done % 50 === 0) {
          this.emit('progress', {
            file: 'Розпакування installer…',
            percent: Math.round(done / total * 100),
            current: done, total
          });
        }
      }
      await zip.close();
      this.log.info('[FI] Extracted', total, 'entries via node-stream-zip');
      return;
    } catch (e) {
      this.log.warn('[FI] node-stream-zip failed:', e.message);
    }

    try {
      const extractZip = require('extract-zip');
      await extractZip(zipPath, { dir: destDir });
      this.log.info('[FI] Extracted via extract-zip');
      return;
    } catch (e) {
      this.log.warn('[FI] extract-zip failed:', e.message);
    }

    if (process.platform !== 'win32') {
      await new Promise((resolve, reject) => {
        const proc = spawn('unzip', ['-o', '-q', zipPath, '-d', destDir], { stdio: 'pipe' });
        proc.on('close', code => (code === 0 || code === 1) ? resolve() : reject(new Error('unzip code ' + code)));
        proc.on('error', reject);
      });
      return;
    }

    throw new Error('Не вдалося розпакувати forge-installer.jar. Виконайте: npm install у папці лаунчера');
  }

  async _setupVersionDir(forgeVersionJson) {
    const vDir     = path.join(this.gameDir, 'versions', this.versionId);
    const vJsonDst = path.join(vDir, `${this.versionId}.json`);
    fs.mkdirSync(vDir, { recursive: true });

    fs.writeFileSync(vJsonDst, JSON.stringify(forgeVersionJson, null, 2));

    const mavenSrc = path.join(this.installerDir, 'maven');
    if (fs.existsSync(mavenSrc)) {
      this._copyDir(mavenSrc, path.join(this.gameDir, 'libraries'));
    }
  }

  _copyDir(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dst, entry.name);
      if (entry.isDirectory()) this._copyDir(s, d);
      else if (!fs.existsSync(d)) fs.copyFileSync(s, d);
    }
  }

  async _downloadDependencies(libs) {

    if (!Array.isArray(libs)) libs = libs.libraries || [];
    const libsDir = path.join(this.gameDir, 'libraries');

    const seen = new Set();
    libs = libs.filter(lib => {
      const key = lib.downloads?.artifact?.path || lib.name || Math.random();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let done = 0;

    for (const lib of libs) {
      const art  = lib.downloads?.artifact;
      const dest = art
        ? path.join(libsDir, art.path)
        : this._mavenPathFromName(libsDir, lib.name);

      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
        done++;
        continue;
      }

      fs.mkdirSync(path.dirname(dest), { recursive: true });

      const urls = [];
      if (art?.url)  urls.push(art.url);
      if (lib.url)   urls.push(lib.url);
      if (lib.name) {
        const relPath = this._mavenRelPath(lib.name);
        for (const repo of MAVEN_REPOS) {
          urls.push(repo + relPath);
        }
      }

      let ok = false;
      for (const url of urls) {
        try {
          await this._dl(url, dest);
          if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { ok = true; break; }
        } catch {}
      }
      if (!ok) this.log.warn('[FI] dependency not found:', lib.name || art?.path);

      done++;
      this.emit('progress', {
        file:    lib.name ? lib.name.split(':')[1] : path.basename(dest),
        percent: Math.round(done / libs.length * 100),
        current: done, total: libs.length
      });
    }
  }

  async _runProcessors(installProfile, vanillaJson) {
    const processors = (installProfile.processors || [])
      .filter(p => {

        if (!p.sides) return true;
        return p.sides.includes('client');
      });

    if (!processors.length) {
      this.log.info('[FI] No processors to run');
      return;
    }

    const data     = installProfile.data || {};
    const libsDir  = path.join(this.gameDir, 'libraries');
    const java     = this._findJava();

    const vars = this._buildProcessorVars(installProfile, vanillaJson, libsDir);

    for (let i = 0; i < processors.length; i++) {
      const proc = processors[i];
      this.emit('progress', {
        file:    `Processor ${i+1}/${processors.length}: ${proc.jar?.split(':')[1] || '?'}`,
        percent: Math.round((i / processors.length) * 100),
        current: i, total: processors.length
      });

      await this._runOneProcessor(proc, vars, libsDir, java);
    }
  }

  _buildProcessorVars(installProfile, vanillaJson, libsDir) {
    const data        = installProfile.data || {};
    const versionsDir = path.join(this.gameDir, 'versions');
    const vanillaJar  = path.join(versionsDir, this.mcVersion, `${this.mcVersion}.jar`);
    const forgeJar    = path.join(versionsDir, this.versionId, `${this.versionId}.jar`);

    const vars = {
      SIDE:       'client',
      MINECRAFT_JAR: vanillaJar,
      ROOT:       this.gameDir,
      INSTALLER:  this.installerJar,
      LIBRARY_DIR: libsDir,
    };

    for (const [key, val] of Object.entries(data)) {
      const v = val.client !== undefined ? val.client : val;
      if (typeof v === 'string') {
        if (v.startsWith('[') && v.endsWith(']')) {

          vars[key] = this._mavenPathFromName(libsDir, v.slice(1,-1));
        } else if (v.startsWith('/')) {

          vars[key] = path.join(this.installerDir, v);
        } else {
          vars[key] = v;
        }
      }
    }

    return vars;
  }

  _runOneProcessor(proc, vars, libsDir, java) {
    return new Promise((resolve, reject) => {

      const procJar = this._mavenPathFromName(libsDir, proc.jar);
      if (!fs.existsSync(procJar)) {
        this.log.warn('[FI] processor jar not found, skipping:', proc.jar);
        return resolve();
      }

      const cp = [procJar, ...(proc.classpath || [])
        .map(c => this._mavenPathFromName(libsDir, c))
        .filter(p => fs.existsSync(p))
      ].join(path.delimiter);

      const args = (proc.args || []).map(a => this._substVars(a, vars));

      const env = { ...process.env };
      delete env.JAVA_TOOL_OPTIONS;
      delete env._JAVA_OPTIONS;

      const child = spawn(java, ['-cp', cp, proc.mainClass || 'Main', ...args], {
        stdio: 'pipe',
        env
      });

      let out = '';
      child.stdout.on('data', d => { out += d; });
      child.stderr.on('data', d => { out += d; });

      child.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          this.log.warn('[FI] processor exit', code, '\n', out.slice(-500));

          resolve();
        }
      });

      child.on('error', e => {
        this.log.warn('[FI] processor spawn error:', e.message);
        resolve();
      });
    });
  }

  _mavenRelPath(coords) {
    const parts = coords.split(':');
    const [group, artifact, version, classifier] = parts;
    const fname = classifier
      ? `${artifact}-${version}-${classifier}.jar`
      : `${artifact}-${version}.jar`;
    return [...group.split('.'), artifact, version, fname].join('/');
  }

  _mavenPathFromName(libsDir, coords) {
    return path.join(libsDir, ...this._mavenRelPath(coords).split('/'));
  }

  _substVars(val, vars) {
    if (val.startsWith('{') && val.endsWith('}')) {
      const key = val.slice(1,-1);
      return vars[key] !== undefined ? vars[key] : val;
    }
    if (val.startsWith('[') && val.endsWith(']')) {
      return this._mavenPathFromName(
        path.join(this.gameDir, 'libraries'),
        val.slice(1,-1)
      );
    }
    return val;
  }

  async _dlRetry(url, dest, size, label, tries = 3) {
    let err;
    for (let i = 0; i < tries; i++) {
      if (i > 0) {
        this._status(`Повтор ${i}/${tries-1}: ${label}…`, 2, 5);
        await new Promise(r => setTimeout(r, 2000 * i));
      }
      try {
        await this._dlProgress(url, dest, size, label);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return;
      } catch (e) {
        err = e;
        if (fs.existsSync(dest)) { try { fs.unlinkSync(dest); } catch {} }
      }
    }
    throw err || new Error('Download failed: ' + label);
  }

  _dlProgress(url, dest, totalSize, label) {
    return new Promise((resolve, reject) => {
      const go = (u) => {
        const lib  = u.startsWith('https') ? https : http;
        const file = fs.createWriteStream(dest);
        let rx = 0;
        const req = lib.get(u, { headers: { 'User-Agent': 'YCraft/1.0' } }, (res) => {
          const { statusCode: sc, headers: h } = res;
          if ([301,302,303,307,308].includes(sc)) {
            res.resume(); file.close(); try{fs.unlinkSync(dest);}catch{}
            return go(h.location.startsWith('http') ? h.location : new URL(h.location, u).href);
          }
          if (sc !== 200) {
            res.resume(); file.close(); try{fs.unlinkSync(dest);}catch{}
            return reject(new Error(`HTTP ${sc}: ${label}`));
          }
          const total = totalSize || parseInt(h['content-length']||'0', 10);
          res.on('data', c => {
            rx += c.length; file.write(c);
            if (total > 0) this.emit('progress', {
              file: label, percent: Math.round(rx/total*100),
              received: this._fmt(rx), total: this._fmt(total)
            });
          });
          res.on('end',   () => { file.close(); resolve(); });
          res.on('error', e  => { file.close(); try{fs.unlinkSync(dest);}catch{}; reject(e); });
        });
        req.on('error', e => { file.close(); try{fs.unlinkSync(dest);}catch{}; reject(e); });
        req.setTimeout(90_000, () => { req.destroy(); reject(new Error('Timeout: '+label)); });
      };
      go(url);
    });
  }

  _dl(url, dest) {

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        try { fs.unlinkSync(dest); } catch {}
        reject(new Error('Timeout 20s: ' + url.slice(-60)));
      }, 20_000);

      const go = (u) => {
        const lib  = u.startsWith('https') ? https : http;
        const file = fs.createWriteStream(dest);
        const done = (err) => {
          clearTimeout(timer);
          file.close();
          if (err) { try{fs.unlinkSync(dest);}catch{}; reject(err); }
          else resolve();
        };
        const req = lib.get(u, { headers: { 'User-Agent': 'YCraft/1.0' } }, (res) => {
          const { statusCode: sc, headers: h } = res;
          if ([301,302,303,307,308].includes(sc)) {
            res.resume(); file.close();
            try{fs.unlinkSync(dest);}catch{}
            return go(h.location.startsWith('http') ? h.location : new URL(h.location, u).href);
          }
          if (sc !== 200) {
            res.resume();
            return done(new Error('HTTP ' + sc));
          }
          res.pipe(file);
          file.on('finish', () => done(null));
          file.on('error',  e => done(e));
        });
        req.on('error', e => done(e));
      };
      go(url);
    });
  }

  _fetchJSON(url) {
    return new Promise((resolve, reject) => {
      const go = (u) => {
        const lib = u.startsWith('https') ? https : http;
        lib.get(u, { headers:{'User-Agent':'YCraft/1.0'}, timeout:15000 }, (res) => {
          const {statusCode:sc, headers:h} = res;
          if ([301,302,303,307,308].includes(sc)) {
            res.resume();
            return go(h.location.startsWith('http') ? h.location : new URL(h.location, u).href);
          }
          let d = '';
          res.on('data', c => d += c);
          res.on('end',  () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Bad JSON: '+u)); } });
          res.on('error', reject);
        }).on('error', reject);
      };
      go(url);
    });
  }

  _sha1(filePath) {
    return new Promise((resolve, reject) => {
      const h = crypto.createHash('sha1');
      fs.createReadStream(filePath)
        .on('data', d => h.update(d))
        .on('end',  () => resolve(h.digest('hex')))
        .on('error', reject);
    });
  }

  _status(msg, step, steps, done = false) {
    this.emit('status', { message: msg, step, steps, done });
    this.log.info('[ForgeInstaller] step', step, '/', steps);
  }

  _fmt(b = 0) {
    if (b < 1024)         return b + ' Б';
    if (b < 1_048_576)    return (b/1024).toFixed(1)      + ' КБ';
    if (b < 1_073_741_824) return (b/1_048_576).toFixed(1) + ' МБ';
    return (b/1_073_741_824).toFixed(2) + ' ГБ';
  }

  _findJava() {
    if (this._storedJava && fs.existsSync(this._storedJava)) return this._storedJava;
    if (process.env.JAVA_HOME) {
      const jp = path.join(process.env.JAVA_HOME, 'bin',
        process.platform === 'win32' ? 'java.exe' : 'java');
      if (fs.existsSync(jp)) return jp;
    }
    const c = process.platform === 'win32' ? [
      'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
      'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
      'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.5.11-hotspot\\bin\\java.exe',
      'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.4.7-hotspot\\bin\\java.exe',
      'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.13.11-hotspot\\bin\\java.exe',
      'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.9.9-hotspot\\bin\\java.exe',
      'C:\\Program Files\\Microsoft\\jdk-21.0.5.11-hotspot\\bin\\java.exe',
      'C:\\Program Files\\Microsoft\\jdk-17.0.9.8-hotspot\\bin\\java.exe',
      'C:\\Program Files\\Zulu\\zulu-21\\bin\\java.exe',
      'C:\\Program Files\\Zulu\\zulu-17\\bin\\java.exe',
    ] : process.platform === 'darwin' ? [
      '/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin/java',
      '/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home/bin/java',
      '/usr/local/bin/java',
    ] : [
      '/usr/lib/jvm/java-21-openjdk-amd64/bin/java',
      '/usr/lib/jvm/java-17-openjdk-amd64/bin/java',
      '/usr/bin/java',
    ];
    for (const p of c) if (fs.existsSync(p)) return p;
    return 'java';
  }
}

module.exports = { ForgeInstaller };
