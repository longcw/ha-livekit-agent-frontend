import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Builds the card into ONE self-contained ESM module that the HA integration serves and
// registers as a frontend module. React + @livekit/components-react + livekit-client are
// all bundled in, so the HA host needs no Node/runtime dependencies — it just serves the
// file. Output goes straight into the integration's served directory.
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  esbuild: {
    // The card mounts React inside a shadow root; JSX runtime is React 19 automatic.
    legalComments: 'none',
  },
  build: {
    target: 'es2020',
    minify: true,
    cssCodeSplit: false,
    outDir: '../custom_components/livekit_voice/frontend',
    emptyOutDir: false,
    lib: {
      entry: 'src/card.tsx',
      formats: ['es'],
      fileName: () => 'livekit-voice-card.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
