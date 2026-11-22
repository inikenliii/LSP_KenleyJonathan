/**
 * @file Tes layanan sewa (SEW-01 sampai SEW-09) pada database uji: sewa baru
 * membuat garasi menjadi used, balapan dua penyewa, beberapa sewa per penyewa,
 * pelepasan garasi kedaluwarsa, isolasi antar penyewa, dan berkas bukti bayar.
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  addDays,
  daysInMonth,
  maxDailyDays,
  toIsoDate,
  todayInJakarta,
} from '@/domain';
import { LocalPaymentProofStorage } from '@/lib/payment-proof-storage';
import { GarageRepository, RentalRepository } from '@/repositories';
import { GarageService, RentalService } from '@/services';
import { createTestPrisma, resetDatabase } from '../support/db';
import { insertUser } from '../support/users';

const prisma = createTestPrisma();
const garageService = new GarageService(new GarageRepository(prisma));

/** Folder sementara tempat bukti bayar uji disimpan. */
let proofDir: string;
let service: RentalService;
let renterA: number;
let renterB: number;

/** PNG kecil: tanda tangan 8 byte ditambah beberapa byte isi. */
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

beforeAll(async () => {
  proofDir = await mkdtemp(join(tmpdir(), 'bukti-'));
  service = new RentalService(new RentalRepository(prisma), new LocalPaymentProofStorage(proofDir));
});

beforeEach(async () => {
  await resetDatabase(prisma);
  await rm(proofDir, { recursive: true, force: true });
  await garageService.createBatch({ type: 'BICYCLE', quantity: '2', dailyPrice: '10000' });
  await garageService.createBatch({ type: 'CAR', quantity: '1', dailyPrice: '50000' });
  await garageService.createBatch({
    type: 'ELECTRIC_CAR',
    quantity: '1',
    dailyPrice: '80000',
    pricePerKwh: '2500',
  });
  renterA = await insertUser(prisma, {
    email: 'a@contoh.id',
    password: 'Rahasia123',
    role: 'RENTER',
    verificationStatus: 'ACCEPTED',
  });
  renterB = await insertUser(prisma, {
    email: 'b@contoh.id',
    password: 'Rahasia123',
    role: 'RENTER',
    verificationStatus: 'ACCEPTED',
  });
});

afterAll(async () => {
  await resetDatabase(prisma);
  await prisma.$disconnect();
  await rm(proofDir, { recursive: true, force: true });
});

/**
 * Membuat isian sewa yang sah untuk satu sepeda, lalu menimpa sebagian isian.
 *
 * @param override Isian yang menggantikan isian dasar.
 * @returns Isian formulir mentah untuk `createRental`.
 */
function isianSepeda(override: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    vehicleType: 'SEPEDA',
    vehicleBrand: 'Polygon',
    vehicleModel: 'Heist',
    rentalType: 'HARIAN',
    days: '3',
    garageType: 'BICYCLE',
    garageId: 'S001',
    paymentProof: PNG,
    ...override,
  };
}

/**
 * Menjalankan sewa dan mengembalikan error validasinya.
 *
 * @param input Isian formulir.
 * @returns Error validasi yang dilempar layanan.
 */
async function galatValidasi(input: Record<string, unknown>): Promise<ValidationError> {
  try {
    await service.createRental(renterA, input);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return error as ValidationError;
  }
  throw new Error('Seharusnya melempar ValidationError.');
}

/**
 * Membaca daftar berkas di folder bukti bayar uji.
 *
 * @returns Nama berkas; kosong bila folder belum ada.
 */
async function berkasBukti(): Promise<string[]> {
  try {
    return await readdir(proofDir);
  } catch {
    return [];
  }
}

describe('RentalService.createRental', () => {
  it('membuat sewa harian sepeda, garasi menjadi used, dan menyimpan satu berkas', async () => {
    const today = todayInJakarta();
    const sewa = await service.createRental(renterA, isianSepeda({ plateNumber: 'B 1234 XY' }));

    expect(sewa.garageId).toBe('S001');
    expect(sewa.totalCost).toBe(30000);

    const garasi = await prisma.garage.findUniqueOrThrow({ where: { id: 'S001' } });
    expect(garasi.status).toBe('USED');

    const baris = await prisma.rental.findFirstOrThrow({ where: { renterId: renterA } });
    expect(toIsoDate(baris.startDate)).toBe(toIsoDate(today));
    expect(toIsoDate(baris.endDate)).toBe(toIsoDate(addDays(today, 3)));
    expect(baris.totalCost).toBe(30000);
    expect(baris.dailyPrice).toBe(10000);
    expect(baris.plateNumber).toBeNull();

    const berkas = await berkasBukti();
    expect(berkas).toHaveLength(1);
    expect(berkas[0]).toBe(baris.paymentProofFile);

    const pilihan = await service.getNewRentalOptions();
    expect(pilihan.garages.map((g) => g.id)).toEqual(['C001', 'E001', 'S002']);
  });

  it('mobil listrik di garasi mobil listrik bulanan dikenai biaya (kapasitas - sisa) x harga per kWh', async () => {
    const today = todayInJakarta();
    await service.createRental(renterA, {
      vehicleType: 'MOBIL_LISTRIK',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'Ioniq 5',
      plateNumber: 'b 9 xyz',
      batteryKwh: '60',
      remainingKwh: '20',
      rentalType: 'BULANAN',
      days: '9',
      garageType: 'ELECTRIC_CAR',
      garageId: 'E001',
      paymentProof: PNG,
    });
    const baris = await prisma.rental.findFirstOrThrow({ where: { garageId: 'E001' } });
    expect(baris.totalCost).toBe(2100000);
    expect(baris.chargeCost).toBe(100000);
    expect(Number(baris.batteryKwh)).toBe(60);
    expect(Number(baris.remainingKwh)).toBe(20);
    expect(baris.pricePerKwh).toBe(2500);
    expect(baris.days).toBeNull();
    expect(baris.plateNumber).toBe('B 9 XYZ');
    expect(toIsoDate(baris.endDate)).toBe(toIsoDate(addDays(today, daysInMonth(today))));
  });

  it('mobil listrik di garasi mobil biasa tidak dikenai biaya pengisian', async () => {
    await service.createRental(renterA, {
      vehicleType: 'MOBIL_LISTRIK',
      vehicleBrand: 'Wuling',
      vehicleModel: 'Air ev',
      plateNumber: 'B 5 ABC',
      batteryKwh: '17,3',
      remainingKwh: '5,5',
      rentalType: 'HARIAN',
      days: '1',
      garageType: 'CAR',
      garageId: 'C001',
      paymentProof: PNG,
    });
    const baris = await prisma.rental.findFirstOrThrow({ where: { garageId: 'C001' } });
    expect(baris.totalCost).toBe(50000);
    expect(baris.chargeCost).toBe(0);
    expect(baris.pricePerKwh).toBeNull();
    expect(Number(baris.remainingKwh)).toBe(5.5);
  });

  it('sisa sama dengan kapasitas: biaya pengisian 0 dan harga per kWh tetap disimpan', async () => {
    await service.createRental(renterA, {
      vehicleType: 'MOBIL_LISTRIK',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'Ioniq 5',
      plateNumber: 'B 9 XYZ',
      batteryKwh: '60',
      remainingKwh: '60',
      rentalType: 'HARIAN',
      days: '2',
      garageType: 'ELECTRIC_CAR',
      garageId: 'E001',
      paymentProof: PNG,
    });
    const baris = await prisma.rental.findFirstOrThrow({ where: { garageId: 'E001' } });
    expect(baris.chargeCost).toBe(0);
    expect(baris.totalCost).toBe(160000);
    expect(baris.pricePerKwh).toBe(2500);
  });

  it('sisa 0 berarti diisi penuh', async () => {
    await service.createRental(renterA, {
      vehicleType: 'MOBIL_LISTRIK',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'Ioniq 5',
      plateNumber: 'B 9 XYZ',
      batteryKwh: '60',
      remainingKwh: '0',
      rentalType: 'BULANAN',
      garageType: 'ELECTRIC_CAR',
      garageId: 'E001',
      paymentProof: PNG,
    });
    const baris = await prisma.rental.findFirstOrThrow({ where: { garageId: 'E001' } });
    expect(baris.chargeCost).toBe(150000);
    expect(baris.totalCost).toBe(2150000);
  });

  it('sisa baterai pada kendaraan selain mobil listrik diabaikan dan tidak disimpan', async () => {
    await service.createRental(renterA, isianSepeda({ remainingKwh: '10', batteryKwh: '50' }));
    const baris = await prisma.rental.findFirstOrThrow({ where: { renterId: renterA } });
    expect(baris.batteryKwh).toBeNull();
    expect(baris.remainingKwh).toBeNull();
  });

  it('dua penyewa berebut satu garasi: tepat satu berhasil', async () => {
    const hasil = await Promise.allSettled([
      service.createRental(renterA, isianSepeda()),
      service.createRental(renterB, isianSepeda()),
    ]);
    const berhasil = hasil.filter((h) => h.status === 'fulfilled');
    const gagal = hasil.filter((h): h is PromiseRejectedResult => h.status === 'rejected');
    expect(berhasil).toHaveLength(1);
    expect(gagal).toHaveLength(1);
    expect(gagal[0].reason).toBeInstanceOf(ConflictError);
    expect((gagal[0].reason as ConflictError).message).toBe('Garasi sudah disewa, pilih garasi lain');

    expect(await prisma.rental.count()).toBe(1);
    expect(await berkasBukti()).toHaveLength(1);
  });

  it('satu penyewa boleh memegang beberapa sewa sekaligus, terbaru lebih dulu', async () => {
    await service.createRental(renterA, isianSepeda({ garageId: 'S001' }));
    await service.createRental(renterA, isianSepeda({ garageId: 'S002' }));
    const daftar = await service.listMyRentals(renterA);
    expect(daftar).toHaveLength(2);
    expect(daftar.map((s) => s.garageId)).toEqual(['S002', 'S001']);
    expect(daftar.every((s) => s.isActive && s.statusLabel === 'Aktif')).toBe(true);
  });

  it('sewa bulanan mengabaikan isian hari', async () => {
    await service.createRental(renterA, isianSepeda({ rentalType: 'BULANAN', days: '7' }));
    const baris = await prisma.rental.findFirstOrThrow();
    expect(baris.days).toBeNull();
    expect(baris.totalCost).toBe(250000);
  });
});

describe('isolasi penyewa dan akses bukti bayar', () => {
  it('penyewa lain tidak melihat sewa dan bukti bayar milik orang lain', async () => {
    const sewa = await service.createRental(renterA, isianSepeda());
    expect(await service.listMyRentals(renterB)).toEqual([]);

    await expect(
      service.getPaymentProof({ id: renterB, role: 'RENTER' }, sewa.id),
    ).rejects.toBeInstanceOf(NotFoundError);

    const milikSendiri = await service.getPaymentProof({ id: renterA, role: 'RENTER' }, sewa.id);
    expect(milikSendiri.contentType).toBe('image/png');
    expect(Array.from(milikSendiri.bytes)).toEqual(Array.from(PNG));

    const admin = await service.getPaymentProof({ id: 999999, role: 'ADMIN' }, sewa.id);
    expect(admin.contentType).toBe('image/png');
    expect(Array.from(admin.bytes)).toEqual(Array.from(PNG));
  });

  it('sewa yang tidak ada memberi NotFoundError', async () => {
    await expect(
      service.getPaymentProof({ id: renterA, role: 'RENTER' }, 12345),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('pelepasan garasi yang sewanya sudah berakhir', () => {
  it('garasi dengan sewa berakhir kemarin tersedia lagi, yang berakhir hari ini tetap used', async () => {
    const today = todayInJakarta();
    const sisipSewa = (garageId: string, endDate: Date) =>
      prisma.rental.create({
        data: {
          renterId: renterA,
          garageId,
          vehicleType: 'SEPEDA',
          vehicleBrand: 'Polygon',
          vehicleModel: 'Heist',
          rentalType: 'HARIAN',
          days: 1,
          startDate: addDays(endDate, -1),
          endDate,
          dailyPrice: 10000,
          totalCost: 10000,
          paymentProofFile: 'tidak-dipakai.png',
        },
      });
    await prisma.garage.updateMany({ where: { id: { in: ['S001', 'S002'] } }, data: { status: 'USED' } });
    await sisipSewa('S001', addDays(today, -1));
    await sisipSewa('S002', today);

    const pilihan = await service.getNewRentalOptions();
    const ids = pilihan.garages.map((g) => g.id);
    expect(ids).toContain('S001');
    expect(ids).not.toContain('S002');

    expect((await prisma.garage.findUniqueOrThrow({ where: { id: 'S001' } })).status).toBe('AVAILABLE');
    expect((await prisma.garage.findUniqueOrThrow({ where: { id: 'S002' } })).status).toBe('USED');
  });
});

describe('bukti pembayaran tidak sah', () => {
  /**
   * Memastikan tidak ada sewa, garasi tetap tersedia, dan tidak ada berkas.
   */
  async function pastikanTidakAdaYangTersimpan(): Promise<void> {
    expect(await prisma.rental.count()).toBe(0);
    expect((await prisma.garage.findUniqueOrThrow({ where: { id: 'S001' } })).status).toBe('AVAILABLE');
    expect(await berkasBukti()).toHaveLength(0);
  }

  it('menolak bukti yang tidak diunggah', async () => {
    const galat = await galatValidasi(isianSepeda({ paymentProof: undefined }));
    expect(galat.fieldErrors.paymentProof[0]).toBe('Bukti pembayaran wajib diunggah');
    await pastikanTidakAdaYangTersimpan();
  });

  it('menolak berkas yang bukan gambar JPEG, PNG, atau WebP', async () => {
    const galat = await galatValidasi(
      isianSepeda({ paymentProof: new TextEncoder().encode('ini hanya teks biasa') }),
    );
    expect(galat.fieldErrors.paymentProof[0]).toBe('Bukti pembayaran harus gambar JPEG, PNG, atau WebP');
    await pastikanTidakAdaYangTersimpan();
  });

  it('menolak gambar lebih dari 2 MB', async () => {
    const besar = new Uint8Array(2 * 1024 * 1024 + 1);
    besar.set(PNG);
    const galat = await galatValidasi(isianSepeda({ paymentProof: besar }));
    expect(galat.fieldErrors.paymentProof[0]).toBe('Ukuran bukti pembayaran paling besar 2 MB');
    await pastikanTidakAdaYangTersimpan();
  });
});

describe('aturan kendaraan dan garasi', () => {
  it('sepeda tidak boleh di garasi mobil', async () => {
    const galat = await galatValidasi(isianSepeda({ garageType: 'CAR', garageId: 'C001' }));
    expect(galat.fieldErrors.garageType).toBeDefined();
  });

  it('tipe garasi BICYCLE dengan ID C001 ditolak di field garageId', async () => {
    const galat = await galatValidasi(isianSepeda({ garageId: 'C001' }));
    expect(galat.fieldErrors.garageId).toBeDefined();
    expect(await prisma.rental.count()).toBe(0);
  });

  it('garasi yang tidak ada ditolak di field garageId', async () => {
    const galat = await galatValidasi(isianSepeda({ garageId: 'S999' }));
    expect(galat.fieldErrors.garageId).toBeDefined();
  });

  it('mobil tanpa plat ditolak', async () => {
    const galat = await galatValidasi(
      isianSepeda({ vehicleType: 'MOBIL', garageType: 'CAR', garageId: 'C001' }),
    );
    expect(galat.fieldErrors.plateNumber[0]).toBe('Nomor plat wajib diisi');
  });

  it('mobil listrik tanpa kapasitas baterai ditolak', async () => {
    const galat = await galatValidasi(
      isianSepeda({
        vehicleType: 'MOBIL_LISTRIK',
        plateNumber: 'B 1 A',
        remainingKwh: '10',
        garageType: 'ELECTRIC_CAR',
        garageId: 'E001',
      }),
    );
    expect(galat.fieldErrors.batteryKwh).toBeDefined();
  });

  it('mobil listrik tanpa sisa baterai ditolak', async () => {
    const galat = await galatValidasi(
      isianSepeda({
        vehicleType: 'MOBIL_LISTRIK',
        plateNumber: 'B 1 A',
        batteryKwh: '60',
        garageType: 'ELECTRIC_CAR',
        garageId: 'E001',
      }),
    );
    expect(galat.fieldErrors.remainingKwh[0]).toBe('Sisa baterai wajib diisi untuk mobil listrik');
  });

  it('sisa baterai melebihi kapasitas ditolak di field remainingKwh', async () => {
    const galat = await galatValidasi(
      isianSepeda({
        vehicleType: 'MOBIL_LISTRIK',
        plateNumber: 'B 1 A',
        batteryKwh: '60',
        remainingKwh: '60,1',
        garageType: 'ELECTRIC_CAR',
        garageId: 'E001',
      }),
    );
    expect(galat.fieldErrors.remainingKwh[0]).toBe(
      'Sisa baterai tidak boleh melebihi kapasitas baterai',
    );
    expect(await prisma.rental.count()).toBe(0);
  });

  it.each(['-5', 'abc', '10,55', '1e2'])('sisa baterai "%s" ditolak', async (sisa) => {
    const galat = await galatValidasi(
      isianSepeda({
        vehicleType: 'MOBIL_LISTRIK',
        plateNumber: 'B 1 A',
        batteryKwh: '60',
        remainingKwh: sisa,
        garageType: 'ELECTRIC_CAR',
        garageId: 'E001',
      }),
    );
    expect(galat.fieldErrors.remainingKwh).toBeDefined();
  });

  it('sewa harian melebihi batas hari bulan ini ditolak', async () => {
    const batas = maxDailyDays(todayInJakarta());
    const galat = await galatValidasi(isianSepeda({ days: String(batas + 1) }));
    expect(galat.fieldErrors.days).toBeDefined();
  });

  it('sewa harian tanpa jumlah hari ditolak', async () => {
    const galat = await galatValidasi(isianSepeda({ days: undefined }));
    expect(galat.fieldErrors.days).toBeDefined();
  });

  it('isian dari klien untuk penyewa, harga, dan tanggal diabaikan', async () => {
    await service.createRental(
      renterA,
      isianSepeda({ renterId: renterB, totalCost: 1, dailyPrice: 1, endDate: '2000-01-01' }),
    );
    const baris = await prisma.rental.findFirstOrThrow();
    expect(baris.renterId).toBe(renterA);
    expect(baris.totalCost).toBe(30000);
    expect(toIsoDate(baris.startDate)).toBe(toIsoDate(todayInJakarta()));
  });
});

describe('RentalService.createRental: tanggal mulai dipilih penyewa', () => {
  /** Jam tetap: 22 November 2026 pukul 10.00 WIB, sehingga "hari ini" menurut server 2026-11-22. */
  const JAM_TETAP = new Date('2026-11-22T03:00:00Z');

  /**
   * Membuat layanan sewa dengan jam tetap.
   *
   * @param sekarang Waktu yang dipakai layanan.
   * @returns Layanan sewa dengan penyimpanan bukti uji.
   */
  function layananDenganJam(sekarang: Date): RentalService {
    return new RentalService(
      new RentalRepository(prisma),
      new LocalPaymentProofStorage(proofDir),
      () => sekarang,
    );
  }

  /**
   * Memastikan tidak ada sewa tersimpan, garasi S001 tetap tersedia, dan tidak ada berkas.
   */
  async function pastikanTidakAdaYangTersimpan(): Promise<void> {
    expect(await prisma.rental.count()).toBe(0);
    expect((await prisma.garage.findUniqueOrThrow({ where: { id: 'S001' } })).status).toBe(
      'AVAILABLE',
    );
    expect(await berkasBukti()).toHaveLength(0);
  }

  /**
   * Menjalankan sewa dengan layanan tertentu dan mengembalikan error validasinya.
   *
   * @param layanan Layanan sewa yang dipakai.
   * @param override Isian yang menimpa isian dasar.
   * @returns Error validasi yang dilempar layanan.
   */
  async function galatValidasiDengan(
    layanan: RentalService,
    override: Record<string, unknown>,
  ): Promise<ValidationError> {
    try {
      await layanan.createRental(renterA, isianSepeda(override));
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      return error as ValidationError;
    }
    throw new Error('Seharusnya melempar ValidationError.');
  }

  it('menawarkan batas tanggal mulai: hari ini sampai satu tahun ke depan', async () => {
    const pilihan = await layananDenganJam(JAM_TETAP).getNewRentalOptions();
    expect(pilihan.today).toBe('2026-11-22');
    expect(pilihan.maxStartDate).toBe('2027-11-22');
  });

  it('menerima tanggal mulai hari ini', async () => {
    const layanan = layananDenganJam(JAM_TETAP);
    const sewa = await layanan.createRental(renterA, isianSepeda({ startDate: '2026-11-22' }));
    expect(sewa.startDate).toBe('2026-11-22');
    expect(sewa.endDate).toBe('2026-11-25');
    expect(sewa.statusLabel).toBe('Aktif');
  });

  it('tanpa tanggal mulai, memakai hari ini menurut server', async () => {
    const layanan = layananDenganJam(JAM_TETAP);
    const sewa = await layanan.createRental(renterA, isianSepeda());
    expect(sewa.startDate).toBe('2026-11-22');
  });

  it('menerima tanggal mulai besok: harian dihitung dari tanggal itu, garasi langsung used', async () => {
    const layanan = layananDenganJam(JAM_TETAP);
    const sewa = await layanan.createRental(renterA, isianSepeda({ startDate: '2026-11-23' }));

    expect(sewa.startDate).toBe('2026-11-23');
    expect(sewa.endDate).toBe('2026-11-26');
    expect(sewa.totalCost).toBe(30000);
    expect(sewa.statusLabel).toBe('Belum mulai');
    expect(sewa.isActive).toBe(true);

    const baris = await prisma.rental.findFirstOrThrow({ where: { renterId: renterA } });
    expect(toIsoDate(baris.startDate)).toBe('2026-11-23');
    expect(toIsoDate(baris.endDate)).toBe('2026-11-26');
    expect((await prisma.garage.findUniqueOrThrow({ where: { id: 'S001' } })).status).toBe('USED');

    // Garasi untuk masa depan tidak ditawarkan kepada penyewa lain.
    const pilihan = await layanan.getNewRentalOptions();
    expect(pilihan.garages.map((g) => g.id)).not.toContain('S001');
    await expect(
      layanan.createRental(renterB, isianSepeda({ startDate: '2026-12-20' })),
    ).rejects.toBeInstanceOf(ConflictError);

    // Sewa yang belum mulai tampil dengan status "Belum mulai" di daftar penyewa.
    const daftar = await layanan.listMyRentals(renterA);
    expect(daftar[0].statusLabel).toBe('Belum mulai');
  });

  it('harian yang melewati batas bulan dan tahun dihitung dari tanggal mulai', async () => {
    const layanan = layananDenganJam(JAM_TETAP);
    const akhirBulan = await layanan.createRental(
      renterA,
      isianSepeda({ garageId: 'S001', startDate: '2026-11-30', days: '5' }),
    );
    expect(akhirBulan.endDate).toBe('2026-12-05');

    const akhirTahun = await layanan.createRental(
      renterA,
      isianSepeda({ garageId: 'S002', startDate: '2026-12-31', days: '2' }),
    );
    expect(akhirTahun.endDate).toBe('2027-01-02');
  });

  it('bulanan memakai jumlah hari bulan tanggal mulai (30, 31, 28 hari)', async () => {
    const layanan = layananDenganJam(JAM_TETAP);
    const kasus: Array<[string, string, string]> = [
      ['S001', '2026-11-30', '2026-12-30'], // November 30 hari
      ['S002', '2026-12-31', '2027-01-31'], // Desember 31 hari
      ['C001', '2027-02-10', '2027-03-10'], // Februari 28 hari
    ];
    for (const [garageId, mulai, akhir] of kasus) {
      const mobil = garageId === 'C001';
      const sewa = await layanan.createRental(
        renterA,
        isianSepeda({
          rentalType: 'BULANAN',
          days: undefined,
          vehicleType: mobil ? 'MOBIL' : 'SEPEDA',
          plateNumber: mobil ? 'B 1 A' : undefined,
          garageType: mobil ? 'CAR' : 'BICYCLE',
          garageId,
          startDate: mulai,
        }),
      );
      expect(sewa.startDate).toBe(mulai);
      expect(sewa.endDate).toBe(akhir);
    }
  });

  it('mulai Februari tahun kabisat: bulanan 29 hari, harian maksimal 28 hari', async () => {
    const layanan = layananDenganJam(new Date('2028-01-15T03:00:00Z'));
    const bulanan = await layanan.createRental(
      renterA,
      isianSepeda({ rentalType: 'BULANAN', days: undefined, startDate: '2028-02-10' }),
    );
    expect(bulanan.endDate).toBe('2028-03-10');
    expect(bulanan.totalCost).toBe(250000);

    const harian = await layanan.createRental(
      renterA,
      isianSepeda({ garageId: 'S002', startDate: '2028-02-10', days: '28' }),
    );
    expect(harian.endDate).toBe('2028-03-09');
    expect(harian.totalCost).toBe(280000);

    const galat = await galatValidasiDengan(layanan, { startDate: '2028-02-10', days: '29' });
    expect(galat.fieldErrors.days?.[0]).toBe('Jumlah hari maksimal 28 untuk bulan mulai sewa');
  });

  it('batas hari harian mengikuti bulan tanggal mulai, bukan bulan hari ini', async () => {
    const layanan = layananDenganJam(JAM_TETAP); // November: batas bila mulai hari ini 29
    // Februari 2027 (28 hari): 27 boleh, 28 ditolak.
    const galat = await galatValidasiDengan(layanan, { startDate: '2027-02-10', days: '28' });
    expect(galat.fieldErrors.days?.[0]).toBe('Jumlah hari maksimal 27 untuk bulan mulai sewa');
    await pastikanTidakAdaYangTersimpan();

    const sewa = await layanan.createRental(
      renterA,
      isianSepeda({ startDate: '2027-02-10', days: '27' }),
    );
    expect(sewa.endDate).toBe('2027-03-09');
    expect(sewa.totalCost).toBe(270000);

    // Desember (31 hari): 30 hari boleh walau bulan hari ini hanya mengizinkan 29.
    const desember = await layanan.createRental(
      renterA,
      isianSepeda({ garageId: 'S002', startDate: '2026-12-01', days: '30' }),
    );
    expect(desember.endDate).toBe('2026-12-31');
  });

  it('menolak tanggal mulai kemarin (server memakai hari ini sendiri)', async () => {
    const galat = await galatValidasiDengan(layananDenganJam(JAM_TETAP), {
      startDate: '2026-11-21',
    });
    expect(galat.fieldErrors.startDate?.[0]).toBe('Tanggal mulai tidak boleh sebelum hari ini');
    await pastikanTidakAdaYangTersimpan();
  });

  it('mengikuti tanggal Jakarta: pukul 00.30 WIB sudah hari berikutnya', async () => {
    // 21 November 17:30 UTC = 22 November 00:30 WIB.
    const layanan = layananDenganJam(new Date('2026-11-21T17:30:00Z'));
    const galat = await galatValidasiDengan(layanan, { startDate: '2026-11-21' });
    expect(galat.fieldErrors.startDate).toBeDefined();
    const sewa = await layanan.createRental(renterA, isianSepeda({ startDate: '2026-11-22' }));
    expect(sewa.startDate).toBe('2026-11-22');
  });

  it('menerima tepat satu tahun ke depan, menolak lebih dari itu', async () => {
    const layanan = layananDenganJam(JAM_TETAP);
    const galat = await galatValidasiDengan(layanan, { startDate: '2027-11-23' });
    expect(galat.fieldErrors.startDate?.[0]).toBe(
      'Tanggal mulai paling jauh satu tahun dari hari ini',
    );
    await pastikanTidakAdaYangTersimpan();

    const sewa = await layanan.createRental(renterA, isianSepeda({ startDate: '2027-11-22' }));
    expect(sewa.startDate).toBe('2027-11-22');
  });

  it('menolak format tanggal yang tidak sah', async () => {
    const layanan = layananDenganJam(JAM_TETAP);
    for (const salah of ['23-11-2026', '2026-02-30', 'besok', '2026-11-23T00:00:00Z']) {
      const galat = await galatValidasiDengan(layanan, { startDate: salah });
      expect(galat.fieldErrors.startDate?.[0]).toBe('Tanggal mulai harus tanggal yang sah');
    }
    await pastikanTidakAdaYangTersimpan();
  });
});
