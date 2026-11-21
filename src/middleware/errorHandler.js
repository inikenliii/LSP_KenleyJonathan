/**
 * @file Penanganan error pusat. Pengguna hanya melihat pesan Bahasa Indonesia;
 * detail teknis hanya dicatat di server.
 */
import { AppError, NotFoundError } from '../domain/errors.js';

/** Judul halaman error menurut kode status. */
const TITLES = {
  403: 'Akses Ditolak',
  404: 'Halaman Tidak Ditemukan',
  409: 'Data Bentrok',
  413: 'Data Terlalu Besar',
  422: 'Data Tidak Valid',
  500: 'Kesalahan Server',
};

/**
 * Meneruskan permintaan yang tidak cocok dengan rute mana pun sebagai 404.
 *
 * @param {import('express').Request} req Permintaan.
 * @param {import('express').Response} res Respons.
 * @param {import('express').NextFunction} next Fungsi lanjut.
 * @returns {void}
 */
export function notFoundHandler(req, res, next) {
  next(new NotFoundError());
}

/**
 * Menentukan status dan pesan yang aman ditampilkan untuk sebuah error.
 *
 * @param {any} err Error yang tertangkap.
 * @returns {{ status: number, message: string }}
 */
function describeError(err) {
  if (err instanceof AppError) {
    return { status: err.statusCode, message: err.message };
  }
  if (err?.code === 'EBADCSRFTOKEN') {
    return {
      status: 403,
      message: 'Formulir kedaluwarsa atau tidak valid. Muat ulang halaman lalu coba lagi.',
    };
  }
  if (err?.status === 413) {
    return { status: 413, message: 'Data yang dikirim terlalu besar.' };
  }
  return { status: 500, message: 'Terjadi kesalahan pada server.' };
}

/**
 * Penanganan error terakhir: mencatat error server dan menampilkan halaman
 * error berbahasa Indonesia tanpa detail teknis.
 *
 * @param {any} err Error yang tertangkap.
 * @param {import('express').Request} req Permintaan.
 * @param {import('express').Response} res Respons.
 * @param {import('express').NextFunction} next Fungsi lanjut.
 * @returns {void}
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }
  const { status, message } = describeError(err);
  if (status >= 500) {
    // Hanya error dan penyebabnya; isi form (password, NIK, telepon) tidak dicatat.
    console.error(err?.cause ?? err);
  }
  res.status(status).render('errors/error', {
    title: TITLES[status] ?? 'Terjadi Kesalahan',
    status,
    message,
  });
}
