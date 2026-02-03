/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "space-blue": {
          900: "#0F172A",
          800: "#1E293B",
          700: "#334155",
        },
        "glass-white": "rgba(255, 255, 255, 0.05)",
        "electric-blue": "#3B82F6",
        "vivid-purple": "#8B5CF6",
        "active-green": "#10B981",
        "recall-red": "#F43F5E",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        heading: ["var(--font-outfit)", "sans-serif"],
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(to right bottom, #0F172A, #1E293B)",
      },
    },
  },
  plugins: [],
}
