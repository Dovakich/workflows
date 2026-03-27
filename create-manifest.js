'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const { autoUpdater } = require('electron-updater');
const log  = require('electron-log');
const Store = require('electron-store');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('no-sandbox');

log.transports.file.level = 'info';
log.transports.console.level = 'warn';
autoUpdater.logger = log;

const store = new Store({
  defaults: {
    username:      '',
    ram:           2048,
    javaPath:      '',
    gameDir:       path.join(app.getPath('appData'), '.ycraft'),
    windowWidth:   1280,
    windowHeight:  720,
    fullscreen:    false,
    closeOnLaunch: true,
    serverIP:      'play.y-craft.net',
    autoConnect:   false,
    lastVersion:   ''
  }
});

const LAUNCHER_VERSION     = app.getVersion();
const UPDATE_FEED_URL      = 'https://updates.y-craft.net/launcher';
const MODPACK_MANIFEST_URL = 'https://updates.y-craft.net/modpack/manifest.json';
const FORGE_VERSION        = '47.4.10';
const MC_VERSION           = '1.20.1';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1060,
    height:          640,
    minWidth:        880,
    minHeight:       560,
    frame:           false,
    transparent:     false,
    backgroundColor: '#0d0f14',
    resizable:       true,
    icon:            path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  setupIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function setupAutoUpdater() {
  if (process.env.NODE_ENV === 'development') return;
  try {
    autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_FEED_URL });
    autoUpdater.on('checking-for-update',  () => send('updater:status', { status: 'checking' }));
    autoUpdater.on('update-available',  i  => send('updater:status', { status: 'available', version: i.version }));
    autoUpdater.on('update-not-available', () => send('updater:status', { status: 'latest' }));
    autoUpdater.on('update-downloaded',    () => send('updater:status', { status: 'ready' }));
    autoUpdater.on('error', err => {
      log.warn('AutoUpdater:', err.message);
      send('updater:status', { status: 'error', message: err.message });
    });
    autoUpdater.on('download-progress', p => send('updater:progress', {
      percent:  Math.round(p.percent),
      speed:    fmt(p.bytesPerSecond) + '/s',
      total:    fmt(p.total),
      received: fmt(p.transferred)
    }));
    autoUpdater.checkForUpdates().catch(() => {});
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 30 * 60 * 1000);
  } catch (e) {
    log.warn('AutoUpdater init failed:', e.message);
  }
}

function setupIPC() {
  const { GameLauncher }   = require('./game-launcher');
  const { ModpackManager } = require('./modpack-manager');
  const { ForgeInstaller } = require('./forge-installer');

  const gameDir   = store.get('gameDir');
  const launcher  = new GameLauncher(store, log);
  const modpack   = new ModpackManager(gameDir, MODPACK_MANIFEST_URL, log);
  const forgeInst = new ForgeInstaller(gameDir, MC_VERSION, FORGE_VERSION, log);

  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
  ipcMain.on('window:close',    () => mainWindow?.close());

  ipcMain.handle('settings:get',    ()         => store.store);
  ipcMain.handle('settings:set',    (_, k, v)  => { store.set(k, v); return true; });
  ipcMain.handle('settings:setAll', (_, obj)   => { Object.entries(obj).forEach(([k,v]) => store.set(k,v)); return true; });

  ipcMain.handle('dialog:browseJava', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'Оберіть виконуваний файл Java',
      properties: ['openFile'],
      filters: [{ name: 'Java', extensions: ['exe', ''] }]
    });
    return r.filePaths[0] || null;
  });

  ipcMain.handle('dialog:browseGameDir', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'Оберіть теку гри',
      properties: ['openDirectory', 'createDirectory']
    });
    return r.filePaths[0] || null;
  });

  ipcMain.handle('launcher:version',    () => LAUNCHER_VERSION);
  ipcMain.handle('launcher:openGameDir', () => shell.openPath(store.get('gameDir')));

  ipcMain.handle('mods:list', () => {
    const modsDir = path.join(store.get('gameDir'), 'mods');
    if (!fs.existsSync(modsDir)) return [];
    try {
      return fs.readdirSync(modsDir)
        .filter(f => f.endsWith('.jar') && !f.endsWith('.disabled'))
        .map(f => {
          const stat = fs.statSync(path.join(modsDir, f));
          return {
            filename: f,
            name:     f.replace(/[-_](\d[\d.]*)([-_]mc[\d.]*)?\.jar$/i, '').replace(/[-_]/g, ' ').trim() || f,
            size:     fmt(stat.size),
            mtime:    stat.mtime.toLocaleDateString('uk-UA')
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    } catch (e) {
      log.warn('mods:list error:', e.message);
      return [];
    }
  });

  ipcMain.handle('modpack:check', async () => {
    try { return await modpack.checkForUpdates(); }
    catch (e) { return { error: e.message, upToDate: true, offline: true }; }
  });

  ipcMain.handle('modpack:update', async () => {
    modpack.removeAllListeners('progress');
    modpack.removeAllListeners('status');
    modpack.on('progress', d => send('modpack:progress', d));
    modpack.on('status',   d => send('modpack:status',   d));
    try { await modpack.update(); return { success: true }; }
    catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('forge:check', () => forgeInst.isInstalled());

  ipcMain.handle('forge:install', async () => {
    forgeInst.removeAllListeners('progress');
    forgeInst.removeAllListeners('status');
    forgeInst.on('progress', d => send('forge:progress', d));
    forgeInst.on('status',   d => send('forge:status',   d));
    forgeInst.setJavaPath(store.get('javaPath') || '');
    try { await forgeInst.install(); return { success: true }; }
    catch (e) { log.error('forge:install:', e.message); return { error: e.message }; }
  });

  ipcMain.handle('game:launch', async (_, opts) => {
    launcher.removeAllListeners();

    launcher.on('stdout',  line => send('game:stdout', line));
    launcher.on('stderr',  line => send('game:stderr', line));
    launcher.on('started', ()   => send('game:started', {}));
    launcher.on('closed',  code => send('game:closed', { code }));
    launcher.on('error',   msg  => send('game:error',  { message: msg }));

    try {
      await launcher.launch(opts);
      return { success: true };
    } catch (e) {
      log.error('game:launch:', e.message);
      return { error: e.message };
    }
  });

  ipcMain.handle('game:kill', () => launcher.kill());

  ipcMain.on('updater:install', () => autoUpdater.quitAndInstall(false, true));
  ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates().catch(e => ({ error: e.message })));
}

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function fmt(b = 0) {
  if (b < 1024)          return b + ' B';
  if (b < 1_048_576)     return (b / 1024).toFixed(1)       + ' KB';
  if (b < 1_073_741_824) return (b / 1_048_576).toFixed(1)  + ' MB';
  return (b / 1_073_741_824).toFixed(2) + ' GB';
}
