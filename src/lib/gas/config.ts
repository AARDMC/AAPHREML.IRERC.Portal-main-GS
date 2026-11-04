/**
 * Backend URL for the Google Apps Script web app.
 *
 * Set this to your deployed Apps Script /exec URL.
 * Keep the trailing /exec — the client posts JSON to this single endpoint.
 *
 * If you deployed the Apps Script backend (scripts/AAPHREML_IRERC_Backend.gs)
 * as a web app, this is the URL it gave you.
 */
export const BACKEND_URL =
  // Allow override via Vite env at build time, otherwise hard-coded default.
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ??
  "https://script.google.com/macros/s/AKfycbykZEhs4LmVQSipZM1ko0e4KLMphSZPGp38d65b3jjALGrK48JWAU1DFDtV05-MLEN6/exec";

/** Session token storage key in localStorage. */
export const TOKEN_KEY = "irerc-gas-token";
export const USER_KEY = "irerc-gas-user";
