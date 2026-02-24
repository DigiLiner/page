/**
 * Project File I/O
 * Handles specific .hcie file format (JSON based)
 * Saves/Loads: Layers, Opacity, Blend Modes, Visibility, Canvas Size
 */

class ProjectIO {
    static async saveProject() {
        const project = {
            version: 1,
            width: g.image_width,
            height: g.image_height,
            backgroundColor: g.image_bg_color, // Note: We don't really use this explicitly yet
            layers: []
        };

        // Serialize layers
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];

            // Check if toDataURL exists (OffscreenCanvas might not have it in some environments)
            let dataUrl;
            if (typeof layer.canvas.toDataURL === 'function') {
                dataUrl = layer.canvas.toDataURL("image/png");
            } else {
                // Fallback for OffscreenCanvas
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = layer.canvas.width;
                tempCanvas.height = layer.canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(layer.canvas, 0, 0);
                dataUrl = tempCanvas.toDataURL("image/png");
            }

            const layerData = {
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                locked: layer.locked,
                data: dataUrl
            };
            project.layers.push(layerData);
        }

        return JSON.stringify(project);
    }

    static async loadProject(jsonString) {
        try {
            const project = JSON.parse(jsonString);

            // Validate
            if (!project.width || !project.height || !project.layers) {
                throw new Error("Invalid project file format");
            }

            // Reset Global State
            g.image_width = project.width;
            g.image_height = project.height;

            // Resize Canvas
            if (window.resizeCanvas) {
                window.resizeCanvas(g.image_width, g.image_height);
            } else {
                // Fallback resize if function not available globally yet (Legacy)
                const can = document.getElementById("drawingCanvas");
                if (can) { can.width = g.image_width; can.height = g.image_height; }
                const initWrapper = document.getElementById('canvasWrapper');
                if (initWrapper) {
                    initWrapper.style.width = `${g.image_width}px`;
                    initWrapper.style.height = `${g.image_height}px`;
                }
            }

            // Clear and Rebuild Layers
            layers.length = 0;

            // Process layers (Async because of image loading)
            for (const layerData of project.layers) {
                const newLayer = new layer_class(layerData.name, g.image_width, g.image_height);
                newLayer.visible = layerData.visible;
                newLayer.opacity = layerData.opacity;
                newLayer.blendMode = layerData.blendMode || 'source-over';
                newLayer.locked = layerData.locked || false;

                // Load image content
                await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        newLayer.ctx.drawImage(img, 0, 0);
                        resolve();
                    };
                    img.onerror = reject;
                    img.src = layerData.data;
                });

                layers.push(newLayer);
            }

            // Finalize
            if (layers.length === 0) {
                g.initDefaultLayer();
            }

            g.activeLayerIndex = Math.max(0, layers.length - 1);

            // Reset History
            if (window.historyManager) {
                window.historyManager.clear();
            }

            // Refresh UI
            renderLayers();
            if (typeof updateLayerPanel === 'function') updateLayerPanel();
            console.log("Project loaded successfully");
            return true;

        } catch (e) {
            console.error("Failed to load project:", e);
            alert("Error loading project file: " + e.message);
            return false;
        }
    }
}

// Export
if (typeof window !== 'undefined') {
    window.ProjectIO = ProjectIO;
}
