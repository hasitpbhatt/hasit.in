/** @type {import('tailwindcss').Config} */

// Canonical colours are hex values from /theme.css, so Tailwind's default
// `rgb(var(--x) / <alpha>)` opacity syntax produces invalid CSS. Emitting
// color-mix() instead makes `bg-gain/10` & friends actually work.
const token = (name) => ({ opacityValue }) =>
  opacityValue === undefined
    ? `var(${name})`
    : `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('--bg'),
        surface: token('--surface'),
        'surface-2': token('--surface-2'),
        line: token('--border'),
        content: token('--text-primary'),
        muted: token('--text-secondary'),
        accent: {
          DEFAULT: token('--accent'),
          hover: token('--accent-hover'),
        },
        gain: token('--success'),
        loss: token('--danger'),
        warn: token('--warning'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', '1.4'],   // 10px
        xs: ['0.6875rem', '1.45'],    // 11px
        sm: ['0.8125rem', '1.5'],     // 13px
        base: ['1rem', '1.55'],       // 16px
        lg: ['1.125rem', '1.5'],      // 18px
        xl: ['1.25rem', '1.5'],       // 20px
        '2xl': ['1.5rem', '1.4'],     // 24px
        '3xl': ['1.875rem', '1.3'],   // 30px
      },
    },
  },
  plugins: [],
}
