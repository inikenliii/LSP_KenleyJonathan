/**
 * @file Controller verifikasi pendaftar: menerjemahkan permintaan Admin ke
 * pemanggilan service dan merender daftar pendaftar.
 */

/**
 * Handler HTTP untuk halaman Verifikasi Pendaftar. Akses sudah dijaga oleh
 * middleware peran pada router Admin.
 */
export class VerificationController {
  /**
   * @param {import('../services/VerificationService.js').VerificationService} verificationService Layanan verifikasi.
   */
  constructor(verificationService) {
    this.verificationService = verificationService;
  }

  /**
   * Merender daftar pendaftar yang menunggu verifikasi.
   *
   * @param {import('express').Response} res Respons.
   * @param {number} status Kode status HTTP.
   * @param {{ userId: string, message: string }|null} rowError Pesan error untuk satu baris, bila ada.
   * @returns {Promise<void>}
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async #renderList(res, status, rowError) {
    const pending = await this.verificationService.listPending();
    res.status(status).render('admin/registrants', {
      registrants: pending.map((user) => user.toView()),
      rowError,
    });
  }

  /**
   * Menampilkan daftar pendaftar yang menunggu verifikasi.
   *
   * @param {import('express').Request} req Permintaan.
   * @param {import('express').Response} res Respons.
   * @returns {Promise<void>}
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  index = async (req, res) => {
    await this.#renderList(res, 200, null);
  };
}
