// Auth routes are handled by the Google Apps Script backend in static mode.
// This file is kept so TanStack Router doesn't error on the file-based route,
// but it has no server handlers — the static SPA calls the GAS backend directly.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  component: () => null,
});
