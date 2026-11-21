/**
 * @file Konfigurasi Next.js.
 *
 * Memakai pengaturan bawaan kecuali batas ukuran isi permintaan Server Action
 * untuk unggahan bukti pembayaran. Next.js sudah menjaga paket @prisma/client,
 * prisma, pg, dan typescript tetap berada di luar bundel server.
 */
import type { NextConfig } from 'next';

/**
 * Konfigurasi Next.js aplikasi.
 *
 * Batas bawaan isi permintaan Server Action hanya 1 MB, sedangkan bukti
 * pembayaran boleh sampai 2 MB. Angka itu dihitung dari seluruh isi permintaan
 * (termasuk pembatas multipart dan field teks), maka batas dinaikkan ke 3 MB:
 * berkas 2 MB ditambah beban multipart tetap muat, dan berkas yang sedikit
 * lebih besar dari 2 MB masih sampai ke server sehingga ditolak dengan pesan
 * field yang jelas, bukan error umum.
 */
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '3mb',
    },
  },
};

export default nextConfig;
