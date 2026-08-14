/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      manifestFilename: 'manifest.json',
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],
        globIgnores: ['**/*tesseract*.wasm*', '**/tesseract*.js'],
        // Ne pas intercepter les requêtes API — elles doivent toujours atteindre le backend
        navigateFallbackDenylist: [/^\/api\/.*/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          // Images statiques (logos, photos produits) — CacheFirst 30 jours
          {
            urlPattern: /\/media\/.*\.(?:png|jpg|jpeg|webp|svg|gif|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          // Health check — NetworkFirst (ne pas masquer un backend down)
          {
            urlPattern: /\/api\/health\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-health',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 }
            }
          }
        ]
      },
      includeAssets: ['favicon.svg', 'pwa-icon-192x192.png', 'pwa-icon-512x512.png'],
      devOptions: {
        enabled: false
      }
    })
  ],
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
    // Tesseract chargé dynamiquement — ne pas pré-bundler
    exclude: ['tesseract.js', 'tesseract.js-core']
  },

  // Amélioration des performances de build
  build: {
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
          // Feature inventory découpé en sous-chunks
          'feature-inventory': ['./src/components/Inventaire'],
          'feature-inventory-editor': ['./src/components/inventaire/editor/InventaireEditor'],
          'feature-inventory-states': ['./src/components/EtatsInventaire', './src/components/Organisation'],
          // Reports
          'feature-reports': ['./src/components/RapportMensuel', './src/components/CentreRapports', './src/components/AnalyseABC'],
          // History
          'feature-history': ['./src/components/HistoriqueVentes', './src/components/HistoriqueAchats', './src/components/HistoriqueClotures'],
          // Caisse & cash register
          'feature-caisse': ['./src/components/CaisseCentralisee', './src/components/JournalCaisse'],
          // Settings & admin
          'feature-settings': ['./src/components/settings/PharmacySettingsForm', './src/components/GestionUtilisateurs', './src/components/SystemAdmin'],
          // Dashboard
          'feature-dashboard': ['./src/components/DashboardManagerShadcn', './src/components/DashboardShadcn'],
          // Produits & facturation (pages principales mais lazy-loaded)
          'feature-produits': ['./src/components/ProduitShadcn'],
          'feature-ventes': ['./src/components/Ventes', './src/components/Facturation'],
          // Commandes
          'feature-commandes': ['./src/components/Commandes'],
          // Compta
          'feature-compta': ['./src/components/compta/Comptabilite'],
          // Printing
          'feature-printing': ['./src/components/printing/PrintPage'],
          // Heavy libs - isolated so they don't bloat the main chunk
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-xlsx': ['xlsx'],
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    target: 'esnext',
    minify: 'esbuild',
    modulePreload: {
      polyfill: true
    },
    chunkSizeWarningLimit: 600,
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
