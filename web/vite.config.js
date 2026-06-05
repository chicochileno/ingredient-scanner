import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ command }) => ({
  base: '/',
  plugins: command === 'serve' ? [react(), basicSsl()] : [react()],
  server: {
    host: true,
    proxy: {
      '/scan': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
}))
