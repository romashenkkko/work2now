/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        primary: { DEFAULT: "#7a63f1", dark: "#6b54e0" },
        secondary: "#9d7bff",
        accent: "#FB7185",
        "php-dark": "#1e1c2f",
        "php-muted": "#4d5874",
        "php-muted2": "#6b748a",
        "php-border": "rgba(224, 216, 247, 0.6)",
      },
      boxShadow: {
        "soft": "0 4px 24px -4px rgba(122, 99, 241, 0.12), 0 8px 16px -6px rgba(122, 99, 241, 0.08)",
        "soft-lg": "0 12px 40px -8px rgba(122, 99, 241, 0.18), 0 4px 16px -4px rgba(0,0,0,0.06)",
        "accent": "0 4px 20px -2px rgba(251, 113, 133, 0.25)",
        "php-btn": "0 10px 20px rgba(122, 99, 241, 0.25)",
        "php-card": "0 20px 40px rgba(75, 60, 120, 0.12), 0 4px 12px rgba(122, 99, 241, 0.08)",
      },
      keyframes: {
        "hero-gradient-shift": {
          "0%": { backgroundPosition: "0% 50%, 0% 0%, 100% 100%, 50% 50%" },
          "25%": { backgroundPosition: "25% 50%, 20% 20%, 80% 80%, 60% 40%" },
          "50%": { backgroundPosition: "100% 50%, 30% 30%, 70% 70%, 40% 60%" },
          "75%": { backgroundPosition: "75% 50%, 20% 40%, 80% 60%, 60% 40%" },
          "100%": { backgroundPosition: "0% 50%, 0% 0%, 100% 100%, 50% 50%" },
        },
        "float-hand": {
          "0%, 100%": { transform: "rotate(-12deg) translateY(0) translateX(0)" },
          "50%": { transform: "rotate(-10deg) translateY(-10px) translateX(2px)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        /* PHP animations */
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "nav-appear": {
          "0%": { opacity: "0", transform: "translateY(-30px) scaleY(0.95)" },
          "50%": { opacity: "0.7", transform: "translateY(-5px) scaleY(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scaleY(1)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 10px 22px rgba(122, 99, 241, 0.25)" },
          "50%": { boxShadow: "0 18px 30px rgba(122, 99, 241, 0.45)" },
        },
        "shimmer-btn": {
          "0%, 100%": { boxShadow: "0 8px 16px rgba(122, 99, 241, 0.12)" },
          "50%": { boxShadow: "0 14px 24px rgba(122, 99, 241, 0.26)" },
        },
        "float-card": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "phone-main-appear": {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        /* Din spate: poziții FIXE 25% și 75% ca ambele să fie mereu vizibile (stânga + dreapta) */
        "phone-behind-left": {
          "0%": { opacity: "0", transform: "translate(-50%, -50%) rotate(5deg) translateY(12px) scale(0.88)" },
          "100%": { opacity: "0.95", transform: "translate(-50%, -50%) rotate(5deg) translateY(12px) scale(0.94)" },
        },
        "phone-behind-right": {
          "0%": { opacity: "0", transform: "translate(-50%, -50%) rotate(-5deg) translateY(12px) scale(0.88)" },
          "100%": { opacity: "0.95", transform: "translate(-50%, -50%) rotate(-5deg) translateY(12px) scale(0.94)" },
        },
        "phone-behind-left-mobile": {
          "0%": { opacity: "0", transform: "translate(-50%, -50%) rotate(4deg) translateY(8px) scale(0.88)" },
          "100%": { opacity: "0.95", transform: "translate(-50%, -50%) rotate(4deg) translateY(8px) scale(0.94)" },
        },
        "phone-behind-right-mobile": {
          "0%": { opacity: "0", transform: "translate(-50%, -50%) rotate(-4deg) translateY(8px) scale(0.88)" },
          "100%": { opacity: "0.95", transform: "translate(-50%, -50%) rotate(-4deg) translateY(8px) scale(0.94)" },
        },
        "slide-in-nav": {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-actions": {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.6s ease-out forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "scale-in": "scale-in 0.5s ease-out forwards",
        float: "float 4s ease-in-out infinite",
        "float-slow": "float 5s ease-in-out infinite",
        "hero-gradient-shift": "hero-gradient-shift 20s ease infinite",
        "float-hand": "float-hand 3s ease-in-out infinite",
        "fade-up": "fade-up 0.6s ease both",
        "nav-appear": "nav-appear 0.8s cubic-bezier(0.4, 0, 0.2, 1) both",
        "pulse-glow": "pulse-glow 2.8s ease-in-out infinite",
        "shimmer-btn": "shimmer-btn 3.2s ease-in-out infinite",
        "float-card": "float-card 6s ease-in-out infinite",
        "phone-main-appear": "phone-main-appear 0.8s ease-out forwards",
        "phone-behind-left": "phone-behind-left 1.2s ease-out 0.5s forwards",
        "phone-behind-right": "phone-behind-right 1.2s ease-out 0.7s forwards",
        "phone-behind-left-mobile": "phone-behind-left-mobile 1.2s ease-out 0.5s forwards",
        "phone-behind-right-mobile": "phone-behind-right-mobile 1.2s ease-out 0.7s forwards",
        "slide-in-nav": "slide-in-nav 0.5s ease forwards",
        "slide-in-actions": "slide-in-actions 0.5s ease forwards",
      },
    },
  },
  plugins: [],
};
