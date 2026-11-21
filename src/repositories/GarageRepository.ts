/**
 * @file Repository garasi: satu-satunya kelas yang membaca dan menulis tabel
 * garages dan garage_type_configs lewat Prisma.
 */
import type { BatchPlan } from '@/domain';
import type { PrismaClient } from '@/generated/client';
import type { GarageBatchRequest, IGarageRepository } from './IGarageRepository';

/** Implementasi IGarageRepository dengan Prisma. */
export class GarageRepository implements IGarageRepository {
  /**
   * @param prisma Klien Prisma.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Membuat satu batch garasi dalam satu transaksi. Penghitung nomor tipe
   * dinaikkan lebih dulu dengan satu perintah UPDATE; UPDATE itu mengunci baris
   * tipe sehingga batch bersamaan berjalan bergantian dan tidak ada ID ganda
   * atau terlewat. Bila rencana ID gagal (melebihi 999), seluruh transaksi
   * dibatalkan sehingga penghitung dan harga tidak berubah. ID tidak pernah
   * diturunkan dari ID tertinggi yang ada.
   *
   * @param request Data batch: tipe, jumlah, harga harian, dan harga per kWh.
   * @param planIds Fungsi yang menyusun ID dari nomor terakhir sebelum batch ini.
   * @returns Rencana ID yang sudah disimpan.
   * @throws {CapacityExceededError} Bila batch melebihi batas per tipe.
   */
  async createBatch(
    request: GarageBatchRequest,
    planIds: (currentLastNumber: number) => BatchPlan,
  ): Promise<BatchPlan> {
    const { type, quantity, dailyPrice, pricePerKwh } = request;
    return this.prisma.$transaction(
      async (tx) => {
        const diperbarui = await tx.garageTypeConfig.update({
          where: { type },
          data: {
            lastNumber: { increment: quantity },
            dailyPrice,
            ...(pricePerKwh !== undefined && { pricePerKwh }),
          },
        });
        const rencana = planIds(diperbarui.lastNumber - quantity);
        await tx.garage.createMany({ data: rencana.ids.map((id) => ({ id, type })) });
        return rencana;
      },
      { maxWait: 10000, timeout: 15000 },
    );
  }
}
