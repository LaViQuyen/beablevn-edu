/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // === Brand colors, 1 NGUỒN SỰ THẬT ===
        // Màu định nghĩa dạng RGB triplet trong :root (src/index.css); đổi màu brand
        // chỉ cần sửa biến ở đó là lan ra cả app. <alpha-value> giữ được opacity (bg-primary/10).
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          hover:   'rgb(var(--color-primary-hover) / <alpha-value>)',
          light:   'rgb(var(--color-primary-light) / <alpha-value>)',
          medium:  'rgb(var(--color-primary-medium) / <alpha-value>)',
          subtle:  'rgb(var(--color-primary-subtle) / <alpha-value>)',
        },
        // === Semantic colors ===
        success: '#059669',
        warning: '#D97706',
        danger:  '#DC2626',
        info:    'rgb(var(--color-primary) / <alpha-value>)',
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
        sans: ['Be Vietnam Pro', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
