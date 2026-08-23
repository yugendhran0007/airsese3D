import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Split the big vendor libraries so the browser caches them independently
        // and the app shell reaches first paint sooner.
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
          recharts: ['recharts'],
          react: ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
});
