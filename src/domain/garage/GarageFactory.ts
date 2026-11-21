/**
 * @file Pabrik objek garasi: mengubah kode tipe dari database menjadi subkelas Garage.
 */
import { ValidationError } from '../errors';
import { GARAGE_TYPE_CODES, Garage, type GarageStatusCode, type GarageTypeCode } from './Garage';
import { Mobil } from './Mobil';
import { MobilListrik } from './MobilListrik';
import { Sepeda } from './Sepeda';

/** Membuat objek garasi yang sesuai dengan kode tipenya. */
export class GarageFactory {
  /** Pemetaan kode tipe ke kelas turunannya. */
  private static readonly CLASSES: Readonly<
    Record<GarageTypeCode, new (id?: string | null, status?: GarageStatusCode) => Garage>
  > = {
    BICYCLE: Sepeda,
    CAR: Mobil,
    ELECTRIC_CAR: MobilListrik,
  };

  /**
   * Memeriksa apakah nilai adalah kode tipe garasi yang sah.
   *
   * @param value Nilai yang diperiksa.
   * @returns `true` bila nilai adalah salah satu `GARAGE_TYPE_CODES`.
   */
  public static isTypeCode(value: unknown): value is GarageTypeCode {
    return typeof value === 'string' && (GARAGE_TYPE_CODES as readonly string[]).includes(value);
  }

  /**
   * Membuat objek garasi untuk satu tipe.
   *
   * @param type Kode tipe garasi.
   * @param id ID garasi bila sudah ada.
   * @param status Status garasi; bawaannya tersedia.
   * @returns Instans Sepeda, Mobil, atau MobilListrik.
   * @throws {ValidationError} Bila kode tipe tidak dikenal.
   */
  public static create(
    type: string,
    id: string | null = null,
    status: GarageStatusCode = 'AVAILABLE',
  ): Garage {
    if (!GarageFactory.isTypeCode(type)) {
      throw new ValidationError({ type: ['Tipe garasi tidak valid'] });
    }
    return new GarageFactory.CLASSES[type](id, status);
  }
}
