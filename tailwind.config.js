/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // === Brand colors — wire vào CSS variables ===
        primary: {
          DEFAULT: '#003366',
          hover:   '#002244',
          light:   '#EEF3FA',
        },
        // === Semantic colors ===
        success: '#059669',
        warning: '#D97706',
        danger:  '#DC2626',
        info:    '#2563EB',
      },
      borderRadius: {
        // Đồng nhất border radius theo design system
        sm:   '6px',
        DEFAULT: '12px',   // rounded = rounded-xl
        md:   '12px',      // input, button, card
        lg:   '16px',      // modal, drawer
        xl:   '12px',
        '2xl':'16px',
        '3xl':'24px',
      },
      boxShadow: {
        card:  '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        hover: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        modal: '0 20px 50px -10px rgb(0 0 0 / 0.18)',
      },
      fontFamily: {
        sans: ['Josefin Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
