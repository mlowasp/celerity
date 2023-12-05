const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  tx: (payload) => ipcRenderer.send('tx', payload),  
  handleRx: (callback) => ipcRenderer.on('rx', callback)
});