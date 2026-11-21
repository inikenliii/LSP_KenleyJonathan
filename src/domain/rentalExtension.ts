/**
 * @file Aturan perpanjangan sewa. Fungsi murni yang sama dipakai untuk pratinjau
 * di formulir dan untuk nilai yang disimpan server.
 *
 * Aturannya: Admin hanya memajukan tanggal selesai (tidak memendekkan). Tambahan
 * hari = selisih hari kalender antara tanggal selesai saat ini dan tanggal selesai
 * baru. Sisa biaya = tambahan hari x salinan harga harian milik sewa itu sendiri,
 * sama untuk sewa harian maupun bulanan. Biaya pengisian baterai penuh sudah
 * dibayar bersama sewa awal sehingga tidak ditambahkan lagi. Tidak ada biaya
 * tambahan, diskon, ataupun batas maksimum lama perpanjangan, dan sisa biaya
 * tidak pernah negatif.
 */

/** Jumlah milidetik dalam satu hari. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Nilai terbesar kolom INTEGER PostgreSQL; batas atas tambahan hari dan sisa biaya. */
export const MAX_EXTENSION_VALUE = 2_147_483_647;

/** Pesan bila tanggal selesai baru membuat tambahan hari atau sisa biaya melewati batas kolom. */
export const EXTENSION_TOO_FAR_MESSAGE = 'Tanggal selesai baru terlalu jauh';

/**
 * Dilempar bila tambahan hari atau sisa biaya melewati {@link MAX_EXTENSION_VALUE}
 * sehingga tidak muat di kolom INTEGER database.
 */
export class ExtensionTooFarError extends RangeError {
  /** Membuat error dengan pesan baku {@link EXTENSION_TOO_FAR_MESSAGE}. */
  constructor() {
    super(EXTENSION_TOO_FAR_MESSAGE);
    this.name = 'ExtensionTooFarError';
  }
}

/** Masukan perhitungan sisa biaya perpanjangan. */
export interface ExtensionCostInput {
  /** Tanggal selesai sewa saat ini (tanggal-saja). */
  currentEndDate: Date;
  /** Tanggal selesai baru yang dipilih Admin (tanggal-saja). */
  newEndDate: Date;
  /** Salinan harga harian milik sewa, dalam rupiah. */
  dailyPrice: number;
}

/** Rincian sisa biaya perpanjangan. */
export interface ExtensionCostBreakdown {
  /** Jumlah hari tambahan, minimal 1. */
  additionalDays: number;
  /** Sisa biaya yang harus dibayar dalam rupiah bulat: `additionalDays x dailyPrice`. */
  amount: number;
}

/**
 * Menghitung jumlah hari kalender antara dua tanggal selesai.
 *
 * @param currentEndDate Tanggal selesai saat ini (tanggal-saja).
 * @param newEndDate Tanggal selesai baru (tanggal-saja).
 * @returns Selisih hari; 0 bila sama dan negatif bila tanggal baru lebih awal
 *   (pemanggil yang menolaknya).
 * @example
 * countAdditionalDays(parseIsoDate('2026-12-31'), parseIsoDate('2027-01-01')); // 1
 */
export function countAdditionalDays(currentEndDate: Date, newEndDate: Date): number {
  return Math.round((newEndDate.getTime() - currentEndDate.getTime()) / MS_PER_DAY);
}

/**
 * Menghitung tambahan hari dan sisa biaya perpanjangan.
 *
 * @param input Tanggal selesai saat ini, tanggal selesai baru, dan harga harian sewa.
 * @returns Tambahan hari dan sisa biaya dalam rupiah bulat.
 * @throws {RangeError} Bila tanggal baru tidak setelah tanggal selesai saat ini, atau
 *   harga harian bukan bilangan bulat tidak negatif.
 * @throws {ExtensionTooFarError} (turunan `RangeError`) Bila tambahan hari atau sisa biaya
 *   melebihi 2.147.483.647, batas kolom INTEGER database.
 * @example
 * // Sewa bulanan, harga harian 80000, diperpanjang 31 hari (bukan 25 x harga harian).
 * calculateExtensionCost({ currentEndDate: parseIsoDate('2026-12-21'),
 *   newEndDate: parseIsoDate('2027-01-21'), dailyPrice: 80000 });
 * // { additionalDays: 31, amount: 2480000 }
 */
export function calculateExtensionCost(input: ExtensionCostInput): ExtensionCostBreakdown {
  const additionalDays = countAdditionalDays(input.currentEndDate, input.newEndDate);
  if (additionalDays < 1) {
    throw new RangeError('Tanggal selesai baru harus setelah tanggal selesai saat ini.');
  }
  if (!Number.isSafeInteger(input.dailyPrice) || input.dailyPrice < 0) {
    throw new RangeError('Harga harian harus bilangan bulat tidak negatif.');
  }
  const amount = additionalDays * input.dailyPrice;
  if (additionalDays > MAX_EXTENSION_VALUE || amount > MAX_EXTENSION_VALUE) {
    throw new ExtensionTooFarError();
  }
  return { additionalDays, amount };
}
