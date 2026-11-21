/**
 * @file Aturan perpanjangan sewa. Fungsi murni yang sama dipakai untuk pratinjau
 * di formulir dan untuk nilai yang disimpan server.
 *
 * Admin tidak punya batas total perpanjangan, tetapi tiap perpanjangan berjenis
 * HARIAN atau BULANAN dengan aturan yang sama seperti sewa baru:
 * - HARIAN: 1 sampai (jumlah hari pada bulan tanggal selesai saat ini - 1) hari;
 *   sisa biaya = jumlah hari x salinan harga harian milik sewa itu.
 * - BULANAN: jumlah bulan bilangan bulat 1 sampai 1200; tiap bulan menambah
 *   jumlah hari pada bulan tempat langkah itu dimulai; sisa biaya =
 *   jumlah bulan x 25 x salinan harga harian.
 * Biaya pengisian baterai sudah dibayar bersama sewa awal sehingga tidak
 * ditambahkan lagi. Tidak ada biaya tambahan atau diskon, dan sisa biaya tidak
 * pernah negatif.
 */
import { monthlyPrice } from './pricing';
import { addDays, computeEndDate, daysInMonth, type RentalTypeCode } from './rentalPeriod';

/** Jumlah milidetik dalam satu hari. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Nilai terbesar kolom INTEGER PostgreSQL; batas atas tambahan hari dan sisa biaya. */
export const MAX_EXTENSION_VALUE = 2_147_483_647;

/** Pesan bila tanggal selesai baru membuat tambahan hari atau sisa biaya melewati batas kolom. */
export const EXTENSION_TOO_FAR_MESSAGE = 'Tanggal selesai baru terlalu jauh';

/** Jumlah bulan terbanyak dalam satu perpanjangan bulanan. */
export const MAX_EXTENSION_MONTHS = 1200;

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

/**
 * Dilempar bila jumlah hari atau bulan perpanjangan di luar batas yang diizinkan
 * atau bukan bilangan bulat. Pesannya sudah dalam Bahasa Indonesia dan boleh
 * ditampilkan di samping isian jumlah.
 */
export class ExtensionQuantityError extends RangeError {
  /**
   * @param message Pesan Bahasa Indonesia yang menyebut batas jumlah.
   */
  constructor(message: string) {
    super(message);
    this.name = 'ExtensionQuantityError';
  }
}

/** Masukan perhitungan perpanjangan. */
export interface ExtensionCostInput {
  /** Jenis perpanjangan: harian atau bulanan. */
  extensionType: RentalTypeCode;
  /** Jumlah hari (HARIAN) atau jumlah bulan (BULANAN). */
  quantity: number;
  /** Tanggal selesai sewa saat ini (tanggal-saja). */
  currentEndDate: Date;
  /** Salinan harga harian milik sewa, dalam rupiah. */
  dailyPrice: number;
}

/** Hasil perhitungan perpanjangan. */
export interface ExtensionCostBreakdown {
  /** Tanggal selesai baru (tanggal-saja). */
  newEndDate: Date;
  /** Jumlah hari kalender antara tanggal selesai saat ini dan yang baru, minimal 1. */
  additionalDays: number;
  /** Sisa biaya yang harus dibayar dalam rupiah bulat. */
  amount: number;
}

/**
 * Menghitung jumlah hari kalender antara dua tanggal selesai.
 *
 * @param currentEndDate Tanggal selesai saat ini (tanggal-saja).
 * @param newEndDate Tanggal selesai baru (tanggal-saja).
 * @returns Selisih hari; 0 bila sama dan negatif bila tanggal baru lebih awal.
 * @example
 * countAdditionalDays(parseIsoDate('2026-12-31'), parseIsoDate('2027-01-01')); // 1
 */
export function countAdditionalDays(currentEndDate: Date, newEndDate: Date): number {
  return Math.round((newEndDate.getTime() - currentEndDate.getTime()) / MS_PER_DAY);
}

/**
 * Jumlah hari terbanyak untuk perpanjangan harian: jumlah hari pada bulan
 * tanggal selesai saat ini dikurangi satu (November: 29, Februari 2027: 27,
 * Februari 2028 yang kabisat: 28).
 *
 * @param currentEndDate Tanggal selesai saat ini (tanggal-saja).
 * @returns Jumlah hari maksimum perpanjangan harian.
 * @example
 * maxExtensionDays(parseIsoDate('2026-11-21')); // 29
 */
export function maxExtensionDays(currentEndDate: Date): number {
  return daysInMonth(currentEndDate) - 1;
}

/**
 * Menghitung tanggal selesai baru, tambahan hari, dan sisa biaya perpanjangan.
 * Perpanjangan bulanan menerapkan aturan akhir sewa bulanan berulang kali: tiap
 * langkah menambah jumlah hari pada bulan tempat langkah itu dimulai.
 *
 * @param input Jenis, jumlah, tanggal selesai saat ini, dan harga harian sewa.
 * @returns Tanggal selesai baru, tambahan hari, dan sisa biaya dalam rupiah bulat.
 * @throws {ExtensionQuantityError} (turunan `RangeError`) Bila jumlah bukan bilangan bulat
 *   dalam batas: 1 sampai `maxExtensionDays` (harian) atau 1 sampai 1200 (bulanan).
 * @throws {RangeError} Bila harga harian bukan bilangan bulat tidak negatif.
 * @throws {ExtensionTooFarError} (turunan `RangeError`) Bila tambahan hari atau sisa biaya
 *   melebihi 2.147.483.647, batas kolom INTEGER database.
 * @example
 * // Berakhir 21 Nov 2026, harga harian 10000: harian 10 hari.
 * calculateExtensionCost({ extensionType: 'HARIAN', quantity: 10,
 *   currentEndDate: parseIsoDate('2026-11-21'), dailyPrice: 10000 });
 * // { newEndDate: 2026-12-01, additionalDays: 10, amount: 100000 }
 * @example
 * // Bulanan 2 bulan: 21 Nov 2026 + 30 hari + 31 hari = 21 Jan 2027.
 * calculateExtensionCost({ extensionType: 'BULANAN', quantity: 2,
 *   currentEndDate: parseIsoDate('2026-11-21'), dailyPrice: 10000 });
 * // { newEndDate: 2027-01-21, additionalDays: 61, amount: 500000 }
 */
export function calculateExtensionCost(input: ExtensionCostInput): ExtensionCostBreakdown {
  const { extensionType, quantity, currentEndDate, dailyPrice } = input;
  if (!Number.isSafeInteger(dailyPrice) || dailyPrice < 0) {
    throw new RangeError('Harga harian harus bilangan bulat tidak negatif.');
  }

  let newEndDate: Date;
  let amount: number;
  if (extensionType === 'BULANAN') {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_EXTENSION_MONTHS) {
      throw new ExtensionQuantityError(
        `Jumlah bulan perpanjangan harus bilangan bulat 1 sampai ${MAX_EXTENSION_MONTHS}.`,
      );
    }
    newEndDate = currentEndDate;
    for (let bulan = 0; bulan < quantity; bulan += 1) {
      newEndDate = computeEndDate(newEndDate, 'BULANAN');
    }
    amount = quantity * monthlyPrice(dailyPrice);
  } else {
    const batas = maxExtensionDays(currentEndDate);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > batas) {
      throw new ExtensionQuantityError(
        `Jumlah hari perpanjangan harus bilangan bulat 1 sampai ${batas}.`,
      );
    }
    newEndDate = addDays(currentEndDate, quantity);
    amount = quantity * dailyPrice;
  }

  const additionalDays = countAdditionalDays(currentEndDate, newEndDate);
  if (additionalDays > MAX_EXTENSION_VALUE || amount > MAX_EXTENSION_VALUE) {
    throw new ExtensionTooFarError();
  }
  return { newEndDate, additionalDays, amount };
}
