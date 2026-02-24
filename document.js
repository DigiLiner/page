/**
 * ImageDocument Class
 * Each document represents an independent image being edited, 
 * with its own layers, undo history, zoom, and scroll position.
 */
class ImageDocument {
    constructor(name = "Untitled", width = 500, height = 500) {
        this.id = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.name = name;
        this.width = width;
        this.height = height;
        this.layers = [new layer_class("Background", width, height)];
        this.activeLayerIndex = 0;
        this.undoStack = [];
        this.undoIndex = -1;
        this.zoom = 1.0;
        this.scrollLeft = 0;
        this.scrollTop = 0;
        this.modified = false;
    }
}

// Document management
if (!g.documents) g.documents = [];
if (g.activeDocumentIndex === undefined) g.activeDocumentIndex = -1;

/**
 * Create the initial document from the existing state
 */
function initDocuments() {
    if (g.documents.length === 0) {
        const doc = new ImageDocument("Image 1", g.image_width, g.image_height);
        // Transfer existing layers into the first document
        doc.layers = layers;
        doc.activeLayerIndex = g.activeLayerIndex;
        doc.zoom = g.zoom;
        g.documents.push(doc);
        g.activeDocumentIndex = 0;
    }
    renderImageTabs();
}

/**
 * Create a new blank document
 */
function newDocument(name, width, height) {
    const docName = name || `Image ${g.documents.length + 1}`;
    const w = width || g.image_width;
    const h = height || g.image_height;
    const doc = new ImageDocument(docName, w, h);
    g.documents.push(doc);
    switchDocument(g.documents.length - 1);
}

/**
 * Close a document by index
 */
function closeDocument(index) {
    if (g.documents.length <= 1) {
        console.warn("Cannot close the last document");
        return;
    }
    g.documents.splice(index, 1);
    // Adjust active index
    if (g.activeDocumentIndex >= g.documents.length) {
        g.activeDocumentIndex = g.documents.length - 1;
    }
    // If we closed the active document, switch to the new active one
    switchDocument(g.activeDocumentIndex);
}

/**
 * Save current state to the active document before switching
 */
function saveCurrentDocumentState() {
    const doc = g.documents[g.activeDocumentIndex];
    if (!doc) return;

    doc.layers = layers;
    doc.activeLayerIndex = g.activeLayerIndex;
    doc.zoom = g.zoom;

    const container = document.getElementById('canvasScrollArea');
    if (container) {
        doc.scrollLeft = container.scrollLeft;
        doc.scrollTop = container.scrollTop;
    }

    // AI_GUARDRAIL: Document State Isolation
    // Selection state (active, mask, border) MUST be saved per document.
    // This prevents selection from leaking between tabs.
    doc.selectionActive = g.isSelectionActive;
    doc.selectionMask = g.selectionMask;
    doc.selectionBorder = g.selectionBorder;
    doc.selectionCanvas = g.selectionCanvas;
}

/**
 * Switch to a different document
 */
function switchDocument(index) {
    if (index < 0 || index >= g.documents.length) return;
    if (g.activeDocumentIndex >= 0 && g.activeDocumentIndex < g.documents.length) {
        saveCurrentDocumentState();
    }

    g.activeDocumentIndex = index;
    const doc = g.documents[index];

    // Restore document state to globals
    layers = doc.layers;
    g.activeLayerIndex = doc.activeLayerIndex;
    g.zoom = doc.zoom;
    g.image_width = doc.width;
    g.image_height = doc.height;

    // Resize canvases to match the new document
    const can = document.getElementById('drawingCanvas');
    if (can) {
        can.width = doc.width;
        can.height = doc.height;
    }
    // Resize tempCanvas
    if (typeof tempCanvas !== 'undefined' && tempCanvas) {
        tempCanvas.width = doc.width;
        tempCanvas.height = doc.height;
    }
    // Resize originalCanvas
    if (typeof originalCanvas !== 'undefined' && originalCanvas) {
        originalCanvas.width = doc.width;
        originalCanvas.height = doc.height;
    }

    // Apply zoom
    if (typeof applyZoom === 'function') {
        applyZoom(doc.zoom);
    }

    // Restore scroll position
    const container = document.getElementById('canvasScrollArea');
    if (container) {
        setTimeout(() => {
            container.scrollLeft = doc.scrollLeft;
            container.scrollTop = doc.scrollTop;
        }, 10);
    }

    // Restore Selection State
    g.isSelectionActive = doc.selectionActive || false;
    g.selectionMask = doc.selectionMask || null;
    g.selectionBorder = doc.selectionBorder || [];
    g.selectionCanvas = doc.selectionCanvas || null;

    // Re-render layers and UI
    if (typeof renderLayers === 'function') {
        renderLayers();
    }
    if (typeof updateLayerPanel === 'function') {
        updateLayerPanel();
    }

    renderImageTabs();
    console.log(`Switched to document "${doc.name}"`);
}

/**
 * Render the image tab bar
 */
function renderImageTabs() {
    const tabBar = document.getElementById('imageTabBar');
    if (!tabBar) return;

    tabBar.innerHTML = '';

    g.documents.forEach((doc, i) => {
        const tab = document.createElement('div');
        tab.className = `image-tab${i === g.activeDocumentIndex ? ' active' : ''}`;
        tab.dataset.index = i;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'image-tab-name';
        nameSpan.textContent = doc.name + (doc.modified ? ' •' : '');
        nameSpan.addEventListener('click', () => switchDocument(i));

        const closeBtn = document.createElement('span');
        closeBtn.className = 'image-tab-close';
        closeBtn.textContent = '×';
        closeBtn.title = 'Close';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeDocument(i);
        });

        tab.appendChild(nameSpan);
        tab.appendChild(closeBtn);
        tabBar.appendChild(tab);
    });

    // Add "new tab" button
    const newTabBtn = document.createElement('div');
    newTabBtn.className = 'image-tab-new';
    newTabBtn.textContent = '+';
    newTabBtn.title = 'New Image';
    newTabBtn.addEventListener('click', () => newDocument());
    tabBar.appendChild(newTabBtn);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function () {
    initDocuments();
    console.log('Document/Tab system initialized');
});

// Export
if (typeof window !== 'undefined') {
    window.ImageDocument = ImageDocument;
    window.newDocument = newDocument;
    window.closeDocument = closeDocument;
    window.switchDocument = switchDocument;
    window.renderImageTabs = renderImageTabs;
}
