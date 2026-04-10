import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Movida Event Manager',
        short_name: 'MovidaApp',
        description: 'Gestore Preventivi Offline',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Mette in cache tutti i file generati da Vite
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}'],
        
        // --- RISOLUZIONE ERRORE VERCEL ---
        // Aumenta il limite di caching per singolo file a 4 MB (il default è 2 MB)
        maximumFileSizeToCacheInBytes: 4194304 
      }
    })
  ],
  // --- OTTIMIZZAZIONE PERFORMANCE ---
  build: {
    rollupOptions: {
      output: {
        // Divide le librerie (node_modules) dal tuo codice per evitare file JS troppo grandi
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
});