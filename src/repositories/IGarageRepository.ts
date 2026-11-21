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

/** Kontrak repository garasi agar layanan tidak bergantung pada Prisma. */
export interface IGarageRepository {
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
