# AAPHREML-IRERC Institutional Research Ethics Review Portal

Addis Ababa City Administration Health Bureau
Public Health Emergency Management Laboratory & Research Directorate

A static React SPA hosted on GitHub Pages, with Google Apps Script as the backend and Google Sheets as the database. No Vercel, no Neon, no server-side code.

## Architecture

```
GitHub Pages (static React SPA)
      ↕  HTTPS fetch()
Google Apps Script Web App (the backend)
      ↕
Google Sheets (the database)
```

## Quick start

```bash
npm install
npm run dev          # http://localhost:8080
npm run build        # → dist/
npm run typecheck    # 0 errors
```

## Backend setup

1. Open the Database Table sheet → Extensions → Apps Script
2. Paste `scripts/AAPHREML_IRERC_Backend.gs`
3. Run `setupBackend()` — creates sheet headers + bootstrap admin
4. Deploy → New deployment → Web app (Execute as: Me, Access: Anyone)
5. Copy the /exec URL into `src/lib/gas/config.ts`

Bootstrap admin: `addisrdmc@gmail.com` / `Admin123!` — change the password after first login.

## Deploy to GitHub Pages

1. Push to GitHub
2. Repo Settings → Pages → Build and deployment → GitHub Actions
3. The `.github/workflows/deploy.yml` workflow builds and deploys automatically

## What was removed

Vercel, Neon Postgres, Better Auth, TanStack Start (SSR), and all server-side code have been removed. The portal is now a pure static site that talks directly to Google Apps Script.

Full deployment guide: `DEPLOYMENT.md`
Apps Script reference: `docs/google-apps-script-integration.md`
