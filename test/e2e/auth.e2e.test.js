/**
 * @file Tes end-to-end masuk, keluar, dan pemisahan peran (Admin dan Penyewa).
 *
 * Berjalan terhadap database uji terpisah (nama berakhiran _test) lewat harness.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpClient,
  adminCredentials,
  registerRenter,
  startTestApp,
  uniqueRenter,
} from './support/harness.js';

/** @type {{ baseUrl: string, prisma: any, close: () => Promise<void> }} */
let ctx;

before(async () => {
  ctx = await startTestApp();
});

after(async () => {
  if (ctx) {
    await ctx.close();
  }
});

/**
 * Mendaftarkan penyewa baru lalu mengatur status verifikasinya langsung di database.
 *
 * @param {{ baseUrl: string, prisma: any }} context Konteks aplikasi uji.
 * @param {string} [status] Status verifikasi yang diatur.
 * @returns {Promise<{ nik: string, fullName: string, phone: string, email: string, password: string }>}
 */
async function acceptedRenter(context, status = 'ACCEPTED') {
  const data = uniqueRenter();
  const result = await registerRenter(new HttpClient(context.baseUrl), data);
  assert.equal(result.status, 303);
  await context.prisma.user.update({
    where: { email: data.email.toLowerCase() },
    data: { verificationStatus: status },
  });
  return data;
}

test('login: form masuk tampil dengan token CSRF', async () => {
  const client = new HttpClient(ctx.baseUrl);
  const page = await client.get('/login');
  assert.equal(page.status, 200);
  assert.match(page.text, /name="email"/);
  assert.match(page.text, /name="password"/);
  assert.ok(client.csrfToken && client.csrfToken.length > 0, 'token CSRF harus terisi');
});

test('login: admin hasil seed masuk, sesi diganti dan diarahkan ke /admin', async () => {
  const client = new HttpClient(ctx.baseUrl);
  await client.get('/login');
  const sidBefore = client.cookie('sid');
  assert.ok(sidBefore, 'cookie sid harus ada sebelum masuk');

  const { email, password } = adminCredentials();
  const result = await client.post('/login', { email, password });
  assert.equal(result.status, 303);
  assert.equal(result.location, '/admin');
  assert.ok(client.cookie('sid'), 'cookie sid harus ada setelah masuk');
  assert.notEqual(client.cookie('sid'), sidBefore, 'sid harus berganti setelah masuk');
});

test('login: email tidak dikenal dan password salah memberi pesan yang sama', async () => {
  const unknown = await new HttpClient(ctx.baseUrl).login('tidak.ada@contoh.test', 'RahasiaUji123');
  assert.equal(unknown.status, 401);
  assert.ok(unknown.text.includes('Email atau password salah'));

  const { email } = adminCredentials();
  const wrong = await new HttpClient(ctx.baseUrl).login(email, 'PasswordYangSalah1');
  assert.equal(wrong.status, 401);
  assert.ok(wrong.text.includes('Email atau password salah'));
});

test('login: penyewa yang menunggu verifikasi tidak dapat masuk', async () => {
  const data = uniqueRenter();
  await registerRenter(new HttpClient(ctx.baseUrl), data);

  const client = new HttpClient(ctx.baseUrl);
  const result = await client.login(data.email, data.password);
  assert.equal(result.status, 403);
  assert.ok(result.text.includes('menunggu verifikasi admin'));

  const home = await client.get('/');
  assert.doesNotMatch(home.text, /action="\/logout"/, 'tidak boleh ada sesi masuk');
});

test('login: penyewa yang ditolak tidak dapat masuk', async () => {
  const data = await acceptedRenter(ctx, 'REJECTED');
  const result = await new HttpClient(ctx.baseUrl).login(data.email, data.password);
  assert.equal(result.status, 403);
  assert.ok(result.text.includes('ditolak'));
});

test('login: penyewa yang diterima masuk dan diarahkan ke /penyewa', async () => {
  const data = await acceptedRenter(ctx, 'ACCEPTED');
  const result = await new HttpClient(ctx.baseUrl).login(data.email, data.password);
  assert.equal(result.status, 303);
  assert.equal(result.location, '/penyewa');
});

test('logout: keluar mengakhiri sesi', async () => {
  const client = new HttpClient(ctx.baseUrl);
  const { email, password } = adminCredentials();
  await client.login(email, password);
  await client.get('/');

  const result = await client.post('/logout');
  assert.equal(result.status, 303);
  assert.equal(result.location, '/');

  const home = await client.get('/');
  assert.ok(home.text.includes('Anda telah keluar'));

  const login = await client.get('/login');
  assert.equal(login.status, 200);
});

test('logout: keluar tanpa token CSRF ditolak', async () => {
  const client = new HttpClient(ctx.baseUrl);
  const { email, password } = adminCredentials();
  await client.login(email, password);
  await client.get('/');

  const result = await client.post('/logout', {}, { withCsrf: false });
  assert.equal(result.status, 403);

  const stillIn = await client.get('/');
  assert.match(stillIn.text, /action="\/logout"/);
});

test('peran: admin membuka dasbor admin tetapi ditolak di halaman penyewa', async () => {
  const client = new HttpClient(ctx.baseUrl);
  const { email, password } = adminCredentials();
  await client.login(email, password);

  const dashboard = await client.get('/admin');
  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.text.includes('Dasbor Admin'));

  const renterArea = await client.get('/penyewa');
  assert.equal(renterArea.status, 403);
  assert.ok(renterArea.text.includes('tidak memiliki akses'));
});

test('peran: penyewa membuka beranda penyewa tetapi ditolak di halaman admin', async () => {
  const data = await acceptedRenter(ctx);
  const client = new HttpClient(ctx.baseUrl);
  await client.login(data.email, data.password);

  const home = await client.get('/penyewa');
  assert.equal(home.status, 200);
  assert.ok(home.text.includes('Beranda Penyewa'));
  assert.ok(home.text.includes(data.fullName));

  const adminArea = await client.get('/admin');
  assert.equal(adminArea.status, 403);
  assert.ok(adminArea.text.includes('tidak memiliki akses'));
});

test('peran: pengunjung diarahkan ke halaman masuk', async () => {
  const client = new HttpClient(ctx.baseUrl);
  for (const path of ['/admin', '/penyewa']) {
    const result = await client.get(path);
    assert.equal(result.status, 303);
    assert.equal(result.location, '/login');
  }
});

test('peran: akses dicabut saat status penyewa berubah setelah masuk', async () => {
  const data = await acceptedRenter(ctx);
  const client = new HttpClient(ctx.baseUrl);
  await client.login(data.email, data.password);
  assert.equal((await client.get('/penyewa')).status, 200);

  await ctx.prisma.user.update({
    where: { email: data.email.toLowerCase() },
    data: { verificationStatus: 'REJECTED' },
  });

  const result = await client.get('/penyewa');
  assert.equal(result.status, 303);
  assert.equal(result.location, '/login');
});
