/**
 * @file Middleware autentikasi: memuat pengguna dari sesi pada setiap
 * permintaan dan menyediakan helper jalur beranda sesuai peran.
 */
import { User } from '../domain/User.js';
import { ForbiddenError } from '../domain/errors.js';

/**
 * Menentukan halaman beranda sesuai peran pengguna.
 *
 * @param {User} user Pengguna yang sudah masuk.
 * @returns {'/admin'|'/penyewa'} Jalur beranda.
 */
export function homePathFor(user) {
  return user.role === User.ROLE.ADMIN ? '/admin' : '/penyewa';
}

/**
 * Membuat middleware yang memuat ulang pengguna dari database pada setiap
 * permintaan. Sesi hanya menyimpan id, sehingga perubahan peran atau status
 * verifikasi langsung berlaku. Bila pengguna hilang atau tidak lagi boleh
 * masuk, sesi dianggap keluar.
 *
 * @param {import('../repositories/UserRepository.js').UserRepository} userRepository Repository pengguna.
 * @returns {import('express').RequestHandler} Middleware Express.
 */
export function createAttachUser(userRepository) {
  return async (req, res, next) => {
    try {
      let user = null;
      if (req.session.userId) {
        user = await userRepository.findById(req.session.userId);
        if (user === null || !user.canAccessSystem()) {
          delete req.session.userId;
          user = null;
        }
      }
      req.user = user;
      res.locals.currentUser = user === null ? null : user.toView();
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Mewajibkan pengguna sudah masuk; pengunjung dialihkan ke halaman masuk.
 *
 * @param {import('express').Request} req Permintaan.
 * @param {import('express').Response} res Respons.
 * @param {import('express').NextFunction} next Fungsi lanjut.
 * @returns {void}
 */
export function requireAuth(req, res, next) {
  if (req.user === null) {
    res.redirect(303, '/login');
    return;
  }
  next();
}

/**
 * Membuat middleware yang hanya meloloskan pengguna dengan salah satu peran
 * yang diizinkan. Pengunjung dialihkan ke halaman masuk, peran lain ditolak 403.
 *
 * @param {...string} roles Peran yang diizinkan (nilai User.ROLE).
 * @returns {import('express').RequestHandler} Middleware Express.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (req.user === null) {
      res.redirect(303, '/login');
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}

/**
 * Hanya meloloskan penyewa yang sudah diterima admin (aturan penyewaan).
 *
 * @param {import('express').Request} req Permintaan.
 * @param {import('express').Response} res Respons.
 * @param {import('express').NextFunction} next Fungsi lanjut.
 * @returns {void}
 */
export function requireVerifiedRenter(req, res, next) {
  if (req.user === null) {
    res.redirect(303, '/login');
    return;
  }
  if (!req.user.canRent()) {
    next(new ForbiddenError());
    return;
  }
  next();
}
