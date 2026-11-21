/**
 * @file Perhitungan biaya sewa. Fungsi murni yang sama dipakai untuk pratinjau
 * di formulir dan untuk nilai yang disimpan server.
 *
 * Aturan biaya hanya: harian = hari x harga harian, bulanan = 25 x harga
 * harian, ditambah biaya pengisian baterai penuh untuk mobil listrik di garasi
 * mobil listrik. Tidak ada biaya tambahan atau diskon lain.
 */
import { monthlyPrice } from './pricing';
import type { RentalTypeCode } from './rentalPeriod';

/** Masukan perhitungan biaya sewa. */
export interface RentalCostInput {
  /** Tipe sewa. */
  rentalType: RentalTypeCode;
  /** Jumlah hari (wajib untuk HARIAN, diabaikan untuk BULANAN). */
  days: number | null;
  /** Harga harian tipe garasi dalam rupiah. */
  dailyPrice: number;
  /** Apakah biaya pengisian baterai ikut dihitung. */
  chargesBattery: boolean;
  /** Kapasitas baterai dalam kWh (wajib bila `chargesBattery`). */
  batteryKwh: number | null;
  /** Harga per kWh dalam rupiah (wajib bila `chargesBattery`). */
  pricePerKwh: number | null;
}

/** Rincian biaya sewa dalam rupiah bulat. */
export interface RentalCostBreakdown {
  /** Biaya sewa garasi. */
  rentalCost: number;
  /** Biaya pengisian baterai penuh (0 bila tidak dikenakan). */
  chargeCost: number;
  /** Total yang dibayar: `rentalCost + chargeCost`. */
  totalCost: number;
}

/**
 * Menghitung biaya sewa.
 *
 * @param input Data sewa dan harga.
 * @returns Rincian biaya dalam rupiah bulat.
 * @throws {RangeError} Bila data yang dibutuhkan tidak lengkap.
 * @example
 * calculateRentalCost({ rentalType: 'BULANAN', days: null, dailyPrice: 80000,
 *   chargesBattery: true, batteryKwh: 60, pricePerKwh: 2500 });
 * // { rentalCost: 2000000, chargeCost: 150000, totalCost: 2150000 }
 */
export function calculateRentalCost(input: RentalCostInput): RentalCostBreakdown {
  let rentalCost: number;
  if (input.rentalType === 'BULANAN') {
    rentalCost = monthlyPrice(input.dailyPrice);
  } else {
    if (input.days === null || !Number.isInteger(input.days) || input.days < 1) {
      throw new RangeError('Sewa harian membutuhkan jumlah hari bilangan bulat positif.');
    }
    rentalCost = input.days * input.dailyPrice;
  }

  let chargeCost = 0;
  if (input.chargesBattery) {
    if (input.batteryKwh === null || input.pricePerKwh === null) {
      throw new RangeError('Biaya pengisian membutuhkan kapasitas baterai dan harga per kWh.');
    }
    chargeCost = Math.round(input.batteryKwh * input.pricePerKwh);
  }

  return { rentalCost, chargeCost, totalCost: rentalCost + chargeCost };
}
