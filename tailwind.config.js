/// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#022c22",
        panel: "#14532d",
        text: "#f3f4f6",
        accent: "#34d399",
      },
      fontFamily: {
        heading: ["Bebas Neue", "ui-sans-serif", "system-ui"],
        body: ["Montserrat", "ui-sans-serif", "system-ui"],
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pageIn: {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.995)", filter: "blur(4px)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)", filter: "blur(0)" },
        },
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        "fade-in": "fadeIn 500ms ease-out",
        "slide-up": "slideUp 450ms ease-out",
        "page-in": "pageIn 420ms cubic-bezier(.16,.84,.26,.99)",
      },
    },
  },
  plugins: [],
};
