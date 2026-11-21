/**
 * @file Repository laporan: hanya membaca sewa beserta biaya perpanjangannya.
 *
 * Pengelompokan, pengisian baris nol, dan penjumlahan dikerjakan fungsi domain
 * murni, bukan SQL, sehingga aturannya bisa diuji tanpa database.
 */
import type { ReportDateRange, ReportRental } from '@/domain';
import type { PrismaClient } from '@/generated/client';
import type { IReportRepository } from './IReportRepository';

/** Implementasi IReportRepository dengan Prisma. */
export class ReportRepository implements IReportRepository {
  /**
   * @param prisma Klien Prisma.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Membaca sewa pada rentang tanggal mulai dengan kolom seperlunya saja:
   * tanggal mulai, total biaya, tipe garasi, nama dan email penyewa, serta
   * jumlah setiap perpanjangan.
   *
   * @param range Rentang tanggal mulai (batas akhir tidak termasuk); null berarti semua waktu.
   * @returns Sewa urut menurut tanggal mulai lalu id.
   */
  async findRentals(range: ReportDateRange | null): Promise<ReportRental[]> {
    const baris = await this.prisma.rental.findMany({
      where: range === null ? undefined : { startDate: { gte: range.from, lt: range.to } },
      select: {
        startDate: true,
        totalCost: true,
        renterId: true,
        garage: { select: { type: true } },
        renter: { select: { fullName: true, email: true } },
        extensions: { select: { amount: true } },
      },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    });
    return baris.map((sewa) => ({
      startDate: sewa.startDate,
      garageType: sewa.garage.type,
      renterId: sewa.renterId,
      renterName: sewa.renter.fullName,
      renterEmail: sewa.renter.email,
      totalCost: sewa.totalCost,
      extensionAmounts: sewa.extensions.map((perpanjangan) => perpanjangan.amount),
    }));
  }
}
