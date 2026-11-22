# Interactive learning map

Intent: make #map a practical way to organise and open existing study topics on desktop and phone.

Approach: deepen existing TopicCanvas rather than add a second graph engine. Existing Topic.position and Topic.connections remain the canonical persisted state. A full whiteboard package adds a second data format and weight; a static list would not satisfy direct manipulation.

Design: show the canvas immediately before secondary conversation routes. Search topics without deleting hidden items or their connections. Default to draggable nodes, with click selecting a topic and a clear action opening its practice/materials. Create a named topic from the toolbar (and a canvas creation gesture on desktop), edit it through the existing editor. Draw connections by dragging a labelled handle onto another topic; retain a two-tap connect mode and keyboard movement for accessibility. Show links and allow removing a connection. Zoom, reset view, and a mobile-friendly selected-topic panel support navigation. Report saving failure and keep persisted profile data intact. Do not delete words, materials, results or review schedules. Existing topic IDs, coordinates and connections remain compatible.

Scope: targeted map UI/domain helpers and meaningful tests for connections, movement and preservation; no new dependency, auth, cloud schema, arbitrary whiteboard drawings, or automated reassessment of learning progress. Verify desktop, narrow viewport, save/reload, and publish with commit.
