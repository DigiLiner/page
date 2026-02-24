"use strict";
// @ts-ignore
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function (o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = __importStar(require("electron"));
const path_1 = __importDefault(require("path"));
const isMac = process.platform === 'darwin';
const mainMenuTemplate = [
    // { role: 'appMenu' }
    ...(isMac
        ? [{
            label: electron_1.app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }]
        : []),
    // { role: 'fileMenu' }
    {
        label: 'File',
        submenu: [
            {
                label: 'New',
                icon: path_1.default.join(__dirname, '/toolbar_images/open-gray_32x32.png'),
                click() {
                    console.log('New File');
                    // TODO: Implement New File IPC if needed, or just let renderer handle it via new window? 
                    // For now, let's focus on Open/Save.
                    // const win = electron_1.BrowserWindow.getFocusedWindow();
                    // if(win) win.webContents.send('menu-new');
                }
            },
            {
                label: 'Open',
                click() {
                    const win = electron_1.BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.send('menu-open');
                }
            },
            {
                label: 'Close',
                click() {
                    const win = electron_1.BrowserWindow.getFocusedWindow();
                    if (win) win.close();
                }
            },
            {
                label: 'Save',
                click() {
                    const win = electron_1.BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.send('menu-save');
                }
            },
            {
                label: 'Save As',
                click() {
                    const win = electron_1.BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.send('menu-save-as');
                }
            },
            {
                label: 'Export',
                accelerator: 'Ctrl+E',
                click() {
                    const win = electron_1.BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.send('menu-export');
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Print',
                click() {
                    console.log('Print');
                }
            },
            isMac ? { role: 'close' } : { role: 'quit' }
        ]
    },
    // { role: 'editMenu' }
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            ...(isMac
                ? [
                    { role: 'pasteAndMatchStyle' },
                    { role: 'delete' },
                    { role: 'selectAll' },
                    { type: 'separator' },
                    {
                        label: 'Speech',
                        submenu: [
                            { role: 'startSpeaking' },
                            { role: 'stopSpeaking' }
                        ]
                    }
                ]
                : [
                    { role: 'delete' },
                    { type: 'separator' },
                    { role: 'selectAll' }
                ])
        ]
    },
    // { role: 'viewMenu' }
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    },
    // { role: 'imageMenu' }
    {
        label: 'Image',
        submenu: [
            { label: 'Flip Horizontal' },
            { label: 'Flip Vertical' },
            { label: 'Negative' },
            { label: 'Grayscale' },
            { label: 'Sepia' },
            { label: 'Color Invert' },
            { label: 'Rotate' },
            { label: 'Crop' },
            { label: 'Resize Image' },
            { label: 'Resize Canvas' },
            { label: 'Attributes' },
            { type: 'separator' },
            { label: 'Image Info' },
            { label: 'Image Histogram' },
            { label: 'Image Smoothing' },
            { label: 'Image Filters' },
            { label: 'Image Effects' },
            { label: 'Image Adjustments' },
            { label: 'Image Masking' },
            { label: 'Image Composition' },
            { label: 'Image Layers' },
            { label: 'Image Compositing' }
        ]
    },
    // { role: 'toolsMenu' }
    {
        label: 'Tools',
        submenu: [
            { label: 'Draw Pen' },
            { label: 'Draw Line' },
            { label: 'Draw Rectangle' },
            { label: 'Draw Ellipse' },
            { label: 'Draw Polygon' },
            { label: 'Draw Bezier' },
            { label: 'Draw Text' },
            { label: 'Draw Arrow' },
            { label: 'Draw Marker' },
            { label: 'Draw Path' }
        ]
    },
    // role: filterMenu
    {
        label: 'Filter',
        submenu: [
            { label: 'Soften' },
            { label: 'Blur' },
            { label: 'Sharpen' },
            { label: 'Emboss' },
            { label: 'Edge Detect' },
            { label: 'Find Edges' },
            { label: 'Enhance' },
            { label: 'High Pass' },
            { label: 'Add Noise' },
            { label: 'Mosaic' },
            { label: 'Moderate' },
            { label: 'Oil Paint' },
            {
                label: 'Border',
                submenu: [
                    {
                        label: 'Erode Border',
                        click() {
                            const win = electron_1.BrowserWindow.getFocusedWindow();
                            if (win) win.webContents.send('menu-erode-border');
                        }
                    },
                    {
                        label: 'Fade Border',
                        click() {
                            const win = electron_1.BrowserWindow.getFocusedWindow();
                            if (win) win.webContents.send('menu-fade-border');
                        }
                    }
                ]
            },

            { label: 'Frame' },
            { label: 'Black White' },
            { label: 'Grayscale' },
            { label: 'Posterize' },
            { label: 'Solarize' },
            { label: 'Soft' },
            { label: 'Soft Light' },
            { label: 'Vignette' },
            { label: 'Sepia' },
            { label: 'Emboss' }
        ]
    },
    // { role: 'windowMenu' }
    {
        label: 'Window',
        submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
            ...(isMac
                ? [
                    { type: 'separator' },
                    { role: 'front' },
                    { type: 'separator' },
                    { role: 'window' }
                ]
                : [
                    { role: 'close' }
                ])
        ]
    },
    {
        role: 'help',
        submenu: [
            {
                label: 'Learn More',
                click: async () => {
                    const { shell } = require('electron');
                    await shell.openExternal('https://electronjs.org');
                }
            }
        ]
    }
];
exports.default = mainMenuTemplate;
//if (isMac) {
//    mainMenuTemplate.unshift();
//}
