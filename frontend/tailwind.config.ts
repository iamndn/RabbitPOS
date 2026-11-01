import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-nunito)", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        num: ["var(--font-inter)", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-inter)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        caption: ["0.6875rem", { lineHeight: "0.875rem", letterSpacing: "0.01em" }], // 11px
        xs: ["0.75rem", { lineHeight: "1rem" }],        // 12px
        sm: ["0.875rem", { lineHeight: "1.25rem" }],    // 14px
        base: ["1rem", { lineHeight: "1.5rem" }],        // 16px
        lg: ["1.125rem", { lineHeight: "1.625rem" }],   // 18px
        xl: ["1.25rem", { lineHeight: "1.75rem" }],     // 20px
        "2xl": ["1.5rem", { lineHeight: "2rem" }],       // 24px
        "3xl": ["1.75rem", { lineHeight: "2.25rem" }],   // 28px
      },
      colors: {
        // Semantic system tokens
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",

        // Dedicated Purple Brand Scale (D4)
        brand: {
          50: "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7",
          600: "#7c3aed", // Primary brand purple
          700: "#6d28d9", // Primary hover
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
          DEFAULT: "#7c3aed",
          hover: "#6d28d9",
          surface: "#faf5ff",
          border: "#e9d5ff",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "0.75rem",     // 12px - controls per D3
        "2xl": "1rem",      // 16px - cards / modals per D3
        "3xl": "1.5rem",    // 24px - mobile sheets per D3
      },
      zIndex: {
        dropdown: "30",
        popover: "40",
        sheet: "50",
        modal: "60",
        toast: "70",
      },
      screens: {
        "3xl": "1920px",
        "4k": "2560px",
      },
    },
  },
  plugins: [],
};

export default config;
