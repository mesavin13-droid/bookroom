import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const c = (v: string) => `oklch(var(--${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1.25rem", md: "2rem" }, screens: { "2xl": "1240px" } },
    extend: {
      colors: {
        background: c("background"),
        foreground: c("foreground"),
        surface: { DEFAULT: c("surface"), 2: c("surface-2"), 3: c("surface-3") },
        border: c("border"),
        input: c("input"),
        ring: c("ring"),
        muted: { DEFAULT: c("surface-2"), foreground: c("muted-foreground") },
        subtle: c("subtle"),
        primary: { DEFAULT: c("primary"), foreground: c("primary-foreground") },
        secondary: { DEFAULT: c("surface-2"), foreground: c("foreground") },
        accent: { DEFAULT: c("accent"), foreground: c("accent-foreground") },
        destructive: { DEFAULT: c("destructive"), foreground: c("foreground") },
        success: c("success"),
        warning: c("warning"),
        card: { DEFAULT: c("surface"), foreground: c("foreground") },
        popover: { DEFAULT: c("surface-2"), foreground: c("foreground") },
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 4px)", sm: "calc(var(--radius) - 8px)" },
      transitionTimingFunction: { "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)", "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)" },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-up": "fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 1.6s infinite",
      },
      opacity: { 6: "0.06", 8: "0.08", 12: "0.12", 15: "0.15" },
      zIndex: { sticky: "30", nav: "40", overlay: "50", sheet: "60", toast: "70" },
    },
  },
  plugins: [animate],
};

export default config;
