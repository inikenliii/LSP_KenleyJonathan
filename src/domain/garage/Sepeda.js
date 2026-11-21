/**
 * @file Subkelas garasi untuk sepeda.
 */
import { Garage } from './Garage.js';

/**
 * Garasi sepeda (ID berawalan S).
 */
export class Sepeda extends Garage {
  /**
   * @returns {string} Kode tipe di database.
   * @public
   */
  typeCode() {
    return 'BICYCLE';
  }

  /**
   * @returns {string} Nama tipe untuk tampilan.
   * @public
   */
  typeLabel() {
    return 'Sepeda';
  }

  /**
   * @returns {string} Awalan ID.
   * @public
   */
  idPrefix() {
    return 'S';
  }
}
