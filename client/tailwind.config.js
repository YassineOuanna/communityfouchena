/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#6366f1", // Indigo / Iris glow
          hover: "#4f46e5",
          cyan: "#06b6d4",
          violet: "#8b5cf6",
        },
        glass: {
          base: "#0c0f1d",       // Deep atmospheric base canvas
          panel: "rgba(18, 24, 43, 0.65)", // Frosted glass panel
          card: "rgba(255, 255, 255, 0.04)",
          input: "rgba(255, 255, 255, 0.06)",
          border: "rgba(255, 255, 255, 0.09)",
          borderGlow: "rgba(99, 102, 241, 0.35)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        bubble: "0 4px 14px 0 rgba(99, 102, 241, 0.25)",
        glow: "0 0 24px -2px rgba(99, 102, 241, 0.3)",
      },
    },
  },
  plugins: [],
};
