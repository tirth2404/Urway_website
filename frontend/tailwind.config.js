/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0f',
        'ink-muted': '#3d3d4f',
        paper: '#f5f3ee',
        'paper-warm': '#ede9e0',
        accent: '#d4502a',
        'accent-light': '#f5cbbf',
        gold: '#c9963b',
        'gold-light': '#f5e8cc',
        teal: '#1a7a6e',
        'teal-light': '#b8e0da',
        border: '#c8c4ba',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Instrument Sans', 'Helvetica Neue', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'brutal': '5px 5px 0 #0a0a0f',
        'brutal-sm': '3px 3px 0 #0a0a0f',
        'brutal-lg': '8px 8px 0 #0a0a0f',
        'brutal-accent': '5px 5px 0 #d4502a',
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'rise': 'rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}