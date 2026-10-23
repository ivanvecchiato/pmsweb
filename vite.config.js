import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const cloud = mode === 'cloud'
  return {
    plugins: [
      vue(),
      vueDevTools(),
      {
        name: 'pms-build-target',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'app-target.json', source: JSON.stringify({ target: cloud ? 'cloud' : 'local' }) })
        }
      },
    ],
    define: {
      'import.meta.env.VITE_DATA_SOURCE': JSON.stringify(cloud ? 'firebase' : 'api'),
      ...(cloud ? {
        'import.meta.env.VITE_PMS_API_BASE_URL': JSON.stringify(''),
        'import.meta.env.VITE_STATS_API_BASE_URL': JSON.stringify('')
      } : {})
    },
    build: { outDir: cloud ? 'dist-cloud' : 'dist' },
    server: cloud ? { port: 5178 } : {
      proxy: {
        '/api': {
          target: 'http://localhost:8088',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
  }
})
