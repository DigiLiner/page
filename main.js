"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const main_menu_1 = __importDefault(require("./main_menu"));
const electron_1 = __importDefault(require("electron"));
const url_1 = __importDefault(require("url"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = __importDefault(require("fs"));
const { app, BrowserWindow, Menu, ipcMain, nativeTheme, dialog } = electron_1.default;
// @ts-ignore
let mainWindow;
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
//import mainMenuTemplate from './main_menu';
app.on('ready', function () {
    // @ts-ignore
    mainWindow = new BrowserWindow({
        minWidth: 1000,
        minHeight: 800,
        width: 1200,
        height: 900,
        // x: 0,
        // y: 150,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: node_path_1.default.join(__dirname, 'preload.js'), //disable dpi scaling
        },
    });
    mainWindow.loadURL(url_1.default.format({
        pathname: node_path_1.default.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));
});
// @ts-ignore
const mainMenu = Menu.buildFromTemplate(main_menu_1.default);
Menu.setApplicationMenu(mainMenu);
//region theme
ipcMain.handle('dark-mode:toggle', () => {
    if (nativeTheme.shouldUseDarkColors) {
        nativeTheme.themeSource = 'light';
    }
    else {
        nativeTheme.themeSource = 'dark';
    }
    return nativeTheme.shouldUseDarkColors;
});
ipcMain.handle('dark-mode:system', () => {
    nativeTheme.themeSource = 'system';
});
//endregion
app.whenReady().then(() => {
    //region open file dialog
    ipcMain.handle('open-file', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'All Supported Files', extensions: ['hcie', 'png', 'jpg', 'jpeg', 'psd'] },
                { name: 'Photoshop Document', extensions: ['psd'] },
                { name: 'HC Image Editor Project', extensions: ['hcie'] },
                { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }
            ]
        });
        if (!canceled) {
            return filePaths[0];
        }
        else {
            return "Dosya seçilmedi!"; //send to renderer
        }
    });
    //endregion

    //region read file
    ipcMain.handle('read-file', async (event, filePath) => {
        try {
            return fs_1.default.promises.readFile(filePath, 'utf-8');
        } catch (error) {
            console.error('Error reading file:', error);
            throw error;
        }
    });

    ipcMain.handle('read-file-binary', async (event, filePath) => {
        try {
            return await fs_1.default.promises.readFile(filePath);
        } catch (error) {
            console.error('Error reading binary file:', error);
            throw error;
        }
    });
    //endregion

    //region save file dialog
    ipcMain.handle('save-file', async (event, data, filePath, saveas = false, type = 'png') => {
        try {
            // Determine default filters based on type
            let filters = [];
            if (type === 'hcie') {
                filters = [{ name: 'HC Image Editor Project', extensions: ['hcie', 'json'] }];
            } else if (type === 'psd') {
                filters = [{ name: 'Photoshop Document', extensions: ['psd'] }];
            } else {
                filters = [
                    { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
                    { name: 'Photoshop Document', extensions: ['psd'] }
                ];
            }

            if (!filePath || saveas) {
                const { canceled, filePath: savedPath } = await dialog.showSaveDialog({
                    defaultPath: filePath || (type === 'psd' ? 'image.psd' : 'image.png'),
                    filters: filters
                });
                if (canceled) {
                    console.log('Save dialog was canceled.');
                    return;
                }
                filePath = savedPath;
            }

            node_path_1.default.join(filePath);

            if (type === 'hcie') {
                // Save as text (JSON)
                await fs_1.default.promises.writeFile(filePath, data, 'utf-8');
                console.log('Project saved successfully:', filePath);
                return filePath;
            } else if (type === 'psd') {
                // data is Uint8Array/Buffer from ag-psd
                const buffer = Buffer.from(data);
                await fs_1.default.promises.writeFile(filePath, buffer);
                console.log('PSD saved successfully:', filePath);
                return filePath;
            } else {
                // data is expected to be a dataURL (PNG/JPG)
                if (typeof data === 'string' && data.startsWith('data:')) {
                    const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
                    await fs_1.default.promises.writeFile(filePath, base64Data, 'base64');
                } else {
                    // Fallback for raw data
                    await fs_1.default.promises.writeFile(filePath, data);
                }
                console.log('Image saved successfully:', filePath);
                return filePath;
            }
        }
        catch (error) {
            console.error('An error occurred:', error);
            throw error;
        }
    });
    //endregion
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
});
