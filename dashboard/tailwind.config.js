/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          dark: '#09080d',
          darker: '#050407',
          card: '#120f1a',
          cardHover: '#181424',
          border: '#281e3a',
          borderHover: '#442b6b',
          purple: '#9333ea',
          purpleGlow: '#a855f7',
          purpleLight: '#c084fc',
          red: '#dc2626',
          redGlow: '#ef4444',
          redLight: '#f87171',
          textMuted: '#94a3b8',
          textMain: '#f8fafc'
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'aura-gradient': 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)',
        'aura-card-gradient': 'linear-gradient(180deg, rgba(24, 20, 36, 0.8) 0%, rgba(18, 15, 26, 0.95) 100%)'
      },
      boxShadow: {
        'purple-glow': '0 0 25px -5px rgba(147, 51, 234, 0.3)',
        'red-glow': '0 0 25px -5px rgba(220, 38, 38, 0.3)',
        'aura-card': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }
    },
  },
  plugins: [],
}
