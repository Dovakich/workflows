'use strict';
/**
 * GameLauncher — Forge 1.20.1-47.4.10
 *
 * Правильний підхід (як Prism Launcher):
 *  1. Forge version.json вже містить ПРАВИЛЬНІ JVM аргументи:
 *     -p <bootstrap:securejar:...>  --add-modules ALL-MODULE-PATH
 *     --add-opens --add-exports  -DlibraryDirectory  тощо
 *  2. Ми просто підставляємо ${змінні} і передаємо ці аргументи Java
 *  3. НЕ генеруємо власний -p — це і була причина помилки
 *
 *  Classpath (cp) = ванільні бібліотеки + minecraft.jar  (vanilla JSON)
 *  Module path (p) = bootstrap + securejar + ...          (Forge JSON)
 *  MainClass      = cpw.mods.bootstraplauncher.BootstrapLauncher (Forge JSON)
 */

const { EventEmitter } = require('events');
const { spawn }        = require('child_process');
const path             = require('path');
const fs               = require('fs');
const crypto           = require('crypto');

const MC_VERSION    = '1.20.1';
const FORGE_VERSION = '47.4.10';

class GameLauncher extends EventEmitter {
  constructor(store, log) {
    super();
    this.store   = store;
    this.log     = log;
    this.process = null;
  }

  async launch(opts = {}) {
    if (this.process) throw new Error('Гра вже запущена');

    const gameDir  = this.store.get('gameDir');
    const username = (opts.username  || this.store.get('username') || 'Player').trim();
    const ram      = opts.ram        || this.store.get('ram')          || 2048;
    const javaPath = opts.javaPath   || this.store.get('javaPath')     || this._detectJava();
    const width    = opts.width      || this.store.get('windowWidth')  || 1280;
    const height   = opts.height     || this.store.get('windowHeight') || 720;
    const serverIP = this.store.get('serverIP') || '';
    const autoConn = opts.autoConnect !== undefined
      ? opts.autoConnect : this.store.get('autoConnect');

    const forgeVersionId = `${MC_VERSION}-forge-${FORGE_VERSION}`;
    const libsDir        = path.join(gameDir, 'libraries');
    const assetsDir      = path.join(gameDir, 'assets');
    const nativesDir     = path.join(gameDir, 'versions', forgeVersionId, 'natives');

    // ── Читаємо JSON-и ──────────────────────────────────────────────────────
    const forgeJsonPath = path.join(gameDir, 'versions', forgeVersionId, `${forgeVersionId}.json`);
    if (!fs.existsSync(forgeJsonPath)) {
      throw new Error('Forge не встановлено. Натисніть ГРАТИ ще раз для встановлення.');
    }

    const forgeJson   = JSON.parse(fs.readFileSync(forgeJsonPath, 'utf8'));
    const inheritsFrom = forgeJson.inheritsFrom || MC_VERSION;

    const vanillaJsonPath = path.join(gameDir, 'versions', inheritsFrom, `${inheritsFrom}.json`);
    if (!fs.existsSync(vanillaJsonPath)) {
      throw new Error(`${inheritsFrom}.json не знайдено. Перевстановіть Forge.`);
    }
    const vanillaJson = JSON.parse(fs.readFileSync(vanillaJsonPath, 'utf8'));

    // ── Нативи ─────────────────────────────────────────────────────────────
    fs.mkdirSync(nativesDir, { recursive: true });
    await this._extractNatives(vanillaJson, libsDir, nativesDir);

    // ── Classpath = vanilla libs + Forge version.json libs + minecraft.jar
    // ВАЖЛИВО: -DlegacyClassPath=${classpath} в Forge JVM args читає ЦЕЙ classpath!
    // BootstrapLauncher.main:141 робить orElseThrow() на legacyClassPath — якщо пустий, падає.
    const vanillaJar = path.join(gameDir, 'versions', inheritsFrom, `${inheritsFrom}.jar`);
    if (!fs.existsSync(vanillaJar)) {
      throw new Error(`${inheritsFrom}.jar не знайдено. Перевстановіть Forge.`);
    }
    const classpath = this._buildFullClasspath(vanillaJson, forgeJson, libsDir, vanillaJar);

    // ── Змінні підстановки ──────────────────────────────────────────────────
    const uuid = this._offlineUUID(username);
    const assetIndex = forgeJson.assetIndex?.id
                    || vanillaJson.assetIndex?.id
                    || inheritsFrom;

    const vars = {
      '${natives_directory}':    nativesDir,
      '${launcher_name}':        'YCraftLauncher',
      '${launcher_version}':     '1.0.0',
      '${classpath}':            classpath,
      '${auth_player_name}':     username,
      '${version_name}':         forgeVersionId,
      '${game_directory}':       gameDir,
      '${assets_root}':          assetsDir,
      '${assets_index_name}':    assetIndex,
      '${auth_uuid}':            uuid,
      '${auth_xuid}':            '0',
      '${auth_access_token}':    '0',
      '${clientid}':             '0',
      '${user_type}':            'legacy',
      '${version_type}':         'release',
      // Forge-specific — обов'язкові для BootstrapLauncher
      '${library_directory}':    libsDir,
      '${classpath_separator}':  path.delimiter,
      // resolution
      '${resolution_width}':     String(width),
      '${resolution_height}':    String(height),
    };

    // ── JVM аргументи ──────────────────────────────────────────────────────
    // Починаємо з налаштувань пам'яті
    const jvmArgs = [
      `-Xms512m`,
      `-Xmx${ram}m`,
      `-XX:+UnlockExperimentalVMOptions`,
      `-XX:+UseG1GC`,
      `-XX:G1NewSizePercent=20`,
      `-XX:G1ReservePercent=20`,
      `-XX:MaxGCPauseMillis=50`,
      `-XX:G1HeapRegionSize=32M`,
    ];

    // ── Forge JVM аргументи ─────────────────────────────────────────────────
    // Читаємо ВСІ JVM аргументи з Forge version.json — вони вже ПРАВИЛЬНІ:
    //   -p <точний список bootstrap JAR>  (не чіпаємо!)
    //   --add-opens, --add-exports        (не чіпаємо!)
    //   -DlibraryDirectory                (не чіпаємо!)
    // НЕ генеруємо власний -p — саме це і спричиняло дублікати модулів!
    const forgeJvmArgs = this._processArgs(forgeJson.arguments?.jvm || [], vars);
    jvmArgs.push(...forgeJvmArgs);

    // BootstrapLauncher потребує legacyClassPath — встановлюємо ЯВНО
    // (System.getProperty("legacyClassPath").orElseThrow() на рядку 141)
    // Видаляємо старе значення якщо version.json вже підставив його
    for (let i = jvmArgs.length - 1; i >= 0; i--) {
      if (jvmArgs[i].startsWith('-DlegacyClassPath=') ||
          jvmArgs[i].startsWith('-DlegacyClassPath.separator=')) {
        jvmArgs.splice(i, 1);
      }
    }
    jvmArgs.push(`-DlegacyClassPath=${classpath}`);
    jvmArgs.push(`-DlegacyClassPath.separator=${path.delimiter}`);

    // ignoreList — BootstrapLauncher виключає ці JAR з module path, лишає у legacy CP
    // ВАЖЛИВО: 1.20.1.jar ОБОВ'ЯЗКОВО тут — без цього він стає авто-модулем _1._20._1
    // що конфліктує з Forge модулем "minecraft"
    const ourIgnoreList = this._buildIgnoreList(libsDir).split(',').filter(Boolean);

    // Видаляємо існуючий -DignoreList (може бути з Forge JSON з неповним списком)
    // і замінюємо на злитий список
    let existingIgnore = '';
    for (let i = jvmArgs.length - 1; i >= 0; i--) {
      if (jvmArgs[i].startsWith('-DignoreList=')) {
        existingIgnore = jvmArgs[i].slice('-DignoreList='.length);
        jvmArgs.splice(i, 1);
      }
    }
    const existingItems = existingIgnore.split(',').filter(Boolean);
    const mergedIgnore  = [...new Set([...existingItems, ...ourIgnoreList])].join(',');
    if (mergedIgnore) {
      jvmArgs.push(`-DignoreList=${mergedIgnore}`);
      this.log.info('[GL] ignoreList:', mergedIgnore);
    }

    // Стандартні флаги
    if (!jvmArgs.some(a => a.startsWith('-Djava.library.path'))) {
      jvmArgs.push(`-Djava.library.path=${nativesDir}`);
    }
    if (!jvmArgs.some(a => a.startsWith('-Dlog4j2'))) {
      jvmArgs.push('-Dlog4j2.formatMsgNoLookups=true');
    }

    // ── Main class ─────────────────────────────────────────────────────────
    const mainClass = forgeJson.mainClass || 'cpw.mods.bootstraplauncher.BootstrapLauncher';

    // ── Game аргументи ──────────────────────────────────────────────────────
    // Vanilla game args (--username, --version, --gameDir, --assetsDir тощо)
    const vanillaGameArgs = this._processArgs(vanillaJson.arguments?.game || [], vars);

    // Forge game args (зазвичай порожні для client)
    const forgeGameArgs = this._processArgs(forgeJson.arguments?.game || [], vars);

    // Старий формат
    const legacyArgs = [];
    if (!vanillaGameArgs.length && vanillaJson.minecraftArguments) {
      vanillaJson.minecraftArguments.split(' ')
        .forEach(a => legacyArgs.push(this._subst(a, vars)));
    }

    // Об'єднуємо унікальні аргументи
    const gameArgs = this._mergeGameArgs(vanillaGameArgs, forgeGameArgs, legacyArgs);

    // Авто-підключення
    if (autoConn && serverIP) {
      const [host, port = '25565'] = serverIP.split(':');
      if (!gameArgs.includes('--server')) {
        gameArgs.push('--server', host, '--port', port);
      }
    }

    // ── Фінальна команда ────────────────────────────────────────────────────
    const fullArgs = [...jvmArgs, mainClass, ...gameArgs];

    this.log.info('[GL] ═══════ LAUNCH ═══════');
    this.log.info('[GL] java:', javaPath);
    this.log.info('[GL] mainClass:', mainClass);
    this.log.info('[GL] gameDir:', gameDir);
    this.log.info('[GL] args count:', fullArgs.length);

    // Логуємо повну команду (для діагностики)
    const debugCmd = [javaPath, ...fullArgs].map(a =>
      a.includes(' ') ? `"${a}"` : a
    ).join(' ');
    this.log.info('[GL] CMD:', debugCmd.slice(0, 500));

    // ── Запуск ──────────────────────────────────────────────────────────────
    const env = { ...process.env };
    delete env.JAVA_TOOL_OPTIONS;
    delete env._JAVA_OPTIONS;
    delete env.JDK_JAVA_OPTIONS;

    this.process = spawn(javaPath, fullArgs, {
      cwd:   gameDir,
      stdio: 'pipe',
      detached: false,
      env,
    });

    this.process.stdout.on('data', d =>
      d.toString().split('\n').filter(Boolean).forEach(l => this.emit('stdout', l))
    );
    this.process.stderr.on('data', d =>
      d.toString().split('\n').filter(Boolean).forEach(l => this.emit('stderr', l))
    );
    this.process.on('spawn',   ()   => this.emit('started'));
    this.process.on('close',   code => {
      this.process = null;
      this.emit('closed', code);
    });
    this.process.on('error', err => {
      this.process = null;
      this.emit('error',
        err.code === 'ENOENT'
          ? 'Java не знайдено! Встановіть Java 17+ або вкажіть шлях у Налаштуваннях.'
          : err.message
      );
    });
  }

  kill() {
    if (this.process) { this.process.kill('SIGTERM'); this.process = null; }
  }

  isRunning() { return this.process !== null; }

  // ── Повний classpath: vanilla + forge runtime libs + minecraft.jar ──────────
  // BootstrapLauncher читає -DlegacyClassPath і якщо він порожній/відсутній — NoSuchElementException
  _buildFullClasspath(vanillaJson, forgeJson, libsDir, vanillaJar) {
    const osName = process.platform === 'win32' ? 'windows'
                 : process.platform === 'darwin' ? 'osx' : 'linux';
    const jars   = [];

    // Хелпер для додавання однієї бібліотеки
    const addLib = (lib) => {
      if (lib.natives) return; // нативи не в classpath
      if (lib.rules) {
        const ok = lib.rules.every(r =>
          r.action === 'allow'
            ? (!r.os || r.os.name === osName)
            : (r.os ? r.os.name !== osName : false)
        );
        if (!ok) return;
      }
      let p = null;
      if (lib.downloads?.artifact?.path) {
        p = path.join(libsDir, lib.downloads.artifact.path);
      } else if (lib.name) {
        const parts = lib.name.split(':');
        const [g, a, v, c] = parts;
        const fname = c ? `${a}-${v}-${c}.jar` : `${a}-${v}.jar`;
        p = path.join(libsDir, ...g.split('.'), a, v, fname);
      }
      if (p && fs.existsSync(p)) jars.push(p);
    };

    // 1. Ванільні бібліотеки
    for (const lib of (vanillaJson.libraries || [])) addLib(lib);

    // 2. Forge runtime бібліотеки (з version.json)
    //    Саме тут: fmlcore, javafmllanguage, mclanguage, forge jar тощо
    for (const lib of (forgeJson.libraries || [])) addLib(lib);

    // 3. minecraft.jar — завжди останній
    if (fs.existsSync(vanillaJar)) jars.push(vanillaJar);

    const result = [...new Set(jars)].join(path.delimiter);
    this.log.info('[GL] Classpath entries:', jars.length);
    return result;
  }

  // ── ignoreList: JARи що BootstrapLauncher НЕ завантажує як модулі ──────────
  // Ключове: vanilla jar (1.20.1.jar) ОБОВ'ЯЗКОВО має бути тут!
  // Без цього Java спробує завантажити його як автоматичний модуль "_1._20._1"
  // що конфліктує з forge-пропатченим модулем "minecraft"
  _buildIgnoreList(libsDir) {
    // ignoreList = JAR файли які BootstrapLauncher ВИКЛЮЧАЄ при побудові module layer
    // з legacyClassPath. Тут повинні бути ЛИШЕ:
    //   - ванільний 1.20.1.jar (спричиняє конфлікт _1._20._1 vs minecraft)
    //   - srg.jar та extra.jar (завантажуються Forge окремо)
    //
    // НЕ додавати сюди: modlauncher, fmlloader, coremod —
    // вони МАЮТЬ бути в module path!
    //
    // bootstraplauncher та securejarhandler вже є в Forge JSON ignoreList,
    // наш merge їх підхопить автоматично.

    const names = new Set();
    names.add(`${MC_VERSION}.jar`);
    names.add(`client-${MC_VERSION}-20230612.114412-srg.jar`);
    names.add(`client-${MC_VERSION}-20230612.114412-extra.jar`);
    return [...names].join(',');
  }

  // ── Резервний module path якщо Forge JSON не має -p ──────────────────────
  _buildModulePath(libsDir) {
    const targets = [
      path.join(libsDir, 'cpw', 'mods', 'bootstraplauncher'),
      path.join(libsDir, 'cpw', 'mods', 'securejarhandler'),
      path.join(libsDir, 'net', 'minecraftforge', 'JarJarFileSystems'),
    ];
    const jars = targets
      .map(d => this._latestJar(d))
      .filter(Boolean);
    return jars.length ? jars.join(path.delimiter) : '';
  }

  _latestJar(dir) {
    if (!fs.existsSync(dir)) return null;
    let found = null;
    const scan = d => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        if (e.isDirectory()) scan(fp);
        else if (e.name.endsWith('.jar')
          && !e.name.includes('-sources')
          && !e.name.includes('-javadoc')) found = fp;
      }
    };
    scan(dir);
    return found;
  }

  // ── Обробка аргументів з rules ────────────────────────────────────────────
  _processArgs(args, vars) {
    const result = [];
    const osName = process.platform === 'win32' ? 'windows'
                 : process.platform === 'darwin' ? 'osx' : 'linux';

    // Аргументи які ніколи не потрібні в offline режимі
    const SKIP_ARGS = new Set([
      '--demo',
      '--quickPlayPath', '--quickPlaySingleplayer',
      '--quickPlayMultiplayer', '--quickPlayRealms',
    ]);

    let skipNextValue = false;

    for (const arg of args) {
      if (typeof arg === 'string') {
        const substituted = this._subst(arg, vars);

        // Пропускаємо незамінені ${змінні}
        if (substituted.startsWith('${') && substituted.endsWith('}')) continue;

        // Пропускаємо --demo та quickPlay аргументи
        if (SKIP_ARGS.has(substituted)) { skipNextValue = true; continue; }
        if (skipNextValue) { skipNextValue = false; continue; }

        result.push(substituted);
        continue;
      }
      if (!arg || typeof arg !== 'object') continue;

      const rules   = arg.rules || [];
      const allowed = rules.length === 0 || rules.every(r => {
        if (r.action === 'allow') {
          // features.is_demo_user — пропускаємо (ми не demo)
          if (r.features?.is_demo_user) return false;
          if (r.features?.has_custom_resolution) return true;
          if (r.features) return false; // решта features — пропускаємо
          if (r.os) return r.os.name === osName;
          return true;
        }
        if (r.action === 'disallow') {
          return r.os ? r.os.name !== osName : false;
        }
        return true;
      });

      if (allowed && arg.value !== undefined) {
        const vals = Array.isArray(arg.value) ? arg.value : [arg.value];
        for (const v of vals) {
          const s = this._subst(String(v), vars);
          if (s.startsWith('${') && s.endsWith('}')) continue; // незамінена змінна
          if (!SKIP_ARGS.has(s)) result.push(s);
        }
      }
    }
    return result;
  }

  // ── Підстановка ${змінних} ────────────────────────────────────────────────
  _subst(str, vars) {
    return str.replace(/\$\{[^}]+\}/g, m => vars[m] !== undefined ? vars[m] : m);
  }

  // ── Об'єднання game args без дублів ──────────────────────────────────────
  _mergeGameArgs(...sources) {
    const seen   = new Set();
    const result = [];
    for (const src of sources) {
      for (const a of src) {
        if (!seen.has(a)) { seen.add(a); result.push(a); }
      }
    }
    return result;
  }

  // ── Нативи ────────────────────────────────────────────────────────────────
  async _extractNatives(vanillaJson, libsDir, nativesDir) {
    const osName = process.platform === 'win32' ? 'windows'
                 : process.platform === 'darwin' ? 'osx' : 'linux';

    for (const lib of (vanillaJson.libraries || [])) {
      const key = lib.natives?.[osName];
      if (!key) continue;
      const classifier = key.replace('${arch}', process.arch === 'x64' ? '64' : '32');
      const art        = lib.downloads?.classifiers?.[classifier];
      if (!art?.path) continue;
      const jarPath = path.join(libsDir, art.path);
      if (!fs.existsSync(jarPath)) continue;

      try {
        const StreamZip = require('node-stream-zip');
        const zip = new StreamZip.async({ file: jarPath });
        const entries = await zip.entries();
        for (const [name, e] of Object.entries(entries)) {
          if (e.isDirectory || name.includes('META-INF')) continue;
          const dest = path.join(nativesDir, path.basename(name));
          if (!fs.existsSync(dest))
            await zip.extract(name, dest).catch(() => {});
        }
        await zip.close();
      } catch (e) {
        this.log.warn('[GL] natives:', e.message);
      }
    }
  }

  // ── Offline UUID ──────────────────────────────────────────────────────────
  _offlineUUID(username) {
    const h = crypto.createHash('md5')
      .update('OfflinePlayer:' + username).digest('hex');
    return [h.slice(0,8), h.slice(8,12),
      '3'+h.slice(13,16),
      ((parseInt(h.slice(16,18),16)&0x3f|0x80).toString(16))+h.slice(18,20),
      h.slice(20,32)].join('-');
  }

  // ── Пошук Java ────────────────────────────────────────────────────────────
  _detectJava() {
    const stored = this.store.get('javaPath');
    if (stored && fs.existsSync(stored)) return stored;

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

module.exports = { GameLauncher };
