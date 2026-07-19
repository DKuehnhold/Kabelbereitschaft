"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "System", light: "Hell", dark: "Dunkel" };
const ICON: Record<Theme, string> = { system: "🖥️", light: "☀️", dark: "🌙" };

function apply(theme: Theme) {
  const el = document.documentElement;
  if (theme === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", theme);
}

// Light/Dark/System-Umschalter. Persistiert in localStorage; keine Funktion hängt vom Theme ab.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // Einmaliges Synchronisieren des Labels mit dem persistierten Theme. Bewusst im Effect,
    // um Hydration-Mismatch zu vermeiden (Server rendert immer den Default "system").
    const stored = (localStorage.getItem("theme") as Theme | null) ?? "system";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(ORDER.includes(stored) ? stored : "system");
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      /* localStorage evtl. gesperrt – Theme gilt dann nur für diese Sitzung */
    }
    apply(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Erscheinungsbild: ${LABEL[theme]} (umschalten)`}
      className="btn btn-outline w-full text-sm"
    >
      <span aria-hidden>{ICON[theme]}</span> Design: {LABEL[theme]}
    </button>
  );
}
