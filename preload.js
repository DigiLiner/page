"use strict";
const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld('darkMode', {
    toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
    system: () => ipcRenderer.invoke('dark-mode:system')
});
//OPEN FILE DIALOG
contextBridge.exposeInMainWorld('electronAPI', {
    openFile: () => ipcRenderer.invoke('open-file'),
    saveFile: (dataURL, filePath, saveas, type) => ipcRenderer.invoke('save-file', dataURL, filePath, saveas, type),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    readFileBinary: (filePath) => ipcRenderer.invoke('read-file-binary', filePath),

    // Menu Listeners
    onMenuOpen: (callback) => ipcRenderer.on('menu-open', callback),
    onMenuSave: (callback) => ipcRenderer.on('menu-save', callback),
    onMenuSaveAs: (callback) => ipcRenderer.on('menu-save-as', callback),
    onMenuExport: (callback) => ipcRenderer.on('menu-export', callback),
    onMenuErodeBorder: (callback) => ipcRenderer.on('menu-erode-border', (event, ...args) => callback(...args)),
    onMenuFadeBorder: (callback) => ipcRenderer.on('menu-fade-border', (event, ...args) => callback(...args)),
});
//END OPEN DIALOG
