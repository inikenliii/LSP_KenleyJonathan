/**
 * @file Tes layanan perpanjangan sewa (PER-01 sampai PER-04) pada database uji:
 * daftar sewa aktif, perpanjangan harian dan bulanan dengan sisa biaya dari server,
 * riwayat, penolakan jumlah dan bukti tidak sah, balapan dua Admin, dan akses bukti bayar.
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
  computeEndDate,
  countAdditionalDays,
  daysInMonth,
  maxExtensionDays,
  parseIsoDate,
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
 * @param extensionType Jenis perpanjangan (HARIAN atau BULANAN).
 * @param quantity Jumlah hari atau bulan.
 * @param override Isian yang menggantikan atau menambah isian dasar.
 * @returns Isian formulir mentah untuk `extendRental`.
 */
function isianPerpanjangan(
  extensionType: string | undefined,
  quantity: number | string | undefined,
  override: Record<string, unknown> = {},
): Record<string, unknown> {
  return { rentalId: String(rentalId), extensionType, quantity, paymentProof: PNG, ...override };
}

/**
 * Membuat sewa bulanan mobil listrik E001 (harga harian 80000) milik penyewa A.
 *
 * @returns Id sewa.
 */
async function buatSewaListrik(): Promise<number> {
  const sewa = await rentalService.createRental(renterA, {
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
  return sewa.id;
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
      maxExtensionDays: maxExtensionDays(addDays(today, 3)),
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
  it('perpanjangan harian: tanggal berakhir pindah, jenis, jumlah, dan biaya tersimpan, garasi tetap used', async () => {
    const today = todayInJakarta();
    const hasil = await service.extendRental(admin1, isianPerpanjangan('HARIAN', 7));
    expect(hasil.extensionType).toBe('HARIAN');
    expect(hasil.extensionTypeLabel).toBe('Harian');
    expect(hasil.quantity).toBe(7);
    expect(hasil.quantityLabel).toBe('7 hari');
    expect(hasil.additionalDays).toBe(7);
    expect(hasil.dailyPrice).toBe(10000);
    expect(hasil.amount).toBe(70000);
    expect(hasil.adminName).toBe('Admin Uji');
    expect(hasil.newEndDate).toBe(toIsoDate(addDays(today, 10)));

    const sewa = await prisma.rental.findUniqueOrThrow({ where: { id: rentalId } });
    expect(toIsoDate(sewa.endDate)).toBe(toIsoDate(addDays(today, 10)));
    const baris = await prisma.rentalExtension.findMany();
    expect(baris).toHaveLength(1);
    expect(baris[0].extensionType).toBe('HARIAN');
    expect(baris[0].quantity).toBe(7);
    expect(baris[0].additionalDays).toBe(7);
    expect(baris[0].amount).toBe(70000);
    expect(toIsoDate(baris[0].previousEndDate)).toBe(toIsoDate(addDays(today, 3)));
    expect(toIsoDate(baris[0].newEndDate)).toBe(toIsoDate(addDays(today, 10)));
    expect(baris[0].adminId).toBe(admin1);
    expect((await prisma.garage.findUniqueOrThrow({ where: { id: 'S001' } })).status).toBe('USED');

    const milikA = await rentalService.listMyRentals(renterA);
    expect(milikA[0].endDate).toBe(toIsoDate(addDays(today, 10)));
    expect(await berkasBukti()).toHaveLength(2);
  });

  it('perpanjangan bulanan: tiap bulan memakai hari bulan tempat langkahnya dimulai, biaya 25 x harga harian per bulan', async () => {
    const today = todayInJakarta();
    const akhirLama = addDays(today, 3);
    const bulanPertama = computeEndDate(akhirLama, 'BULANAN');
    const akhirBaru = computeEndDate(bulanPertama, 'BULANAN');

    const hasil = await service.extendRental(admin1, isianPerpanjangan('BULANAN', 2));
    expect(hasil.extensionType).toBe('BULANAN');
    expect(hasil.quantity).toBe(2);
    expect(hasil.quantityLabel).toBe('2 bulan');
    expect(hasil.newEndDate).toBe(toIsoDate(akhirBaru));
    expect(hasil.additionalDays).toBe(countAdditionalDays(akhirLama, akhirBaru));
    expect(hasil.amount).toBe(2 * 25 * 10000);

    const baris = await prisma.rentalExtension.findFirstOrThrow();
    expect(baris.extensionType).toBe('BULANAN');
    expect(baris.quantity).toBe(2);
    expect(baris.amount).toBe(500000);
    const sewa = await prisma.rental.findUniqueOrThrow({ where: { id: rentalId } });
    expect(toIsoDate(sewa.endDate)).toBe(toIsoDate(akhirBaru));
    expect((await prisma.garage.findUniqueOrThrow({ where: { id: 'S001' } })).status).toBe('USED');
  });

  it('perpanjangan kedua memakai tanggal berakhir terbaru dan riwayat berurut dari yang lama', async () => {
    const today = todayInJakarta();
    await service.extendRental(admin1, isianPerpanjangan('HARIAN', 5));
    const kedua = await service.extendRental(admin2, isianPerpanjangan('BULANAN', 1));
    const akhirKedua = computeEndDate(addDays(today, 8), 'BULANAN');
    expect(kedua.previousEndDate).toBe(toIsoDate(addDays(today, 8)));
    expect(kedua.newEndDate).toBe(toIsoDate(akhirKedua));
    expect(kedua.amount).toBe(250000);

    const detail = await service.getRentalExtensions(rentalId);
    expect(detail.rental.endDate).toBe(toIsoDate(akhirKedua));
    expect(detail.extensions.map((e) => e.quantityLabel)).toEqual(['5 hari', '1 bulan']);
    expect(detail.extensions.map((e) => e.extensionTypeLabel)).toEqual(['Harian', 'Bulanan']);
    expect(detail.extensions.map((e) => e.adminName)).toEqual(['Admin Uji', 'Admin Dua']);
    expect(detail.extensions.every((e) => e.createdAtLabel.length > 0)).toBe(true);
  });

  it('sewa mobil listrik: perpanjangan bulanan tanpa biaya pengisian, memakai harga harian milik sewa', async () => {
    const bulanan = await buatSewaListrik();
    const hasil = await service.extendRental(admin1, {
      rentalId: String(bulanan),
      extensionType: 'BULANAN',
      quantity: '1',
      paymentProof: PNG,
    });
    expect(hasil.dailyPrice).toBe(80000);
    expect(hasil.amount).toBe(2000000);
    expect(hasil.additionalDays).toBe(daysInMonth(parseIsoDate(hasil.previousEndDate)));
  });

  it('mengabaikan isian yang dikirim klien untuk nilai yang dihitung server', async () => {
    const today = todayInJakarta();
    const hasil = await service.extendRental(
      admin1,
      isianPerpanjangan('HARIAN', 7, {
        amount: '1',
        additionalDays: '99',
        previousEndDate: '2000-01-01',
        newEndDate: '2099-01-01',
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
    expect(toIsoDate(baris.newEndDate)).toBe(toIsoDate(addDays(today, 10)));
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

  it('menolak jumlah hari harian 0 dan lebih dari batas bulan tanggal berakhir', async () => {
    const batas = maxExtensionDays(addDays(todayInJakarta(), 3));
    for (const jumlah of [0, batas + 1]) {
      const galat = await galatValidasi(isianPerpanjangan('HARIAN', jumlah));
      expect(galat.fieldErrors.quantity).toEqual([
        `Jumlah hari perpanjangan harus bilangan bulat 1 sampai ${batas}.`,
      ]);
    }
    await pastikanTidakBerubah();
  });

  it('menolak jumlah bulan 0 dan 1201, serta jumlah negatif, desimal, kosong, dan bukan angka', async () => {
    for (const jumlah of [0, 1201]) {
      const galat = await galatValidasi(isianPerpanjangan('BULANAN', jumlah));
      expect(galat.fieldErrors.quantity).toEqual([
        'Jumlah bulan perpanjangan harus bilangan bulat 1 sampai 1200.',
      ]);
    }
    for (const jumlah of ['-1', '1.5', 'abc']) {
      const galat = await galatValidasi(isianPerpanjangan('BULANAN', jumlah));
      expect(galat.fieldErrors.quantity).toEqual(['Jumlah harus bilangan bulat positif']);
    }
    const kosong = await galatValidasi(isianPerpanjangan('BULANAN', undefined));
    expect(kosong.fieldErrors.quantity).toEqual(['Jumlah wajib diisi']);
    await pastikanTidakBerubah();
  });

  it('menolak jenis perpanjangan yang tidak dikenal atau kosong', async () => {
    for (const jenis of ['MINGGUAN', undefined]) {
      const galat = await galatValidasi(isianPerpanjangan(jenis, 2));
      expect(galat.fieldErrors.extensionType).toEqual(['Pilih jenis perpanjangan']);
    }
    await pastikanTidakBerubah();
  });

  it('menolak hasil yang terlalu jauh dengan pesan di kolom jumlah, tanpa menyimpan apa pun', async () => {
    const listrik = await buatSewaListrik();
    const galat = await galatValidasi({
      rentalId: String(listrik),
      extensionType: 'BULANAN',
      quantity: '1200',
      paymentProof: PNG,
    });
    expect(galat.fieldErrors.quantity).toEqual(['Tanggal selesai baru terlalu jauh']);
    const sewa = await prisma.rental.findUniqueOrThrow({ where: { id: listrik } });
    expect(sewa.endDate.getTime()).toBe(
      computeEndDate(todayInJakarta(), 'BULANAN').getTime(),
    );
    expect(await prisma.rentalExtension.count()).toBe(0);
    expect(await berkasBukti()).toHaveLength(2);
  });

  it('menolak isian tanpa id sewa', async () => {
    const galat = await galatValidasi(isianPerpanjangan('HARIAN', 5, { rentalId: undefined }));
    expect(galat.fieldErrors.rentalId).toBeDefined();
    await pastikanTidakBerubah();
  });

  it('menolak sewa yang sudah berakhir dan sewa yang tidak ada', async () => {
    const today = todayInJakarta();
    const berakhir = await sisipSewa('S002', addDays(today, -3), addDays(today, -1));
    const galatBerakhir = await service
      .extendRental(admin1, isianPerpanjangan('HARIAN', 5, { rentalId: String(berakhir) }))
      .catch((error: unknown) => error);
    expect(galatBerakhir).toBeInstanceOf(ConflictError);
    expect((galatBerakhir as ConflictError).message).toBe(
      'Sewa sudah berakhir dan tidak bisa diperpanjang',
    );

    const galatTidakAda = await service
      .extendRental(admin1, isianPerpanjangan('HARIAN', 5, { rentalId: '999999' }))
      .catch((error: unknown) => error);
    expect(galatTidakAda).toBeInstanceOf(NotFoundError);
    expect((galatTidakAda as NotFoundError).message).toBe('Sewa tidak ditemukan.');

    expect(await prisma.rentalExtension.count()).toBe(0);
    expect(await berkasBukti()).toHaveLength(1);
  });

  it('dua Admin memperpanjang sewa yang sama bersamaan: tepat satu berhasil', async () => {
    const input = isianPerpanjangan('HARIAN', 5);
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
    const kosong = await galatValidasi(isianPerpanjangan('HARIAN', 10, { paymentProof: undefined }));
    expect(kosong.fieldErrors.paymentProof[0]).toBe('Bukti pembayaran wajib diunggah');

    const teks = await galatValidasi(
      isianPerpanjangan('HARIAN', 10, {
        paymentProof: new TextEncoder().encode('ini hanya teks biasa'),
      }),
    );
    expect(teks.fieldErrors.paymentProof[0]).toBe('Bukti pembayaran harus gambar JPEG, PNG, atau WebP');

    const besar = new Uint8Array(2 * 1024 * 1024 + 1);
    besar.set(PNG);
    const terlaluBesar = await galatValidasi(
      isianPerpanjangan('HARIAN', 10, { paymentProof: besar }),
    );
    expect(terlaluBesar.fieldErrors.paymentProof[0]).toBe('Ukuran bukti pembayaran paling besar 2 MB');

    await pastikanTidakBerubah();
  });
});

describe('RentalExtensionService.getExtensionProof', () => {
  it('bukti perpanjangan terbuka bagi pemilik sewa dan Admin, tertutup bagi penyewa lain', async () => {
    const perpanjangan = await service.extendRental(admin1, isianPerpanjangan('HARIAN', 7));

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
