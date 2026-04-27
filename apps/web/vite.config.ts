import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Split heavy 3rd-party deps into separate chunks. The single 1.5MB
    // bundle was tripping the upstream myjino HTTP/2 proxy with
    // ERR_HTTP2_PROTOCOL_ERROR. Many smaller chunks transfer reliably
    // and also enable parallel download.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'solana': [
            '@solana/web3.js',
            '@solana/wallet-adapter-react',
            '@solana/wallet-adapter-react-ui',
            '@solana/wallet-adapter-base',
            '@solana/wallet-adapter-wallets',
          ],
          'icons': ['lucide-react'],
          'ui-misc': ['date-fns', 'react-hot-toast', 'zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
