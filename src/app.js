/**
 * @file Composition root aplikasi: menyusun middleware, view engine, sesi,
 * proteksi CSRF, rute, dan penanganan error.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import nunjucks from 'nunjucks';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { csrfSync } from 'csrf-sync';
import { env } from './config/env.js';
import { UserRepository } from './repositories/UserRepository.js';
import { AuthService } from './services/AuthService.js';
import { VerificationService } from './services/VerificationService.js';
import { GarageRepository } from './repositories/GarageRepository.js';
import { GarageService } from './services/GarageService.js';
import { AuthController } from './controllers/AuthController.js';
import { VerificationController } from './controllers/VerificationController.js';
import { GarageController } from './controllers/GarageController.js';
import { DashboardController } from './controllers/DashboardController.js';
import { createAttachUser } from './middleware/auth.js';
import { createRouter } from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Masa berlaku cookie sesi: 2 jam. */
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * Menyiapkan Nunjucks sebagai view engine beserta global dan filter tampilan.
 *
 * @param {import('express').Express} app Aplikasi Express.
 * @returns {void}
 */
function configureViews(app) {
  const views = nunjucks.configure(path.join(SRC_DIR, 'views'), {
    autoescape: true,
    express: app,
    noCache: !env.isProduction,
  });
  app.set('view engine', 'njk');

  views.addGlobal('appName', 'Sistem Penyewaan Garasi');

  const rupiahFormat = new Intl.NumberFormat('id-ID');
  // Bilangan bulat -> "Rp 25.000"; kosong -> "-".
  views.addFilter('rupiah', (value) => {
    if (value === null || value === undefined) {
      return '-';
    }
    return `Rp ${rupiahFormat.format(value)}`;
  });

  const tanggalFormat = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });
  // Date -> "21 Nov 2026 08.00"; kosong -> "-".
  views.addFilter('tanggal', (value) => {
    if (value === null || value === undefined) {
      return '-';
    }
    return tanggalFormat.format(new Date(value));
  });
}

/**
 * Membuat aplikasi Express lengkap. Fungsi ini tidak memanggil listen sehingga
 * dapat dipakai server maupun pengujian.
 *
 * @param {object} deps Dependensi yang disuntikkan.
 * @param {object} deps.prisma Klien Prisma untuk repository.
 * @param {import('pg').Pool} deps.pgPool Pool pg untuk penyimpanan sesi.
 * @returns {import('express').Express} Aplikasi Express.
 */
export function createApp({ prisma, pgPool }) {
  const app = express();

  configureViews(app);

  app.use(helmet());
  app.use(express.static(path.join(SRC_DIR, 'public')));
  app.use(express.urlencoded({ extended: false }));

  // Tabel sesi dibuat oleh migrasi init_auth, bukan oleh connect-pg-simple.
  const PgStore = connectPgSimple(session);
  const sessionStore = new PgStore({ pool: pgPool, tableName: 'session' });
  app.locals.sessionStore = sessionStore;

  app.use(
    session({
      store: sessionStore,
      name: 'sid',
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.isProduction,
        maxAge: SESSION_MAX_AGE_MS,
      },
    }),
  );

  const { csrfSynchronisedProtection, generateToken } = csrfSync({
    getTokenFromRequest: (req) => req.body?._csrf,
  });

  // Data bersama untuk semua tampilan: token CSRF, pesan flash sekali pakai, pengguna aktif.
  app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req);
    res.locals.flash = req.session.flash ?? null;
    delete req.session.flash;
    res.locals.currentUser = null;
    next();
  });

  // Repository -> service -> controller disusun di sini (composition root).
  const userRepository = new UserRepository(prisma);
  const garageRepository = new GarageRepository(prisma);

  // Dipasang sebelum proteksi CSRF agar halaman error 403 pun tahu siapa penggunanya.
  app.use(createAttachUser(userRepository));

  app.use(csrfSynchronisedProtection);

  const authService = new AuthService(userRepository);
  const verificationService = new VerificationService(userRepository);
  const garageService = new GarageService(garageRepository);
  const controllers = {
    auth: new AuthController(authService),
    dashboard: new DashboardController(),
    verification: new VerificationController(verificationService),
    garage: new GarageController(garageService),
  };
  app.use(createRouter(controllers));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
