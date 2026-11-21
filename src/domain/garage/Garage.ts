/**
 * @file Kelas dasar abstrak Garage. Setiap tipe garasi (Sepeda, Mobil, Mobil
 * Listrik) adalah subkelas yang menyediakan kode tipe, label, dan awalan ID.
 *
 * Modul ini murni: hanya mengimpor berkas domain lain.
 */
import { formatRupiah } from '../pricing';

/** Kode tipe garasi seperti yang disimpan di database. */
export type GarageTypeCode = 'BICYCLE' | 'CAR' | 'ELECTRIC_CAR';

/** Status garasi seperti yang disimpan di database. */
export type GarageStatusCode = 'AVAILABLE' | 'USED';

/** Semua kode tipe garasi dalam urutan tampilan (sepeda, mobil, mobil listrik). */
export const GARAGE_TYPE_CODES = ['BICYCLE', 'CAR', 'ELECTRIC_CAR'] as const;

/**
 * Garasi abstrak. Kelas ini tidak dapat dibuat langsung; gunakan subkelasnya
 * atau `GarageFactory.create`.
 */
export abstract class Garage {
  /** Batas maksimum jumlah garasi per tipe. */
  public static readonly MAX_PER_TYPE = 999;

  /** Jumlah digit angka pada ID garasi (S001 memakai 3 digit). */
  public static readonly ID_DIGITS = 3;

  /** Label status dalam Bahasa Indonesia. */
  private static readonly STATUS_LABELS: Readonly<Record<GarageStatusCode, string>> = {
    AVAILABLE: 'tersedia',
    USED: 'used',
  };

  /** ID garasi, misalnya "S001"; null bila belum dibuat. */
  readonly #id: string | null;

  /** Status garasi saat ini. */
  readonly #status: GarageStatusCode;

  /**
   * @param id ID garasi, misalnya "S001"; null bila belum dibuat.
   * @param status Status garasi; bawaannya tersedia.
   */
  public constructor(id: string | null = null, status: GarageStatusCode = 'AVAILABLE') {
    this.#id = id;
    this.#status = status;
  }

  /** ID garasi, atau null bila belum dibuat. */
  public get id(): string | null {
    return this.#id;
  }

  /** Status garasi saat ini. */
  public get status(): GarageStatusCode {
    return this.#status;
  }

  /** Label status dalam Bahasa Indonesia ("tersedia" atau "used"). */
  public get statusLabel(): string {
    return Garage.STATUS_LABELS[this.#status];
  }

  /** Kode tipe seperti yang disimpan di database. Wajib diisi subkelas. */
  public abstract get type(): GarageTypeCode;

  /** Nama tipe untuk ditampilkan. Wajib diisi subkelas. */
  public abstract get label(): string;

  /** Huruf awalan ID. Wajib diisi subkelas. */
  public abstract get idPrefix(): string;

  /**
   * Apakah tipe ini memiliki harga per kWh. Bawaannya tidak; Mobil Listrik
   * menimpanya.
   *
   * @returns `true` bila tipe ini memakai harga per kWh.
   */
  public usesKwhPrice(): boolean {
    return false;
  }

  /**
   * Membentuk ID dari nomor urut, misalnya `formatId(7)` menjadi "S007".
   *
   * @param sequenceNumber Nomor urut (bilangan bulat 1 sampai 999).
   * @returns ID lengkap dengan awalan tipe.
   * @throws {RangeError} Bila nomor bukan bilangan bulat di antara 1 dan 999.
   */
  public formatId(sequenceNumber: number): string {
    if (
      !Number.isInteger(sequenceNumber) ||
      sequenceNumber < 1 ||
      sequenceNumber > Garage.MAX_PER_TYPE
    ) {
      throw new RangeError(`Nomor urut harus bilangan bulat antara 1 dan ${Garage.MAX_PER_TYPE}.`);
    }
    return `${this.idPrefix}${this.#pad(sequenceNumber)}`;
  }

  /**
   * Ringkasan garasi tanpa harga, misalnya "Sepeda S001".
   *
   * @returns Label tipe disertai ID.
   */
  public describe(): string;
  /**
   * Ringkasan garasi dengan harga harian, misalnya "Sepeda S001, Rp 10.000 per hari".
   *
   * @param dailyPrice Harga harian dalam rupiah.
   * @returns Label tipe, ID, dan harga harian.
   */
  public describe(dailyPrice: number): string;
  /**
   * Ringkasan garasi dengan harga harian dan harga per kWh. Tipe tanpa harga
   * per kWh mengabaikan argumen kedua.
   *
   * @param dailyPrice Harga harian dalam rupiah.
   * @param pricePerKwh Harga per kWh dalam rupiah.
   * @returns Label tipe, ID, harga harian, dan (untuk Mobil Listrik) harga per kWh.
   */
  public describe(dailyPrice: number, pricePerKwh: number): string;
  /**
   * Implementasi bersama ketiga bentuk `describe`.
   *
   * @param dailyPrice Harga harian; dilewati bila kosong.
   * @param pricePerKwh Harga per kWh; dilewati bila kosong.
   * @returns Teks ringkasan garasi.
   */
  public describe(dailyPrice?: number, pricePerKwh?: number): string {
    let teks = this.#id ? `${this.label} ${this.#id}` : this.label;
    if (dailyPrice !== undefined) {
      teks += `, ${formatRupiah(dailyPrice)} per hari`;
      if (pricePerKwh !== undefined) {
        teks += this.describeKwhPrice(pricePerKwh);
      }
    }
    return teks;
  }

  /**
   * Potongan teks harga per kWh untuk `describe`. Bawaannya kosong; Mobil
   * Listrik menimpanya.
   *
   * @param _pricePerKwh Harga per kWh dalam rupiah.
   * @returns Teks tambahan, atau string kosong.
   */
  protected describeKwhPrice(_pricePerKwh: number): string {
    return '';
  }

  /**
   * Melengkapi angka dengan nol di depan sepanjang `Garage.ID_DIGITS`.
   *
   * @param value Angka yang dilengkapi.
   * @returns Teks angka dengan nol di depan.
   */
  #pad(value: number): string {
    return String(value).padStart(Garage.ID_DIGITS, '0');
  }
}
