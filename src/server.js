/**
 * @file Titik masuk aplikasi (`npm start`): menyalakan server HTTP dan
 * menutup koneksi dengan rapi saat proses dihentikan.
 */
import { env } from './config/env.js';
import { prisma, pgPool, disconnectDatabase } from './db/prisma.js';
import { createApp } from './app.js';

const app = createApp({ prisma, pgPool });

/** Server HTTP yang sedang berjalan. */
export const server = app.listen(env.PORT, () => {
  console.log(`Server berjalan di http://localhost:${env.PORT}`);
});

/**
 * Menghentikan server, penyimpanan sesi, dan koneksi database lalu keluar.
 *
 * @returns {void}
 */
function shutdown() {
  server.close(async () => {
    await app.locals.sessionStore.close();
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
