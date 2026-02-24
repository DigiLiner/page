class VectorToolManager {
    constructor() {
        this.isDrawing = false;
        this.isEditing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentShape = null;
        this.activeLayerIndex = -1;
        this.selectedShapeIndex = -1;

        // Overlay properties
        this.overlay = null;
        this.controls = null;
        this.isDraggingOverlay = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.editStartX = 0;
        this.editStartY = 0;
        this.dragStartLeft = 0;
        this.dragStartTop = 0;

        // Warning Overlay
        this.warningElement = null;
        this.isWarningVisible = false;

        this.init();
    }

    init() {
        this.bindMethods();
        this.attachListeners();
        this.createOverlayUI();
        this.createWarningUI();
        this.attachPropertyListeners();
        console.log("Vector Tool Manager Initialized");
    }

    bindMethods() {
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.onDragStart = this.onDragStart.bind(this);
        this.onDragMove = this.onDragMove.bind(this);
        this.onDragEnd = this.onDragEnd.bind(this);
        this.commitEdit = this.commitEdit.bind(this);
        this.cancelEdit = this.cancelEdit.bind(this);
        this.handlePropertyChange = this.handlePropertyChange.bind(this);
        this.onResizeStart = this.onResizeStart.bind(this);
        this.onResizeMove = this.onResizeMove.bind(this);
        this.onResizeEnd = this.onResizeEnd.bind(this);
    }

    attachPropertyListeners() {
        window.addEventListener('colorChanged', (e) => this.handlePropertyChange('color', e.detail.color));
        window.addEventListener('syncOpacity', (e) => this.handlePropertyChange('opacity', parseFloat(e.detail.value) / 100));
        window.addEventListener('penWidthChanged', (e) => this.handlePropertyChange('width', e.detail.value));
        window.addEventListener('hardnessChanged', (e) => this.handlePropertyChange('hardness', e.detail.value));
        window.addEventListener('cornerRadiusChanged', (e) => this.handlePropertyChange('cornerRadius', e.detail.value));
        window.addEventListener('toolChanged', (e) => {
            if (this.isEditing && e.detail.tool !== Tool.VectorSelect.id) {
                this.commitEdit();
            }
            if (e.detail.tool === Tool.VectorSelect.id && !this.isEditing) {
                this.notifyVectorSelectionChanged(false);
            }
        });
    }

    notifyVectorSelectionChanged(hasSelection, shapeType, style) {
        window.vectorSelection = { hasSelection, shapeType: shapeType || null, style: style || null };
        window.dispatchEvent(new CustomEvent('vectorShapeSelectionChanged', {
            detail: { hasSelection, shapeType: shapeType || null, style: style || null }
        }));
    }

    handlePropertyChange(prop, value) {
        if (!this.isEditing || this.selectedShapeIndex === -1) return;
        const layer = getActiveLayer();
        if (!layer) return;
        const shape = layer.shapes[this.selectedShapeIndex];
        if (shape) {
            shape.style[prop] = value;
            renderVectorLayer(layer);
            renderLayers();
        }
    }

    attachListeners() {
        const canvas = document.getElementById('drawingCanvas');
        if (canvas) {
            // CRITICAL: Use capture phase AND stopImmediatePropagation to fully intercept events
            canvas.addEventListener('mousedown', this.handleMouseDown, true);
            canvas.addEventListener('mousemove', this.handleMouseMove, true);
            canvas.addEventListener('mouseup', this.handleMouseUp, true);

            // Global mouse move for warning follow
            document.addEventListener('mousemove', (e) => this.updateWarningPosition(e));
        }
    }

    createWarningUI() {
        this.warningElement = document.createElement('div');
        this.warningElement.id = 'vectorToolWarning';
        this.warningElement.style.cssText = `
            position: fixed;
            pointer-events: none;
            display: none;
            z-index: 9999;
            background: rgba(220, 53, 69, 0.9);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            white-space: nowrap;
        `;

        const img = document.createElement('img');
        img.src = 'resources/themes/ie_color/circledwarning.svg';
        img.style.width = '16px';
        img.style.height = '16px';

        const text = document.createElement('span');
        text.innerText = 'Vector tool on Raster layer!';

        this.warningElement.appendChild(img);
        this.warningElement.appendChild(text);
        document.body.appendChild(this.warningElement);
    }

    updateWarningPosition(e) {
        if (!this.isWarningVisible) return;
        this.warningElement.style.left = (e.clientX + 15) + 'px';
        this.warningElement.style.top = (e.clientY + 15) + 'px';
    }

    showWarning(show, text = '', type = 'error') {
        this.isWarningVisible = show;
        this.warningElement.style.display = show ? 'flex' : 'none';

        if (show) {
            const textEl = this.warningElement.querySelector('span');
            if (textEl) textEl.innerText = text;

            if (type === 'warning') {
                this.warningElement.style.background = 'rgba(255, 193, 7, 0.95)'; // Yellow
                this.warningElement.style.color = '#000'; // Black text
            } else {
                this.warningElement.style.background = 'rgba(220, 53, 69, 0.9)'; // Red
                this.warningElement.style.color = '#fff'; // White text
            }
        }
    }

    createOverlayUI() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'vectorToolOverlay';
        this.overlay.style.cssText = `
            position: absolute;
            border: 1px dashed #0078d7;
            pointer-events: none;
            display: none;
            z-index: 1000;
            cursor: move;
        `;

        this.controls = document.createElement('div');
        this.controls.style.cssText = `
            position: absolute;
            top: -30px;
            left: 0;
            display: flex;
            gap: 4px;
            pointer-events: auto;
        `;

        const dragHandle = document.createElement('div');
        dragHandle.innerHTML = '✛ Move';
        dragHandle.style.cssText = 'background: #333; color: #fff; padding: 4px 8px; font-size: 11px; cursor: move; border-radius: 3px;';
        dragHandle.addEventListener('mousedown', this.onDragStart);

        const okBtn = document.createElement('div');
        okBtn.innerHTML = '✓';
        okBtn.style.cssText = 'background: #28a745; color: #fff; padding: 4px 8px; cursor: pointer; border-radius: 3px;';
        okBtn.onclick = this.commitEdit;

        const cancelBtn = document.createElement('div');
        cancelBtn.innerHTML = '✕';
        cancelBtn.style.cssText = 'background: #dc3545; color: #fff; padding: 4px 8px; cursor: pointer; border-radius: 3px;';
        cancelBtn.onclick = this.cancelEdit;

        this.controls.appendChild(dragHandle);
        this.controls.appendChild(okBtn);
        this.controls.appendChild(cancelBtn);
        this.overlay.appendChild(this.controls);

        // Add 8 Resizing Handles
        this.handles = {};
        const handlePositions = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
        handlePositions.forEach(pos => {
            const h = document.createElement('div');
            h.className = `vector-handle handle-${pos}`;
            h.style.cssText = `
                position: absolute;
                width: 8px;
                height: 8px;
                background: #fff;
                border: 1px solid #0078d7;
                pointer-events: auto;
                z-index: 1001;
            `;
            // Position handles
            if (pos.includes('n')) h.style.top = '-4px';
            if (pos.includes('s')) h.style.top = 'calc(100% - 4px)';
            if (pos.includes('w')) h.style.left = '-4px';
            if (pos.includes('e')) h.style.left = 'calc(100% - 4px)';
            if (!pos.includes('n') && !pos.includes('s')) h.style.top = 'calc(50% - 4px)';
            if (!pos.includes('w') && !pos.includes('e')) h.style.left = 'calc(50% - 4px)';

            // Cursor
            const cursorMap = { 'nw': 'nwse-resize', 'se': 'nwse-resize', 'ne': 'nesw-resize', 'sw': 'nesw-resize', 'n': 'ns-resize', 's': 'ns-resize', 'e': 'ew-resize', 'w': 'ew-resize' };
            h.style.cursor = cursorMap[pos];

            h.addEventListener('mousedown', (e) => this.onResizeStart(e, pos));
            this.overlay.appendChild(h);
            this.handles[pos] = h;
        });

        const wrapper = document.getElementById('canvasWrapper');
        if (wrapper) {
            wrapper.appendChild(this.overlay);
        }
    }

    onResizeStart(e, pos) {
        e.preventDefault();
        e.stopPropagation();
        this.isResizing = true;
        this.resizeDir = pos;
        this.resizeStartX = e.clientX;
        this.resizeStartY = e.clientY;

        const layer = getActiveLayer();
        const shape = layer.shapes[this.selectedShapeIndex];
        this.resizeStartShape = JSON.parse(JSON.stringify(shape));

        document.addEventListener('mousemove', this.onResizeMove);
        document.addEventListener('mouseup', this.onResizeEnd);
    }

    onResizeMove(e) {
        if (!this.isResizing) return;
        const dx = (e.clientX - this.resizeStartX) / g.zoom;
        const dy = (e.clientY - this.resizeStartY) / g.zoom;

        const layer = getActiveLayer();
        const shape = layer.shapes[this.selectedShapeIndex];
        const s = this.resizeStartShape;

        // Bounding box: min(x1,x2), max(x1,x2)
        // For simplicity, we assume x1,y1 is start and x2,y2 is end of the diagonal for rect/circle
        // This resize logic will modify x1,y1 or x2,y2 based on which handle is dragged.

        if (this.resizeDir.includes('w')) {
            if (s.x1 < s.x2) shape.x1 = s.x1 + dx; else shape.x2 = s.x2 + dx;
        }
        if (this.resizeDir.includes('e')) {
            if (s.x1 < s.x2) shape.x2 = s.x2 + dx; else shape.x1 = s.x1 + dx;
        }
        if (this.resizeDir.includes('n')) {
            if (s.y1 < s.y2) shape.y1 = s.y1 + dy; else shape.y2 = s.y2 + dy;
        }
        if (this.resizeDir.includes('s')) {
            if (s.y1 < s.y2) shape.y2 = s.y2 + dy; else shape.y1 = s.y1 + dy;
        }

        this.updateOverlayPosition(shape);
        renderVectorLayer(layer);
        renderLayers();
    }

    onResizeEnd() {
        this.isResizing = false;
        document.removeEventListener('mousemove', this.onResizeMove);
        document.removeEventListener('mouseup', this.onResizeEnd);
    }

    isVectorTool(tool) {
        return [Tool.Line, Tool.Rectangle, Tool.Circle, Tool.Ellipse, Tool.Rounded_Rectangle, Tool.Wand].includes(tool);
    }

    handleMouseDown(e) {
        // PRIORITY: Pan tool or Middle Click (ALLOW TO PROPAGATE)
        if (g.current_tool === Tool.Pan || e.button === 1) {
            return;
        }

        const activeLayer = getActiveLayer();
        if (!activeLayer) return;

        // PREVENTION: Raster tools on Vector Layer (STILL BLOCKED + RED WARNING)
        if (activeLayer.type === 'vector' && !this.isVectorTool(g.current_tool) && g.current_tool !== Tool.VectorSelect && g.current_tool !== Tool.Pan) {
            e.stopImmediatePropagation();
            e.preventDefault();
            this.showWarning(true, 'Raster tools blocked on Vector layer!', 'error');
            return;
        }

        // Special case: Magic Wand is handled by drawing_canvas.js, don't intercept here
        if (g.current_tool === Tool.Wand) {
            return;
        }

        // PREVENTION: Vector tools on non-vector Layer (ALLOW BUT YELLOW WARNING)
        // We let it pass through to the vector manager logic below

        if (activeLayer.type !== 'vector' && !this.isVectorTool(g.current_tool) && g.current_tool !== Tool.VectorSelect) return;

        const rect = e.target.getBoundingClientRect();
        const x = (e.clientX - rect.left) / g.zoom;
        const y = (e.clientY - rect.top) / g.zoom;

        // If currently editing, ignore canvas clicks unless it's outside
        if (this.isEditing) {
            // If click is not in controls, maybe commit? 
            // For now, let other handlers manage or just check hit
            if (this.controls.contains(e.target)) return;
        }

        if (this.isVectorTool(g.current_tool)) {
            if (this.isEditing) this.commitEdit();

            // STOP DOM BRANCH FROM DRAWING RASTER
            e.stopImmediatePropagation();
            e.preventDefault();

            this.isDrawing = true;
            this.startX = x;
            this.startY = y;
            this.activeLayerIndex = g.activeLayerIndex;

            this.currentShape = {
                type: this.getShapeTypeFromTool(g.current_tool),
                x1: x, y1: y, x2: x, y2: y,
                style: {
                    color: g.pen_color,
                    width: g.pen_width,
                    opacity: g.pen_opacity,
                    cap: g.pen_cap,
                    hardness: g.brush_hardness || 1.0,
                    cornerRadius: g.round_rect_corner_radius || 10
                }
            };
        } else if (g.current_tool === Tool.VectorSelect) {
            // Check for hit detection to edit existing shapes
            const hitIndex = this.hitTestShapes(activeLayer, x, y);
            if (hitIndex !== -1) {
                if (this.isEditing && this.selectedShapeIndex === hitIndex) return;
                if (this.isEditing) this.commitEdit();

                e.stopImmediatePropagation();
                e.preventDefault();
                this.startEditing(activeLayer, hitIndex);
            } else if (this.isEditing) {
                this.commitEdit();
            }
        } else if (this.isEditing) {
            // Auto-commit on click with other tools
            this.commitEdit();
        }
    }

    handleMouseMove(e) {
        // Warning Tooltip Check
        const activeLayer = getActiveLayer();
        const isVectorTool = this.isVectorTool(g.current_tool) || g.current_tool === Tool.VectorSelect;

        if (activeLayer) {
            if (activeLayer.type !== 'vector' && isVectorTool && g.current_tool !== Tool.Wand) {
                this.showWarning(true, 'Vector tool on Raster layer!', 'warning');
            } else if (activeLayer.type === 'vector' && !isVectorTool && g.current_tool !== Tool.Pan) {
                this.showWarning(true, 'Raster tool blocked on Vector layer!', 'error');
            } else {
                this.showWarning(false);
            }
        } else {
            this.showWarning(false);
        }

        if (this.isDrawing) {
            e.stopImmediatePropagation();
            const rect = e.target.getBoundingClientRect();
            const x = (e.clientX - rect.left) / g.zoom;
            const y = (e.clientY - rect.top) / g.zoom;

            this.currentShape.x2 = x;
            this.currentShape.y2 = y;

            this.renderPreview(getActiveLayer());
        }
    }

    handleMouseUp(e) {
        if (this.isDrawing) {
            e.stopImmediatePropagation();
            this.isDrawing = false;
            if (this.currentShape) {
                const layer = layers[this.activeLayerIndex];
                if (layer) {
                    if (!layer.shapes) layer.shapes = [];
                    layer.shapes.push(this.currentShape);

                    // RECORD HISTORY
                    if (window.historyManager) {
                        window.historyManager.push(new VectorAddAction(this.activeLayerIndex, this.currentShape));
                    }

                    renderVectorLayer(layer);
                    renderLayers();
                }
            }
            this.currentShape = null;
        }
    }

    hitTestShapes(layer, x, y) {
        const shapes = layer.shapes || [];
        // Iterate backwards (top shapes first)
        for (let i = shapes.length - 1; i >= 0; i--) {
            if (this.isHit(shapes[i], x, y)) return i;
        }
        return -1;
    }

    isHit(shape, x, y) {
        const threshold = 5 / g.zoom;
        const xMin = Math.min(shape.x1, shape.x2);
        const xMax = Math.max(shape.x1, shape.x2);
        const yMin = Math.min(shape.y1, shape.y2);
        const yMax = Math.max(shape.y1, shape.y2);

        switch (shape.type) {
            case 'line':
                return this.distToSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2) < threshold;
            case 'rect':
                return x >= xMin - threshold && x <= xMax + threshold &&
                    y >= yMin - threshold && y <= yMax + threshold;
            case 'circle':
                const distOffset = 5 / g.zoom; // Extra tolerance for circle stroke
                const dist = Math.hypot(x - shape.x1, y - shape.y1);
                const radius = Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1);
                return Math.abs(dist - radius) < distOffset || dist < radius;
            case 'ellipse':
                const centerX = (shape.x1 + shape.x2) / 2;
                const centerY = (shape.y1 + shape.y2) / 2;
                const rx = Math.abs(shape.x2 - shape.x1) / 2;
                const ry = Math.abs(shape.y2 - shape.y1) / 2;
                const term1 = Math.pow(x - centerX, 2) / Math.pow(rx || 1, 2);
                const term2 = Math.pow(y - centerY, 2) / Math.pow(ry || 1, 2);
                return (term1 + term2) <= 1.2;
            case 'roundrect':
                return x >= xMin - threshold && x <= xMax + threshold &&
                    y >= yMin - threshold && y <= yMax + threshold;
        }
        return false;
    }

    distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }

    startEditing(layer, index) {
        this.isEditing = true;
        this.selectedShapeIndex = index;
        const shape = layer.shapes[index];

        // Sync global values so properties panel shows current shape settings
        if (shape.style) {
            if (shape.style.width) g.pen_width = shape.style.width;
            if (shape.style.color) g.pen_color = shape.style.color;
            if (shape.style.opacity !== undefined) g.pen_opacity = shape.style.opacity;
            if (shape.style.hardness !== undefined) g.brush_hardness = shape.style.hardness;
            if (shape.style.cornerRadius !== undefined) g.round_rect_corner_radius = shape.style.cornerRadius;
        }
        this.notifyVectorSelectionChanged(true, shape.type, shape.style);

        // Backup for Cancel
        this.originalShape = JSON.parse(JSON.stringify(shape));

        this.updateOverlayPosition(shape);
        this.overlay.style.display = 'block';

        renderLayers();
    }

    updateOverlayPosition(shape) {
        let x1 = shape.x1, y1 = shape.y1, x2 = shape.x2, y2 = shape.y2;

        if (shape.type === 'circle') {
            const radius = Math.hypot(x2 - x1, y2 - y1);
            x1 = shape.x1 - radius;
            y1 = shape.y1 - radius;
            x2 = shape.x1 + radius;
            y2 = shape.y1 + radius;
        }

        const xMin = Math.min(x1, x2);
        const yMin = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        this.editStartX = xMin * g.zoom;
        this.editStartY = yMin * g.zoom;
        this.overlay.style.left = this.editStartX + 'px';
        this.overlay.style.top = this.editStartY + 'px';
        this.overlay.style.width = (width * g.zoom) + 'px';
        this.overlay.style.height = (height * g.zoom) + 'px';
    }

    onDragStart(e) {
        this.isDraggingOverlay = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        const layer = getActiveLayer();
        const shape = layer.shapes[this.selectedShapeIndex];
        this.dragStartShapeX1 = shape.x1;
        this.dragStartShapeY1 = shape.y1;
        this.dragStartShapeX2 = shape.x2;
        this.dragStartShapeY2 = shape.y2;

        document.addEventListener('mousemove', this.onDragMove);
        document.addEventListener('mouseup', this.onDragEnd);
        e.stopPropagation();
    }

    onDragMove(e) {
        if (!this.isDraggingOverlay) return;
        const dx = (e.clientX - this.dragStartX) / g.zoom;
        const dy = (e.clientY - this.dragStartY) / g.zoom;

        const layer = getActiveLayer();
        const shape = layer.shapes[this.selectedShapeIndex];

        shape.x1 = this.dragStartShapeX1 + dx;
        shape.y1 = this.dragStartShapeY1 + dy;
        shape.x2 = this.dragStartShapeX2 + dx;
        shape.y2 = this.dragStartShapeY2 + dy;

        this.updateOverlayPosition(shape);
        renderVectorLayer(layer);
        renderLayers();
    }

    onDragEnd() {
        this.isDraggingOverlay = false;
        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.onDragEnd);
    }

    commitEdit() {
        if (!this.isEditing) return;

        const layer = getActiveLayer();
        const shape = layer.shapes[this.selectedShapeIndex];

        // RECORD HISTORY if changed
        if (window.historyManager && this.originalShape) {
            const hasChanged = JSON.stringify(shape) !== JSON.stringify(this.originalShape);
            if (hasChanged) {
                window.historyManager.push(new VectorEditAction(g.activeLayerIndex, this.selectedShapeIndex, this.originalShape, shape));
            }
        }

        this.finishEdit();
    }

    cancelEdit() {
        const layer = getActiveLayer();
        if (layer && this.selectedShapeIndex !== -1 && this.originalShape) {
            layer.shapes[this.selectedShapeIndex] = this.originalShape;
        }
        this.finishEdit();
    }

    finishEdit() {
        this.isEditing = false;
        this.selectedShapeIndex = -1;
        this.overlay.style.display = 'none';
        this.notifyVectorSelectionChanged(false);
        renderVectorLayer(getActiveLayer());
        renderLayers();
    }

    getShapeTypeFromTool(tool) {
        switch (tool) {
            case Tool.Line: return 'line';
            case Tool.Rectangle: return 'rect';
            case Tool.Circle: return 'circle';
            case Tool.Ellipse: return 'ellipse';
            case Tool.Rounded_Rectangle: return 'roundrect';
            default: return 'rect';
        }
    }

    renderPreview(layer) {
        if (typeof tempCanvas === 'undefined' || typeof tempCtx === 'undefined') return;

        // Clear temp canvas
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw the single current shape to temp canvas for live preview
        if (typeof drawShapesToCtx === 'function') {
            drawShapesToCtx(tempCtx, [this.currentShape]);
        }

        // Render everything with tempCanvas on top
        renderLayers(tempCanvas);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.vectorToolManager = new VectorToolManager();
    window.vectorSelection = window.vectorSelection || { hasSelection: false, shapeType: null, style: null };
});

