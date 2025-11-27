/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        accent: '#FFD600',
        'accent-light': '#FFEA00',
        'accent-dark': '#FFC400',
      },
    },
  },
  plugins: [],
};
