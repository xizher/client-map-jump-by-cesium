import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import viteCompression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  server: {
    port: 8085,
    proxy: {
      '/cesium': {
        target: 'http://192.168.3.47/cesium',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/cesium/, '')
      },
    },
  },
  plugins: [
    reactRefresh(),
    viteCompression(),
  ]
})
