/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      colors: {
        gold: {
          DEFAULT: '#c9a84c',
          light: '#e8c96a',
          dark: '#a07c2e',
          champagne: '#f3e6b5',
        },
        ink: {
          DEFAULT: '#080808',
          soft: '#111111',
          line: '#1c1c1c',
        },
        rose: {
          DEFAULT: '#c45c78',
          soft: '#e08aa0',
        },
        // Keep violet token mapped softer so existing classes still work, but brand leans gold
        violet: {
          active: '#c9a84c',
          hover: '#e8c96a',
        },
      },
      boxShadow: {
        gold: '0 0 24px rgba(201,168,76,0.35)',
        violet: '0 0 24px rgba(201,168,76,0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'brand-pulse': 'brandPulse 3.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        brandPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(201,168,76,0.2)' },
          '50%': { boxShadow: '0 0 36px rgba(201,168,76,0.45)' },
        },
      },
    },
  },
  plugins: [],
};
