/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      spacing: {
        // 아이콘용 18px — web/tailwind.config.ts와 같은 값
        '4.5': '1.125rem',
      },
    },
  },
  plugins: [],
};
