/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Every colour resolves to a CSS custom property, so a theme switch is a
        // single attribute change on the document element. The values are the
        // JavaScript mirror in src/lib/theme.ts.
        lab: {
          950: 'rgb(var(--lab-950) / <alpha-value>)',
          900: 'rgb(var(--lab-900) / <alpha-value>)',
          850: 'rgb(var(--lab-850) / <alpha-value>)',
          800: 'rgb(var(--lab-800) / <alpha-value>)',
          700: 'rgb(var(--lab-700) / <alpha-value>)',
          600: 'rgb(var(--lab-600) / <alpha-value>)',
          500: 'rgb(var(--lab-500) / <alpha-value>)',
          400: 'rgb(var(--lab-400) / <alpha-value>)',
          300: 'rgb(var(--lab-300) / <alpha-value>)',
          200: 'rgb(var(--lab-200) / <alpha-value>)',
          100: 'rgb(var(--lab-100) / <alpha-value>)',
        },
        signal: {
          blue: 'rgb(var(--signal-blue) / <alpha-value>)',
          orange: 'rgb(var(--signal-orange) / <alpha-value>)',
          green: 'rgb(var(--signal-green) / <alpha-value>)',
          red: 'rgb(var(--signal-red) / <alpha-value>)',
          violet: 'rgb(var(--signal-violet) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.03) inset, 0 10px 30px -18px rgba(0,0,0,0.9)',
        lift: '0 24px 60px -24px rgba(0,0,0,0.75)',
      },
      transitionTimingFunction: {
        swift: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'sweep': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
        sweep: 'sweep 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
