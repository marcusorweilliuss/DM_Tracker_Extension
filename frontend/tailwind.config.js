/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf2f8',
          500: '#d6336c',
          600: '#c2255c',
          700: '#a61e4d',
        },
      },
    },
  },
  plugins: [],
};
