# AAPHREML-IRERC Portal — Deployment Guide

## Architecture (new — no Vercel, no Neon)

```
GitHub Pages (static React SPA)
      ↕  HTTPS fetch()
Google Apps Script Web App (the backend)
      ↕
Google Sheets (the database)
```

No server-side code runs anywhere. The portal is a static site hosted on
GitHub Pages. All data operations go through the Google Apps Script web app
URL, which reads and writes Google Sheets.

---

## Setup steps

### 1. Deploy the Apps Script backend

1. Open the Database Table sheet → **Extensions → Apps Script**
2. Paste the entire contents of `scripts/AAPHREML_IRERC_Backend.gs`
3. Run `setupBackend()` once — creates sheet headers + bootstrap admin
   - Bootstrap admin: `addisrdmc@gmail.com` / `Admin123!`
   - Change this password immediately after first login
4. **Deploy → New deployment → Web app**
   - Execute as: Me
   - Who has access: Anyone
5. Copy the `/exec` URL — this is your `BACKEND_URL`

### 2. Configure the portal

Set the backend URL in `src/lib/gas/config.ts` or via the `VITE_BACKEND_URL`
environment variable at build time. The default is already set to the deployed
Apps Script URL.

### 3. Deploy to GitHub Pages

1. Push your code to GitHub
2. Go to the repo → **Settings → Pages**
3. Under **Build and deployment**, select **GitHub Actions**
4. The `.github/workflows/deploy.yml` workflow builds and deploys automatically
   on every push to `main`

The site will be at `https://<username>.github.io/<repo-name>/`

> **Base path:** `vite.config.ts` sets `base: "/AAPHREML.IRERC.Portal-main/"`.
> Change this to match your repo name, or use `"/"` for a custom domain.

---

## What was removed

| Removed | Replaced by |
|---|---|
| Vercel deployment | GitHub Pages |
| Neon Postgres | Google Sheets |
| Better Auth | Apps Script token-based auth |
| TanStack Start (SSR) | Static Vite SPA build |
| `createServerFn` server functions | `fetch()` to Apps Script |
| `migrations/*.sql` | Sheet headers created by `setupBackend()` |
| `src/lib/db.ts` (Postgres) | `src/lib/gas/api.ts` (Apps Script) |
| `src/lib/auth/server.ts` | `src/lib/gas/auth.tsx` |
| `src/lib/irerc/api.ts` | `src/lib/gas/api.ts` |
| `src/lib/irerc/server/` | `scripts/AAPHREML_IRERC_Backend.gs` |

---

## Build commands

```bash
npm install
npm run dev          # Dev server at http://localhost:8080
npm run build        # Static build → dist/
npm run typecheck    # tsc --noEmit (0 errors)
```

---

## Backend URL

The Apps Script web app URL is in `src/lib/gas/config.ts`:

```
https://script.google.com/macros/s/AKfycbykZEhs4LmVQSipZM1ko0e4KLMphSZPGp38d65b3jjALGrK48JWAU1DFDtV05-MLEN6/exec
```

Override at build time: `VITE_BACKEND_URL=https://script.google.com/... npm run build`

---

## Google Sheets

- **Scanner Table:** https://docs.google.com/spreadsheets/d/1a5wErdcvrX5thXyDqb-VbR3buXglpU_JN_a0uufsJr8/edit
- **Database Table:** https://docs.google.com/spreadsheets/d/1LULDYhLpWwBnyqMEVKL2IoMT3vf3C83BXyuAi_8lw1Q/edit

The backend creates these sheets automatically when you run `setupBackend()`:
- IRERC Users, IRERC Sessions, IRERC Protocols, IRERC Scanner, IRERC Audit,
  IRERC Members, IRERC Safety, IRERC Notifications

---

## Files

```
scripts/
  AAPHREML_IRERC_Backend.gs      ← paste into Apps Script editor (the backend)
  AAPHREML_IRERC_SpeedMode.gs    ← optional speed-mode menu for sheets
src/lib/gas/
  config.ts                       ← backend URL
  api.ts                          ← fetch() client for all GAS calls
  auth.tsx                        ← React auth context (login/logout/session)
src/
  entry-client.tsx               ← SPA entry point
  index.html                     ← HTML shell
  router.tsx                     ← TanStack Router (client-side only)
  vite.config.ts                 ← static build config
.github/workflows/
  deploy.yml                     ← GitHub Pages deployment
```
