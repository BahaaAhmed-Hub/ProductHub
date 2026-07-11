import type { Config } from 'tailwindcss';

/**
 * ProductHub design tokens — "Pilot" visual direction.
 * Source of truth: FlowDesk design package (README.md tokens).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1B2A4A', // primary: headers, primary buttons, dark hero
        canvas: '#F7F7F5', // app shell background
        canvas2: '#E6E5E1', // deeper canvas / hero edge
        surface: '#FFFFFF', // card / panel
        hairline: '#E2E1DC', // 0.5px borders
        label: '#8A8983', // uppercase eyebrow labels
        body: '#565B66', // secondary body text
        ink: '#1B2A4A', // primary text (== navy)
        accent: {
          DEFAULT: '#2367A9', // links, info highlight
          bg: '#EAF1FB', // active nav bg
          soft: '#E7F0FB',
        },
        success: { DEFAULT: '#1D9E75', bg: '#E5F4EE' },
        danger: { DEFAULT: '#B23230', bg: '#FBEAE9' },
        pm: { DEFAULT: '#3F3791', bg: '#EFEDF8' }, // PM-role purple accent
        // Analytics / Lens (screens 26–28, 34)
        friction: { high: '#C93535', med: '#D97706', low: '#639922' },
        ai: { surface: '#EEEDFB', accent: '#4B44B6' },
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      borderRadius: {
        frame: '14px', // Pilot card/frame radius
        control: '9px', // buttons/inputs
      },
      boxShadow: {
        frame: '0 1px 3px rgba(0,0,0,0.06)',
        pop: '0 8px 28px rgba(27,42,74,0.12)',
      },
      fontSize: {
        eyebrow: ['11px', { lineHeight: '1.2', letterSpacing: '0.05em' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
