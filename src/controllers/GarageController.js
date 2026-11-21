/**
 * @file Controller garasi: menerjemahkan permintaan Admin ke pemanggilan
 * service dan merender halaman Kelola Garasi.
 */
import { CapacityExceededError, ValidationError } from '../domain/errors.js';

/**
 * Mengambil hanya isian teks formulir yang aman ditampilkan kembali.
 *
 * @param {object} body Isi formulir.
 * @returns {Record<string, string>}
 */
function safeValues(body) {
  const values = {};
  for (const field of ['type', 'quantity', 'dailyPrice', 'pricePerKwh']) {
    if (typeof body[field] === 'string') {
      values[field] = body[field];
    }
  }
  return values;
}

/**
 * Handler HTTP untuk halaman Kelola Garasi. Akses sudah dijaga oleh
 * middleware peran pada router Admin.
 */
export class GarageController {
  /**
   * @param {import('../services/GarageService.js').GarageService} garageService Layanan garasi.
   */
  constructor(garageService) {
    this.garageService = garageService;
  }

  /**
   * Merender halaman Kelola Garasi beserta daftar semua garasi.
   *
   * @param {import('express').Response} res Respons.
   * @param {number} status Kode status HTTP.
   * @param {object} [options]
   * @param {Record<string, string>} [options.values] Isian formulir yang ditampilkan kembali.
   * @param {Record<string, string>} [options.errors] Pesan error per field.
   * @returns {Promise<void>}
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async #renderPage(res, status, { values = {}, errors = {} } = {}) {
    const configs = await this.garageService.getTypeConfigs();
    const garages = await this.garageService.listGarages();
    res.status(status).render('admin/garages/index', { configs, garages, values, errors });
  }

  /**
   * Menampilkan tabel harga per tipe, formulir pembuatan garasi, dan daftar garasi.
   *
   * @param {import('express').Request} req Permintaan.
   * @param {import('express').Response} res Respons.
   * @returns {Promise<void>}
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  index = async (req, res) => {
    await this.#renderPage(res, 200);
  };

  /**
   * Memproses formulir pembuatan garasi berkelompok. Masukan tidak valid dan
   * batch yang melebihi 999 dijawab 422 dengan isian tetap tampil; error lain
   * diteruskan ke penanganan error pusat.
   *
   * @param {import('express').Request} req Permintaan.
   * @param {import('express').Response} res Respons.
   * @returns {Promise<void>}
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  create = async (req, res) => {
    const body = req.body ?? {};
    let result;
    try {
      result = await this.garageService.createBatch(body);
    } catch (err) {
      if (err instanceof ValidationError) {
        await this.#renderPage(res, 422, { values: safeValues(body), errors: err.firstErrors() });
        return;
      }
      if (err instanceof CapacityExceededError) {
        await this.#renderPage(res, 422, { values: safeValues(body), errors: { quantity: err.message } });
        return;
      }
      throw err;
    }
    req.session.flash = {
      type: 'success',
      message:
        `Berhasil membuat ${result.count} garasi ${result.typeLabel}: ${result.firstId} s.d. ${result.lastId}. ` +
        `Garasi pertama: ${result.summary}.`,
    };
    res.redirect(303, '/admin/garasi');
  };
}
