"use strict";
//Tool class for tool constants
class Tool {
    constructor(name, id, toggle) {
        this.name = name;
        this.id = id;
        this.toggle = toggle;
    }
    toString() {
        return this.name;
    }
    static getAllTools() {
        return [
            Tool.Line,
            Tool.Circle,
            Tool.Rectangle,
            Tool.Pen,
            Tool.Brush,
            Tool.Spray,
            Tool.Flood_Fill,
            Tool.Eraser,
            Tool.Eye_Dropper,
            Tool.Text,
            Tool.Wand,
            Tool.Rounded_Rectangle,
            Tool.Ellipse,
            Tool.RectSelect,
            Tool.Lasso,
            Tool.Crop,
            Tool.Pan,
            Tool.MoveSelection,
            Tool.MoveContent,
            Tool.VectorSelect,
            Tool.PolySelect,
        ];
    }
}
Tool.Line = new Tool("Line", "btn-line", true);
Tool.Circle = new Tool("Circle", "btn-circle", true);
Tool.Rectangle = new Tool("Rectangle", "btn-rect", true);
Tool.Pen = new Tool("Pen", "btn-pen", true);
Tool.Brush = new Tool("Brush", "btn-brush", true);
Tool.Spray = new Tool("Spray", "btn-spray", true);
Tool.Flood_Fill = new Tool("Flood Fill", "btn-flood-fill", true);
Tool.Eraser = new Tool("Eraser", "btn-eraser", true);
Tool.Eye_Dropper = new Tool("Eye Dropper", "btn-eye-dropper", true);
Tool.Text = new Tool("Text", "btn-text", true);
Tool.Wand = new Tool("Wand", "btn-wand", true);
Tool.Rounded_Rectangle = new Tool("Rounded Rectangle", "btn-rounded-rect", true);
Tool.Ellipse = new Tool("Ellipse", "btn-ellipse", true);
Tool.Zoom_In = new Tool("Zoom In", "btn-zoom-in", false);
Tool.Zoom_Out = new Tool("Zoom Out", "btn-zoom-out", false);
Tool.Undo = new Tool("Undo", "btn-undo", false);
Tool.Redo = new Tool("Redo", "btn-redo", false);
Tool.RectSelect = new Tool("Rect Select", "btn-rect-select", true);
Tool.EllipseSelect = new Tool("Ellipse Select", "btn-ellipse-select", true);
Tool.Lasso = new Tool("Lasso", "btn-lasso", true);
Tool.PolySelect = new Tool("Polygon Select", "btn-poly-select", true);
Tool.Crop = new Tool("Crop", "btn-crop", true);
Tool.Pan = new Tool("Pan", "btn-pan", true);
Tool.MoveSelection = new Tool("Move Selection", "btn-move-selection", true);
Tool.MoveContent = new Tool("Move Content", "btn-move-content", true);
Tool.VectorSelect = new Tool("Vector Select", "btn-vector-select", true);
/// Class for global variables
class g {
}

// Expose g immediately to window for debugging and dependent scripts
if (typeof window !== 'undefined') {
    window.g = g;
    console.log('Global g object exposed to window (early)');
}

//flag for drawing on canvas true/false
g.drawing = false;

// ... (rest of properties) ...

// WRAP LAYERS INIT IN TRY-CATCH
let layers = [];
g.activeLayerIndex = 0;



// Function to initialize default layer
g.initDefaultLayer = function () {
    try {
        if (typeof layer_class !== 'undefined') {
            layers.push(new layer_class("Background"));
            console.log("Background layer created successfully");
        } else {
            console.error("CRITICAL: layer_class is not defined yet.");
        }
    } catch (e) {
        console.error("CRITICAL ERROR initializing layers:", e);
    }
};

// ...

// Helper to create canvas (Offscreen or DOM)
g.createCanvas = function (width, height) {
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height);
    } else {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
};

//current tool for drawing string= line, circle, rect, pen, brush, spray, fill
g.current_tool = Tool.Pen;
//color of pencil
g.pen_color = '#000000';
//width of pencil (shared Size for Pen, Brush, Eraser, Line, Rect, Circle, Ellipse, Round Rect)
g.pen_width = 2;
//Opacity of pencil 0-Transparent to 1-Opaque
g.pen_opacity = 1;
//pen blur radius
g.pen_blur = 1;
//pen type solid or dashed
g.pen_type = "solid";
//pen cap type round or square
g.pen_cap = "round";
//pen join type round or bevel
g.pen_join = "round";
//color of brush
g.brush_color = "blue";
//Brush blur radius
g.brush_blur = 2;
//Brush hardness (0-1, controls soft edge gradient)
g.brush_hardness = 0.8;
//Brush flow (0-1, affects accumulation)
g.brush_flow = 1.0;
//Brush density (affects spray and pattern density)
g.brush_density = 100;
//Brush shape (circle, square, etc.)
g.brush_shape = "circle";
//radius of circle for spray tool
g.spray_radius = 100;
//density of spray tool
g.spray_density = 100;
//Start position X of mouse
g.startX = 0;
//Start position Y of mouse
g.startY = 0;
//Calculated position X of mouse by Zoom
g.pX = 0;
//Calculated position Y of mouse by Zoom
g.pY = 0;
//Zoom of canvas
g.zoom = 1;
//Zoom factor for zoom in/out
g.zoomFactor = 1.1;
//Image width of original canvas
g.image_width = 500;
//Image height of original canvas
g.image_height = 500;
//image background color
g.image_bg_color = "white";
//flag for zooming true/false
g.zooming = false;
//tool icon size
g.tool_icon_size = "24px";
//flag for erasing true/false
g.erasing = false;
g.counter = 0;
g.undo_index = -1;
//file location on disk
g.filepath = "";
//selection mask
g.selectionMask = null;
g.selectionBorder = [];
g.isSelectionActive = false;
g.selectionCanvas = null;
g.inverseSelectionCanvas = null;
g.movingSelection = false;
g.isTransforming = false;
// Filter parameters (from Python ie_globals.py)
g.shear_amount = 40;
g.shear_horizontal = true;
g.shear_direction = 1; // 1 or -1
g.melt_amount = 30;
g.blur_radius = 3;
g.gaussian_blur_radius = 2;
g.mosaic_block_size = 10;
// Fill tool parameters
g.fill_tolerance = 32;
g.fill_all_layers = false;
// Rounded rectangle corner radius
g.round_rect_corner_radius = 10;
// Wand tool parameters
g.wand_tolerance = 32;
g.wand_all_layers = false;
// Undo/Redo limits
g.max_undo_steps = 200;
// Text Tool Parameters
g.text_size = 40;
g.text_font = "Roboto";

// Tool Properties Metadata
g.toolConfig = {
    'btn-pen': {
        props: [] // Pen only uses Size and Opacity in Zone 1
    },
    'btn-brush': {
        props: [
            { label: 'Hardness', prop: 'brush_hardness', min: 0, max: 100, unit: '%', mapping: 'percent' },
            { label: 'Flow', prop: 'brush_flow', min: 0, max: 100, unit: '%', mapping: 'percent' },
            { label: 'Opacity', prop: 'pen_opacity', min: 0, max: 100, unit: '%', mapping: 'percent' }
        ]
    },
    'btn-eraser': {
        props: [
            { label: 'Hardness', prop: 'brush_hardness', min: 0, max: 100, unit: '%', mapping: 'percent' },
            { label: 'Opacity', prop: 'pen_opacity', min: 0, max: 100, unit: '%', mapping: 'percent' }
        ]
    },
    'btn-spray': {
        props: [
            { label: 'Radius', prop: 'spray_radius', min: 1, max: 600, unit: 'px', mapping: 'int' },
            { label: 'Density', prop: 'spray_density', min: 1, max: 300, unit: '%', mapping: 'int' }
        ]
    },
    'btn-line': {
        props: [
            { label: 'Thickness', prop: 'pen_width', min: 1, max: 100, unit: 'px', mapping: 'int' },
            { label: 'Hardness', prop: 'brush_hardness', min: 0, max: 100, unit: '%', mapping: 'percent' },
            { label: 'Opacity', prop: 'pen_opacity', min: 0, max: 100, unit: '%', mapping: 'percent' }
        ]
    },
    'btn-rect': {
        props: [
            { label: 'Thickness', prop: 'pen_width', min: 1, max: 100, unit: 'px', mapping: 'int' },
            { label: 'Hardness', prop: 'brush_hardness', min: 0, max: 100, unit: '%', mapping: 'percent' },
            { label: 'Opacity', prop: 'pen_opacity', min: 0, max: 100, unit: '%', mapping: 'percent' }
        ]
    },
    'btn-circle': {
        props: [
            { label: 'Thickness', prop: 'pen_width', min: 1, max: 100, unit: 'px', mapping: 'int' },
            { label: 'Hardness', prop: 'brush_hardness', min: 0, max: 100, unit: '%', mapping: 'percent' },
            { label: 'Opacity', prop: 'pen_opacity', min: 0, max: 100, unit: '%', mapping: 'percent' }
        ]
    },
    'btn-rounded-rect': {
        props: [
            { label: 'Thickness', prop: 'pen_width', min: 1, max: 100, unit: 'px', mapping: 'int' },
            { label: 'Hardness', prop: 'brush_hardness', min: 0, max: 100, unit: '%', mapping: 'percent' },
            { label: 'Opacity', prop: 'pen_opacity', min: 0, max: 100, unit: '%', mapping: 'percent' },
            { label: 'Corner Radius', prop: 'round_rect_corner_radius', min: 0, max: 200, unit: 'px', mapping: 'int' }
        ]
    },
    'btn-ellipse': {
        props: [
            { label: 'Thickness', prop: 'pen_width', min: 1, max: 100, unit: 'px', mapping: 'int' },
            { label: 'Hardness', prop: 'brush_hardness', min: 0, max: 100, unit: '%', mapping: 'percent' },
            { label: 'Opacity', prop: 'pen_opacity', min: 0, max: 100, unit: '%', mapping: 'percent' }
        ]
    },
    'btn-text': {
        props: [
            { label: 'Size', prop: 'text_size', min: 10, max: 200, unit: 'px', mapping: 'int' },
            { label: 'Opacity', prop: 'pen_opacity', min: 0, max: 100, unit: '%', mapping: 'percent' },
            { label: 'Font', prop: 'text_font', type: 'select', items: ['Roboto', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'] }
        ]
    },
    'btn-vector-select': {
        props: [
            { label: 'Thickness', prop: 'pen_width', min: 1, max: 100, unit: 'px', mapping: 'int' },
            { label: 'Hardness', prop: 'brush_hardness', min: 0, max: 100, unit: '%', mapping: 'percent' },
            { label: 'Opacity', prop: 'pen_opacity', min: 0, max: 100, unit: '%', mapping: 'percent' },
            { label: 'Corner Radius', prop: 'round_rect_corner_radius', min: 0, max: 200, unit: 'px', mapping: 'int' }
        ]
    },
    'btn-wand': {
        props: [
            { label: 'Tolerance', prop: 'wand_tolerance', min: 0, max: 255, unit: '', mapping: 'int' },
            { label: 'All Layers', prop: 'wand_all_layers', type: 'checkbox' }
        ]
    },
    'btn-flood-fill': {
        props: [
            { label: 'Tolerance', prop: 'fill_tolerance', min: 0, max: 255, unit: '', mapping: 'int' },
            { label: 'All Layers', prop: 'fill_all_layers', type: 'checkbox' }
        ]
    }
};
class layer_class {
    constructor(name = "Layer", width = g.image_width, height = g.image_height) {
        this.name = name;
        this.canvas = g.createCanvas(width, height);
        this.ctx = this.canvas.getContext("2d");
        this.visible = true;
        this.opacity = 1.0;
        this.blendMode = "source-over";
        this.locked = false;
        // Text Layer Properties
        this.type = 'raster'; // 'raster' or 'text'
        this.textData = {
            text: "",
            x: 0,
            y: 0,
            font: "Roboto",
            size: 40,
            color: "#000000",
            bold: false,
            italic: false
        };
    }
}
// Layers array initialized above in try-catch block
/// Function to convert RGB string to integer
function rgbToInt(rgbString) {
    // Extract numbers using regex
    const match = rgbString.match(/\d+/g);
    if (!match || match.length < 3) {
        throw new Error("Invalid RGB format");
    }
    // Convert extracted values to integers
    const [r, g, b] = match.map(Number);
    console.log(r, g, b);
    // Combine into a single integer
    return (r << 16) | (g << 8) | b;
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    // Global Event Bus for Sync
    window.appEvents = new EventTarget();
}

// Initialize default layer
g.initDefaultLayer();
