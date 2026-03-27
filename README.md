#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════╗
 *  Y-Craft — Генератор маніфесту модпаку
 *  Запуск: node create-manifest.js
 * ╚══════════════════════════════════════════════════════╝
 *
 * Що робить:
 *  1. Сканує папки mods/, config/, resourcepacks/, shaderpacks/
 *  2. Рахує SHA1 кожного файлу
 *  3. Записує manifest.json який лаунчер використовує для авто-оновлень
 *
 * Після генерації:
 *  - Завантаж всі файли на свій CDN/хостинг
 *  - Заміни BASE_URL на реальну адресу
 *  - Постав manifest.json на сервер оновлень
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const https  = require('https');
const http   = require('http');

// ── НАЛАШТУВАННЯ ──────────────────────────────────────────
const CONFIG = {
  // Папка де лежать твої готові мод-файли (mods/, config/ тощо)
  sourceDir: process.argv[2] || '.',

  // Базова URL де будуть лежати файли після завантаження на хостинг
  // Приклад: 'https://cdn.y-craft.net/modpack'
  baseUrl: process.argv[3] || 'https://cdn.y-craft.net/modpack',

  // Версія паку — збільшуй кожного разу коли змінюєш файли
  packVersion: process.argv[4] || '1.0.0',

  // Папки які включати в маніфест
  includeDirs: ['mods', 'config', 'resourcepacks', 'shaderpacks'],

  // Розширення файлів які включати
  includeExts: ['.jar', '.zip', '.toml', '.cfg', '.json', '.properties', '.txt', '.png'],

  // Файли які НЕ включати
  excludePatterns: [
    /^\./, /~$/, /\.tmp$/, /desktop\.ini$/i, /thumbs\.db$/i,
    /^__MACOSX/, /\.DS_Store$/,
  ],
};
// ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(' Y-Craft — Генератор маніфесту модпаку');
  console.log('╚══════════════════════════════════════════╝\n');

  const sourceDir = path.resolve(CONFIG.sourceDir);
  console.log(`📁 Джерело:    ${sourceDir}`);
  console.log(`🌐 Базовий URL: ${CONFIG.baseUrl}`);
  console.log(`📦 Версія паку: ${CONFIG.packVersion}\n`);

  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Папка не знайдена: ${sourceDir}`);
    console.log('\nВикористання:');
    console.log('  node create-manifest.js <шлях_до_папки_гри> <base_url> <версія>');
    console.log('\nПриклад:');
    console.log('  node create-manifest.js "C:/Users/Admin/AppData/Roaming/.ycraft" "https://cdn.y-craft.net/pack" "1.2.0"');
    process.exit(1);
  }

  const files = [];
  let totalSize = 0;

  for (const dir of CONFIG.includeDirs) {
    const fullDir = path.join(sourceDir, dir);
    if (!fs.existsSync(fullDir)) {
      console.log(`  ⏭  Пропуск (немає папки): ${dir}/`);
      continue;
    }

    console.log(`  📂 Сканування: ${dir}/`);
    const found = scanDir(fullDir, sourceDir);
    console.log(`     → Знайдено ${found.length} файлів`);
    files.push(...found);
  }

  console.log(`\n⏳ Рахуємо SHA1 для ${files.length} файлів…\n`);

  const manifest = {
    version:      CONFIG.packVersion,
    mcVersion:    '1.20.1',
    forgeVersion: '47.4.10',
    generated:    new Date().toISOString(),
    files:        [],
  };

  for (let i = 0; i < files.length; i++) {
    const f    = files[i];
    const sha1 = await hashFile(f.absPath);
    const size = fs.statSync(f.absPath).size;
    totalSize += size;

    // Нормалізуємо шлях (завжди прямий слеш)
    const relPath = f.relPath.replace(/\\/g, '/');

    manifest.files.push({
      name:  path.basename(f.absPath),
      path:  relPath,
      url:   `${CONFIG.baseUrl}/${relPath}`,
      sha1,
      size,
    });

    process.stdout.write(`\r  [${i + 1}/${files.length}] ${path.basename(f.absPath).slice(0, 50).padEnd(50)}`);
  }

  console.log('\n');

  // Зберігаємо manifest.json
  const outPath = path.join(sourceDir, 'modpack.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('╔══════════════════════════════════════════╗');
  console.log(' ✅  Маніфест успішно створено!');
  console.log('╠══════════════════════════════════════════╣');
  console.log(` 📄 Файл:      ${outPath}`);
  console.log(` 📦 Файлів:    ${manifest.files.length}`);
  console.log(` 💾 Розмір:    ${fmtSize(totalSize)}`);
  console.log('╠══════════════════════════════════════════╣');
  console.log(' Наступні кроки:');
  console.log('');
  console.log(' 1. Завантаж усі файли на твій CDN/хостинг:');
  console.log(`    Структура папок має повторювати: ${CONFIG.baseUrl}/mods/...`);
  console.log('');
  console.log(' 2. Постав modpack.json на сервер оновлень:');
  console.log(`    ${CONFIG.baseUrl.replace('/modpack', '')}/modpack/manifest.json`);
  console.log('');
  console.log(' 3. В src/main/main.js переконайся що:');
  console.log(`    MODPACK_MANIFEST_URL = '${CONFIG.baseUrl.replace('/modpack', '')}/modpack/manifest.json'`);
  console.log('╚══════════════════════════════════════════╝\n');

  // Додатково — генеруємо upload-list.txt для зручності
  const uploadList = manifest.files
    .map(f => `${path.join(sourceDir, f.path.replace(/\//g, path.sep))}  →  ${f.url}`)
    .join('\n');
  const uploadPath = path.join(sourceDir, 'upload-list.txt');
  fs.writeFileSync(uploadPath, uploadList, 'utf8');
  console.log(`📋 Список для завантаження збережено: ${uploadPath}\n`);
}

// ── Рекурсивне сканування папки ───────────────────────────
function scanDir(dir, baseDir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir)) {
    // Перевіряємо виключення
    if (CONFIG.excludePatterns.some(p => p.test(entry))) continue;

    const fullPath = path.join(dir, entry);
    const stat     = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...scanDir(fullPath, baseDir));
    } else if (stat.isFile()) {
      const ext = path.extname(entry).toLowerCase();
      if (CONFIG.includeExts.includes(ext) || dir.includes('mods')) {
        results.push({
          absPath: fullPath,
          relPath: path.relative(baseDir, fullPath),
        });
      }
    }
  }
  return results;
}

// ── SHA1 хеш файлу ────────────────────────────────────────
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash   = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end',  () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ── Форматування розміру ──────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1_048_576)    return (bytes / 1024).toFixed(1)    + ' КБ';
  if (bytes < 1_073_741_824) return (bytes / 1_048_576).toFixed(1) + ' МБ';
  return (bytes / 1_073_741_824).toFixed(2) + ' ГБ';
}

main().catch(e => {
  console.error('\n❌ Помилка:', e.message);
  process.exit(1);
});
