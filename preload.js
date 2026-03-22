const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  readData: (fileType) => ipcRenderer.invoke('read-data', fileType),
  writeData: (fileType, data) => ipcRenderer.invoke('write-data', fileType, data),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  readAppConfig: () => ipcRenderer.invoke('read-app-config'),
  writeAppConfig: (config) => ipcRenderer.invoke('write-app-config', config),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  // Media
  openImageDialog: () => ipcRenderer.invoke('open-image-dialog'),
  saveMediaFile: (srcPath) => ipcRenderer.invoke('save-media-file', srcPath),
  saveMediaBuffer: (arrayBuffer, ext) => ipcRenderer.invoke('save-media-buffer', { arrayBuffer, ext }),
  deleteMediaFile: (fileName) => ipcRenderer.invoke('delete-media-file', fileName),
  getMediaUrl: (fileName) => ipcRenderer.invoke('get-media-url', fileName),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onShortcutRefreshForm: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('shortcut-refresh-form', listener);
    return () => ipcRenderer.removeListener('shortcut-refresh-form', listener);
  },
  onConfigUpdated: (callback) => {
    const listener = (event, config) => callback(config);
    ipcRenderer.on('config-updated', listener);
    return () => ipcRenderer.removeListener('config-updated', listener);
  }
});
