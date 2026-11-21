/**
 * @file Tes end-to-end verifikasi pendaftar oleh Admin (daftar pendaftar baru,
 * menerima setelah validasi KTP, menolak).
 *
 * Berjalan terhadap database uji terpisah (nama berakhiran _test) lewat harness.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpClient,
  adminCredentials,
  extractRow,
  registerRenter,
  startTestApp,
  uniqueRenter,
} from './support/harness.js';

/** @type {{ baseUrl: string, prisma: any, close: () => Promise<void> }} */
let ctx;

/** Penyewa yang dipakai bersama oleh tes-tes berurutan di bawah. */
let renterA;
let renterB;

before(async () => {
  ctx = await startTestApp();
});

after(async () => {
  if (ctx) {
    await ctx.close();
  }
});

/**
 * Mengambil id pengguna dari email.
 *
 * @param {string} email Email pengguna.
 * @returns {Promise<number>} Id pengguna.
 */
async function idOf(email) {
  const user = await ctx.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  return user.id;
}

/**
 * Membuat klien yang sudah masuk sebagai Admin.
 *
 * @returns {Promise<HttpClient>}
 */
async function adminClient() {
  const client = new HttpClient(ctx.baseUrl);
  const { email, password } = adminCredentials();
  const result = await client.login(email, password);
  assert.equal(result.status, 303);
  return client;
}

/**
 * Mendaftarkan penyewa lewat formulir (status PENDING).
 *
 * @returns {Promise<{ nik: string, fullName: string, phone: string, email: string, password: string }>}
 */
async function registeredRenter() {
  const data = uniqueRenter();
  const result = await registerRenter(new HttpClient(ctx.baseUrl), data);
  assert.equal(result.status, 303);
  return data;
}

/**
 * Mendaftarkan penyewa, mengatur status ACCEPTED di database, lalu masuk.
 *
 * @returns {Promise<{ client: HttpClient, data: object }>}
 */
async function acceptedRenterClient() {
  const data = await registeredRenter();
  await ctx.prisma.user.update({
    where: { email: data.email.toLowerCase() },
    data: { verificationStatus: 'ACCEPTED' },
  });
  const client = new HttpClient(ctx.baseUrl);
  const result = await client.login(data.email, data.password);
  assert.equal(result.status, 303);
  return { client, data };
}

/**
 * Alamat pengiriman keputusan untuk satu pendaftar.
 *
 * @param {number|string} id Id pendaftar.
 * @returns {string}
 */
function decisionUrl(id) {
  return `/admin/pendaftar/${id}/keputusan`;
}

test('pendaftar: admin melihat daftar pendaftar baru', async () => {
  renterA = await registeredRenter();
  renterB = await registeredRenter();
  const renterC = await registeredRenter();
  await ctx.prisma.user.update({
    where: { email: renterC.email.toLowerCase() },
    data: { verificationStatus: 'ACCEPTED' },
  });

  const admin = await adminClient();
  const page = await admin.get('/admin/pendaftar');
  assert.equal(page.status, 200);
  assert.ok(page.text.includes('Verifikasi Pendaftar'));

  for (const renter of [renterA, renterB]) {
    const row = extractRow(page.text, 'user-id', await idOf(renter.email));
    assert.ok(row, `baris untuk ${renter.email} harus ada`);
    assert.ok(row.includes(renter.fullName));
    assert.ok(row.includes(renter.nik));
    assert.ok(row.includes(renter.email));
    assert.ok(row.includes(renter.phone));
  }

  assert.equal(extractRow(page.text, 'user-id', await idOf(renterC.email)), null);
  assert.equal(extractRow(page.text, 'user-id', await idOf(adminCredentials().email)), null);
});

test('pendaftar: pengunjung dan penyewa tidak dapat membuka daftar pendaftar', async () => {
  const anonymous = await new HttpClient(ctx.baseUrl).get('/admin/pendaftar');
  assert.equal(anonymous.status, 303);
  assert.equal(anonymous.location, '/login');

  const { client } = await acceptedRenterClient();
  const forbidden = await client.get('/admin/pendaftar');
  assert.equal(forbidden.status, 403);
});

test('keputusan: menerima tanpa konfirmasi validasi KTP ditolak', async () => {
  const admin = await adminClient();
  const id = await idOf(renterA.email);
  const result = await admin.submitForm(
    '/admin/pendaftar',
    { decision: 'ACCEPT' },
    { actionPath: decisionUrl(id) },
  );
  assert.equal(result.status, 422);
  assert.ok(result.text.includes('Centang konfirmasi validasi KTP'));

  const user = await ctx.prisma.user.findUnique({ where: { id } });
  assert.equal(user.verificationStatus, 'PENDING');
});

test('keputusan: admin menerima pendaftar setelah validasi KTP dan penyewa dapat masuk', async () => {
  const admin = await adminClient();
  const adminId = await idOf(adminCredentials().email);
  const id = await idOf(renterA.email);

  const result = await admin.submitForm(
    '/admin/pendaftar',
    { decision: 'ACCEPT', ktpValidated: 'on' },
    { actionPath: decisionUrl(id) },
  );
  assert.equal(result.status, 303);
  assert.equal(result.location, '/admin/pendaftar');

  const page = await admin.get('/admin/pendaftar');
  assert.ok(page.text.includes('diterima'));
  assert.equal(extractRow(page.text, 'user-id', id), null);

  const user = await ctx.prisma.user.findUnique({ where: { id } });
  assert.equal(user.verificationStatus, 'ACCEPTED');
  assert.equal(user.verifiedById, adminId);
  assert.notEqual(user.verifiedAt, null);

  const login = await new HttpClient(ctx.baseUrl).login(renterA.email, renterA.password);
  assert.equal(login.status, 303);
  assert.equal(login.location, '/penyewa');
});

test('keputusan: admin menolak pendaftar dan penyewa tidak dapat masuk', async () => {
  const admin = await adminClient();
  const adminId = await idOf(adminCredentials().email);
  const id = await idOf(renterB.email);

  const result = await admin.submitForm(
    '/admin/pendaftar',
    { decision: 'REJECT' },
    { actionPath: decisionUrl(id) },
  );
  assert.equal(result.status, 303);

  const user = await ctx.prisma.user.findUnique({ where: { id } });
  assert.equal(user.verificationStatus, 'REJECTED');
  assert.equal(user.verifiedById, adminId);

  const login = await new HttpClient(ctx.baseUrl).login(renterB.email, renterB.password);
  assert.equal(login.status, 403);
  assert.ok(login.text.includes('ditolak'));
});

test('keputusan: keputusan ganda dan ID tidak dikenal ditolak', async () => {
  const admin = await adminClient();
  const adminId = await idOf(adminCredentials().email);
  const idA = await idOf(renterA.email);

  const again = await admin.submitForm(
    '/admin/pendaftar',
    { decision: 'ACCEPT', ktpValidated: 'on' },
    { actionPath: decisionUrl(idA) },
  );
  assert.equal(again.status, 409);
  assert.ok(again.text.includes('sudah diproses'));

  const fields = { decision: 'ACCEPT', ktpValidated: 'on' };
  const unknown = await admin.post(decisionUrl(999999), fields);
  assert.equal(unknown.status, 404);
  assert.ok(unknown.text.includes('Pendaftar tidak ditemukan'));

  const notNumber = await admin.post(decisionUrl('abc'), fields);
  assert.equal(notNumber.status, 404);

  const adminSelf = await admin.post(decisionUrl(adminId), fields);
  assert.equal(adminSelf.status, 404);
});

test('keputusan: penyewa tidak dapat memberi keputusan', async () => {
  const renterD = await registeredRenter();
  const id = await idOf(renterD.email);

  const { client } = await acceptedRenterClient();
  await client.get('/penyewa');
  const result = await client.post(decisionUrl(id), { decision: 'ACCEPT', ktpValidated: 'on' });
  assert.equal(result.status, 403);

  const user = await ctx.prisma.user.findUnique({ where: { id } });
  assert.equal(user.verificationStatus, 'PENDING');
});

test('keputusan: keputusan tanpa token CSRF ditolak', async () => {
  const renterD = await registeredRenter();
  const id = await idOf(renterD.email);

  const admin = await adminClient();
  await admin.get('/admin/pendaftar');
  const result = await admin.post(
    decisionUrl(id),
    { decision: 'ACCEPT', ktpValidated: 'on' },
    { withCsrf: false },
  );
  assert.equal(result.status, 403);

  const user = await ctx.prisma.user.findUnique({ where: { id } });
  assert.equal(user.verificationStatus, 'PENDING');
});
