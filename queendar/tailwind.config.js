/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#c9a84c',
          light: '#e8c96a',
          dark: '#a07c2e',
        },
        violet: {
          active: '#7c3aed',
          hover: '#9d5cf5',
        },
      },
      boxShadow: {
        gold: '0 0 24px rgba(201,168,76,0.35)',
        violet: '0 0 24px rgba(124,58,237,0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
