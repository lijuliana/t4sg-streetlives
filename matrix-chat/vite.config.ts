import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward /api requests to the Express backend during development.
      "/api": "http://localhost:3000",
    },
  },
  optimizeDeps: {
    // matrix-sdk-crypto-wasm uses `new URL('./pkg/...wasm', import.meta.url)` to
    // locate its WASM binary at runtime. esbuild would rewrite import.meta.url to
    // point to the bundled output, breaking the path. Excluding it from pre-bundling
    // lets Vite serve it as native ESM so the URL stays correct.
    exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
  },
})
