# Laporan Uji Praktik: Aplikasi Penyewaan Garasi

## Pendahuluan

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

## A. Use Case Diagram

Use case diagram memuat satu halaman bernama Use Case dengan tiga aktor (Pengguna, Penyewa, dan Admin) dan 25 use case. Penyewa dan Admin adalah turunan aktor Pengguna sehingga keduanya memakai Login dan Logout. Penyewa melakukan Registrasi Akun, Buat Sewa Baru (mencakup isi detail kendaraan, pilih garasi tersedia, hitung total biaya, dan unggah bukti pelunasan), dan Lihat Sewa Saya. Admin melakukan Verifikasi Pendaftar (terima atau tolak), Buat Garasi Massal beserta Atur Harga Garasi, Lihat Daftar Garasi, Perpanjang Sewa (harian atau bulanan), dan Lihat Laporan Sewa (per bulan, per hari, per tipe garasi, dan per penyewa).

Berkas sumber ketiga diagram (`diagram/use-case.drawio`, `diagram/class-diagram.drawio`, dan `diagram/erd.drawio`) dibuat untuk dibuka di draw.io: buka https://app.diagrams.net, pilih File, lalu Open from Device, dan pilih berkas diagramnya.

![Use Case Diagram: aktor Pengguna, Penyewa, dan Admin dengan 25 use case](diagram/img/use-case.png)

## B. Class Diagram

Class diagram (`diagram/class-diagram.drawio`) terdiri atas lima halaman. Setiap halaman dijelaskan berikut gambarnya.

Halaman 1, Domain - Garasi dan Kendaraan: kelas abstrak `Garage` dengan subkelas `Sepeda`, `Mobil`, dan `MobilListrik`; kelas abstrak `Vehicle` dengan subkelas `Bicycle`, `Motorcycle`, `Car`, dan `ElectricCar`; serta `GarageFactory`, `VehicleFactory`, dan `GarageIdGenerator` yang membuat objek dan ID garasi.

![Class Diagram halaman 1: Domain - Garasi dan Kendaraan](diagram/img/class-diagram-1.png)

Halaman 2, Domain - Pengguna dan Error: kelas `User` beserta `UserProps` dan `UserDTO`, serta hierarki error yang berpangkal pada `AppError` (`ValidationError`, `DuplicateUserError`, `AuthenticationError`, `AccountNotVerifiedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `CapacityExceededError`, dan `DatabaseError`), ditambah `ExtensionTooFarError` dan `ExtensionQuantityError` yang mewarisi `RangeError` bawaan JavaScript.

![Class Diagram halaman 2: Domain - Pengguna dan Error](diagram/img/class-diagram-2.png)

Halaman 3, Domain - Aturan Sewa, Perpanjangan, dan Laporan: modul fungsi `pricing`, `rentalPeriod`, `rentalCost`, `paymentProof`, `rentalExtension`, dan `rentalReport` beserta interface masukan dan hasilnya.

![Class Diagram halaman 3: Domain - Aturan Sewa, Perpanjangan, dan Laporan](diagram/img/class-diagram-3.png)

Halaman 4, Layanan: kelas dan interface layanan (misalnya `IAuthService` dan `IRentalService`) yang menjalankan alur kerja aplikasi dengan memakai domain, validasi, dan repository.

![Class Diagram halaman 4: Layanan](diagram/img/class-diagram-4.png)

Halaman 5, Repository, Penyimpanan, dan Container: interface dan kelas repository (misalnya `IUserRepository` dan `IRentalRepository`) yang menyembunyikan database di balik interface, `IPasswordHasher` dan `IPaymentProofStorage`, serta container yang merakit repository dan layanan.

![Class Diagram halaman 5: Repository, Penyimpanan, dan Container](diagram/img/class-diagram-5.png)

## C. Entity Relationship Diagram

Entity relationship diagram (`diagram/erd.drawio`, satu halaman bernama ERD) memuat enam tabel database PostgreSQL beserta relasi, tipe enum, dan indeksnya: `users`, `session`, `garage_type_configs`, `garages`, `rentals`, dan `rental_extensions`. Relasinya: `garage_type_configs` ke `garages` (tipe garasi), `garages` ke `rentals`, `users` ke `rentals` (penyewa), `rentals` ke `rental_extensions`, `users` ke `rental_extensions` (Admin yang menyimpan perpanjangan), dan `users` ke dirinya sendiri (Admin yang memverifikasi pendaftar). Tabel `session` berdiri sendiri.

![Entity Relationship Diagram: enam tabel database, relasinya, tipe enum, dan indeks](diagram/img/erd.png)

## D. Penjelasan Library dan Komponen Pra-existing

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

## E. Fitur-fitur Aplikasi

Tangkapan layar diambil dari aplikasi yang berjalan (`npm start`, lalu buka http://localhost:3000) dan disimpan di folder `docs/tangkapan-layar/` dengan nama berkas seperti pada tautan gambar di bawah. Admin masuk memakai email dan password dari berkas `.env`.

### E.1 Registrasi

Calon penyewa mengisi NIK, nama lengkap, nomor telepon, email, dan password. Akun baru berstatus Menunggu verifikasi.

Cara mengambil: buka `/register` (halaman Pendaftaran Penyewa), isi data contoh, lalu tampilkan halaman setelah berhasil mendaftar.

Tangkapan layar:

![Registrasi](tangkapan-layar/01-registrasi.png)

### E.2 Login

Pengguna masuk dengan email dan password. Akun yang belum diterima Admin ditolak dengan pesan yang jelas.

Cara mengambil: buka `/login` (halaman Masuk), tampilkan juga pesan penolakan untuk akun yang masih menunggu, lalu masuk sebagai Admin.

Tangkapan layar:

![Login](tangkapan-layar/02-login.png)

### E.3 Verifikasi Pendaftar

Admin melihat pendaftar berstatus menunggu, lalu menerima (setelah mencentang validasi KTP) atau menolak.

Cara mengambil: masuk sebagai Admin, klik menu Pendaftar (`/admin/pendaftar`, halaman Verifikasi Pendaftar), tampilkan daftar pendaftar beserta kotak centang validasi KTP.

Tangkapan layar:

![Verifikasi Pendaftar](tangkapan-layar/03-verifikasi-pendaftar.png)

### E.4 Buat Garasi

Admin mengatur harga per tipe garasi, lalu membuat garasi secara berkelompok. ID dibuat otomatis berurutan (S001, C001, E001, dan seterusnya).

Cara mengambil: klik menu Garasi (`/admin/garasi`), tampilkan kartu Harga per Tipe dan kartu Buat Garasi Berkelompok setelah mengisi jumlah, lalu tampilkan pesan hasil pembuatan.

Tangkapan layar:

![Buat Garasi](tangkapan-layar/04-buat-garasi.png)

### E.5 Daftar Garasi

Daftar semua garasi beserta tipe, harga harian, harga bulanan, harga per kWh (khusus mobil listrik), dan status.

Cara mengambil: pada halaman `/admin/garasi`, gulir ke kartu Daftar Garasi dan tampilkan garasi berstatus tersedia dan terpakai.

Tangkapan layar:

![Daftar Garasi](tangkapan-layar/05-daftar-garasi.png)

### E.6 Sewa Baru

Penyewa yang sudah diterima memilih sewa harian atau bulanan, mengisi data kendaraan, memilih garasi yang tersedia, dan mengunggah bukti pembayaran. Total biaya ditampilkan, termasuk biaya pengisian untuk mobil listrik di garasi mobil listrik.

Cara mengambil: masuk sebagai Penyewa, klik menu Sewa Baru (`/penyewa/sewa/baru`), isi formulir (satu contoh mobil listrik agar biaya pengisian terlihat), lalu tampilkan ringkasan biaya sebelum dan sesudah sewa dibuat.

Tangkapan layar:

![Sewa Baru](tangkapan-layar/06-sewa-baru.png)

### E.7 Sewa Saya

Daftar sewa milik Penyewa beserta tanggal mulai dan berakhir, biaya, status, dan tautan bukti pembayaran.

Cara mengambil: klik menu Sewa Saya (`/penyewa/sewa`) dan tampilkan beberapa sewa dengan status berbeda.

Tangkapan layar:

![Sewa Saya](tangkapan-layar/07-sewa-saya.png)

### E.8 Perpanjangan

Admin memperpanjang sewa yang sedang berlaku secara harian (jumlah hari) atau bulanan (jumlah bulan), mengunggah bukti pembayaran, dan melihat riwayat perpanjangan. Tanggal berakhir baru dan sisa biaya dihitung otomatis.

Cara mengambil: masuk sebagai Admin, klik menu Perpanjangan (`/admin/perpanjangan`), tampilkan kartu Garasi yang Disewa Hari Ini, pilih satu sewa untuk memunculkan kartu Perpanjang Sewa beserta sisa biayanya, lalu tampilkan kartu Riwayat Perpanjangan setelah perpanjangan disimpan.

Tangkapan layar:

![Perpanjangan](tangkapan-layar/08-perpanjangan.png)

### E.9 Laporan per Bulan

Jumlah sewa dan jumlah uang untuk 12 bulan pada tahun yang dipilih.

Cara mengambil: klik menu Laporan (`/admin/laporan?jenis=bulan`, halaman Laporan Penyewaan), pilih tahun yang punya data.

Tangkapan layar:

![Laporan per Bulan](tangkapan-layar/09-laporan-per-bulan.png)

### E.10 Laporan per Hari

Jumlah sewa dan jumlah uang untuk setiap tanggal pada bulan yang dipilih.

Cara mengambil: buka `/admin/laporan?jenis=hari`, pilih tahun dan bulan yang punya data.

Tangkapan layar:

![Laporan per Hari](tangkapan-layar/10-laporan-per-hari.png)

### E.11 Laporan per Tipe Garasi

Jumlah sewa dan jumlah uang untuk tipe sepeda, mobil, dan mobil listrik.

Cara mengambil: buka `/admin/laporan?jenis=tipe`.

Tangkapan layar:

![Laporan per Tipe Garasi](tangkapan-layar/11-laporan-per-tipe-garasi.png)

### E.12 Laporan per Penyewa

Jumlah sewa dan jumlah uang untuk setiap penyewa yang pernah menyewa.

Cara mengambil: buka `/admin/laporan?jenis=penyewa`.

Tangkapan layar:

![Laporan per Penyewa](tangkapan-layar/12-laporan-per-penyewa.png)

## F. Skenario Unit Testing

Seluruh aturan bisnis diuji otomatis dengan Vitest. Jalankan dengan perintah `npm test` (menjalankan `vitest run`). Tes pada folder `test/unit` menguji fungsi dan kelas domain murni tanpa database. Tes pada folder `test/services` menguji layanan dengan database PostgreSQL terpisah yang namanya berakhiran `_test`; database aplikasi tidak pernah dipakai untuk pengujian. Hasil proses terakhir (22 November 2026):

- Berkas tes: 18
- Jumlah tes: 222
- Lulus: 222
- Gagal: 0

Bab ini memuat 99 skenario terpilih dari 222 tes, dikelompokkan menjadi delapan area (F.1 sampai F.8); daftar lengkap tampil saat menjalankan `npm test`. Kolom Hasil Aktual berisi status tiap tes pada proses tersebut. Kolom Berkas Tes memuat jalur berkas dan judul tes persis seperti yang tampil di Vitest. Daftar yang sama tersedia sebagai berkas mandiri `docs/skenario-pengujian.md`.

### F.1 Harga Sewa dan Biaya Pengisian

| No | Skenario | Masukan | Hasil yang Diharapkan | Hasil Aktual | Berkas Tes |
| --- | --- | --- | --- | --- | --- |
| 1 | Pengali harga bulanan | Konstanta MONTHLY_PRICE_MULTIPLIER | 25 | Lulus | `test/unit/pricing.test.ts` `pengali bulanan adalah 25` |
| 2 | Harga bulanan = 25 x harga harian | Harga harian 10000 dan 0 | Harga bulanan 250000 dan 0 | Lulus | `test/unit/pricing.test.ts` `menghitung 25 x harga harian` |
| 3 | Biaya sewa harian | Harian, 3 hari, harga harian 10000, tanpa pengisian daya | Biaya sewa 30000, biaya pengisian 0, total 30000 | Lulus | `test/unit/rental.test.ts` `harian = hari x harga harian tanpa biaya lain` |
| 4 | Biaya sewa bulanan | Bulanan, harga harian 50000 | Total 1250000 (25 x 50000) | Lulus | `test/unit/rental.test.ts` `bulanan = 25 x harga harian` |
| 5 | kWh yang diisi = kapasitas dikurangi sisa | Kapasitas 60, sisa 20; kapasitas 60, sisa 0 | 40 kWh dan 60 kWh | Lulus | `test/unit/rental.test.ts` `kapasitas dikurangi sisa` |
| 6 | Biaya pengisian mobil listrik bulanan | Bulanan, harga harian 80000, kapasitas 60 kWh, sisa 20 kWh, Rp 2500 per kWh | Biaya sewa 2000000, biaya pengisian 100000 (40 kWh x 2500), total 2100000 | Lulus | `test/unit/rental.test.ts` `biaya pengisian = (kapasitas - sisa) x harga per kWh: 60, sisa 20, 2500 -> 40 kWh -> 100000` |
| 7 | Sisa sama dengan kapasitas tidak dikenai biaya pengisian | Bulanan, harga harian 80000, kapasitas 60, sisa 60, Rp 2500 per kWh | Biaya pengisian 0, total 2000000 | Lulus | `test/unit/rental.test.ts` `sisa sama dengan kapasitas: biaya pengisian 0` |
| 8 | Pembulatan biaya pengisian ke rupiah terdekat | Harian 1 hari; 12,5 kWh x 2500; 33,3 kWh x 1234; 0,5 kWh x 2505 | 31250; 41092; 1253 | Lulus | `test/unit/rental.test.ts` `membulatkan biaya pengisian ke rupiah terdekat` |
| 9 | Total sewa harian mobil listrik beserta pengisian | Harian 2 hari, harga harian 60000, kapasitas 50 kWh, sisa 10 kWh, Rp 2000 per kWh | Biaya sewa 120000, biaya pengisian 80000, total 200000 | Lulus | `test/unit/rental.test.ts` `harian di garasi mobil listrik = hari x harga harian + (kapasitas - sisa) x harga per kWh: 2 x 60000 + 40 kWh x 2000 = 200000` |
| 10 | Mobil listrik di garasi mobil biasa tanpa biaya pengisian | Mobil listrik di C001 (harga harian 50000), harian 1 hari, baterai 17,3, sisa 5,5 | Total 50000, biaya pengisian 0, harga per kWh kosong | Lulus | `test/services/rental.test.ts` `mobil listrik di garasi mobil biasa tidak dikenai biaya pengisian` |

### F.2 ID Garasi

| No | Skenario | Masukan | Hasil yang Diharapkan | Hasil Aktual | Berkas Tes |
| --- | --- | --- | --- | --- | --- |
| 11 | Format ID garasi | Sepeda nomor 1, Mobil nomor 10, Mobil Listrik nomor 999 | S001, C010, E999 | Lulus | `test/unit/garage.test.ts` `membentuk ID dengan awalan dan tiga digit` |
| 12 | Nomor urut di luar 1 sampai 999 ditolak | Sepeda nomor 0, 1000, 1,5 | RangeError | Lulus | `test/unit/garage.test.ts` `menolak nomor urut di luar 1 sampai 999` |
| 13 | Awalan ID lewat polimorfisme | Pabrik garasi untuk BICYCLE, CAR, ELECTRIC_CAR, nomor 1 | S001, C001, E001 | Lulus | `test/unit/garage.test.ts` `polimorfisme: awalan ID tiap tipe tanpa instanceof` |
| 14 | Batch melanjutkan nomor terakhir | Sepeda, nomor terakhir 4, jumlah 2 | S005 dan S006 | Lulus | `test/unit/GarageIdGenerator.test.ts` `melanjutkan dari nomor terakhir` |
| 15 | Batas atas tepat 999 | Mobil, nomor terakhir 990, jumlah 9 | C991 sampai C999 | Lulus | `test/unit/GarageIdGenerator.test.ts` `boleh sampai tepat 999` |
| 16 | Batch melewati 999 ditolak | Mobil, nomor terakhir 990, jumlah 10 | CapacityExceededError dengan pesan sisa kuota 9 | Lulus | `test/unit/GarageIdGenerator.test.ts` `menolak batch yang melewati 999 dengan sisa kuota` |
| 17 | Batch Sepeda pertama disimpan | Admin membuat 3 Sepeda, harga harian 10000 | S001 sampai S003, nomor terakhir 3, ketiganya tersedia | Lulus | `test/services/garage.test.ts` `batch Sepeda pertama menghasilkan S001 sampai S003 dan menyimpan harga` |
| 18 | Urutan ID terpisah per tipe | 3 Sepeda, 1 Mobil, 2 Mobil Listrik (Rp 2500 per kWh) | C001, E001, E002 dan ringkasan Mobil Listrik E001, Rp 50.000 per hari, Rp 2.500 per kWh | Lulus | `test/services/garage.test.ts` `setiap tipe punya urutan sendiri dan Mobil Listrik menyimpan harga per kWh` |
| 19 | Lima batch bersamaan tanpa bentrok ID | Lima batch Mobil masing-masing 10 dijalankan serentak | 50 ID berbeda, C001 sampai C050, nomor terakhir 50 | Lulus | `test/services/garage.test.ts` `lima batch bersamaan menghasilkan 50 ID berbeda tanpa bentrok` |
| 20 | Batch melewati 999 ditolak seluruhnya | Nomor terakhir Sepeda 997, batch 3 garasi | Ditolak (sisa kuota 2), tidak ada garasi dibuat, nomor tetap 997; batch 2 berikutnya S998 dan S999 | Lulus | `test/services/garage.test.ts` `batch yang melewati 999 ditolak seluruhnya dan penghitung tidak berubah` |

### F.3 Kecocokan Kendaraan dan Garasi

| No | Skenario | Masukan | Hasil yang Diharapkan | Hasil Aktual | Berkas Tes |
| --- | --- | --- | --- | --- | --- |
| 21 | Sepeda: tanpa plat, tanpa baterai | Kode kendaraan SEPEDA | Bicycle, garasi BICYCLE saja, tanpa plat, tanpa baterai | Lulus | `test/unit/vehicle.test.ts` `SEPEDA menjadi Bicycle tanpa plat dan tanpa baterai` |
| 22 | Sepeda motor memakai garasi sepeda | Kode kendaraan SEPEDA_MOTOR | Motorcycle, garasi BICYCLE, wajib plat | Lulus | `test/unit/vehicle.test.ts` `SEPEDA_MOTOR menjadi Motorcycle yang wajib plat dan memakai garasi sepeda` |
| 23 | Mobil hanya cocok dengan garasi mobil | Kode kendaraan MOBIL | Car, garasi CAR saja, wajib plat | Lulus | `test/unit/vehicle.test.ts` `MOBIL menjadi Car yang hanya cocok dengan garasi mobil` |
| 24 | Mobil listrik boleh dua tipe garasi | Kode kendaraan MOBIL_LISTRIK | ElectricCar, garasi CAR dan ELECTRIC_CAR, wajib baterai dan plat | Lulus | `test/unit/vehicle.test.ts` `MOBIL_LISTRIK menjadi ElectricCar yang wajib baterai dan boleh dua tipe garasi` |
| 25 | Tipe kendaraan tidak dikenal ditolak | Kode kendaraan TRUK | ValidationError pada field vehicleType: Tipe kendaraan tidak valid | Lulus | `test/unit/vehicle.test.ts` `menolak kode tipe yang tidak dikenal dengan pesan di field vehicleType` |
| 26 | Matriks kecocokan 4 x 3 | Semua 4 tipe kendaraan terhadap 3 tipe garasi (12 kombinasi) | Sepeda dan Sepeda Motor hanya BICYCLE; Mobil hanya CAR; Mobil Listrik CAR dan ELECTRIC_CAR | Lulus | `test/unit/vehicle.test.ts` `canParkIn: 4 tipe kendaraan x 3 tipe garasi sesuai aturan kecocokan` |
| 27 | Matriks biaya pengisian 4 x 3 | Semua 4 tipe kendaraan terhadap 3 tipe garasi (12 kombinasi) | true hanya untuk Mobil Listrik di ELECTRIC_CAR, 11 kombinasi lain false | Lulus | `test/unit/vehicle.test.ts` `chargesBatteryIn: hanya Mobil Listrik di garasi Mobil Listrik dari 12 kombinasi` |
| 28 | Sepeda ditolak di garasi mobil | Sepeda dipilih dengan tipe garasi CAR dan garasi C001 | Galat pada field garageType | Lulus | `test/services/rental.test.ts` `sepeda tidak boleh di garasi mobil` |
| 29 | ID garasi tidak sesuai tipe ditolak | Tipe garasi BICYCLE dengan ID C001 | Galat pada field garageId, tidak ada sewa dibuat | Lulus | `test/services/rental.test.ts` `tipe garasi BICYCLE dengan ID C001 ditolak di field garageId` |
| 30 | Garasi yang tidak ada ditolak | Tipe garasi BICYCLE dengan ID S999 | Galat pada field garageId | Lulus | `test/services/rental.test.ts` `garasi yang tidak ada ditolak di field garageId` |

### F.4 Tanggal Sewa

| No | Skenario | Masukan | Hasil yang Diharapkan | Hasil Aktual | Berkas Tes |
| --- | --- | --- | --- | --- | --- |
| 31 | Tanggal hari ini memakai zona Asia/Jakarta | Waktu UTC 2026-11-20 17:30; 2026-11-21 16:59; 2026-11-21 17:00 | 2026-11-21; 2026-11-21; 2026-11-22 | Lulus | `test/unit/rental.test.ts` `memakai tanggal kalender Asia/Jakarta (UTC+7)` |
| 32 | Jumlah hari tiap bulan, tahun kabisat dan aturan abad | Februari 2027, 2028, 2100, 2000; November 2026; Januari 2026 | 28; 29; 28; 29; 30; 31 | Lulus | `test/unit/rental.test.ts` `sadar tahun kabisat dan aturan abad` |
| 33 | Batas jumlah hari sewa harian | Mulai 2026-11-21, 2027-02-10, 2028-02-10, 2026-01-05 | 29; 27; 28; 30 (hari bulan mulai dikurangi satu) | Lulus | `test/unit/rental.test.ts` `jumlah hari bulan mulai dikurangi satu` |
| 34 | Tanggal berakhir sewa harian | Mulai 2026-11-21 dengan 3 hari dan 29 hari | 2026-11-24 dan 2026-12-20 | Lulus | `test/unit/rental.test.ts` `tanggal berakhir = mulai + jumlah hari` |
| 35 | Hari sewa harian tidak sah ditolak | Mulai 2026-11-21 dengan 30, 0, 1,5 hari, dan tanpa hari | RangeError | Lulus | `test/unit/rental.test.ts` `menolak hari di luar 1 sampai batas, pecahan, atau kosong` |
| 36 | Sewa bulanan November (30 hari) | Mulai 2026-11-21 | Berakhir 2026-12-21 | Lulus | `test/unit/rental.test.ts` `mulai 2026-11-21 berakhir 2026-12-21` |
| 37 | Sewa bulanan Februari biasa (28 hari) | Mulai 2027-02-10 | Berakhir 2027-03-10 | Lulus | `test/unit/rental.test.ts` `mulai 2027-02-10 berakhir 2027-03-10` |
| 38 | Sewa bulanan 29 Februari kabisat | Mulai 2028-02-29 | Berakhir 2028-03-29 | Lulus | `test/unit/rental.test.ts` `mulai 2028-02-29 berakhir 2028-03-29` |
| 39 | Sewa bulanan dari akhir bulan 31 hari | Mulai 2026-01-31 | Berakhir 2026-03-03 | Lulus | `test/unit/rental.test.ts` `mulai 2026-01-31 berakhir 2026-03-03` |
| 40 | Sewa bulanan melewati pergantian tahun | Mulai 2026-12-15 | Berakhir 2027-01-15 | Lulus | `test/unit/rental.test.ts` `mulai 2026-12-15 berakhir 2027-01-15` |
| 41 | Status aktif sampai tanggal berakhir | Hari ini 2026-11-21; berakhir 2026-11-21, 2026-11-20, 2026-11-22 | true; false; true | Lulus | `test/unit/rental.test.ts` `masih aktif pada tanggal berakhir, selesai sehari sesudahnya` |
| 42 | Sewa harian baru disimpan | Penyewa menyewa sepeda S001 harian 3 hari dengan bukti PNG | Garasi menjadi used, mulai hari ini, berakhir hari ini + 3, total 30000, satu berkas bukti tersimpan | Lulus | `test/services/rental.test.ts` `membuat sewa harian sepeda, garasi menjadi used, dan menyimpan satu berkas` |
| 43 | Garasi dilepas setelah sewa berakhir | Sewa S001 berakhir kemarin, sewa S002 berakhir hari ini | S001 tersedia lagi, S002 tetap used | Lulus | `test/services/rental.test.ts` `garasi dengan sewa berakhir kemarin tersedia lagi, yang berakhir hari ini tetap used` |
| 44 | Sewa harian melebihi batas hari ditolak | Hari sewa = batas hari bulan ini + 1 | Galat pada field days | Lulus | `test/services/rental.test.ts` `sewa harian melebihi batas hari bulan ini ditolak` |
| 45 | Dua penyewa berebut satu garasi | Dua penyewa menyewa S001 pada saat yang sama | Tepat satu berhasil, yang lain ConflictError: Garasi sudah disewa, pilih garasi lain | Lulus | `test/services/rental.test.ts` `dua penyewa berebut satu garasi: tepat satu berhasil` |

### F.5 Perpanjangan Sewa

| No | Skenario | Masukan | Hasil yang Diharapkan | Hasil Aktual | Berkas Tes |
| --- | --- | --- | --- | --- | --- |
| 46 | Tambahan hari antara dua tanggal | Berakhir 2026-11-24 ke 2026-11-30 dan ke 2026-12-24 | 6 hari dan 30 hari | Lulus | `test/unit/rentalExtension.test.ts` `menghitung hari kalender antara dua tanggal selesai` |
| 47 | Tambahan hari melewati Februari | 2027-02-28 ke 2027-03-01; 2028-02-28 ke 2028-03-01 | 1 hari dan 2 hari | Lulus | `test/unit/rentalExtension.test.ts` `sadar Februari biasa dan kabisat` |
| 48 | Perpanjangan harian: sisa biaya | Berakhir 2026-11-21, perpanjangan harian 10 hari, harga harian 10000 | Berakhir baru 2026-12-01, tambahan 10 hari, sisa biaya 100000 (10 x 10000) | Lulus | `test/unit/rentalExtension.test.ts` `sisa biaya = jumlah hari x harga harian: 10 hari x 10000 = 100000` |
| 49 | Batas hari perpanjangan harian | Tanggal berakhir 2026-11-21, 2027-02-10, dan 2028-02-10 | Maksimal 29, 27, dan 28 hari (hari pada bulan tanggal berakhir dikurangi satu); jumlah tepat di batas diterima | Lulus | `test/unit/rentalExtension.test.ts` `batas hari mengikuti bulan tanggal selesai saat ini: November 29, Februari 2027 27, Februari 2028 28` |
| 50 | Jumlah hari perpanjangan di luar batas ditolak | Berakhir 2026-11-21; jumlah 0, 30, -1, 1,5, bukan angka | RangeError: Jumlah hari perpanjangan harus bilangan bulat 1 sampai 29. | Lulus | `test/unit/rentalExtension.test.ts` `menolak jumlah 0, di atas batas, negatif, dan bukan bilangan bulat` |
| 51 | Perpanjangan bulanan 1 bulan | Berakhir 2026-11-21, 1 bulan, harga harian 10000 | Berakhir baru 2026-12-21 (30 hari), sisa biaya 250000 (25 x 10000) | Lulus | `test/unit/rentalExtension.test.ts` `1 bulan dari 2026-11-21 berakhir 2026-12-21 dengan biaya 250000` |
| 52 | Perpanjangan bulanan 2 bulan | Berakhir 2026-11-21, 2 bulan, harga harian 10000 | Berakhir baru 2027-01-21 (30 lalu 31 hari, 61 hari), sisa biaya 500000 | Lulus | `test/unit/rentalExtension.test.ts` `2 bulan dari 2026-11-21 berakhir 2027-01-21 dengan biaya 500000 (30 lalu 31 hari)` |
| 53 | Perpanjangan bulanan di bulan Februari | Berakhir 2027-02-10 dan 2028-02-10 (kabisat), masing-masing 1 bulan | 2027-03-10 (28 hari) dan 2028-03-10 (29 hari) | Lulus | `test/unit/rentalExtension.test.ts` `akhir Februari: 2027-02-10 + 1 bulan = 2027-03-10 (28 hari) dan Februari kabisat 2028-02-10 = 2028-03-10 (29 hari)` |
| 54 | Batas jumlah bulan perpanjangan | Jumlah bulan 1200 dan 1201 (harga harian 0) | 1200 diterima; 1201 ditolak: Jumlah bulan perpanjangan harus bilangan bulat 1 sampai 1200. | Lulus | `test/unit/rentalExtension.test.ts` `menerima tepat 1200 bulan dan menolak 1201` |
| 55 | Daftar sewa aktif untuk perpanjangan | Satu sewa sepeda S001 harian 3 hari yang baru dibuat | Satu baris: S001, Sepeda, Penyewa A, Harian, berakhir hari ini + 3, harga harian 10000, batas perpanjangan harian sesuai bulan tanggal berakhir | Lulus | `test/services/rentalExtension.test.ts` `menampilkan sewa yang aktif hari ini lengkap dengan label` |
| 56 | Sewa yang sudah berakhir tidak ditampilkan | Sewa berakhir kemarin dan sewa mulai besok | Hanya S001 yang tampil | Lulus | `test/services/rentalExtension.test.ts` `tidak menampilkan sewa yang sudah berakhir atau baru mulai besok` |
| 57 | Memperpanjang sewa harian | Admin memperpanjang S001 secara harian 7 hari dengan bukti PNG | Berakhir hari ini + 10, jenis Harian, jumlah 7, tambahan 7 hari, sisa biaya 70000, riwayat tersimpan, garasi tetap used | Lulus | `test/services/rentalExtension.test.ts` `perpanjangan harian: tanggal berakhir pindah, jenis, jumlah, dan biaya tersimpan, garasi tetap used` |
| 58 | Memperpanjang sewa bulanan | Admin memperpanjang S001 secara bulanan 2 bulan | Tanggal berakhir maju dua langkah bulan (hari bulan tempat tiap langkah dimulai), jenis Bulanan, jumlah 2, sisa biaya 500000, garasi tetap used | Lulus | `test/services/rentalExtension.test.ts` `perpanjangan bulanan: tiap bulan memakai hari bulan tempat langkahnya dimulai, biaya 25 x harga harian per bulan` |
| 59 | Perpanjangan kedua memakai tanggal terbaru | Perpanjangan harian 5 hari, lalu bulanan 1 bulan oleh Admin lain | Perpanjangan kedua dari hari ini + 8, sisa biaya 250000, riwayat urut dari yang lama: 5 hari lalu 1 bulan | Lulus | `test/services/rentalExtension.test.ts` `perpanjangan kedua memakai tanggal berakhir terbaru dan riwayat berurut dari yang lama` |
| 60 | Nilai hitungan dari klien diabaikan | Isian ikut mengirim amount 1, additionalDays 99, newEndDate 2099-01-01, dailyPrice 1 | Server memakai 7 hari, berakhir hari ini + 10, dan sisa biaya 70000 | Lulus | `test/services/rentalExtension.test.ts` `mengabaikan isian yang dikirim klien untuk nilai yang dihitung server` |
| 61 | Dua Admin memperpanjang bersamaan | Dua Admin memperpanjang sewa yang sama serentak | Tepat satu berhasil, yang lain ConflictError: Sewa sudah berubah atau berakhir, muat ulang halaman | Lulus | `test/services/rentalExtension.test.ts` `dua Admin memperpanjang sewa yang sama bersamaan: tepat satu berhasil` |
| 62 | Sewa yang sudah berakhir tidak bisa diperpanjang | Perpanjangan sewa berakhir kemarin; sewa dengan id 999999 | ConflictError: Sewa sudah berakhir dan tidak bisa diperpanjang; NotFoundError: Sewa tidak ditemukan. | Lulus | `test/services/rentalExtension.test.ts` `menolak sewa yang sudah berakhir dan sewa yang tidak ada` |

### F.6 Laporan Penyewaan

| No | Skenario | Masukan | Hasil yang Diharapkan | Hasil Aktual | Berkas Tes |
| --- | --- | --- | --- | --- | --- |
| 63 | Nilai satu sewa beserta perpanjangan | Total biaya 30000, perpanjangan 70000 dan 10000 | 110000 | Lulus | `test/unit/rentalReport.test.ts` `menjumlahkan total biaya dan semua biaya perpanjangan` |
| 64 | Rentang laporan satu tahun | Tahun 2026 | 2026-01-01 sampai 2027-01-01 (batas akhir eksklusif) | Lulus | `test/unit/rentalReport.test.ts` `memberi rentang satu tahun dengan batas akhir eksklusif` |
| 65 | Rentang laporan satu bulan | Desember 2026 dan Februari 2028 | 2026-12-01 sampai 2027-01-01; 2028-02-01 sampai 2028-03-01 | Lulus | `test/unit/rentalReport.test.ts` `memberi rentang satu bulan, termasuk Desember dan Februari kabisat` |
| 66 | Tahun dan bulan tidak sah ditolak | Tahun 1999, 2101, 2026,5; bulan 0, 13, 1,5 | RangeError | Lulus | `test/unit/rentalReport.test.ts` `menolak tahun di luar 2000 sampai 2100, bulan di luar 1 sampai 12, dan bilangan pecahan` |
| 67 | Laporan bulanan selalu 12 baris | Tahun 2026 | 12 baris, Januari 2026 sampai Desember 2026 | Lulus | `test/unit/rentalReport.test.ts` `selalu memberi 12 baris dengan kunci dan label bulan` |
| 68 | Sewa masuk bulan tanggal mulainya | Sewa mulai 2026-01-01, 2026-01-31, 2026-12-31, juga 2025-12-31 dan 2027-01-01 | Januari 2 sewa (35000), Desember 1 sewa (40000), tahun lain diabaikan | Lulus | `test/unit/rentalReport.test.ts` `menaruh sewa pada bulan tanggal mulainya dan mengabaikan tahun lain` |
| 69 | Laporan harian Februari kabisat | Sewa 2028-02-29 (50000) dan 2028-03-01 (70000), laporan Februari 2028 | 29 baris, 29 Februari 1 sewa 50000, total 50000 | Lulus | `test/unit/rentalReport.test.ts` `Februari kabisat 2028 punya 29 baris dan 29 Februari terisi` |
| 70 | Laporan per tipe garasi | Dua sewa Mobil: 1000, dan 2000 dengan perpanjangan 500 | Tiga baris Sepeda 0, Mobil 2 sewa 3500, Mobil Listrik 0; total 3500 | Lulus | `test/unit/rentalReport.test.ts` `selalu memberi tiga baris berurutan termasuk tipe tanpa sewa` |
| 71 | Laporan bulanan dari database | Lima sewa contoh dan perpanjangan, tahun 2026 | Januari 2 sewa 1300000, November 1 sewa 2390000, total 3 sewa 3690000 | Lulus | `test/services/report.test.ts` `menjumlahkan sewa per bulan pada tahun yang dipilih, termasuk perpanjangan` |
| 72 | Laporan harian Februari kabisat dari database | Tahun 2028, bulan 2 | 29 baris, 29 Februari 1 sewa 50000 | Lulus | `test/services/report.test.ts` `Februari kabisat 2028 punya 29 baris dan 29 Februari terisi` |
| 73 | Laporan per tipe garasi dari database | Lima sewa contoh | Sepeda 2 sewa 60000, Mobil 2 sewa 1300000, Mobil Listrik 1 sewa 2390000; total 5 sewa 3750000 | Lulus | `test/services/report.test.ts` `menjumlahkan sewa per tipe garasi sepanjang waktu` |
| 74 | Laporan per penyewa dari database | Lima sewa contoh, tiga penyewa terdaftar | Budi 3 sewa 2490000, Citra 2 sewa 1260000; penyewa tanpa sewa tidak muncul | Lulus | `test/services/report.test.ts` `menjumlahkan sewa per penyewa dan tidak memuat penyewa tanpa sewa` |

### F.7 Akun, Login, dan Verifikasi

| No | Skenario | Masukan | Hasil yang Diharapkan | Hasil Aktual | Berkas Tes |
| --- | --- | --- | --- | --- | --- |
| 75 | Hak masuk sistem | Admin diterima; penyewa diterima, menunggu, ditolak | true; true; false; false | Lulus | `test/unit/User.test.ts` `mengizinkan masuk untuk Admin dan penyewa yang diterima saja` |
| 76 | Hak menyewa | Penyewa diterima, menunggu, ditolak; Admin | true; false; false; false | Lulus | `test/unit/User.test.ts` `mengizinkan menyewa hanya untuk penyewa yang diterima` |
| 77 | Registrasi penyewa baru | Formulir sah (NIK 16 digit, telepon, email, password) | Tersimpan sebagai RENTER berstatus PENDING, password ter-hash bcrypt | Lulus | `test/services/register.test.ts` `menyimpan penyewa berstatus PENDING dengan data yang dirapikan dan password ter-hash` |
| 78 | Email ganda ditolak | Daftar dua kali dengan email sama, NIK berbeda | DuplicateUserError: Email sudah terdaftar. | Lulus | `test/services/register.test.ts` `menolak email yang sudah terdaftar` |
| 79 | NIK ganda ditolak | Daftar dua kali dengan NIK sama, email berbeda | DuplicateUserError: NIK sudah terdaftar. | Lulus | `test/services/register.test.ts` `menolak NIK yang sudah terdaftar` |
| 80 | Data registrasi tidak valid | NIK 15 digit, nama Bu, telepon 12345, email bukan-email, password 7 karakter | Pesan Bahasa Indonesia per field, tidak ada data tersimpan | Lulus | `test/services/register.test.ts` `menolak data tidak valid dengan pesan per field dan tidak menyimpan apa pun` |
| 81 | Login Admin | Email Admin@Garasi.TEST dengan spasi dan huruf besar, password benar | Masuk sebagai ADMIN, email dirapikan, tanpa passwordHash | Lulus | `test/services/login.test.ts` `memasukkan Admin dengan password benar dan merapikan email` |
| 82 | Pesan login seragam | Email tak dikenal; password salah | Keduanya: Email atau password salah. | Lulus | `test/services/login.test.ts` `memberi pesan sama untuk email tak dikenal dan password salah` |
| 83 | Penyewa menunggu tidak bisa masuk | Penyewa PENDING dengan password benar | AccountNotVerifiedError: Akun Anda masih menunggu verifikasi admin. | Lulus | `test/services/login.test.ts` `menolak penyewa yang masih menunggu setelah password benar` |
| 84 | Penyewa ditolak tidak bisa masuk | Penyewa REJECTED dengan password benar | AccountNotVerifiedError: Pendaftaran Anda ditolak oleh admin. | Lulus | `test/services/login.test.ts` `menolak penyewa yang ditolak setelah password benar` |
| 85 | Penerimaan wajib konfirmasi KTP | Admin menerima pendaftar tanpa mencentang konfirmasi KTP | ValidationError: Centang konfirmasi validasi KTP sebelum menerima pendaftar.; status tetap PENDING | Lulus | `test/services/verification.test.ts` `menolak penerimaan tanpa konfirmasi KTP dan status tetap menunggu` |
| 86 | Admin menerima pendaftar | Keputusan ACCEPT dengan konfirmasi KTP | Status ACCEPTED, tersimpan Admin yang memutuskan dan waktunya | Lulus | `test/services/verification.test.ts` `menerima dengan konfirmasi KTP dan menyimpan siapa yang memutuskan serta waktunya` |
| 87 | Keputusan kedua ditolak | REJECT lalu ACCEPT untuk pendaftar yang sama | ConflictError: Pendaftar ini sudah diproses sebelumnya.; status tetap REJECTED | Lulus | `test/services/verification.test.ts` `menolak keputusan kedua untuk pendaftar yang sama` |

### F.8 Bukti Pembayaran, Validasi, dan Galat

| No | Skenario | Masukan | Hasil yang Diharapkan | Hasil Aktual | Berkas Tes |
| --- | --- | --- | --- | --- | --- |
| 88 | Tanda tangan berkas gambar dikenali | Byte awal JPEG, PNG, dan WebP | jpg, png, webp | Lulus | `test/unit/rental.test.ts` `mengenali JPEG, PNG, dan WebP dari tanda tangan byte` |
| 89 | Berkas bukan gambar ditolak | Berkas GIF, PDF, WAV, teks biasa, dan data kosong | null untuk semuanya | Lulus | `test/unit/rental.test.ts` `menolak GIF, PDF, WAV, teks biasa, dan data kosong` |
| 90 | Batas ukuran bukti bayar | Konstanta PAYMENT_PROOF_MAX_BYTES dan tipe konten | 2097152 byte (2 MB); image/png, image/jpeg, image/webp | Lulus | `test/unit/rental.test.ts` `batas ukuran 2 MB dan tipe konten` |
| 91 | Bukti pembayaran wajib diunggah | Sewa tanpa berkas bukti | Bukti pembayaran wajib diunggah; tidak ada sewa atau berkas tersimpan | Lulus | `test/services/rental.test.ts` `menolak bukti yang tidak diunggah` |
| 92 | Bukti pembayaran harus gambar | Berkas berisi teks biasa | Bukti pembayaran harus gambar JPEG, PNG, atau WebP | Lulus | `test/services/rental.test.ts` `menolak berkas yang bukan gambar JPEG, PNG, atau WebP` |
| 93 | Bukti pembayaran maksimal 2 MB | Gambar PNG berukuran 2 MB + 1 byte | Ukuran bukti pembayaran paling besar 2 MB | Lulus | `test/services/rental.test.ts` `menolak gambar lebih dari 2 MB` |
| 94 | Bukti bayar hanya untuk pemilik dan Admin | Penyewa lain, pemilik sewa, dan Admin membuka bukti | Penyewa lain NotFoundError; pemilik dan Admin menerima gambar PNG | Lulus | `test/services/rental.test.ts` `penyewa lain tidak melihat sewa dan bukti bayar milik orang lain` |
| 95 | Sisa baterai melebihi kapasitas ditolak | Kapasitas 60, sisa 60,1 | Sisa baterai tidak boleh melebihi kapasitas baterai; tidak ada sewa dibuat | Lulus | `test/services/rental.test.ts` `sisa baterai melebihi kapasitas ditolak di field remainingKwh` |
| 96 | Isian klien untuk nilai server diabaikan | Isian ikut mengirim renterId lain, totalCost 1, dailyPrice 1, startDate 2000-01-01 | Penyewa yang login, total 30000, mulai hari ini | Lulus | `test/services/rental.test.ts` `isian dari klien untuk penyewa, harga, dan tanggal diabaikan` |
| 97 | Pesan validasi pembuatan garasi | Jumlah 0 dan 1000; tipe TRUCK; harga harian kosong | Jumlah garasi paling sedikit 1; Jumlah maksimum 999; Tipe garasi tidak valid; Harga harian wajib diisi angka | Lulus | `test/services/garage.test.ts` `masukan tidak valid menghasilkan pesan Bahasa Indonesia per field` |
| 98 | Mobil listrik wajib harga per kWh | Admin membuat 2 Mobil Listrik tanpa harga per kWh | Harga per kWh wajib untuk Mobil Listrik; tidak ada garasi dibuat | Lulus | `test/services/garage.test.ts` `Mobil Listrik tanpa harga per kWh ditolak dan tidak ada yang dibuat` |
| 99 | Galat database tidak ditampilkan ke pengguna | Error biasa dibungkus toAppError | DatabaseError dengan pesan umum Bahasa Indonesia, penyebab asli disimpan, tidak ditampilkan | Lulus | `test/unit/errors.test.ts` `membungkus error biasa menjadi DatabaseError yang tidak ditampilkan ke pengguna` |

## G. Link GitHub

Kode program aplikasi tersimpan pada repositori GitHub berikut:

https://github.com/inikenliii/LSP_KenleyJonathan

> Catatan untuk peserta (hapus sebelum laporan dikumpulkan): saat dokumen ini ditulis, repositori masih privat. Sebelum batas waktu, ubah repositori menjadi publik atau tambahkan asesor sebagai collaborator agar tautan di atas dapat dibuka.

## Lampiran A: Arsitektur dan Konsep Pemrograman

### Arsitektur berlapis

| Lapisan | Folder | Tugas |
| --- | --- | --- |
| Domain | `src/domain` | Kelas dan fungsi aturan bisnis murni (harga, tanggal, ID garasi, kecocokan kendaraan, perpanjangan, laporan, hierarki error) tanpa akses database |
| Validasi | `src/validation` | Skema Zod yang memeriksa isian formulir dan menghasilkan pesan galat Bahasa Indonesia |
| Repository | `src/repositories` | Satu-satunya tempat yang memakai Prisma dan SQL; menyembunyikan database di balik interface |
| Layanan | `src/services` | Alur kerja aplikasi (daftar, masuk, verifikasi, buat garasi, sewa, perpanjangan, laporan) yang memakai domain, validasi, dan repository |
| Perakitan | `src/lib/container.ts` | Membuat objek repository dan layanan lalu menyerahkannya ke halaman |
| Halaman dan aksi | `src/app` | Halaman Next.js dan Server Action; hanya mengambil layanan dari container |
| Komponen | `src/components` | Formulir, tabel laporan, tata letak, animasi, dan komponen antarmuka |

### Konsep pemrograman berorientasi objek

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

### Akses database

Seluruh akses database lewat Prisma dan hanya ada di `src/repositories`. Tiga operasi berjalan dalam satu transaksi database agar atomik: pembuatan garasi berkelompok (`GarageRepository.createBatch` di `src/repositories/GarageRepository.ts`), pembuatan sewa (`RentalRepository.createRental` di `src/repositories/RentalRepository.ts`), dan pembuatan perpanjangan (`RentalExtensionRepository.createExtension` di `src/repositories/RentalExtensionRepository.ts`). Skema dan migrasi ada di `prisma/schema.prisma` dan `prisma/migrations` (enam migrasi).

### Penanganan error

Semua error aplikasi turunan `AppError` (`src/domain/errors.ts`), antara lain error validasi dengan pesan per field, duplikasi pengguna, autentikasi gagal, akun belum diverifikasi, tidak berwenang, tidak ditemukan, bentrok, dan kapasitas terlampaui. Fungsi `toAppError` membungkus error tak terduga menjadi error database dengan pesan umum, sedangkan penyebab teknis hanya dicatat di server. Halaman galat umum ada di `src/app/error.tsx` dan halaman tidak ditemukan di `src/app/not-found.tsx`.

### Komentar dokumentasi

Seluruh kelas, fungsi, dan interface di `src/domain`, `src/services`, `src/repositories`, `src/validation`, dan `src/lib` diberi komentar TSDoc berbahasa Indonesia dengan tag `@param`, `@returns`, `@throws`, dan `@example` bila perlu.

Dokumentasi API dibuat dari komentar TSDoc tersebut memakai TypeDoc dengan menjalankan `npm run docs`, lalu dibuka lewat `docs/api/index.html`. Folder `docs/api` adalah keluaran yang dibuat ulang setiap kali perintah dijalankan dan tidak disimpan di repositori.

## Lampiran B: Aturan Bisnis

Tabel ini hanya memuat perilaku yang dilakukan kode. Setiap aturan punya tes otomatis (lihat Bab F).

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

## Lampiran C: Cara Menjalankan

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
