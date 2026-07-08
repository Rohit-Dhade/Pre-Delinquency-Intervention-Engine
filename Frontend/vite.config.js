import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/predict': 'http://localhost:8000',
      '/customers': 'http://localhost:8000',
      '/intervention': 'http://localhost:8000',
      '/admin': 'http://localhost:8000',
    },
  },
})
