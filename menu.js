/**
 * Menu Bar Manager
 * Handles menu visibility based on environment (Electron vs Web)
 */

// Detect environment on page load
document.addEventListener('DOMContentLoaded', function () {
    initializeMenuBar();
});

function initializeMenuBar() {
    const menuBar = document.getElementById('appMenuBar');

    if (!menuBar) {
        console.warn('Menu bar element not found');
        return;
    }

    // Check if running in Electron
    const isElectron = typeof window !== 'undefined' &&
        (window.process?.type === 'renderer' ||
            window.electronAPI !== undefined ||
            navigator.userAgent.toLowerCase().includes('electron'));

    if (isElectron) {
        // Hide web menu in Electron (native menu is used)
        menuBar.style.display = 'none';
        console.log('Running in Electron - using native menu');
    } else {
        // Show web menu when running as standalone HTML
        menuBar.style.display = 'table-row';
        console.log('Running in web mode - showing application menu');
    }
}

// Optional: Add keyboard shortcut support for menu items
document.addEventListener('keydown', function (e) {
    // Only handle shortcuts if web menu is visible
    const menuBar = document.getElementById('appMenuBar');
    if (!menuBar || menuBar.style.display === 'none') {
        return;
    }

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // File menu
    if (ctrl && e.key === 'n') {
        e.preventDefault();
        newCanvas();
    } else if (ctrl && e.key === 'o') {
        e.preventDefault();
        document.getElementById('btn-open').click();
    } else if (ctrl && !shift && e.key === 's') {
        e.preventDefault();
        document.getElementById('btn-save').click();
    }
    // Edit menu
    else if (ctrl && !shift && e.key === 'x') {
        e.preventDefault();
        cutSelection();
    } else if (ctrl && !shift && e.key === 'c') {
        e.preventDefault();
        copySelection();
    } else if (ctrl && !shift && e.key === 'v') {
        e.preventDefault();
        pasteSelection();
    } else if (ctrl && !shift && e.key === 'j') {
        e.preventDefault();
        if (typeof duplicateSelection === 'function') duplicateSelection();
    }
    else if (ctrl && e.key === 'z') {
        e.preventDefault();
        undoImage();
    } else if (ctrl && e.key === 'y') {
        e.preventDefault();
        redoImage();
    } else if (e.key === 'Delete') {
        e.preventDefault();
        clearCanvas();
    }
    // View menu
    else if (ctrl && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        zoomIn();
    } else if (ctrl && e.key === '-') {
        e.preventDefault();
        zoomOut();
    }
});

// Function to create new canvas (if not already defined)
function newCanvas() {
    if (confirm('Create a new canvas? Unsaved changes will be lost.')) {
        clearCanvas();
        console.log('New canvas created');
    }
}
