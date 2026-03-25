/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#3b82f6',
          soft: '#dbeafe',
        },
        surface: {
          primary: '#f6f7fb',
          secondary: '#ffffff',
          tertiary: '#eef1f6',
        },
      },
      borderRadius: {
        'xl': '20px',
        '2xl': '28px',
      },
      boxShadow: {
        'soft': '6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff',
        'card': '0 10px 30px rgba(0,0,0,0.05)',
        'hover': '0 15px 40px rgba(0,0,0,0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}