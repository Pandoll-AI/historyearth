import { defineConfig } from 'vite';
export default defineConfig({
  base: '/',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500, rollupOptions: { output: { manualChunks: (id: string) => (id.includes('maplibre-gl') ? 'maplibre' : undefined) } } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any);
