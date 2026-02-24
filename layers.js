/**
 * Layer Manager
 * Handles layer operations: add, delete, select, visibility, reorder, render
 */

// ─── Layer Operations ─────────────────────────────────────

/**
 * Add a new layer above the active layer
 */
function addLayer(name) {
    const idx = g.activeLayerIndex + 1;
    const layerName = name || `Layer ${layers.length}`;
    const newLayer = new layer_class(layerName);

    // Check if we want a vector layer (simple check for now, can be expanded)
    if (name && name.toLowerCase().includes('vector')) {
        newLayer.type = 'vector';
        newLayer.shapes = []; // Array to hold shape objects
    }

    layers.splice(idx, 0, newLayer);
    g.activeLayerIndex = idx;

    if (window.historyManager) {
        window.historyManager.push(new LayerAddAction(idx, newLayer));
    }

    renderLayers();
    updateLayerPanel();
    console.log(`Added layer "${layerName}" at index ${idx}`);
}

function addVectorLayer() {
    addLayer("Vector Layer");
}

/**
 * Delete the active layer (prevents deleting the last layer)
 */
function deleteLayer() {
    if (layers.length <= 1) {
        console.warn("Cannot delete the last layer");
        return;
    }
    const layerToDelete = layers[g.activeLayerIndex];
    const index = g.activeLayerIndex;

    const removed = layers.splice(g.activeLayerIndex, 1);

    if (window.historyManager) {
        window.historyManager.push(new LayerDeleteAction(index, layerToDelete));
    }

    console.log(`Deleted layer "${removed[0].name}"`);
    // Adjust active index
    if (g.activeLayerIndex >= layers.length) {
        g.activeLayerIndex = layers.length - 1;
    }
    renderLayers();
    updateLayerPanel();
}

/**
 * Select a layer by index
 */
function selectLayer(index) {
    if (index < 0 || index >= layers.length) {
        console.error(`Layer index ${index} out of range`);
        return;
    }
    g.activeLayerIndex = index;
    updateLayerPanel();
    console.log(`Selected layer "${layers[index].name}" (index ${index})`);
}

/**
 * Toggle visibility of a layer
 */
/**
 * Toggle visibility of a layer
 */
function toggleLayerVisibility(index) {
    if (index < 0 || index >= layers.length) return;

    const oldValue = layers[index].visible;
    layers[index].visible = !layers[index].visible;
    const newValue = layers[index].visible;

    if (window.historyManager) {
        window.historyManager.push(new LayerPropertyAction(index, 'visible', oldValue, newValue));
    }

    renderLayers();
    updateLayerPanel();
}

/**
 * Move a layer from one position to another
 */
function moveLayer(fromIndex, toIndex, skipRecord = false) {
    if (fromIndex < 0 || fromIndex >= layers.length) return;
    if (toIndex < 0 || toIndex >= layers.length) return;

    // Validate indices again after check to prevent errors
    // ...

    if (!skipRecord && window.historyManager) {
        window.historyManager.push(new LayerMoveAction(fromIndex, toIndex));
    }

    const [layer] = layers.splice(fromIndex, 1);
    layers.splice(toIndex, 0, layer);

    // Update active index to follow the moved layer
    if (g.activeLayerIndex === fromIndex) {
        g.activeLayerIndex = toIndex;
    } else if (fromIndex < g.activeLayerIndex && toIndex >= g.activeLayerIndex) {
        g.activeLayerIndex--;
    } else if (fromIndex > g.activeLayerIndex && toIndex <= g.activeLayerIndex) {
        g.activeLayerIndex++;
    }
    renderLayers();
    updateLayerPanel();
}

/**
 * Move active layer up (visually higher = later in array)
 */
function moveLayerUp() {
    if (g.activeLayerIndex < layers.length - 1) {
        moveLayer(g.activeLayerIndex, g.activeLayerIndex + 1);
    }
}

/**
 * Move active layer down (visually lower = earlier in array)
 */
function moveLayerDown() {
    if (g.activeLayerIndex > 0) {
        moveLayer(g.activeLayerIndex, g.activeLayerIndex - 1);
    }
}

/**
 * Rename a layer
 */
function renameLayer(index, newName) {
    if (index < 0 || index >= layers.length) return;

    const oldName = layers[index].name;
    layers[index].name = newName;

    if (window.historyManager && oldName !== newName) {
        window.historyManager.push(new LayerPropertyAction(index, 'name', oldName, newName));
    }

    updateLayerPanel();
}


// ─── Rendering ─────────────────────────────────────────────

/**
 * Composite all visible layers onto the drawing canvas (bottom to top)
 * @param {HTMLCanvasElement} [liveCanvas] - Optional temp canvas for the active layer (used during drawing)
 */
function renderLayers(liveCanvas) {
    if (!ctx) return;

    // Clear the display canvas
    ctx.clearRect(0, 0, g.image_width, g.image_height);

    // Composite each visible layer
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (!layer.visible) continue;

        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode;

        // Draw the permanent layer content (raster pixels)
        ctx.drawImage(layer.canvas, 0, 0);

        // Render shapes for THIS layer (if any exist)
        // This allows raster layers to have vector shapes on top.
        if (layer.shapes && layer.shapes.length > 0) {
            drawShapesToCtx(ctx, layer.shapes);
        }

        // If this is the active layer and we are drawing (liveCanvas exists),
        // draw the temporary stroke ON TOP of everything.
        if (liveCanvas && i === g.activeLayerIndex) {
            ctx.drawImage(liveCanvas, 0, 0);
        }

        ctx.restore();
    }

    // Draw Floating Selection Content (Move Content tool)
    if (g.floatingContent && g.floatingContent.canvas) {
        ctx.save();
        ctx.drawImage(g.floatingContent.canvas, g.floatingContent.x, g.floatingContent.y);
        ctx.restore();
    }

    // Draw Selection Border (Marching Ants) if active
    if (typeof drawSelectionBorder === 'function') {
        drawSelectionBorder(ctx);
    }

    // Also update originalCanvas to match the composite (for tools that read from it)
    if (!liveCanvas && originalCanvas) {
        const origCtx = originalCanvas.getContext("2d");
        origCtx.clearRect(0, 0, g.image_width, g.image_height);
        origCtx.drawImage(ctx.canvas, 0, 0);
    }
}

/**
 * Helper to draw an array of shapes to a specific context.
 */
function drawShapesToCtx(targetCtx, shapes) {
    if (!shapes || shapes.length === 0) return;

    targetCtx.save();
    shapes.forEach(shape => {
        targetCtx.save();

        // Setup style
        const lineWidth = shape.style.width || 1;
        const strokeColor = shape.style.color || '#000';
        targetCtx.lineWidth = lineWidth;
        targetCtx.strokeStyle = strokeColor;
        targetCtx.globalAlpha = shape.style.opacity !== undefined ? shape.style.opacity : 1.0;
        targetCtx.lineCap = shape.style.cap || 'round';

        // Hardness: 1 = sharp edge, 0 = soft (blurred) edge; applied via shadowBlur for vector strokes
        const hardness = shape.style.hardness !== undefined ? shape.style.hardness : 1.0;
        if (hardness < 1.0) {
            const maxBlur = Math.max(2, lineWidth / 2);
            targetCtx.shadowBlur = (1.0 - hardness) * maxBlur;
            targetCtx.shadowColor = strokeColor;
        }

        if (shape.style.fillColor) {
            targetCtx.fillStyle = shape.style.fillColor;
        }

        targetCtx.beginPath();
        switch (shape.type) {
            case 'line':
                targetCtx.moveTo(shape.x1, shape.y1);
                targetCtx.lineTo(shape.x2, shape.y2);
                targetCtx.stroke();
                break;
            case 'rect': {
                const w = shape.x2 - shape.x1;
                const h = shape.y2 - shape.y1;
                targetCtx.rect(shape.x1, shape.y1, w, h);
                if (shape.style.fillColor) targetCtx.fill();
                targetCtx.stroke();
                break;
            }
            case 'circle': {
                const radius = Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1);
                targetCtx.arc(shape.x1, shape.y1, radius, 0, 2 * Math.PI);
                if (shape.style.fillColor) targetCtx.fill();
                targetCtx.stroke();
                break;
            }
            case 'ellipse': {
                const centerX = (shape.x1 + shape.x2) / 2;
                const centerY = (shape.y1 + shape.y2) / 2;
                const radiusX = Math.abs(shape.x2 - shape.x1) / 2;
                const radiusY = Math.abs(shape.y2 - shape.y1) / 2;
                targetCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                if (shape.style.fillColor) targetCtx.fill();
                targetCtx.stroke();
                break;
            }
            case 'roundrect': {
                const rw = shape.x2 - shape.x1;
                const rh = shape.y2 - shape.y1;
                const rr = shape.style.cornerRadius || 10;
                if (typeof targetCtx.roundRect === 'function') {
                    targetCtx.roundRect(shape.x1, shape.y1, rw, rh, rr);
                } else {
                    const x = shape.x1, y = shape.y1, w = rw, h = rh, r = rr;
                    targetCtx.moveTo(x + r, y);
                    targetCtx.lineTo(x + w - r, y);
                    targetCtx.quadraticCurveTo(x + w, y, x + w, y + r);
                    targetCtx.lineTo(x + w, y + h - r);
                    targetCtx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                    targetCtx.lineTo(x + r, y + h);
                    targetCtx.quadraticCurveTo(x, y + h, x, y + h - r);
                    targetCtx.lineTo(x, y + r);
                    targetCtx.quadraticCurveTo(x, y, x + r, y);
                }
                if (shape.style.fillColor) targetCtx.fill();
                targetCtx.stroke();
                break;
            }
        }

        targetCtx.restore();
    });
    targetCtx.restore();
}

/**
 * Get the active layer object
 */
function getActiveLayer() {
    return layers[g.activeLayerIndex] || null;
}

// ─── Layer Panel UI ────────────────────────────────────────

/**
 * Update the Layers panel UI to reflect current layer state
 */
function updateLayerPanel() {
    const layersList = document.querySelector('#layers-pane .layers-list');
    if (!layersList) return;

    layersList.innerHTML = '';

    // Render layers in reverse order (top layer first in the panel)
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const item = document.createElement('div');
        item.className = `layer-item${i === g.activeLayerIndex ? ' selected' : ''}`;
        item.dataset.index = i;

        // Visibility toggle
        const visIcon = document.createElement('span');
        visIcon.className = `layer-icon${layer.visible ? ' active' : ''}`;
        visIcon.title = layer.visible ? 'Visible' : 'Hidden';
        visIcon.textContent = layer.visible ? '👁' : '·';
        visIcon.style.cursor = 'pointer';
        visIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLayerVisibility(i);
        });

        // Thumbnail
        const thumb = document.createElement('div');
        thumb.className = 'layer-thumbnail';
        // Draw a small preview of the layer
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 32;
        thumbCanvas.height = 32;
        const thumbCtx = thumbCanvas.getContext('2d');
        thumbCtx.drawImage(layer.canvas, 0, 0, g.image_width, g.image_height, 0, 0, 32, 32);
        thumb.appendChild(thumbCanvas);

        // Name (editable on double-click)
        const nameDiv = document.createElement('div');
        nameDiv.className = 'layer-name';
        nameDiv.textContent = layer.name;
        nameDiv.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'text';
            input.value = layer.name;
            input.className = 'layer-name-input';
            input.style.cssText = 'width: 100%; font-size: 11px; border: 1px solid #5b9bd5; padding: 1px 3px; background: #fff;';
            nameDiv.replaceWith(input);
            input.focus();
            input.select();
            const finish = () => {
                renameLayer(i, input.value || layer.name);
            };
            input.addEventListener('blur', finish);
            input.addEventListener('keydown', (ke) => {
                if (ke.key === 'Enter') finish();
                if (ke.key === 'Escape') {
                    input.value = layer.name;
                    finish();
                }
            });
        });

        // Lock indicator
        const lockIcon = document.createElement('span');
        lockIcon.className = 'layer-icon';
        lockIcon.title = layer.locked ? 'Locked' : 'Unlocked';
        lockIcon.textContent = layer.locked ? '🔒' : '';
        lockIcon.style.cursor = 'pointer';
        lockIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            layers[i].locked = !layers[i].locked;
            updateLayerPanel();
        });

        // Blend Mode Dropdown
        const blendSelect = document.createElement('select');
        blendSelect.className = 'layer-blend-mode';
        blendSelect.style.cssText = 'font-size: 10px; margin-left: 5px; width: 60px;';

        const modes = [
            'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
            'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
            'exclusion', 'hue', 'saturation', 'color', 'luminosity'
        ];

        // Map internal names to display names if needed (e.g. source-over -> Normal)
        const displayNames = {
            'source-over': 'Normal',
            'color-dodge': 'Color Dodge',
            'color-burn': 'Color Burn',
            'hard-light': 'Hard Light',
            'soft-light': 'Soft Light'
        };

        modes.forEach(mode => {
            const option = document.createElement('option');
            option.value = mode;
            option.textContent = displayNames[mode] || mode.charAt(0).toUpperCase() + mode.slice(1);
            if (layer.blendMode === mode) option.selected = true;
            blendSelect.appendChild(option);
        });


        // CRITICAL FIX: Stop all mouse events from bubbling
        // This prevents the layer item from catching the click/mousedown
        // and triggering a panel rebuild which destroys this dropdown.
        const stopProp = (e) => e.stopPropagation();
        blendSelect.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            // Capture initial value for history
            blendSelect.dataset.startValue = layers[i].blendMode;
        });
        blendSelect.addEventListener('mouseup', stopProp);
        blendSelect.addEventListener('click', stopProp);

        // Handle change
        blendSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            const newValue = e.target.value;
            const startValue = blendSelect.dataset.startValue || layers[i].blendMode;

            if (window.historyManager && startValue !== newValue) {
                window.historyManager.push(new LayerPropertyAction(i, 'blendMode', startValue, newValue));
            }

            layers[i].blendMode = newValue;
            renderLayers();
        });


        // Click to select layer
        item.addEventListener('click', () => {
            selectLayer(i);
        });

        item.appendChild(visIcon);
        item.appendChild(thumb);
        item.appendChild(nameDiv);
        item.appendChild(blendSelect); // Add dropdown
        item.appendChild(lockIcon);
        layersList.appendChild(item);
    }

    // Update layer opacity slider if it exists
    const layerOpacitySlider = document.getElementById('layerOpacity');
    if (layerOpacitySlider) {
        layerOpacitySlider.value = Math.round(layers[g.activeLayerIndex].opacity * 100);
    }
}

// ─── Initialization ────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    // Wire up layer panel buttons
    const addLayerBtn = document.querySelector('.panel-footer-btn[title="Add Layer"]');
    const deleteLayerBtn = document.querySelector('.panel-footer-btn[title="Delete Layer"]');
    const moveUpBtn = document.querySelector('.panel-footer-btn[title="Move Up"]');
    const moveDownBtn = document.querySelector('.panel-footer-btn[title="Move Down"]');

    if (addLayerBtn) {
        addLayerBtn.addEventListener('click', () => addLayer());
    }
    if (deleteLayerBtn) {
        deleteLayerBtn.addEventListener('click', () => deleteLayer());
    }
    if (moveUpBtn) {
        moveUpBtn.addEventListener('click', () => moveLayerUp());
    }
    if (moveDownBtn) {
        moveDownBtn.addEventListener('click', () => moveLayerDown());
    }

    // Layer Opacity Slider
    const layerOpacitySlider = document.getElementById('layerOpacity');
    if (layerOpacitySlider) {
        layerOpacitySlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            const layer = layers[g.activeLayerIndex];
            if (layer) {
                // Optimization: Don't push history on every pixel drag, only on change (mouseup)
                // But range input fires 'change' on commit.
                // let's use 'change' for history, 'input' for live preview.
                layer.opacity = val / 100;
                renderLayers();
            }
        });

        layerOpacitySlider.addEventListener('change', (e) => {
            // Record history
            const val = parseInt(e.target.value);
            const layer = layers[g.activeLayerIndex];
            // We need old value. But we already updated it in 'input'.
            // So we need to store initial value on 'mousedown'?
            // Or just simple implementation: record the change.
            // Issue: 'input' already changed the state.
            // Solution: Capture State on 'focus'? Range inputs are tricky.

            // Alternate: Just record it. But we need 'oldValue'.
            // Let's assume the previous value was... unknown?
            // Maybe we should track 'startValue' on mousedown.
        });

        let startOpacity = 1.0;
        layerOpacitySlider.addEventListener('mousedown', () => {
            const layer = layers[g.activeLayerIndex];
            if (layer) startOpacity = layer.opacity;
        });

        layerOpacitySlider.addEventListener('change', (e) => {
            const layer = layers[g.activeLayerIndex];
            if (layer && window.historyManager) {
                window.historyManager.push(new LayerPropertyAction(g.activeLayerIndex, 'opacity', startOpacity, layer.opacity));
            }
        });
    }

    // Initial render of the layer panel
    // Small delay to ensure canvas is initialized
    setTimeout(() => {
        updateLayerPanel();
    }, 100);

    console.log('Layers manager initialized');
});

// Export for global access
if (typeof window !== 'undefined') {
    window.addLayer = addLayer;
    window.addVectorLayer = addVectorLayer;
    window.deleteLayer = deleteLayer;
    window.selectLayer = selectLayer;
    window.toggleLayerVisibility = toggleLayerVisibility;
    window.moveLayer = moveLayer;
    window.moveLayerUp = moveLayerUp;
    window.moveLayerDown = moveLayerDown;
    window.renameLayer = renameLayer;
    window.renderLayers = renderLayers;
    window.getActiveLayer = getActiveLayer;
    window.updateLayerPanel = updateLayerPanel;
    window.renderTextLayer = renderTextLayer;
    window.renderVectorLayer = renderVectorLayer;
}

function renderVectorLayer(layer) {
    if (!layer) return;

    // For vector layers, we use their canvas as a cache for the shapes.
    // For raster layers, we DON'T clear their canvas, and renderLayers will draw shapes on top of the main canvas.
    if (layer.type === 'vector') {
        const ctx = layer.ctx;
        ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        drawShapesToCtx(ctx, layer.shapes);
    }
}

function renderTextLayer(layer) {
    if (!layer || layer.type !== 'text') return;

    const ctx = layer.ctx;
    const data = layer.textData;

    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);

    if (layer.isBeingEdited) return; // Hide text while editing to avoid ghosting


    ctx.save();
    const style = data.italic ? 'italic' : 'normal';
    const weight = data.bold ? 'bold' : 'normal';
    ctx.font = `${style} ${weight} ${data.size}px ${data.font}, "Roboto", sans-serif`;
    ctx.fillStyle = data.color;
    ctx.textBaseline = 'top';

    const lines = (data.text || "").split('\n');
    const lineHeight = data.size * 1.2;

    lines.forEach((line, index) => {
        ctx.fillText(line, data.x, data.y + (index * lineHeight));
    });
    ctx.restore();
}
