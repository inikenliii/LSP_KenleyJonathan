/**
 * @file Controller autentikasi: menerjemahkan permintaan HTTP ke pemanggilan
 * service dan merender tampilan.
 */
import {
  ValidationError,
  DuplicateUserError,
  AuthenticationError,
  AccountNotVerifiedError,
} from '../domain/errors.js';
import { homePathFor } from '../middleware/auth.js';

/**
 * Membungkus session.regenerate menjadi Promise.
 *
 * @param {import('express').Request} req Permintaan.
 * @returns {Promise<void>}
 */
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Membungkus session.save menjadi Promise.
 *
 * @param {import('express').Request} req Permintaan.
 * @returns {Promise<void>}
 */
function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

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
 * Handler HTTP untuk pendaftaran, masuk, dan keluar.
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

  /**
   * Menampilkan formulir masuk.
   *
   * @param {import('express').Request} req Permintaan.
   * @param {import('express').Response} res Respons.
   * @returns {void}
   */
  showLogin = (req, res) => {
    res.render('auth/login', { values: {}, error: null });
  };

  /**
   * Memproses formulir masuk. Sesi diganti (regenerate) sebelum id pengguna
   * disimpan agar id sesi lama tidak bisa dipakai ulang (session fixation).
   *
   * @param {import('express').Request} req Permintaan.
   * @param {import('express').Response} res Respons.
   * @returns {Promise<void>}
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  login = async (req, res) => {
    const body = req.body ?? {};
    const values = { email: typeof body.email === 'string' ? body.email : '' };
    let user;
    try {
      user = await this.authService.authenticate(body);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(422).render('auth/login', { values, error: 'Email dan password wajib diisi dengan benar.' });
        return;
      }
      if (err instanceof AuthenticationError || err instanceof AccountNotVerifiedError) {
        res.status(err.statusCode).render('auth/login', { values, error: err.message });
        return;
      }
      throw err;
    }
    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);
    res.redirect(303, homePathFor(user));
  };

  /**
   * Mengakhiri sesi. Sesi diganti sehingga baris sesi lama terhapus, lalu
   * pesan sekali pakai ditampilkan di beranda.
   *
   * @param {import('express').Request} req Permintaan.
   * @param {import('express').Response} res Respons.
   * @returns {Promise<void>}
   */
  logout = async (req, res) => {
    await regenerateSession(req);
    req.session.flash = { type: 'info', message: 'Anda telah keluar.' };
    res.redirect(303, '/');
  };
}
