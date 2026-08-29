# Sentinel AI

An AI-powered cybersecurity agent for authorized security assessments — vulnerability scanning, network reconnaissance, AI-assisted analysis, and automated reporting.

> **Authorized use only.** Only scan systems you own or have explicit permission to assess.

## Tech Stack

**Frontend**
- React + Vite
- Deployed on Vercel

**Backend**
- Node.js + Express
- Deployed on Railway

**Database**
- PostgreSQL

**Realtime**
- Socket.IO (live scan progress)

**Authentication**
- JWT + TOTP-based Two-Factor Authentication

**Scanner engine**
- SSL/TLS analysis
- Security headers
- DNS & WHOIS lookup
- Port scanning
- CVE intelligence
- robots.txt / sitemap / security.txt reconnaissance
- Technology fingerprinting

**Reports**
- PDF report generation

**Automation**
- Scheduled recurring scans

**Public API**
- API-key–based public scanning endpoint (`POST /api/v1/scan`)

## Project Structure

```
sentinel-ai/
├── frontend/          # React + Vite app
├── backend/           # Node.js + Express API
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── services/       # scanner engine (SSL, DNS, ports, CVE, ...)
│   ├── middleware/
│   ├── utils/
│   ├── dev-tools/      # diagnostic scripts, not part of the running app
│   └── server.js
├── README.md
└── .gitignore
```

## Environment Variables

**Backend (`backend/.env`)**
```
DATABASE_URL=...
JWT_SECRET=<long random secret>
CLIENT_URL=https://your-vercel-domain.vercel.app
NODE_ENV=production
```

**Frontend (`frontend/.env`)**
```
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app
```

## Local Development

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Deployment Notes

- Backend: Railway. Set `NODE_ENV=production`, a strong random `JWT_SECRET`, and `CLIENT_URL` to your deployed frontend origin (used for CORS — do not use `*` in production).
- Frontend: Vercel. Set `VITE_API_BASE_URL` to your deployed backend origin.
- Never commit `.env` files or print secrets (passwords, JWTs, OTP/TOTP secrets, API keys, DB URLs) to logs.

## Disclaimer

This software is intended only for defensive cybersecurity, education, and authorized security testing.
