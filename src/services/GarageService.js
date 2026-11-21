/**
 * @file Layanan garasi: aturan bisnis pembuatan garasi dan tampilan
 * konfigurasi per tipe.
 */
import { Garage, GARAGE_TYPE_CODES, createGarage } from '../domain/garage/index.js';
import { toAppError } from '../domain/errors.js';

/**
 * Menangani konfigurasi per tipe garasi dan pembuatan garasi berkelompok.
 * Repository diterima lewat konstruktor.
 */
export class GarageService {
  /**
   * @param {import('../repositories/GarageRepository.js').GarageRepository} garageRepository Repository garasi.
   * @param {object|null} [idGenerator] Perencana ID garasi.
   */
  constructor(garageRepository, idGenerator = null) {
    this.garageRepository = garageRepository;
    this.idGenerator = idGenerator;
  }

  /**
   * Mengambil konfigurasi tiap tipe untuk tabel harga dan kuota, dalam urutan
   * GARAGE_TYPE_CODES.
   *
   * @returns {Promise<Array<{ code: string, label: string, prefix: string, usesKwhPrice: boolean, dailyPrice: number, pricePerKwh: number|null, priceIsSet: boolean, totalCreated: number, remainingQuota: number }>>}
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async getTypeConfigs() {
    try {
      const rows = await this.garageRepository.findAllConfigs();
      // Diurutkan eksplisit menurut GARAGE_TYPE_CODES, tidak bergantung urutan enum di database.
      rows.sort((a, b) => GARAGE_TYPE_CODES.indexOf(a.type) - GARAGE_TYPE_CODES.indexOf(b.type));
      return rows.map((row) => {
        const garage = createGarage(row.type);
        return {
          code: row.type,
          label: garage.typeLabel(),
          prefix: garage.idPrefix(),
          usesKwhPrice: garage.usesKwhPrice(),
          dailyPrice: row.dailyPrice,
          pricePerKwh: row.pricePerKwh,
          priceIsSet: row.dailyPrice > 0,
          totalCreated: row.lastNumber,
          remainingQuota: Garage.MAX_PER_TYPE - row.lastNumber,
        };
      });
    } catch (err) {
      throw toAppError(err);
    }
  }
}
