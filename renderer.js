"use strict";
//region THEMES — Pure CSS/JS with optional Electron enhancement
(function initTheme() {
    let saved = localStorage.getItem('theme');
    if (!saved) {
        // Check system preference if no saved theme
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            saved = 'light';
        } else {
            saved = 'dark'; // Default to dark if no preference or explicitly dark
        }
    }
    applyTheme(saved);
})();

function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('theme', mode);
    // Update button icon
    const btn = document.getElementById('toggle-dark-mode');
    if (btn) {
        const isDark = (mode === 'dark');
        btn.textContent = isDark ? '☀️' : '🌙';
        btn.title = isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme';
    }
    // Notify Electron if available
    if (typeof window !== 'undefined' && window["darkMode"]) {
        try {
            window["darkMode"].toggle();
        } catch (e) { /* Not in Electron */ }
    }
}

document.getElementById('toggle-dark-mode').addEventListener('click', () => {
    const current = localStorage.getItem('theme') || 'dark';
    const next = (current === 'dark') ? 'light' : 'dark';
    applyTheme(next);
});
//endregion
// Define API wrapper with fallback
// @ts-ignore
let api = window.electronAPI;

// If we are in a browser (not Electron) or API failed to load, provide a fallback.
if (!api) {
    console.warn("Electron API not found. Using Web Mode Fallback.");

    api = {
        openFile: async () => {
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.hcie,.png,.jpg,.jpeg,.psd';
                input.onchange = (e) => {
                    // @ts-ignore
                    const file = e.target.files[0];
                    if (file) {
                        window.lastSelectedFile = file;

                        // FIX: For images in Web Mode, we MUST use a Blob URL.
                        // Passing just 'name' fails (ERR_FILE_NOT_FOUND).
                        if (file.name.endsWith('.hcie')) {
                            // Projects need to be read via readFile (text), so name is fine as a flag.
                            resolve(file.name);
                        } else {
                            // Images need to be loaded via src, so we need a URL.
                            const blobUrl = URL.createObjectURL(file);
                            // Store original name for saving later
                            window.lastFileName = file.name;
                            resolve(blobUrl);
                        }
                    } else {
                        resolve(null);
                    }
                };
                input.click();
            });
        },
        readFile: async (filePath) => {
            // In web mode, 'filePath' is just the name. We rely on the file object we saved.
            // @ts-ignore
            const file = window.lastSelectedFile;
            if (!file) {
                console.error("No file selected in Web Mode");
                return null;
            }
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            });
        },
        saveFile: async (content, filePath, saveas, type) => {
            // In web mode, we 'download' the file.
            const a = document.createElement('a');

            let dataUrl = content;
            if (type === 'hcie') {
                // Content is JSON string, convert to Blob/URL
                const blob = new Blob([content], { type: 'application/json' });
                dataUrl = URL.createObjectURL(blob);
            } else if (type === 'psd') {
                // Content is ArrayBuffer or Uint8Array
                const blob = new Blob([content], { type: 'image/vnd.adobe.photoshop' });
                dataUrl = URL.createObjectURL(blob);
            }

            a.href = dataUrl;
            // Use 'filePath' as suggested name if available, else default
            // If filePath is a full path (Electron), getting basename is hard without Node. 
            // In web mode context, filePath might be just a name like "image.png"
            let name = filePath || 'untitled';
            if (!name.includes('.')) {
                if (type === 'hcie') name += '.hcie';
                else if (type === 'psd') name += '.psd';
                else name += '.png';
            }

            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (type === 'hcie' || type === 'psd') URL.revokeObjectURL(dataUrl);

            return name; // Return new "path" (name)
        },
        onMenuOpen: () => { }, // Menus hidden in web mode usually
        onMenuSave: () => { },
        onMenuSaveAs: () => { },
        onMenuExport: () => { }
    };
} else {
    console.log("Electron API successfully linked.");
}

//region OPEN DIALOG
//@ts-ignore
//region OPEN DIALOG
//endregion

//region FILE OPERATIONS
async function handleOpenFile() {
    // API is now guaranteed to exist (real or mock)

    const result = await api.openFile();
    let filePath = typeof result === 'string' ? result.trim() : result;
    if (!filePath || filePath === "Dosya seçilmedi!") return;

    // Fix for Web Mode: result might be Blob URL or filename depending on context.
    // In Electron, it's a path. In Web fallback, it's URL or name.

    // Check if we are in Web Mode (api mocked) or Electron
    const isWeb = !window.electronAPI;

    const el = document.getElementById('filePath');
    // Ensure we use the raw path in Electron, and a sensible name in Web
    const displayPath = isWeb ? (window.lastFileName || filePath || "File") : filePath;
    if (el) el.innerText = displayPath;
    g.filepath = displayPath;

    // Robust extension check
    const lowerPath = (filePath || "").toLowerCase();
    console.log("File open attempt:", { filePath, displayPath, lowerPath });

    if (lowerPath.endsWith('.hcie')) {
        // Read file content
        if (api.readFile) {
            const content = await api.readFile(filePath);
            await ProjectIO.loadProject(content);
        } else {
            console.error("Missing readFile API for project files.");
            alert("Project loading not fully verified in this Electron build (needs readFile API).");
        }
    } else if (lowerPath.endsWith('.psd')) {
        // Handle PSD loading
        // We need binary data.
        let arrayBuffer = null;

        if (api.readFileBinary) {
            // Electron mode
            try {
                // Returns Buffer (Uint8Array-like)
                const buffer = await api.readFileBinary(filePath);
                arrayBuffer = buffer.buffer; // Get underlying ArrayBuffer
            } catch (e) {
                console.error("Failed to read PSD binary:", e);
                return;
            }
        } else if (isWeb && api.readFile) {
            // Web mode fallback - readFile reads from stored file object
            // But our mock readFile returns text. We need arrayBuffer.
            // We can access window.lastSelectedFile directly here or update mock.
            // @ts-ignore
            const file = window.lastSelectedFile;
            if (file) {
                arrayBuffer = await file.arrayBuffer();
            }
        }

        if (arrayBuffer) {
            // Pass buffer to drawing_canvas logic
            // We need to expose a way to load from buffer in drawing_canvas.js
            // Currently openImage takes a filename.
            // Let's create a global function or call loadPsdFile directly and setup layers.
            // Assuming loadPsdFile and convertPsdToLayers are global
            const psd = await loadPsdFile(arrayBuffer);
            if (psd) {
                // We need to trigger the layer update logic similar to openImage
                // To avoid duplicating logic, let's call a helper
                if (typeof window.applyPsdToCanvas === 'function') {
                    window.applyPsdToCanvas(psd);
                } else {
                    console.error("applyPsdToCanvas function not found");
                }
            }
        }
    } else {
        console.log("Using legacy openImage for:", filePath);
        openImage(filePath); // Legacy image open (handles PSD too if logic inside supports it, but we handle it here now)
    }
}

async function handleSaveFile() {
    // api is global now

    if (g.filepath && g.filepath.endsWith('.hcie')) {
        // Save as project
        const content = await ProjectIO.saveProject();
        const newPath = await api.saveFile(content, g.filepath, false, 'hcie');
        if (newPath) g.filepath = newPath;
    } else if (g.filepath && g.filepath.endsWith('.psd')) {
        // Save as PSD
        const buffer = await savePsdFile(layers);
        if (buffer) {
            const newPath = await api.saveFile(buffer, g.filepath, false, 'psd');
            if (newPath) g.filepath = newPath;
        }
    } else {
        // Save as PNG
        const dataURL = getCanvasImageDataURL();
        if (dataURL) {
            const newPath = await api.saveFile(dataURL, g.filepath, false);
            if (newPath) g.filepath = newPath;
        }
    }
}

async function handleSaveAsFile() {
    if (!api) { console.error("API wrapper not initialized"); return; }

    const isWeb = !window.electronAPI;
    let type = 'png';
    let content = null;

    // Use custom dialog for format selection in both Electron and Web
    const choice = await DialogHandler.showFormatSelector();
    if (choice === "hcie") type = 'hcie';
    else if (choice === "psd") type = 'psd';
    else if (choice === "png") type = 'png';
    else return; // Cancelled

    // Prepare content based on type
    if (type === 'hcie') {
        content = await ProjectIO.saveProject();
    } else if (type === 'psd') {
        content = await savePsdFile(layers);
        if (!content) return;
    } else {
        content = getCanvasImageDataURL();
    }

    // Trigger save dialog
    const newPath = await api.saveFile(content, g.filepath, true, type);

    if (newPath) {
        if (type === 'hcie' || type === 'psd') {
            g.filepath = newPath;
            const el = document.getElementById('filePath');
            if (el) el.innerText = isWeb ? (window.lastFileName || newPath) : newPath;

            // Update current document name if tab system exists
            if (typeof g.documents !== 'undefined' && g.activeDocumentIndex >= 0) {
                const doc = g.documents[g.activeDocumentIndex];
                if (doc) doc.name = isWeb ? (window.lastFileName || newPath) : newPath.split(/[\\/]/).pop();
                if (typeof renderImageTabs === 'function') renderImageTabs();
            }
        }
        console.log("Saved successfully to:", newPath);
    }
}

async function handleExportFile() {
    // api is global now

    // Export specifically as Image (PNG) without prompt, but maybe warn if user didn't request it explicitly?
    // "menu-export" usually implies direct export.
    // The user said "if user want to png... warn him".
    // Let's add a quick confirm for Export too if layers > 1?

    // Check layer count?
    // if (Layers.count > 1) ... but we might not have access to Layers object safely here.
    // Let's just do it.

    const confirmExport = confirm("Export current view as PNG?\n\n(Layers will be flattened)");
    if (!confirmExport) return;

    const dataURL = getCanvasImageDataURL();
    if (dataURL) {
        const newPath = await api.saveFile(dataURL, g.filepath, true, 'png');
        if (newPath) {
            console.log("Exported to", newPath);
        }
    }
}

// Button Listeners
const btn = document.getElementById('btn-open');
if (btn) btn.addEventListener('click', handleOpenFile);

const btnsave = document.getElementById('btn-save');
if (btnsave) btnsave.addEventListener('click', handleSaveFile);

const btnsaveas = document.getElementById('btn-save-as');
if (btnsaveas) btnsaveas.addEventListener('click', handleSaveAsFile);

// IPC Listeners from Menu
// Initialize immediately
function initMenuListeners() {
    if (api) {
        if (api.onMenuOpen) api.onMenuOpen(handleOpenFile);
        if (api.onMenuSave) api.onMenuSave(handleSaveFile);
        if (api.onMenuSaveAs) api.onMenuSaveAs(handleSaveAsFile);
        if (api.onMenuExport) api.onMenuExport(handleExportFile);
        if (api.onMenuErodeBorder) api.onMenuErodeBorder(() => window.showErodeBorderDialog());
        if (api.onMenuFadeBorder) api.onMenuFadeBorder(() => window.showFadeBorderDialog());
        console.log("Menu listeners initialized.");
    }
}

// Try initializing listeners
initMenuListeners();
//endregion
