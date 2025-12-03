// --- GLOBAL STATE ---
window.currentRoadType = 'major'; 
window.isLabelMode = false;
window.smoothMap = {}; 
window.historyStack = [];
window.historyStep = -1;
window.lastSelectedId = null;

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

window.draw = new MapboxDraw({ displayControlsDefault: false, userProperties: true, styles: drawStyles });

// --- LOAD LAYERS (THE BRIDGE STACK) ---
map.on('load', function() {
    map.addControl(draw);
    
    // Position helper
    var layers = map.getStyle().layers;
    var firstDrawLayerId;
    for (var i = 0; i < layers.length; i++) { if (layers[i].id.indexOf('gl-draw') === 0) { firstDrawLayerId = layers[i].id; break; } }

    map.addSource('smooth_source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    // --- LEVEL 0: GROUND (Filter: "!has isBridge") ---
    // We add !has isBridge to ensure ground roads don't render twice
    
    // Minor
    map.addLayer({ "id": "visual-minor-border", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "minor"], ["!=", "isBridge", true]], "paint": { "line-color": "#d6d6d6", "line-width": 6 } }, firstDrawLayerId);
    map.addLayer({ "id": "visual-minor-fill", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "minor"], ["!=", "isBridge", true]], "paint": { "line-color": "#ffffff", "line-width": 3 } }, firstDrawLayerId);
    
    // Major
    map.addLayer({ "id": "visual-major-border", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "major"], ["!=", "isBridge", true]], "paint": { "line-color": "#cfcfcf", "line-width": 12 } }, firstDrawLayerId);
    map.addLayer({ "id": "visual-major-fill", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "major"], ["!=", "isBridge", true]], "paint": { "line-color": "#ffffff", "line-width": 8 } }, firstDrawLayerId);
    
    // Ramp (Ground Level)
    map.addLayer({ "id": "visual-ramp-border", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "ramp"], ["!=", "isBridge", true]], "paint": { "line-color": "#687d99", "line-width": 8 } }, firstDrawLayerId);
    map.addLayer({ "id": "visual-ramp-fill", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "ramp"], ["!=", "isBridge", true]], "paint": { "line-color": "#ffffff", "line-width": 4 } }, firstDrawLayerId);
    
    // Freeway (Ground Level)
    map.addLayer({ "id": "visual-freeway-border", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "freeway"], ["!=", "isBridge", true]], "paint": { "line-color": "#687d99", "line-width": 18 } }, firstDrawLayerId);
    map.addLayer({ "id": "visual-freeway-fill", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "freeway"], ["!=", "isBridge", true]], "paint": { "line-color": "#90a4c2", "line-width": 14 } }, firstDrawLayerId);

    // --- LEVEL 1: BRIDGES (Filter: "isBridge == true") ---
    // These render ON TOP of ground freeways
    
    // Bridge Minor
    map.addLayer({ "id": "bridge-minor-border", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "minor"], ["==", "isBridge", true]], "paint": { "line-color": "#b0b0b0", "line-width": 8 } }, firstDrawLayerId);
    map.addLayer({ "id": "bridge-minor-fill", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "minor"], ["==", "isBridge", true]], "paint": { "line-color": "#ffffff", "line-width": 4 } }, firstDrawLayerId);

    // Bridge Major
    map.addLayer({ "id": "bridge-major-border", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "major"], ["==", "isBridge", true]], "paint": { "line-color": "#a0a0a0", "line-width": 14 } }, firstDrawLayerId);
    map.addLayer({ "id": "bridge-major-fill", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "major"], ["==", "isBridge", true]], "paint": { "line-color": "#ffffff", "line-width": 10 } }, firstDrawLayerId);

    // Bridge Ramp (Ramp Overpass)
    map.addLayer({ "id": "bridge-ramp-border", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "ramp"], ["==", "isBridge", true]], "paint": { "line-color": "#506070", "line-width": 10 } }, firstDrawLayerId);
    map.addLayer({ "id": "bridge-ramp-fill", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "ramp"], ["==", "isBridge", true]], "paint": { "line-color": "#ffffff", "line-width": 6 } }, firstDrawLayerId);

    // Bridge Freeway (Flyover)
    map.addLayer({ "id": "bridge-freeway-border", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "freeway"], ["==", "isBridge", true]], "paint": { "line-color": "#506070", "line-width": 20 } }, firstDrawLayerId);
    map.addLayer({ "id": "bridge-freeway-fill", "type": "line", "source": "smooth_source", "filter": ["all", ["==", "roadType", "freeway"], ["==", "isBridge", true]], "paint": { "line-color": "#90a4c2", "line-width": 16 } }, firstDrawLayerId);
    
    saveState();
});

map.on('mousemove', function(e) {
    if (draw.getMode() === 'draw_line_string') map.getCanvas().style.cursor = 'crosshair'; 
    else if (draw.getFeatureIdsAt(e.point).length > 0) map.getCanvas().style.cursor = 'pointer'; 
    else map.getCanvas().style.cursor = ''; 
});

// --- UI HELPERS ---
function setActiveButton(activeId) {
    document.querySelectorAll('button').forEach(b => b.classList.remove('active-tool'));
    if(activeId) {
        const btn = document.getElementById(activeId);
        if(btn) btn.classList.add('active-tool');
    }
}

function updateUI(id) {
    var f = draw.get(id);
    if (!f) return;

    var btnDelete = document.getElementById('btn-delete');

    if (f.geometry.type === 'LineString') {
        document.getElementById('debug-info').innerText = "Points: " + f.geometry.coordinates.length;
        showRoadControls(true, f);
        showTextControls(false); 
        btnDelete.innerHTML = "<span>🗑️</span> Delete Road"; 
        btnDelete.classList.remove('point-mode');
    } else if (f.geometry.type === 'Point' && f.properties.isLabel) {
        showRoadControls(false);
        showTextControls(true); 
        btnDelete.innerHTML = "<span>📍</span> Delete Label"; 
        btnDelete.classList.add('point-mode'); 
    }
    setActiveButton('btn-select');
}

function showTextControls(show) { document.getElementById('text-controls').style.display = show ? 'block' : 'none'; }

function showRoadControls(show, feature) { 
    var panel = document.getElementById('road-controls');
    panel.style.display = show ? 'block' : 'none';
    if (show && feature) {
        // Curve Button State
        var btnCurve = document.getElementById('btn-curve-toggle');
        var isSmoothed = feature.properties.isSmoothed !== false; 
        if (isSmoothed) { btnCurve.className = "btn-mini btn-wide btn-straight"; btnCurve.innerHTML = "📏 Make Straight"; } 
        else { btnCurve.className = "btn-mini btn-wide btn-curve"; btnCurve.innerHTML = "〰️ Make Smooth"; }

        // Bridge Button State
        var btnBridge = document.getElementById('btn-bridge-toggle');
        var isBridge = feature.properties.isBridge === true;
        if (isBridge) {
            btnBridge.innerHTML = "⬇️ Ground Level";
            btnBridge.classList.add('active-state');
        } else {
            btnBridge.innerHTML = "🌉 Make Bridge";
            btnBridge.classList.remove('active-state');
        }
    }
}

// --- CORE ACTIONS ---
window.enterSelectMode = function() { draw.changeMode('simple_select'); setActiveButton('btn-select'); }
window.startDrawing = function(type) { isLabelMode = false; currentRoadType = type; draw.changeMode('draw_line_string'); setActiveButton('tool-' + type); }
window.activateLabelTool = function() { isLabelMode = true; draw.changeMode('draw_point'); setActiveButton('btn-label'); }

// --- BRIDGE LOGIC ---
window.toggleBridge = function() {
    var id = window.lastSelectedId;
    if (id) {
        var f = draw.get(id);
        if (f) {
            // Toggle State
            var currentState = f.properties.isBridge === true;
            draw.setFeatureProperty(id, 'isBridge', !currentState);
            
            // Refresh UI to show new text (Ground/Bridge)
            showRoadControls(true, draw.get(id));
            
            updateVisuals();
            saveState();
        }
    }
}

// --- MODIFICATION FUNCTIONS (Blink Update) ---
function updateAndSelect(feature) {
    draw.changeMode('simple_select', { featureIds: [] }); // Deselect
    draw.add(feature); // Update
    setTimeout(() => {
        if (window.lastSelectedId) {
            draw.changeMode('simple_select', { featureIds: [window.lastSelectedId] });
            if (feature.geometry.type === 'Point') setActiveButton('btn-label'); 
        }
    }, 50);
    saveState();
}

window.toggleLineSmoothing = function() { 
    var id = window.lastSelectedId;
    if (id) { 
        var f = draw.get(id); 
        if (f) {
            draw.setFeatureProperty(id, 'isSmoothed', !(f.properties.isSmoothed !== false)); 
            showRoadControls(true, draw.get(id)); 
            updateVisuals(); 
            saveState();
        }
    } 
}

window.rotateLabel = function(deg) { 
    var id = window.lastSelectedId;
    if (id) { 
        var f = draw.get(id); 
        if (f) {
            var newRot = (f.properties.rotation || 0) + deg;
            f.properties.rotation = newRot;
            updateAndSelect(f);
        }
    } 
}

window.nudgeLabel = function(dx, dy) { 
    var id = window.lastSelectedId;
    if (id) { 
        var f = draw.get(id); 
        if (f) {
            var currentOffset = f.properties.offset || [0, -1.5];
            f.properties.offset = [currentOffset[0] + dx/10, currentOffset[1] + dy/10];
            updateAndSelect(f);
        }
    } 
}

window.editLabelText = function() { 
    var id = window.lastSelectedId;
    if (id) { 
        var f = draw.get(id); 
        if (f) {
            var n = prompt("Edit label:", f.properties.name); 
            if(n) { f.properties.name = n; updateAndSelect(f); } 
        }
    } 
}

window.smartDelete = function() {
    var pts = draw.getSelectedPoints();
    var ids = draw.getSelectedIds();
    if (pts.features.length > 0) draw.trash();
    else if (ids.length > 0) { draw.delete(ids); window.lastSelectedId = null; resetUI(); }
    else if (window.lastSelectedId) { draw.delete([window.lastSelectedId]); window.lastSelectedId = null; resetUI(); }
    updateVisuals(); saveState();
}

function resetUI() {
    showTextControls(false); showRoadControls(false); document.getElementById('debug-info').innerText = "Points: 0";
    var btnDelete = document.getElementById('btn-delete');
    btnDelete.innerHTML = "<span>🗑️</span> Delete Selected"; btnDelete.classList.remove('point-mode');
}

// --- STANDARD EVENTS & RENDERER ---
map.on('click', function(e) {
    if (draw.getMode() === 'simple_select' || draw.getMode() === 'direct_select') {
        var clickedFeatures = draw.getFeatureIdsAt(e.point);
        if (clickedFeatures.length === 0) { window.lastSelectedId = null; resetUI(); }
    }
});

map.on('draw.selectionchange', function(e) {
    var ids = draw.getSelectedIds();
    if (ids.length > 0) { window.lastSelectedId = ids[0]; updateUI(ids[0]); }
    else { if (window.lastSelectedId !== null) return; resetUI(); }
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
            // Smart Anchor
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
            window.lastSelectedId = f.id;
            updateUI(f.id);
        } else { draw.delete(f.id); }
        isLabelMode = false;
        setActiveButton('btn-select');
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
    if (e.key === 'Delete' || e.key === 'Backspace') smartDelete(); 
});

window.updateVisuals = function() {
    var rawData = draw.getAll();
    var smoothFeatures = [];
    smoothMap = {};

    rawData.features.forEach(f => {
        if (f.geometry.type === 'LineString') {
            var rType = f.properties.roadType || currentRoadType; 
            var isSmoothed = f.properties.isSmoothed !== false; 
            // Pass bridge property to visual layer
            var isBridge = f.properties.isBridge === true; 
            
            var displayFeat = JSON.parse(JSON.stringify(f));
            displayFeat.properties.roadType = rType; 
            displayFeat.properties.isBridge = isBridge; 

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

window.saveState = function() {
    if (historyStep < historyStack.length - 1) historyStack = historyStack.slice(0, historyStep + 1);
    historyStack.push(JSON.stringify(draw.getAll()));
    historyStep++;
    if (historyStack.length > 20) { historyStack.shift(); historyStep--; }
}

window.undo = function() {
    if (historyStep > 0) { historyStep--; draw.set(JSON.parse(historyStack[historyStep])); updateVisuals(); }
}
window.redo = function() {
    if (historyStep < historyStack.length - 1) { historyStep++; draw.set(JSON.parse(historyStack[historyStep])); updateVisuals(); }
}
function downloadMap() {
    var data = draw.getAll();
    if (data.features.length === 0) { alert("Map is empty!"); return; }
    var blob = new Blob([JSON.stringify(data)], {type: "application/geo+json"});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "mapmaker.geojson"; a.click();
}
function loadMap(input) {
    var file = input.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        try { var json = JSON.parse(e.target.result); draw.deleteAll(); draw.add(json); updateVisuals(); saveState();
            var bounds = new maplibregl.LngLatBounds();
            json.features.forEach(f => { if(f.geometry.type === 'Point') bounds.extend(f.geometry.coordinates); else f.geometry.coordinates.forEach(c => bounds.extend(c)); });
            if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 50 });
        } catch (error) { alert("Error: " + error); }
    }; reader.readAsText(file); input.value = '';
}