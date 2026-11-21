/**
 * @file Repository garasi: satu-satunya kelas yang membaca dan menulis tabel
 * garages dan garage_type_configs lewat Prisma.
 */

/**
 * Akses data garasi dan konfigurasi per tipe.
 */
export class GarageRepository {
  /**
   * @param {object} prisma Klien Prisma.
   */
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Membaca konfigurasi semua tipe garasi.
   *
   * @returns {Promise<Array<{ type: string, dailyPrice: number, pricePerKwh: number|null, lastNumber: number }>>}
   */
  async findAllConfigs() {
    return this.prisma.garageTypeConfig.findMany({
      select: { type: true, dailyPrice: true, pricePerKwh: true, lastNumber: true },
    });
  }

  /**
   * Membaca semua garasi beserta harga tipenya, urut menurut ID.
   *
   * @returns {Promise<Array<{ id: string, type: string, status: string, config: { dailyPrice: number, pricePerKwh: number|null } }>>}
   */
  async findAll() {
    return this.prisma.garage.findMany({
      orderBy: { id: 'asc' },
      include: { config: { select: { dailyPrice: true, pricePerKwh: true } } },
    });
  }

  /**
   * Membuat satu batch garasi dalam satu transaksi. Penghitung nomor tipe
   * dinaikkan lebih dulu dengan satu perintah UPDATE; UPDATE itu mengunci baris
   * tipe sehingga batch bersamaan berjalan bergantian dan tidak ada ID ganda
   * atau terlewat. Bila rencana ID gagal (melebihi 999), seluruh transaksi
   * dibatalkan sehingga penghitung dan harga tidak berubah. ID tidak pernah
   * diturunkan dari ID tertinggi yang ada.
   *
   * @param {object} data Data batch.
   * @param {string} data.type Kode tipe garasi.
   * @param {number} data.quantity Jumlah garasi.
   * @param {number} data.dailyPrice Harga harian baru untuk tipe ini.
   * @param {number} [data.pricePerKwh] Harga per kWh baru (hanya Mobil Listrik).
   * @param {(currentLastNumber: number) => { ids: string[], firstNumber: number, lastNumber: number }} planIds
   *   Fungsi yang menyusun ID dari nomor terakhir sebelum batch ini.
   * @returns {Promise<{ ids: string[], firstNumber: number, lastNumber: number, config: object }>}
   * @throws {import('../domain/errors.js').CapacityExceededError} Bila batch melebihi batas per tipe.
   */
  async createBatch({ type, quantity, dailyPrice, pricePerKwh }, planIds) {
    return this.prisma.$transaction(
      async (tx) => {
        const data = { lastNumber: { increment: quantity }, dailyPrice };
        if (pricePerKwh !== undefined) {
          data.pricePerKwh = pricePerKwh;
        }
        const updated = await tx.garageTypeConfig.update({ where: { type }, data });
        const plan = planIds(updated.lastNumber - quantity);
        await tx.garage.createMany({ data: plan.ids.map((id) => ({ id, type })) });
        return { ...plan, config: updated };
      },
      { maxWait: 10000, timeout: 15000 },
    );
  }
}
