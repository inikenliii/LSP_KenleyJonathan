/**
 * @file Kontrak akses data garasi dan konfigurasi per tipe.
 */
import type { BatchPlan, GarageStatusCode, GarageTypeCode } from '@/domain';

/** Permintaan pembuatan satu batch garasi (sudah divalidasi). */
export interface GarageBatchRequest {
  /** Kode tipe garasi. */
  type: GarageTypeCode;
  /** Jumlah garasi yang dibuat. */
  quantity: number;
  /** Harga harian baru untuk tipe ini (rupiah). */
  dailyPrice: number;
  /** Harga per kWh baru; hanya untuk Mobil Listrik. */
  pricePerKwh?: number;
}

/** Konfigurasi satu tipe garasi: harga dan penghitung ID. */
export interface GarageTypeConfigRecord {
  /** Kode tipe garasi. */
  type: GarageTypeCode;
  /** Harga harian dalam rupiah; 0 berarti belum diatur. */
  dailyPrice: number;
  /** Harga per kWh; hanya terisi untuk Mobil Listrik. */
  pricePerKwh: number | null;
  /** Nomor terakhir yang sudah dipakai tipe ini (0 sampai 999). */
  lastNumber: number;
}

/** Satu garasi beserta harga tipenya. */
export interface GarageRecord {
  /** ID garasi, misalnya "S001". */
  id: string;
  /** Kode tipe garasi. */
  type: GarageTypeCode;
  /** Status garasi. */
  status: GarageStatusCode;
  /** Harga harian tipe garasi ini. */
  dailyPrice: number;
  /** Harga per kWh tipe garasi ini; null bila tidak ada. */
  pricePerKwh: number | null;
}

/** Kontrak repository garasi agar layanan tidak bergantung pada Prisma. */
export interface IGarageRepository {
  /**
   * Membaca konfigurasi semua tipe garasi.
   *
   * @returns Satu konfigurasi per tipe, tanpa urutan tertentu.
   */
  findAllConfigs(): Promise<GarageTypeConfigRecord[]>;

  /**
   * Membaca semua garasi beserta harga tipenya.
   *
   * @returns Semua garasi, urut menurut ID.
   */
  findAll(): Promise<GarageRecord[]>;

  /**
   * Membuat satu batch garasi dalam satu transaksi: penghitung nomor tipe
   * dinaikkan, ID direncanakan dari nomor sebelumnya, lalu garasi disimpan.
   *
   * @param request Data batch.
   * @param planIds Fungsi yang menyusun ID dari nomor terakhir sebelum batch ini.
   * @returns Rencana ID yang sudah disimpan.
   * @throws {CapacityExceededError} Bila `planIds` menolak karena melewati batas per tipe; transaksi dibatalkan.
   */
  createBatch(
    request: GarageBatchRequest,
    planIds: (currentLastNumber: number) => BatchPlan,
  ): Promise<BatchPlan>;
}
