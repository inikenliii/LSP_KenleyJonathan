/**
 * @file Aturan masa sewa: tanggal hari ini di Jakarta, jumlah hari per bulan,
 * batas sewa harian, tanggal berakhir, dan status aktif.
 *
 * Nilai tanggal-saja (tanpa jam) disimpan sebagai objek `Date` pada tengah
 * malam UTC. Bentuk ini sama dengan kolom `@db.Date` Prisma sehingga tidak ada
 * pergeseran hari akibat zona waktu.
 *
 * Modul ini murni: tidak mengimpor framework, ORM, atau driver database.
 */

/** Kode tipe sewa seperti yang disimpan di database. */
export type RentalTypeCode = 'HARIAN' | 'BULANAN';

/** Semua kode tipe sewa. */
export const RENTAL_TYPE_CODES = ['HARIAN', 'BULANAN'] as const;

/** Label tipe sewa dalam Bahasa Indonesia. */
export const RENTAL_TYPE_LABELS: Readonly<Record<RentalTypeCode, string>> = {
  HARIAN: 'Harian',
  BULANAN: 'Bulanan',
};

/** Zona waktu yang dipakai untuk menentukan tanggal mulai sewa. */
export const RENTAL_TIME_ZONE = 'Asia/Jakarta';

/** Jumlah milidetik dalam satu hari. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Tanggal kalender hari ini di Asia/Jakarta, sebagai tanggal-saja (UTC tengah malam).
 *
 * @param now Waktu acuan; bawaannya saat ini.
 * @returns Tanggal hari ini di Jakarta.
 * @example
 * toIsoDate(todayInJakarta(new Date('2026-11-21T17:00:00Z'))); // "2026-11-22"
 */
export function todayInJakarta(now: Date = new Date()): Date {
  const teks = new Intl.DateTimeFormat('en-CA', {
    timeZone: RENTAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parseIsoDate(teks);
}

/**
 * Mengubah teks `YYYY-MM-DD` menjadi tanggal-saja (UTC tengah malam).
 *
 * @param iso Teks tanggal.
 * @returns Tanggal-saja.
 * @throws {RangeError} Bila format bukan `YYYY-MM-DD` atau tanggalnya tidak ada di kalender.
 */
export function parseIsoDate(iso: string): Date {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!cocok) {
    throw new RangeError('Format tanggal harus YYYY-MM-DD.');
  }
  const [tahun, bulan, hari] = [Number(cocok[1]), Number(cocok[2]), Number(cocok[3])];
  const tanggal = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (
    tanggal.getUTCFullYear() !== tahun ||
    tanggal.getUTCMonth() !== bulan - 1 ||
    tanggal.getUTCDate() !== hari
  ) {
    throw new RangeError('Tanggal tidak ada di kalender.');
  }
  return tanggal;
}

/**
 * Mengubah tanggal-saja menjadi teks `YYYY-MM-DD`.
 *
 * @param date Tanggal-saja (UTC tengah malam).
 * @returns Teks tanggal.
 */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Jumlah hari pada bulan dari tanggal yang diberikan, memakai kalender
 * Gregorian bawaan sehingga tahun kabisat dan aturan abad sudah benar
 * (bukan angka tetap 30).
 *
 * @param date Tanggal-saja yang bulannya dihitung.
 * @returns 28, 29, 30, atau 31.
 * @example
 * daysInMonth(parseIsoDate('2028-02-10')); // 29
 */
export function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

/**
 * Batas jumlah hari untuk sewa harian: jumlah hari bulan mulai dikurangi satu
 * (November: 29, Februari tidak kabisat: 27).
 *
 * @param start Tanggal mulai sewa.
 * @returns Jumlah hari maksimum sewa harian.
 */
export function maxDailyDays(start: Date): number {
  return daysInMonth(start) - 1;
}

/**
 * Menambah jumlah hari pada tanggal-saja.
 *
 * @param date Tanggal awal.
 * @param days Jumlah hari yang ditambahkan.
 * @returns Tanggal baru.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Menghitung tanggal berakhir sewa.
 *
 * - HARIAN: mulai + jumlah hari (1 sampai `maxDailyDays(start)`).
 * - BULANAN: mulai + jumlah hari pada bulan tanggal mulai. Contoh: mulai
 *   10 Feb 2027 (28 hari) berakhir 10 Mar 2027; 10 Feb 2028 (kabisat, 29 hari)
 *   berakhir 10 Mar 2028; 21 Nov 2026 (30 hari) berakhir 21 Des 2026;
 *   31 Jan 2026 (31 hari) berakhir 3 Mar 2026. Argumen `days` diabaikan.
 *
 * @param start Tanggal mulai sewa.
 * @param rentalType Tipe sewa.
 * @param days Jumlah hari (hanya untuk HARIAN).
 * @returns Tanggal berakhir.
 * @throws {RangeError} Bila sewa harian tanpa jumlah hari bulat 1 sampai batas.
 */
export function computeEndDate(start: Date, rentalType: RentalTypeCode, days?: number | null): Date {
  if (rentalType === 'BULANAN') {
    return addDays(start, daysInMonth(start));
  }
  const batas = maxDailyDays(start);
  if (days === undefined || days === null || !Number.isInteger(days) || days < 1 || days > batas) {
    throw new RangeError(`Jumlah hari sewa harian harus bilangan bulat 1 sampai ${batas}.`);
  }
  return addDays(start, days);
}

/**
 * Apakah sewa masih berlaku. Sewa masih aktif pada tanggal berakhirnya.
 *
 * @param endDate Tanggal berakhir sewa.
 * @param today Tanggal hari ini.
 * @returns `true` bila tanggal berakhir sama dengan atau setelah hari ini.
 */
export function isRentalActive(endDate: Date, today: Date): boolean {
  return endDate.getTime() >= today.getTime();
}

/**
 * Memformat tanggal-saja dalam Bahasa Indonesia.
 *
 * @param date Tanggal-saja (UTC tengah malam).
 * @returns Teks seperti "21 November 2026".
 */
export function formatTanggal(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Memformat waktu simpan (tanggal dan jam) dalam Bahasa Indonesia, zona Asia/Jakarta.
 *
 * @param date Waktu yang diformat.
 * @returns Teks seperti "21 November 2026 14.30".
 * @example
 * formatTanggalWaktu(new Date('2026-11-21T07:30:00Z')); // "21 November 2026 14.30"
 */
export function formatTanggalWaktu(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: RENTAL_TIME_ZONE,
  }).format(date);
}
