/**
 * Clipboard and Edit Operations for Selection
 * Handles Cut, Copy, Paste, Move Selection.
 */
(function () {
    "use strict";

    // Internal clipboard (in-memory)
    let internalClipboard = null; // { width, height, data: ImageData }

    /**
     * Copy current selection to clipboard.
     * If no selection, copy entire active layer? Krita copies selection.
     */
    function copySelection() {
        if (!g.isSelectionActive || !g.selectionCanvas) {
            console.log("No selection to copy");
            return;
        }

        const activeLayer = layers[g.activeLayerIndex];
        if (!activeLayer) return;

        // Get bounds of selection
        const bounds = getMaskBounds(g.selectionCanvas);
        if (!bounds) return;

        // Extract pixel data from active layer within bounds, masked by selection
        const ctx = activeLayer.ctx;
        const imgData = ctx.getImageData(bounds.x, bounds.y, bounds.w, bounds.h);

        // We need to apply the selection mask alpha to the copied data?
        // Yes, copied data should be transparent where not selected.
        const maskCtx = g.selectionCanvas.getContext("2d");
        const maskData = maskCtx.getImageData(bounds.x, bounds.y, bounds.w, bounds.h);

        const finalData = new ImageData(bounds.w, bounds.h);

        for (let i = 0; i < imgData.data.length; i += 4) {
            const alpha = maskData.data[i + 3] / 255;
            finalData.data[i] = imgData.data[i];
            finalData.data[i + 1] = imgData.data[i + 1];
            finalData.data[i + 2] = imgData.data[i + 2];
            // Multiply layer alpha by mask alpha
            finalData.data[i + 3] = imgData.data[i + 3] * alpha;
        }

        internalClipboard = {
            width: bounds.w,
            height: bounds.h,
            data: finalData
        };
        console.log("Copied selection to clipboard", internalClipboard);
    }

    /**
     * Cut: Copy + Erase selection.
     */
    function cutSelection() {
        if (!g.isSelectionActive) return;
        copySelection();

        // Erase selected pixels
        // We can use the selection mask with 'destination-out' composite op?
        // Yes.
        const activeLayer = layers[g.activeLayerIndex];
        if (!activeLayer || activeLayer.locked) return;

        const ctx = activeLayer.ctx;
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(g.selectionCanvas, 0, 0);
        ctx.restore();

        // Capture history
        // TODO: History push
        renderLayers();
    }

    /**
     * Paste: Paste clipboard content.
     * Creates a new layer with pasted content.
     */
    /**
     * Paste: Paste clipboard content.
     */
    function pasteSelection() {
        if (!internalClipboard) {
            console.log("Clipboard empty");
            return;
        }

        // Paste as Floating Content (Move Content tool behavior)
        const fCanvas = g.createCanvas(internalClipboard.width, internalClipboard.height);
        const fctx = fCanvas.getContext("2d");
        fctx.putImageData(internalClipboard.data, 0, 0);

        // Center on screen
        const transform = (typeof getCanvasTransform === 'function') ? getCanvasTransform() : { scale: g.zoom, offsetX: 0, offsetY: 0 };
        // Center in Viewport simplified:
        // Visible area center in canvas coords:
        const container = document.getElementById('canvasScrollArea');
        let cx = g.image_width / 2;
        let cy = g.image_height / 2;

        if (container) {
            const rect = container.getBoundingClientRect();
            // Center of view
            const viewCX = container.scrollLeft + container.clientWidth / 2;
            const viewCY = container.scrollTop + container.clientHeight / 2;
            cx = viewCX / g.zoom;
            cy = viewCY / g.zoom;
        }

        const x = Math.round(cx - internalClipboard.width / 2);
        const y = Math.round(cy - internalClipboard.height / 2);

        // initialize floating content
        g.floatingContent = {
            canvas: fCanvas,
            x: x,
            y: y,
            originalLayerIndex: g.activeLayerIndex // Attach to current layer on commit
        };

        // Switch to Move Content tool automatically
        g.current_tool = Tool.MoveContent;
        // Notify UI tool change if possible
        if (window.updateToolState) window.updateToolState('move-content'); // Hypothethical

        // Update selection mask to match pasted content alpha (strict 0/1)
        // This is important so the user "holds" the pasted object
        const newMask = g.createCanvas(g.image_width, g.image_height);
        const mctx = newMask.getContext("2d");
        mctx.drawImage(fCanvas, x, y);
        // Threshold alpha for mask
        const idata = mctx.getImageData(0, 0, g.image_width, g.image_height);
        const d = idata.data;
        for (let i = 3; i < d.length; i += 4) {
            d[i] = (d[i] > 0) ? 255 : 0;
        }
        mctx.putImageData(idata, 0, 0);

        g.selectionCanvas = newMask;
        g.isSelectionActive = true;
        if (typeof extractSelectionBorder === 'function') {
            g.selectionBorder = extractSelectionBorder(g.selectionCanvas);
        }

        if (typeof renderLayers === 'function') renderLayers();
    }

    /**
     * Duplicate: Copy then Paste immediately (floating).
     */
    function duplicateSelection() {
        if (!g.isSelectionActive) return;
        copySelection();
        // Don't erase original (Ctrl+J behavior usually duplicates)
        pasteSelection();
        console.log("Duplicated selection");
    }

    // Expose
    window.copySelection = copySelection;
    window.cutSelection = cutSelection;
    window.pasteSelection = pasteSelection;
    window.duplicateSelection = duplicateSelection;

})();
