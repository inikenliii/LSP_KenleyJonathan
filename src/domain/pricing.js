/**
 * @file Aturan harga sewa garasi. Modul ini murni: tidak mengimpor framework,
 * ORM, atau driver database, sehingga mudah diuji sebagai unit.
 */

/** Pengali harga bulanan terhadap harga harian (bulanan = 25 x harian). */
export const MONTHLY_PRICE_MULTIPLIER = 25;

/**
 * Menghitung harga sewa bulanan dari harga harian.
 *
 * @param {number} dailyPrice Harga harian dalam rupiah (bilangan bulat, minimal 0).
 * @returns {number} Harga bulanan dalam rupiah.
 * @throws {RangeError} Bila harga harian bukan bilangan bulat aman yang tidak negatif.
 * @example
 * monthlyPrice(5000); // 125000
 */
export function monthlyPrice(dailyPrice) {
  if (!Number.isSafeInteger(dailyPrice) || dailyPrice < 0) {
    throw new RangeError('Harga harian harus bilangan bulat tidak negatif.');
  }
  return dailyPrice * MONTHLY_PRICE_MULTIPLIER;
}
