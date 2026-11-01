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
        // Override Q1: System SF on Apple platforms, self-hosted Inter Variable fallback on non-Apple platforms
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          "var(--font-inter)",
          "system-ui",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          "var(--font-inter)",
          "system-ui",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        // Gate G1 Locked Decision Q8 (Option A): SF Pro tabular figures on Apple + Inter Variable fallback on non-Apple
        num: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          "var(--font-inter)",
          "system-ui",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        mono: ["var(--font-inter)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        // Tahoe Semantic Text-Style Ladder (11px hard floor, Vietnamese-safe line-heights)
        "large-title": ["1.625rem", { lineHeight: "1.35", letterSpacing: "-0.02em", fontWeight: "700" }], // 26px mobile base
        "title-1": ["1.375rem", { lineHeight: "1.35", letterSpacing: "-0.015em", fontWeight: "700" }],    // 22px
        "title-2": ["1.125rem", { lineHeight: "1.35", letterSpacing: "-0.01em", fontWeight: "600" }],     // 18px
        "title-3": ["1.0625rem", { lineHeight: "1.4", letterSpacing: "-0.005em", fontWeight: "600" }],    // 17px
        headline: ["0.9375rem", { lineHeight: "1.4", letterSpacing: "0em", fontWeight: "600" }],          // 15px
        body: ["0.9375rem", { lineHeight: "1.48", letterSpacing: "0em" }],                                // 15px prose (inputs use text-base md:text-sm)
        subhead: ["0.875rem", { lineHeight: "1.4", letterSpacing: "0em", fontWeight: "500" }],            // 14px
        footnote: ["0.75rem", { lineHeight: "1.35", letterSpacing: "0.005em", fontWeight: "500" }],       // 12px
        caption: ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.01em", fontWeight: "600" }],        // 11px hard floor

        // Standard Tailwind size scale preserved for coexistence across Phases T1-T5
        xs: ["0.75rem", { lineHeight: "1rem" }],        // 12px
        sm: ["0.875rem", { lineHeight: "1.25rem" }],    // 14px
        base: ["1rem", { lineHeight: "1.5rem" }],       // 16px
        lg: ["1.125rem", { lineHeight: "1.625rem" }],   // 18px
        xl: ["1.25rem", { lineHeight: "1.75rem" }],     // 20px
        "2xl": ["1.5rem", { lineHeight: "2rem" }],      // 24px
        "3xl": ["1.75rem", { lineHeight: "2.25rem" }],  // 28px
      },
      colors: {
        // Legacy HSL semantic system tokens preserved
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

        // Tahoe Layer 2 Dark-Ready Opaque & Solid Tinted Surfaces
        canvas: "var(--surface-canvas)",
        "surface-grouped": "var(--surface-grouped)",
        "surface-card": "var(--surface-card)",
        "surface-elevated": "var(--surface-elevated)",
        "surface-cart-bar": "var(--surface-cart-bar)",
        hairline: "var(--separator-hairline)",

        // Dedicated Purple Brand Scale (Single Brand Hue)
        brand: {
          50: "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7",
          600: "#7c3aed", // Primary brand purple (--tint-primary)
          700: "#6d28d9", // Primary hover & active link on glass (--tint-primary-hover)
          800: "#5b21b6", // Pressed & high-contrast tint (--tint-primary-pressed)
          900: "#4c1d95",
          950: "#2e1065", // Solid POS Quick-Cart Bar platter (--surface-cart-bar)
          DEFAULT: "#7c3aed",
          hover: "#6d28d9",
          pressed: "#5b21b6",
          surface: "#faf5ff",
          border: "#e9d5ff",
          "glass-pill": "var(--tint-glass-surface)",
        },
      },
      borderRadius: {
        // Tahoe Concentric Radius Ladder (R_inner = max(6px, R_outer - Padding))
        xs: "0.375rem",        // 6px  - micro dots, compact inner thumbs
        "sm-tahoe": "0.5rem",  // 8px  - compact badges, product inner thumbnail
        field: "0.75rem",      // 12px - inputs, selects, menu rows
        card: "1rem",          // 16px - opaque content cards, desktop popovers, toasts
        panel: "1.25rem",      // 20px - desktop modals, login card
        sheet: "1.75rem",      // 28px - mobile bottom sheets
        capsule: "9999px",     // 9999px - buttons, segmented controls, pills, tab bar, cart bar

        // Existing Tailwind keys preserved
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        // Tahoe Elevation Scale (Pre-Flight Item 5: NO 2xs or xs aliases defined!)
        card: "var(--shadow-card)",
        "glass-sm": "var(--shadow-glass-sm)",
        "glass-md": "var(--shadow-glass-md)",
        "glass-lg": "var(--shadow-glass-lg)",
        "glass-xl": "var(--shadow-glass-xl)",
      },
      zIndex: {
        // Tahoe Collision-Free Normalized Z-Index Scale (10..90)
        "content-sticky": "10",
        "filter-sticky": "20",
        "shell-bar": "30",
        "cart-bar": "35",
        "35": "35",
        modal: "50",
        "modal-nested": "60",
        "60": "60",
        dropdown: "70",
        popover: "70",
        "70": "70",
        sheet: "75",
        "75": "75",
        "dialog-alert": "80",
        "80": "80",
        toast: "90",
        "90": "90",
      },
      transitionTimingFunction: {
        press: "var(--ease-press)",
        "spring-snappy": "var(--ease-spring-snappy)",
        "sheet-enter": "var(--ease-sheet-enter)",
        "sheet-exit": "var(--ease-sheet-exit)",
      },
      transitionDuration: {
        press: "100ms",
        snappy: "200ms",
        "sheet-enter": "260ms",
        "sheet-exit": "180ms",
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
