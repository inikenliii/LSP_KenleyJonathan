/**
 * @file Rute area Admin (/admin). Semua rute di sini hanya untuk peran Admin.
 */
import express from 'express';
import { User } from '../domain/User.js';
import { requireRole } from '../middleware/auth.js';

/**
 * Membuat router area Admin.
 *
 * @param {object} controllers Controller per fitur.
 * @returns {import('express').Router}
 */
export function createAdminRouter(controllers) {
  const router = express.Router();
  router.use(requireRole(User.ROLE.ADMIN));

  router.get('/', controllers.dashboard.admin);
  router.get('/pendaftar', controllers.verification.index);
  router.post('/pendaftar/:id/keputusan', controllers.verification.decide);

  router.get('/garasi', controllers.garage.index);
  router.post('/garasi', controllers.garage.create);

  return router;
}
