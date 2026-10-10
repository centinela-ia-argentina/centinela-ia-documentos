import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        ui: ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        base: "var(--bg-base)",
        elevated: "var(--bg-elevated)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
        line: "var(--line)",
        fg: "var(--fg)",
        muted: "var(--fg-muted)",
        accent: {
          DEFAULT: "var(--accent)",
          strong: "var(--accent-strong)",
          soft: "var(--accent-soft)",
        },
        brandviolet: {
          DEFAULT: "var(--accent-2)",
          soft: "var(--accent-2-soft)",
        },
      },
      boxShadow: {
        glow: "0 0 24px var(--glow-cian)",
        "glow-violeta": "0 0 24px var(--glow-violeta)",
        "glow-duo": "0 0 30px var(--glow-cian), 0 0 55px var(--glow-violeta)",
      },
    },
  },
  plugins: [],
};

export default config;