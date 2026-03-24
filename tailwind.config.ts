import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class", // ✅ REQUIRED for manual dark mode toggle

  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      colors: {
        // ✅ Primary (your existing blue — kept)
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },

        // ✅ Secondary (green – matches your agri theme 🌱)
        secondary: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },

        // ✅ Dark mode base colors (clean UI)
        dark: {
          bg: "#0f172a",     // slate-900
          card: "#1e293b",   // slate-800
          text: "#e2e8f0",   // slate-200
          muted: "#94a3b8",  // slate-400
        },
      },

      // ✅ Better shadows (dashboard feel)
      boxShadow: {
        soft: "0 4px 20px rgba(0,0,0,0.05)",
        card: "0 6px 30px rgba(0,0,0,0.08)",
      },

      // ✅ Smooth UI feel
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },

      // ✅ Slightly nicer border radius
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
    },
  },

  plugins: [],
};

export default config;