import type { Metadata } from 'next';
import Link from 'next/link';
import { ReportTable } from '@/components/reports/ReportTable';
import { FadeIn } from '@/components/motion/FadeIn';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  MONTH_NAMES,
  REPORT_MAX_YEAR,
  REPORT_MIN_YEAR,
  ValidationError,
  type RentalReport,
} from '@/domain';
import { requireRole } from '@/lib/auth/dal';
import { reportService } from '@/lib/container';

/** Judul tab halaman laporan. */
export const metadata: Metadata = { title: 'Laporan Penyewaan' };

/** Empat tampilan laporan: nilai parameter `jenis` dan labelnya, urut seperti di tombol. */
const TAMPILAN = [
  { jenis: 'bulan', label: 'Per Bulan' },
  { jenis: 'hari', label: 'Per Hari' },
  { jenis: 'tipe', label: 'Per Tipe Garasi' },
  { jenis: 'penyewa', label: 'Per Penyewa' },
] as const;

/** Kelas tampilan pilihan bulan agar serupa dengan kotak isian. */
const KELAS_PILIHAN =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30';

/** Teks pengganti tabel bila isian tahun atau bulan tidak sah. */
const PESAN_PERBAIKI = 'Perbaiki isian di atas untuk menampilkan laporan.';

/**
 * Halaman Laporan: satu halaman dengan empat tampilan (per bulan, per hari,
 * per tipe garasi, per penyewa) yang dipilih lewat tautan. Tahun dan bulan
 * dipilih lewat formulir GET biasa; isian yang tidak sah memunculkan pesan
 * di samping kolom dan tidak menjalankan kueri.
 *
 * @param props.searchParams Parameter alamat `jenis` (bulan, hari, tipe, penyewa), `tahun`, dan `bulan`.
 * @returns Judul, pilihan tampilan, formulir periode (bila perlu), dan tabel laporan.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ jenis?: string; tahun?: string; bulan?: string }>;
}) {
  await requireRole('ADMIN');
  const { jenis: jenisMentah, tahun, bulan } = await searchParams;
  const jenis = TAMPILAN.find((tampilan) => tampilan.jenis === jenisMentah)?.jenis ?? 'bulan';
  const periode = reportService.currentPeriod();

  let galat: Record<string, string[]> = {};
  let judul = '';
  let labelKolom = '';
  let laporan: RentalReport | null = null;
  try {
    if (jenis === 'bulan') {
      const tampilan = await reportService.getMonthlyReport({ year: tahun });
      judul = `Laporan per Bulan Tahun ${tampilan.year}`;
      labelKolom = 'Bulan';
      laporan = tampilan.report;
    } else if (jenis === 'hari') {
      const tampilan = await reportService.getDailyReport({ year: tahun, month: bulan });
      judul = `Laporan per Hari ${tampilan.monthLabel} ${tampilan.year}`;
      labelKolom = 'Tanggal';
      laporan = tampilan.report;
    } else if (jenis === 'tipe') {
      judul = 'Laporan per Tipe Garasi (semua waktu)';
      labelKolom = 'Tipe Garasi';
      laporan = await reportService.getGarageTypeReport();
    } else {
      judul = 'Laporan per Penyewa (semua waktu)';
      labelKolom = 'Penyewa';
      laporan = await reportService.getRenterReport();
    }
  } catch (error) {
    if (!(error instanceof ValidationError)) {
      throw error;
    }
    galat = error.fieldErrors;
  }

  const pakaiPeriode = jenis === 'bulan' || jenis === 'hari';

  return (
    <FadeIn>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Laporan Penyewaan</h1>

        <nav aria-label="Pilihan laporan" className="flex flex-wrap gap-2">
          {TAMPILAN.map((tampilan) => (
            <Link
              key={tampilan.jenis}
              href={`/admin/laporan?jenis=${tampilan.jenis}`}
              aria-current={tampilan.jenis === jenis ? 'page' : undefined}
              className={buttonVariants({
                variant: tampilan.jenis === jenis ? 'default' : 'outline',
                size: 'sm',
              })}
            >
              {tampilan.label}
            </Link>
          ))}
        </nav>

        {pakaiPeriode && (
          <form method="get" action="/admin/laporan" className="flex flex-wrap items-end gap-4">
            <input type="hidden" name="jenis" value={jenis} />
            <Field data-invalid={galat.year?.[0] ? true : undefined} className="w-40">
              <FieldLabel htmlFor="tahun">Tahun</FieldLabel>
              <Input
                id="tahun"
                name="tahun"
                type="number"
                min={REPORT_MIN_YEAR}
                max={REPORT_MAX_YEAR}
                defaultValue={tahun ?? periode.year}
                aria-invalid={galat.year?.[0] ? true : undefined}
              />
              {galat.year?.[0] && <FieldError>{galat.year[0]}</FieldError>}
            </Field>
            {jenis === 'hari' && (
              <Field data-invalid={galat.month?.[0] ? true : undefined} className="w-48">
                <FieldLabel htmlFor="bulan">Bulan</FieldLabel>
                <select
                  id="bulan"
                  name="bulan"
                  className={KELAS_PILIHAN}
                  defaultValue={bulan ?? String(periode.month)}
                  aria-invalid={galat.month?.[0] ? true : undefined}
                >
                  {MONTH_NAMES.map((nama, indeks) => (
                    <option key={nama} value={indeks + 1}>
                      {nama}
                    </option>
                  ))}
                </select>
                {galat.month?.[0] && <FieldError>{galat.month[0]}</FieldError>}
              </Field>
            )}
            <Button type="submit">Tampilkan</Button>
          </form>
        )}

        {laporan === null ? (
          <p className="text-muted-foreground">{PESAN_PERBAIKI}</p>
        ) : (
          <ReportTable
            title={judul}
            labelHeading={labelKolom}
            detailHeading={jenis === 'penyewa' ? 'Email' : undefined}
            report={laporan}
            emptyText={jenis === 'penyewa' ? 'Belum ada sewa.' : undefined}
          />
        )}
      </div>
    </FadeIn>
  );
}
