/**
 * @file Daftar rute aplikasi. Rute hanya menghubungkan URL ke controller.
 */
import express from 'express';

/**
 * Membuat router utama aplikasi.
 *
 * @param {object} [controllers] Controller per fitur.
 * @returns {import('express').Router}
 */
export function createRouter(controllers = {}) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.render('home');
  });

  router.get('/register', controllers.auth.showRegister);
  router.post('/register', controllers.auth.register);

  router.get('/login', controllers.auth.showLogin);
  router.post('/login', controllers.auth.login);
  router.post('/logout', controllers.auth.logout);

  return router;
}
