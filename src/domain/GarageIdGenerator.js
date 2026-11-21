/**
 * @file Perencana ID garasi: menyusun ID berurutan per tipe dan menjaga batas
 * 999 garasi per tipe.
 *
 * Modul ini murni: hanya mengimpor paket garasi dan error domain, sehingga
 * dapat diuji langsung tanpa database.
 */
import { Garage } from './garage/index.js';
import { CapacityExceededError } from './errors.js';

/**
 * Menyusun rencana ID untuk satu batch garasi. Awalan ID tidak diketahui di
 * sini; setiap subkelas Garage menyediakannya lewat formatId (polimorfisme).
 */
export class GarageIdGenerator {
  /**
   * Merencanakan ID untuk batch berikutnya.
   *
   * @example
   * generator.planBatch(new Sepeda(), 4, 2);   // ids: ['S005', 'S006']
   * generator.planBatch(new Mobil(), 0, 3);    // ids: ['C001', 'C002', 'C003']
   * generator.planBatch(new Mobil(), 990, 9);  // ids: C991 sampai C999
   * generator.planBatch(new Mobil(), 990, 10); // melempar CapacityExceededError (sisa kuota 9)
   *
   * @param {Garage} garage Objek garasi bertipe sama dengan batch (menentukan awalan ID).
   * @param {number} currentLastNumber Nomor terakhir yang sudah dipakai tipe ini (0 bila belum ada).
   * @param {number} quantity Jumlah garasi yang akan dibuat (minimal 1).
   * @returns {{ ids: string[], firstNumber: number, lastNumber: number }} ID yang dibuat dan rentang nomornya.
   * @throws {RangeError} Bila jumlah bukan bilangan bulat minimal 1 atau nomor terakhir bukan bilangan bulat minimal 0.
   * @throws {CapacityExceededError} Bila jumlah garasi tipe ini akan melebihi Garage.MAX_PER_TYPE.
   */
  planBatch(garage, currentLastNumber, quantity) {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new RangeError('Jumlah garasi harus bilangan bulat minimal 1.');
    }
    if (!Number.isInteger(currentLastNumber) || currentLastNumber < 0) {
      throw new RangeError('Nomor terakhir harus bilangan bulat minimal 0.');
    }
    if (currentLastNumber + quantity > Garage.MAX_PER_TYPE) {
      throw new CapacityExceededError({
        typeLabel: garage.typeLabel(),
        lastNumber: currentLastNumber,
        requested: quantity,
        max: Garage.MAX_PER_TYPE,
      });
    }

    const firstNumber = currentLastNumber + 1;
    const lastNumber = currentLastNumber + quantity;
    const ids = [];
    for (let number = firstNumber; number <= lastNumber; number += 1) {
      ids.push(garage.formatId(number));
    }
    return { ids, firstNumber, lastNumber };
  }
}
