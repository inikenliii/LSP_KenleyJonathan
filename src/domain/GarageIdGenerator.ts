/**
 * @file Perencana ID garasi: menyusun ID berurutan per tipe dan menjaga batas
 * 999 garasi per tipe.
 *
 * Modul ini murni: hanya mengimpor berkas domain lain, sehingga dapat diuji
 * langsung tanpa database.
 */
import { CapacityExceededError } from './errors';
import { Garage } from './garage';

/** Rencana ID untuk satu batch garasi. */
export interface BatchPlan {
  /** ID yang akan dibuat, berurutan. */
  ids: string[];
  /** Nomor urut ID pertama. */
  firstNumber: number;
  /** Nomor urut ID terakhir. */
  lastNumber: number;
}

/**
 * Menyusun rencana ID untuk satu batch garasi. Awalan ID tidak diketahui di
 * sini; setiap subkelas Garage menyediakannya lewat `formatId` (polimorfisme).
 */
export class GarageIdGenerator {
  /**
   * Merencanakan ID untuk batch berikutnya.
   *
   * @example
   * generator.planBatch(new Sepeda(), 4, 2);   // ids: ['S005', 'S006']
   * generator.planBatch(new Mobil(), 990, 10); // melempar CapacityExceededError (sisa kuota 9)
   *
   * @param garage Objek garasi bertipe sama dengan batch (menentukan awalan ID).
   * @param currentLastNumber Nomor terakhir yang sudah dipakai tipe ini (0 bila belum ada).
   * @param quantity Jumlah garasi yang akan dibuat (minimal 1).
   * @returns ID yang dibuat beserta rentang nomornya.
   * @throws {RangeError} Bila jumlah bukan bilangan bulat minimal 1 atau nomor terakhir bukan bilangan bulat minimal 0.
   * @throws {CapacityExceededError} Bila jumlah garasi tipe ini akan melebihi `Garage.MAX_PER_TYPE`.
   */
  public planBatch(garage: Garage, currentLastNumber: number, quantity: number): BatchPlan {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new RangeError('Jumlah garasi harus bilangan bulat minimal 1.');
    }
    if (!Number.isInteger(currentLastNumber) || currentLastNumber < 0) {
      throw new RangeError('Nomor terakhir harus bilangan bulat minimal 0.');
    }
    if (currentLastNumber + quantity > Garage.MAX_PER_TYPE) {
      throw new CapacityExceededError({
        typeLabel: garage.label,
        lastNumber: currentLastNumber,
        requested: quantity,
        max: Garage.MAX_PER_TYPE,
      });
    }

    const firstNumber = currentLastNumber + 1;
    const lastNumber = currentLastNumber + quantity;
    const ids: string[] = [];
    for (let nomor = firstNumber; nomor <= lastNumber; nomor += 1) {
      ids.push(garage.formatId(nomor));
    }
    return { ids, firstNumber, lastNumber };
  }

  /**
   * Menghitung sisa kuota garasi untuk satu tipe.
   *
   * @param lastNumber Nomor terakhir yang sudah dipakai tipe ini.
   * @returns Jumlah garasi yang masih boleh dibuat.
   */
  public remainingQuota(lastNumber: number): number {
    return Garage.MAX_PER_TYPE - lastNumber;
  }
}
