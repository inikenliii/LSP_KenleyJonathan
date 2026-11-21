/**
 * @file Konfigurasi Vitest.
 *
 * Berkas uji dijalankan satu per satu karena semuanya memakai database uji
 * yang sama dan mengosongkan tabelnya sebelum tiap tes.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    globalSetup: ['test/setup/global.ts'],
  },
});
