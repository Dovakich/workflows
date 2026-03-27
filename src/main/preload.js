'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  // Вікно
  minimize:    ()       => ipcRenderer.send('window:minimize'),
  maximize:    ()       => ipcRenderer.send('window:maximize'),
  close:       ()       => ipcRenderer.send('window:close'),

  // Налаштування
  getSettings: ()       => ipcRenderer.invoke('settings:get'),
  setSetting:  (k, v)   => ipcRenderer.invoke('settings:set', k, v),
  setSettings: (obj)    => ipcRenderer.invoke('settings:setAll', obj),

  // Діалоги
  browseJava:    ()     => ipcRenderer.invoke('dialog:browseJava'),
  browseGameDir: ()     => ipcRenderer.invoke('dialog:browseGameDir'),

  // Загальне
  getVersion:    ()     => ipcRenderer.invoke('launcher:version'),
  openGameDir:   ()     => ipcRenderer.invoke('launcher:openGameDir'),

  // Список встановлених модів (реальна папка mods/)
  listMods:      ()     => ipcRenderer.invoke('mods:list'),

  // Модпак
  checkModpack:  ()     => ipcRenderer.invoke('modpack:check'),
  updateModpack: ()     => ipcRenderer.invoke('modpack:update'),
  onModpackProgress: cb => ipcRenderer.on('modpack:progress', (_, d) => cb(d)),
  onModpackStatus:   cb => ipcRenderer.on('modpack:status',   (_, d) => cb(d)),

  // Forge
  checkForge:    ()     => ipcRenderer.invoke('forge:check'),
  installForge:  ()     => ipcRenderer.invoke('forge:install'),
  onForgeProgress: cb   => ipcRenderer.on('forge:progress', (_, d) => cb(d)),
  onForgeStatus:   cb   => ipcRenderer.on('forge:status',   (_, d) => cb(d)),

  // Гра
  launch:   opts => ipcRenderer.invoke('game:launch', opts),
  kill:     ()   => ipcRenderer.invoke('game:kill'),
  onStdout: cb   => ipcRenderer.on('game:stdout',  (_, l) => cb(l)),
  onStderr: cb   => ipcRenderer.on('game:stderr',  (_, l) => cb(l)),
  onStarted: cb  => ipcRenderer.on('game:started', ()      => cb()),
  onClosed:  cb  => ipcRenderer.on('game:closed',  (_, d)  => cb(d)),
  onError:   cb  => ipcRenderer.on('game:error',   (_, d)  => cb(d)),

  // Авто-оновлення лаунчера
  onUpdaterStatus:   cb => ipcRenderer.on('updater:status',   (_, d) => cb(d)),
  onUpdaterProgress: cb => ipcRenderer.on('updater:progress', (_, d) => cb(d)),
  installUpdate:     ()  => ipcRenderer.send('updater:install'),
  checkUpdate:       ()  => ipcRenderer.invoke('updater:check')
});
