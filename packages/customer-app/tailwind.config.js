/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Ember accent — same palette as the hungriAR QR menu
        ember: {
          DEFAULT: '#d3552f',
          light: '#ff8060',
          mid: '#ff6b3d',
          dark: '#c04020',
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
        'ember-glow': '0 4px 18px rgba(211,85,47,0.4)',
        'ember-glow-lg': '0 8px 36px rgba(211,85,47,0.5)',
      },
    },
  },
  plugins: [],
};
