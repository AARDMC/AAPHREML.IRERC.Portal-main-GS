import { useState } from "react";
import { Check, Palette } from "lucide-react";
import { THEMES, applyTheme, getStoredTheme, type ThemeId } from "@/lib/irerc/theme";

export function ThemePicker({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());
  const [open, setOpen] = useState(false);

  function choose(id: ThemeId) {
    setTheme(id);
    applyTheme(id);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm transition ${
          inverted
            ? "border-white/25 bg-white/10 text-white hover:border-white/50 hover:bg-white/20"
            : "border-line text-muted hover:border-sky/50 hover:text-fg"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Choose a colour theme"
      >
        <Palette className="size-4" />
        {compact ? null : <span className="hidden sm:inline">Theme</span>}
      </button>
      {open ? (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label="Close theme menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-line-2 bg-panel p-2 shadow-card" role="menu">
            <p className="px-2 py-1 text-xs font-semibold tracking-wide text-muted uppercase">Colour theme</p>
            {THEMES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                onClick={() => choose(option.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${theme === option.id ? "bg-sky/10 ring-1 ring-sky/30" : "hover:bg-panel-2"}`}
              >
                <span className="flex -space-x-1">
                  {option.swatch.map((color) => (
                    <span key={color} className="size-4 rounded-full border border-line" style={{ background: color }} />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{option.name}</span>
                  <span className="block truncate text-xs text-muted">{option.description}</span>
                </span>
                {theme === option.id ? <Check className="size-4 text-sky" /> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
