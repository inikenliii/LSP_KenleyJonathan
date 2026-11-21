/**
 * @file Layanan garasi: aturan bisnis pembuatan garasi dan tampilan
 * konfigurasi per tipe.
 */
import { Garage, GARAGE_TYPE_CODES, createGarage } from '../domain/garage/index.js';
import { GarageIdGenerator } from '../domain/GarageIdGenerator.js';
import { monthlyPrice } from '../domain/pricing.js';
import { ValidationError, toAppError } from '../domain/errors.js';
import { garageBatchSchema } from '../validation/garageSchemas.js';

/**
 * Menangani konfigurasi per tipe garasi dan pembuatan garasi berkelompok.
 * Repository diterima lewat konstruktor.
 */
export class GarageService {
  /**
   * @param {import('../repositories/GarageRepository.js').GarageRepository} garageRepository Repository garasi.
   * @param {GarageIdGenerator} [idGenerator] Perencana ID garasi.
   */
  constructor(garageRepository, idGenerator = new GarageIdGenerator()) {
    this.garageRepository = garageRepository;
    this.idGenerator = idGenerator;
  }

  /**
   * Mengambil konfigurasi tiap tipe untuk tabel harga dan kuota, dalam urutan
   * GARAGE_TYPE_CODES.
   *
   * @returns {Promise<Array<{ code: string, label: string, prefix: string, usesKwhPrice: boolean, dailyPrice: number, monthlyPrice: number|null, pricePerKwh: number|null, priceIsSet: boolean, totalCreated: number, remainingQuota: number }>>}
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
          monthlyPrice: row.dailyPrice > 0 ? monthlyPrice(row.dailyPrice) : null,
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

  /**
   * Mengambil semua garasi untuk daftar Admin, urut menurut ID, lengkap dengan
   * harga harian, harga bulanan (25 x harian), harga per kWh, dan status.
   *
   * @returns {Promise<{ items: Array<{ id: string, typeCode: string, typeLabel: string, dailyPrice: number, monthlyPrice: number, usesKwhPrice: boolean, pricePerKwh: number|null, statusCode: string, statusLabel: string }>, total: number }>}
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async listGarages() {
    try {
      const rows = await this.garageRepository.findAll();
      const items = rows.map((row) => {
        const garage = createGarage(row.type, row.id, row.status);
        return {
          id: garage.id,
          typeCode: garage.typeCode(),
          typeLabel: garage.typeLabel(),
          dailyPrice: row.config.dailyPrice,
          monthlyPrice: monthlyPrice(row.config.dailyPrice),
          usesKwhPrice: garage.usesKwhPrice(),
          pricePerKwh: garage.usesKwhPrice() ? row.config.pricePerKwh : null,
          statusCode: garage.status,
          statusLabel: garage.statusLabel,
        };
      });
      return { items, total: items.length };
    } catch (err) {
      throw toAppError(err);
    }
  }

  /**
   * Membuat garasi berkelompok: memvalidasi masukan, lalu menyimpan batch dan
   * harga tipe dalam satu transaksi.
   *
   * @param {object} input Isian formulir (type, quantity, dailyPrice, pricePerKwh).
   * @returns {Promise<{ typeLabel: string, count: number, firstId: string, lastId: string, ids: string[], summary: string }>}
   * @throws {ValidationError} Bila masukan tidak valid.
   * @throws {import('../domain/errors.js').CapacityExceededError} Bila batch melebihi 999 garasi untuk tipe ini.
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async createBatch(input) {
    const data = ValidationError.parse(garageBatchSchema, input ?? {});
    const garage = createGarage(data.type);
    try {
      const result = await this.garageRepository.createBatch(data, (lastNumber) =>
        this.idGenerator.planBatch(garage, lastNumber, data.quantity),
      );
      return {
        typeLabel: garage.typeLabel(),
        count: result.ids.length,
        firstId: result.ids[0],
        lastId: result.ids[result.ids.length - 1],
        ids: result.ids,
        // describe dipanggil sama untuk semua tipe; setiap subkelas menjawab dengan caranya.
        summary: createGarage(data.type, result.ids[0]).describe(data.dailyPrice, data.pricePerKwh ?? null),
      };
    } catch (err) {
      throw toAppError(err);
    }
  }
}
