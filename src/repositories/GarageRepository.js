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
}
