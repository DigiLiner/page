/**
 * PSD File Handler
 * Uses psd.js library to read PSD files.
 * Handles conversion between PSD layers and application layers.
 * Note: Writing PSD files is not supported by psd.js.
 */

// psd.js is loaded via script tag in index.html

async function loadPsdFile(arrayBuffer) {
    // psd.js is available as global 'PSD' or 'psd' from the script tag
    const Lib = typeof PSD !== 'undefined' ? PSD : (typeof psd !== 'undefined' ? psd : null);

    if (!Lib) {
        console.error("psd.js library not loaded (neither PSD nor psd found)");
        return null;
    }

    try {
        // psd.js can parse from Uint8Array
        const uint8Array = new Uint8Array(arrayBuffer);
        const psd_obj = new Lib(uint8Array);

        // Parse the PSD
        const parsed = psd_obj.parse();

        // Check if parsing was successful (parsed is usually true/false or the object)
        if (!parsed) {
            console.error("PSD parsing failed");
            return null;
        }

        console.log("PSD loaded via psd.js:", psd_obj);
        return psd_obj;
    } catch (e) {
        console.error("Error reading PSD:", e);
        return null;
    }
}

async function convertPsdToLayers(psd) {
    if (!psd) return [];

    const tree = psd.tree();
    const width = tree.width;
    const height = tree.height;

    // Update global image dimensions
    g.image_width = width;
    g.image_height = height;

    const layerPromises = [];
    const children = tree.children();

    // Iterate through tree (Bottom-to-Top)
    for (let i = children.length - 1; i >= 0; i--) {
        const node = children[i];

        async function processNode(node) {
            if (node.isGroup()) {
                const groupChildren = node.children();
                const groupPromises = [];
                for (let j = groupChildren.length - 1; j >= 0; j--) {
                    groupPromises.push(processNode(groupChildren[j]));
                }
                return (await Promise.all(groupPromises)).flat();
            }

            // It's a layer
            const layerName = node.name || "Layer";
            const layer = new layer_class(layerName, width, height);

            // Visibility & Opacity
            layer.visible = node.visible();
            if (node.layer && node.layer.opacity != null) {
                layer.opacity = node.layer.opacity / 255;
            }

            // Blend Mode
            const blendMap = {
                'norm': 'source-over', 'mul ': 'multiply', 'scrn': 'screen',
                'over': 'overlay', 'dark': 'darken', 'lite': 'lighten',
                'diff': 'difference', 'color': 'color', 'lum ': 'luminosity',
                'hue ': 'hue', 'sat ': 'saturation'
            };
            if (node.layer && node.layer.blendMode && blendMap[node.layer.blendMode.blendKey]) {
                layer.blendMode = blendMap[node.layer.blendMode.blendKey];
            }

            // Image Data
            try {
                const img = node.toPng();
                if (img && (img instanceof HTMLImageElement || img.tagName === 'IMG')) {
                    await new Promise((resolve) => {
                        if (img.complete && img.naturalWidth > 0) resolve();
                        else {
                            img.onload = resolve;
                            img.onerror = resolve; // Continue even on error
                        }
                    });
                    layer.ctx.drawImage(img, node.left, node.top);
                } else if (node.layer.image) {
                    const lWidth = node.width;
                    const lHeight = node.height;
                    const left = node.left;
                    const top = node.top;

                    if (lWidth > 0 && lHeight > 0) {
                        const pixelData = node.layer.image.pixelData;
                        if (pixelData && pixelData.length > 0) {
                            const imageData = new ImageData(new Uint8ClampedArray(pixelData), lWidth, lHeight);
                            layer.ctx.putImageData(imageData, left, top);
                        }
                    }
                }
            } catch (e) {
                console.error("Error drawing layer image:", e);
            }
            return [layer];
        }

        layerPromises.push(processNode(node));
    }

    const layersArray = await Promise.all(layerPromises);
    return layersArray.flat();
}

async function savePsdFile(layers) {
    if (typeof agPsd === 'undefined') {
        alert("PSD saving library (ag-psd) is not loaded. Please ensure ag-psd.js is available.");
        return null;
    }

    try {
        const psdData = {
            width: g.image_width,
            height: g.image_height,
            channels: 4,
            canvas: null, // We'll let ag-psd handle the composite or provide one
            children: layers.map(layer => {
                // Map internal layer_class to ag-psd layer
                return {
                    name: layer.name,
                    canvas: layer.canvas,
                    opacity: layer.opacity,
                    visible: layer.visible,
                    blendMode: layer.blendMode || 'normal',
                    left: 0,
                    top: 0
                };
            })
        };

        // ag-psd writePsd returns Uint8Array
        const buffer = agPsd.writePsd(psdData);
        return buffer;
    } catch (e) {
        console.error("Error creating PSD file:", e);
        alert("Failed to create PSD file: " + e.message);
        return null;
    }
}

// Export functions
if (typeof window !== 'undefined') {
    window.loadPsdFile = loadPsdFile;
    window.convertPsdToLayers = convertPsdToLayers;
    window.savePsdFile = savePsdFile;
}
