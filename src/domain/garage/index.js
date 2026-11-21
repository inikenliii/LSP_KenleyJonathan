/**
 * @file Pintu masuk paket garasi: mengekspor kelas-kelasnya dan pabrik
 * createGarage.
 */
import { ValidationError } from '../errors.js';
import { Garage } from './Garage.js';
import { Sepeda } from './Sepeda.js';
import { Mobil } from './Mobil.js';
import { MobilListrik } from './MobilListrik.js';

export { Garage, Sepeda, Mobil, MobilListrik };

/** Kode tipe garasi dalam urutan tampilan. */
export const GARAGE_TYPE_CODES = Object.freeze(['BICYCLE', 'CAR', 'ELECTRIC_CAR']);

/** Pemetaan kode tipe ke kelas garasinya. */
const GARAGE_CLASSES = Object.freeze({
  BICYCLE: Sepeda,
  CAR: Mobil,
  ELECTRIC_CAR: MobilListrik,
});

/**
 * Pabrik objek garasi menurut kode tipe.
 *
 * @example
 * createGarage('BICYCLE').idPrefix();          // 'S'
 * createGarage('ELECTRIC_CAR', 'E001').id;     // 'E001'
 *
 * @param {string} typeCode Salah satu nilai GARAGE_TYPE_CODES.
 * @param {string|null} [id] ID garasi, bila sudah ada.
 * @param {string} [status] Status garasi; bawaan tersedia.
 * @returns {Garage} Objek Sepeda, Mobil, atau MobilListrik.
 * @throws {ValidationError} Bila kode tipe tidak dikenal.
 */
export function createGarage(typeCode, id = null, status = Garage.STATUS.AVAILABLE) {
  const GarageClass = Object.hasOwn(GARAGE_CLASSES, typeCode) ? GARAGE_CLASSES[typeCode] : null;
  if (GarageClass === null) {
    throw new ValidationError({ type: ['Tipe garasi tidak valid'] });
  }
  return new GarageClass(id, status);
}
