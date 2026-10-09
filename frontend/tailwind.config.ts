import type { Config } from "tailwindcss";

// SkyGuardian design tokens: warm editorial palette.
// Contrast rules (WCAG AA): small text uses ink / ink-soft / ink-muted on sand-50..200 only.
// coral (bright) is for large display text and decoration; coral-deep for small accent text and buttons.
// On sand-400 and mist backgrounds use ink or ink-soft for text.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#FAF8F4',   // paper: inputs, raised cards
          100: '#F4F0E8',  // cream: cards
          200: '#ECE6DB',  // page background
          300: '#DFD7C9',  // hairline-strong / hover
          400: '#CFC6B8',  // deep sand section
          500: '#B5AA98',
        },
        ink: {
          DEFAULT: '#1A1714', // primary text
          soft: '#4F4842',    // secondary text
          muted: '#6B6359',   // labels, captions (AA on sand-50..200)
          faint: '#9A9184',   // decoration only, never text
        },
        coral: {
          DEFAULT: '#E8502E', // display accents, dots, icons
          deep: '#B8321C',    // small accent text, primary accent buttons
          soft: '#F6D9D1',
          peach: '#F0B39C',
        },
        mist: {
          DEFAULT: '#A9C4CF', // dusty blue section
          soft: '#D7E4EA',
          deep: '#3F5F6C',
        },
        cabin: {
          DEFAULT: '#4A4037', // hero cabin wall
          dark: '#2B241F',
          light: '#6B5E50',
        },
        status: {
          safe: '#2F6B4F',
          'safe-bg': '#DCE8DF',
          caution: '#8A5A12',
          'caution-bg': '#F3E3C2',
          high: '#A4461A',
          'high-bg': '#F6DCC9',
          danger: '#B8321C',
          'danger-bg': '#F6D9D1',
          unknown: '#5F5850',
          'unknown-bg': '#E4DED4',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        display: '-0.01em',
        label: '0.08em',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        drift: {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(-14px)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        drift: 'drift 18s ease-in-out infinite',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
