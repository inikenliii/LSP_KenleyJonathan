/**
 * @file Konfigurasi Next.js.
 *
 * Memakai pengaturan bawaan kecuali batas ukuran isi permintaan Server Action
 * untuk unggahan bukti pembayaran dan header keamanan dasar. Next.js sudah
 * menjaga paket @prisma/client, prisma, pg, dan typescript tetap berada di
 * luar bundel server.
 */
import type { NextConfig } from 'next';

/**
 * Header keamanan dasar untuk semua rute: halaman tidak boleh dibingkai situs
 * lain (anti clickjacking), tipe konten tidak ditebak, alamat asal hanya
 * dikirim ke situs seasal lengkap, dan fitur perangkat yang tidak dipakai
 * dimatikan. Content-Security-Policy sengaja hanya berisi `frame-ancestors`
 * agar tidak mengganggu skrip dan gaya yang dibuat Next.js dan Tailwind.
 * HSTS tidak dipasang karena aplikasi didemokan lewat http://localhost.
 */
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/**
 * Konfigurasi Next.js aplikasi.
 *
 * Batas bawaan isi permintaan Server Action hanya 1 MB, sedangkan bukti
 * pembayaran boleh sampai 2 MB. Angka itu dihitung dari seluruh isi permintaan
 * (termasuk pembatas multipart dan field teks), maka batas dinaikkan ke 3 MB:
 * berkas 2 MB ditambah beban multipart tetap muat, dan berkas yang sedikit
 * lebih besar dari 2 MB masih sampai ke server sehingga ditolak dengan pesan
 * field yang jelas, bukan error umum.
 *
 * Catatan: batas 3 MB ini ditegakkan Next.js sebelum kode aplikasi berjalan.
 * Permintaan yang dibuat langsung (di luar formulir) dengan isi lebih dari 3 MB
 * ditolak dengan galat HTTP umum dan tidak ada data yang tersimpan; formulir
 * sendiri sudah memblokir berkas di atas 2 MB di sisi klien.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '3mb',
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
