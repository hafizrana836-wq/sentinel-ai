# Sentinel AI cleanup status

- Removed stale top-level shortcut/archive artifacts from the source tree.
- Removed the unused duplicate frontend `pages/Fix` implementation; the routed remediation page remains `src/pages/Remediation`.
- Removed the stale `frontend/App.jsx`; Vite uses `frontend/src/App.jsx`.
- Added `frontend/src/config/api.js` and `frontend/.env.example` to centralize API URL configuration.
- Replaced current frontend `http://localhost:5000` API references with `VITE_API_BASE_URL` usage.
- Replaced the stale Python-oriented `backend/.env.example` with Node/Express deployment variables.
- Preserved the live public API route and real Neon/Postgres schema contract.
- Kept diagnostic tools under `backend/dev-tools/`; they are not part of runtime execution.

## Validation

Backend JavaScript syntax/import validation should be run with dependencies installed. Frontend Vite build should be run with `npm ci && npm run build` from `frontend/`.
