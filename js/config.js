// Drawing Styles (The Skeleton)
const drawStyles = [
    { "id": "gl-draw-polygon-and-line-midpoint", "type": "circle", "filter": ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]], "paint": { "circle-radius": 4, "circle-color": "#3498db" } },
    { "id": "gl-draw-vertex-inactive", "type": "circle", "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "active", "true"]], "paint": { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-width": 1, "circle-stroke-color": "#000" } },
    { "id": "gl-draw-vertex-active", "type": "circle", "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["==", "active", "true"]], "paint": { "circle-radius": 7, "circle-color": "#e74c3c" } },
    
    { "id": "gl-draw-line-active", "type": "line", "filter": ["all", ["==", "$type", "LineString"], ["==", "active", "true"]], "paint": { "line-color": "#ff0000", "line-width": 2, "line-dasharray": [2, 2] } },
    { "id": "gl-draw-line-inactive", "type": "line", "filter": ["all", ["==", "$type", "LineString"], ["!=", "active", "true"]], "paint": { "line-color": "#000", "line-width": 15, "line-opacity": 0 } },
    
    { "id": "gl-draw-point-anchor", "type": "circle", "filter": ["all", ["==", "$type", "Point"], ["==", "user_isLabel", true], ["==", "active", "true"]], "paint": { "circle-radius": 6, "circle-color": "#9b59b6", "circle-stroke-width": 2, "circle-stroke-color": "#fff" } },
    { "id": "gl-draw-point-text", "type": "symbol", "filter": ["all", ["==", "$type", "Point"], ["==", "user_isLabel", true]], "layout": { "text-field": ["get", "user_name"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-rotate": ["coalesce", ["get", "user_rotation"], 0], "text-offset": ["coalesce", ["get", "user_offset"], ["literal", [0, -1.5]]], "text-anchor": "center", "text-ignore-placement": true, "text-allow-overlap": true }, "paint": { "text-color": "#333", "text-halo-color": "#fff", "text-halo-width": 2 } }
];