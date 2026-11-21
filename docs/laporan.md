# Laporan Uji Praktik: Aplikasi Penyewaan Garasi

## 1. Identitas dan Ringkasan Aplikasi

| Butir | Isi |
| --- | --- |
| Nama peserta | Kenley Jonathan |
| Skema sertifikasi | Pemrogram, nomor IMT.01.15/SSK/LSP/IX/2021 |
| Formulir | FR.IA.04A |
| Lembaga | Universitas Ciputra |
| Asesor | Citra Lestari |

Aplikasi ini adalah aplikasi web untuk perusahaan penyewaan garasi kendaraan. Garasi ada tiga tipe: sepeda, mobil, dan mobil listrik. Garasi disewa harian atau bulanan, dan datanya disimpan di database relasional PostgreSQL.

Ada dua peran:

- **Admin** (dibuat lewat seed, bukan lewat registrasi): memverifikasi pendaftar, membuat garasi secara berkelompok dan mengatur harganya, melihat daftar garasi, memperpanjang sewa yang sedang aktif, dan melihat laporan penyewaan per bulan, per hari, per tipe garasi, dan per penyewa.
- **Penyewa**: mendaftar, masuk setelah pendaftarannya diterima Admin, membuat sewa baru (harian atau bulanan) dengan mengunggah bukti pembayaran, dan melihat daftar sewanya.

## 2. Teknologi dan Penjelasan Library

Perangkat lunak pendukung: Node.js versi 24 atau lebih baru (sesuai kolom engines pada `package.json`), PostgreSQL 17 sebagai database, dan Git untuk pengelolaan versi.

Tabel berikut memuat setiap paket pada `package.json` dengan versi persis yang dipasang.

| Library | Versi | Kegunaan | Dipakai di |
| --- | --- | --- | --- |
| `@base-ui/react` | 1.9.0 | Komponen antarmuka dasar tanpa gaya yang menjadi fondasi komponen shadcn/ui | `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/checkbox.tsx` |
| `@prisma/adapter-pg` | 7.10.1 | Adapter driver PostgreSQL untuk klien Prisma | `src/lib/prisma-client.ts` |
| `@prisma/client` | 7.10.1 | Pustaka runtime klien ORM Prisma; klien hasil `prisma generate` berada di `src/generated` | `src/generated`, `src/lib/db.ts` |
| `bcryptjs` | 3.0.3 | Menghash dan memverifikasi password | `src/lib/password-hasher.ts` |
| `class-variance-authority` | 0.7.1 | Menyusun varian gaya komponen (ukuran, warna) | `src/components/ui/button.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/alert.tsx` |
| `clsx` | 2.1.1 | Menggabungkan nama class secara kondisional | `src/lib/utils.ts` |
| `lucide-react` | 1.77.0 | Ikon antarmuka | `src/components/ui/checkbox.tsx` |
| `motion` | 14.14.0 | Animasi muncul pada halaman dan kartu | `src/components/motion/FadeIn.tsx` |
| `next` | 16.4.6 | Kerangka web (App Router, Server Component, Server Action, Turbopack) | `src/app` |
| `prisma` | 7.10.1 | CLI untuk migrasi, pembuatan klien, dan seed | `prisma.config.ts`, `prisma/schema.prisma` |
| `react` | 19.3.1 | Pustaka antarmuka komponen | `src/app/layout.tsx`, `src/components` |
| `react-dom` | 19.3.1 | Perender React di browser; dimuat oleh Next.js sehingga tidak diimpor langsung di kode sumber | Dipakai Next.js untuk merender `src/app` |
| `server-only` | 0.0.1 | Menjamin modul tertentu tidak pernah ikut terkirim ke browser | `src/lib/container.ts`, `src/lib/db.ts` |
| `tailwind-merge` | 3.7.1 | Menyelesaikan class Tailwind yang bertabrakan | `src/lib/utils.ts` |
| `tw-animate-css` | 1.4.0 | Kelas animasi tambahan untuk Tailwind | `src/app/globals.css` |
| `zod` | 4.6.7 | Validasi masukan formulir dan pesan galat Bahasa Indonesia | `src/validation` |
| `@tailwindcss/postcss` | 4.3.5 | Plugin PostCSS untuk Tailwind CSS | `postcss.config.mjs` |
| `@types/node` | 26.6.6 | Definisi tipe TypeScript untuk Node.js | `tsconfig.json` |
| `@types/react` | 19.3.0 | Definisi tipe TypeScript untuk React | `src/components`, `src/app` |
| `@types/react-dom` | 19.3.0 | Definisi tipe TypeScript untuk React DOM | `src/app` |
| `dotenv` | 18.0.10 | Membaca berkas `.env` untuk Prisma CLI, seed, dan pengujian | `prisma.config.ts`, `prisma/seed.ts`, `test/setup/global.ts` |
| `shadcn` | 4.23.0 | Perkakas komponen shadcn/ui dan gaya dasarnya | `components.json`, `src/app/globals.css` |
| `tailwindcss` | 4.3.5 | Kerangka gaya berbasis class utilitas | `src/app/globals.css` |
| `tsx` | 4.23.15 | Menjalankan seed TypeScript tanpa kompilasi manual | `prisma.config.ts` |
| `typedoc` | 0.28.20 | Membuat dokumentasi API dari komentar TSDoc | `typedoc.json` |
| `typescript` | 6.0.3 | Bahasa dan pemeriksa tipe | `tsconfig.json` |
| `vite` | 8.3.8 | Mesin bundel yang menjadi dasar Vitest | `vitest.config.ts` |
| `vitest` | 5.1.1 | Kerangka pengujian unit | `vitest.config.ts`, `test` |

## 3. Arsitektur dan Konsep Pemrograman

### 3.1 Arsitektur berlapis

| Lapisan | Folder | Tugas |
| --- | --- | --- |
| Domain | `src/domain` | Kelas dan fungsi aturan bisnis murni (harga, tanggal, ID garasi, kecocokan kendaraan, perpanjangan, laporan, hierarki error) tanpa akses database |
| Validasi | `src/validation` | Skema Zod yang memeriksa isian formulir dan menghasilkan pesan galat Bahasa Indonesia |
| Repository | `src/repositories` | Satu-satunya tempat yang memakai Prisma dan SQL; menyembunyikan database di balik interface |
| Layanan | `src/services` | Alur kerja aplikasi (daftar, masuk, verifikasi, buat garasi, sewa, perpanjangan, laporan) yang memakai domain, validasi, dan repository |
| Perakitan | `src/lib/container.ts` | Membuat objek repository dan layanan lalu menyerahkannya ke halaman |
| Halaman dan aksi | `src/app` | Halaman Next.js dan Server Action; hanya mengambil layanan dari container |
| Komponen | `src/components` | Formulir, tabel laporan, tata letak, animasi, dan komponen antarmuka |

### 3.2 Konsep pemrograman berorientasi objek

| Konsep | Contoh nyata di kode | Berkas |
| --- | --- | --- |
| Kelas | Kelas pengguna dengan getter dan aturan akses | `src/domain/User.ts` |
| Enkapsulasi | Field privat `#id` dan `#status` pada garasi, `#props` pada pengguna, dan parameter konstruktor `private readonly` pada layanan | `src/domain/garage/Garage.ts`, `src/domain/User.ts`, `src/services/AuthService.ts` |
| Pewarisan | `Sepeda`, `Mobil`, dan `MobilListrik` mewarisi `Garage`; `Bicycle`, `Motorcycle`, `Car`, dan `ElectricCar` mewarisi `Vehicle`; semua error aplikasi mewarisi `AppError` | `src/domain/garage/Sepeda.ts`, `src/domain/garage/Mobil.ts`, `src/domain/garage/MobilListrik.ts`, `src/domain/vehicle.ts`, `src/domain/errors.ts` |
| Polimorfisme | Getter `type`, `label`, dan `idPrefix` ditimpa tiap subkelas garasi; `allowedGarageTypes` ditimpa tiap kendaraan; `usesKwhPrice` ditimpa `MobilListrik` | `src/domain/garage/MobilListrik.ts`, `src/domain/vehicle.ts` |
| Kelas abstrak | `Garage` dan `Vehicle` tidak bisa dibuat langsung dan memaksa subkelas mengisi anggota abstraknya | `src/domain/garage/Garage.ts`, `src/domain/vehicle.ts` |
| Interface | Interface layanan (`IAuthService`, `IRentalService`, dan lainnya), interface repository (`IUserRepository`, `IRentalRepository`, dan lainnya), `IPasswordHasher`, dan `IPaymentProofStorage` | `src/services`, `src/repositories`, `src/lib/password-hasher.ts`, `src/lib/payment-proof-storage.ts` |
| Overloading metode | Metode `describe` pada garasi punya tiga tanda tangan: tanpa argumen, dengan harga harian, dan dengan harga harian serta harga per kWh | `src/domain/garage/Garage.ts` |
| Anggota static dan factory | `GarageFactory.create` dan `VehicleFactory.create` membuat objek dari kode tipe; konstanta `MAX_PER_TYPE` dan `ID_DIGITS` bersifat static | `src/domain/garage/GarageFactory.ts`, `src/domain/vehicle.ts`, `src/domain/garage/Garage.ts` |
| Dependency injection | Layanan menerima repository, penyimpan bukti, pengaman password, dan jam lewat konstruktor; `src/lib/container.ts` merakitnya | `src/lib/container.ts` |
| Modul dan barrel | Berkas index di tiap folder mengekspor isi folder agar impor ringkas | `src/domain/index.ts`, `src/repositories/index.ts`, `src/services/index.ts` |

### 3.3 Akses database

Seluruh akses database lewat Prisma dan hanya ada di `src/repositories`. Tiga operasi berjalan dalam satu transaksi database agar atomik: pembuatan garasi berkelompok (`GarageRepository.createBatch` di `src/repositories/GarageRepository.ts`), pembuatan sewa (`RentalRepository.createRental` di `src/repositories/RentalRepository.ts`), dan pembuatan perpanjangan (`RentalExtensionRepository.createExtension` di `src/repositories/RentalExtensionRepository.ts`). Skema dan migrasi ada di `prisma/schema.prisma` dan `prisma/migrations` (enam migrasi).

### 3.4 Penanganan error

Semua error aplikasi turunan `AppError` (`src/domain/errors.ts`), antara lain error validasi dengan pesan per field, duplikasi pengguna, autentikasi gagal, akun belum diverifikasi, tidak berwenang, tidak ditemukan, bentrok, dan kapasitas terlampaui. Fungsi `toAppError` membungkus error tak terduga menjadi error database dengan pesan umum, sedangkan penyebab teknis hanya dicatat di server. Halaman galat umum ada di `src/app/error.tsx` dan halaman tidak ditemukan di `src/app/not-found.tsx`.

### 3.5 Komentar dokumentasi

Seluruh kelas, fungsi, dan interface di `src/domain`, `src/services`, `src/repositories`, `src/validation`, dan `src/lib` diberi komentar TSDoc berbahasa Indonesia dengan tag `@param`, `@returns`, `@throws`, dan `@example` bila perlu.

Dokumentasi API dibuat dari komentar TSDoc tersebut memakai TypeDoc dengan menjalankan `npm run docs`, lalu dibuka lewat `docs/api/index.html`. Folder `docs/api` adalah keluaran yang dibuat ulang setiap kali perintah dijalankan dan tidak disimpan di repositori.

## 4. Aturan Bisnis

Tabel ini hanya memuat perilaku yang dilakukan kode. Setiap aturan punya tes otomatis (lihat bagian 6).

| No | Aturan | Perilaku di aplikasi | Sumber kode |
| --- | --- | --- | --- |
| 1 | Harga bulanan | Harga sewa bulanan selalu 25 kali harga harian garasi; nilainya tidak disimpan di database | `src/domain/pricing.ts` |
| 2 | Sewa harian | Jumlah hari 1 sampai (jumlah hari pada bulan tanggal mulai dikurangi 1); biaya sewa = jumlah hari x harga harian | `src/domain/rentalPeriod.ts`, `src/domain/rentalCost.ts` |
| 3 | Sewa bulanan | Tanggal berakhir = tanggal mulai ditambah jumlah hari pada bulan tanggal mulai (memperhitungkan Februari dan tahun kabisat); biaya sewa = 25 x harga harian | `src/domain/rentalPeriod.ts`, `src/domain/rentalCost.ts` |
| 4 | Tanggal mulai | Tanggal mulai sewa adalah hari ini menurut zona waktu Asia/Jakarta | `src/domain/rentalPeriod.ts`, `src/services/RentalService.ts` |
| 5 | Biaya pengisian daya | Hanya Mobil Listrik yang disimpan di garasi Mobil Listrik membayar pengisian: (kapasitas baterai - sisa baterai) x harga per kWh, dibulatkan ke rupiah terdekat; di garasi Mobil biasa tidak ada biaya pengisian; total = biaya sewa + biaya pengisian | `src/domain/rentalCost.ts`, `src/domain/vehicle.ts` |
| 6 | Isian kendaraan | Plat nomor wajib kecuali untuk sepeda; Mobil Listrik wajib mengisi kapasitas baterai dan sisa baterai, dan sisa tidak boleh melebihi kapasitas | `src/domain/vehicle.ts`, `src/validation/rentalSchemas.ts` |
| 7 | Kecocokan kendaraan dan garasi | Sepeda dan Sepeda Motor hanya di garasi sepeda; Mobil hanya di garasi mobil; Mobil Listrik di garasi mobil atau garasi mobil listrik | `src/domain/vehicle.ts` |
| 8 | ID garasi | Awalan S (sepeda), C (mobil), atau E (mobil listrik) diikuti tiga angka berurutan per tipe, misalnya S001; paling banyak 999 garasi per tipe, dan batch yang melewati batas ditolak seluruhnya | `src/domain/garage/Garage.ts`, `src/domain/GarageIdGenerator.ts` |
| 9 | Status garasi | Garasi yang disewa berstatus terpakai; kembali tersedia setelah tanggal berakhir lewat (pada tanggal berakhir garasi masih terpakai) | `src/repositories/RentalRepository.ts`, `src/domain/rentalPeriod.ts` |
| 10 | Verifikasi pendaftar | Pendaftar baru berstatus menunggu; Admin hanya bisa menerima setelah mencentang konfirmasi validasi KTP, atau menolak; Penyewa baru bisa masuk dan menyewa setelah diterima (Admin tidak memerlukan verifikasi) | `src/validation/verificationSchemas.ts`, `src/domain/User.ts`, `src/services/VerificationService.ts` |
| 11 | Perpanjangan harian | Admin memilih jumlah hari 1 sampai (jumlah hari pada bulan tanggal berakhir saat ini dikurangi 1); sisa biaya = jumlah hari x salinan harga harian milik sewa itu | `src/domain/rentalExtension.ts` |
| 12 | Perpanjangan bulanan | Admin memilih jumlah bulan 1 sampai 1200; tiap bulan menambah jumlah hari pada bulan tempat langkah itu dimulai; sisa biaya = jumlah bulan x 25 x salinan harga harian milik sewa itu | `src/domain/rentalExtension.ts` |
| 13 | Ketentuan perpanjangan | Server yang menghitung tanggal berakhir baru, tambahan hari, dan sisa biaya; hanya sewa yang sedang berlaku yang bisa diperpanjang; bukti pembayaran wajib; riwayat perpanjangan disimpan | `src/services/RentalExtensionService.ts` |
| 14 | Bukti pembayaran | Wajib diunggah, paling besar 2 MB, dan jenisnya (JPEG, PNG, atau WebP) dikenali dari isi berkas, bukan dari ekstensi | `src/domain/paymentProof.ts`, `src/validation/paymentProofSchema.ts` |
| 15 | Laporan penyewaan | Sebuah sewa dihitung pada periode tanggal mulainya, dengan jumlah uang = total biaya sewa + semua biaya perpanjangannya; laporan per bulan selalu 12 baris, per hari memuat setiap tanggal pada bulan itu, per tipe garasi 3 baris, dan per penyewa hanya penyewa yang punya sewa | `src/domain/rentalReport.ts` |

## 5. Fitur dan Tangkapan Layar

Tangkapan layar diambil dari aplikasi yang berjalan (`npm start`, lalu buka http://localhost:3000) dan disimpan di folder `docs/tangkapan-layar/` dengan nama berkas seperti pada tautan gambar di bawah. Admin masuk memakai email dan password dari berkas `.env`.

### 5.1 Registrasi

Calon penyewa mengisi NIK, nama lengkap, nomor telepon, email, dan password. Akun baru berstatus Menunggu verifikasi.

Cara mengambil: buka `/register` (halaman Pendaftaran Penyewa), isi data contoh, lalu tampilkan halaman setelah berhasil mendaftar.

Tangkapan layar:

![Registrasi](tangkapan-layar/01-registrasi.png)

### 5.2 Login

Pengguna masuk dengan email dan password. Akun yang belum diterima Admin ditolak dengan pesan yang jelas.

Cara mengambil: buka `/login` (halaman Masuk), tampilkan juga pesan penolakan untuk akun yang masih menunggu, lalu masuk sebagai Admin.

Tangkapan layar:

![Login](tangkapan-layar/02-login.png)

### 5.3 Verifikasi Pendaftar

Admin melihat pendaftar berstatus menunggu, lalu menerima (setelah mencentang validasi KTP) atau menolak.

Cara mengambil: masuk sebagai Admin, klik menu Pendaftar (`/admin/pendaftar`, halaman Verifikasi Pendaftar), tampilkan daftar pendaftar beserta kotak centang validasi KTP.

Tangkapan layar:

![Verifikasi Pendaftar](tangkapan-layar/03-verifikasi-pendaftar.png)

### 5.4 Buat Garasi

Admin mengatur harga per tipe garasi, lalu membuat garasi secara berkelompok. ID dibuat otomatis berurutan (S001, C001, E001, dan seterusnya).

Cara mengambil: klik menu Garasi (`/admin/garasi`), tampilkan kartu Harga per Tipe dan kartu Buat Garasi Berkelompok setelah mengisi jumlah, lalu tampilkan pesan hasil pembuatan.

Tangkapan layar:

![Buat Garasi](tangkapan-layar/04-buat-garasi.png)

### 5.5 Daftar Garasi

Daftar semua garasi beserta tipe, harga harian, harga bulanan, harga per kWh (khusus mobil listrik), dan status.

Cara mengambil: pada halaman `/admin/garasi`, gulir ke kartu Daftar Garasi dan tampilkan garasi berstatus tersedia dan terpakai.

Tangkapan layar:

![Daftar Garasi](tangkapan-layar/05-daftar-garasi.png)

### 5.6 Sewa Baru

Penyewa yang sudah diterima memilih sewa harian atau bulanan, mengisi data kendaraan, memilih garasi yang tersedia, dan mengunggah bukti pembayaran. Total biaya ditampilkan, termasuk biaya pengisian untuk mobil listrik di garasi mobil listrik.

Cara mengambil: masuk sebagai Penyewa, klik menu Sewa Baru (`/penyewa/sewa/baru`), isi formulir (satu contoh mobil listrik agar biaya pengisian terlihat), lalu tampilkan ringkasan biaya sebelum dan sesudah sewa dibuat.

Tangkapan layar:

![Sewa Baru](tangkapan-layar/06-sewa-baru.png)

### 5.7 Sewa Saya

Daftar sewa milik Penyewa beserta tanggal mulai dan berakhir, biaya, status, dan tautan bukti pembayaran.

Cara mengambil: klik menu Sewa Saya (`/penyewa/sewa`) dan tampilkan beberapa sewa dengan status berbeda.

Tangkapan layar:

![Sewa Saya](tangkapan-layar/07-sewa-saya.png)

### 5.8 Perpanjangan

Admin memperpanjang sewa yang sedang berlaku secara harian (jumlah hari) atau bulanan (jumlah bulan), mengunggah bukti pembayaran, dan melihat riwayat perpanjangan. Tanggal berakhir baru dan sisa biaya dihitung otomatis.

Cara mengambil: masuk sebagai Admin, klik menu Perpanjangan (`/admin/perpanjangan`), tampilkan kartu Garasi yang Disewa Hari Ini, pilih satu sewa untuk memunculkan kartu Perpanjang Sewa beserta sisa biayanya, lalu tampilkan kartu Riwayat Perpanjangan setelah perpanjangan disimpan.

Tangkapan layar:

![Perpanjangan](tangkapan-layar/08-perpanjangan.png)

### 5.9 Laporan per Bulan

Jumlah sewa dan jumlah uang untuk 12 bulan pada tahun yang dipilih.

Cara mengambil: klik menu Laporan (`/admin/laporan?jenis=bulan`, halaman Laporan Penyewaan), pilih tahun yang punya data.

Tangkapan layar:

![Laporan per Bulan](tangkapan-layar/09-laporan-per-bulan.png)

### 5.10 Laporan per Hari

Jumlah sewa dan jumlah uang untuk setiap tanggal pada bulan yang dipilih.

Cara mengambil: buka `/admin/laporan?jenis=hari`, pilih tahun dan bulan yang punya data.

Tangkapan layar:

![Laporan per Hari](tangkapan-layar/10-laporan-per-hari.png)

### 5.11 Laporan per Tipe Garasi

Jumlah sewa dan jumlah uang untuk tipe sepeda, mobil, dan mobil listrik.

Cara mengambil: buka `/admin/laporan?jenis=tipe`.

Tangkapan layar:

![Laporan per Tipe Garasi](tangkapan-layar/11-laporan-per-tipe-garasi.png)

### 5.12 Laporan per Penyewa

Jumlah sewa dan jumlah uang untuk setiap penyewa yang pernah menyewa.

Cara mengambil: buka `/admin/laporan?jenis=penyewa`.

Tangkapan layar:

![Laporan per Penyewa](tangkapan-layar/12-laporan-per-penyewa.png)

## 6. Skenario Pengujian

Seluruh aturan bisnis diuji otomatis dengan Vitest. Jalankan dengan perintah `npm test`. Hasil proses terakhir:

- Berkas tes: 18
- Jumlah tes: 222
- Lulus: 222

Skenario dikelompokkan menjadi delapan area:

1. Harga Sewa dan Biaya Pengisian
2. ID Garasi
3. Kecocokan Kendaraan dan Garasi
4. Tanggal Sewa
5. Perpanjangan Sewa
6. Laporan Penyewaan
7. Akun, Login, dan Verifikasi
8. Bukti Pembayaran, Validasi, dan Galat

Tabel skenario lengkap dengan masukan, hasil yang diharapkan, dan hasil aktual ada di [Skenario Pengujian Unit](skenario-pengujian.md).

## 7. Diagram

Ketiga diagram dibuat untuk dibuka di draw.io: buka https://app.diagrams.net, pilih File, lalu Open from Device, dan pilih berkas diagramnya.

- [Use Case Diagram](diagram/use-case.drawio): satu halaman bernama Use Case, memuat aktor Pengguna, Penyewa, dan Admin dengan 25 use case.
- [Class Diagram](diagram/class-diagram.drawio): lima halaman, yaitu Domain - Garasi dan Kendaraan; Domain - Pengguna dan Error; Domain - Aturan Sewa, Perpanjangan, dan Laporan; Layanan; serta Repository, Penyimpanan, dan Container.
- [Entity Relationship Diagram](diagram/erd.drawio): satu halaman bernama ERD, memuat enam tabel database, relasinya, tipe enum, dan indeks.

## 8. Link GitHub

https://github.com/inikenliii/LSP_KenleyJonathan

> Catatan untuk peserta (hapus sebelum laporan dikumpulkan): saat dokumen ini ditulis, repositori masih privat. Sebelum batas waktu, ubah repositori menjadi publik atau tambahkan asesor sebagai collaborator agar tautan di atas dapat dibuka.

## 9. Cara Menjalankan

Prasyarat: Node.js 24 atau lebih baru dan PostgreSQL 17 yang sudah berjalan, dengan dua database kosong: satu untuk aplikasi dan satu untuk pengujian.

1. Jalankan `npm install`.
2. Salin `.env.example` menjadi `.env`, lalu isi:
   - `DATABASE_URL`, contoh `postgresql://USER:PASSWORD@localhost:5432/garage_rental`
   - `TEST_DATABASE_URL`, contoh `postgresql://USER:PASSWORD@localhost:5432/garage_rental_test` (nama database harus berakhiran _test)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, dan `ADMIN_NAME` untuk akun Admin yang dibuat seed
3. Jalankan `npm run setup` untuk menerapkan migrasi, membuat klien Prisma, dan membuat akun Admin.
4. Jalankan `npm start`, lalu buka http://localhost:3000.
5. Jalankan `npm test` untuk pengujian; pengujian hanya memakai dan mengosongkan database yang berakhiran _test.
6. Jalankan `npm run docs` untuk membuat dokumentasi API, lalu buka `docs/api/index.html`.
