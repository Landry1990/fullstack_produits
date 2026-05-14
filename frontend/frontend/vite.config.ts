/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
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
          // Core - toujours necessaire
          'vendor-core': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          // Data & API
          'vendor-query': ['@tanstack/react-query'],
          'vendor-http': ['axios'],
          // UI & utils
          'vendor-ui': ['react-hot-toast', 'lucide-react'],
          'vendor-dates': ['date-fns'],
          'vendor-i18n': ['react-i18next', 'i18next'],
          // Features groupes (eviter trop de petits chunks)
          'feature-inventory': ['./src/components/Inventaire', './src/components/EtatsInventaire', './src/components/Organisation'],
          'feature-reports': ['./src/components/RapportMensuel', './src/components/CentreRapports', './src/components/AnalyseABC'],
          'feature-history': ['./src/components/HistoriqueVentes', './src/components/HistoriqueAchats', './src/components/HistoriqueClotures']
        },
        // Eviter les noms de chunks avec hash pour le debug
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    // Optimisation du bundle
    target: 'esnext',
    minify: 'esbuild',
    // Optimiser le chargement
    modulePreload: {
      polyfill: true
    },
    // Reduire la taille des chunks
    chunkSizeWarningLimit: 500,
    // Source maps pour debug en production si necessaire
    sourcemap: false
  },

  server: {
    host: '0.0.0.0', // Accepte les connexions de tous les appareils du réseau
    port: 4000,
    strictPort: true,
    allowedHosts: true, // Autorise l'accès via n'importe quel nom d'hôte (réseau local)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
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
      usePolling: true
    }
  },

  // Amélioration des performances d'analyse des fichiers
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
})
