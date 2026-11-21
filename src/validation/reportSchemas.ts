/**
 * @file Skema validasi (Zod) untuk pilihan tahun dan bulan laporan beserta
 * pesan Bahasa Indonesia.
 */
import { z } from 'zod';
import { REPORT_MAX_YEAR, REPORT_MIN_YEAR } from '@/domain';

/** Pesan untuk tahun di luar rentang atau bukan bilangan bulat. */
const PESAN_TAHUN = `Tahun harus bilangan bulat ${REPORT_MIN_YEAR} sampai ${REPORT_MAX_YEAR}`;

/** Pesan untuk bulan di luar rentang atau bukan bilangan bulat. */
const PESAN_BULAN = 'Bulan harus bilangan bulat 1 sampai 12';

/** Aturan satu tahun laporan: bilangan bulat 2000 sampai 2100. */
const tahun = z.coerce
  .number({ error: PESAN_TAHUN })
  .int({ error: PESAN_TAHUN })
  .min(REPORT_MIN_YEAR, { error: PESAN_TAHUN })
  .max(REPORT_MAX_YEAR, { error: PESAN_TAHUN });

/** Aturan satu bulan laporan: bilangan bulat 1 sampai 12. */
const bulan = z.coerce
  .number({ error: PESAN_BULAN })
  .int({ error: PESAN_BULAN })
  .min(1, { error: PESAN_BULAN })
  .max(12, { error: PESAN_BULAN });

/** Skema laporan per bulan: hanya tahun. */
export const reportYearSchema = z.object({ year: tahun });

/** Skema laporan per hari: tahun dan bulan. */
export const reportMonthSchema = z.object({ year: tahun, month: bulan });

/** Masukan laporan per bulan yang sudah divalidasi. */
export type ReportYearInput = z.infer<typeof reportYearSchema>;

/** Masukan laporan per hari yang sudah divalidasi. */
export type ReportMonthInput = z.infer<typeof reportMonthSchema>;
