# Aplikasi Penyewaan Garasi

Aplikasi web penyewaan garasi kendaraan (sepeda, mobil, dan mobil listrik) dengan dua peran, Admin dan Penyewa, yang dibangun dengan Next.js dan PostgreSQL.

## Prasyarat

- Node.js 24 atau lebih baru
- PostgreSQL 17

## Instalasi

1. Jalankan `npm install`.
2. Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL`, `TEST_DATABASE_URL` (nama database harus berakhiran `_test`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, dan `ADMIN_NAME`.
3. Jalankan `npm run setup` untuk membuat tabel dan akun Admin.

## Menjalankan

Jalankan `npm start` untuk membangun aplikasi dan melayaninya di http://localhost:3000. Untuk pengembangan, pakai `npm run dev`. Admin masuk memakai `ADMIN_EMAIL` dan `ADMIN_PASSWORD` dari `.env`.

## Pengujian

Jalankan `npm test`. Pengujian hanya memakai dan mengosongkan database `_test`, bukan database aplikasi.
