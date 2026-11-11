/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        zip: {
          bg: '#050811',
          surface: '#080d1a',
          card: '#0c1326',
          blue: '#38bdf8',
          purple: '#9333ea',
        },
      },
    },
  },
  plugins: [],
};
