/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary-green': '#5ee6ad',
        'primary-red': '#f87171',
        'dark-bg': '#050709',
        'dark-card': '#0f1116',
        'dark-border': '#1f2230',
      },
      boxShadow: {
        card: '0px 12px 30px rgba(0, 0, 0, 0.45)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out forwards',
        'slide-up': 'slide-up 250ms ease-out forwards',
      },
    },
  },
  plugins: [],
}
