/**
 * @file Layanan laporan sewa: laporan per bulan, per hari, per tipe garasi, dan
 * per penyewa. Tahun dan bulan divalidasi sebelum repository dipanggil.
 */
import {
  MONTH_NAMES,
  reportByDay,
  reportByGarageType,
  reportByMonth,
  reportByRenter,
  reportDateRange,
  toAppError,
  todayInJakarta,
  type RentalReport,
} from '@/domain';
import type { IReportRepository } from '@/repositories';
import { parseInput, reportMonthSchema, reportYearSchema } from '@/validation';

/** Tahun dan bulan berjalan di Jakarta. */
export interface ReportPeriod {
  /** Tahun, misalnya 2026. */
  year: number;
  /** Bulan 1 sampai 12. */
  month: number;
}

/** Laporan per bulan untuk satu tahun. */
export interface MonthlyReportView {
  /** Tahun laporan. */
  year: number;
  /** Isi laporan. */
  report: RentalReport;
}

/** Laporan per hari untuk satu bulan. */
export interface DailyReportView {
  /** Tahun laporan. */
  year: number;
  /** Bulan laporan 1 sampai 12. */
  month: number;
  /** Nama bulan dalam Bahasa Indonesia. */
  monthLabel: string;
  /** Isi laporan. */
  report: RentalReport;
}

/** Kontrak layanan laporan sewa. */
export interface IReportService {
  /**
   * Tahun dan bulan berjalan di Jakarta.
   *
   * @returns Periode berjalan.
   */
  currentPeriod(): ReportPeriod;

  /**
   * Laporan per bulan pada satu tahun.
   *
   * @param input Tahun dari alamat; kosong berarti tahun berjalan.
   * @returns Tahun dan laporan 12 bulan.
   * @throws {ValidationError} Bila tahun bukan bilangan bulat 2000 sampai 2100.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  getMonthlyReport(input: { year?: unknown }): Promise<MonthlyReportView>;

  /**
   * Laporan per hari pada satu bulan.
   *
   * @param input Tahun dan bulan dari alamat; kosong berarti bulan berjalan.
   * @returns Tahun, bulan, dan laporan satu baris per tanggal.
   * @throws {ValidationError} Bila tahun atau bulan tidak sah.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  getDailyReport(input: { year?: unknown; month?: unknown }): Promise<DailyReportView>;

  /**
   * Laporan per tipe garasi sepanjang waktu.
   *
   * @returns Laporan tiga baris.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  getGarageTypeReport(): Promise<RentalReport>;

  /**
   * Laporan per penyewa sepanjang waktu.
   *
   * @returns Laporan satu baris per penyewa yang punya sewa.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  getRenterReport(): Promise<RentalReport>;
}

/**
 * Mengubah isian kosong atau spasi saja menjadi tidak diisi agar memakai nilai bawaan.
 *
 * @param nilai Isian dari alamat; selain teks (kosong atau parameter berulang) dianggap tidak diisi.
 * @param bawaan Nilai bawaan.
 * @returns Isian yang dipangkas, atau nilai bawaan bila kosong atau bukan teks.
 */
export function atauBawaan(nilai: unknown, bawaan: number): string {
  const teks = typeof nilai === 'string' ? nilai.trim() : '';
  return teks === '' ? String(bawaan) : teks;
}

/** Menyusun laporan sewa. Repository dan jam diterima lewat konstruktor. */
export class ReportService implements IReportService {
  /**
   * @param reports Repository laporan.
   * @param clock Sumber waktu; bawaannya jam sistem.
   */
  constructor(
    private readonly reports: IReportRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * Tahun dan bulan berjalan di Jakarta.
   *
   * @returns Periode berjalan.
   */
  currentPeriod(): ReportPeriod {
    const hariIni = todayInJakarta(this.clock());
    return { year: hariIni.getUTCFullYear(), month: hariIni.getUTCMonth() + 1 };
  }

  /**
   * Laporan per bulan pada satu tahun.
   *
   * @param input Tahun dari alamat; kosong berarti tahun berjalan.
   * @returns Tahun dan laporan 12 bulan.
   * @throws {ValidationError} Bila tahun bukan bilangan bulat 2000 sampai 2100.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async getMonthlyReport(input: { year?: unknown }): Promise<MonthlyReportView> {
    const { year } = parseInput(reportYearSchema, {
      year: atauBawaan(input.year, this.currentPeriod().year),
    });
    try {
      const sewa = await this.reports.findRentals(reportDateRange(year));
      return { year, report: reportByMonth(sewa, year) };
    } catch (error) {
      throw toAppError(error);
    }
  }

  /**
   * Laporan per hari pada satu bulan.
   *
   * @param input Tahun dan bulan dari alamat; kosong berarti bulan berjalan.
   * @returns Tahun, bulan, dan laporan satu baris per tanggal.
   * @throws {ValidationError} Bila tahun atau bulan tidak sah.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async getDailyReport(input: { year?: unknown; month?: unknown }): Promise<DailyReportView> {
    const sekarang = this.currentPeriod();
    const { year, month } = parseInput(reportMonthSchema, {
      year: atauBawaan(input.year, sekarang.year),
      month: atauBawaan(input.month, sekarang.month),
    });
    try {
      const sewa = await this.reports.findRentals(reportDateRange(year, month));
      return { year, month, monthLabel: MONTH_NAMES[month - 1], report: reportByDay(sewa, year, month) };
    } catch (error) {
      throw toAppError(error);
    }
  }

  /**
   * Laporan per tipe garasi sepanjang waktu.
   *
   * @returns Laporan tiga baris.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async getGarageTypeReport(): Promise<RentalReport> {
    try {
      return reportByGarageType(await this.reports.findRentals(null));
    } catch (error) {
      throw toAppError(error);
    }
  }

  /**
   * Laporan per penyewa sepanjang waktu.
   *
   * @returns Laporan satu baris per penyewa yang punya sewa.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async getRenterReport(): Promise<RentalReport> {
    try {
      return reportByRenter(await this.reports.findRentals(null));
    } catch (error) {
      throw toAppError(error);
    }
  }
}
