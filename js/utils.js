// --- UI TOGGLES ---
function toggleHelp() { 
    document.getElementById('help-panel').classList.toggle('open'); 
}

function showTextControls(show) { 
    document.getElementById('text-controls').style.display = show ? 'block' : 'none'; 
}

function showRoadControls(show, feature) { 
    var panel = document.getElementById('road-controls');
    panel.style.display = show ? 'block' : 'none';
    if (show && feature) {
        var btn = document.getElementById('btn-curve-toggle');
        var isSmoothed = feature.properties.isSmoothed !== false; 
        if (isSmoothed) { 
            btn.className = "btn-mini btn-wide btn-straight"; 
            btn.innerHTML = "📏 Make Straight"; 
        } else { 
            btn.className = "btn-mini btn-wide btn-curve"; 
            btn.innerHTML = "〰️ Make Smooth"; 
        }
    }
}

// --- FILE OPERATIONS ---
function downloadMap() {
    // Note: 'draw' must be available globally from app.js
    var data = window.draw.getAll();
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
            window.draw.deleteAll(); 
            window.draw.add(json);
            
            // Re-render and Save State
            if (typeof updateVisuals === "function") updateVisuals(); 
            if (typeof saveState === "function") saveState();
            
            var bounds = new maplibregl.LngLatBounds();
            json.features.forEach(f => { 
                if(f.geometry.type === 'Point') bounds.extend(f.geometry.coordinates); 
                else f.geometry.coordinates.forEach(c => bounds.extend(c)); 
            });
            if (!bounds.isEmpty()) window.map.fitBounds(bounds, { padding: 50 });
        } catch (error) { alert("Error: " + error); }
    };
    reader.readAsText(file);
    input.value = '';
}