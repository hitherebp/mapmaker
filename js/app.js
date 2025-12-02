// --- GLOBAL STATE ---
// We attach these to 'window' to ensure utils.js can see them if needed
window.currentRoadType = 'major'; 
window.isLabelMode = false;
window.smoothMap = {}; 
window.historyStack = [];
window.historyStep = -1;

// --- MAP INIT ---
window.map = new maplibregl.Map({
    container: 'map', center: [0, 0], zoom: 14,
    style: {
        "version": 8, "name": "GoogleStyle", 
        "glyphs": "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
        "sources": {},
        "layers": [{ "id": "background", "type": "background", "paint": { "background-color": "#f0f0f0" } }]
    }
});

window.nav = new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true });
map.addControl(nav, 'top-right');

// 'drawStyles' comes from config.js
window.draw = new MapboxDraw({ displayControlsDefault: false, userProperties: true, styles: drawStyles });

// --- LOAD LAYERS ---
map.on('load', function() {
    map.addControl(draw);
    
    var layers = map.getStyle().layers;
    var firstDrawLayerId;
    for (var i = 0; i < layers.length; i++) { 
        if (layers[i].id.indexOf('gl-draw') === 0) { firstDrawLayerId = layers[i].id; break; } 
    }

    map.addSource('smooth_source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    // Z-Index Stack
    map.addLayer({ "id": "visual-minor-border", "type": "line", "source": "smooth_source", "filter": ["==", "roadType", "minor"], "paint": { "line-color": "#d6d6d6", "line-width": 6 } }, firstDrawLayerId);
    map.addLayer({ "id": "visual-minor-fill", "type": "line", "source": "smooth_source", "filter": ["==", "roadType", "minor"], "paint": { "line-color": "#ffffff", "line-width": 3 } }, firstDrawLayerId);
    map.addLayer({ "id": "visual-major-border", "type": "line", "source": "smooth_source", "filter": ["==", "roadType", "major"], "paint": { "line-color": "#cfcfcf", "line-width": 12 } }, firstDrawLayerId);
    map.addLayer({ "id": "visual-major-fill", "type": "line", "source": "smooth_source", "filter": ["==", "roadType", "major"], "paint": { "line-color": "#ffffff", "line-width": 8 } }, firstDrawLayerId);
    map.addLayer({ "id": "visual-ramp-border", "type": "line", "source": "smooth_source", "filter": ["==", "roadType", "ramp"], "paint": { "line-color": "#687d99", "line-width": 8 } }, firstDrawLayerId);
    map.addLayer({ "id": "visual-ramp-fill", "type": "line", "source": "smooth_source", "filter": ["==", "roadType", "ramp"], "paint": { "line-color": "#ffffff", "line-width": 4 } }, firstDrawLayerId);
    map.addLayer({ "id": "visual-freeway-border", "type": "line", "source": "smooth_source", "filter": ["==", "roadType", "freeway"], "paint": { "line-color": "#687d99", "line-width": 18 } }, firstDrawLayerId);
    map.addLayer({ "id": "visual-freeway-fill", "type": "line", "source": "smooth_source", "filter": ["==", "roadType", "freeway"], "paint": { "line-color": "#90a4c2", "line-width": 14 } }, firstDrawLayerId);
    
    saveState();
});

map.on('mousemove', function(e) {
    if (draw.getMode() === 'draw_line_string') map.getCanvas().style.cursor = 'crosshair'; 
    else if (draw.getFeatureIdsAt(e.point).length > 0) map.getCanvas().style.cursor = 'pointer'; 
    else map.getCanvas().style.cursor = ''; 
});


// --- HELPER: HIGHLIGHT BUTTONS ---
function setActiveButton(activeId) {
    // 1. Clear 'active-tool' from ALL buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(b => b.classList.remove('active-tool'));

    // 2. Add 'active-tool' to the one we just clicked
    if (activeId) {
        const btn = document.getElementById(activeId);
        if (btn) btn.classList.add('active-tool');
    }
}

// --- UPDATED CORE FUNCTIONS ---
window.enterSelectMode = function() { 
    draw.changeMode('simple_select'); 
    setActiveButton('btn-select'); // Highlight Select Button
}

window.startDrawing = function(type) { 
    isLabelMode = false; 
    currentRoadType = type; 
    draw.changeMode('draw_line_string'); 
    setActiveButton('tool-' + type); // Highlight the specific road button (e.g. tool-freeway)
}

window.activateLabelTool = function() { 
    isLabelMode = true; 
    draw.changeMode('draw_point'); 
    setActiveButton('btn-label'); // Highlight Label Button
}

// (Delete doesn't need a persistent state, so we don't set it active)

window.toggleLineSmoothing = function() { 
    var ids = draw.getSelectedIds(); if (ids.length) { 
        var f = draw.get(ids[0]); draw.setFeatureProperty(ids[0], 'isSmoothed', !(f.properties.isSmoothed !== false)); 
        showRoadControls(true, draw.get(ids[0])); updateVisuals(); saveState();
    } 
}

window.rotateLabel = function(deg) { var ids = draw.getSelectedIds(); if (ids.length) { var f = draw.get(ids[0]); draw.setFeatureProperty(ids[0], 'rotation', (f.properties.rotation || 0) + deg); saveState(); } }
window.window.nudgeLabel = function(dx, dy) { var ids = draw.getSelectedIds(); if (ids.length) { var f = draw.get(ids[0]); var o = f.properties.offset || [0, -1.5]; draw.setFeatureProperty(ids[0], 'offset', [o[0] + dx/10, o[1] + dy/10]); saveState(); } }
window.editLabelText = function() { var ids = draw.getSelectedIds(); if (ids.length) { var f = draw.get(ids[0]); var n = prompt("Edit label:", f.properties.name); if(n) { draw.setFeatureProperty(ids[0], 'name', n); saveState(); } } }

window.smartDelete = function() {
    var pts = draw.getSelectedPoints();
    if (pts.features.length > 0) draw.trash();
    else { var ids = draw.getSelectedIds(); if (ids.length > 0) draw.delete(ids); else draw.trash(); }
}

// --- UNDO/REDO ---
window.saveState = function() {
    if (historyStep < historyStack.length - 1) historyStack = historyStack.slice(0, historyStep + 1);
    historyStack.push(JSON.stringify(draw.getAll()));
    historyStep++;
    if (historyStack.length > 20) { historyStack.shift(); historyStep--; }
}

window.undo = function() {
    if (historyStep > 0) {
        historyStep--;
        draw.set(JSON.parse(historyStack[historyStep]));
        updateVisuals();
    }
}

// --- EVENTS ---
map.on('draw.selectionchange', function(e) {
    var btnDelete = document.getElementById('btn-delete');
    var selectedPoints = draw.getSelectedPoints();
    
    if (selectedPoints.features.length > 0) {
        btnDelete.innerHTML = "<span>📍</span> Delete Point"; btnDelete.classList.add('point-mode');
    } else if (e.features.length > 0) {
        btnDelete.innerHTML = "<span>🗑️</span> Delete Road"; btnDelete.classList.remove('point-mode');
    } else {
        btnDelete.innerHTML = "<span>🗑️</span> Delete Selected"; btnDelete.classList.remove('point-mode');
    }

    if (e.features.length > 0) {
        var f = e.features[0];
        if (f.geometry.type === 'LineString') {
            document.getElementById('debug-info').innerText = "Points: " + f.geometry.coordinates.length;
            showTextControls(false);
            showRoadControls(true, f); 
            var featureId = f.id;
            setTimeout(() => { if(draw.getMode() === 'simple_select') draw.changeMode('direct_select', { featureId: featureId }); }, 50);
        } else if (f.geometry.type === 'Point' && f.properties.isLabel) {
            showTextControls(true); showRoadControls(false);
        }
    } else {
        showTextControls(false); showRoadControls(false); document.getElementById('debug-info').innerText = "Points: 0";
    }
});

map.on('draw.create', function(e) {
    var f = e.features[0];
    if (f.geometry.type === 'Point' && isLabelMode) {
        var name = prompt("Enter label text:", "Street Name");
        if (name) {
            draw.setFeatureProperty(f.id, 'isLabel', true);
            draw.setFeatureProperty(f.id, 'name', name);
            draw.setFeatureProperty(f.id, 'rotation', 0);
            draw.setFeatureProperty(f.id, 'offset', [0, -1.5]);
            
            var pt = f.geometry.coordinates;
            var linkedId = null;
            var linkedRatio = 0;
            Object.keys(smoothMap).forEach(roadId => {
                var line = smoothMap[roadId];
                if (line) {
                    var snapped = turf.nearestPointOnLine(line, pt);
                    if (snapped.properties.dist < 0.05) { 
                        linkedId = roadId;
                        var len = turf.length(line);
                        linkedRatio = snapped.properties.location / len;
                    }
                }
            });
            if (linkedId) { draw.setFeatureProperty(f.id, 'linkedRoadId', linkedId); draw.setFeatureProperty(f.id, 'linkedRatio', linkedRatio); }
            saveState();
        } else { draw.delete(f.id); }
        isLabelMode = false;
    } else if (f.geometry.type === 'LineString') {
        draw.setFeatureProperty(f.id, 'roadType', currentRoadType);
        var autoSmooth = document.getElementById('smooth-toggle').checked;
        draw.setFeatureProperty(f.id, 'isSmoothed', autoSmooth);
        setTimeout(() => { updateVisuals(); saveState(); }, 10);
    }
});

map.on('draw.update', function(e) {
    updateVisuals(); 
    if (e.features.length > 0 && e.features[0].geometry.type === 'LineString') {
        var roadId = e.features[0].id;
        setTimeout(() => {
            var smoothLine = smoothMap[roadId];
            if (!smoothLine) return;
            var allLabels = draw.getAll().features.filter(f => f.properties.linkedRoadId === roadId);
            allLabels.forEach(lbl => {
                var ratio = lbl.properties.linkedRatio;
                if (ratio >= 0 && ratio <= 1) {
                    var len = turf.length(smoothLine);
                    var newPos = turf.along(smoothLine, len * ratio);
                    draw.add({ id: lbl.id, type: 'Feature', properties: lbl.properties, geometry: newPos.geometry });
                }
            });
        }, 20);
    }
});

map.on('mouseup', function() { if (draw.getMode() === 'direct_select' || draw.getMode() === 'simple_select') saveState(); });
map.on('draw.delete', function(){ updateVisuals(); saveState(); });

document.addEventListener('keydown', function(e) { 
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { undo(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') smartDelete(); 
});

// --- RENDERER (Made Global for Utils) ---
window.updateVisuals = function() {
    var rawData = draw.getAll();
    var smoothFeatures = [];
    smoothMap = {};

    rawData.features.forEach(f => {
        if (f.geometry.type === 'LineString') {
            var rType = f.properties.roadType || currentRoadType; 
            var isSmoothed = f.properties.isSmoothed !== false; 
            var displayFeat = JSON.parse(JSON.stringify(f));
            displayFeat.properties.roadType = rType; 

            if (isSmoothed && f.geometry.coordinates.length > 2) {
                try {
                    var clean = turf.cleanCoords(displayFeat); 
                    var curved = turf.bezierSpline(clean, { resolution: 10000, sharpness: 0.85 });
                    curved.properties = displayFeat.properties; 
                    smoothFeatures.push(curved);
                    smoothMap[f.id] = curved; 
                } catch(err) {
                    smoothFeatures.push(displayFeat);
                    smoothMap[f.id] = displayFeat;
                }
            } else {
                smoothFeatures.push(displayFeat);
                smoothMap[f.id] = displayFeat;
            }
        }
    });
    
    var source = map.getSource('smooth_source');
    if (source) source.setData({ type: 'FeatureCollection', features: smoothFeatures });
}