/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Regroupement des chunks VENDOR uniquement (node_modules).
// Les pages/features ne doivent PAS avoir de chunk manuel : des groupes
// feature-* imposés créent des imports circulaires entre chunks (modules
// partagés placés selon le premier importateur) qui laissent des bindings
// non initialisés à l'évaluation → page blanche au boot, intermittente
// selon l'ordre réseau. Rollup découpe les routes lazy et mutualise le
// code partagé automatiquement, sans cycle.
const RADIX_CHUNK_DEPS = [
  '@radix-ui',
  'aria-hidden',
  'react-remove-scroll',
  'react-remove-scroll-bar',
  'react-style-singleton',
  'get-nonce',
  'detect-node-es',
];

const CHUNK_GROUPS: Record<string, string[]> = {
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
  // Heavy libs - isolated so they don't bloat the main chunk
  'vendor-pdf': ['jspdf', 'jspdf-autotable'],
  'vendor-xlsx': ['xlsx'],
};

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
        // maintenance.html est servi par nginx en `internal` (404 externe) —
        // le precacher ferait échouer l'install du service worker.
        // Les grosses libs lazy (pdf/xlsx/barcode/ocr…) sont exclues du
        // precache : elles sont récupérées à la demande puis gardées par le
        // runtime cache CacheFirst ci-dessous (noms hashés → immutables).
        globIgnores: [
          '**/*tesseract*', '**/worker.min-*.js', 'maintenance.html',
          '**/vendor-pdf-*.js', '**/vendor-xlsx-*.js', '**/bwip-js-*.js',
          '**/html2canvas*.js', '**/purify.es-*.js', '**/index.es-*.js',
          '**/react-datepicker-*', '**/qz-tray-*.js', '**/JsBarcode-*.js',
          '**/coerce-*.js',
        ],
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
          },
          // Assets hashés non précachés (libs lazy) — immutables → CacheFirst.
          // Après la 1re utilisation elles restent en cache 30 j.
          {
            urlPattern: /\/assets\/.*\.(?:js|css|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lazy-assets',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      },
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'pwa-icon-192x192.png', 'pwa-icon-512x512.png'],
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
        manualChunks(id: string) {
          // Helpers internes Vite (`\0vite/preload-helper` = __vitePreload,
          // utilisé par CHAQUE import() dynamique) — doivent vivre dans le
          // chunk core. Sinon Rollup les place dans un chunk arbitraire
          // (observé : vendor-pdf) qui devient dépendance statique de
          // toutes les pages → 400 Ko de jsPDF téléchargés à chaque boot.
          if (id.includes('preload-helper') || id.startsWith('\0vite')) {
            return 'vendor-core';
          }
          // Radix UI + dépendances partagées dans un chunk dédié
          if (RADIX_CHUNK_DEPS.some(p => id.includes(`node_modules/${p}`))) {
            return 'vendor-radix';
          }
          for (const [chunk, modules] of Object.entries(CHUNK_GROUPS)) {
            if (modules.some(m => id.includes(m.startsWith('/') ? m : `node_modules/${m}/`))) {
              return chunk;
            }
          }
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
