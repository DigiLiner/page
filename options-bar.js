/**
 * Options Bar - Tool-specific settings display
 * Photopea-style top toolbar
 */

// Track current tool for options display
let currentToolForOptions = null;

// Initialize options bar
document.addEventListener('DOMContentLoaded', function () {
    initializeOptionsBar();
});

function initializeOptionsBar() {
    connectSlider('sizeSlider', 'sizeValue', 'px');
    connectSlider('opacitySlider', 'opacityValue', '%');

    // When a vector shape is selected, sync Size and Opacity sliders from g (already set by vector_tools startEditing)
    window.addEventListener('vectorShapeSelectionChanged', function () {
        if (typeof window.g === 'undefined') return;
        const sel = window.vectorSelection || {};
        if (!sel.hasSelection) return;
        const sizeSlider = document.getElementById('sizeSlider');
        const sizeValue = document.getElementById('sizeValue');
        const opacitySlider = document.getElementById('opacitySlider');
        const opacityValue = document.getElementById('opacityValue');
        if (sizeSlider && sizeValue) {
            const w = Math.max(1, Math.min(100, window.g.pen_width));
            sizeSlider.value = w;
            sizeValue.textContent = w + 'px';
        }
        if (opacitySlider && opacityValue) {
            const o = Math.round(window.g.pen_opacity * 100);
            opacitySlider.value = o;
            opacityValue.textContent = o + '%';
        }
    });

    console.log('Options bar initialized');
}

function connectSlider(sliderId, valueId, unit = '') {
    const slider = document.getElementById(sliderId);
    const valueDisplay = document.getElementById(valueId);

    if (!slider || !valueDisplay) return;

    // Sync from global initial state
    if (typeof window.g !== 'undefined') {
        if (sliderId === 'sizeSlider') slider.value = window.g.pen_width;
        if (sliderId === 'opacitySlider') slider.value = Math.round(window.g.pen_opacity * 100);
        valueDisplay.textContent = slider.value + unit;
    }

    // Update display and global state when slider changes
    slider.addEventListener('input', function () {
        const val = this.value;
        valueDisplay.textContent = val + unit;

        if (typeof window.g !== 'undefined') {
            if (sliderId === 'sizeSlider') {
                window.g.pen_width = parseInt(val);
                // Dispatch event for vector tools or others listening to pen width
                window.dispatchEvent(new CustomEvent('penWidthChanged', { detail: { value: parseInt(val) } }));
            }
            if (sliderId === 'opacitySlider') {
                window.g.pen_opacity = parseFloat(val) / 100;
                if (window.appEvents) {
                    window.appEvents.dispatchEvent(new CustomEvent('syncOpacity', { detail: { value: val, source: 'options' } }));
                }
            }
        }
    });

    // Listen for changes from other sources (e.g., properties panel if it ever changes these)
    if (window.appEvents) {
        if (sliderId === 'opacitySlider') {
            window.appEvents.addEventListener('syncOpacity', function (e) {
                if (e.detail.source === 'properties' && slider.value !== e.detail.value) {
                    slider.value = e.detail.value;
                    valueDisplay.textContent = e.detail.value + unit;
                }
            });
        }
    }
}

// Update options bar based on selected tool
function updateOptionsBar(tool) {
    currentToolForOptions = tool;

    // Hide all tool-specific options (currently only opacity is tool-specific in bar)
    const toolOptions = document.querySelectorAll('.tool-option');
    toolOptions.forEach(opt => opt.classList.remove('active'));

    // Show basic options (Opacity is always shown for most tools in this bar)
    showOptions(['opacity']);
}

function showOptions(optionNames) {
    optionNames.forEach(name => {
        const option = document.querySelector(`[data-option="${name}"]`);
        if (option) {
            option.classList.add('active');
        }
    });
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.updateOptionsBar = updateOptionsBar;
}

// Listen for tool changes from main application
if (typeof window.addEventListener !== 'undefined') {
    window.addEventListener('toolChanged', function (e) {
        if (e.detail && e.detail.tool) {
            updateOptionsBar(e.detail.tool);
        }
    });
}
