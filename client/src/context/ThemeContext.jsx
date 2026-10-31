import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export const THEMES = [
  { id: "midnight", name: "Midnight Aurora", icon: "🌌", description: "Deep navy with ambient glow", isDark: true },
  { id: "oled", name: "OLED Black", icon: "🖤", description: "Pure true black contrast", isDark: true },
  { id: "slate", name: "Cyber Slate", icon: "🌑", description: "Modern cool graphite", isDark: true },
  { id: "light", name: "Crystal Light", icon: "☀️", description: "Crisp light and clean slate", isDark: false },
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
    if (theme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    const idx = THEMES.findIndex((t) => t.id === theme);
    const nextTheme = THEMES[(idx + 1) % THEMES.length].id;
    setTheme(nextTheme);
  };

  const currentThemeObj = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, themes: THEMES, isDark: currentThemeObj.isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
