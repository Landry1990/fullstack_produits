/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },

  // Optimisation: pré-bundle les dépendances principales pour un démarrage plus rapide
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'react-hot-toast',
      '@tanstack/react-query'
    ],
    // Exclure les gros modules qui ne sont pas toujours utilisés
    exclude: []
  },

  // Amélioration des performances de build
  build: {
    // Chunking pour mieux utiliser le cache navigateur
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-utils': ['axios', 'react-hot-toast'],
          'vendor-query': ['@tanstack/react-query']
        }
      }
    },
    // Optimisation du bundle
    target: 'esnext',
    minify: 'esbuild'
  },

  server: {
    host: '0.0.0.0', // Accepte les connexions de tous les appareils du réseau
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    },
    // Amélioration du HMR
    hmr: {
      overlay: true
    },
    // Amélioration du watch mode sur Windows
    watch: {
      usePolling: false
    }
  },

  // Amélioration des performances d'analyse des fichiers
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
})
