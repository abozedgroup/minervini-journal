/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#07080a',
        s1: '#0e1016',
        s2: '#141720',
        s3: '#1a1f2e',
        border: '#1e2438',
        gold: '#f0b429',
        teal: '#06d6a0',
        red: '#ef476f',
        blue: '#118ab2',
        purple: '#9b5de5',
        muted: '#4a5578',
        fg: '#e2e8f0',
      },
    },
  },
  plugins: [],
}
