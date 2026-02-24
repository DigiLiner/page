"use strict";
//Canvas container
// Set CSS variables for canvas size based on window size and other UI elements
const calculateScreenSize = () => {
    // Legacy support, mostly handled by CSS now
};
window.addEventListener("resize", calculateScreenSize);
calculateScreenSize();

let originalCanvas = document.getElementById('originalCanvas');
let can = document.getElementById("drawingCanvas");
let initWrapper = document.getElementById('canvasWrapper');
let zoomCanvas = document.getElementById("zoomCanvas");
let tempCanvas;
let tempCtx;

/**
 * Robust color parser using a hidden canvas
 */
function parseColorToRgba(colorStr, opacity = 1.0) {
    const tempCan = document.createElement('canvas');
    tempCan.width = tempCan.height = 1;
    const tCtx = tempCan.getContext('2d');
    tCtx.fillStyle = colorStr;
    tCtx.fillRect(0, 0, 1, 1);
    const data = tCtx.getImageData(0, 0, 1, 1).data;
    return {
        r: data[0],
        g: data[1],
        b: data[2],
        a: Math.floor(opacity * 255)
    };
}

/**
 * Enhanced Flood Fill: Samples from sourceCtx, writes to targetCtx
 */
function enhancedFloodFill(x, y, sourceCtx, targetCtx, fillColor, tolerance) {
    const width = sourceCtx.canvas.width;
    const height = sourceCtx.canvas.height;

    // Get source image data for sampling
    const sourceData = sourceCtx.getImageData(0, 0, width, height).data;

    // Prepare target data (starts empty as it targets tempCtx)
    const targetImageData = targetCtx.getImageData(0, 0, width, height);
    const targetData = targetImageData.data;

    const visited = new Uint8Array(width * height);
    const queue = [{ x, y }];

    const startIndex = (y * width + x) * 4;
    const startR = sourceData[startIndex];
    const startG = sourceData[startIndex + 1];
    const startB = sourceData[startIndex + 2];
    const startA = sourceData[startIndex + 3];

    // Tolerance check helper
    const isSimilar = (idx) => {
        const r = sourceData[idx];
        const g = sourceData[idx + 1];
        const b = sourceData[idx + 2];
        const a = sourceData[idx + 3];
        return Math.abs(r - startR) <= tolerance.r &&
            Math.abs(g - startG) <= tolerance.g &&
            Math.abs(b - startB) <= tolerance.b &&
            Math.abs(a - startA) <= tolerance.a;
    };

    while (queue.length > 0) {
        const { x: cx, y: cy } = queue.pop();
        const idx = cy * width + cx;

        if (visited[idx]) continue;
        visited[idx] = 1;

        const pIdx = idx * 4;
        if (isSimilar(pIdx)) {
            // Set color in target
            targetData[pIdx] = fillColor.r;
            targetData[pIdx + 1] = fillColor.g;
            targetData[pIdx + 2] = fillColor.b;
            targetData[pIdx + 3] = fillColor.a;

            // Neighbors
            if (cx > 0) queue.push({ x: cx - 1, y: cy });
            if (cx < width - 1) queue.push({ x: cx + 1, y: cy });
            if (cy > 0) queue.push({ x: cx, y: cy - 1 });
            if (cy < height - 1) queue.push({ x: cx, y: cy + 1 });
        }
    }

    targetCtx.putImageData(targetImageData, 0, 0);
}

// Function to resize all canvases
function resizeCanvas(width, height) {
    g.image_width = width;
    g.image_height = height;

    if (can) {
        can.width = width;
        can.height = height;
    }
    if (originalCanvas) {
        originalCanvas.width = width;
        originalCanvas.height = height;
    }

    // Create or resize tempCanvas
    if (!tempCanvas || tempCanvas.width !== width || tempCanvas.height !== height) {
        tempCanvas = g.createCanvas(width, height);
        tempCtx = tempCanvas.getContext("2d");
    }

    if (initWrapper) {
        initWrapper.style.width = `${width}px`;
        initWrapper.style.height = `${height}px`;
    }
    if (zoomCanvas) {
        zoomCanvas.width = width * g.zoom;
        zoomCanvas.height = height * g.zoom;
    }

    // Update active document metadata if it exists
    if (typeof g.documents !== 'undefined' && g.activeDocumentIndex >= 0) {
        const doc = g.documents[g.activeDocumentIndex];
        if (doc) {
            doc.width = width;
            doc.height = height;
        }
    }

    console.log(`Canvas resized to ${width}x${height}`);
    if (typeof renderLayers === 'function') renderLayers();
}

// Initialize immediately
resizeCanvas(g.image_width, g.image_height);

// Expose globally
window.resizeCanvas = resizeCanvas;

//UNDO / REDO
let undo = [];
const ctx = can ? can.getContext("2d") : null;

// Expose these explicitly to window for other scripts (layers.js, project_io.js)
if (typeof window !== 'undefined') {
    window.can = can;
    window.ctx = ctx;
}

// Animation loop for selection border
function animate() {
    // If selection is active, we might need to redraw for the marching ants animation
    // even if the user isn't doing anything.
    const hasPreview = g.selectionPreviewBorder && g.selectionPreviewBorder.length > 0;
    if (g.isSelectionActive || hasPreview) {
        // Redraw only if NOT currently drawing (because on_canvas_mouse_move already does it)
        if (!g.drawing && window.renderLayers) {
            window.renderLayers();
        }
    }
    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

////////////////////////////////////////////////////
/////////////////   D  O  W  N /////////////////////
////////////////////////////////////////////////////
function on_canvas_mouse_down(e) {
    console.log(`[DEBUG] Mousedown: Tool=${g.current_tool}, Buttons=${e.buttons}, Shift=${e.shiftKey}, Alt=${e.altKey}`);
    console.log(`[DEBUG] Current selection state: active=${g.isSelectionActive}, hasCanvas=${!!g.selectionCanvas}`);

    if (!ctx) {
        console.error("No context found for drawing canvas");
        return;
    }

    // Debug: Check active layer
    const activeLayer = layers[g.activeLayerIndex];
    if (activeLayer) {
        console.log(`Active Layer: ${activeLayer.name}, Visible: ${activeLayer.visible}, Opacity: ${activeLayer.opacity}`);
    } else {
        console.error("No active layer selected!");
    }

    // Pan tool: don't start drawing, just let mouse_move handle it
    if (g.current_tool === Tool.Pan || e.buttons === 4) { // Middle click or Pan tool
        if (can) can.style.cursor = 'grabbing';
        return;
    }

    // Block drawing on hidden or locked layers
    const checkLayer = layers[g.activeLayerIndex];
    if (!checkLayer) {
        console.error("Critical: No layer found at index", g.activeLayerIndex);
        return;
    }
    console.log("Drawing on layer:", checkLayer.name, "Visible:", checkLayer.visible, "Locked:", checkLayer.locked);

    if (!checkLayer.visible || checkLayer.locked) {
        console.warn("Cannot draw: layer is", !checkLayer.visible ? "hidden" : "locked");
        return;
    }

    // Prepare tempCtx
    tempCtx.globalAlpha = 1;
    tempCtx.filter = "none";
    tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);

    // For some tools, we need the current layer content as a base on tempCanvas
    // For others (like Pen/Brush), we only want the new stroke on tempCanvas

    // Logic:
    // If we draw the layer content onto tempCanvas, then when we renderLayers(tempCanvas),
    // we are drawing (Layer + Stroke) on top of (Layer). This is fine if opacity is 1.
    // But if we want to support opacity/blending, it's better if tempCanvas ONLY has the stroke.

    // However, the original code copied the active layer. Let's stick to that for now to avoid regressions,
    // BUT for Pen/Brush/Eraser, we might want to isolate the stroke.
    // Let's try isolating the stroke for better performance and blending.

    // Capture state for Undo/Redo
    g.previousLayerState = checkLayer.ctx.getImageData(0, 0, g.image_width, g.image_height);

    if (g.current_tool === Tool.Wand) {
        let mode = "replace";
        if (e.shiftKey) mode = "add";
        if (e.altKey) mode = "subtract";

        // AI_GUARDRAIL: Coordinate System Logic
        const wandX = Math.round(e.offsetX / g.zoom);
        const wandY = Math.round(e.offsetY / g.zoom);

        // Wand needs the target pixel data
        if (g.wand_all_layers && originalCanvas) {
            // Pick from composite
            tempCtx.drawImage(originalCanvas, 0, 0);
        } else if (checkLayer) {
            // Pick from active layer
            if (checkLayer.type === 'vector' && typeof renderVectorLayer === 'function') {
                renderVectorLayer(checkLayer);
            }
            tempCtx.drawImage(checkLayer.canvas, 0, 0);
        }

        // Pass global tolerance
        if (typeof magicWandSelection === 'function') {
            try {
                const tolerance = parseInt(g.wand_tolerance) || 32;
                // magicWandSelection handles mode (add/subtract/replace) internally now
                magicWandSelection(wandX, wandY, tempCtx, tolerance, mode);

                // Re-extract border paths
                if (g.selectionCanvas && typeof extractSelectionBorder === 'function') {
                    g.selectionBorder = extractSelectionBorder(g.selectionCanvas);
                }
                g.isSelectionActive = !!g.selectionCanvas;
            } catch (e) {
                console.error("Magic Wand Error:", e);
            }
        } else {
            console.error("magicWandSelection function not found in selection_tools.js");
        }

        renderLayers();
        return;
    }

    // For drawing tools (Pen, Brush, etc.), we start a new stroke.
    // We DON'T copy the layer content to tempCanvas. We just draw the stroke.
    // renderLayers(tempCanvas) will draw Layer then TempCanvas on top.

    // Pen Line Settings
    tempCtx.globalAlpha = g.pen_opacity;

    // Filter Logic for Shape Tools (Hardness -> Blur)
    // AI_GUARDRAIL: Shape Hardness Logic
    // Shape tools (Line, Rect, Circle) must support soft edges via Hardness slider.
    // 100% Hardness = 0px Blur (Sharp).
    // 0% Hardness = Max Blur (proportional to pen width).
    // DO NOT hardcode blur to 0 or 1. Respect the slider.
    const isBlurTool = [Tool.Line, Tool.Circle, Tool.Rectangle, Tool.Rounded_Rectangle, Tool.Ellipse].includes(g.current_tool);
    if (isBlurTool) {
        const hardness = (g.brush_hardness !== undefined) ? g.brush_hardness : 1.0;
        const maxBlur = Math.max(2, g.pen_width / 2);
        const blurAmount = (1.0 - hardness) * maxBlur;
        tempCtx.filter = (blurAmount > 0.5) ? `blur(${blurAmount}px)` : "none";
    } else {
        tempCtx.filter = "none";
    }

    // tempCtx.filter = g.pen_blur > 0 ? `blur(${g.pen_blur}px)` : "none"; // Legacy logic replaced

    tempCtx.lineCap = g.pen_cap || "round";
    tempCtx.lineJoin = g.pen_join || "round";
    tempCtx.lineWidth = g.pen_width;
    tempCtx.strokeStyle = g.pen_color;

    // AI_GUARDRAIL: Coordinate System Logic
    // Canvas events return offsetX/Y in CSS pixels (screen space).
    // The canvas context operates in Intrinsic pixels (buffer space).
    // When zoomed, CSS dimensions = Intrinsic * Zoom.
    // So we MUST divide by g.zoom to get correct buffer coordinates.
    // DO NOT REMOVE THIS SCALING.
    g.pX = Math.round(e.offsetX / g.zoom);
    g.pY = Math.round(e.offsetY / g.zoom);
    g.startX = g.pX;
    g.startY = g.pY;
    g.drawing = true;

    // Handle specific tools
    switch (g.current_tool) {
        case Tool.Spray:
            drawSpray(tempCtx, e);
            break;
        case Tool.Pen:
            drawPen(e, tempCtx);
            break;
        case Tool.RectSelect:
        case Tool.EllipseSelect:
        case Tool.Lasso:
            // Selection tools: Only move if clicking INSIDE existing selection
            if (g.isSelectionActive && typeof isPointInSelection === 'function' && isPointInSelection(g.pX, g.pY)) {
                g.movingSelection = true;
            } else {
                g.movingSelection = false;
                if (g.current_tool === Tool.Lasso) {
                    window.lassoPoints = [{ x: g.pX, y: g.pY }];
                }
            }
            break;
        case Tool.MoveSelection:
        case Tool.MoveContent:
            // Dedicated move tools: Drag from anywhere if a selection exists
            if (g.isSelectionActive && g.selectionCanvas) {
                g.movingSelection = true;
                if (g.current_tool === Tool.MoveContent && typeof moveSelectionContent === 'function') {
                    moveSelectionContent(0, 0);
                }
            } else {
                g.movingSelection = false;
            }
            break;
        case Tool.PolySelect:
            // Standardize: Only move if clicking INSIDE existing selection AND not currently drafting a new one
            const hasDraftPoints = window.polyPoints && window.polyPoints.length > 0;
            if (g.isSelectionActive && !hasDraftPoints && typeof isPointInSelection === 'function' && isPointInSelection(g.pX, g.pY)) {
                console.log("[DEBUG] PolySelect: Clicked inside selection, starting move");
                g.movingSelection = true;
                // Note: Dedicated Move tools (MoveContent) handle pixel lifting. 
                // Selection tools move the mask.
            } else {
                console.log("[DEBUG] PolySelect: Clicked outside or drafting, adding point");
                g.movingSelection = false;
                if (!window.polyPoints) window.polyPoints = [];
                window.polyPoints.push({ x: g.pX, y: g.pY });
            }
            break;
        case Tool.Flood_Fill:
            // Source selection logic: Global Composite or Active Layer
            let sourceCanvas = checkLayer.canvas; // Default
            if (g.fill_all_layers && originalCanvas) {
                renderLayers(); // Ensure composite is up to date
                sourceCanvas = originalCanvas;
            } else {
                // Active Layer Only
                sourceCanvas = checkLayer.canvas; // Default raster content

                // If the layer has vector shapes, we must composite them to see them
                if ((checkLayer.type === 'vector' || (checkLayer.shapes && checkLayer.shapes.length > 0))) {
                    // Create a temp canvas for the composite of this layer
                    const compositionCan = document.createElement('canvas');
                    compositionCan.width = sourceCanvas.width;
                    compositionCan.height = sourceCanvas.height;
                    const compositionCtx = compositionCan.getContext('2d');

                    // Draw raster part
                    compositionCtx.drawImage(sourceCanvas, 0, 0);

                    // Draw vector part
                    if (typeof drawShapesToCtx === 'function' && checkLayer.shapes) {
                        drawShapesToCtx(compositionCtx, checkLayer.shapes);
                    }

                    sourceCanvas = compositionCan;
                }
            }

            const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
            const fillColor = parseColorToRgba(g.pen_color, g.pen_opacity);
            const tol = g.fill_tolerance || 32;
            const toleranceObj = { r: tol, g: tol, b: tol, a: tol };

            // We fill on tempCtx, and finishDrawing will commit it to active layer
            enhancedFloodFill(g.pX, g.pY, sourceCtx, tempCtx, fillColor, toleranceObj);

            finishDrawing();
            break;
        default:
            break;
    }
}

////////////////////////////////////////////////////
/////////////////   M  O  V  E /////////////////////
////////////////////////////////////////////////////
function on_canvas_mouse_move(e) {
    if (!ctx) return;

    // AI_GUARDRAIL: Coordinate System Logic (See mouse_down)
    // Must divide by g.zoom to map screen pixels to canvas buffer.
    g.pX = Math.round(e.offsetX / g.zoom);
    g.pY = Math.round(e.offsetY / g.zoom);

    // Update status bar
    const statusMessage = document.getElementById("statusMessage");
    const mousePosition = document.getElementById("mousePosition");
    if (mousePosition) mousePosition.textContent = `X: ${g.pX}, Y: ${g.pY}`;
    if (statusMessage) statusMessage.innerHTML = g.drawing ? "Drawing" : "Ready";

    // Handle Pan Tool or Middle Mouse Drag
    if (g.current_tool === Tool.Pan || (e.buttons === 4)) { // 4 is middle button
        if (e.buttons === 1 || e.buttons === 4) { // Left click (if Pan tool) or Middle click
            const container = document.getElementById('canvasScrollArea');
            if (container) {
                container.scrollLeft -= e.movementX;
                container.scrollTop -= e.movementY;
            }
        }
        return;
    }

    if (!g.drawing) return;

    // Special handling for Polygon: We want to show the 'rubber band' line even if button is up
    if (e.buttons !== 1) {
        if (g.current_tool === Tool.PolySelect && !g.movingSelection) {
            // Proceed to drawing block below to update the preview
        } else {
            g.drawing = false;
            return;
        }
    }

    // Clear tempCanvas for shape tools (so we don't leave trails)
    const isShapeTool = [Tool.Line, Tool.Circle, Tool.Rectangle, Tool.Rounded_Rectangle, Tool.Ellipse, Tool.RectSelect, Tool.EllipseSelect, Tool.Lasso, Tool.PolySelect, Tool.Crop].includes(g.current_tool);
    const isMoveTool = [Tool.MoveSelection, Tool.MoveContent].includes(g.current_tool);

    if (isShapeTool) {
        tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);
    }

    // Draw based on tool
    const isBlurTool = [Tool.Line, Tool.Circle, Tool.Rectangle, Tool.Rounded_Rectangle, Tool.Ellipse].includes(g.current_tool);

    if (isBlurTool) {
        const hardness = (g.brush_hardness !== undefined) ? g.brush_hardness : 1.0;
        const maxBlur = Math.max(2, g.pen_width / 2);
        const blurAmount = (1.0 - hardness) * maxBlur;

        if (blurAmount > 0.5) {
            tempCtx.filter = `blur(${blurAmount}px)`;
        } else {
            tempCtx.filter = "none";
        }
    } else {
        tempCtx.filter = "none";
    }

    tempCtx.globalAlpha = g.pen_opacity;

    if (g.current_tool === Tool.Circle) {
        drawCircle(e, tempCtx);
    } else if (g.current_tool === Tool.Line) {
        drawLine(e, tempCtx);
    } else if (g.current_tool === Tool.Rectangle) {
        drawRect(tempCtx, g.startX, g.startY, g.pX, g.pY);
    } else if (g.current_tool === Tool.Pen) {
        drawPen(e, tempCtx);
    } else if (g.current_tool === Tool.Brush) {
        // Interpolate brush strokes
        const dist = Math.hypot(g.pX - g.startX, g.pY - g.startY);
        const step = Math.max(1, g.pen_width * 0.25);
        const steps = Math.max(1, Math.ceil(dist / step));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = g.startX + (g.pX - g.startX) * t;
            const y = g.startY + (g.pY - g.startY) * t;
            drawBrush(tempCtx, x, y);
        }
        g.startX = g.pX;
        g.startY = g.pY;
    } else if (g.current_tool === Tool.Eraser) {
        drawEraser(tempCtx, g.startX, g.startY, g.pX, g.pY);
        g.startX = g.pX;
        g.startY = g.pY;
    } else if (g.current_tool === Tool.Spray) {
        drawSpray(tempCtx, e);
    } else if (g.current_tool === Tool.Rounded_Rectangle) {
        drawRoundedRect(tempCtx, g.startX, g.startY, g.pX, g.pY);
    } else if (g.current_tool === Tool.Ellipse) {
        drawEllipse(tempCtx, g.startX, g.startY, g.pX, g.pY);
    } else if (g.current_tool === Tool.RectSelect) {
        if (g.movingSelection) {
            const dx = g.pX - g.startX;
            const dy = g.pY - g.startY;
            if (typeof moveSelectionMask === 'function') moveSelectionMask(dx, dy);
            g.startX = g.pX;
            g.startY = g.pY;
        } else {
            if (typeof getRectBorder === 'function') {
                g.selectionPreviewBorder = [getRectBorder(g.startX, g.startY, g.pX, g.pY)];
            }
        }
    } else if (g.current_tool === Tool.EllipseSelect) {
        if (g.movingSelection) {
            const dx = g.pX - g.startX;
            const dy = g.pY - g.startY;
            if (typeof moveSelectionMask === 'function') moveSelectionMask(dx, dy);
            g.startX = g.pX;
            g.startY = g.pY;
        } else {
            if (typeof getEllipseBorder === 'function') {
                g.selectionPreviewBorder = [getEllipseBorder(g.startX, g.startY, g.pX, g.pY)];
            }
        }
    } else if (g.current_tool === Tool.Lasso) {
        if (g.movingSelection) {
            const dx = g.pX - g.startX;
            const dy = g.pY - g.startY;
            if (typeof moveSelectionMask === 'function') moveSelectionMask(dx, dy);
            g.startX = g.pX;
            g.startY = g.pY;
        } else if (window.lassoPoints) {
            window.lassoPoints.push({ x: g.pX, y: g.pY });
            g.selectionPreviewBorder = [[...window.lassoPoints, window.lassoPoints[0]]];
            tempCtx.beginPath();
            tempCtx.moveTo(window.lassoPoints[0].x, window.lassoPoints[0].y);
            for (let i = 1; i < window.lassoPoints.length; i++) tempCtx.lineTo(window.lassoPoints[i].x, window.lassoPoints[i].y);
            tempCtx.strokeStyle = 'rgba(0,0,0,0.5)';
            tempCtx.lineWidth = 1;
            tempCtx.stroke();
        }
    } else if (g.current_tool === Tool.PolySelect) {
        if (g.movingSelection) {
            const dx = g.pX - g.startX;
            const dy = g.pY - g.startY;
            if (typeof moveSelectionMask === 'function') moveSelectionMask(dx, dy);
            g.startX = g.pX;
            g.startY = g.pY;
        } else if (window.polyPoints && window.polyPoints.length > 0) {
            g.selectionPreviewBorder = [[...window.polyPoints, { x: g.pX, y: g.pY }, window.polyPoints[0]]];
            tempCtx.beginPath();
            tempCtx.moveTo(window.polyPoints[0].x, window.polyPoints[0].y);
            for (let i = 1; i < window.polyPoints.length; i++) tempCtx.lineTo(window.polyPoints[i].x, window.polyPoints[i].y);
            tempCtx.lineTo(g.pX, g.pY);
            tempCtx.strokeStyle = 'rgba(0,0,0,0.5)';
            tempCtx.lineWidth = 1;
            tempCtx.stroke();
            window.polyPoints.forEach(p => {
                tempCtx.fillStyle = '#fff';
                tempCtx.strokeStyle = '#000';
                tempCtx.beginPath();
                tempCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                tempCtx.fill();
                tempCtx.stroke();
            });
        }
    } else if (g.current_tool === Tool.MoveSelection || g.current_tool === Tool.MoveContent) {
        if (!g.movingSelection) return;
        const dx = g.pX - g.startX;
        const dy = g.pY - g.startY;
        if (g.current_tool === Tool.MoveSelection) {
            if (typeof moveSelectionMask === 'function') moveSelectionMask(dx, dy);
        } else {
            if (typeof moveSelectionContent === 'function') moveSelectionContent(dx, dy);
        }
        g.startX = g.pX;
        g.startY = g.pY;
    }

    // Masking for live selection
    // Also include floating content for preview
    if (g.isSelectionActive && g.selectionCanvas && !isMoveTool) {
        tempCtx.save();
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(g.selectionCanvas, 0, 0);
        tempCtx.restore();
    }

    // Render composition
    renderLayers(tempCanvas);
}

function finishDrawing(e) {
    console.log(`[DEBUG] FinishDrawing: Tool=${g.current_tool}, Drawing=${g.drawing}, movingSelection=${g.movingSelection}`);
    if (!ctx || !g.drawing) {
        g.movingSelection = false; // Safety reset
        return;
    }

    // Use event for modifiers if available
    const shift = e ? e.shiftKey : (window.event ? window.event.shiftKey : false);
    const alt = e ? e.altKey : (window.event ? window.event.altKey : false);

    // Commit tempCanvas to active layer
    const activeLayer = layers[g.activeLayerIndex];
    if (activeLayer && !activeLayer.locked) {

        // Handle SELECTION Tools -> Do NOT draw to layer
        try {
            if (g.current_tool === Tool.RectSelect) {
                if (g.movingSelection) {
                    g.movingSelection = false;
                } else {
                    let mode = "replace";
                    if (shift) mode = "add";
                    if (alt) mode = "subtract";
                    if (typeof buildRectSelection === 'function') {
                        buildRectSelection(g.startX, g.startY, g.pX, g.pY, mode);
                    }
                }
                g.selectionPreviewBorder = [];
                g.drawing = false;
                tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);
                renderLayers();
                return;
            }
            if (g.current_tool === Tool.EllipseSelect) {
                if (g.movingSelection) {
                    g.movingSelection = false;
                } else {
                    let mode = "replace";
                    if (shift) mode = "add";
                    if (alt) mode = "subtract";
                    if (typeof buildEllipseSelection === 'function') {
                        buildEllipseSelection(g.startX, g.startY, g.pX, g.pY, mode);
                    }
                }
                g.selectionPreviewBorder = [];
                g.drawing = false;
                tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);
                renderLayers();
                return;
            }
            if (g.current_tool === Tool.Lasso) {
                if (g.movingSelection) {
                    g.movingSelection = false;
                } else {
                    let mode = "replace";
                    if (shift) mode = "add";
                    if (alt) mode = "subtract";
                    if (typeof buildLassoSelection === 'function' && window.lassoPoints) {
                        // Close the loop
                        window.lassoPoints.push({ x: g.pX, y: g.pY });
                        buildLassoSelection(window.lassoPoints, mode);
                    }
                }
                g.selectionPreviewBorder = [];
                window.lassoPoints = [];
                g.drawing = false;
                tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);
                renderLayers();
                return;
            }
            if (g.current_tool === Tool.PolySelect) {
                if (g.movingSelection) {
                    g.movingSelection = false;
                    g.drawing = false;
                    renderLayers();
                }
                // If not moving, we stay in g.drawing = true to collect more points
                return;
            }

            if (g.current_tool === Tool.MoveContent) {
                // Persistent MoveContent doesn't auto-finalize on mouseup. 
                // The user must click OK or Cancel in the transform overlay.
                g.drawing = false;
                return;
            }

            if (g.current_tool === Tool.MoveSelection) {
                g.drawing = false;
                return;
            }
        } catch (e) {
            console.error("[DEBUG] Error in finishDrawing (Tool Logic):", e);
            // Ensure we reset flags even on error
            g.drawing = false;
            g.movingSelection = false;
        }

        // If selection is active, mask the stroke
        if (g.isSelectionActive && g.selectionCanvas) {
            tempCtx.save();
            tempCtx.globalCompositeOperation = 'destination-in';
            tempCtx.drawImage(g.selectionCanvas, 0, 0);
            tempCtx.restore();
        }

        // Draw tempCanvas onto the active layer
        // Note: If we used "copy layer to temp" strategy, we would replace.
        // But we used "draw stroke on temp" strategy, so we drawImage on top.
        // UNLESS it was FloodFill which replaced content.

        try {
            if (g.current_tool === Tool.Flood_Fill) {
                activeLayer.ctx.drawImage(tempCanvas, 0, 0);
            } else {
                activeLayer.ctx.drawImage(tempCanvas, 0, 0);
            }
        } catch (e) {
            console.error("[DEBUG] Error committing to layer:", e);
        }
    }

    console.log(`[DEBUG] Completing drawing operation. Resetting move states.`);
    g.drawing = false;
    g.movingSelection = false;

    // Reset cursor to tool default
    if (can) {
        can.style.cursor = (g.current_tool === Tool.Pan) ? 'grab' : 'crosshair';
    }

    // Clear temp canvas
    tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);

    // Final render
    renderLayers();

    // Update thumbnails
    if (typeof updateLayerPanel === 'function') updateLayerPanel();

    // Save Undo using HistoryManager
    if (activeLayer) {
        const newData = activeLayer.ctx.getImageData(0, 0, g.image_width, g.image_height);
        // We need the previous state. 
        // Ideally, we capture 'currentState' at START of drawing (mousedown).
        // For now, let's grab it from undo stack? No.

        // Fix: We need to capture state BEFORE drawing.
        // Let's assume g.previousLayerState was captured in mousedown.
        if (g.previousLayerState) {
            historyManager.push(new DrawAction(g.activeLayerIndex, g.previousLayerState, newData));
        }
        g.previousLayerState = null; // Reset
    }
}

function selectTool(tool) {
    g.current_tool = tool;

    // UI Updates
    if (can) {
        can.style.cursor = (g.current_tool === Tool.Pan) ? 'grab' : 'crosshair';
    }

    // Dispatch event
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('toolChanged', { detail: { tool: tool.id } }));
    }

    // Update Toolbar Buttons
    clearSelected();
    let e = document.getElementById(tool.id);
    if (e) e.classList.add("down");
}

function clearSelected() {
    Tool.getAllTools().forEach((t) => {
        let elem = document.getElementById(t.id);
        if (elem) elem.classList.remove("down");
    });
}

function undoImage() {
    if (window.historyManager) {
        window.historyManager.undo();
        if (typeof updateLayerPanel === 'function') updateLayerPanel();
    }
}

function redoImage() {
    if (window.historyManager) {
        window.historyManager.redo();
        if (typeof updateLayerPanel === 'function') updateLayerPanel();
    }
}

function restoreUndoState() {
    const data = undo[g.undo_index];
    if (!data) return;

    // Restore to originalCanvas
    const oCtx = originalCanvas.getContext("2d");
    oCtx.putImageData(data, 0, 0);

    // Restore to Active Layer (Simplified: Clear all layers and put undo image on background)
    // Ideally, undo should track layer states. For now, we flatten on undo.
    // TODO: Implement full layer history
    layers.length = 0;
    const newLayer = new layer_class("Restored", g.image_width, g.image_height);
    newLayer.ctx.putImageData(data, 0, 0);
    layers.push(newLayer);
    g.activeLayerIndex = 0;

    renderLayers();
    updateLayerPanel();
}

// Helper to apply a loaded PSD object to the canvas
window.applyPsdToCanvas = async function (psd) {
    if (!psd) return;

    const newLayers = await convertPsdToLayers(psd);
    if (newLayers.length > 0) {
        layers.length = 0; // Clear existing
        // Safest way to replace content
        layers.splice(0, layers.length, ...newLayers);

        g.activeLayerIndex = layers.length - 1; // Select top layer

        // Update dimensions
        g.image_width = psd.width || psd.tree().width;
        g.image_height = psd.height || psd.tree().height;

        // Resize canvases
        if (window.resizeCanvas) {
            window.resizeCanvas(g.image_width, g.image_height);
        } else {
            // Fallback if resizeCanvas not available
            if (can) { can.width = g.image_width; can.height = g.image_height; }
            if (originalCanvas) { originalCanvas.width = g.image_width; originalCanvas.height = g.image_height; }
            tempCanvas = g.createCanvas(g.image_width, g.image_height);
            tempCtx = tempCanvas.getContext("2d");
        }

        // Reset Zoom
        g.zoom = 1;
        applyZoom(1);

        renderLayers();
        if (typeof updateLayerPanel === 'function') updateLayerPanel();

        console.log("PSD applied successfully");
        finishDrawing(); // Reset undo state
    }
};

async function openImage(filename) {
    // Check file extension for PSD - Legacy check if filename passed directly
    // But now proper handling is in renderer.js
    if (filename.toLowerCase().endsWith('.psd')) {
        // We should not be here preferably, because renderer handles reading binary now.
        // But for backward compatibility or direct calls:
        console.warn("Legacy openImage calls for PSD might fail if not using renderer.");
    }

    // Fallback to standard image loading
    // ... logic for images ...
    let img = await loadImage(filename);
    g.undo_index = -1;
    undo.splice(0, undo.length);

    // Update global dimensions
    g.image_width = img.width;
    g.image_height = img.height;

    // Resize canvases
    if (can) {
        can.width = g.image_width;
        can.height = g.image_height;
    }
    if (originalCanvas) {
        originalCanvas.width = g.image_width;
        originalCanvas.height = g.image_height;
        const oCtx = originalCanvas.getContext('2d');
        oCtx.drawImage(img, 0, 0);
    }

    // Resize tempCanvas
    tempCanvas = g.createCanvas(g.image_width, g.image_height);
    tempCtx = tempCanvas.getContext("2d");

    // Reset Layers
    layers.length = 0;
    const bgLayer = new layer_class("Background", g.image_width, g.image_height);
    bgLayer.ctx.drawImage(img, 0, 0);
    layers.push(bgLayer);
    g.activeLayerIndex = 0;

    // Update UI
    if (typeof updateLayerPanel === 'function') updateLayerPanel();

    // Reset Zoom
    g.zoom = 1;
    applyZoom(1);

    // Initial Undo State
    finishDrawing();

    // AI_GUARDRAIL: Image Loading Reflow
    renderLayers();
}

async function loadImage(url) {
    return new Promise((r) => {
        let i = new Image();
        i.onload = () => r(i);
        i.src = url;
    });
}

function getCanvasImageDataURL() {
    // Return the composite image
    return can.toDataURL("image/png");
}

// Zoom Functions
function zoomIn(e) {
    const oldZoom = g.zoom;
    g.zoom = Math.min(g.zoom * g.zoomFactor, 32);
    applyZoom(oldZoom, e);
}

function zoomOut(e) {
    const oldZoom = g.zoom;
    g.zoom = Math.max(g.zoom / g.zoomFactor, 0.05);
    applyZoom(oldZoom, e);
}

function applyZoom(oldZoom, e) {
    const wrapper = document.getElementById('canvasWrapper');
    const container = document.getElementById('canvasScrollArea');
    if (!wrapper || !container) return;

    const newWidth = g.image_width * g.zoom;
    const newHeight = g.image_height * g.zoom;

    wrapper.style.width = `${newWidth}px`;
    wrapper.style.height = `${newHeight}px`;

    // Center zoom logic
    if (e && e.clientX !== undefined) {
        const rect = container.getBoundingClientRect();
        const mouseContainerX = e.clientX - rect.left + container.scrollLeft;
        const mouseContainerY = e.clientY - rect.top + container.scrollTop;
        const imgX = mouseContainerX / oldZoom;
        const imgY = mouseContainerY / oldZoom;

        container.scrollLeft = (imgX * g.zoom) - (e.clientX - rect.left);
        container.scrollTop = (imgY * g.zoom) - (e.clientY - rect.top);
    }

    const zoomDisplay = document.getElementById('zoomDisplay');
    if (zoomDisplay) zoomDisplay.textContent = ` Zoom: ${Math.round(g.zoom * 100)}%`;

    if (newWidth > container.clientWidth || newHeight > container.clientHeight) {
        container.classList.add('has-overflow');
    } else {
        container.classList.remove('has-overflow');
    }
}

// Event Listeners
const container = document.getElementById('canvasScrollArea');
console.log("drawing_canvas.js initializing listeners. Container found:", !!container);

if (container) {
    // Zoom Support
    container.addEventListener('wheel', (event) => {
        // console.log('Wheel event detected', event.deltaY); 
        event.preventDefault(); // Always prevent scrolling to zoom
        if (event.deltaY < 0) {
            zoomIn(event);
        } else {
            zoomOut(event);
        }
    }, { passive: false });

    // Pan Support (Middle Mouse)
    container.addEventListener('mousedown', (e) => {
        // console.log("Container mousedown", e.buttons);
        if (e.buttons === 4 || g.current_tool === Tool.Pan) {
            // Start panning
            container.style.cursor = 'grabbing';
            // We don't prevent default here to allow focus, but we handle move
        }
    });



    // Global MouseUp for Pan/Grab reset
    window.addEventListener('mouseup', () => {
        if (container.style.cursor === 'grabbing') {
            console.log("[DEBUG] Global MouseUp detected, resetting cursor from grabbing");
            container.style.cursor = (g.current_tool === Tool.Pan) ? 'grab' : 'default';
        }
    });

    // Debug
    container.addEventListener('click', () => {
        // console.log("Container clicked");
    });
}

if (can) {
    can.addEventListener('mousedown', (e) => {
        if (e.buttons === 1 || e.buttons === 2) on_canvas_mouse_down(e);
    }, false);

    can.addEventListener('mouseup', finishDrawing, false);

    can.addEventListener('mousemove', (e) => {
        on_canvas_mouse_move(e);
    }, false);

    // Touch support
    can.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            const rect = can.getBoundingClientRect();
            const me = new MouseEvent("mousedown", {
                clientX: touch.clientX,
                clientY: touch.clientY,
                buttons: 1
            });
            // Adjust for offset in handler if needed, but MouseEvent clientX/Y should be enough if we use offsetX/Y calculation there.
            // Wait, MouseEvent constructor doesn't set offsetX/Y. We need to mock it or rely on clientX/Y in handler.
            // The handler uses offsetX/Y.
            // We need to patch the event or change handler.
            // Let's just rely on the fact that we can calculate it.
            // Actually, let's just dispatch the event to the element?
            // No, we are calling the handler directly.

            // Hack to add offsetX/Y
            me.offsetX = touch.clientX - rect.left;
            me.offsetY = touch.clientY - rect.top;
            on_canvas_mouse_down(me);
        }
    }, false);

    can.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            const rect = can.getBoundingClientRect();
            const me = new MouseEvent("mousemove", {
                clientX: touch.clientX,
                clientY: touch.clientY,
                buttons: 1
            });
            me.offsetX = touch.clientX - rect.left;
            me.offsetY = touch.clientY - rect.top;
            on_canvas_mouse_move(me);
        }
    }, false);

    can.addEventListener('touchend', finishDrawing, false);

    // Double click to finish Polygon Selection
    // Double click to finish Polygon Selection
    can.addEventListener('dblclick', (e) => {
        if (g.current_tool === Tool.PolySelect && window.polyPoints && window.polyPoints.length > 2) {
            try {
                // Remove the last point if it was added by the second click of the double-click
                // or if it's too close to the previous point.
                if (window.polyPoints.length > 3) {
                    window.polyPoints.pop();
                }

                let mode = "replace";
                if (e.shiftKey) mode = "add";
                if (e.altKey) mode = "subtract";

                if (typeof window.buildPolygonalSelection === 'function') {
                    window.buildPolygonalSelection(window.polyPoints, mode);
                } else if (typeof buildPolygonalSelection === 'function') {
                    buildPolygonalSelection(window.polyPoints, mode);
                }
            } catch (err) {
                console.error("[DEBUG] Error finalizing Polygon Selection:", err);
            } finally {
                window.polyPoints = [];
                g.drawing = false;
                g.movingSelection = false;
                if (tempCtx) tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);
                renderLayers();
                console.log("Polygon Selection finalized");
            }
        }
    }, false);
}

console.log("Drawing canvas initialized");

// ─── Selection Management ──────────────────────────────────

function cancelSelection() {
    if (g.isSelectionActive || (window.polyPoints && window.polyPoints.length > 0)) {
        g.isSelectionActive = false;
        g.selectionCanvas = null;
        g.selectionMask = null;
        g.selectionBorder = [];
        window.polyPoints = [];
        window.lassoPoints = [];
        g.drawing = false;
        g.movingSelection = false;
        if (tempCtx) tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);
        renderLayers();
        console.log("Selection cleared (including points)");
    }
}

// Global Key Listener for Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        let handled = false;

        // 1. Cancel drawing if in progress (Poly, Lasso, etc.)
        if (g.drawing) {
            g.drawing = false;
            if (window.polyPoints) window.polyPoints = [];
            if (window.lassoPoints) window.lassoPoints = [];

            // Clear preview border that might have been set during move
            g.selectionBorder = [];

            if (tempCtx) tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);
            renderLayers();
            console.log("Drawing cancelled via Escape");
            handled = true;
        }

        // 2. Clear active selection
        if (g.isSelectionActive) {
            cancelSelection();
            handled = true;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    } else if (e.key === 'Enter') {
        // Finalize Poly/Lasso on Enter
        if (g.drawing) {
            if (g.current_tool === Tool.PolySelect && window.polyPoints && window.polyPoints.length > 2) {
                let mode = "replace";
                if (e.shiftKey) mode = "add";
                if (e.altKey) mode = "subtract";
                if (typeof buildPolygonalSelection === 'function') {
                    buildPolygonalSelection(window.polyPoints, mode);
                }
                window.polyPoints = [];
                g.selectionPreviewBorder = [];
                g.drawing = false;
                if (tempCtx) tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);
                renderLayers();
                console.log("Polygon Selection finalized via Enter");
            } else if (g.current_tool === Tool.Lasso && window.lassoPoints && window.lassoPoints.length > 2) {
                let mode = "replace";
                if (e.shiftKey) mode = "add";
                if (e.altKey) mode = "subtract";
                if (typeof buildLassoSelection === 'function') {
                    // Close loop
                    window.lassoPoints.push({ x: g.pX, y: g.pY });
                    buildLassoSelection(window.lassoPoints, mode);
                }
                window.lassoPoints = [];
                g.selectionPreviewBorder = [];
                g.drawing = false;
                if (tempCtx) tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);
                renderLayers();
                console.log("Lasso Selection finalized via Enter");
            }
        }
    } else if (e.ctrlKey || e.metaKey) {
        // Keyboard Shortcuts
        switch (e.key.toLowerCase()) {
            case 'c':
                if (typeof copySelection === 'function') copySelection();
                e.preventDefault();
                break;
            case 'v':
                if (typeof pasteSelection === 'function') pasteSelection();
                e.preventDefault();
                break;
            case 'x':
                if (typeof cutSelection === 'function') cutSelection();
                e.preventDefault();
                break;
            case 'a':
                if (typeof selectAll === 'function') selectAll();
                e.preventDefault();
                break;
            case 'd':
                if (typeof deselect === 'function') deselect();
                e.preventDefault();
                break;
            case 'i':
                if (e.shiftKey && typeof invertSelection === 'function') {
                    invertSelection();
                    e.preventDefault();
                }
                break;
            case 'z':
                if (e.shiftKey) redoImage();
                else undoImage();
                e.preventDefault();
                break;
            case 'y':
                redoImage();
                e.preventDefault();
                break;
        }
    }
});

// Tool Selection Logic
window.selectTool = function (tool) {
    if (!tool) {
        console.error("selectTool called with undefined tool");
        return;
    }
    g.current_tool = tool;
    window.dispatchEvent(new CustomEvent('toolChanged', { detail: { tool: tool.id } }));

    // Update toolbar UI
    const buttons = document.querySelectorAll('.button');
    buttons.forEach(btn => btn.classList.remove('active', 'selected'));

    if (tool.id) {
        const btn = document.getElementById(tool.id);
        if (btn) {
            btn.classList.add('active');
        }
    }

    // Update Options Bar / Properties Panel
    if (typeof updateOptionsBar === 'function') updateOptionsBar();
    if (window.propertiesPanel && typeof window.propertiesPanel.render === 'function') {
        window.propertiesPanel.render();
    }

    console.log("Tool selected:", tool.name);
};
