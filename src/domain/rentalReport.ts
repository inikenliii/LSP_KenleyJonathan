/**
 * @file Aturan laporan sewa: pengelompokan per bulan, per hari, per tipe garasi,
 * dan per penyewa, lengkap dengan baris nol dan total.
 *
 * Aturan (D-06): sebuah sewa masuk ke periode tanggal mulainya. Jumlah uang
 * sebuah sewa = total biaya sewa + jumlah biaya semua perpanjangannya. Baris
 * yang tidak punya sewa tetap ditampilkan (jumlah 0) agar setiap bulan, hari,
 * dan tipe garasi selalu muncul.
 *
 * Modul ini murni: tidak mengimpor framework, ORM, atau driver database.
 */
import { GARAGE_TYPE_CODES, GarageFactory, type GarageTypeCode } from './garage';
import { daysInMonth, formatTanggal, toIsoDate } from './rentalPeriod';

/** Tahun paling awal yang boleh dipilih untuk laporan. */
export const REPORT_MIN_YEAR = 2000;

/** Tahun paling akhir yang boleh dipilih untuk laporan. */
export const REPORT_MAX_YEAR = 2100;

/** Nama dua belas bulan dalam Bahasa Indonesia, Januari sampai Desember. */
export const MONTH_NAMES: readonly string[] = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/** Satu sewa beserta data yang dibutuhkan laporan. */
export interface ReportRental {
  /** Tanggal mulai sewa (tanggal-saja, UTC tengah malam). */
  startDate: Date;
  /** Tipe garasi yang disewa. */
  garageType: GarageTypeCode;
  /** Id penyewa. */
  renterId: number;
  /** Nama lengkap penyewa. */
  renterName: string;
  /** Email penyewa. */
  renterEmail: string;
  /** Total biaya sewa awal dalam rupiah. */
  totalCost: number;
  /** Jumlah biaya setiap perpanjangan sewa itu dalam rupiah. */
  extensionAmounts: readonly number[];
}

/** Satu baris laporan. */
export interface ReportRow {
  /** Kunci unik baris (misalnya `2026-01`, `2026-01-15`, `CAR`, atau id penyewa). */
  key: string;
  /** Teks utama baris (nama bulan, tanggal, tipe garasi, atau nama penyewa). */
  label: string;
  /** Keterangan tambahan (email penyewa); null bila tidak ada. */
  detail: string | null;
  /** Jumlah sewa pada baris ini. */
  count: number;
  /** Jumlah uang pada baris ini dalam rupiah. */
  amount: number;
}

/** Satu laporan lengkap dengan total. */
export interface RentalReport {
  /** Baris laporan. */
  rows: ReportRow[];
  /** Jumlah seluruh sewa pada baris. */
  totalCount: number;
  /** Jumlah seluruh uang pada baris dalam rupiah. */
  totalAmount: number;
}

/** Rentang tanggal-saja; batas akhir tidak termasuk. */
export interface ReportDateRange {
  /** Hari pertama rentang (termasuk). */
  from: Date;
  /** Hari pertama setelah rentang (tidak termasuk). */
  to: Date;
}

/**
 * Memastikan tahun berupa bilangan bulat dalam rentang laporan.
 *
 * @param year Tahun yang diperiksa.
 * @throws {RangeError} Bila bukan bilangan bulat 2000 sampai 2100.
 */
function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < REPORT_MIN_YEAR || year > REPORT_MAX_YEAR) {
    throw new RangeError(`Tahun harus bilangan bulat ${REPORT_MIN_YEAR} sampai ${REPORT_MAX_YEAR}.`);
  }
}

/**
 * Memastikan bulan berupa bilangan bulat 1 sampai 12.
 *
 * @param month Bulan yang diperiksa.
 * @throws {RangeError} Bila bukan bilangan bulat 1 sampai 12.
 */
function assertMonth(month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Bulan harus bilangan bulat 1 sampai 12.');
  }
}

/**
 * Jumlah uang satu sewa: total biaya sewa ditambah semua biaya perpanjangannya.
 *
 * @param rental Sewa yang dihitung.
 * @returns Jumlah dalam rupiah bulat.
 * @example
 * rentalAmount({ ...sewa, totalCost: 30000, extensionAmounts: [70000, 10000] }); // 110000
 */
export function rentalAmount(rental: Pick<ReportRental, 'totalCost' | 'extensionAmounts'>): number {
  return rental.extensionAmounts.reduce((jumlah, biaya) => jumlah + biaya, rental.totalCost);
}

/**
 * Rentang tanggal sewa untuk satu tahun, atau satu bulan bila bulan diberikan.
 *
 * @param year Tahun (2000 sampai 2100).
 * @param month Bulan 1 sampai 12; bila kosong, rentang satu tahun penuh.
 * @returns Batas awal dan batas akhir (eksklusif) sebagai tanggal-saja.
 * @throws {RangeError} Bila tahun atau bulan di luar rentang atau bukan bilangan bulat.
 * @example
 * reportDateRange(2028, 2); // dari 2028-02-01 sampai (tidak termasuk) 2028-03-01
 */
export function reportDateRange(year: number, month?: number): ReportDateRange {
  assertYear(year);
  if (month === undefined) {
    return { from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year + 1, 0, 1)) };
  }
  assertMonth(month);
  return { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 1)) };
}

/**
 * Menjumlahkan baris menjadi laporan lengkap dengan total.
 *
 * @param rows Baris laporan.
 * @returns Laporan dengan jumlah sewa dan uang keseluruhan.
 */
function buildReport(rows: ReportRow[]): RentalReport {
  return {
    rows,
    totalCount: rows.reduce((jumlah, baris) => jumlah + baris.count, 0),
    totalAmount: rows.reduce((jumlah, baris) => jumlah + baris.amount, 0),
  };
}

/**
 * Menambahkan satu sewa ke baris.
 *
 * @param row Baris yang bertambah.
 * @param rental Sewa yang dimasukkan.
 */
function addToRow(row: ReportRow, rental: ReportRental): void {
  row.count += 1;
  row.amount += rentalAmount(rental);
}

/**
 * Laporan per bulan pada satu tahun: selalu 12 baris, Januari sampai Desember.
 *
 * @param rentals Sewa yang dilaporkan; sewa di luar tahun itu diabaikan.
 * @param year Tahun laporan (2000 sampai 2100).
 * @returns Laporan 12 baris dengan total.
 * @throws {RangeError} Bila tahun di luar rentang atau bukan bilangan bulat.
 */
export function reportByMonth(rentals: readonly ReportRental[], year: number): RentalReport {
  assertYear(year);
  const baris: ReportRow[] = MONTH_NAMES.map((nama, indeks) => ({
    key: `${year}-${String(indeks + 1).padStart(2, '0')}`,
    label: `${nama} ${year}`,
    detail: null,
    count: 0,
    amount: 0,
  }));
  for (const sewa of rentals) {
    if (sewa.startDate.getUTCFullYear() === year) {
      addToRow(baris[sewa.startDate.getUTCMonth()], sewa);
    }
  }
  return buildReport(baris);
}

/**
 * Laporan per hari pada satu bulan: satu baris untuk setiap tanggal bulan itu
 * (sadar tahun kabisat).
 *
 * @param rentals Sewa yang dilaporkan; sewa di luar bulan itu diabaikan.
 * @param year Tahun laporan (2000 sampai 2100).
 * @param month Bulan laporan 1 sampai 12.
 * @returns Laporan satu baris per tanggal dengan total.
 * @throws {RangeError} Bila tahun atau bulan di luar rentang atau bukan bilangan bulat.
 */
export function reportByDay(rentals: readonly ReportRental[], year: number, month: number): RentalReport {
  assertYear(year);
  assertMonth(month);
  const jumlahHari = daysInMonth(new Date(Date.UTC(year, month - 1, 1)));
  const baris: ReportRow[] = Array.from({ length: jumlahHari }, (_, indeks) => {
    const tanggal = new Date(Date.UTC(year, month - 1, indeks + 1));
    return { key: toIsoDate(tanggal), label: formatTanggal(tanggal), detail: null, count: 0, amount: 0 };
  });
  for (const sewa of rentals) {
    if (sewa.startDate.getUTCFullYear() === year && sewa.startDate.getUTCMonth() === month - 1) {
      addToRow(baris[sewa.startDate.getUTCDate() - 1], sewa);
    }
  }
  return buildReport(baris);
}

/**
 * Laporan per tipe garasi: selalu tiga baris (Sepeda, Mobil, Mobil Listrik).
 *
 * @param rentals Sewa yang dilaporkan.
 * @returns Laporan tiga baris dengan total.
 */
export function reportByGarageType(rentals: readonly ReportRental[]): RentalReport {
  const baris = new Map<GarageTypeCode, ReportRow>(
    GARAGE_TYPE_CODES.map((kode) => [
      kode,
      { key: kode, label: GarageFactory.create(kode).label, detail: null, count: 0, amount: 0 },
    ]),
  );
  for (const sewa of rentals) {
    const tipe = baris.get(sewa.garageType);
    if (tipe !== undefined) {
      addToRow(tipe, sewa);
    }
  }
  return buildReport([...baris.values()]);
}

/**
 * Laporan per penyewa: hanya penyewa yang punya sewa, urut nama (lalu id).
 * Dua penyewa bernama sama tetap dua baris karena dikelompokkan menurut id.
 *
 * @param rentals Sewa yang dilaporkan.
 * @returns Laporan satu baris per penyewa dengan nama, email, dan total.
 */
export function reportByRenter(rentals: readonly ReportRental[]): RentalReport {
  const penyewa = new Map<number, ReportRow>();
  for (const sewa of rentals) {
    let baris = penyewa.get(sewa.renterId);
    if (baris === undefined) {
      baris = {
        key: String(sewa.renterId),
        label: sewa.renterName,
        detail: sewa.renterEmail,
        count: 0,
        amount: 0,
      };
      penyewa.set(sewa.renterId, baris);
    }
    addToRow(baris, sewa);
  }
  const urut = [...penyewa.entries()]
    .sort(([idA, a], [idB, b]) => a.label.localeCompare(b.label, 'id') || idA - idB)
    .map(([, baris]) => baris);
  return buildReport(urut);
}
