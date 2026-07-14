/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
      },
      animation: {
        "slide-up": "slideUp 0.3s ease-out",
        "modal-in": "modalIn 0.2s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-right": "slideRight 0.3s ease-out",
        "float": "float 20s ease-in-out infinite",
      },
      keyframes: {
        slideUp: { "0%": { transform: "translateY(1rem)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        modalIn: { "0%": { transform: "scale(0.95)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideRight: { "0%": { transform: "translateX(-1rem)", opacity: "0" }, "100%": { transform: "translateX(0)", opacity: "1" } },
        float: { "0%, 100%": { transform: "translateY(0) translateX(0)" }, "25%": { transform: "translateY(-20px) translateX(10px)" }, "50%": { transform: "translateY(-10px) translateX(-10px)" }, "75%": { transform: "translateY(-25px) translateX(15px)" } },
      },
      colors: {
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        page: "var(--color-bg)",
        brand: {
          50: "var(--brand-50)", 100: "var(--brand-100)", 200: "var(--brand-200)", 300: "var(--brand-300)",
          400: "var(--brand-400)", 500: "var(--brand-500)", 600: "var(--brand-600)", 700: "var(--brand-700)",
          800: "var(--brand-800)", 900: "var(--brand-900)",
        },
        accent: {
          50: "var(--accent-50)", 100: "var(--accent-100)", 200: "var(--accent-200)", 300: "var(--accent-300)",
          400: "var(--accent-400)", 500: "var(--accent-500)", 600: "var(--accent-600)", 700: "var(--accent-700)",
          800: "var(--accent-800)", 900: "var(--accent-900)",
        },
      },
    },
  },
  plugins: [],
};
