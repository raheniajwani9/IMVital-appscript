/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#0050FF',
          orange: '#FF5200',
          bg: '#FDF5EE',
          dark: '#0A1128',
          card: '#162244'
        }
      }
    },
  },
  plugins: [],
}