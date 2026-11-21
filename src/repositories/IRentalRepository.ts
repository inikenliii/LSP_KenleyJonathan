/**
 * @file Kontrak akses data sewa.
 */
import type { GarageTypeCode, RentalTypeCode, VehicleTypeCode } from '@/domain';
import type { GarageRecord } from './IGarageRepository';

/** Data satu sewa baru yang akan disimpan (sudah divalidasi dan dihitung server). */
export interface NewRentalData {
  /** Id penyewa (dari sesi). */
  renterId: number;
  /** ID garasi yang disewa. */
  garageId: string;
  /** Tipe kendaraan. */
  vehicleType: VehicleTypeCode;
  /** Nomor plat; null untuk sepeda. */
  plateNumber: string | null;
  /** Merek kendaraan. */
  vehicleBrand: string;
  /** Tipe/model kendaraan. */
  vehicleModel: string;
  /** Kapasitas baterai (kWh); hanya mobil listrik. */
  batteryKwh: number | null;
  /** Sisa baterai (kWh) saat disewa; hanya mobil listrik. */
  remainingKwh: number | null;
  /** Tipe sewa. */
  rentalType: RentalTypeCode;
  /** Jumlah hari; hanya sewa harian. */
  days: number | null;
  /** Tanggal mulai (tanggal-saja). */
  startDate: Date;
  /** Tanggal berakhir (tanggal-saja). */
  endDate: Date;
  /** Salinan harga harian saat sewa dibuat. */
  dailyPrice: number;
  /** Salinan harga per kWh; hanya bila baterai diisi. */
  pricePerKwh: number | null;
  /** Biaya pengisian baterai (0 bila tidak ada). */
  chargeCost: number;
  /** Total biaya dalam rupiah bulat. */
  totalCost: number;
  /** Nama berkas bukti pembayaran. */
  paymentProofFile: string;
}

/** Ringkasan satu perpanjangan yang melekat pada sewa, untuk daftar sewa penyewa. */
export interface RentalExtensionSummary {
  /** Id perpanjangan (dipakai untuk tautan bukti pembayaran). */
  id: number;
  /** Jenis perpanjangan: harian atau bulanan. */
  extensionType: RentalTypeCode;
  /** Jumlah hari (harian) atau jumlah bulan (bulanan). */
  quantity: number;
  /** Jumlah hari kalender tambahan. */
  additionalDays: number;
  /** Tanggal berakhir baru setelah perpanjangan ini (tanggal-saja). */
  newEndDate: Date;
  /** Sisa biaya perpanjangan dalam rupiah bulat. */
  amount: number;
}

/** Satu sewa yang sudah tersimpan. */
export interface RentalRecord extends NewRentalData {
  /** Id sewa. */
  id: number;
  /** Tipe garasi yang disewa. */
  garageType: GarageTypeCode;
  /** Waktu sewa dibuat. */
  createdAt: Date;
  /** Perpanjangan sewa ini, dari yang paling lama; kosong bila belum pernah diperpanjang. */
  extensions: RentalExtensionSummary[];
}

/** Kontrak repository sewa agar layanan tidak bergantung pada Prisma. */
export interface IRentalRepository {
  /**
   * Mengembalikan ke tersedia semua garasi used yang tidak punya sewa dengan
   * tanggal berakhir hari ini atau sesudahnya.
   *
   * @param today Tanggal hari ini (tanggal-saja).
   * @returns Jumlah garasi yang dilepas.
   */
  releaseExpiredGarages(today: Date): Promise<number>;

  /**
   * Membaca semua garasi yang tersedia beserta harga tipenya.
   *
   * @returns Garasi tersedia, urut menurut ID.
   */
  findAvailableGarages(): Promise<GarageRecord[]>;

  /**
   * Membaca satu garasi beserta harga tipenya.
   *
   * @param id ID garasi.
   * @returns Garasi, atau null bila tidak ada.
   */
  findGarageById(id: string): Promise<GarageRecord | null>;

  /**
   * Menyimpan sewa baru dan mengubah garasi menjadi used dalam satu transaksi.
   *
   * @param data Data sewa.
   * @returns Sewa yang tersimpan.
   * @throws {ConflictError} Bila garasi sudah tidak tersedia; tidak ada yang tersimpan.
   */
  createRental(data: NewRentalData): Promise<RentalRecord>;

  /**
   * Membaca semua sewa milik satu penyewa beserta perpanjangannya.
   *
   * @param renterId Id penyewa.
   * @returns Sewa terbaru lebih dulu.
   */
  findByRenter(renterId: number): Promise<RentalRecord[]>;

  /**
   * Membaca satu sewa menurut id.
   *
   * @param id Id sewa.
   * @returns Sewa, atau null bila tidak ada.
   */
  findById(id: number): Promise<RentalRecord | null>;
}
