/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Accent — hungriAR brand gold (matches the QR menu + admin panel).
        // Token keeps the historical name "ember" so every existing
        // ember-* class stays valid; only the values changed.
        ember: {
          DEFAULT: '#d4a373',
          light: '#e6c69a',
          mid: '#ddb586',
          dark: '#b8865a',
        },
        // Near-black canvas of the QR menu
        ink: {
          DEFAULT: '#07070f',
          raised: '#0e0e1c',
        },
        // Legacy brand tokens (still referenced in a few spots)
        gold: {
          DEFAULT: '#D4A373',
          dark: '#b98a5e',
          light: '#f3e5d5',
        },
        navy: {
          DEFAULT: '#0F172A',
          light: '#1e293b',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'ember-glow': '0 4px 18px rgba(212, 163, 115,0.4)',
        'ember-glow-lg': '0 8px 36px rgba(212, 163, 115,0.5)',
      },
    },
  },
  plugins: [],
};
