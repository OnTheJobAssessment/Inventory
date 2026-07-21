/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1C2321',
        slate: {
          850: '#172025',
        },
        brand: {
          50: '#eef6f5',
          100: '#d3e9e6',
          200: '#a8d3cd',
          300: '#78b8af',
          400: '#4c9c90',
          500: '#2f7f73',
          600: '#23655c',
          700: '#1c514a',
          800: '#17403b',
          900: '#12312d',
        },
        amber: {
          400: '#e0a63a',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
