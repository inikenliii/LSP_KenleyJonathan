/**
 * @file Kontrak akses data perpanjangan sewa.
 */
import type { GarageTypeCode, RentalTypeCode, VehicleTypeCode } from '@/domain';

/** Satu sewa beserta data yang dibutuhkan untuk daftar dan perhitungan perpanjangan. */
export interface ExtendableRentalRecord {
  /** Id sewa. */
  id: number;
  /** Id penyewa pemilik sewa. */
  renterId: number;
  /** Nama lengkap penyewa. */
  renterName: string;
  /** ID garasi yang disewa. */
  garageId: string;
  /** Tipe garasi yang disewa. */
  garageType: GarageTypeCode;
  /** Tipe kendaraan. */
  vehicleType: VehicleTypeCode;
  /** Nomor plat; null untuk sepeda. */
  plateNumber: string | null;
  /** Merek kendaraan. */
  vehicleBrand: string;
  /** Tipe/model kendaraan. */
  vehicleModel: string;
  /** Tipe sewa. */
  rentalType: RentalTypeCode;
  /** Tanggal mulai (tanggal-saja). */
  startDate: Date;
  /** Tanggal berakhir saat ini (tanggal-saja). */
  endDate: Date;
  /** Salinan harga harian saat sewa dibuat. */
  dailyPrice: number;
}

/** Data satu perpanjangan baru yang akan disimpan (sudah divalidasi dan dihitung server). */
export interface NewExtensionData {
  /** Id sewa yang diperpanjang. */
  rentalId: number;
  /** Tanggal berakhir sebelum perpanjangan (tanggal-saja). */
  previousEndDate: Date;
  /** Tanggal berakhir baru (tanggal-saja). */
  newEndDate: Date;
  /** Jenis perpanjangan: harian atau bulanan. */
  extensionType: RentalTypeCode;
  /** Jumlah hari (harian) atau jumlah bulan (bulanan). */
  quantity: number;
  /** Jumlah hari kalender tambahan. */
  additionalDays: number;
  /** Salinan harga harian yang dipakai. */
  dailyPrice: number;
  /** Sisa biaya dalam rupiah bulat. */
  amount: number;
  /** Nama berkas bukti pembayaran perpanjangan. */
  paymentProofFile: string;
  /** Id Admin yang menyimpan (dari sesi). */
  adminId: number;
}

/** Satu perpanjangan yang sudah tersimpan. */
export interface ExtensionRecord extends NewExtensionData {
  /** Id perpanjangan. */
  id: number;
  /** Id penyewa pemilik sewa yang diperpanjang. */
  renterId: number;
  /** Nama lengkap Admin yang menyimpan. */
  adminName: string;
  /** Waktu perpanjangan disimpan. */
  createdAt: Date;
}

/** Kontrak repository perpanjangan agar layanan tidak bergantung pada Prisma. */
export interface IRentalExtensionRepository {
  /**
   * Membaca sewa yang aktif hari ini (mulai sampai hari ini, berakhir hari ini atau sesudahnya).
   *
   * @param today Tanggal hari ini (tanggal-saja).
   * @returns Sewa aktif, urut menurut ID garasi.
   */
  findActiveRentals(today: Date): Promise<ExtendableRentalRecord[]>;

  /**
   * Membaca satu sewa menurut id.
   *
   * @param id Id sewa.
   * @returns Sewa, atau null bila tidak ada.
   */
  findRentalById(id: number): Promise<ExtendableRentalRecord | null>;

  /**
   * Menyimpan perpanjangan dan memindah tanggal berakhir sewa dalam satu transaksi.
   *
   * @param data Data perpanjangan.
   * @param today Tanggal hari ini (tanggal-saja); sewa yang sudah berakhir tidak bisa diperpanjang.
   * @returns Perpanjangan yang tersimpan.
   * @throws {ConflictError} Bila sewa sudah berubah atau berakhir; tidak ada yang tersimpan.
   */
  createExtension(data: NewExtensionData, today: Date): Promise<ExtensionRecord>;

  /**
   * Membaca semua perpanjangan satu sewa.
   *
   * @param rentalId Id sewa.
   * @returns Perpanjangan dari yang paling lama.
   */
  findByRental(rentalId: number): Promise<ExtensionRecord[]>;

  /**
   * Membaca satu perpanjangan menurut id.
   *
   * @param id Id perpanjangan.
   * @returns Perpanjangan, atau null bila tidak ada.
   */
  findById(id: number): Promise<ExtensionRecord | null>;
}
