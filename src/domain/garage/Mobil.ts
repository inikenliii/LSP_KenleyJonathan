/**
 * @file Subkelas garasi untuk mobil bensin.
 */
import { Garage, type GarageTypeCode } from './Garage';

/** Garasi mobil (ID berawalan C). */
export class Mobil extends Garage {
  /** Kode tipe di database. */
  public override get type(): GarageTypeCode {
    return 'CAR';
  }

  /** Nama tipe untuk tampilan. */
  public override get label(): string {
    return 'Mobil';
  }

  /** Awalan ID. */
  public override get idPrefix(): string {
    return 'C';
  }
}
