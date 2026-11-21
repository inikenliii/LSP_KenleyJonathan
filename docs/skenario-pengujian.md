# Skenario Pengujian Unit

Dokumen ini memuat skenario pengujian otomatis aplikasi Penyewaan Garasi. Pengujian ditulis dengan Vitest. Tes pada folder `test/unit` menguji fungsi dan kelas domain murni tanpa database. Tes pada folder `test/services` menguji layanan dengan database PostgreSQL terpisah yang namanya berakhiran `_test`; database aplikasi tidak pernah dipakai untuk pengujian.

Cara menjalankan seluruh tes: `npm test` (menjalankan `vitest run`).

## Ringkasan Hasil

- Tanggal dijalankan: 21 November 2026
- Perintah: `npm test`
- Berkas tes: 18
- Jumlah tes: 215
- Lulus: 215
- Gagal: 0

Dokumen ini memuat 94 skenario terpilih dari 215 tes; daftar lengkap tampil saat menjalankan `npm test`.

Kolom Hasil Aktual berisi status tiap tes pada proses tersebut. Kolom Berkas Tes memuat jalur berkas dan judul tes persis seperti yang tampil di Vitest.

## 1. Harga Sewa dan Biaya Pengisian

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

## 2. ID Garasi

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

## 3. Kecocokan Kendaraan dan Garasi

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

## 4. Tanggal Sewa

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

## 5. Perpanjangan Sewa

| No | Skenario | Masukan | Hasil yang Diharapkan | Hasil Aktual | Berkas Tes |
| --- | --- | --- | --- | --- | --- |
| 46 | Tambahan hari antara dua tanggal | Berakhir 2026-11-24 ke 2026-11-30 dan ke 2026-12-24 | 6 hari dan 30 hari | Lulus | `test/unit/rentalExtension.test.ts` `menghitung hari kalender antara dua tanggal selesai` |
| 47 | Tambahan hari melewati Februari | 2027-02-28 ke 2027-03-01; 2028-02-28 ke 2028-03-01 | 1 hari dan 2 hari | Lulus | `test/unit/rentalExtension.test.ts` `sadar Februari biasa dan kabisat` |
| 48 | Sisa biaya perpanjangan | Berakhir 2026-11-24 diperpanjang ke 2026-11-30, harga harian 10000 | 6 hari, sisa biaya 60000 | Lulus | `test/unit/rentalExtension.test.ts` `sisa biaya = tambahan hari x harga harian` |
| 49 | Perpanjangan bulanan dihitung per hari | 2026-12-21 ke 2027-01-21, harga harian 80000 | 31 hari, sisa biaya 2480000 (bukan 25 x harga harian) | Lulus | `test/unit/rentalExtension.test.ts` `sewa bulanan memakai hari x harga harian, bukan 25 x harga harian` |
| 50 | Perpanjangan beberapa bulan tanpa batas | 2026-11-24 ke 2027-05-24, harga harian 50000 | 181 hari, sisa biaya 9050000 | Lulus | `test/unit/rentalExtension.test.ts` `boleh memperpanjang beberapa bulan tanpa batas maksimum` |
| 51 | Daftar sewa aktif untuk perpanjangan | Satu sewa sepeda S001 harian 3 hari yang baru dibuat | Satu baris: S001, Sepeda, Penyewa A, Harian, berakhir hari ini + 3, harga harian 10000, tanggal baru minimum hari ini + 4 | Lulus | `test/services/rentalExtension.test.ts` `menampilkan sewa yang aktif hari ini lengkap dengan label` |
| 52 | Sewa yang sudah berakhir tidak ditampilkan | Sewa berakhir kemarin dan sewa mulai besok | Hanya S001 yang tampil | Lulus | `test/services/rentalExtension.test.ts` `tidak menampilkan sewa yang sudah berakhir atau baru mulai besok` |
| 53 | Memperpanjang sewa harian | Admin memperpanjang S001 dari hari ini + 3 ke hari ini + 10 dengan bukti PNG | 7 hari, harga harian 10000, sisa biaya 70000, riwayat tersimpan, garasi tetap used | Lulus | `test/services/rentalExtension.test.ts` `memperpanjang sewa: tanggal berakhir pindah, riwayat tersimpan, garasi tetap used` |
| 54 | Perpanjangan kedua memakai tanggal terbaru | Perpanjangan ke hari ini + 10, lalu ke hari ini + 12 oleh Admin lain | Perpanjangan kedua dari hari ini + 10, 2 hari, riwayat urut dari yang lama | Lulus | `test/services/rentalExtension.test.ts` `perpanjangan kedua memakai tanggal berakhir terbaru dan riwayat berurut dari yang lama` |
| 55 | Nilai hitungan dari klien diabaikan | Isian ikut mengirim amount 1, additionalDays 99, dailyPrice 1 | Server memakai 7 hari dan 70000 | Lulus | `test/services/rentalExtension.test.ts` `mengabaikan isian yang dikirim klien untuk nilai yang dihitung server` |
| 56 | Dua Admin memperpanjang bersamaan | Dua Admin memperpanjang sewa yang sama serentak | Tepat satu berhasil, yang lain ConflictError: Sewa sudah berubah atau berakhir, muat ulang halaman | Lulus | `test/services/rentalExtension.test.ts` `dua Admin memperpanjang sewa yang sama bersamaan: tepat satu berhasil` |
| 57 | Sewa yang sudah berakhir tidak bisa diperpanjang | Perpanjangan sewa berakhir kemarin; sewa dengan id 999999 | ConflictError: Sewa sudah berakhir dan tidak bisa diperpanjang; NotFoundError: Sewa tidak ditemukan. | Lulus | `test/services/rentalExtension.test.ts` `menolak sewa yang sudah berakhir dan sewa yang tidak ada` |

## 6. Laporan Penyewaan

| No | Skenario | Masukan | Hasil yang Diharapkan | Hasil Aktual | Berkas Tes |
| --- | --- | --- | --- | --- | --- |
| 58 | Nilai satu sewa beserta perpanjangan | Total biaya 30000, perpanjangan 70000 dan 10000 | 110000 | Lulus | `test/unit/rentalReport.test.ts` `menjumlahkan total biaya dan semua biaya perpanjangan` |
| 59 | Rentang laporan satu tahun | Tahun 2026 | 2026-01-01 sampai 2027-01-01 (batas akhir eksklusif) | Lulus | `test/unit/rentalReport.test.ts` `memberi rentang satu tahun dengan batas akhir eksklusif` |
| 60 | Rentang laporan satu bulan | Desember 2026 dan Februari 2028 | 2026-12-01 sampai 2027-01-01; 2028-02-01 sampai 2028-03-01 | Lulus | `test/unit/rentalReport.test.ts` `memberi rentang satu bulan, termasuk Desember dan Februari kabisat` |
| 61 | Tahun dan bulan tidak sah ditolak | Tahun 1999, 2101, 2026,5; bulan 0, 13, 1,5 | RangeError | Lulus | `test/unit/rentalReport.test.ts` `menolak tahun di luar 2000 sampai 2100, bulan di luar 1 sampai 12, dan bilangan pecahan` |
| 62 | Laporan bulanan selalu 12 baris | Tahun 2026 | 12 baris, Januari 2026 sampai Desember 2026 | Lulus | `test/unit/rentalReport.test.ts` `selalu memberi 12 baris dengan kunci dan label bulan` |
| 63 | Sewa masuk bulan tanggal mulainya | Sewa mulai 2026-01-01, 2026-01-31, 2026-12-31, juga 2025-12-31 dan 2027-01-01 | Januari 2 sewa (35000), Desember 1 sewa (40000), tahun lain diabaikan | Lulus | `test/unit/rentalReport.test.ts` `menaruh sewa pada bulan tanggal mulainya dan mengabaikan tahun lain` |
| 64 | Laporan harian Februari kabisat | Sewa 2028-02-29 (50000) dan 2028-03-01 (70000), laporan Februari 2028 | 29 baris, 29 Februari 1 sewa 50000, total 50000 | Lulus | `test/unit/rentalReport.test.ts` `Februari kabisat 2028 punya 29 baris dan 29 Februari terisi` |
| 65 | Laporan per tipe garasi | Dua sewa Mobil: 1000, dan 2000 dengan perpanjangan 500 | Tiga baris Sepeda 0, Mobil 2 sewa 3500, Mobil Listrik 0; total 3500 | Lulus | `test/unit/rentalReport.test.ts` `selalu memberi tiga baris berurutan termasuk tipe tanpa sewa` |
| 66 | Laporan bulanan dari database | Lima sewa contoh dan perpanjangan, tahun 2026 | Januari 2 sewa 1300000, November 1 sewa 2390000, total 3 sewa 3690000 | Lulus | `test/services/report.test.ts` `menjumlahkan sewa per bulan pada tahun yang dipilih, termasuk perpanjangan` |
| 67 | Laporan harian Februari kabisat dari database | Tahun 2028, bulan 2 | 29 baris, 29 Februari 1 sewa 50000 | Lulus | `test/services/report.test.ts` `Februari kabisat 2028 punya 29 baris dan 29 Februari terisi` |
| 68 | Laporan per tipe garasi dari database | Lima sewa contoh | Sepeda 2 sewa 60000, Mobil 2 sewa 1300000, Mobil Listrik 1 sewa 2390000; total 5 sewa 3750000 | Lulus | `test/services/report.test.ts` `menjumlahkan sewa per tipe garasi sepanjang waktu` |
| 69 | Laporan per penyewa dari database | Lima sewa contoh, tiga penyewa terdaftar | Budi 3 sewa 2490000, Citra 2 sewa 1260000; penyewa tanpa sewa tidak muncul | Lulus | `test/services/report.test.ts` `menjumlahkan sewa per penyewa dan tidak memuat penyewa tanpa sewa` |

## 7. Akun, Login, dan Verifikasi

| No | Skenario | Masukan | Hasil yang Diharapkan | Hasil Aktual | Berkas Tes |
| --- | --- | --- | --- | --- | --- |
| 70 | Hak masuk sistem | Admin diterima; penyewa diterima, menunggu, ditolak | true; true; false; false | Lulus | `test/unit/User.test.ts` `mengizinkan masuk untuk Admin dan penyewa yang diterima saja` |
| 71 | Hak menyewa | Penyewa diterima, menunggu, ditolak; Admin | true; false; false; false | Lulus | `test/unit/User.test.ts` `mengizinkan menyewa hanya untuk penyewa yang diterima` |
| 72 | Registrasi penyewa baru | Formulir sah (NIK 16 digit, telepon, email, password) | Tersimpan sebagai RENTER berstatus PENDING, password ter-hash bcrypt | Lulus | `test/services/register.test.ts` `menyimpan penyewa berstatus PENDING dengan data yang dirapikan dan password ter-hash` |
| 73 | Email ganda ditolak | Daftar dua kali dengan email sama, NIK berbeda | DuplicateUserError: Email sudah terdaftar. | Lulus | `test/services/register.test.ts` `menolak email yang sudah terdaftar` |
| 74 | NIK ganda ditolak | Daftar dua kali dengan NIK sama, email berbeda | DuplicateUserError: NIK sudah terdaftar. | Lulus | `test/services/register.test.ts` `menolak NIK yang sudah terdaftar` |
| 75 | Data registrasi tidak valid | NIK 15 digit, nama Bu, telepon 12345, email bukan-email, password 7 karakter | Pesan Bahasa Indonesia per field, tidak ada data tersimpan | Lulus | `test/services/register.test.ts` `menolak data tidak valid dengan pesan per field dan tidak menyimpan apa pun` |
| 76 | Login Admin | Email Admin@Garasi.TEST dengan spasi dan huruf besar, password benar | Masuk sebagai ADMIN, email dirapikan, tanpa passwordHash | Lulus | `test/services/login.test.ts` `memasukkan Admin dengan password benar dan merapikan email` |
| 77 | Pesan login seragam | Email tak dikenal; password salah | Keduanya: Email atau password salah. | Lulus | `test/services/login.test.ts` `memberi pesan sama untuk email tak dikenal dan password salah` |
| 78 | Penyewa menunggu tidak bisa masuk | Penyewa PENDING dengan password benar | AccountNotVerifiedError: Akun Anda masih menunggu verifikasi admin. | Lulus | `test/services/login.test.ts` `menolak penyewa yang masih menunggu setelah password benar` |
| 79 | Penyewa ditolak tidak bisa masuk | Penyewa REJECTED dengan password benar | AccountNotVerifiedError: Pendaftaran Anda ditolak oleh admin. | Lulus | `test/services/login.test.ts` `menolak penyewa yang ditolak setelah password benar` |
| 80 | Penerimaan wajib konfirmasi KTP | Admin menerima pendaftar tanpa mencentang konfirmasi KTP | ValidationError: Centang konfirmasi validasi KTP sebelum menerima pendaftar.; status tetap PENDING | Lulus | `test/services/verification.test.ts` `menolak penerimaan tanpa konfirmasi KTP dan status tetap menunggu` |
| 81 | Admin menerima pendaftar | Keputusan ACCEPT dengan konfirmasi KTP | Status ACCEPTED, tersimpan Admin yang memutuskan dan waktunya | Lulus | `test/services/verification.test.ts` `menerima dengan konfirmasi KTP dan menyimpan siapa yang memutuskan serta waktunya` |
| 82 | Keputusan kedua ditolak | REJECT lalu ACCEPT untuk pendaftar yang sama | ConflictError: Pendaftar ini sudah diproses sebelumnya.; status tetap REJECTED | Lulus | `test/services/verification.test.ts` `menolak keputusan kedua untuk pendaftar yang sama` |

## 8. Bukti Pembayaran, Validasi, dan Galat

| No | Skenario | Masukan | Hasil yang Diharapkan | Hasil Aktual | Berkas Tes |
| --- | --- | --- | --- | --- | --- |
| 83 | Tanda tangan berkas gambar dikenali | Byte awal JPEG, PNG, dan WebP | jpg, png, webp | Lulus | `test/unit/rental.test.ts` `mengenali JPEG, PNG, dan WebP dari tanda tangan byte` |
| 84 | Berkas bukan gambar ditolak | Berkas GIF, PDF, WAV, teks biasa, dan data kosong | null untuk semuanya | Lulus | `test/unit/rental.test.ts` `menolak GIF, PDF, WAV, teks biasa, dan data kosong` |
| 85 | Batas ukuran bukti bayar | Konstanta PAYMENT_PROOF_MAX_BYTES dan tipe konten | 2097152 byte (2 MB); image/png, image/jpeg, image/webp | Lulus | `test/unit/rental.test.ts` `batas ukuran 2 MB dan tipe konten` |
| 86 | Bukti pembayaran wajib diunggah | Sewa tanpa berkas bukti | Bukti pembayaran wajib diunggah; tidak ada sewa atau berkas tersimpan | Lulus | `test/services/rental.test.ts` `menolak bukti yang tidak diunggah` |
| 87 | Bukti pembayaran harus gambar | Berkas berisi teks biasa | Bukti pembayaran harus gambar JPEG, PNG, atau WebP | Lulus | `test/services/rental.test.ts` `menolak berkas yang bukan gambar JPEG, PNG, atau WebP` |
| 88 | Bukti pembayaran maksimal 2 MB | Gambar PNG berukuran 2 MB + 1 byte | Ukuran bukti pembayaran paling besar 2 MB | Lulus | `test/services/rental.test.ts` `menolak gambar lebih dari 2 MB` |
| 89 | Bukti bayar hanya untuk pemilik dan Admin | Penyewa lain, pemilik sewa, dan Admin membuka bukti | Penyewa lain NotFoundError; pemilik dan Admin menerima gambar PNG | Lulus | `test/services/rental.test.ts` `penyewa lain tidak melihat sewa dan bukti bayar milik orang lain` |
| 90 | Sisa baterai melebihi kapasitas ditolak | Kapasitas 60, sisa 60,1 | Sisa baterai tidak boleh melebihi kapasitas baterai; tidak ada sewa dibuat | Lulus | `test/services/rental.test.ts` `sisa baterai melebihi kapasitas ditolak di field remainingKwh` |
| 91 | Isian klien untuk nilai server diabaikan | Isian ikut mengirim renterId lain, totalCost 1, dailyPrice 1, startDate 2000-01-01 | Penyewa yang login, total 30000, mulai hari ini | Lulus | `test/services/rental.test.ts` `isian dari klien untuk penyewa, harga, dan tanggal diabaikan` |
| 92 | Pesan validasi pembuatan garasi | Jumlah 0 dan 1000; tipe TRUCK; harga harian kosong | Jumlah garasi paling sedikit 1; Jumlah maksimum 999; Tipe garasi tidak valid; Harga harian wajib diisi angka | Lulus | `test/services/garage.test.ts` `masukan tidak valid menghasilkan pesan Bahasa Indonesia per field` |
| 93 | Mobil listrik wajib harga per kWh | Admin membuat 2 Mobil Listrik tanpa harga per kWh | Harga per kWh wajib untuk Mobil Listrik; tidak ada garasi dibuat | Lulus | `test/services/garage.test.ts` `Mobil Listrik tanpa harga per kWh ditolak dan tidak ada yang dibuat` |
| 94 | Galat database tidak ditampilkan ke pengguna | Error biasa dibungkus toAppError | DatabaseError dengan pesan umum Bahasa Indonesia, penyebab asli disimpan, tidak ditampilkan | Lulus | `test/unit/errors.test.ts` `membungkus error biasa menjadi DatabaseError yang tidak ditampilkan ke pengguna` |
