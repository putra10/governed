import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: '/governed/',
  publicDir: false,
  build: {
    outDir: 'docs',
    emptyOutDir: true
  },
  server: {
    port: 4444,
    open: true
  }
})
