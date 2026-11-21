/**
 * @file Controller garasi: menerjemahkan permintaan Admin ke pemanggilan
 * service dan merender halaman Kelola Garasi.
 */

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
   * Merender halaman Kelola Garasi.
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
    res.status(status).render('admin/garages/index', { configs, values, errors });
  }

  /**
   * Menampilkan tabel harga per tipe dan formulir pembuatan garasi.
   *
   * @param {import('express').Request} req Permintaan.
   * @param {import('express').Response} res Respons.
   * @returns {Promise<void>}
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  index = async (req, res) => {
    await this.#renderPage(res, 200);
  };
}
