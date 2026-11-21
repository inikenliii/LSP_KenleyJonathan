/**
 * @file Middleware autentikasi: memuat pengguna dari sesi pada setiap
 * permintaan dan menyediakan helper jalur beranda sesuai peran.
 */
import { User } from '../domain/User.js';

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
