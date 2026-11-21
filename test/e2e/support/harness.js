/**
 * @file Alat bantu pengujian end-to-end.
 *
 * Menyiapkan database uji yang terisolasi (nama harus berakhiran _test),
 * menjalankan aplikasi pada port acak, dan menyediakan klien HTTP sederhana
 * dengan cookie jar serta penanganan token CSRF.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Penghitung untuk membuat data penyewa yang unik di setiap pemanggilan. */
let renterCounter = 0;

/**
 * Memastikan database uji aman dihapus isinya: URL harus ada, berbeda dari
 * DATABASE_URL, dan nama databasenya berakhiran _test.
 *
 * @returns {{ testUrl: string, databaseName: string }} URL dan nama database uji.
 * @throws {Error} Bila salah satu aturan keselamatan dilanggar.
 */
function assertSafeTestDatabase() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL belum diisi di .env. Isi dengan database khusus uji, misalnya garage_rental_test.');
  }
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL tidak boleh sama dengan DATABASE_URL. Pengujian menghapus isi tabel, jadi harus memakai database terpisah.');
  }
  const databaseName = decodeURIComponent(new URL(testUrl).pathname.slice(1));
  if (!/^[A-Za-z0-9_]*_test$/.test(databaseName)) {
    throw new Error(`Nama database uji "${databaseName}" tidak valid. Nama harus berisi huruf, angka, atau garis bawah dan berakhiran _test.`);
  }
  return { testUrl, databaseName };
}

/**
 * Membuat database uji bila belum ada, lewat database pemeliharaan "postgres".
 *
 * @param {string} testUrl URL koneksi database uji.
 * @param {string} databaseName Nama database uji yang sudah divalidasi.
 * @returns {Promise<void>}
 */
async function ensureDatabaseExists(testUrl, databaseName) {
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (found.rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await client.end();
  }
}

/**
 * Menjalankan perintah shell di folder proyek dan melempar error bila gagal.
 *
 * @param {string} command Perintah yang dijalankan.
 * @returns {void}
 */
function runCommand(command) {
  const result = spawnSync(command, {
    cwd: PROJECT_ROOT,
    env: process.env,
    shell: true,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`Perintah "${command}" gagal.\n${result.stdout}\n${result.stderr}`);
  }
}

/**
 * Mengosongkan semua tabel (kecuali riwayat migrasi) pada database uji.
 *
 * @param {string} testUrl URL koneksi database uji.
 * @returns {Promise<void>}
 */
async function truncateAllTables(testUrl) {
  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
    );
    if (rows.length > 0) {
      const names = rows.map((row) => `"${row.tablename.replaceAll('"', '""')}"`).join(', ');
      await client.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await client.end();
  }
}

/**
 * Menyiapkan database uji lalu menyalakan aplikasi pada port acak.
 *
 * @returns {Promise<{ baseUrl: string, prisma: object, close: () => Promise<void> }>}
 */
export async function startTestApp() {
  dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });
  const { testUrl, databaseName } = assertSafeTestDatabase();

  // Harus diset sebelum modul src apa pun diimpor: src/config/env.js membaca process.env sekali.
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = 'test';
  process.env.AUTH_RATE_LIMIT_MAX = '1000';

  await ensureDatabaseExists(testUrl, databaseName);
  runCommand('npx prisma migrate deploy');
  await truncateAllTables(testUrl);
  runCommand('npx prisma db seed');

  const { prisma, pgPool } = await import('../../../src/db/prisma.js');
  const { createApp } = await import('../../../src/app.js');

  const app = createApp({ prisma, pgPool });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const close = async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    if (app.locals.sessionStore && typeof app.locals.sessionStore.close === 'function') {
      await app.locals.sessionStore.close();
    }
    await prisma.$disconnect();
    await pgPool.end();
  };

  return { baseUrl: `http://127.0.0.1:${server.address().port}`, prisma, close };
}

/**
 * Mengambil nilai token CSRF dari input tersembunyi bernama _csrf.
 *
 * @param {string} html Isi halaman HTML.
 * @returns {string|null} Token, atau null bila tidak ditemukan.
 */
export function extractCsrfToken(html) {
  for (const tag of html.match(/<input\b[^>]*>/gi) ?? []) {
    if (/\bname\s*=\s*["']_csrf["']/i.test(tag)) {
      const value = tag.match(/\bvalue\s*=\s*["']([^"']*)["']/i);
      return value ? value[1] : null;
    }
  }
  return null;
}

/**
 * Mengambil isi dalam (inner HTML) baris tabel pertama yang memiliki atribut data-ATTRIBUTE="VALUE".
 *
 * @param {string} html Isi halaman HTML.
 * @param {string} attribute Nama atribut data tanpa awalan "data-".
 * @param {string} value Nilai atribut.
 * @returns {string|null} Isi baris, atau null bila tidak ada.
 */
export function extractRow(html, attribute, value) {
  const marker = `data-${attribute}="${value}"`;
  const markerAt = html.indexOf(marker);
  if (markerAt === -1) {
    return null;
  }
  const rowStart = html.lastIndexOf('<tr', markerAt);
  if (rowStart === -1) {
    return null;
  }
  const openEnd = html.indexOf('>', markerAt);
  const rowEnd = html.indexOf('</tr>', openEnd);
  if (openEnd === -1 || rowEnd === -1) {
    return null;
  }
  return html.slice(openEnd + 1, rowEnd);
}

/**
 * Menghitung jumlah kemunculan atribut data-ATTRIBUTE="..." pada halaman.
 *
 * @param {string} html Isi halaman HTML.
 * @param {string} attribute Nama atribut data tanpa awalan "data-".
 * @returns {number}
 */
export function countRows(html, attribute) {
  return html.split(`data-${attribute}="`).length - 1;
}

/**
 * Membuat data pendaftaran penyewa yang unik untuk setiap pemanggilan.
 *
 * @param {object} [overrides] Nilai yang menimpa data bawaan.
 * @returns {{ nik: string, fullName: string, phone: string, email: string, password: string }}
 */
export function uniqueRenter(overrides = {}) {
  renterCounter += 1;
  const now = String(Date.now());
  const counter4 = String(renterCounter).padStart(4, '0');
  const counter2 = String(renterCounter).padStart(2, '0');
  return {
    nik: `3201${now.slice(-8)}${counter4}`,
    fullName: `Penyewa Uji ${renterCounter}`,
    phone: `0812${now.slice(-6)}${counter2}`,
    email: `penyewa${renterCounter}.${now}@contoh.test`,
    password: 'RahasiaUji123',
    ...overrides,
  };
}

/**
 * Kredensial Admin yang dipakai seed, dibaca dari environment.
 *
 * @returns {{ email: string, password: string }}
 */
export function adminCredentials() {
  return {
    email: String(process.env.ADMIN_EMAIL ?? '').trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD,
  };
}

/**
 * Klien HTTP minimal dengan cookie jar dan penanganan token CSRF.
 */
export class HttpClient {
  /**
   * @param {string} baseUrl Alamat dasar server uji.
   */
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
    this.csrfToken = null;
  }

  /**
   * Mengirim permintaan GET.
   *
   * @param {string} path Path tujuan.
   * @returns {Promise<{ status: number, location: string|null, headers: Headers, text: string }>}
   */
  async get(path) {
    return this.#request(path, { method: 'GET' });
  }

  /**
   * Mengirim formulir urlencoded lewat POST.
   *
   * @param {string} path Path tujuan.
   * @param {Record<string, string>} [fields] Isian formulir.
   * @param {object} [options]
   * @param {boolean} [options.withCsrf] Sertakan token CSRF terakhir yang terlihat.
   * @returns {Promise<{ status: number, location: string|null, headers: Headers, text: string }>}
   */
  async post(path, fields = {}, { withCsrf = true } = {}) {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) {
        body.append(key, String(value));
      }
    }
    if (withCsrf) {
      if (!this.csrfToken) {
        throw new Error('Belum ada token CSRF. Buka halaman formulir dengan get() lebih dulu.');
      }
      body.append('_csrf', this.csrfToken);
    }
    return this.#request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /**
   * Membuka halaman formulir untuk mendapat token CSRF, lalu mengirim isiannya.
   *
   * @param {string} formPath Path halaman formulir.
   * @param {Record<string, string>} fields Isian formulir.
   * @param {object} [options]
   * @param {string} [options.actionPath] Path tujuan POST bila berbeda dari formPath.
   * @param {boolean} [options.withCsrf] Sertakan token CSRF.
   * @returns {Promise<{ status: number, location: string|null, headers: Headers, text: string }>}
   */
  async submitForm(formPath, fields, { actionPath = formPath, withCsrf = true } = {}) {
    await this.get(formPath);
    return this.post(actionPath, fields, { withCsrf });
  }

  /**
   * Login lewat formulir /login.
   *
   * @param {string} email Email pengguna.
   * @param {string} password Password pengguna.
   * @returns {Promise<{ status: number, location: string|null, headers: Headers, text: string }>}
   */
  async login(email, password) {
    return this.submitForm('/login', { email, password });
  }

  /**
   * Membaca nilai cookie dari jar.
   *
   * @param {string} name Nama cookie.
   * @returns {string|undefined}
   */
  cookie(name) {
    return this.cookies.get(name);
  }

  /**
   * Menjalankan permintaan, menyimpan cookie, dan mengingat token CSRF.
   *
   * @param {string} path Path tujuan.
   * @param {object} init Opsi fetch.
   * @returns {Promise<{ status: number, location: string|null, headers: Headers, text: string }>}
   */
  async #request(path, init) {
    const headers = { ...(init.headers ?? {}) };
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    }
    const response = await fetch(this.baseUrl + path, { ...init, headers, redirect: 'manual' });
    this.#storeCookies(response.headers.getSetCookie());
    const text = await response.text();
    const token = extractCsrfToken(text);
    if (token) {
      this.csrfToken = token;
    }
    return {
      status: response.status,
      location: response.headers.get('location'),
      headers: response.headers,
      text,
    };
  }

  /**
   * Memperbarui cookie jar dari header Set-Cookie.
   *
   * @param {string[]} setCookies Daftar header Set-Cookie.
   * @returns {void}
   */
  #storeCookies(setCookies) {
    for (const line of setCookies) {
      const pair = line.split(';')[0];
      const separator = pair.indexOf('=');
      if (separator === -1) {
        continue;
      }
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (value === '') {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }
}

/**
 * Mendaftarkan penyewa baru lewat formulir /register.
 *
 * @param {HttpClient} client Klien HTTP.
 * @param {object} data Isian pendaftaran.
 * @returns {Promise<{ status: number, location: string|null, headers: Headers, text: string }>}
 */
export function registerRenter(client, data) {
  return client.submitForm('/register', data);
}
