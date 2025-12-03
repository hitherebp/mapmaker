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

// --- LOAD LAYERS ---
map.on('load', function() {
    map.addControl(draw);
    var layers = map.getStyle().layers;
    var firstDrawLayerId;
    for (var i = 0; i < layers.length; i++) { if (layers[i].id.indexOf('gl-draw') === 0) { firstDrawLayerId = layers[i].id; break; } }

    map.addSource('smooth_source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('snap_indicator', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    map.addLayer({ "id": "visual-snap-marker", "type": "circle", "source": "snap_indicator", "paint": { "circle-radius": 8, "circle-color": "#2ecc71", "circle-stroke-width": 3, "circle-stroke-color": "#ffffff", "circle-opacity": 0.8 } });

    // --- STYLES ---
    const styles = {
        minor:   { width: 9,  fill: 5,  color: '#d6d6d6', fillColor: '#d9d9d9' },
        major:   { width: 12, fill: 8,  color: '#cfcfcf', fillColor: '#d9d9d9' },
        ramp:    { width: 8,  fill: 4,  color: '#687d99', fillColor: '#90a4c2' },
        freeway: { width: 18, fill: 14, color: '#687d99', fillColor: '#90a4c2' }
    };

    // Shared Layout Options (The Round Caps)
    const roundLayout = { "line-cap": "round", "line-join": "round" };

    // ===============================================
    // GROUP 1: SURFACE STREETS (Bottom)
    // ===============================================
    
    // Borders
    ['major', 'minor'].forEach(type => {
        map.addLayer({ 
            "id": `visual-${type}-border`, "type": "line", "source": "smooth_source", 
            "layout": roundLayout, // <--- Added Round Caps
            "filter": ["all", ["==", "roadType", type], ["!=", "isBridge", true]], 
            "paint": { "line-color": styles[type].color, "line-width": styles[type].width } 
        }, firstDrawLayerId);
    });

    // Fills
    ['major', 'minor'].forEach(type => {
        map.addLayer({ 
            "id": `visual-${type}-fill`, "type": "line", "source": "smooth_source", 
            "layout": roundLayout, // <--- Added Round Caps
            "filter": ["all", ["==", "roadType", type], ["!=", "isBridge", true]], 
            "paint": { "line-color": styles[type].fillColor, "line-width": styles[type].fill } 
        }, firstDrawLayerId);
    });


    // ===============================================
    // GROUP 2: HIGHWAY INFRASTRUCTURE (Middle)
    // ===============================================

    // Borders
    ['freeway', 'ramp'].forEach(type => {
        map.addLayer({ 
            "id": `visual-${type}-border`, "type": "line", "source": "smooth_source", 
            "layout": roundLayout,
            "filter": ["all", ["==", "roadType", type], ["!=", "isBridge", true]], 
            "paint": { "line-color": styles[type].color, "line-width": styles[type].width } 
        }, firstDrawLayerId);
    });

    // Freeway Fill
    map.addLayer({ 
        "id": "visual-freeway-fill", "type": "line", "source": "smooth_source", 
        "layout": roundLayout,
        "filter": ["all", ["==", "roadType", "freeway"], ["!=", "isBridge", true]], 
        "paint": { "line-color": styles.freeway.fillColor, "line-width": styles.freeway.fill } 
    }, firstDrawLayerId);

    // Ramp Fill (Top of Ground)
    map.addLayer({ 
        "id": "visual-ramp-fill", "type": "line", "source": "smooth_source", 
        "layout": roundLayout,
        "filter": ["all", ["==", "roadType", "ramp"], ["!=", "isBridge", true]], 
        "paint": { "line-color": styles.ramp.fillColor, "line-width": styles.ramp.fill } 
    }, firstDrawLayerId);


    // ===============================================
    // GROUP 3: BRIDGES (Top)
    // ===============================================
    
    const allTypes = ['minor', 'major', 'ramp', 'freeway'];
    allTypes.forEach(t => {
        map.addLayer({ 
            "id": `bridge-${t}-border`, "type": "line", "source": "smooth_source", 
            "layout": roundLayout,
            "filter": ["all", ["==", "roadType", t], ["==", "isBridge", true]], 
            "paint": { "line-color": "#506070", "line-width": styles[t].width + 2 } 
        }, firstDrawLayerId);
        
        map.addLayer({ 
            "id": `bridge-${t}-fill`, "type": "line", "source": "smooth_source", 
            "layout": roundLayout,
            "filter": ["all", ["==", "roadType", t], ["==", "isBridge", true]], 
            "paint": { "line-color": styles[t].fillColor, "line-width": styles[t].fill + 2 } 
        }, firstDrawLayerId);
    });
    
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
        var btnCurve = document.getElementById('btn-curve-toggle');
        var isSmoothed = feature.properties.isSmoothed !== false; 
        if (isSmoothed) { btnCurve.className = "btn-mini btn-wide btn-straight"; btnCurve.innerHTML = "📏 Make Straight"; } 
        else { btnCurve.className = "btn-mini btn-wide btn-curve"; btnCurve.innerHTML = "〰️ Make Smooth"; }

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

function showSnapMarker(coords) {
    var source = map.getSource('snap_indicator');
    if (source) {
        source.setData({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: coords } }]
        });
        setTimeout(() => { source.setData({ type: 'FeatureCollection', features: [] }); }, 500);
    }
}

// --- LOGIC: SNAP & STICKY ROADS ---
function applySnapping(feature) {
    var snapEnabled = document.getElementById('snap-toggle').checked;
    if (!snapEnabled || feature.geometry.type !== 'LineString') return false;

    var allFeatures = draw.getAll().features;
    var coords = feature.geometry.coordinates;
    var startPt = coords[0];
    var endPt = coords[coords.length - 1];
    
    var didSnap = false;
    var snapDistance = 0.1; 

    // Reset old connection data
    feature.properties.connectedStartId = null;
    feature.properties.connectedStartRatio = null;
    feature.properties.connectedEndId = null;
    feature.properties.connectedEndRatio = null;

    function getSnapTarget(point) {
        var bestSnap = null;
        var bestTarget = null;
        var bestRatio = null;
        var minDist = Infinity;

        allFeatures.forEach(other => {
            if (other.id === feature.id) return; 
            if (other.geometry.type !== 'LineString') return; 

            var snapped = turf.nearestPointOnLine(other, point);
            var dist = snapped.properties.dist; 

            if (dist < minDist && dist < snapDistance) { 
                minDist = dist;
                bestSnap = snapped.geometry.coordinates;
                bestTarget = other;
                var len = turf.length(other);
                bestRatio = (len > 0) ? snapped.properties.location / len : 0;
            }
        });
        return { coords: bestSnap, targetId: bestTarget ? bestTarget.id : null, ratio: bestRatio };
    }

    // Snap START
    var startInfo = getSnapTarget(startPt);
    if (startInfo.coords) {
        coords[0] = startInfo.coords;
        feature.properties.connectedStartId = startInfo.targetId;
        feature.properties.connectedStartRatio = startInfo.ratio;
        didSnap = true;
        showSnapMarker(startInfo.coords);
    }

    // Snap END
    var endInfo = getSnapTarget(endPt);
    if (endInfo.coords) {
        coords[coords.length - 1] = endInfo.coords;
        feature.properties.connectedEndId = endInfo.targetId;
        feature.properties.connectedEndRatio = endInfo.ratio;
        didSnap = true;
        showSnapMarker(endInfo.coords);
    }

    if (didSnap) {
        feature.geometry.coordinates = coords;
        draw.add(feature);
    }
    return didSnap;
}

function updateConnectedRoads(parentFeature) {
    if (parentFeature.geometry.type !== 'LineString') return;

    var allFeatures = draw.getAll().features;
    var parentId = parentFeature.id;
    var parentLen = turf.length(parentFeature);

    allFeatures.forEach(child => {
        if (child.id === parentId) return; 
        if (child.geometry.type !== 'LineString') return; 

        var needsUpdate = false;
        var coords = child.geometry.coordinates;

        // Start Connection
        if (child.properties.connectedStartId === parentId) {
            var ratio = child.properties.connectedStartRatio;
            if (ratio !== undefined && ratio !== null) {
                coords[0] = turf.along(parentFeature, parentLen * ratio).geometry.coordinates;
                needsUpdate = true;
            }
        }
        // End Connection
        if (child.properties.connectedEndId === parentId) {
            var ratio = child.properties.connectedEndRatio;
            if (ratio !== undefined && ratio !== null) {
                coords[coords.length - 1] = turf.along(parentFeature, parentLen * ratio).geometry.coordinates;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            child.geometry.coordinates = coords;
            draw.add(child);
        }
    });
}

// --- RENDERER ---
window.updateVisuals = function() {
    var rawData = draw.getAll();
    var smoothFeatures = [];
    smoothMap = {};

    rawData.features.forEach(f => {
        if (f.geometry.type === 'LineString') {
            var rType = f.properties.roadType || 'major';
            var isSmoothed = f.properties.isSmoothed !== false; 
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

// --- CORE ACTIONS ---
window.enterSelectMode = function() { draw.changeMode('simple_select'); setActiveButton('btn-select'); }
window.startDrawing = function(type) { isLabelMode = false; currentRoadType = type; draw.changeMode('draw_line_string'); setActiveButton('tool-' + type); }
window.activateLabelTool = function() { isLabelMode = true; draw.changeMode('draw_point'); setActiveButton('btn-label'); }

window.toggleBridge = function() {
    var id = window.lastSelectedId;
    if (id) {
        var f = draw.get(id);
        if (f) {
            var currentState = f.properties.isBridge === true;
            draw.setFeatureProperty(id, 'isBridge', !currentState);
            showRoadControls(true, draw.get(id));
            updateVisuals();
            saveState();
        }
    }
}

// --- MODIFICATION FUNCTIONS ---
function updateAndSelect(feature) {
    draw.changeMode('simple_select', { featureIds: [] });
    draw.add(feature);
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

window.rotateLabel = function(deg) { var id = window.lastSelectedId; if (id) { var f = draw.get(id); if (f) { var newRot = (f.properties.rotation || 0) + deg; f.properties.rotation = newRot; updateAndSelect(f); } } }
window.nudgeLabel = function(dx, dy) { var id = window.lastSelectedId; if (id) { var f = draw.get(id); if (f) { var c = f.properties.offset || [0, -1.5]; f.properties.offset = [c[0] + dx/10, c[1] + dy/10]; updateAndSelect(f); } } }
window.editLabelText = function() { var id = window.lastSelectedId; if (id) { var f = draw.get(id); if (f) { var n = prompt("Edit label:", f.properties.name); if(n) { f.properties.name = n; updateAndSelect(f); } } } }

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

// --- EVENTS ---
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
            var pt = f.geometry.coordinates; var linkedId = null; var linkedRatio = 0;
            Object.keys(smoothMap).forEach(roadId => {
                var line = smoothMap[roadId];
                if (line) {
                    var snapped = turf.nearestPointOnLine(line, pt);
                    if (snapped.properties.dist < 0.05) { linkedId = roadId; var len = turf.length(line); linkedRatio = snapped.properties.location / len; }
                }
            });
            if (linkedId) { draw.setFeatureProperty(f.id, 'linkedRoadId', linkedId); draw.setFeatureProperty(f.id, 'linkedRatio', linkedRatio); }
            saveState(); window.lastSelectedId = f.id; updateUI(f.id);
        } else { draw.delete(f.id); }
        isLabelMode = false; setActiveButton('btn-select');
    } else if (f.geometry.type === 'LineString') {
        var rType = f.properties.roadType || currentRoadType;
        var autoSmooth = document.getElementById('smooth-toggle').checked;
        f.properties.roadType = rType; f.properties.isSmoothed = autoSmooth;
        draw.setFeatureProperty(f.id, 'roadType', rType); draw.setFeatureProperty(f.id, 'isSmoothed', autoSmooth);
        applySnapping(f); setTimeout(() => { updateVisuals(); saveState(); }, 10);
    }
});

map.on('draw.update', function(e) {
    if (e.features.length > 0) { 
        applySnapping(e.features[0]); 
        updateConnectedRoads(e.features[0]);
    }
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

window.saveState = function() {
    if (historyStep < historyStack.length - 1) historyStack = historyStack.slice(0, historyStep + 1);
    historyStack.push(JSON.stringify(draw.getAll()));
    historyStep++;
    if (historyStack.length > 20) { historyStack.shift(); historyStep--; }
}
window.undo = function() { if (historyStep > 0) { historyStep--; draw.set(JSON.parse(historyStack[historyStep])); updateVisuals(); } }
window.redo = function() { if (historyStep < historyStack.length - 1) { historyStep++; draw.set(JSON.parse(historyStack[historyStep])); updateVisuals(); } }
function downloadMap() {
    var data = draw.getAll();
    if (data.features.length === 0) { alert("Map is empty!"); return; }
    var titleInput = document.getElementById('map-title').value;
    var safeTitle = titleInput.trim() || "mapmaker";
    var filename = safeTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase() + ".geojson";
    var blob = new Blob([JSON.stringify(data)], {type: "application/geo+json"});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}
function loadMap(input) {
    var file = input.files[0]; if (!file) return;
    var cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    document.getElementById('map-title').value = cleanName; document.title = cleanName;
    var reader = new FileReader(); reader.onload = function(e) { try { var json = JSON.parse(e.target.result); draw.deleteAll(); draw.add(json); updateVisuals(); saveState(); var bounds = new maplibregl.LngLatBounds(); json.features.forEach(f => { if(f.geometry.type === 'Point') bounds.extend(f.geometry.coordinates); else f.geometry.coordinates.forEach(c => bounds.extend(c)); }); if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 50 }); } catch (error) { alert("Error: " + error); } }; reader.readAsText(file); input.value = '';
}