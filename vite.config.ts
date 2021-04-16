import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'

// https://vitejs.dev/config/
export default defineConfig({
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
    reactRefresh()
  ]
})
