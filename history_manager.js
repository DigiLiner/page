/**
 * History Manager
 * Handles robust undo/redo system with action-based history.
 */

class HistoryManager {
    constructor(maxSteps = 50) {
        this.actions = [];
        this.currentIndex = -1; // -1 means initial state (Open)
        this.maxSteps = maxSteps;
    }

    /**
     * Record a new action
     * @param {Object} action - Action object with undo() and redo() methods
     */
    push(action) {
        // BRANCHING: If we were in the past, discard subsequent actions
        if (this.currentIndex < this.actions.length - 1) {
            this.actions = this.actions.slice(0, this.currentIndex + 1);
        }

        this.actions.push(action);
        this.currentIndex++;

        if (this.actions.length > this.maxSteps) {
            this.actions.shift();
            this.currentIndex--;
        }

        this.updateUI();
    }

    undo() {
        if (this.currentIndex < 0) return;
        const action = this.actions[this.currentIndex];
        console.log(`Undo: ${action.name}`);
        action.undo();
        this.currentIndex--;
        this.updateUI();
    }

    redo() {
        if (this.currentIndex >= this.actions.length - 1) return;
        this.currentIndex++;
        const action = this.actions[this.currentIndex];
        console.log(`Redo: ${action.name}`);
        action.redo();
        this.updateUI();
    }

    jumpTo(targetIndex) {
        // targetIndex is the index in this.actions (-1 to actions.length-1)
        if (targetIndex === this.currentIndex) return;

        if (targetIndex < this.currentIndex) {
            // Move backwards
            while (this.currentIndex > targetIndex) {
                this.undo();
            }
        } else {
            // Move forwards
            while (this.currentIndex < targetIndex) {
                this.redo();
            }
        }
    }

    clear() {
        this.actions = [];
        this.currentIndex = -1;
        this.updateUI();
    }

    updateUI() {
        const pane = document.getElementById('history-pane');
        if (!pane) return;

        const list = pane.querySelector('.history-list');
        if (!list) return;

        list.innerHTML = '';

        // Initial "Open" state
        const openItem = document.createElement('div');
        openItem.className = 'history-item' + (this.currentIndex === -1 ? ' active' : '');
        openItem.innerHTML = `
            <div class="history-item-icon">📝</div>
            <div class="history-item-text">Open</div>
        `;
        openItem.onclick = () => this.jumpTo(-1);
        list.appendChild(openItem);

        // Add actions
        this.actions.forEach((action, index) => {
            const item = document.createElement('div');
            // Items past currentIndex are "ghosted" (dimmed)
            const isPast = index > this.currentIndex;
            item.className = 'history-item' +
                (index === this.currentIndex ? ' active' : '') +
                (isPast ? ' ghosted' : '');

            if (isPast) item.style.opacity = '0.5';

            let icon = '⚡';
            if (action.name.includes('Draw')) icon = '✏️';
            if (action.name.includes('Layer')) icon = '📄';
            if (action.name.includes('Vector')) icon = '🔷';
            if (action.name.includes('Property')) icon = '⚙️';
            if (action.name.includes('Add')) icon = '➕';
            if (action.name.includes('Edit')) icon = '📝';

            item.innerHTML = `
                <div class="history-item-icon">${icon}</div>
                <div class="history-item-text">${action.name}</div>
            `;

            item.onclick = () => this.jumpTo(index);
            list.appendChild(item);
        });

        // Scroll active item into view
        const activeItem = list.querySelector('.history-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
}

// ─── Actions ─────────────────────────────────────────────────

class DrawAction {
    constructor(layerIndex, previousImageData, newImageData, rect) {
        this.name = "Draw";
        this.layerIndex = layerIndex;
        // Optimization: In a real app, we might store only the dirty rect
        // For now, we'll store the full layer content or a patch
        // To be safe and simple, let's store the ImageData of the whole layer
        // or just the affected area. 
        // Given existing architecture, let's store the full ImageData for now to ensure correctness,
        // unless performance is terrible. 500x500 is small. 4K is big.
        this.previousImageData = previousImageData;
        this.newImageData = newImageData;
    }

    undo() {
        const layer = layers[this.layerIndex];
        if (layer) {
            layer.ctx.putImageData(this.previousImageData, 0, 0);
            renderLayers();
            if (typeof updateLayerPanel === 'function') updateLayerPanel();
        }
    }

    redo() {
        const layer = layers[this.layerIndex];
        if (layer) {
            layer.ctx.putImageData(this.newImageData, 0, 0);
            renderLayers();
            if (typeof updateLayerPanel === 'function') updateLayerPanel();
        }
    }
}

class LayerAddAction {
    constructor(layerIndex, layerData) {
        this.name = "Add Layer";
        this.layerIndex = layerIndex;
        this.layerData = layerData; // The layer object itself
    }

    undo() {
        // Remove the layer
        layers.splice(this.layerIndex, 1);
        // Correct active index if needed
        if (g.activeLayerIndex >= layers.length) {
            g.activeLayerIndex = Math.max(0, layers.length - 1);
        }
        renderLayers();
        updateLayerPanel();
    }

    redo() {
        // Restore the layer
        layers.splice(this.layerIndex, 0, this.layerData);
        g.activeLayerIndex = this.layerIndex;
        renderLayers();
        updateLayerPanel();
    }
}

class LayerDeleteAction {
    constructor(layerIndex, layerData) {
        this.name = "Delete Layer";
        this.layerIndex = layerIndex;
        this.layerData = layerData;
    }

    undo() {
        // Restore the layer
        layers.splice(this.layerIndex, 0, this.layerData);
        g.activeLayerIndex = this.layerIndex;
        renderLayers();
        updateLayerPanel();
    }

    redo() {
        // Delete the layer
        layers.splice(this.layerIndex, 1);
        if (g.activeLayerIndex >= layers.length) {
            g.activeLayerIndex = Math.max(0, layers.length - 1);
        }
        renderLayers();
        updateLayerPanel();
    }
}

class LayerMoveAction {
    constructor(fromIndex, toIndex) {
        this.name = "Move Layer";
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
    }

    undo() {
        // Move back: to -> from
        moveLayer(this.toIndex, this.fromIndex, true); // Pass flag to skip history recording
    }

    redo() {
        moveLayer(this.fromIndex, this.toIndex, true);
    }
}

class LayerPropertyAction {
    constructor(layerIndex, property, oldValue, newValue) {
        this.name = `Change ${property}`;
        this.layerIndex = layerIndex;
        this.property = property;
        this.oldValue = oldValue;
        this.newValue = newValue;
    }

    undo() {
        const layer = layers[this.layerIndex];
        if (layer) {
            layer[this.property] = this.oldValue;
            renderLayers();
            updateLayerPanel();
        }
    }

    redo() {
        const layer = layers[this.layerIndex];
        if (layer) {
            layer[this.property] = this.newValue;
            renderLayers();
            updateLayerPanel();
        }
    }
}

class VectorAddAction {
    constructor(layerIndex, shape) {
        this.name = `Add ${shape.type.charAt(0).toUpperCase() + shape.type.slice(1)}`;
        this.layerIndex = layerIndex;
        this.shape = JSON.parse(JSON.stringify(shape));
    }

    undo() {
        const layer = layers[this.layerIndex];
        if (layer && layer.shapes) {
            // Remove last shape
            layer.shapes.pop();
            renderVectorLayer(layer);
            renderLayers();
        }
    }

    redo() {
        const layer = layers[this.layerIndex];
        if (layer) {
            if (!layer.shapes) layer.shapes = [];
            layer.shapes.push(JSON.parse(JSON.stringify(this.shape)));
            renderVectorLayer(layer);
            renderLayers();
        }
    }
}

class VectorEditAction {
    constructor(layerIndex, shapeIndex, oldShape, newShape) {
        this.name = `Edit ${newShape.type.charAt(0).toUpperCase() + newShape.type.slice(1)}`;
        this.layerIndex = layerIndex;
        this.shapeIndex = shapeIndex;
        this.oldShape = JSON.parse(JSON.stringify(oldShape));
        this.newShape = JSON.parse(JSON.stringify(newShape));
    }

    undo() {
        const layer = layers[this.layerIndex];
        if (layer && layer.shapes && layer.shapes[this.shapeIndex]) {
            layer.shapes[this.shapeIndex] = JSON.parse(JSON.stringify(this.oldShape));
            renderVectorLayer(layer);
            renderLayers();
        }
    }

    redo() {
        const layer = layers[this.layerIndex];
        if (layer && layer.shapes && layer.shapes[this.shapeIndex]) {
            layer.shapes[this.shapeIndex] = JSON.parse(JSON.stringify(this.newShape));
            renderVectorLayer(layer);
            renderLayers();
        }
    }
}

// Global instance
if (typeof window !== 'undefined') {
    window.historyManager = new HistoryManager();
    window.DrawAction = DrawAction;
    window.LayerAddAction = LayerAddAction;
    window.LayerDeleteAction = LayerDeleteAction;
    window.LayerMoveAction = LayerMoveAction;
    window.LayerPropertyAction = LayerPropertyAction;
    window.VectorAddAction = VectorAddAction;
    window.VectorEditAction = VectorEditAction;
}
