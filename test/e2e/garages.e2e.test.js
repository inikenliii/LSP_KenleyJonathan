/**
 * @file Tes end-to-end pembuatan garasi berkelompok oleh Admin: ID berurutan
 * per tipe, harga per tipe, batas 999, dan keamanan saat permintaan bersamaan.
 *
 * Berjalan terhadap database uji terpisah (nama berakhiran _test) lewat harness.
 * Tes di bawah berurutan dan keadaan data berlanjut dari satu tes ke tes berikutnya.
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

before(async () => {
  ctx = await startTestApp();
});

after(async () => {
  if (ctx) {
    await ctx.close();
  }
});

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
 * Mendaftarkan penyewa, menerimanya langsung di database, lalu masuk.
 *
 * @returns {Promise<HttpClient>}
 */
async function acceptedRenterClient() {
  const data = uniqueRenter();
  const registered = await registerRenter(new HttpClient(ctx.baseUrl), data);
  assert.equal(registered.status, 303);
  await ctx.prisma.user.update({
    where: { email: data.email.toLowerCase() },
    data: { verificationStatus: 'ACCEPTED' },
  });
  const client = new HttpClient(ctx.baseUrl);
  const result = await client.login(data.email, data.password);
  assert.equal(result.status, 303);
  return client;
}

/**
 * Mengirim formulir pembuatan garasi berkelompok.
 *
 * @param {HttpClient} client Klien yang mengirim.
 * @param {Record<string, string|number>} fields Isian formulir.
 * @returns {Promise<{ status: number, location: string|null, text: string }>}
 */
function createBatch(client, fields) {
  return client.submitForm('/admin/garasi', fields);
}

/**
 * Daftar ID garasi satu tipe, urut menurut ID.
 *
 * @param {string} type Kode tipe garasi.
 * @returns {Promise<string[]>}
 */
async function garageIds(type) {
  const rows = await ctx.prisma.garage.findMany({ where: { type }, orderBy: { id: 'asc' } });
  return rows.map((row) => row.id);
}

/**
 * Konfigurasi satu tipe garasi.
 *
 * @param {string} type Kode tipe garasi.
 * @returns {Promise<{ type: string, dailyPrice: number, pricePerKwh: number|null, lastNumber: number }>}
 */
function config(type) {
  return ctx.prisma.garageTypeConfig.findUnique({ where: { type } });
}

test('garasi-halaman: admin melihat form batch dan harga per tipe', async () => {
  const admin = await adminClient();
  const page = await admin.get('/admin/garasi');
  assert.equal(page.status, 200);
  assert.ok(page.text.includes('Kelola Garasi'));

  const labels = { BICYCLE: 'Sepeda', CAR: 'Mobil', ELECTRIC_CAR: 'Mobil Listrik' };
  for (const [code, label] of Object.entries(labels)) {
    assert.ok(page.text.includes(`value="${code}"`), `opsi ${code} harus ada`);
    const row = extractRow(page.text, 'garage-type', code);
    assert.ok(row, `baris untuk ${code} harus ada`);
    assert.ok(row.includes(label));
    assert.ok(row.includes('Belum diatur'));
    assert.ok(row.includes('999'));
  }
  assert.match(page.text, /<select[^>]*name="type"/);
  for (const name of ['quantity', 'dailyPrice', 'pricePerKwh']) {
    assert.match(page.text, new RegExp(`<input[^>]*name="${name}"`));
  }
});

test('garasi-halaman: pengunjung dan penyewa tidak dapat membuka kelola garasi', async () => {
  const anonymous = await new HttpClient(ctx.baseUrl).get('/admin/garasi');
  assert.equal(anonymous.status, 303);
  assert.equal(anonymous.location, '/login');

  const renter = await acceptedRenterClient();
  const forbidden = await renter.get('/admin/garasi');
  assert.equal(forbidden.status, 403);

  await renter.get('/penyewa');
  const post = await renter.post('/admin/garasi', { type: 'BICYCLE', quantity: '1', dailyPrice: '5000' });
  assert.equal(post.status, 403);
  assert.equal(await ctx.prisma.garage.count(), 0);
});

test('garasi-batch: batch sepeda pertama menghasilkan ID S001 sampai S003', async () => {
  const admin = await adminClient();
  const result = await createBatch(admin, { type: 'BICYCLE', quantity: '3', dailyPrice: '5000' });
  assert.equal(result.status, 303);
  assert.equal(result.location, '/admin/garasi');

  const page = await admin.get('/admin/garasi');
  assert.ok(page.text.includes('Berhasil membuat 3 garasi Sepeda'));
  assert.ok(page.text.includes('S001'));
  assert.ok(page.text.includes('S003'));

  assert.deepEqual(await garageIds('BICYCLE'), ['S001', 'S002', 'S003']);
  const rows = await ctx.prisma.garage.findMany({ where: { type: 'BICYCLE' } });
  assert.ok(rows.every((row) => row.status === 'AVAILABLE'));

  const cfg = await config('BICYCLE');
  assert.equal(cfg.dailyPrice, 5000);
  assert.equal(cfg.lastNumber, 3);
  assert.equal(cfg.pricePerKwh, null);
});

test('garasi-batch: batch berikutnya melanjutkan dari ID terakhir', async () => {
  const admin = await adminClient();
  const result = await createBatch(admin, { type: 'BICYCLE', quantity: '2', dailyPrice: '5000' });
  assert.equal(result.status, 303);

  const ids = await garageIds('BICYCLE');
  assert.deepEqual(ids.slice(-2), ['S004', 'S005']);
  assert.equal((await config('BICYCLE')).lastNumber, 5);
});

test('garasi-batch: setiap tipe memiliki urutan sendiri dan harga per kWh tersimpan', async () => {
  const admin = await adminClient();

  const car = await createBatch(admin, { type: 'CAR', quantity: '1', dailyPrice: '12000', pricePerKwh: '999' });
  assert.equal(car.status, 303);
  assert.deepEqual(await garageIds('CAR'), ['C001']);
  const carConfig = await config('CAR');
  assert.equal(carConfig.pricePerKwh, null);
  assert.equal(carConfig.dailyPrice, 12000);

  const electric = await createBatch(admin, {
    type: 'ELECTRIC_CAR',
    quantity: '2',
    dailyPrice: '20000',
    pricePerKwh: '2500',
  });
  assert.equal(electric.status, 303);
  assert.deepEqual(await garageIds('ELECTRIC_CAR'), ['E001', 'E002']);
  assert.equal((await config('ELECTRIC_CAR')).pricePerKwh, 2500);
});

test('garasi-batch: mobil listrik tanpa harga per kWh ditolak', async () => {
  const admin = await adminClient();
  const result = await createBatch(admin, { type: 'ELECTRIC_CAR', quantity: '1', dailyPrice: '20000' });
  assert.equal(result.status, 422);
  assert.ok(result.text.includes('Harga per kWh wajib untuk Mobil Listrik'));
  assert.equal((await garageIds('ELECTRIC_CAR')).length, 2);
  assert.ok(result.text.includes('value="1"'));
});

test('garasi-batch: input tidak valid ditolak dengan pesan berbahasa Indonesia', async () => {
  const admin = await adminClient();
  const cases = [
    [{ type: 'MOTOR', quantity: '1', dailyPrice: '5000' }, 'Tipe garasi tidak valid'],
    [{ type: 'BICYCLE', quantity: '0', dailyPrice: '5000' }, 'Jumlah garasi paling sedikit 1'],
    [{ type: 'BICYCLE', quantity: '1000', dailyPrice: '5000' }, 'Jumlah maksimum 999'],
    [{ type: 'BICYCLE', quantity: '1', dailyPrice: '0' }, 'Harga harian paling sedikit Rp 1'],
  ];
  for (const [fields, message] of cases) {
    const result = await createBatch(admin, fields);
    assert.equal(result.status, 422, message);
    assert.ok(result.text.includes(message), message);
  }
  assert.equal(await ctx.prisma.garage.count(), 8);
});

test('garasi-batch: batch bersamaan tidak menghasilkan ID ganda', async () => {
  const admin = await adminClient();
  await admin.get('/admin/garasi');
  const results = await Promise.all(
    Array.from({ length: 5 }, () => admin.post('/admin/garasi', { type: 'CAR', quantity: '10', dailyPrice: '15000' })),
  );
  for (const result of results) {
    assert.equal(result.status, 303);
  }

  const expected = Array.from({ length: 51 }, (_, i) => `C${String(i + 1).padStart(3, '0')}`);
  assert.deepEqual(await garageIds('CAR'), expected);
  const cfg = await config('CAR');
  assert.equal(cfg.lastNumber, 51);
  assert.equal(cfg.dailyPrice, 15000);
});

test('garasi-batch: batch yang melampaui batas 999 ditolak tanpa mengubah data', async () => {
  const admin = await adminClient();
  const fill = await createBatch(admin, { type: 'CAR', quantity: '948', dailyPrice: '15000' });
  assert.equal(fill.status, 303);
  const ids = await garageIds('CAR');
  assert.equal(ids.length, 999);
  assert.equal(ids.at(-1), 'C999');

  const over = await createBatch(admin, { type: 'CAR', quantity: '1', dailyPrice: '99999' });
  assert.equal(over.status, 422);
  assert.ok(over.text.includes('melebihi batas 999'));
  assert.ok(over.text.includes('sisa kuota 0'));

  assert.equal((await garageIds('CAR')).length, 999);
  const cfg = await config('CAR');
  assert.equal(cfg.dailyPrice, 15000);
  assert.equal(cfg.lastNumber, 999);
});
