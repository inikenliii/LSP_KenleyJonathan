/**
 * @file Tes end-to-end alur pendaftaran penyewa (jalur utama walking skeleton).
 *
 * Berjalan terhadap database uji terpisah (nama berakhiran _test) lewat
 * harness, sehingga data aplikasi sebenarnya tidak tersentuh.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { HttpClient, startTestApp, uniqueRenter, registerRenter } from './support/harness.js';

/** @type {{ baseUrl: string, prisma: any, close: () => Promise<void> }} */
let app;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  if (app) {
    await app.close();
  }
});

test('beranda: halaman beranda tampil dengan tautan pendaftaran', async () => {
  const client = new HttpClient(app.baseUrl);
  const page = await client.get('/');
  assert.equal(page.status, 200);
  assert.match(page.text, /Sistem Penyewaan Garasi/);
  assert.match(page.text, /href="\/register"/);
});

test('daftar: form pendaftaran menampilkan semua field dan token CSRF', async () => {
  const client = new HttpClient(app.baseUrl);
  const page = await client.get('/register');
  assert.equal(page.status, 200);
  for (const field of ['nik', 'fullName', 'phone', 'email', 'password']) {
    assert.match(page.text, new RegExp(`name="${field}"`), `field ${field} harus ada`);
  }
  assert.ok(client.csrfToken && client.csrfToken.length > 0, 'token CSRF harus terisi');
});

test('daftar: pendaftaran valid tersimpan menunggu verifikasi dengan password ter-hash', async () => {
  const client = new HttpClient(app.baseUrl);
  const data = uniqueRenter();
  const mixedCaseEmail = data.email.replace('penyewa', 'PenYEWA');
  const result = await registerRenter(client, {
    ...data,
    email: mixedCaseEmail,
    role: 'ADMIN',
    verificationStatus: 'ACCEPTED',
  });
  assert.equal(result.status, 303);
  assert.equal(result.location, '/');

  const home = await client.get('/');
  assert.match(home.text, /menunggu verifikasi admin/);

  const stored = await app.prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  assert.ok(stored, 'pengguna harus tersimpan dengan email huruf kecil');
  assert.equal(stored.role, 'RENTER');
  assert.equal(stored.verificationStatus, 'PENDING');
  assert.notEqual(stored.passwordHash, data.password);
  assert.match(stored.passwordHash, /^\$2[aby]\$12\$/);
  assert.equal(stored.passwordHash.length, 60);
  assert.equal(await bcrypt.compare(data.password, stored.passwordHash), true);
});

test('daftar: pendaftaran tanpa token CSRF ditolak', async () => {
  const client = new HttpClient(app.baseUrl);
  const data = uniqueRenter();
  await client.get('/register');
  const result = await client.post('/register', data, { withCsrf: false });
  assert.equal(result.status, 403);
  const count = await app.prisma.user.count({ where: { email: data.email.toLowerCase() } });
  assert.equal(count, 0);
});

test('daftar: data tidak valid ditolak dengan pesan berbahasa Indonesia', async () => {
  const client = new HttpClient(app.baseUrl);
  const result = await registerRenter(client, {
    nik: '123',
    fullName: '',
    phone: '123',
    email: 'bukan-email',
    password: 'Zx9pnd',
  });
  assert.equal(result.status, 422);
  for (const message of [
    'NIK harus 16 digit angka',
    'Nama lengkap harus 3-100 karakter',
    'Nomor telepon tidak valid',
    'Format email tidak valid',
    'Password harus 8-72 karakter',
  ]) {
    assert.ok(result.text.includes(message), `pesan "${message}" harus tampil`);
  }
  assert.ok(result.text.includes('value="123"'), 'NIK yang diketik harus tampil kembali');
  assert.ok(!result.text.includes('Zx9pnd'), 'password tidak boleh ditampilkan kembali');
});

test('daftar: email atau NIK yang sudah terdaftar ditolak', async () => {
  const first = uniqueRenter();
  const second = uniqueRenter();
  const third = uniqueRenter();

  const registered = await registerRenter(new HttpClient(app.baseUrl), first);
  assert.equal(registered.status, 303);

  const sameEmail = await registerRenter(new HttpClient(app.baseUrl), {
    ...second,
    email: first.email,
  });
  assert.equal(sameEmail.status, 409);
  assert.ok(sameEmail.text.includes('Email sudah terdaftar'));

  const sameNik = await registerRenter(new HttpClient(app.baseUrl), {
    ...third,
    nik: first.nik,
  });
  assert.equal(sameNik.status, 409);
  assert.ok(sameNik.text.includes('NIK sudah terdaftar'));

  assert.equal(await app.prisma.user.count({ where: { email: first.email.toLowerCase() } }), 1);
  assert.equal(await app.prisma.user.count({ where: { nik: first.nik } }), 1);
});
