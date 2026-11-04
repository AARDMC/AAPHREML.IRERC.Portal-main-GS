import { createFileRoute } from "@tanstack/react-router";
import { Portal } from "@/components/irerc/portal";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Portal,
});
