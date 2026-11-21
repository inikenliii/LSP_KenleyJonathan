/**
 * @file Subkelas garasi untuk mobil listrik.
 */
import { Garage } from './Garage.js';

/**
 * Garasi mobil listrik (ID berawalan E). Satu-satunya tipe yang memiliki
 * harga isi daya per kWh.
 */
export class MobilListrik extends Garage {
  /**
   * @returns {string} Kode tipe di database.
   * @public
   */
  typeCode() {
    return 'ELECTRIC_CAR';
  }

  /**
   * @returns {string} Nama tipe untuk tampilan.
   * @public
   */
  typeLabel() {
    return 'Mobil Listrik';
  }

  /**
   * @returns {string} Awalan ID.
   * @public
   */
  idPrefix() {
    return 'E';
  }

  /**
   * Mobil listrik memiliki harga per kWh.
   *
   * @returns {boolean}
   * @public
   */
  usesKwhPrice() {
    return true;
  }

  /**
   * Ringkasan garasi. Nama metode sama dengan versi induk tetapi menerima satu
   * parameter opsional tambahan (harga per kWh), sehingga dapat dipanggil
   * dengan 0, 1, atau 2 argumen.
   *
   * @param {number|null} [dailyPrice] Harga harian; dilewati bila kosong.
   * @param {number|null} [pricePerKwh] Harga per kWh; dilewati bila kosong.
   * @returns {string}
   * @public
   */
  describe(dailyPrice = null, pricePerKwh = null) {
    const text = super.describe(dailyPrice);
    return pricePerKwh === null ? text : `${text}, ${this._formatRupiah(pricePerKwh)} per kWh`;
  }
}
