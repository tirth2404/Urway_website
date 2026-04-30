import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Use ES format but without code splitting for extensions
        format: 'es',
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        // Disable code splitting completely
        manualChunks: undefined,
        inlineDynamicImports: true
      }
    },
    // Use esbuild for minification (default, faster than terser)
    minify: 'esbuild',
    target: 'es2015'
  }
})