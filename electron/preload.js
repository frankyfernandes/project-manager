const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  getTree: () => ipcRenderer.invoke('get-tree'),
  createProject: (name) => ipcRenderer.invoke('create-project', name),
  createFolder: (data) => ipcRenderer.invoke('create-folder', data),
  createFile: (data) => ipcRenderer.invoke('create-file', data),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (data) => ipcRenderer.invoke('write-file', data),
  deleteItem: (item) => ipcRenderer.invoke('delete-item', item),
  uploadFiles: (data) => ipcRenderer.invoke('upload-files', data),
  renameFile: (data) => ipcRenderer.invoke('rename-file', data),
  moveFile: (args) => ipcRenderer.invoke('move-file', args),
  logTime: (args) => ipcRenderer.invoke('log-time', args),
  getTime: (projectId) => ipcRenderer.invoke('get-time', projectId),
  addInstantNote: (projectId, noteText) => ipcRenderer.invoke('add-instant-note', { projectId, noteText }),
  signInWithGoogle: (clientId, clientSecret) => ipcRenderer.invoke('sign-in-with-google', clientId, clientSecret),
  createGoogleFile: (data) => ipcRenderer.invoke('create-google-file', data),
  showMenu: (type, x, y) => ipcRenderer.send('show-menu', { type, x, y }),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  onOpenCommandPalette: (callback) => ipcRenderer.on('open-command-palette', callback),
});
