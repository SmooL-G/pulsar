import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Solana SDKs depend on a Node-style Buffer global; without this the
    // vendor-solana chunk crashes on load with "Cannot read properties of
    // undefined (reading 'Buffer')".
    nodePolyfills({
      include: ['buffer', 'process'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
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
        // Function form lets us also split app code by feature folder, not
        // just node_modules. Single 800KB chunk was still tripping the
        // upstream proxy.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // NOTE: do NOT split @solana out — it touches the Buffer global
            // at module-eval time. With it in a separate chunk, the chunk
            // loads before the node-polyfills shim runs and crashes. Bundling
            // it with the rest of vendor keeps initialization order correct.
            if (id.includes('react-router')) return 'vendor-react';
            if (id.includes('react-dom')) return 'vendor-react';
            if (/[\\/]node_modules[\\/]react[\\/]/.test(id)) return 'vendor-react';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('date-fns')) return 'vendor-date';
            if (id.includes('react-hot-toast') || id.includes('zustand')) return 'vendor-ui';
            return 'vendor';
          }
          if (id.includes('/src/components/admin/')) return 'admin';
          if (id.includes('/src/components/wallet/')) return 'wallet';
          if (id.includes('/src/components/settings/')) return 'settings';
          if (id.includes('/src/components/chat/')) return 'chat';
          if (id.includes('/src/pages/')) return 'pages';
          if (id.includes('/src/i18n/')) return 'i18n';
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
