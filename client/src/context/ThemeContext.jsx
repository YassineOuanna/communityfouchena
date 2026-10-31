import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export const THEMES = [
  { id: "midnight", name: "Midnight Aurora", icon: "🌌", description: "Deep navy with ambient glow" },
  { id: "oled", name: "OLED Black", icon: "🖤", description: "Pure true black contrast" },
  { id: "slate", name: "Cyber Slate", icon: "🌑", description: "Modern cool graphite" },
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem("cf_theme") || "midnight";
    } catch {
      return "midnight";
    }
  });

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("cf_theme", newTheme);
    } catch {}
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const idx = THEMES.findIndex((t) => t.id === theme);
    const nextTheme = THEMES[(idx + 1) % THEMES.length].id;
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
