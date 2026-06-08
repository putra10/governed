import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: '/hunt.github.io/',
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
