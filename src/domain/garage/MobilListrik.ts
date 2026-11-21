/**
 * @file Subkelas garasi untuk mobil listrik.
 */
import { formatRupiah } from '../pricing';
import { Garage, type GarageTypeCode } from './Garage';

/**
 * Garasi mobil listrik (ID berawalan E). Satu-satunya tipe yang memiliki
 * harga isi daya per kWh.
 */
export class MobilListrik extends Garage {
  /** Kode tipe di database. */
  public override get type(): GarageTypeCode {
    return 'ELECTRIC_CAR';
  }

  /** Nama tipe untuk tampilan. */
  public override get label(): string {
    return 'Mobil Listrik';
  }

  /** Awalan ID. */
  public override get idPrefix(): string {
    return 'E';
  }

  /**
   * Mobil listrik memiliki harga per kWh.
   *
   * @returns Selalu `true`.
   */
  public override usesKwhPrice(): boolean {
    return true;
  }

  /**
   * Menambahkan harga per kWh pada ringkasan.
   *
   * @param pricePerKwh Harga per kWh dalam rupiah.
   * @returns Teks seperti ", Rp 2.500 per kWh".
   */
  protected override describeKwhPrice(pricePerKwh: number): string {
    return `, ${formatRupiah(pricePerKwh)} per kWh`;
  }
}
