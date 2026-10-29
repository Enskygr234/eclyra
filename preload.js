'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('eclyra', {
  load: () => ipcRenderer.invoke('save:load'),
  save: data => ipcRenderer.invoke('save:write', data),
  fullscreen: on => ipcRenderer.send('win:fullscreen', on),
  quit: () => ipcRenderer.send('app:quit')
});
