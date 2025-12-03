// --- GLOBAL STATE ---
window.currentRoadType = 'major'; 
window.isLabelMode = false;
window.smoothMap = {}; 
window.historyStack = [];
window.historyStep = -1;
window.lastSelectedId = null; // Sticky memory variable

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

// --- LOAD LAYERS ---
map.on('load', function() {
    map.addControl(draw);
    var layers = map.getStyle().layers;
    var firstDrawLayerId;
    for (var i = 0; i < layers.length; i++) { if (layers[i].id.indexOf('gl-draw') === 0) { firstDrawLayerId = layers[i].id; break; } }

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
    document.querySelectorAll('button').forEach(b => b.classList.remove('active-tool'));
    if(activeId) {
        const btn = document.getElementById(activeId);
        if(btn) btn.classList.add('active-tool');
    }
}

// --- CORE FUNCTIONS ---
window.enterSelectMode = function() { 
    draw.changeMode('simple_select'); 
    setActiveButton('btn-select');
}

window.startDrawing = function(type) { 
    isLabelMode = false; 
    currentRoadType = type; 
    draw.changeMode('draw_line_string'); 
    setActiveButton('tool-' + type); 
}

window.activateLabelTool = function() { 
    isLabelMode = true; 
    draw.changeMode('draw_point'); 
    setActiveButton('btn-label');
}

// ==========================================
// === CRITICAL FIX: STICKY SELECTION LOGIC ===
// ==========================================

// 1. CLEAR MEMORY ONLY ON MAP CLICK
// This ensures that momentary deselections (like redrawing) don't clear our memory.
map.on('click', function(e) {
    // Only verify clicks if we are in select mode
    if (draw.getMode() === 'simple_select' || draw.getMode() === 'direct_select') {
        var clickedFeatures = draw.getFeatureIdsAt(e.point);
        
        // If we truly clicked NOTHING (empty map background)
        if (clickedFeatures.length === 0) {
            window.lastSelectedId = null; // Reset Sticky Memory
            resetUI(); // Force hide UI
        }
    }
});

// 2. SELECTION HANDLER
map.on('draw.selectionchange', function(e) {
    var ids = draw.getSelectedIds();
    
    if (ids.length > 0) {
        // Valid selection: Update memory and show UI
        window.lastSelectedId = ids[0];
        updateUI(ids[0]);
    } else {
        // Selection is empty.
        // CHECK: Is this a "Real" deselect (user clicked map) or a "Fake" one (redraw)?
        if (window.lastSelectedId !== null) {
            // Sticky ID still exists. This is a redraw flicker.
            // IGNORE this event. Do NOT hide the UI.
            return; 
        }
        // If we get here, it's a real deselect.
        resetUI();
    }
});

// UI Helper: Show controls for a feature
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
    
    // Highlight Select Button since we are selecting
    setActiveButton('btn-select');
}

// UI Helper: Hide all controls
function resetUI() {
    showTextControls(false);
    showRoadControls(false);
    document.getElementById('debug-info').innerText = "Points: 0";
    
    var btnDelete = document.getElementById('btn-delete');
    btnDelete.innerHTML = "<span>🗑️</span> Delete Selected"; 
    btnDelete.classList.remove('point-mode');
}

// ==========================================
// === MODIFICATION FUNCTIONS (FIXED) ===
// ==========================================

// Helper: Updates data, redraws, and restores selection
function updateAndSelect(feature) {
    // 1. Deselect everything (Unlocks the renderer)
    draw.changeMode('simple_select', { featureIds: [] });
    
    // 2. Push the data update
    draw.add(feature);
    
    // 3. Re-select after a short delay (Allows renderer to catch up)
    setTimeout(() => {
        // Ensure we still have a valid ID to grab
        if (window.lastSelectedId) {
            draw.changeMode('simple_select', { featureIds: [window.lastSelectedId] });
            
            // Restore button highlighting
            if (feature.geometry.type === 'Point') {
                setActiveButton('btn-label'); 
            }
        }
    }, 50); // 50ms is the "Magic Number" for Mapbox visual updates
    
    saveState();
}

window.rotateLabel = function(deg) { 
    // Logic: Use current selection, fallback to sticky memory
    var ids = draw.getSelectedIds();
    var id = ids.length > 0 ? ids[0] : window.lastSelectedId;

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
    var ids = draw.getSelectedIds();
    var id = ids.length > 0 ? ids[0] : window.lastSelectedId;

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
    var ids = draw.getSelectedIds();
    var id = ids.length > 0 ? ids[0] : window.lastSelectedId;

    if (id) { 
        var f = draw.get(id); 
        if (f) {
            var n = prompt("Edit label:", f.properties.name); 
            if(n) { 
                f.properties.name = n;
                updateAndSelect(f);
            } 
        }
    } 
}

// --- STANDARD LOGIC ---

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

window.smartDelete = function() {
    var pts = draw.getSelectedPoints();
    var ids = draw.getSelectedIds();
    
    if (pts.features.length > 0) {
        draw.trash();
    } else if (ids.length > 0) {
        draw.delete(ids);
        window.lastSelectedId = null; // Clear memory
        resetUI();
    } else if (window.lastSelectedId) {
        // Fallback delete using memory
        draw.delete([window.lastSelectedId]);
        window.lastSelectedId = null;
        resetUI();
    }
    
    updateVisuals();
    saveState();
}

// --- REST OF APP (Unchanged) ---

function showTextControls(show) { document.getElementById('text-controls').style.display = show ? 'block' : 'none'; }
function showRoadControls(show, feature) { 
    var panel = document.getElementById('road-controls');
    panel.style.display = show ? 'block' : 'none';
    if (show && feature) {
        var btn = document.getElementById('btn-curve-toggle');
        var isSmoothed = feature.properties.isSmoothed !== false; 
        if (isSmoothed) { btn.className = "btn-mini btn-wide btn-straight"; btn.innerHTML = "📏 Make Straight"; } 
        else { btn.className = "btn-mini btn-wide btn-curve"; btn.innerHTML = "〰️ Make Smooth"; }
    }
}

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

window.redo = function() {
    if (historyStep < historyStack.length - 1) {
        historyStep++;
        draw.set(JSON.parse(historyStack[historyStep]));
        updateVisuals();
    }
}

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
            // Select the new label immediately
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { undo(); return; }
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

function downloadMap() {
    var data = draw.getAll();
    if (data.features.length === 0) { alert("Map is empty!"); return; }
    var blob = new Blob([JSON.stringify(data)], {type: "application/geo+json"});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "mapmaker.geojson";
    a.click();
}
function loadMap(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var json = JSON.parse(e.target.result);
            draw.deleteAll(); draw.add(json);
            updateVisuals(); 
            saveState();
            var bounds = new maplibregl.LngLatBounds();
            json.features.forEach(f => { if(f.geometry.type === 'Point') bounds.extend(f.geometry.coordinates); else f.geometry.coordinates.forEach(c => bounds.extend(c)); });
            if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 50 });
        } catch (error) { alert("Error: " + error); }
    };
    reader.readAsText(file);
    input.value = '';
}