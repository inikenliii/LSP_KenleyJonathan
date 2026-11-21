/**
 * @file Subkelas garasi untuk mobil bensin.
 */
import { Garage } from './Garage.js';

/**
 * Garasi mobil (ID berawalan C).
 */
export class Mobil extends Garage {
  /**
   * @returns {string} Kode tipe di database.
   * @public
   */
  typeCode() {
    return 'CAR';
  }

  /**
   * @returns {string} Nama tipe untuk tampilan.
   * @public
   */
  typeLabel() {
    return 'Mobil';
  }

  /**
   * @returns {string} Awalan ID.
   * @public
   */
  idPrefix() {
    return 'C';
  }
}
