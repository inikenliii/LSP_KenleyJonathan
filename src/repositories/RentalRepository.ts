/**
 * @file Repository sewa: menyimpan sewa dan mengubah status garasi dalam satu
 * transaksi, melepas garasi yang sewanya sudah berakhir, dan membaca sewa.
 */
import { ConflictError } from '@/domain';
import type { PrismaClient } from '@/generated/client';
import type { GarageRecord } from './IGarageRepository';
import type {
  IRentalRepository,
  NewRentalData,
  RentalExtensionSummary,
  RentalRecord,
} from './IRentalRepository';

/** Pilihan kolom garasi beserta harga tipenya. */
const GARAGE_WITH_PRICES = {
  config: { select: { dailyPrice: true, pricePerKwh: true } },
} as const;

/** Kolom sewa yang ikut dibaca: tipe garasi dan perpanjangan (paling lama lebih dulu). */
const RENTAL_INCLUDE = {
  garage: { select: { type: true } },
  extensions: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      extensionType: true,
      quantity: true,
      additionalDays: true,
      newEndDate: true,
      amount: true,
    },
  },
} as const;

/** Implementasi IRentalRepository dengan Prisma. */
export class RentalRepository implements IRentalRepository {
  /**
   * @param prisma Klien Prisma.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Melepas garasi used yang tidak punya sewa dengan tanggal berakhir hari ini
   * atau sesudahnya, dengan satu perintah UPDATE.
   *
   * @param today Tanggal hari ini (tanggal-saja).
   * @returns Jumlah garasi yang dilepas.
   */
  async releaseExpiredGarages(today: Date): Promise<number> {
    const hasil = await this.prisma.garage.updateMany({
      where: { status: 'USED', rentals: { none: { endDate: { gte: today } } } },
      data: { status: 'AVAILABLE' },
    });
    return hasil.count;
  }

  /**
   * Membaca garasi yang tersedia, urut menurut ID.
   *
   * @returns Garasi tersedia beserta harga tipenya.
   */
  async findAvailableGarages(): Promise<GarageRecord[]> {
    const baris = await this.prisma.garage.findMany({
      where: { status: 'AVAILABLE' },
      orderBy: { id: 'asc' },
      include: GARAGE_WITH_PRICES,
    });
    return baris.map((garasi) => ({
      id: garasi.id,
      type: garasi.type,
      status: garasi.status,
      dailyPrice: garasi.config.dailyPrice,
      pricePerKwh: garasi.config.pricePerKwh,
    }));
  }

  /**
   * Membaca satu garasi beserta harga tipenya.
   *
   * @param id ID garasi.
   * @returns Garasi, atau null bila tidak ada.
   */
  async findGarageById(id: string): Promise<GarageRecord | null> {
    const garasi = await this.prisma.garage.findUnique({
      where: { id },
      include: GARAGE_WITH_PRICES,
    });
    if (garasi === null) {
      return null;
    }
    return {
      id: garasi.id,
      type: garasi.type,
      status: garasi.status,
      dailyPrice: garasi.config.dailyPrice,
      pricePerKwh: garasi.config.pricePerKwh,
    };
  }

  /**
   * Menyimpan sewa dalam satu transaksi: garasi diubah dari tersedia menjadi
   * used dengan UPDATE bersyarat (id dan status tersedia). Bila tidak tepat
   * satu baris berubah, garasi sudah diambil penyewa lain dan transaksi
   * dibatalkan. Dua penyewa yang berebut garasi yang sama tidak mungkin
   * keduanya berhasil karena UPDATE mengunci baris garasi.
   *
   * @param data Data sewa.
   * @returns Sewa yang tersimpan.
   * @throws {ConflictError} Bila garasi sudah tidak tersedia.
   */
  async createRental(data: NewRentalData): Promise<RentalRecord> {
    return this.prisma.$transaction(async (tx) => {
      const diubah = await tx.garage.updateMany({
        where: { id: data.garageId, status: 'AVAILABLE' },
        data: { status: 'USED' },
      });
      if (diubah.count !== 1) {
        throw new ConflictError('Garasi sudah disewa, pilih garasi lain');
      }
      const baris = await tx.rental.create({ data, include: RENTAL_INCLUDE });
      return RentalRepository.toRecord(baris);
    });
  }

  /**
   * Membaca sewa milik satu penyewa beserta perpanjangannya, terbaru lebih dulu.
   *
   * @param renterId Id penyewa.
   * @returns Sewa penyewa itu saja.
   */
  async findByRenter(renterId: number): Promise<RentalRecord[]> {
    const baris = await this.prisma.rental.findMany({
      where: { renterId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: RENTAL_INCLUDE,
    });
    return baris.map((item) => RentalRepository.toRecord(item));
  }

  /**
   * Membaca satu sewa menurut id.
   *
   * @param id Id sewa.
   * @returns Sewa, atau null bila tidak ada.
   */
  async findById(id: number): Promise<RentalRecord | null> {
    const baris = await this.prisma.rental.findUnique({
      where: { id },
      include: RENTAL_INCLUDE,
    });
    return baris === null ? null : RentalRepository.toRecord(baris);
  }

  /**
   * Mengubah baris Prisma menjadi data biasa; kapasitas dan sisa baterai (Decimal)
   * dijadikan angka.
   *
   * @param baris Baris sewa beserta tipe garasinya.
   * @returns Sewa sebagai data biasa.
   */
  private static toRecord(baris: {
    id: number;
    renterId: number;
    garageId: string;
    vehicleType: RentalRecord['vehicleType'];
    plateNumber: string | null;
    vehicleBrand: string;
    vehicleModel: string;
    batteryKwh: { toString(): string } | null;
    remainingKwh: { toString(): string } | null;
    rentalType: RentalRecord['rentalType'];
    days: number | null;
    startDate: Date;
    endDate: Date;
    dailyPrice: number;
    pricePerKwh: number | null;
    chargeCost: number;
    totalCost: number;
    paymentProofFile: string;
    createdAt: Date;
    garage: { type: RentalRecord['garageType'] };
    extensions: Array<{
      id: number;
      extensionType: RentalExtensionSummary['extensionType'];
      quantity: number;
      additionalDays: number;
      newEndDate: Date;
      amount: number;
    }>;
  }): RentalRecord {
    return {
      id: baris.id,
      renterId: baris.renterId,
      garageId: baris.garageId,
      garageType: baris.garage.type,
      vehicleType: baris.vehicleType,
      plateNumber: baris.plateNumber,
      vehicleBrand: baris.vehicleBrand,
      vehicleModel: baris.vehicleModel,
      batteryKwh: baris.batteryKwh === null ? null : Number(baris.batteryKwh),
      remainingKwh: baris.remainingKwh === null ? null : Number(baris.remainingKwh),
      rentalType: baris.rentalType,
      days: baris.days,
      startDate: baris.startDate,
      endDate: baris.endDate,
      dailyPrice: baris.dailyPrice,
      pricePerKwh: baris.pricePerKwh,
      chargeCost: baris.chargeCost,
      totalCost: baris.totalCost,
      paymentProofFile: baris.paymentProofFile,
      createdAt: baris.createdAt,
      extensions: baris.extensions.map((perpanjangan) => ({
        id: perpanjangan.id,
        extensionType: perpanjangan.extensionType,
        quantity: perpanjangan.quantity,
        additionalDays: perpanjangan.additionalDays,
        newEndDate: perpanjangan.newEndDate,
        amount: perpanjangan.amount,
      })),
    };
  }
}
