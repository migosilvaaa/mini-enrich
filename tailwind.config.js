/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        navy: {
          DEFAULT: '#050038',
          50: '#f0f0ff',
          100: '#e0e0ff',
          900: '#050038',
        },
      },
    },
  },
  plugins: [],
}
