# Archived frontend code

These files were not part of the active runtime graph in the cleaned build:
- legacy root `frontend/App.jsx` (Vite uses `frontend/src/App.jsx`)
- duplicate `src/pages/Dashboard/index.jsx` (active dashboard is `src/components/Dashboard/index.jsx`)
- duplicate `src/pages/Fix/*` implementation (active remediation route is `src/pages/Remediation`)
- unused `SecurityDashboard.jsx`

They are preserved here for rollback/reference and are not imported by the active app.
