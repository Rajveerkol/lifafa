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
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        lifafa: {
          blue: '#1351d8',
          deep: '#0e3a99',
          gradientStart: '#1d4ed8',
          gradientMid: '#3b82f6',
          gradientEnd: '#6366f1',
          accent: '#e11d48',
          gold: '#f59e0b',
          goldLight: '#fef3c7',
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        'card-hover': '0 10px 25px -3px rgba(37, 99, 235, 0.12)',
        'blue-glow': '0 10px 30px -5px rgba(37, 99, 235, 0.35)',
      }
    },
  },
  plugins: [],
}
