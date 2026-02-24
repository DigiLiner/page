"use strict";

/**
 * Border Filters Module
 * Includes Erode Border (stochastic) and Fade Border (linear alpha).
 */

/**
 * Erode Logic (Stochastic)
 */
function applyErodeBorderLogic(imageData, r, g, b, size) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const d = Math.min(x, width - 1 - x, y, height - 1 - y);
            if (d < size) {
                const prob = 1.0 - (d / size);
                if (Math.random() < prob) {
                    const idx = (y * width + x) * 4;
                    data[idx] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = 255;
                }
            }
        }
    }
}

/**
 * Fade Logic (Linear Alpha)
 */
function applyFadeBorderLogic(imageData, r, g, b, size) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const d = Math.min(x, width - 1 - x, y, height - 1 - y);
            if (d < size) {
                const alpha = Math.floor(255 * (1.0 - d / size));
                const idx = (y * width + x) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = alpha;
            }
        }
    }
}

class BorderFilterDialog {
    constructor(mode = 'erode') {
        this.overlay = null;
        this.mode = mode; // 'erode' or 'fade'
        this.r = 109;
        this.g = 109;
        this.b = 109;
        this.size = 70;
        this.expandColor = true; // Sync RGB
        this.autoPreview = true;
        this.expandCanvas = false;
        this.expandAmount = 70;
        this.linkExpandToSize = true;
    }

    show() {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.className = 'erode-dialog-overlay';

        const maxVal = Math.min(g.image_width / 2, g.image_height / 2);
        this.size = Math.min(this.size, maxVal);
        if (this.linkExpandToSize) this.expandAmount = this.size;

        const title = this.mode === 'erode' ? 'Erode Border' : 'Fade Border';
        const helpText = this.mode === 'erode'
            ? "Erodes border of loaded image. Background color is set by 'R', 'G', and 'B'. Size is the border thickness."
            : "Gradually fades edges into solid color specified by 'R', 'G', and 'B'. 'Size' determines the width of transition.";

        this.overlay.innerHTML = `
            <div class="erode-dialog-box advanced-border-dialog">
                <div class="erode-dialog-header">
                    <span>${title}</span>
                    <button class="erode-dialog-close">&times;</button>
                </div>
                <div class="erode-dialog-content">
                    <div class="erode-preview-area">
                        <div class="erode-preview-container">
                            <canvas id="border-source-preview" width="200" height="150"></canvas>
                            <div class="preview-label">Source</div>
                        </div>
                        <div class="erode-preview-container">
                            <canvas id="border-result-preview" width="200" height="150"></canvas>
                            <div class="preview-label">Result</div>
                        </div>
                    </div>
                    
                    <div class="border-settings-grid">
                        <!-- RGB Controls -->
                        <div class="control-section rgb-section">
                            <div class="section-title">Color <label class="sync-check"><input type="checkbox" id="check-sync-color" ${this.expandColor ? 'checked' : ''}> Link RGB</label></div>
                            <div class="erode-control-row">
                                <label>R</label>
                                <input type="range" id="border-r-slider" min="0" max="255" value="${this.r}">
                                <input type="text" id="border-r-val" value="${this.r}" class="erode-small-input">
                            </div>
                            <div class="erode-control-row">
                                <label>G</label>
                                <input type="range" id="border-g-slider" min="0" max="255" value="${this.g}">
                                <input type="text" id="border-g-val" value="${this.g}" class="erode-small-input">
                            </div>
                            <div class="erode-control-row">
                                <label>B</label>
                                <input type="range" id="border-b-slider" min="0" max="255" value="${this.b}">
                                <input type="text" id="border-b-val" value="${this.b}" class="erode-small-input">
                            </div>
                            <div class="erode-control-row color-result-row">
                                <div id="border-color-preview" style="background-color: rgb(${this.r},${this.g},${this.b})"></div>
                                <span id="border-color-hex">#6D6D6D</span>
                            </div>
                        </div>

                        <!-- Effect Controls -->
                        <div class="control-section effect-section">
                             <div class="section-title">Effect</div>
                             <div class="erode-control-row">
                                <label>Size</label>
                                <input type="range" id="border-size-slider" min="2" max="${Math.floor(g.image_width / 2)}" value="${this.size}">
                                <input type="text" id="border-size-val" value="${this.size}" class="erode-small-input">
                            </div>
                            <div class="erode-control-row">
                                <label title="Expand canvas before applying border">Expand</label>
                                <input type="range" id="border-expand-slider" min="0" max="500" value="${this.expandAmount}" ${this.expandCanvas ? '' : 'disabled'}>
                                <input type="text" id="border-expand-val" value="${this.expandAmount}" class="erode-small-input" ${this.expandCanvas ? '' : 'disabled'}>
                            </div>
                            <div class="checkbox-row">
                                <label><input type="checkbox" id="check-expand-canvas" ${this.expandCanvas ? 'checked' : ''}> Expand Canvas (Centered)</label>
                                <label><input type="checkbox" id="check-link-expand" ${this.linkExpandToSize ? 'checked' : ''}> Link Expand to Size</label>
                            </div>
                        </div>
                    </div>

                    <div class="erode-action-row">
                        <label><input type="checkbox" id="check-auto-preview" ${this.autoPreview ? 'checked' : ''}> Auto Preview</label>
                        <div class="action-btn-group">
                            <button id="border-preview-btn">Manual Preview</button>
                            <button id="border-undo-btn">Reset Preview</button>
                        </div>
                    </div>
                </div>
                <div class="erode-dialog-footer">
                    <button id="border-apply-btn">Apply to Image</button>
                    <button id="border-cancel-btn">Cancel</button>
                </div>
                <div class="erode-dialog-help">${helpText}</div>
            </div>
        `;

        document.body.appendChild(this.overlay);
        this.setupEvents();
        this.updatePreviews(true);
    }

    setupEvents() {
        const query = (s) => this.overlay.querySelector(s);

        const rS = query('#border-r-slider');
        const gS = query('#border-g-slider');
        const bS = query('#border-b-slider');
        const sizeS = query('#border-size-slider');
        const expS = query('#border-expand-slider');

        const rI = query('#border-r-val');
        const gI = query('#border-g-val');
        const bI = query('#border-b-val');
        const sizeI = query('#border-size-val');
        const expI = query('#border-expand-val');

        const syncColorsCheck = query('#check-sync-color');
        const autoPreviewCheck = query('#check-auto-preview');
        const expandCanvasCheck = query('#check-expand-canvas');
        const linkExpandCheck = query('#check-link-expand');

        const updateUI = () => {
            const hex = "#" + ((1 << 24) + (this.r << 16) + (this.g << 8) + this.b).toString(16).slice(1).toUpperCase();
            query('#border-color-preview').style.backgroundColor = `rgb(${this.r},${this.g},${this.b})`;
            query('#border-color-hex').textContent = hex;

            rS.value = this.r; rI.value = this.r;
            gS.value = this.g; gI.value = this.g;
            bS.value = this.b; bI.value = this.b;
            sizeS.value = this.size; sizeI.value = this.size;
            expS.value = this.expandAmount; expI.value = this.expandAmount;

            expS.disabled = !this.expandCanvas;
            expI.disabled = !this.expandCanvas;

            if (this.autoPreview) this.updatePreviews(false);
        };

        const handleColorChange = (val, channel) => {
            if (this.expandColor) {
                this.r = this.g = this.b = val;
            } else {
                this[channel] = val;
            }
            updateUI();
        };

        const handleSizeChange = (val) => {
            this.size = val;
            if (this.linkExpandToSize) this.expandAmount = val;
            updateUI();
        };

        const handleExpandChange = (val) => {
            this.expandAmount = val;
            updateUI();
        };

        rS.oninput = (e) => handleColorChange(parseInt(e.target.value), 'r');
        gS.oninput = (e) => handleColorChange(parseInt(e.target.value), 'g');
        bS.oninput = (e) => handleColorChange(parseInt(e.target.value), 'b');
        sizeS.oninput = (e) => handleSizeChange(parseInt(e.target.value));
        expS.oninput = (e) => handleExpandChange(parseInt(e.target.value));

        rI.onchange = (e) => handleColorChange(parseInt(e.target.value) || 0, 'r');
        gI.onchange = (e) => handleColorChange(parseInt(e.target.value) || 0, 'g');
        bI.onchange = (e) => handleColorChange(parseInt(e.target.value) || 0, 'b');
        sizeI.onchange = (e) => handleSizeChange(parseInt(e.target.value) || 0);
        expI.onchange = (e) => handleExpandChange(parseInt(e.target.value) || 0);

        syncColorsCheck.onchange = (e) => { this.expandColor = e.target.checked; if (this.expandColor) handleColorChange(this.r, 'r'); };
        autoPreviewCheck.onchange = (e) => { this.autoPreview = e.target.checked; };
        expandCanvasCheck.onchange = (e) => { this.expandCanvas = e.target.checked; updateUI(); };
        linkExpandCheck.onchange = (e) => { this.linkExpandToSize = e.target.checked; if (this.linkExpandToSize) handleSizeChange(this.size); };

        query('#border-preview-btn').onclick = () => this.updatePreviews(false);
        query('#border-undo-btn').onclick = () => this.updatePreviews(true);
        query('#border-apply-btn').onclick = () => this.apply();
        query('#border-cancel-btn').onclick = () => this.close();
        query('.erode-dialog-close').onclick = () => this.close();
    }

    updatePreviews(reset = false) {
        const sourceCan = this.overlay.querySelector('#border-source-preview');
        const resultCan = this.overlay.querySelector('#border-result-preview');
        const sCtx = sourceCan.getContext('2d');
        const rCtx = resultCan.getContext('2d');

        sCtx.clearRect(0, 0, sourceCan.width, sourceCan.height);
        if (window.originalCanvas) {
            sCtx.drawImage(window.originalCanvas, 0, 0, sourceCan.width, sourceCan.height);
        }

        rCtx.clearRect(0, 0, resultCan.width, resultCan.height);
        if (reset) {
            rCtx.drawImage(sourceCan, 0, 0);
        } else {
            let virtualW = g.image_width;
            let virtualH = g.image_height;
            let offset = 0;

            if (this.expandCanvas) {
                virtualW += this.expandAmount * 2;
                virtualH += this.expandAmount * 2;
                offset = this.expandAmount;
            }

            const previewScale = Math.min(resultCan.width / virtualW, resultCan.height / virtualH);
            const drawW = g.image_width * previewScale;
            const drawH = g.image_height * previewScale;
            const x = (resultCan.width - drawW) / 2;
            const y = (resultCan.height - drawH) / 2;

            // Draw content centered
            rCtx.drawImage(window.originalCanvas, 0, 0, g.image_width, g.image_height, x, y, drawW, drawH);

            // Apply effect to the edges of the virtual canvas area in preview
            // For simplicity in preview, we apply logic to the WHOLE result preview canvas 
            // but scaled to the virtual dimensions.
            const imageData = rCtx.getImageData(0, 0, resultCan.width, resultCan.height);
            // We only want to apply effects to the region that represents our image+border
            // But applyErodeBorderLogic works on the whole imagedata based on edges.
            // So we'll just use the preview canvas edges as the "virtual" edges.

            if (this.mode === 'erode') {
                applyErodeBorderLogic(imageData, this.r, this.g, this.b, this.size * previewScale + (this.expandCanvas ? this.expandAmount * previewScale : 0));
            } else {
                applyFadeBorderLogic(imageData, this.r, this.g, this.b, this.size * previewScale + (this.expandCanvas ? this.expandAmount * previewScale : 0));
            }
            rCtx.putImageData(imageData, 0, 0);
        }
    }

    async apply() {
        const offset = this.expandCanvas ? this.expandAmount : 0;
        const newW = g.image_width + offset * 2;
        const newH = g.image_height + offset * 2;

        if (offset > 0) {
            // 1. Capture all current layer contents and shift shapes
            const layersData = layers.map(l => {
                const data = l.ctx.getImageData(0, 0, g.image_width, g.image_height);

                // Shift vector shapes
                if (l.shapes) {
                    l.shapes.forEach(s => {
                        if (s.x1 !== undefined) s.x1 += offset;
                        if (s.y1 !== undefined) s.y1 += offset;
                        if (s.x2 !== undefined) s.x2 += offset;
                        if (s.y2 !== undefined) s.y2 += offset;
                        if (s.cx !== undefined) s.cx += offset;
                        if (s.cy !== undefined) s.cy += offset;
                        if (s.x !== undefined) s.x += offset;
                        if (s.y !== undefined) s.y += offset;
                    });
                }
                // Shift text layer data
                if (l.type === 'text' && l.textData) {
                    l.textData.x += offset;
                    l.textData.y += offset;
                }
                return data;
            });

            // 2. Resize global canvases
            if (window.resizeCanvas) {
                window.resizeCanvas(newW, newH);
            } else {
                g.image_width = newW;
                g.image_height = newH;
            }

            // 3. Resize each layer's internal canvas and restore shifted data
            layers.forEach((l, i) => {
                l.canvas.width = newW;
                l.canvas.height = newH;
                l.ctx.clearRect(0, 0, newW, newH);
                l.ctx.putImageData(layersData[i], offset, offset);
            });

            // 4. Update Original Canvas (composite)
            if (window.originalCanvas) {
                const origCtx = window.originalCanvas.getContext('2d');
                const oldData = origCtx.getImageData(0, 0, g.image_width, g.image_height); // Caution: g.image_width is already updated
                // Technically we should have captured originalCanvas BEFORE resizeCanvas call above
                // But resizeCanvas(newW, newH) clears it. 
                // Let's rely on renderLayers() which will be called at the end.
            }
        }

        // 2. Create new layer for effect
        const layerName = this.mode === 'erode' ? "Erode Border" : "Fade Border";
        if (typeof addLayer === 'function') {
            addLayer(layerName);
        } else {
            layers.push(new layer_class(layerName));
            g.activeLayerIndex = layers.length - 1;
        }

        const activeLayer = layers[g.activeLayerIndex];
        const ctx = activeLayer.ctx;

        ctx.clearRect(0, 0, g.image_width, g.image_height);
        const imageData = ctx.createImageData(g.image_width, g.image_height);

        // The effect should only apply to the edges of the NEW larger canvas
        // This is exactly what the logic already does (uses x, y relative to canvas edges)
        if (this.mode === 'erode') {
            applyErodeBorderLogic(imageData, this.r, this.g, this.b, this.size + offset);
        } else {
            applyFadeBorderLogic(imageData, this.r, this.g, this.b, this.size + offset);
        }
        ctx.putImageData(imageData, 0, 0);

        if (typeof renderLayers === 'function') renderLayers();
        if (typeof updateLayerPanel === 'function') updateLayerPanel();

        this.close();
    }

    close() {
        if (this.overlay) {
            document.body.removeChild(this.overlay);
            this.overlay = null;
        }
    }
}

// Global triggers
window.showErodeBorderDialog = () => {
    new BorderFilterDialog('erode').show();
};
window.showFadeBorderDialog = () => {
    new BorderFilterDialog('fade').show();
};
