/**
 * @file Tes layanan laporan (LAP-01 sampai LAP-04) pada database uji: total
 * keempat laporan untuk data contoh, penolakan tahun dan bulan yang tidak sah
 * tanpa menjalankan kueri, dan periode berjalan dari jam yang diinjeksikan.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ValidationError, parseIsoDate, type ReportDateRange, type ReportRental } from '@/domain';
import { GarageRepository, ReportRepository, type IReportRepository } from '@/repositories';
import { GarageService, ReportService } from '@/services';
import { atauBawaan } from '@/services/ReportService';
import { createTestPrisma, resetDatabase } from '../support/db';
import { insertUser } from '../support/users';

const prisma = createTestPrisma();
const garageService = new GarageService(new GarageRepository(prisma));

/** Layanan laporan dengan jam tetap 21 November 2026 (Jakarta). */
const service = new ReportService(new ReportRepository(prisma), () => new Date('2026-11-21T03:00:00Z'));

let budi: number;
let citra: number;
let admin: number;

beforeAll(async () => {
  await resetDatabase(prisma);
});

beforeEach(async () => {
  await resetDatabase(prisma);
  await garageService.createBatch({ type: 'BICYCLE', quantity: '1', dailyPrice: '10000' });
  await garageService.createBatch({ type: 'CAR', quantity: '1', dailyPrice: '50000' });
  await garageService.createBatch({
    type: 'ELECTRIC_CAR',
    quantity: '1',
    dailyPrice: '80000',
    pricePerKwh: '2500',
  });
  budi = await insertUser(prisma, {
    email: 'budi@contoh.id',
    password: 'Rahasia123',
    role: 'RENTER',
    verificationStatus: 'ACCEPTED',
    fullName: 'Budi',
  });
  citra = await insertUser(prisma, {
    email: 'citra@contoh.id',
    password: 'Rahasia123',
    role: 'RENTER',
    verificationStatus: 'ACCEPTED',
    fullName: 'Citra',
  });
  await insertUser(prisma, {
    email: 'dewi@contoh.id',
    password: 'Rahasia123',
    role: 'RENTER',
    verificationStatus: 'ACCEPTED',
    fullName: 'Dewi',
  });
  admin = await insertUser(prisma, {
    email: 'admin@contoh.id',
    password: 'Rahasia123',
    role: 'ADMIN',
    verificationStatus: 'ACCEPTED',
    fullName: 'Admin Uji',
  });
  await sisipData();
});

afterAll(async () => {
  await resetDatabase(prisma);
  await prisma.$disconnect();
});

/**
 * Menyisipkan satu sewa langsung ke database uji; total biaya disimpan apa adanya.
 *
 * @param renterId Id penyewa.
 * @param garageId ID garasi.
 * @param start Tanggal mulai `YYYY-MM-DD`.
 * @param totalCost Total biaya sewa.
 * @returns Id sewa.
 */
async function sisipSewa(renterId: number, garageId: string, start: string, totalCost: number): Promise<number> {
  const mulai = parseIsoDate(start);
  const baris = await prisma.rental.create({
    data: {
      renterId,
      garageId,
      vehicleType: garageId.startsWith('S') ? 'SEPEDA' : garageId.startsWith('E') ? 'MOBIL_LISTRIK' : 'MOBIL',
      vehicleBrand: 'Merek',
      vehicleModel: 'Model',
      rentalType: 'HARIAN',
      days: 1,
      startDate: mulai,
      endDate: parseIsoDate(start),
      dailyPrice: 10000,
      totalCost,
      paymentProofFile: 'tidak-dipakai.png',
    },
  });
  return baris.id;
}

/**
 * Menyisipkan satu perpanjangan langsung ke database uji.
 *
 * @param rentalId Id sewa.
 * @param amount Sisa biaya perpanjangan.
 */
async function sisipPerpanjangan(rentalId: number, amount: number): Promise<void> {
  await prisma.rentalExtension.create({
    data: {
      rentalId,
      previousEndDate: parseIsoDate('2026-01-01'),
      newEndDate: parseIsoDate('2026-01-02'),
      additionalDays: 1,
      dailyPrice: amount,
      amount,
      paymentProofFile: 'tidak-dipakai.png',
      adminId: admin,
    },
  });
}

/** Menyisipkan lima sewa contoh dan perpanjangannya. */
async function sisipData(): Promise<void> {
  const satu = await sisipSewa(budi, 'S001', '2026-01-15', 30000);
  await sisipPerpanjangan(satu, 20000);
  await sisipSewa(citra, 'C001', '2026-01-31', 1250000);
  const tiga = await sisipSewa(budi, 'E001', '2026-11-21', 2150000);
  await sisipPerpanjangan(tiga, 80000);
  await sisipPerpanjangan(tiga, 160000);
  await sisipSewa(citra, 'S001', '2025-12-31', 10000);
  await sisipSewa(budi, 'C001', '2028-02-29', 50000);
}

describe('ReportService.getMonthlyReport', () => {
  it('menjumlahkan sewa per bulan pada tahun yang dipilih, termasuk perpanjangan', async () => {
    const tampilan = await service.getMonthlyReport({ year: '2026' });
    const { report } = tampilan;
    expect(tampilan.year).toBe(2026);
    expect(report.rows).toHaveLength(12);
    expect(report.rows[0]).toMatchObject({ label: 'Januari 2026', count: 2, amount: 1300000 });
    expect(report.rows[10]).toMatchObject({ label: 'November 2026', count: 1, amount: 2390000 });
    const lain = report.rows.filter((_, indeks) => indeks !== 0 && indeks !== 10);
    expect(lain.every((baris) => baris.count === 0 && baris.amount === 0)).toBe(true);
    expect(report.totalCount).toBe(3);
    expect(report.totalAmount).toBe(3690000);
  });

  it('memakai tahun jam bila tahun kosong', async () => {
    const tampilan = await service.getMonthlyReport({});
    expect(tampilan.year).toBe(2026);
    expect(tampilan.report.totalAmount).toBe(3690000);
  });
});

describe('ReportService.getDailyReport', () => {
  it('Februari kabisat 2028 punya 29 baris dan 29 Februari terisi', async () => {
    const tampilan = await service.getDailyReport({ year: '2028', month: '2' });
    expect(tampilan.report.rows).toHaveLength(29);
    expect(tampilan.report.rows[28]).toMatchObject({ count: 1, amount: 50000 });
    expect(tampilan.report.totalAmount).toBe(50000);
  });

  it('Januari 2026 memuat tanggal 15 dan 31', async () => {
    const tampilan = await service.getDailyReport({ year: '2026', month: '1' });
    expect(tampilan.report.rows).toHaveLength(31);
    expect(tampilan.report.rows[14]).toMatchObject({ count: 1, amount: 50000 });
    expect(tampilan.report.rows[30]).toMatchObject({ count: 1, amount: 1250000 });
  });

  it('memakai bulan jam (November 2026) bila isian kosong', async () => {
    const tampilan = await service.getDailyReport({});
    expect(tampilan.monthLabel).toBe('November');
    expect(tampilan.report.rows).toHaveLength(30);
    expect(tampilan.report.rows[20]).toMatchObject({ count: 1, amount: 2390000 });
  });
});

describe('ReportService.getGarageTypeReport', () => {
  it('menjumlahkan sewa per tipe garasi sepanjang waktu', async () => {
    const laporan = await service.getGarageTypeReport();
    expect(laporan.rows.map((baris) => [baris.label, baris.count, baris.amount])).toEqual([
      ['Sepeda', 2, 60000],
      ['Mobil', 2, 1300000],
      ['Mobil Listrik', 1, 2390000],
    ]);
    expect(laporan.totalCount).toBe(5);
    expect(laporan.totalAmount).toBe(3750000);
  });
});

describe('ReportService.getRenterReport', () => {
  it('menjumlahkan sewa per penyewa dan tidak memuat penyewa tanpa sewa', async () => {
    const laporan = await service.getRenterReport();
    expect(laporan.rows.map((baris) => [baris.label, baris.detail, baris.count, baris.amount])).toEqual([
      ['Budi', 'budi@contoh.id', 3, 2490000],
      ['Citra', 'citra@contoh.id', 2, 1260000],
    ]);
    expect(laporan.totalAmount).toBe(3750000);
  });
});

describe('ReportService, isian tidak sah', () => {
  /**
   * Repository palsu yang hanya mencatat pemanggilannya.
   *
   * @param panggilan Daftar tempat mencatat rentang yang diminta.
   * @returns Repository palsu.
   */
  function repositoryPalsu(panggilan: Array<ReportDateRange | null>): IReportRepository {
    return {
      async findRentals(range: ReportDateRange | null): Promise<ReportRental[]> {
        panggilan.push(range);
        return [];
      },
    };
  }

  it('menolak tahun 1999 dan abc dengan pesan pada kolom tahun', async () => {
    const panggilan: Array<ReportDateRange | null> = [];
    const palsu = new ReportService(repositoryPalsu(panggilan));
    for (const year of ['1999', 'abc']) {
      const galat = await palsu.getMonthlyReport({ year }).catch((error: unknown) => error);
      expect(galat).toBeInstanceOf(ValidationError);
      expect((galat as ValidationError).fieldErrors.year).toEqual(['Tahun harus bilangan bulat 2000 sampai 2100']);
    }
    expect(panggilan).toHaveLength(0);
  });

  it('menolak bulan 13 dengan pesan pada kolom bulan dan tanpa kueri', async () => {
    const panggilan: Array<ReportDateRange | null> = [];
    const palsu = new ReportService(repositoryPalsu(panggilan));
    const galat = await palsu.getDailyReport({ year: '2026', month: '13' }).catch((error: unknown) => error);
    expect(galat).toBeInstanceOf(ValidationError);
    expect((galat as ValidationError).fieldErrors.month).toEqual(['Bulan harus bilangan bulat 1 sampai 12']);
    expect(panggilan).toHaveLength(0);
  });
});

describe('parameter alamat berulang atau kosong', () => {
  it('atauBawaan memakai nilai bawaan untuk larik, undefined, dan teks kosong tanpa error', () => {
    expect(atauBawaan(['2026', '2027'], 2025)).toBe('2025');
    expect(atauBawaan(undefined, 2025)).toBe('2025');
    expect(atauBawaan('   ', 2025)).toBe('2025');
    expect(atauBawaan(' 2027 ', 2025)).toBe('2027');
  });

  it('laporan bulanan dan harian tidak error bila tahun atau bulan berupa larik', async () => {
    const palsu = new ReportService(
      { findRentals: async (): Promise<ReportRental[]> => [] },
      () => new Date('2026-11-21T03:00:00Z'),
    );
    const bulanan = await palsu.getMonthlyReport({ year: ['2026', '2027'] });
    expect(bulanan.year).toBe(2026);
    const harian = await palsu.getDailyReport({ year: ['2026', '2027'], month: ['3', '4'] });
    expect(harian.year).toBe(2026);
    expect(harian.month).toBe(11);
  });
});

describe('ReportService.currentPeriod', () => {
  it('memberi tahun dan bulan dari jam di Jakarta', () => {
    expect(service.currentPeriod()).toEqual({ year: 2026, month: 11 });
  });
});
