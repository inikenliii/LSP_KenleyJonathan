/**
 * @file Kontrak akses data untuk laporan sewa.
 */
import type { ReportDateRange, ReportRental } from '@/domain';

/** Kontrak pembacaan sewa untuk laporan. */
export interface IReportRepository {
  /**
   * Membaca sewa beserta jumlah biaya perpanjangannya.
   *
   * @param range Rentang tanggal mulai yang diminta (batas akhir tidak termasuk); null berarti semua waktu.
   * @returns Sewa urut menurut tanggal mulai lalu id.
   */
  findRentals(range: ReportDateRange | null): Promise<ReportRental[]>;
}
