/**
 * @file Controller verifikasi pendaftar: menerjemahkan permintaan Admin ke
 * pemanggilan service dan merender daftar pendaftar.
 */
import { User } from '../domain/User.js';
import { ValidationError } from '../domain/errors.js';

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

  /**
   * Memproses keputusan menerima atau menolak. Keputusan tidak valid dijawab
   * 422 pada baris pendaftar terkait; id tidak dikenal (404) dan keputusan
   * ganda (409) diteruskan ke penanganan error pusat.
   *
   * @param {import('express').Request} req Permintaan.
   * @param {import('express').Response} res Respons.
   * @returns {Promise<void>}
   * @throws {import('../domain/errors.js').NotFoundError} Bila pendaftar tidak ditemukan.
   * @throws {import('../domain/errors.js').ConflictError} Bila pendaftar sudah diproses.
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  decide = async (req, res) => {
    let result;
    try {
      result = await this.verificationService.decide(
        {
          userId: req.params.id,
          decision: req.body?.decision,
          ktpValidated: req.body?.ktpValidated,
        },
        req.user,
      );
    } catch (err) {
      if (err instanceof ValidationError) {
        const [message] = Object.values(err.firstErrors());
        await this.#renderList(res, 422, { userId: String(req.params.id), message });
        return;
      }
      throw err;
    }
    const name = result.user.fullName;
    req.session.flash = {
      type: 'success',
      message:
        result.status === User.STATUS.ACCEPTED
          ? `Pendaftaran ${name} diterima. Penyewa sekarang dapat masuk.`
          : `Pendaftaran ${name} ditolak.`,
    };
    res.redirect(303, '/admin/pendaftar');
  };
}
