# Aplikasi Penyewaan Garasi

Aplikasi web penyewaan garasi kendaraan dengan dua peran: Admin dan Penyewa. Garasi tersedia untuk Sepeda, Mobil, dan Mobil Listrik dan dapat disewa harian maupun bulanan.

## Prasyarat

- Node.js >= 24
- PostgreSQL 17

## Instalasi

1. Jalankan `npm install`.
2. Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL`, `TEST_DATABASE_URL` (nama database berakhiran `_test`), `SESSION_SECRET`, `ADMIN_EMAIL`, dan `ADMIN_PASSWORD`.
3. Jalankan `npm run setup` untuk membuat tabel dan akun Admin.

## Menjalankan

Jalankan `npm start`, lalu buka http://localhost:3000. Admin masuk memakai `ADMIN_EMAIL` dan `ADMIN_PASSWORD` dari `.env`.

## Pengujian

Jalankan `npm run test:e2e`. Pengujian hanya memakai dan mengosongkan database `_test`, bukan database aplikasi.
