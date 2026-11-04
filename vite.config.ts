import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// ────────────────────────────────────────────────────────────────────────────
// Static SPA build for GitHub Pages.
//
// No TanStack Start, no Nitro, no SSR, no Vercel — just a static Vite + React
// SPA that talks to the Google Apps Script backend at runtime.
//
// Set VITE_BACKEND_URL before building if your Apps Script URL differs from
// the default in src/lib/gas/config.ts.
// ────────────────────────────────────────────────────────────────────────────

export default defineConfig({
  // GitHub Pages serves at /<repo-name>/ — set this to your repo name.
  // For a custom domain (user.github.io → /), use "/".
  base: "/AAPHREML.IRERC.Portal-main/",
  server: {
    host: true,
    port: 8080,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    tailwindcss(),
    viteReact(),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
