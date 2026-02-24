/**
 * New Image Dialog Logic
 */

function newCanvas() {
    const modal = document.getElementById('newImageModal');
    if (modal) {
        modal.classList.add('active');
        // Set default values from current g
        document.getElementById('newWidth').value = g.image_width;
        document.getElementById('newHeight').value = g.image_height;
    }
}

function closeNewImageDialog() {
    const modal = document.getElementById('newImageModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function applyPreset() {
    const preset = document.getElementById('imagePreset').value;
    const widthInput = document.getElementById('newWidth');
    const heightInput = document.getElementById('newHeight');
    const portraitBtn = document.getElementById('btn-portrait');
    const landscapeBtn = document.getElementById('btn-landscape');

    let w = 1280, h = 720;

    switch (preset) {
        case 'hd': w = 1280; h = 720; break;
        case 'fhd': w = 1920; h = 1080; break;
        case '4k': w = 3840; h = 2160; break;
        case 'a4': w = 2480; h = 3508; break; // 300 dpi
        case 'square': w = 1024; h = 1024; break;
        case 'custom': return;
    }

    // Apply orientation if not square
    if (w !== h) {
        if (portraitBtn.classList.contains('btn-active') && w > h) {
            [w, h] = [h, w];
        } else if (landscapeBtn.classList.contains('btn-active') && h > w) {
            [w, h] = [h, w];
        }
    }

    widthInput.value = w;
    heightInput.value = h;
}

function setOrientation(orientation) {
    const portraitBtn = document.getElementById('btn-portrait');
    const landscapeBtn = document.getElementById('btn-landscape');
    const widthInput = document.getElementById('newWidth');
    const heightInput = document.getElementById('newHeight');

    let w = parseInt(widthInput.value);
    let h = parseInt(heightInput.value);

    if (orientation === 'portrait') {
        portraitBtn.classList.add('btn-active');
        landscapeBtn.classList.remove('btn-active');
        if (w > h) [w, h] = [h, w];
    } else {
        landscapeBtn.classList.add('btn-active');
        portraitBtn.classList.remove('btn-active');
        if (h > w) [w, h] = [h, w];
    }

    widthInput.value = w;
    heightInput.value = h;
}

function createNewImage() {
    const w = parseInt(document.getElementById('newWidth').value);
    const h = parseInt(document.getElementById('newHeight').value);
    const bgColor = document.getElementById('newBgColor').value;
    const isTransparent = document.getElementById('transparentBg').checked;

    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
        alert('Please enter valid dimensions.');
        return;
    }

    // 1. Create a new document in the tab system
    const docName = `Untitled-${g.documents.length + 1}`;

    // We can't just call newDocument() because we need to customize the background layer
    // So we'll manually create the document object or call a modified version
    if (typeof newDocument === 'function') {
        newDocument(docName, w, h);

        // After switching to the new document in switchDocument (called inside newDocument),
        // we refine the background layer of the active document
        const activeDoc = g.documents[g.activeDocumentIndex];
        if (activeDoc && activeDoc.layers.length > 0) {
            const bgLayer = activeDoc.layers[0];
            if (!isTransparent) {
                bgLayer.ctx.fillStyle = bgColor;
                bgLayer.ctx.fillRect(0, 0, w, h);
            }
        }

        // Final refresh
        if (typeof renderLayers === 'function') renderLayers();
        if (typeof updateLayerPanel === 'function') updateLayerPanel();

        // Reset undo for the NEW document state
        if (typeof undo !== 'undefined') {
            undo.length = 0;
            const oCtx = originalCanvas.getContext("2d");
            undo.push(oCtx.getImageData(0, 0, w, h));
            g.undo_index = 0;
            // Also store it in the document object if it uses its own stack
            activeDoc.undoStack = [undo[0]];
            activeDoc.undoIndex = 0;
        }
    } else {
        console.error("newDocument function not found");
    }

    closeNewImageDialog();
    console.log(`Created new document: ${docName} (${w}x${h})`);
}
