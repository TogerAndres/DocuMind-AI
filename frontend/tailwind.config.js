/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        base: {
          950: "#0a0e1a",
          900: "#0f1424",
          850: "#131a2e",
          800: "#1a2138",
          700: "#242c48",
          600: "#37406a",
        },
        accent: {
          teal: "#2dd4bf",
          "teal-dim": "#1b8f82",
          purple: "#8b7cf6",
          "purple-dim": "#6355c7",
        },
        ink: {
          100: "#f3f5fb",
          300: "#c4cade",
          500: "#8891ad",
          700: "#5a6285",
        },
        status: {
          ready: "#2dd4bf",
          processing: "#facc15",
          failed: "#f87171",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,124,246,0.15), 0 8px 30px -8px rgba(45,212,191,0.25)",
      },
      borderRadius: {
        xl2: "1.1rem",
      },
    },
  },
  plugins: [],
};
