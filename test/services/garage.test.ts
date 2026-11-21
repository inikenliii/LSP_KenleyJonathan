/**
 * @file Tes layanan garasi (GAR-01 sampai GAR-05) pada database uji: pembuatan
 * berkelompok, batas 999, konkurensi, tabel harga, dan daftar garasi.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CapacityExceededError, ValidationError } from '@/domain';
import { GarageRepository } from '@/repositories';
import { GarageService } from '@/services';
import { createTestPrisma, resetDatabase } from '../support/db';

const prisma = createTestPrisma();
const service = new GarageService(new GarageRepository(prisma));

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await resetDatabase(prisma);
  await prisma.$disconnect();
});

/**
 * Menjalankan pembuatan batch dan mengembalikan error validasinya.
 *
 * @param input Isian formulir mentah.
 * @returns Error validasi yang dilempar layanan.
 */
async function galatValidasi(input: Record<string, string>): Promise<ValidationError> {
  try {
    await service.createBatch(input);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return error as ValidationError;
  }
  throw new Error('Seharusnya melempar ValidationError.');
}

describe('GarageService.createBatch', () => {
  it('menyimpan harga harian persis untuk batch dengan jumlah berapa pun', async () => {
    for (const quantity of [1, 2, 3, 4]) {
      await service.createBatch({
        type: 'BICYCLE',
        quantity: String(quantity),
        dailyPrice: '2000',
      });
    }

    const konfigurasi = await prisma.garageTypeConfig.findUniqueOrThrow({
      where: { type: 'BICYCLE' },
    });
    expect(konfigurasi.dailyPrice).toBe(2000);
    expect(konfigurasi.lastNumber).toBe(10);

    const garasi = await prisma.garage.findMany({
      where: { type: 'BICYCLE' },
      orderBy: { id: 'asc' },
    });
    expect(garasi).toHaveLength(10);
    expect(garasi.every((item) => item.status === 'AVAILABLE')).toBe(true);
  });

  it('batch Sepeda pertama menghasilkan S001 sampai S003 dan menyimpan harga', async () => {
    const hasil = await service.createBatch({ type: 'BICYCLE', quantity: '3', dailyPrice: '10000' });

    expect(hasil).toMatchObject({ firstId: 'S001', lastId: 'S003', count: 3, typeLabel: 'Sepeda' });
    const konfigurasi = await prisma.garageTypeConfig.findUniqueOrThrow({
      where: { type: 'BICYCLE' },
    });
    expect(konfigurasi.dailyPrice).toBe(10000);
    expect(konfigurasi.lastNumber).toBe(3);
    const garasi = await prisma.garage.findMany({ where: { type: 'BICYCLE' } });
    expect(garasi).toHaveLength(3);
    expect(garasi.every((g) => g.status === 'AVAILABLE')).toBe(true);
  });

  it('batch kedua melanjutkan dari nomor terakhir', async () => {
    await service.createBatch({ type: 'BICYCLE', quantity: '3', dailyPrice: '10000' });
    const hasil = await service.createBatch({ type: 'BICYCLE', quantity: '2', dailyPrice: '10000' });

    expect(hasil.firstId).toBe('S004');
    expect(hasil.lastId).toBe('S005');
  });

  it('setiap tipe punya urutan sendiri dan Mobil Listrik menyimpan harga per kWh', async () => {
    await service.createBatch({ type: 'BICYCLE', quantity: '3', dailyPrice: '10000' });
    const mobil = await service.createBatch({ type: 'CAR', quantity: '1', dailyPrice: '30000' });
    const listrik = await service.createBatch({
      type: 'ELECTRIC_CAR',
      quantity: '2',
      dailyPrice: '50000',
      pricePerKwh: '2500',
    });

    expect(mobil.firstId).toBe('C001');
    expect(listrik.firstId).toBe('E001');
    expect(listrik.lastId).toBe('E002');
    expect(listrik.summary).toBe('Mobil Listrik E001, Rp 50.000 per hari, Rp 2.500 per kWh');
    const konfigurasi = await prisma.garageTypeConfig.findUniqueOrThrow({
      where: { type: 'ELECTRIC_CAR' },
    });
    expect(konfigurasi.pricePerKwh).toBe(2500);
  });

  it('Mobil Listrik tanpa harga per kWh ditolak dan tidak ada yang dibuat', async () => {
    const galat = await galatValidasi({ type: 'ELECTRIC_CAR', quantity: '2', dailyPrice: '50000' });

    expect(galat.fieldErrors.pricePerKwh).toEqual(['Harga per kWh wajib untuk Mobil Listrik']);
    expect(await prisma.garage.count()).toBe(0);
  });

  it('harga per kWh pada tipe lain diabaikan', async () => {
    await service.createBatch({
      type: 'BICYCLE',
      quantity: '1',
      dailyPrice: '10000',
      pricePerKwh: '2500',
    });

    const konfigurasi = await prisma.garageTypeConfig.findUniqueOrThrow({
      where: { type: 'BICYCLE' },
    });
    expect(konfigurasi.pricePerKwh).toBeNull();
  });

  it('masukan tidak valid menghasilkan pesan Bahasa Indonesia per field', async () => {
    const jumlahNol = await galatValidasi({ type: 'BICYCLE', quantity: '0', dailyPrice: '10000' });
    expect(jumlahNol.fieldErrors.quantity).toContain('Jumlah garasi paling sedikit 1');

    const jumlahBesar = await galatValidasi({
      type: 'BICYCLE',
      quantity: '1000',
      dailyPrice: '10000',
    });
    expect(jumlahBesar.fieldErrors.quantity).toContain('Jumlah maksimum 999');

    const tipeSalah = await galatValidasi({ type: 'TRUCK', quantity: '1', dailyPrice: '10000' });
    expect(tipeSalah.fieldErrors.type).toContain('Tipe garasi tidak valid');

    const hargaKosong = await galatValidasi({ type: 'BICYCLE', quantity: '1', dailyPrice: '' });
    expect(hargaKosong.fieldErrors.dailyPrice).toContain('Harga harian wajib diisi angka');
  });

  it('lima batch bersamaan menghasilkan 50 ID berbeda tanpa bentrok', async () => {
    await Promise.all(
      Array.from({ length: 5 }, () =>
        service.createBatch({ type: 'CAR', quantity: '10', dailyPrice: '30000' }),
      ),
    );

    const garasi = await prisma.garage.findMany({ where: { type: 'CAR' }, orderBy: { id: 'asc' } });
    const ids = garasi.map((g) => g.id);
    expect(new Set(ids).size).toBe(50);
    expect(ids[0]).toBe('C001');
    expect(ids[49]).toBe('C050');
    const konfigurasi = await prisma.garageTypeConfig.findUniqueOrThrow({ where: { type: 'CAR' } });
    expect(konfigurasi.lastNumber).toBe(50);
  });

  it('batch yang melewati 999 ditolak seluruhnya dan penghitung tidak berubah', async () => {
    await prisma.garageTypeConfig.update({
      where: { type: 'BICYCLE' },
      data: { lastNumber: 997 },
    });

    await expect(
      service.createBatch({ type: 'BICYCLE', quantity: '3', dailyPrice: '10000' }),
    ).rejects.toSatisfy(
      (error) => error instanceof CapacityExceededError && /sisa kuota 2/.test(error.message),
    );

    const konfigurasi = await prisma.garageTypeConfig.findUniqueOrThrow({
      where: { type: 'BICYCLE' },
    });
    expect(konfigurasi.lastNumber).toBe(997);
    expect(await prisma.garage.count()).toBe(0);

    const hasil = await service.createBatch({ type: 'BICYCLE', quantity: '2', dailyPrice: '10000' });
    expect(hasil.firstId).toBe('S998');
    expect(hasil.lastId).toBe('S999');
  });
});

describe('GarageService.getTypeConfigs', () => {
  it('mengembalikan tiga tipe berurutan BICYCLE, CAR, ELECTRIC_CAR dengan harga bulanan dan kuota', async () => {
    await service.createBatch({ type: 'BICYCLE', quantity: '3', dailyPrice: '10000' });

    const konfigurasi = await service.getTypeConfigs();

    expect(konfigurasi.map((k) => k.code)).toEqual(['BICYCLE', 'CAR', 'ELECTRIC_CAR']);
    expect(konfigurasi[0]).toMatchObject({
      label: 'Sepeda',
      prefix: 'S',
      usesKwhPrice: false,
      dailyPrice: 10000,
      monthlyPrice: 250000,
      totalCreated: 3,
      remainingQuota: 996,
    });
    expect(konfigurasi[1].monthlyPrice).toBeNull();
    expect(konfigurasi[2]).toMatchObject({ usesKwhPrice: true, remainingQuota: 999 });
  });
});

describe('GarageService.listGarages', () => {
  it('mengurutkan menurut ID dan menghitung harga bulanan 25 x harian', async () => {
    await service.createBatch({
      type: 'ELECTRIC_CAR',
      quantity: '1',
      dailyPrice: '50000',
      pricePerKwh: '2500',
    });
    await service.createBatch({ type: 'BICYCLE', quantity: '2', dailyPrice: '10000' });

    const daftar = await service.listGarages();

    expect(daftar.map((g) => g.id)).toEqual(['E001', 'S001', 'S002']);
    expect(daftar[1]).toMatchObject({
      typeLabel: 'Sepeda',
      dailyPrice: 10000,
      monthlyPrice: 250000,
      pricePerKwh: null,
      status: 'AVAILABLE',
      statusLabel: 'tersedia',
    });
  });

  it('harga per kWh hanya muncul untuk Mobil Listrik', async () => {
    await service.createBatch({
      type: 'ELECTRIC_CAR',
      quantity: '1',
      dailyPrice: '50000',
      pricePerKwh: '2500',
    });
    await service.createBatch({ type: 'CAR', quantity: '1', dailyPrice: '30000' });

    const daftar = await service.listGarages();
    const listrik = daftar.find((g) => g.id === 'E001');
    const mobil = daftar.find((g) => g.id === 'C001');

    expect(listrik?.pricePerKwh).toBe(2500);
    expect(mobil?.pricePerKwh).toBeNull();
  });

  it('garasi berstatus USED berlabel "used"', async () => {
    await service.createBatch({ type: 'BICYCLE', quantity: '2', dailyPrice: '10000' });
    await prisma.garage.update({ where: { id: 'S002' }, data: { status: 'USED' } });

    const daftar = await service.listGarages();

    expect(daftar.find((g) => g.id === 'S001')?.statusLabel).toBe('tersedia');
    expect(daftar.find((g) => g.id === 'S002')?.statusLabel).toBe('used');
  });
});
