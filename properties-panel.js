document.addEventListener('DOMContentLoaded', function () {
    initializePropertiesPanel();
});

function initializePropertiesPanel() {
    console.log('Properties panel initializing...');

    const container = document.getElementById('dynamic-properties');
    if (!container) return;

    // Helper to setup a dynamic slider
    function createSlider(config) {
        const group = document.createElement('div');
        group.className = 'property-group';

        const label = document.createElement('label');
        label.className = 'property-label';
        label.textContent = config.label;

        const control = document.createElement('div');
        control.className = 'property-control';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'property-slider';
        slider.min = config.min;
        slider.max = config.max;
        slider.id = `dynamic-${config.prop}`;

        // Get initial value
        let currentVal = window.g[config.prop];
        if (config.mapping === 'percent') {
            slider.value = Math.round(currentVal * 100);
        } else {
            slider.value = currentVal;
        }

        const valueInput = document.createElement('input');
        valueInput.type = 'number';
        valueInput.className = 'property-value-input';
        valueInput.style.cssText = `
            width: 45px;
            font-size: 11px;
            background: #1a1a1a;
            color: #e0e0e0;
            border: 1px solid #333;
            border-radius: 2px;
            text-align: right;
            margin-left: 8px;
        `;
        valueInput.value = slider.value;

        const syncValue = (val) => {
            slider.value = val;
            valueInput.value = val;

            if (config.mapping === 'percent') {
                window.g[config.prop] = parseFloat(val) / 100;
            } else {
                window.g[config.prop] = parseInt(val);
            }

            // Dispatch specific sync events
            if (config.prop === 'brush_hardness') {
                window.dispatchEvent(new CustomEvent('hardnessChanged', { detail: { value: window.g[config.prop] } }));
            }
            if (config.prop === 'pen_width') {
                window.dispatchEvent(new CustomEvent('penWidthChanged', { detail: { value: window.g[config.prop] } }));
            }
            if (config.prop === 'round_rect_corner_radius') {
                window.dispatchEvent(new CustomEvent('cornerRadiusChanged', { detail: { value: window.g[config.prop] } }));
            }
            if (config.prop === 'pen_opacity') {
                window.dispatchEvent(new CustomEvent('syncOpacity', { detail: { value: val } }));
            }
            if (config.prop === 'text_size') {
                window.dispatchEvent(new CustomEvent('textPropertyChanged', { detail: { prop: 'size', value: parseInt(val) } }));
            }
        };

        slider.addEventListener('input', () => syncValue(slider.value));
        valueInput.addEventListener('change', () => {
            let val = parseInt(valueInput.value);
            if (isNaN(val)) val = config.min;
            val = Math.max(config.min, Math.min(config.max, val));
            syncValue(val);
        });

        control.appendChild(slider);
        control.appendChild(valueInput);
        group.appendChild(label);
        group.appendChild(control);
        return group;
    }

    // Helper to setup a dynamic select
    function createSelect(config) {
        const group = document.createElement('div');
        group.className = 'property-group';

        const label = document.createElement('label');
        label.className = 'property-label';
        label.textContent = config.label;

        const control = document.createElement('div');
        control.className = 'property-control';

        const select = document.createElement('select');
        select.style.width = '100%';
        select.style.fontSize = '11px';

        config.items.forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            if (window.g[config.prop] === item) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            window.g[config.prop] = e.target.value;
            if (config.prop === 'text_font') {
                window.dispatchEvent(new CustomEvent('textPropertyChanged', { detail: { prop: 'font', value: e.target.value } }));
            }
        });

        control.appendChild(select);
        group.appendChild(label);
        group.appendChild(control);
        return group;
    }

    // Helper to setup a dynamic checkbox
    function createCheckbox(config) {
        const group = document.createElement('div');
        group.className = 'property-group';
        group.style.flexDirection = 'row';
        group.style.alignItems = 'center';
        group.style.justifyContent = 'space-between';
        group.style.padding = '4px 0';

        const label = document.createElement('label');
        label.className = 'property-label';
        label.textContent = config.label;
        label.style.margin = '0';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = window.g[config.prop];

        checkbox.addEventListener('change', (e) => {
            window.g[config.prop] = e.target.checked;
        });

        group.appendChild(label);
        group.appendChild(checkbox);
        return group;
    }

    // Props controlled by the top options bar (Size, Opacity) — do not duplicate in this panel
    const TOOLBAR_ONLY_PROPS = ['pen_opacity', 'pen_width'];

    // Vector Select: show only props that apply to the selected shape type (values synced from shape.style)
    const VECTOR_SHAPE_PROPS = {
        line: ['brush_hardness'],
        rect: ['brush_hardness'],
        circle: ['brush_hardness'],
        ellipse: ['brush_hardness'],
        roundrect: ['brush_hardness', 'round_rect_corner_radius']
    };

    function getPropConfigsForShapeType(shapeType) {
        const propNames = VECTOR_SHAPE_PROPS[shapeType];
        if (!propNames || propNames.length === 0) return [];
        const vectorConfig = window.g.toolConfig['btn-vector-select'];
        if (!vectorConfig || !vectorConfig.props) return [];
        return propNames
            .map(name => vectorConfig.props.find(p => p.prop === name))
            .filter(Boolean);
    }

    function updatePanelForVectorSelection() {
        container.innerHTML = '';
        const sel = window.vectorSelection || { hasSelection: false, shapeType: null, style: null };
        if (!sel.hasSelection || !sel.shapeType) {
            container.innerHTML = `<p style="color: #999; font-size: 11px; text-align: center; padding: 10px;">Select a shape to edit</p>`;
            return;
        }
        const propConfigs = getPropConfigsForShapeType(sel.shapeType);
        if (propConfigs.length === 0) {
            container.innerHTML = `<p style="color: #999; font-size: 11px; text-align: center; padding: 10px;">No editable properties</p>`;
            return;
        }
        propConfigs.forEach(propConfig => {
            if (propConfig.type === 'select') {
                container.appendChild(createSelect(propConfig));
            } else if (propConfig.type === 'checkbox') {
                container.appendChild(createCheckbox(propConfig));
            } else {
                container.appendChild(createSlider(propConfig));
            }
        });
    }

    function updatePanelForTool(toolId) {
        container.innerHTML = '';
        if (toolId === 'btn-vector-select') {
            updatePanelForVectorSelection();
            return;
        }
        const config = window.g.toolConfig[toolId];
        if (!config || !config.props || config.props.length === 0) {
            container.innerHTML = `<p style="color: #999; font-size: 11px; text-align: center; padding: 10px;">No extra options</p>`;
            return;
        }
        const panelProps = config.props.filter(p => !TOOLBAR_ONLY_PROPS.includes(p.prop));
        if (panelProps.length === 0) {
            container.innerHTML = `<p style="color: #999; font-size: 11px; text-align: center; padding: 10px;">No extra options</p>`;
            return;
        }
        panelProps.forEach(propConfig => {
            if (propConfig.type === 'select') {
                container.appendChild(createSelect(propConfig));
            } else if (propConfig.type === 'checkbox') {
                container.appendChild(createCheckbox(propConfig));
            } else {
                container.appendChild(createSlider(propConfig));
            }
        });
    }

    window.addEventListener('toolChanged', (e) => {
        updatePanelForTool(e.detail.tool);
    });
    window.addEventListener('vectorShapeSelectionChanged', () => {
        if (window.g && window.g.current_tool && window.g.current_tool.id === 'btn-vector-select') {
            updatePanelForVectorSelection();
        }
    });

    if (window.g && window.g.current_tool) {
        updatePanelForTool(window.g.current_tool.id);
    }

    console.log('Properties panel dynamic logic initialized');
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.initializePropertiesPanel = initializePropertiesPanel;
    // Expose for debugging/manual calls if needed
    // We need to extract it from the closure or attach it to window inside the closure
}
