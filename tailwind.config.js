/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/features/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#FF6B35',    // Brand Saffron Orange (warm, friendly)
          secondary: '#FFB627',  // Amber/Yellow (bidding, active states)
          success: '#2EC4B6',    // Cardamom green (success, deal completion)
          warning: '#FF9F1C',    // Warning Mustard
          error: '#E71D36',      // Chili Red (outbid warning, error alerts)
          background: '#FDFBF7', // Off-white cream (premium, minimal background)
          surface: '#FFFFFF',    // Surface white (cards, modals)
          text: '#1A1A1A',       // Charcoal (high-contrast, readable text)
          muted: '#7F8C8D',      // Cool Muted Grey
          border: '#E5E7EB',     // Light grey border
        }
      },
      fontFamily: {
        display: ["Spline Sans", "Inter", "sans-serif"],
        mono: ["Courier New", "monospace"],
      }
    },
  },
  plugins: [],
}
