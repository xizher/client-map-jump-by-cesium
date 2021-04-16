module.exports = {
  purge: [
    './src/**/*.vue',
    './src/**/*.css',
  ],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      lineHeight: {
        '64': '64px'
      },
      height: {
        'full-64': 'calc(100vh - 64px)'
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
