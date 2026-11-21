/**
 * @file Controller autentikasi: menerjemahkan permintaan HTTP ke pemanggilan
 * service dan merender tampilan.
 */
import { ValidationError, DuplicateUserError } from '../domain/errors.js';

/**
 * Mengambil hanya field teks yang aman ditampilkan kembali di formulir.
 * Password sengaja tidak pernah disalin.
 *
 * @param {object} body Isi formulir.
 * @returns {{ nik?: string, fullName?: string, phone?: string, email?: string }}
 */
function safeValues(body) {
  const values = {};
  for (const field of ['nik', 'fullName', 'phone', 'email']) {
    if (typeof body[field] === 'string') {
      values[field] = body[field];
    }
  }
  return values;
}

/**
 * Handler HTTP untuk pendaftaran penyewa.
 */
export class AuthController {
  /**
   * @param {import('../services/AuthService.js').AuthService} authService Layanan autentikasi.
   */
  constructor(authService) {
    this.authService = authService;
  }

  /**
   * Menampilkan formulir pendaftaran.
   *
   * @param {import('express').Request} req Permintaan.
   * @param {import('express').Response} res Respons.
   * @returns {void}
   */
  showRegister = (req, res) => {
    res.render('auth/register', { values: {}, errors: {} });
  };

  /**
   * Memproses formulir pendaftaran. Data tidak valid dijawab 422 dan email
   * atau NIK ganda dijawab 409; error lain diteruskan ke penanganan pusat.
   *
   * @param {import('express').Request} req Permintaan.
   * @param {import('express').Response} res Respons.
   * @returns {Promise<void>}
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  register = async (req, res) => {
    const body = req.body ?? {};
    try {
      await this.authService.register(body);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(422).render('auth/register', { values: safeValues(body), errors: err.firstErrors() });
        return;
      }
      if (err instanceof DuplicateUserError) {
        res.status(409).render('auth/register', {
          values: safeValues(body),
          errors: { [err.field ?? '_form']: err.message },
        });
        return;
      }
      throw err;
    }
    req.session.flash = {
      type: 'success',
      message: 'Pendaftaran berhasil. Akun Anda menunggu verifikasi admin.',
    };
    res.redirect(303, '/');
  };
}
