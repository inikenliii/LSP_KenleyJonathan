/**
 * @file Rute area Penyewa (/penyewa). Hanya penyewa yang sudah diterima admin
 * yang dapat masuk; rute penyewaan berikutnya dipasang di sini.
 */
import express from 'express';
import { requireVerifiedRenter } from '../middleware/auth.js';

/**
 * Membuat router area Penyewa.
 *
 * @param {object} controllers Controller per fitur.
 * @returns {import('express').Router}
 */
export function createRenterRouter(controllers) {
  const router = express.Router();
  router.use(requireVerifiedRenter);

  router.get('/', controllers.dashboard.renter);

  return router;
}
