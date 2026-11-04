# Google Apps Script Backend

The portal is a static GitHub Pages site. Google Apps Script is the entire backend — it handles login, data storage, and all workflow operations. Data lives in Google Sheets.

## Files

| File | Purpose |
|---|---|
| `scripts/AAPHREML_IRERC_Backend.gs` | Full backend API — paste into Apps Script editor, deploy as web app |
| `scripts/AAPHREML_IRERC_SpeedMode.gs` | Optional speed-mode menu for managing protocols from the sheet |
| `src/lib/gas/config.ts` | Backend URL (the Apps Script /exec URL) |
| `src/lib/gas/api.ts` | Client-side fetch() wrapper for all backend calls |
| `src/lib/gas/auth.tsx` | React auth context (login, session validation, logout) |

## Backend URL

Set in `src/lib/gas/config.ts` or override at build time:

```bash
VITE_BACKEND_URL=https://script.google.com/macros/s/XXXX/exec npm run build
```

## API contract

All requests are `POST` to the single `/exec` URL with JSON body:

```json
{ "action": "login", "email": "...", "password": "..." }
```

Response:

```json
{ "ok": true, "token": "...", "role": "secretariat", "name": "..." }
```

### Actions

| Action | Input | Returns |
|---|---|---|
| `login` | email, password | token, role, name |
| `session` | token | valid, role, name |
| `logout` | token | ok |
| `protocols` | token | protocols[] |
| `protocol` | token, id | protocol |
| `createDraft` | token | protocolId |
| `submitProtocol` | token, protocolId, form | ok |
| `runAction` | token, action, input | ok, message |
| `scanResult` | token, protocolId, scan | ok |
| `members` | token | members[] |
| `safetyReports` | token | reports[] |
| `notifications` | token | notifications[] |
| `auditLog` | token | entries[] |
| `users` | token | users[] |
| `setUserRole` | token, userId, role, active | ok |
| `uploadDocument` | token, protocolId, code, name, base64, mime, size | ok |

## Speed Mode (optional sheet menu)

The `SpeedMode.gs` script adds a menu to the Google Sheets for the secretariat to manage protocols directly from the sheet without opening the portal. See the header comments in `scripts/AAPHREML_IRERC_SpeedMode.gs` for setup.

## Google Sheets

- **Scanner Table:** https://docs.google.com/spreadsheets/d/1a5wErdcvrX5thXyDqb-VbR3buXglpU_JN_a0uufsJr8/edit
- **Database Table:** https://docs.google.com/spreadsheets/d/1LULDYhLpWwBnyqMEVKL2IoMT3vf3C83BXyuAi_8lw1Q/edit
- **Revised Documents:** https://drive.google.com/drive/folders/1PjuyycVGNaO1UHyBesc9NwSVZAeg5yWN
- **All Four Documents:** https://drive.google.com/drive/folders/1gLk2KMupzrLE4k_qMU31SehMxczuiX9h
- **Deployed Script:** https://script.google.com/macros/s/AKfycbykZEhs4LmVQSipZM1ko0e4KLMphSZPGp38d65b3jjALGrK48JWAU1DFDtV05-MLEN6/exec
