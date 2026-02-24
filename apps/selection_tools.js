/**
 * Selection tools: rect, ellipse, lasso mask building; add/subtract; marching ants; Select All/Deselect/Invert.
 * Does not modify packages/core. Uses g.selectionCanvas, g.selectionBorder, g.isSelectionActive.
 */
(function () {
    "use strict";

    const width = () => (typeof g !== "undefined" ? g.image_width : 0);
    const height = () => (typeof g !== "undefined" ? g.image_height : 0);

    /**
     * Create a new mask canvas (same size as document) with alpha=255 inside shape, 0 outside.
     * @param {CanvasRenderingContext2D} ctx - context of the mask canvas
     * @param {'rect'|'ellipse'|'lasso'} shape
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @param {Array<{x:number,y:number}>} [lassoPoints] - for shape 'lasso'
     */
    function fillShapeMask(ctx, shape, x1, y1, x2, y2, lassoPoints) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "rgba(255,255,255,1)";
        ctx.beginPath();
        if (shape === "rect") {
            const left = Math.min(x1, x2);
            const top = Math.min(y1, y2);
            const right = Math.max(x1, x2);
            const bottom = Math.max(y1, y2);
            ctx.rect(left, top, right - left, bottom - top);
        } else if (shape === "ellipse") {
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            const rx = Math.abs(x2 - x1) / 2;
            const ry = Math.abs(y2 - y1) / 2;
            if (rx < 0.5 && ry < 0.5) {
                ctx.rect(Math.floor(cx), Math.floor(cy), 1, 1);
            } else {
                ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
            }
        } else if ((shape === "lasso" || shape === "poly") && lassoPoints && lassoPoints.length >= 2) {
            ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
            for (let i = 1; i < lassoPoints.length; i++) {
                ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
            }
            ctx.closePath();
        }
        ctx.fill();
    }

    /**
     * Get outline path for marching ants: array of {x,y}.
     */
    function getRectBorder(x1, y1, x2, y2) {
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const right = Math.max(x1, x2);
        const bottom = Math.max(y1, y2);
        // Important: return points in order resulting in a closed loop
        return [
            { x: left, y: top },
            { x: right, y: top },
            { x: right, y: bottom },
            { x: left, y: bottom },
            { x: left, y: top }
        ];
    }

    function getEllipseBorder(x1, y1, x2, y2, steps) {
        steps = steps || 64;
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;
        const out = [];
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            out.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
        }
        return out;
    }

    /**
     * Combine current selection with a new shape mask. Returns the final mask canvas.
     * mode: 'replace' | 'add' | 'subtract' | 'intersect' | 'xor'
     */
    function combineMask(newMaskCanvas, mode) {
        const w = newMaskCanvas.width;
        const h = newMaskCanvas.height;
        if (mode === "replace" || !g.isSelectionActive || !g.selectionCanvas) {
            return newMaskCanvas;
        }

        // Professional logic: use Canvas composite ops for speed and sub-pixel accuracy
        const resultCanvas = g.createCanvas(w, h);
        const rctx = resultCanvas.getContext("2d");

        // Start with existing
        rctx.drawImage(g.selectionCanvas, 0, 0);

        if (mode === "add") {
            rctx.globalCompositeOperation = "source-over";
            rctx.drawImage(newMaskCanvas, 0, 0);
        } else if (mode === "subtract") {
            rctx.globalCompositeOperation = "destination-out";
            rctx.drawImage(newMaskCanvas, 0, 0);
        } else if (mode === "intersect") {
            rctx.globalCompositeOperation = "destination-in";
            rctx.drawImage(newMaskCanvas, 0, 0);
        } else if (mode === "xor") {
            // XOR is tricky with composite ops. Pixel-wise is safer or use 'difference' then threshold.
            // Let's stick to pixel-wise for XOR as it's rare.
            const existing = rctx.getImageData(0, 0, w, h);
            const newData = newMaskCanvas.getContext("2d").getImageData(0, 0, w, h);
            for (let i = 3; i < existing.data.length; i += 4) {
                existing.data[i] = (existing.data[i] > 127 !== newData.data[i] > 127) ? 255 : 0;
            }
            rctx.putImageData(existing, 0, 0);
        }

        return resultCanvas;
    }

    /**
     * Finds the bounding box of a selection mask.
     */
    function getMaskBounds(maskCanvas) {
        const w = maskCanvas.width;
        const h = maskCanvas.height;
        const ctx = maskCanvas.getContext("2d", { willReadFrequently: true });
        const data = ctx.getImageData(0, 0, w, h).data;
        let minX = w, minY = h, maxX = 0, maxY = 0;
        let found = false;
        // Optimization: check alpha channel only
        for (let y = 0; y < h; y++) {
            const rowOffset = y * w * 4;
            for (let x = 0; x < w; x++) {
                if (data[rowOffset + x * 4 + 3] > 10) { // Small threshold for anti-aliasing
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    found = true;
                }
            }
        }
        if (!found) return null;
        return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }

    /**
     * Extracts boundaries from the selection mask using Moore-Neighbor tracing.
     */
    function extractSelectionBorder(maskCanvas) {
        if (!maskCanvas) return [];
        const w = maskCanvas.width;
        const h = maskCanvas.height;
        const ctx = maskCanvas.getContext("2d");
        const bounds = getMaskBounds(maskCanvas);
        if (!bounds) return [];

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const visited = new Uint8Array(w * h);
        const paths = [];

        const isSolid = (x, y) => {
            if (x < 0 || x >= w || y < 0 || y >= h) return false;
            return data[(y * w + x) * 4 + 3] > 127;
        };

        // Scan only within bounds + 1px padding
        for (let y = Math.max(0, bounds.y - 1); y <= Math.min(h - 1, bounds.y + bounds.h); y++) {
            for (let x = Math.max(0, bounds.x - 1); x <= Math.min(w - 1, bounds.x + bounds.w); x++) {
                if (!visited[y * w + x] && isSolid(x, y) && (!isSolid(x - 1, y) || !isSolid(x + 1, y) || !isSolid(x, y - 1) || !isSolid(x, y + 1))) {
                    const path = traceContour(x, y, w, h, isSolid, visited);
                    if (path.length > 10) {
                        paths.push(path);
                    }
                }
            }
        }
        console.log("Selection border extraction: found", paths.length, "significant contours.");
        return paths;
    }

    /**
     * Moore-Neighbor Tracing with correct neighbor order and backtracking.
     */
    function traceContour(startX, startY, w, h, isSolid, visited) {
        visited[startY * w + startX] = 1;
        const path = [{ x: startX, y: startY }];
        let currX = startX;
        let currY = startY;

        // Neighbor offsets (clockwise from top-left)
        // 0:TL, 1:T, 2:TR, 3:R, 4:BR, 5:B, 6:BL, 7:L
        const dx = [-1, 0, 1, 1, 1, 0, -1, -1];
        const dy = [-1, -1, -1, 0, 1, 1, 1, 0];

        // Start looking from the previous direction moved, rotated back by 2 steps
        let moveDir = 7; // Initially check from Left (since we scanned from top-left)

        let exitCount = 0;
        const maxExit = w * h;

        while (exitCount < maxExit) {
            exitCount++;
            let nextFound = false;

            // Search all 8 neighbors starting from the backtrack position
            // Backtrack 2 positions clockwise from where we came from
            const entryDir = (moveDir + 4) % 8; // Opposite of where we moved
            const searchStart = (entryDir + 1) % 8; // Clockwise scan start

            for (let i = 0; i < 8; i++) {
                const checkDir = (searchStart + i) % 8;
                const nx = currX + dx[checkDir];
                const ny = currY + dy[checkDir];

                if (isSolid(nx, ny)) {
                    currX = nx;
                    currY = ny;
                    moveDir = checkDir;
                    nextFound = true;
                    break;
                }
            }

            if (!nextFound || (currX === startX && currY === startY && path.length > 1)) {
                break;
            }

            path.push({ x: currX, y: currY });
            visited[currY * w + currX] = 1; // Mark as visited to avoid re-starting here
        }

        // Close path
        if (path.length > 0) {
            path.push({ x: path[0].x, y: path[0].y });
        }
        return path;
    }

    /**
     * Build selection from rectangle. mode: 'replace' | 'add' | 'subtract' | 'intersect' | 'xor'
     */
    function buildRectSelection(x1, y1, x2, y2, mode) {
        const w = width();
        const h = height();
        if (w <= 0 || h <= 0) return;
        const canvas = g.createCanvas(w, h);
        const ctx = canvas.getContext("2d");
        fillShapeMask(ctx, "rect", x1, y1, x2, y2);
        g.selectionCanvas = combineMask(canvas, mode);
        g.selectionBorder = extractSelectionBorder(g.selectionCanvas);
        g.isSelectionActive = true;
    }

    /**
     * Build selection from ellipse. mode: 'replace' | 'add' | 'subtract' | 'intersect' | 'xor'
     */
    function buildEllipseSelection(x1, y1, x2, y2, mode) {
        const w = width();
        const h = height();
        if (w <= 0 || h <= 0) return;
        const canvas = g.createCanvas(w, h);
        const ctx = canvas.getContext("2d");
        fillShapeMask(ctx, "ellipse", x1, y1, x2, y2);
        g.selectionCanvas = combineMask(canvas, mode);
        g.selectionBorder = extractSelectionBorder(g.selectionCanvas);
        g.isSelectionActive = true;
    }

    /**
     * Build selection from lasso points. mode: 'replace' | 'add' | 'subtract' | 'intersect' | 'xor'
     */
    function buildLassoSelection(points, mode) {
        const w = width();
        const h = height();
        if (w <= 0 || h <= 0 || !points || points.length < 2) return;
        const canvas = g.createCanvas(w, h);
        const ctx = canvas.getContext("2d");
        fillShapeMask(ctx, "lasso", 0, 0, 0, 0, points);
        g.selectionCanvas = combineMask(canvas, mode);
        g.selectionBorder = extractSelectionBorder(g.selectionCanvas);
        g.isSelectionActive = true;
    }

    /**
     * Build selection from polygon points. mode: 'replace' | 'add' | 'subtract' | 'intersect' | 'xor'
     * Uses same logic as lasso (fillShapeMask handles 'lasso' which is just a polygon)
     */
    function buildPolygonalSelection(points, mode) {
        const w = width();
        const h = height();
        if (w <= 0 || h <= 0 || !points || points.length < 2) return;
        const canvas = g.createCanvas(w, h);
        const ctx = canvas.getContext("2d");
        fillShapeMask(ctx, "poly", 0, 0, 0, 0, points);
        g.selectionCanvas = combineMask(canvas, mode);
        g.selectionBorder = extractSelectionBorder(g.selectionCanvas);
        g.isSelectionActive = true;
    }

    /**
     * Marching ants: visible on both light and dark backgrounds.
     * Draw dark outline first, then white dashed line on top for contrast.
     */
    // Marching ants: highly visible black/white contrast
    g.selectionDashOffset = 0;
    g.selectionPreviewBorder = []; // For tools to show live feedback without affecting current selection

    function drawSelectionBorder(ctx, offsetX = 0, offsetY = 0) {
        if (!g.isSelectionActive && g.selectionPreviewBorder.length === 0) return;

        ctx.save();
        ctx.translate(offsetX, offsetY);

        // Reset styles for border
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
        ctx.filter = "none";
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        // Draw bothcommitted and preview paths
        const allPaths = [...(g.selectionBorder || []), ...(g.selectionPreviewBorder || [])];
        if (allPaths.length === 0) {
            ctx.restore();
            return;
        }

        ctx.beginPath();
        allPaths.forEach(path => {
            if (!path || path.length < 2 || !path[0]) return;
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                if (!path[i]) continue;
                ctx.lineTo(path[i].x, path[i].y);
            }
            if (path.length > 2) ctx.closePath();
        });

        // 1. Thick solid black outline (background)
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(0, 0, 0, 1.0)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 2. White dashes on top (foreground)
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -g.selectionDashOffset;
        ctx.strokeStyle = "rgba(255, 255, 255, 1.0)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }

    // Animation loop (independent of drawing loop)
    setInterval(() => {
        if (g.isSelectionActive) {
            // Speed = 0.5px per tick (approx 12.5px/sec at 25Hz)
            g.selectionDashOffset = (g.selectionDashOffset + 0.5) % 8; // Modulo 8 (sum of dash [4,4])
            // Force redraw even if not drawing
            if (!g.drawing && window.renderLayers) {
                window.renderLayers();
            }
        }
    }, 40);

    /**
     * Select entire document.
     */
    function selectAll() {
        buildRectSelection(0, 0, width(), height(), "replace");
    }

    /**
     * Clear pixel and vector selection.
     */
    function deselect() {
        if (g.isTransforming && typeof transformUI !== 'undefined') {
            transformUI.commit();
        }
        if (typeof cancelSelection === "function") {
            cancelSelection();
        } else {
            g.isSelectionActive = false;
            g.selectionCanvas = null;
            g.selectionMask = null;
            g.selectionBorder = [];
            window.polyPoints = [];
            window.lassoPoints = [];
        }
        if (typeof renderLayers === "function") renderLayers();
        if (window.vectorToolManager) {
            if (window.vectorToolManager.isEditing) window.vectorToolManager.cancelEdit();
            else window.vectorToolManager.notifyVectorSelectionChanged(false);
        }
    }

    /**
     * Invert selection: selected becomes unselected and vice versa.
     */
    function invertSelection() {
        if (!g.isSelectionActive || !g.selectionCanvas) return;
        const w = g.selectionCanvas.width;
        const h = g.selectionCanvas.height;
        const ctx = g.selectionCanvas.getContext("2d");
        const img = ctx.getImageData(0, 0, w, h);
        const d = img.data;
        for (let i = 3; i < d.length; i += 4) {
            d[i] = 255 - d[i];
        }
        ctx.putImageData(img, 0, 0);
        g.selectionBorder = extractSelectionBorder(g.selectionCanvas);
    }

    /** True if (x,y) is inside the current selection (alpha > 0 in mask). */
    function isPointInSelection(x, y) {
        if (!g.isSelectionActive || !g.selectionCanvas) return false;
        const w = g.selectionCanvas.width;
        const h = g.selectionCanvas.height;
        const ix = Math.floor(x);
        const iy = Math.floor(y);

        if (ix < 0 || ix >= w || iy < 0 || iy >= h) {
            console.log(`[DEBUG] isPointInSelection: Out of bounds (${ix}, ${iy}) for mask ${w}x${h}`);
            return false;
        }

        const ctx = g.selectionCanvas.getContext("2d", { willReadFrequently: true });
        const img = ctx.getImageData(ix, iy, 1, 1);
        const isHit = img.data[3] > 10; // Use small delta for anti-aliasing

        if (isHit) {
            console.log(`[DEBUG] isPointInSelection: HIT at (${ix}, ${iy}), alpha=${img.data[3]}`);
        } else {
            // Only log miss if alpha is non-zero but below threshold
            if (img.data[3] > 0) console.log(`[DEBUG] isPointInSelection: MISS at (${ix}, ${iy}), alpha=${img.data[3]} (below threshold)`);
        }

        return isHit;
    }

    /**
     * Build selection from an existing mask canvas.
     */
    function buildSelectionFromMask(maskCanvas, mode) {
        if (!maskCanvas) return;
        g.selectionCanvas = combineMask(maskCanvas, mode);
        g.selectionBorder = extractSelectionBorder(g.selectionCanvas);
        g.isSelectionActive = true;
    }

    /**
     * Move the existing selection mask.
     */
    /**
     * Move the existing selection mask.
     */
    function moveSelectionMask(dx, dy) {
        if (!g.isSelectionActive || !g.selectionCanvas) return;
        const w = g.selectionCanvas.width;
        const h = g.selectionCanvas.height;
        const newCanvas = g.createCanvas(w, h);
        const nctx = newCanvas.getContext("2d");
        nctx.drawImage(g.selectionCanvas, dx, dy);
        g.selectionCanvas = newCanvas;

        // Shift existing border points too (much faster than re-tracing)
        if (g.selectionBorder) {
            g.selectionBorder = g.selectionBorder.map(path =>
                path.map(p => ({ x: p.x + dx, y: p.y + dy }))
            );
        }
    }

    /**
     * Move both the selection mask and the underlying pixel content.
     */
    /**
     * SelectionTransformUI: Persistent UI for moving/transforming selection content.
     */
    class SelectionTransformUI {
        constructor() {
            this.active = false;
            this.overlay = null;
            this.controls = null;
            this.startX = 0;
            this.startY = 0;
            this.currentX = 0;
            this.currentY = 0;
            this.originalShapes = null;
            this.originalLayerIndex = -1;
            this.isDragging = false;
            this.init();
        }

        init() {
            this.overlay = document.createElement('div');
            this.overlay.id = 'selectionTransformOverlay';
            this.overlay.style.cssText = `
                position: absolute;
                border: 1px dashed #fff;
                box-shadow: 0 0 0 1px #000;
                pointer-events: none;
                display: none;
                z-index: 1000;
            `;

            this.controls = document.createElement('div');
            this.controls.style.cssText = `
                position: absolute;
                top: -35px;
                right: 0;
                display: flex;
                gap: 5px;
                pointer-events: auto;
            `;

            const dragHandle = document.createElement('div');
            dragHandle.innerHTML = '✛ Move';
            dragHandle.style.cssText = 'background: #333; color: #fff; padding: 4px 8px; font-size: 11px; cursor: move; border-radius: 3px; user-select: none;';
            dragHandle.addEventListener('mousedown', (e) => this.onDragStart(e));

            const okBtn = document.createElement('div');
            okBtn.innerHTML = '✓ OK';
            okBtn.style.cssText = 'background: #28a745; color: #fff; padding: 4px 10px; cursor: pointer; border-radius: 3px; font-size: 11px; font-weight: bold; user-select: none;';
            okBtn.onclick = (e) => { e.stopPropagation(); this.commit(); };

            const cancelBtn = document.createElement('div');
            cancelBtn.innerHTML = '✕ Cancel';
            cancelBtn.style.cssText = 'background: #dc3545; color: #fff; padding: 4px 10px; cursor: pointer; border-radius: 3px; font-size: 11px; font-weight: bold; user-select: none;';
            cancelBtn.onclick = (e) => { e.stopPropagation(); this.cancel(); };

            this.controls.appendChild(dragHandle);
            this.controls.appendChild(okBtn);
            this.controls.appendChild(cancelBtn);
            this.overlay.appendChild(this.controls);

            const wrapper = document.getElementById('canvasWrapper');
            if (wrapper) wrapper.appendChild(this.overlay);
        }

        onDragStart(e) {
            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;

            const onMouseMove = (me) => {
                if (!this.isDragging) return;
                const dx = (me.clientX - this.dragStartX) / g.zoom;
                const dy = (me.clientY - this.dragStartY) / g.zoom;
                if (typeof moveSelectionContent === 'function') moveSelectionContent(dx, dy);
                this.dragStartX = me.clientX;
                this.dragStartY = me.clientY;
            };

            const onMouseUp = () => {
                this.isDragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.stopPropagation();
            e.preventDefault();
        }

        show(bounds) {
            this.active = true;
            g.isTransforming = true;
            this.updatePosition(bounds);
            this.overlay.style.display = 'block';
        }

        updatePosition(bounds) {
            this.overlay.style.left = (bounds.x * g.zoom) + 'px';
            this.overlay.style.top = (bounds.y * g.zoom) + 'px';
            this.overlay.style.width = (bounds.w * g.zoom) + 'px';
            this.overlay.style.height = (bounds.h * g.zoom) + 'px';
        }

        commit() {
            console.log("[DEBUG] Committing selection transform...");
            if (typeof finalizeMoveContent === 'function') finalizeMoveContent();
            this.hide();
        }

        cancel() {
            console.log("[DEBUG] Cancelling selection transform...");
            // Restore original pixels and shapes
            if (floatingContent) {
                const layer = layers[this.originalLayerIndex];
                if (layer && this.originalImageData) {
                    layer.ctx.putImageData(this.originalImageData, 0, 0);
                    if (this.originalShapes) layer.shapes = this.originalShapes;
                }
            }
            floatingContent = null;
            g.floatingContent = null;
            this.hide();
            if (window.renderLayers) window.renderLayers();
        }

        hide() {
            this.active = false;
            g.isTransforming = false;
            this.overlay.style.display = 'none';
            this.originalImageData = null;
            this.originalShapes = null;
        }
    }

    const transformUI = new SelectionTransformUI();

    let floatingContent = null; // { canvas, x, y, originalLayerIndex }
    function moveSelectionContent(dx, dy) {
        if (!g.isSelectionActive || !g.selectionCanvas) return;

        // Initialization step: pick up pixels
        if (!floatingContent) {
            const activeLayer = layers[g.activeLayerIndex];
            if (!activeLayer) return;

            // --- AUTO-FLATTEN LOGIC ---
            // If the layer has shapes, we must flatten them into the layer buffer BEFORE picking up
            transformUI.originalShapes = activeLayer.shapes ? [...activeLayer.shapes] : [];
            // Backup full layer data for cancel
            transformUI.originalImageData = activeLayer.ctx.getImageData(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
            transformUI.originalLayerIndex = g.activeLayerIndex;

            if (activeLayer.shapes && activeLayer.shapes.length > 0) {
                console.log("[DEBUG] Rasterizing overlapping vector shapes before move...");
                if (typeof drawShapesToCtx === 'function') {
                    drawShapesToCtx(activeLayer.ctx, activeLayer.shapes);
                    // Clear shapes from vector array (they are now pixels)
                    activeLayer.shapes = [];
                }
            }

            const bounds = getMaskBounds(g.selectionCanvas);
            if (!bounds) return;

            // 1. Create floating canvas
            const fCanvas = g.createCanvas(bounds.w, bounds.h);
            const fctx = fCanvas.getContext("2d");

            // Mask the source layer pixels
            const tempCanvas = g.createCanvas(g.image_width, g.image_height);
            const tctx = tempCanvas.getContext("2d");
            tctx.drawImage(activeLayer.canvas, 0, 0);
            tctx.globalCompositeOperation = "destination-in";
            tctx.drawImage(g.selectionCanvas, 0, 0);

            // Draw into floating canvas
            fctx.drawImage(tempCanvas, -bounds.x, -bounds.y);

            // 2. Erase from original layer
            const lctx = activeLayer.ctx;
            lctx.save();
            lctx.globalCompositeOperation = "destination-out";
            lctx.drawImage(g.selectionCanvas, 0, 0);
            lctx.restore();

            floatingContent = {
                canvas: fCanvas,
                x: bounds.x,
                y: bounds.y,
                originalLayerIndex: g.activeLayerIndex
            };

            transformUI.show(bounds);
            console.log("Floating content picked up from layer", g.activeLayerIndex);
        }

        // Apply movement
        floatingContent.x += dx;
        floatingContent.y += dy;
        moveSelectionMask(dx, dy);

        // Update UI overlay
        transformUI.updatePosition({
            x: floatingContent.x,
            y: floatingContent.y,
            w: floatingContent.canvas.width,
            h: floatingContent.canvas.height
        });

        // Preview on g.tempCanvas (drawing_canvas.js render loop will show it)
        g.floatingContent = floatingContent; // Share with renderer
    }

    function finalizeMoveContent() {
        if (!floatingContent) return;
        const activeLayer = layers[g.activeLayerIndex];
        if (activeLayer) {
            activeLayer.ctx.drawImage(floatingContent.canvas, floatingContent.x, floatingContent.y);
        }
        floatingContent = null;
        g.floatingContent = null;
        if (window.renderLayers) window.renderLayers();
        if (window.finishDrawing) window.finishDrawing();
    }

    // Export to window so drawing_canvas.js and layers.js can use them
    window.buildRectSelection = buildRectSelection;
    window.buildEllipseSelection = buildEllipseSelection;
    window.buildLassoSelection = buildLassoSelection;
    window.buildPolygonalSelection = buildPolygonalSelection;
    window.buildSelectionFromMask = buildSelectionFromMask;
    window.drawSelectionBorder = drawSelectionBorder;
    window.getRectBorder = getRectBorder;
    window.getEllipseBorder = getEllipseBorder;
    window.selectAll = selectAll;
    window.deselect = deselect;
    window.invertSelection = invertSelection;
    window.isPointInSelection = isPointInSelection;
    window.getMaskBounds = getMaskBounds;
    window.moveSelectionMask = moveSelectionMask;
    /**
     * Magic Wand Selection: select contiguous pixels of similar color.
     */
    function magicWandSelection(startX, startY, sourceCtx, tolerance, mode) {
        console.log(`[DEBUG] magicWandSelection: start=(${startX}, ${startY}), tolerance=${tolerance}, mode=${mode}`);
        // 1. Generate mask from sourceCtx at startX, startY
        const w = sourceCtx.canvas.width;
        const h = sourceCtx.canvas.height;
        const srcData = sourceCtx.getImageData(0, 0, w, h).data;
        const maskData = new Uint8Array(w * h); // 0 or 1

        const stack = [{ x: startX, y: startY }];
        const startIdx = (startY * w + startX) * 4;
        const sR = srcData[startIdx];
        const sG = srcData[startIdx + 1];
        const sB = srcData[startIdx + 2];
        const sA = srcData[startIdx + 3];

        console.log(`[DEBUG] Target Pixel Color: rgba(${sR}, ${sG}, ${sB}, ${sA})`);

        const visited = new Uint8Array(w * h); // track visited to avoid loops
        let pixelCount = 0;

        while (stack.length > 0) {
            const { x, y } = stack.pop();
            const idx = y * w + x;
            if (visited[idx]) continue;
            visited[idx] = 1;

            const pIdx = idx * 4;
            const r = srcData[pIdx];
            const g_ = srcData[pIdx + 1]; // g is global
            const b = srcData[pIdx + 2];
            const a = srcData[pIdx + 3];

            if (
                Math.abs(r - sR) <= tolerance &&
                Math.abs(g_ - sG) <= tolerance &&
                Math.abs(b - sB) <= tolerance &&
                Math.abs(a - sA) <= tolerance
            ) {
                maskData[idx] = 1;
                pixelCount++;

                if (x > 0) stack.push({ x: x - 1, y: y });
                if (x < w - 1) stack.push({ x: x + 1, y: y });
                if (y > 0) stack.push({ x: x, y: y - 1 });
                if (y < h - 1) stack.push({ x: x, y: y + 1 });
            }
        }

        console.log(`[DEBUG] Magic Wand found ${pixelCount} pixels`);

        // 2. Create mask canvas
        const maskCanvas = g.createCanvas(w, h);
        const mctx = maskCanvas.getContext("2d");
        const imgData = mctx.createImageData(w, h);
        for (let i = 0; i < maskData.length; i++) {
            if (maskData[i] === 1) {
                imgData.data[i * 4 + 3] = 255; // Alpha 255
            }
        }
        mctx.putImageData(imgData, 0, 0);

        // 3. Combine with global selection
        buildSelectionFromMask(maskCanvas, mode);
    }

    window.moveSelectionContent = moveSelectionContent;
    window.finalizeMoveContent = finalizeMoveContent;
    window.magicWandSelection = magicWandSelection;

    // Listen for tool changes to auto-commit transformations
    window.addEventListener('toolChanged', (e) => {
        if (g.isTransforming && typeof transformUI !== 'undefined' && e.detail.tool !== Tool.MoveContent.id) {
            console.log("[DEBUG] Auto-committing selection transform due to tool change");
            transformUI.commit();
        }
        // Clear Polygon/Lasso state when switching tools
        if (e.detail.tool !== Tool.PolySelect.id) {
            window.polyPoints = [];
        }
        if (e.detail.tool !== Tool.Lasso.id) {
            window.lassoPoints = [];
        }
    });
    window.finalizeMoveContent = finalizeMoveContent;
})();
