/**
 * @file Perhitungan biaya sewa. Fungsi murni yang sama dipakai untuk pratinjau
 * di formulir dan untuk nilai yang disimpan server.
 *
 * Aturan biaya hanya: harian = hari x harga harian, bulanan = 25 x harga
 * harian, ditambah biaya pengisian baterai untuk mobil listrik di garasi mobil
 * listrik. Biaya pengisian = (kapasitas - sisa baterai) x harga per kWh.
 * Tidak ada biaya tambahan atau diskon lain.
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
  /** Sisa baterai dalam kWh saat disewa (wajib bila `chargesBattery`). */
  remainingKwh: number | null;
  /** Harga per kWh dalam rupiah (wajib bila `chargesBattery`). */
  pricePerKwh: number | null;
}

/** Rincian biaya sewa dalam rupiah bulat. */
export interface RentalCostBreakdown {
  /** Biaya sewa garasi. */
  rentalCost: number;
  /** Biaya pengisian baterai sebesar kWh yang diisi (0 bila tidak dikenakan). */
  chargeCost: number;
  /** Total yang dibayar: `rentalCost + chargeCost`. */
  totalCost: number;
}

/**
 * Menghitung kWh yang harus diisi: kapasitas dikurangi sisa baterai. Hasil
 * dibulatkan ke satu desimal agar bebas galat pecahan dan tidak pernah negatif.
 *
 * @param capacityKwh Kapasitas baterai dalam kWh.
 * @param remainingKwh Sisa baterai dalam kWh.
 * @returns kWh yang diisi, paling kecil 0.
 * @example
 * kwhToCharge(60, 20); // 40
 * kwhToCharge(60, 70); // 0
 */
export function kwhToCharge(capacityKwh: number, remainingKwh: number): number {
  const selisih = Math.round((capacityKwh - remainingKwh) * 10) / 10;
  return Math.max(0, selisih);
}

/**
 * Menghitung biaya sewa.
 *
 * @param input Data sewa dan harga.
 * @returns Rincian biaya dalam rupiah bulat.
 * @throws {RangeError} Bila data yang dibutuhkan tidak lengkap.
 * @example
 * calculateRentalCost({ rentalType: 'BULANAN', days: null, dailyPrice: 80000,
 *   chargesBattery: true, batteryKwh: 60, remainingKwh: 20, pricePerKwh: 2500 });
 * // { rentalCost: 2000000, chargeCost: 100000, totalCost: 2100000 }
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
    if (input.batteryKwh === null || input.remainingKwh === null || input.pricePerKwh === null) {
      throw new RangeError(
        'Biaya pengisian membutuhkan kapasitas baterai, sisa baterai, dan harga per kWh.',
      );
    }
    chargeCost = Math.round(kwhToCharge(input.batteryKwh, input.remainingKwh) * input.pricePerKwh);
  }

  return { rentalCost, chargeCost, totalCost: rentalCost + chargeCost };
}
