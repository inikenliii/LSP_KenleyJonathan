/**
 * @file Subkelas garasi untuk sepeda.
 */
import { Garage, type GarageTypeCode } from './Garage';

/** Garasi sepeda (ID berawalan S). */
export class Sepeda extends Garage {
  /** Kode tipe di database. */
  public override get type(): GarageTypeCode {
    return 'BICYCLE';
  }

  /** Nama tipe untuk tampilan. */
  public override get label(): string {
    return 'Sepeda';
  }

  /** Awalan ID. */
  public override get idPrefix(): string {
    return 'S';
  }
}
