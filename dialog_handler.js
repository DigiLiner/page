"use strict";

class DialogHandler {
    static async showFormatSelector() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'hcie-dialog-overlay';

            overlay.innerHTML = `
                <div class="hcie-dialog-box">
                    <div class="hcie-dialog-title">Save Project</div>
                    <div class="hcie-dialog-message">Select which format you would like to save your work in.</div>
                    <div class="hcie-dialog-options">
                        <button class="hcie-dialog-btn" data-value="hcie">
                            <div class="hcie-dialog-btn-icon">📁</div>
                            <div>
                                <span class="hcie-dialog-btn-text-main">Project (.hcie)</span>
                                <span class="hcie-dialog-btn-text-sub">Best for continuing work later</span>
                            </div>
                        </button>
                        <button class="hcie-dialog-btn" data-value="psd">
                            <div class="hcie-dialog-btn-icon">🟦</div>
                            <div>
                                <span class="hcie-dialog-btn-text-main">Photoshop (.psd)</span>
                                <span class="hcie-dialog-btn-text-sub">Professional multi-layer export</span>
                            </div>
                        </button>
                        <button class="hcie-dialog-btn" data-value="png">
                            <div class="hcie-dialog-btn-icon">🖼️</div>
                            <div>
                                <span class="hcie-dialog-btn-text-main">Image (.png)</span>
                                <span class="hcie-dialog-btn-text-sub">Flattened version for sharing</span>
                            </div>
                        </button>
                    </div>
                    <div class="hcie-dialog-actions">
                        <button class="hcie-dialog-cancel">Cancel</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Animate in
            setTimeout(() => overlay.classList.add('active'), 10);

            const cleanup = (value) => {
                overlay.classList.remove('active');
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    resolve(value);
                }, 300);
            };

            overlay.querySelectorAll('.hcie-dialog-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    cleanup(btn.getAttribute('data-value'));
                });
            });

            overlay.querySelector('.hcie-dialog-cancel').addEventListener('click', () => {
                cleanup(null);
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(null);
            });
        });
    }

    static async alert(title, message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'hcie-dialog-overlay';
            overlay.innerHTML = `
                <div class="hcie-dialog-box">
                    <div class="hcie-dialog-title">${title}</div>
                    <div class="hcie-dialog-message">${message}</div>
                    <div class="hcie-dialog-actions">
                        <button class="hcie-dialog-btn" style="width: 100%; justify-content: center;">OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('active'), 10);
            overlay.querySelector('.hcie-dialog-btn').addEventListener('click', () => {
                overlay.classList.remove('active');
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    resolve();
                }, 300);
            });
        });
    }
}

if (typeof window !== 'undefined') {
    window.DialogHandler = DialogHandler;
}
