const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  tx: (payload) => ipcRenderer.send('tx', payload),
  rx: (payload) => ipcRenderer.invoke('rx', payload)
});