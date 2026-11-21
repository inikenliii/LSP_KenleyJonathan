/**
 * @file Tes layanan perpanjangan sewa (PER-01 sampai PER-04) pada database uji:
 * daftar sewa aktif, perpanjangan dengan sisa biaya dari server, riwayat,
 * penolakan tanggal dan bukti tidak sah, balapan dua Admin, dan akses bukti bayar.
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
  toIsoDate,
  todayInJakarta,
} from '@/domain';
import { LocalPaymentProofStorage } from '@/lib/payment-proof-storage';
import { GarageRepository, RentalExtensionRepository, RentalRepository } from '@/repositories';
import { GarageService, RentalExtensionService, RentalService } from '@/services';
import { createTestPrisma, resetDatabase } from '../support/db';
import { insertUser } from '../support/users';

const prisma = createTestPrisma();
const garageService = new GarageService(new GarageRepository(prisma));

/** Folder sementara tempat bukti bayar uji disimpan (dipakai bersama oleh sewa dan perpanjangan). */
let proofDir: string;
let rentalService: RentalService;
let service: RentalExtensionService;
let admin1: number;
let admin2: number;
let renterA: number;
let renterB: number;

/** PNG kecil: tanda tangan 8 byte ditambah beberapa byte isi. */
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

/** Id sewa S001 milik penyewa A (harian 3 hari) yang dibuat sebelum tiap tes. */
let rentalId: number;

beforeAll(async () => {
  proofDir = await mkdtemp(join(tmpdir(), 'perpanjangan-'));
  const storage = new LocalPaymentProofStorage(proofDir);
  rentalService = new RentalService(new RentalRepository(prisma), storage);
  service = new RentalExtensionService(new RentalExtensionRepository(prisma), storage);
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
  admin1 = await insertUser(prisma, {
    email: 'admin1@contoh.id',
    password: 'Rahasia123',
    role: 'ADMIN',
    verificationStatus: 'ACCEPTED',
    fullName: 'Admin Uji',
  });
  admin2 = await insertUser(prisma, {
    email: 'admin2@contoh.id',
    password: 'Rahasia123',
    role: 'ADMIN',
    verificationStatus: 'ACCEPTED',
    fullName: 'Admin Dua',
  });
  renterA = await insertUser(prisma, {
    email: 'a@contoh.id',
    password: 'Rahasia123',
    role: 'RENTER',
    verificationStatus: 'ACCEPTED',
    fullName: 'Penyewa A',
  });
  renterB = await insertUser(prisma, {
    email: 'b@contoh.id',
    password: 'Rahasia123',
    role: 'RENTER',
    verificationStatus: 'ACCEPTED',
    fullName: 'Penyewa B',
  });
  const sewa = await rentalService.createRental(renterA, isianSepeda());
  rentalId = sewa.id;
});

afterAll(async () => {
  await resetDatabase(prisma);
  await prisma.$disconnect();
  await rm(proofDir, { recursive: true, force: true });
});

/**
 * Membuat isian sewa sepeda yang sah (S001, harian 3 hari).
 *
 * @returns Isian formulir mentah untuk `RentalService.createRental`.
 */
function isianSepeda(): Record<string, unknown> {
  return {
    vehicleType: 'SEPEDA',
    vehicleBrand: 'Polygon',
    vehicleModel: 'Heist',
    rentalType: 'HARIAN',
    days: '3',
    garageType: 'BICYCLE',
    garageId: 'S001',
    paymentProof: PNG,
  };
}

/**
 * Membuat isian perpanjangan yang sah untuk sewa uji.
 *
 * @param newEndDate Tanggal selesai baru, `YYYY-MM-DD`.
 * @param override Isian yang menggantikan atau menambah isian dasar.
 * @returns Isian formulir mentah untuk `extendRental`.
 */
function isianPerpanjangan(
  newEndDate: string,
  override: Record<string, unknown> = {},
): Record<string, unknown> {
  return { rentalId: String(rentalId), newEndDate, paymentProof: PNG, ...override };
}

/**
 * Menjalankan perpanjangan dan mengembalikan error validasinya.
 *
 * @param input Isian formulir.
 * @returns Error validasi yang dilempar layanan.
 */
async function galatValidasi(input: Record<string, unknown>): Promise<ValidationError> {
  try {
    await service.extendRental(admin1, input);
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

/**
 * Menyisipkan sewa langsung ke database uji (untuk sewa yang sudah berakhir atau belum mulai).
 *
 * @param garageId ID garasi.
 * @param startDate Tanggal mulai.
 * @param endDate Tanggal berakhir.
 * @returns Id sewa.
 */
async function sisipSewa(garageId: string, startDate: Date, endDate: Date): Promise<number> {
  const baris = await prisma.rental.create({
    data: {
      renterId: renterA,
      garageId,
      vehicleType: 'SEPEDA',
      vehicleBrand: 'Polygon',
      vehicleModel: 'Heist',
      rentalType: 'HARIAN',
      days: 1,
      startDate,
      endDate,
      dailyPrice: 10000,
      totalCost: 10000,
      paymentProofFile: 'tidak-dipakai.png',
    },
  });
  return baris.id;
}

describe('RentalExtensionService.listActiveRentals', () => {
  it('menampilkan sewa yang aktif hari ini lengkap dengan label', async () => {
    const today = todayInJakarta();
    const daftar = await service.listActiveRentals();
    expect(daftar).toHaveLength(1);
    expect(daftar[0]).toMatchObject({
      id: rentalId,
      garageId: 'S001',
      garageTypeLabel: 'Sepeda',
      renterName: 'Penyewa A',
      rentalTypeLabel: 'Harian',
      endDate: toIsoDate(addDays(today, 3)),
      dailyPrice: 10000,
      isActive: true,
      minNewEndDate: toIsoDate(addDays(today, 4)),
    });
  });

  it('urut menurut ID garasi', async () => {
    await rentalService.createRental(renterA, {
      vehicleType: 'MOBIL',
      vehicleBrand: 'Toyota',
      vehicleModel: 'Avanza',
      plateNumber: 'B 1 ABC',
      rentalType: 'HARIAN',
      days: '2',
      garageType: 'CAR',
      garageId: 'C001',
      paymentProof: PNG,
    });
    const daftar = await service.listActiveRentals();
    expect(daftar.map((s) => s.garageId)).toEqual(['C001', 'S001']);
  });

  it('tidak menampilkan sewa yang sudah berakhir atau baru mulai besok', async () => {
    const today = todayInJakarta();
    await sisipSewa('S002', addDays(today, -3), addDays(today, -1));
    await sisipSewa('C001', addDays(today, 1), addDays(today, 4));
    const daftar = await service.listActiveRentals();
    expect(daftar.map((s) => s.garageId)).toEqual(['S001']);
  });

  it('menampilkan sewa yang berakhir hari ini', async () => {
    const today = todayInJakarta();
    await sisipSewa('S002', addDays(today, -1), today);
    const daftar = await service.listActiveRentals();
    expect(daftar.map((s) => s.garageId)).toEqual(['S001', 'S002']);
  });
});

describe('RentalExtensionService.extendRental', () => {
  it('memperpanjang sewa: tanggal berakhir pindah, riwayat tersimpan, garasi tetap used', async () => {
    const today = todayInJakarta();
    const hasil = await service.extendRental(
      admin1,
      isianPerpanjangan(toIsoDate(addDays(today, 10))),
    );
    expect(hasil.additionalDays).toBe(7);
    expect(hasil.dailyPrice).toBe(10000);
    expect(hasil.amount).toBe(70000);
    expect(hasil.adminName).toBe('Admin Uji');

    const sewa = await prisma.rental.findUniqueOrThrow({ where: { id: rentalId } });
    expect(toIsoDate(sewa.endDate)).toBe(toIsoDate(addDays(today, 10)));
    const baris = await prisma.rentalExtension.findMany();
    expect(baris).toHaveLength(1);
    expect(toIsoDate(baris[0].previousEndDate)).toBe(toIsoDate(addDays(today, 3)));
    expect(toIsoDate(baris[0].newEndDate)).toBe(toIsoDate(addDays(today, 10)));
    expect(baris[0].adminId).toBe(admin1);
    expect((await prisma.garage.findUniqueOrThrow({ where: { id: 'S001' } })).status).toBe('USED');

    const milikA = await rentalService.listMyRentals(renterA);
    expect(milikA[0].endDate).toBe(toIsoDate(addDays(today, 10)));
    expect(await berkasBukti()).toHaveLength(2);
  });

  it('perpanjangan kedua memakai tanggal berakhir terbaru dan riwayat berurut dari yang lama', async () => {
    const today = todayInJakarta();
    await service.extendRental(admin1, isianPerpanjangan(toIsoDate(addDays(today, 10))));
    const kedua = await service.extendRental(
      admin2,
      isianPerpanjangan(toIsoDate(addDays(today, 12))),
    );
    expect(kedua.previousEndDate).toBe(toIsoDate(addDays(today, 10)));
    expect(kedua.additionalDays).toBe(2);

    const detail = await service.getRentalExtensions(rentalId);
    expect(detail.rental.endDate).toBe(toIsoDate(addDays(today, 12)));
    expect(detail.extensions.map((e) => e.newEndDate)).toEqual([
      toIsoDate(addDays(today, 10)),
      toIsoDate(addDays(today, 12)),
    ]);
    expect(detail.extensions.map((e) => e.adminName)).toEqual(['Admin Uji', 'Admin Dua']);
    expect(detail.extensions.every((e) => e.createdAtLabel.length > 0)).toBe(true);
  });

  it('sewa bulanan: sisa biaya = hari x harga harian, tanpa biaya pengisian dan bukan 25 x harga', async () => {
    const today = todayInJakarta();
    const bulanan = await rentalService.createRental(renterA, {
      vehicleType: 'MOBIL_LISTRIK',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'Ioniq 5',
      plateNumber: 'B 9 XYZ',
      batteryKwh: '60',
      remainingKwh: '20',
      rentalType: 'BULANAN',
      garageType: 'ELECTRIC_CAR',
      garageId: 'E001',
      paymentProof: PNG,
    });
    const akhir = addDays(today, daysInMonth(today));
    const hasil = await service.extendRental(admin1, {
      rentalId: String(bulanan.id),
      newEndDate: toIsoDate(addDays(akhir, 31)),
      paymentProof: PNG,
    });
    expect(hasil.additionalDays).toBe(31);
    expect(hasil.dailyPrice).toBe(80000);
    expect(hasil.amount).toBe(2480000);
  });

  it('mengabaikan isian yang dikirim klien untuk nilai yang dihitung server', async () => {
    const today = todayInJakarta();
    const hasil = await service.extendRental(
      admin1,
      isianPerpanjangan(toIsoDate(addDays(today, 10)), {
        amount: '1',
        additionalDays: '99',
        previousEndDate: '2000-01-01',
        dailyPrice: '1',
        adminId: String(renterB),
      }),
    );
    expect(hasil.amount).toBe(70000);
    expect(hasil.additionalDays).toBe(7);
    const baris = await prisma.rentalExtension.findFirstOrThrow();
    expect(baris.amount).toBe(70000);
    expect(baris.adminId).toBe(admin1);
    expect(toIsoDate(baris.previousEndDate)).toBe(toIsoDate(addDays(today, 3)));
  });

  /**
   * Memastikan tidak ada yang berubah: tanggal berakhir sama, tanpa riwayat, satu berkas.
   */
  async function pastikanTidakBerubah(): Promise<void> {
    const today = todayInJakarta();
    const sewa = await prisma.rental.findUniqueOrThrow({ where: { id: rentalId } });
    expect(toIsoDate(sewa.endDate)).toBe(toIsoDate(addDays(today, 3)));
    expect(await prisma.rentalExtension.count()).toBe(0);
    expect(await berkasBukti()).toHaveLength(1);
  }

  it('menolak tanggal baru yang sama atau lebih awal dari tanggal berakhir saat ini', async () => {
    const today = todayInJakarta();
    for (const tanggal of [addDays(today, 3), addDays(today, 2)]) {
      const galat = await galatValidasi(isianPerpanjangan(toIsoDate(tanggal)));
      expect(galat.fieldErrors.newEndDate).toEqual([
        'Tanggal selesai baru harus setelah tanggal selesai saat ini',
      ]);
    }
    await pastikanTidakBerubah();
  });

  it('menolak tanggal yang tidak ada di kalender atau salah format', async () => {
    for (const tanggal of ['2026-02-30', '30-11-2026']) {
      const galat = await galatValidasi(isianPerpanjangan(tanggal));
      expect(galat.fieldErrors.newEndDate).toEqual(['Tanggal selesai baru tidak valid']);
    }
    await pastikanTidakBerubah();
  });

  it('menolak isian tanpa id sewa', async () => {
    const today = todayInJakarta();
    const galat = await galatValidasi(
      isianPerpanjangan(toIsoDate(addDays(today, 10)), { rentalId: undefined }),
    );
    expect(galat.fieldErrors.rentalId).toBeDefined();
    await pastikanTidakBerubah();
  });

  it('menolak sewa yang sudah berakhir dan sewa yang tidak ada', async () => {
    const today = todayInJakarta();
    const berakhir = await sisipSewa('S002', addDays(today, -3), addDays(today, -1));
    const galatBerakhir = await service
      .extendRental(
        admin1,
        isianPerpanjangan(toIsoDate(addDays(today, 5)), { rentalId: String(berakhir) }),
      )
      .catch((error: unknown) => error);
    expect(galatBerakhir).toBeInstanceOf(ConflictError);
    expect((galatBerakhir as ConflictError).message).toBe(
      'Sewa sudah berakhir dan tidak bisa diperpanjang',
    );

    const galatTidakAda = await service
      .extendRental(
        admin1,
        isianPerpanjangan(toIsoDate(addDays(today, 5)), { rentalId: '999999' }),
      )
      .catch((error: unknown) => error);
    expect(galatTidakAda).toBeInstanceOf(NotFoundError);
    expect((galatTidakAda as NotFoundError).message).toBe('Sewa tidak ditemukan.');

    expect(await prisma.rentalExtension.count()).toBe(0);
    expect(await berkasBukti()).toHaveLength(1);
  });

  it('dua Admin memperpanjang sewa yang sama bersamaan: tepat satu berhasil', async () => {
    const today = todayInJakarta();
    const input = isianPerpanjangan(toIsoDate(addDays(today, 5)));
    const hasil = await Promise.allSettled([
      service.extendRental(admin1, input),
      service.extendRental(admin2, input),
    ]);
    const berhasil = hasil.filter((h) => h.status === 'fulfilled');
    const gagal = hasil.filter((h): h is PromiseRejectedResult => h.status === 'rejected');
    expect(berhasil).toHaveLength(1);
    expect(gagal).toHaveLength(1);
    expect(gagal[0].reason).toBeInstanceOf(ConflictError);
    expect((gagal[0].reason as ConflictError).message).toBe(
      'Sewa sudah berubah atau berakhir, muat ulang halaman',
    );

    expect(await prisma.rentalExtension.count()).toBe(1);
    expect(await berkasBukti()).toHaveLength(2);
  });

  it('menolak bukti pembayaran yang tidak sah tanpa mengubah apa pun', async () => {
    const today = todayInJakarta();
    const tanggal = toIsoDate(addDays(today, 10));

    const kosong = await galatValidasi(isianPerpanjangan(tanggal, { paymentProof: undefined }));
    expect(kosong.fieldErrors.paymentProof[0]).toBe('Bukti pembayaran wajib diunggah');

    const teks = await galatValidasi(
      isianPerpanjangan(tanggal, { paymentProof: new TextEncoder().encode('ini hanya teks biasa') }),
    );
    expect(teks.fieldErrors.paymentProof[0]).toBe('Bukti pembayaran harus gambar JPEG, PNG, atau WebP');

    const besar = new Uint8Array(2 * 1024 * 1024 + 1);
    besar.set(PNG);
    const terlaluBesar = await galatValidasi(isianPerpanjangan(tanggal, { paymentProof: besar }));
    expect(terlaluBesar.fieldErrors.paymentProof[0]).toBe('Ukuran bukti pembayaran paling besar 2 MB');

    await pastikanTidakBerubah();
  });
});

describe('RentalExtensionService.getExtensionProof', () => {
  it('bukti perpanjangan terbuka bagi pemilik sewa dan Admin, tertutup bagi penyewa lain', async () => {
    const today = todayInJakarta();
    const perpanjangan = await service.extendRental(
      admin1,
      isianPerpanjangan(toIsoDate(addDays(today, 10))),
    );

    const milikSendiri = await service.getExtensionProof(
      { id: renterA, role: 'RENTER' },
      perpanjangan.id,
    );
    expect(milikSendiri.contentType).toBe('image/png');
    expect(Array.from(milikSendiri.bytes)).toEqual(Array.from(PNG));

    const admin = await service.getExtensionProof({ id: admin2, role: 'ADMIN' }, perpanjangan.id);
    expect(admin.contentType).toBe('image/png');
    expect(Array.from(admin.bytes)).toEqual(Array.from(PNG));

    await expect(
      service.getExtensionProof({ id: renterB, role: 'RENTER' }, perpanjangan.id),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      service.getExtensionProof({ id: admin1, role: 'ADMIN' }, 987654),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
