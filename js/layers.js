// js/layers.js
// Handles all map visual styles and layer stacking

window.addMapLayers = function(map) {
    // 1. Find the drawing layer ID (so we can draw underneath the edit handles)
    var layers = map.getStyle().layers;
    var firstDrawLayerId;
    for (var i = 0; i < layers.length; i++) { 
        if (layers[i].id.indexOf('gl-draw') === 0) { 
            firstDrawLayerId = layers[i].id; 
            break; 
        } 
    }

    // 2. Add Sources
    map.addSource('smooth_source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('snap_indicator', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    // 3. Add Snap Marker (Green Flash)
    map.addLayer({ 
        "id": "visual-snap-marker", "type": "circle", "source": "snap_indicator", 
        "paint": { "circle-radius": 8, "circle-color": "#2ecc71", "circle-stroke-width": 3, "circle-stroke-color": "#ffffff", "circle-opacity": 0.8 } 
    });

    // 4. Define Styles (The Design System)
    const styles = {
        minor:   { width: 9,  fill: 5,  color: '#d6d6d6', fillColor: '#d9d9d9' }, // Grey
        major:   { width: 12, fill: 8,  color: '#cfcfcf', fillColor: '#d9d9d9' }, // Grey
        ramp:    { width: 8,  fill: 4,  color: '#687d99', fillColor: '#90a4c2' }, // Blue-Grey
        freeway: { width: 18, fill: 14, color: '#687d99', fillColor: '#90a4c2' } // Blue-Grey
    };

    // ===============================================
    // STACK 1: GROUND BORDERS (Bottom)
    // ===============================================
    ['major', 'minor'].forEach(type => {
        map.addLayer({ 
            "id": `visual-${type}-border`, "type": "line", "source": "smooth_source", 
            "filter": ["all", ["==", "roadType", type], ["!=", "isBridge", true]], 
            "paint": { "line-color": styles[type].color, "line-width": styles[type].width } 
        }, firstDrawLayerId);
    });

    // ===============================================
    // STACK 2: GROUND FILLS (Middle)
    // ===============================================
    ['major', 'minor'].forEach(type => {
        map.addLayer({ 
            "id": `visual-${type}-fill`, "type": "line", "source": "smooth_source", 
            "filter": ["all", ["==", "roadType", type], ["!=", "isBridge", true]], 
            "paint": { "line-color": styles[type].fillColor, "line-width": styles[type].fill } 
        }, firstDrawLayerId);
    });

    // ===============================================
    // STACK 3: HIGHWAY INFRASTRUCTURE (Top of Ground)
    // ===============================================
    
    // A. Borders
    ['freeway', 'ramp'].forEach(type => {
        map.addLayer({ 
            "id": `visual-${type}-border`, "type": "line", "source": "smooth_source", 
            "filter": ["all", ["==", "roadType", type], ["!=", "isBridge", true]], 
            "paint": { "line-color": styles[type].color, "line-width": styles[type].width } 
        }, firstDrawLayerId);
    });

    // B. Freeway Fill (Blue Pavement)
    map.addLayer({ 
        "id": "visual-freeway-fill", "type": "line", "source": "smooth_source", 
        "filter": ["all", ["==", "roadType", "freeway"], ["!=", "isBridge", true]], 
        "paint": { "line-color": styles.freeway.fillColor, "line-width": styles.freeway.fill } 
    }, firstDrawLayerId);

    // C. Ramp Fill (The Merge Layer - Draws ON TOP of Freeway Fill)
    map.addLayer({ 
        "id": "visual-ramp-fill", "type": "line", "source": "smooth_source", 
        "filter": ["all", ["==", "roadType", "ramp"], ["!=", "isBridge", true]], 
        "paint": { "line-color": styles.ramp.fillColor, "line-width": styles.ramp.fill } 
    }, firstDrawLayerId);

    // ===============================================
    // STACK 4: BRIDGES (Sky)
    // ===============================================
    const allTypes = ['minor', 'major', 'ramp', 'freeway'];
    allTypes.forEach(t => {
        map.addLayer({ 
            "id": `bridge-${t}-border`, "type": "line", "source": "smooth_source", 
            "filter": ["all", ["==", "roadType", t], ["==", "isBridge", true]], 
            "paint": { "line-color": "#506070", "line-width": styles[t].width + 2 } 
        }, firstDrawLayerId);
        
        map.addLayer({ 
            "id": `bridge-${t}-fill`, "type": "line", "source": "smooth_source", 
            "filter": ["all", ["==", "roadType", t], ["==", "isBridge", true]], 
            "paint": { "line-color": styles[t].fillColor, "line-width": styles[t].fill + 2 } 
        }, firstDrawLayerId);
    });
};