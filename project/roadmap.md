

🗺️ MapMaker Project Roadmap
✅ Phase 1: The Engine (Completed)
Vector Drawing: LineString (Roads) and Point (Labels) support.

Twin-Layer System: Separated "Skeleton" (Input) from "Skin" (Visuals) for smooth editing.

Data Management: Save/Load GeoJSON files.

History: Robust Undo/Redo system.

Architecture: Refactored into modular files (app.js, config.js, etc.).

✅ Phase 2: Roads & Polish (Completed)
Hierarchy: Implemented 4-tier system (Freeway, Ramp, Major, Minor).

Smart Anchors: Labels magnetically lock to roads and follow edits.

Styling: "Google Maps" aesthetic with proper z-indexing (bridges over streets).

UX/UI: Mobile/iPad layout fixes, active button states, hover protections.

Deployment: Live hosting via GitHub Pages.

🚧 Phase 3: Zoning (The "Urban Planner" Update)
Current Focus

Polygon Tool: Add ability to draw closed shapes, not just lines.

Zone Types:

🌳 Parks: Green fill.

💧 Water: Blue fill.

🏢 Commercial: Concrete/Grey fill.

🏠 Residential: Light yellow/beige fill.

Layering Logic: These must render at z-index: 0 (underneath minor streets).

📅 Phase 4: 3D Buildings (The "SimCity" Update)
Extrusion: Convert 2D polygons into 3D volumes.

Properties: Add a "Height" slider to the UI when a zone is selected.

Rendering: Use MapLibre's fill-extrusion layer type to render shadows and depth.

📅 Phase 5: Traffic & Logic (The "Civil Engineer" Update)
Directionality: Visual arrows showing one-way vs two-way roads.

Intersections: Logic to visually merge borders where two roads meet (removing the white lines between them).

Tunnels/Bridges: A property to force a road under or over another without connecting.

Suggested Next Step
We should start Phase 3: Zoning.

This involves adding a new drawing mode (draw_polygon) to your toolkit. Would you like the code to add a "🌳 Draw Park" button to get started?