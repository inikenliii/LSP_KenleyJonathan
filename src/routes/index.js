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

  return router;
}
