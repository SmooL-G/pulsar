/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          // Driven by CSS variables in globals.css so the user can pick
          // a theme color at runtime (see hooks/useThemeColor.ts).
          50:  'rgb(var(--c-primary-50)  / <alpha-value>)',
          100: 'rgb(var(--c-primary-100) / <alpha-value>)',
          200: 'rgb(var(--c-primary-200) / <alpha-value>)',
          300: 'rgb(var(--c-primary-300) / <alpha-value>)',
          400: 'rgb(var(--c-primary-400) / <alpha-value>)',
          500: 'rgb(var(--c-primary-500) / <alpha-value>)',
          600: 'rgb(var(--c-primary-600) / <alpha-value>)',
          700: 'rgb(var(--c-primary-700) / <alpha-value>)',
          800: 'rgb(var(--c-primary-800) / <alpha-value>)',
          900: 'rgb(var(--c-primary-900) / <alpha-value>)',
        },
        dark: {
          50: '#c1c2c5',
          100: '#a6a7ab',
          200: '#909296',
          300: '#5c5f66',
          400: '#373a40',
          500: '#2c2e33',
          600: '#25262b',
          700: '#1a1b1e',
          800: '#141517',
          900: '#101113',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulsar-glow': 'pulsarGlow 2s ease-in-out infinite',
        'orbit-spin': 'orbitSpin 120s linear infinite',
        'star-pulse': 'starPulse 1.5s ease-in-out infinite',
        'star-twinkle': 'starTwinkle 3s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulsarGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(92,124,250,0.6), 0 0 60px rgba(92,124,250,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(92,124,250,0.9), 0 0 100px rgba(92,124,250,0.5)' },
        },
        orbitSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        starPulse: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.3)' },
        },
        starTwinkle: {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '0.8' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
