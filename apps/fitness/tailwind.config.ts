import type {Config} from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { cream: '#FFFBF0', leaf: '#1A7F4D', haldi: '#E8A415', ink: '#1A1A1A', muted: '#6B6B6B' }, borderRadius: { xl2: '1.25rem' } } },
  plugins: []
} satisfies Config;
