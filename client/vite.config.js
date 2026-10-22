import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy keeps the httpOnly cookie same-origin in dev.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:5000' } },
})
