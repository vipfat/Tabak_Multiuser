/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./owner.html",
    "./App.{ts,tsx}",
    "./OwnerApp.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F1D',
        surface: '#121629',
        primary: '#10B981',
        secondary: '#8B5CF6',
        accent: '#F97316',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
