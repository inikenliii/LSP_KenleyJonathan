/**
 * @file Repository perpanjangan sewa: membaca sewa yang aktif dan menyimpan
 * perpanjangan bersama pemindahan tanggal berakhir sewa dalam satu transaksi.
 */
import { ConflictError } from '@/domain';
import type { PrismaClient } from '@/generated/client';
import type {
  ExtendableRentalRecord,
  ExtensionRecord,
  IRentalExtensionRepository,
  NewExtensionData,
} from './IRentalExtensionRepository';

/** Relasi yang dibaca bersama sewa: tipe garasi dan nama penyewa. */
const RENTAL_INCLUDE = {
  garage: { select: { type: true } },
  renter: { select: { fullName: true } },
} as const;

/** Relasi yang dibaca bersama perpanjangan: nama Admin dan penyewa pemilik sewa. */
const EXTENSION_INCLUDE = {
  admin: { select: { fullName: true } },
  rental: { select: { renterId: true } },
} as const;

/** Implementasi IRentalExtensionRepository dengan Prisma. */
export class RentalExtensionRepository implements IRentalExtensionRepository {
  /**
   * @param prisma Klien Prisma.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Membaca sewa yang aktif hari ini, urut menurut ID garasi.
   *
   * @param today Tanggal hari ini (tanggal-saja).
   * @returns Sewa aktif.
   */
  async findActiveRentals(today: Date): Promise<ExtendableRentalRecord[]> {
    const baris = await this.prisma.rental.findMany({
      where: { startDate: { lte: today }, endDate: { gte: today } },
      orderBy: { garageId: 'asc' },
      include: RENTAL_INCLUDE,
    });
    return baris.map((item) => RentalExtensionRepository.toRentalRecord(item));
  }

  /**
   * Membaca satu sewa menurut id.
   *
   * @param id Id sewa.
   * @returns Sewa, atau null bila tidak ada.
   */
  async findRentalById(id: number): Promise<ExtendableRentalRecord | null> {
    const baris = await this.prisma.rental.findUnique({ where: { id }, include: RENTAL_INCLUDE });
    return baris === null ? null : RentalExtensionRepository.toRentalRecord(baris);
  }

  /**
   * Menyimpan perpanjangan dalam satu transaksi: tanggal berakhir sewa diubah
   * dengan UPDATE bersyarat (id, tanggal berakhir masih sama dengan tanggal
   * sebelumnya, dan belum lewat dari hari ini), lalu baris perpanjangan disimpan.
   * UPDATE mengunci baris sewa sehingga dua Admin yang memperpanjang sewa yang
   * sama bersamaan tidak mungkin keduanya berhasil. Tanggal berakhir sewa selalu
   * memuat tanggal terbaru, jadi logika ketersediaan sewa (garasi tetap used
   * sampai tanggal berakhir) tetap berlaku.
   *
   * @param data Data perpanjangan.
   * @param today Tanggal hari ini (tanggal-saja).
   * @returns Perpanjangan yang tersimpan.
   * @throws {ConflictError} Bila sewa sudah berubah atau berakhir.
   */
  async createExtension(data: NewExtensionData, today: Date): Promise<ExtensionRecord> {
    return this.prisma.$transaction(async (tx) => {
      const diubah = await tx.rental.updateMany({
        where: {
          id: data.rentalId,
          endDate: { equals: data.previousEndDate, gte: today },
        },
        data: { endDate: data.newEndDate },
      });
      if (diubah.count !== 1) {
        throw new ConflictError('Sewa sudah berubah atau berakhir, muat ulang halaman');
      }
      const baris = await tx.rentalExtension.create({ data, include: EXTENSION_INCLUDE });
      return RentalExtensionRepository.toExtensionRecord(baris);
    });
  }

  /**
   * Membaca semua perpanjangan satu sewa, dari yang paling lama.
   *
   * @param rentalId Id sewa.
   * @returns Perpanjangan sewa itu.
   */
  async findByRental(rentalId: number): Promise<ExtensionRecord[]> {
    const baris = await this.prisma.rentalExtension.findMany({
      where: { rentalId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: EXTENSION_INCLUDE,
    });
    return baris.map((item) => RentalExtensionRepository.toExtensionRecord(item));
  }

  /**
   * Membaca satu perpanjangan menurut id.
   *
   * @param id Id perpanjangan.
   * @returns Perpanjangan, atau null bila tidak ada.
   */
  async findById(id: number): Promise<ExtensionRecord | null> {
    const baris = await this.prisma.rentalExtension.findUnique({
      where: { id },
      include: EXTENSION_INCLUDE,
    });
    return baris === null ? null : RentalExtensionRepository.toExtensionRecord(baris);
  }

  /**
   * Mengubah baris sewa Prisma menjadi data biasa.
   *
   * @param baris Baris sewa beserta tipe garasi dan nama penyewa.
   * @returns Sewa sebagai data biasa.
   */
  private static toRentalRecord(baris: {
    id: number;
    renterId: number;
    garageId: string;
    vehicleType: ExtendableRentalRecord['vehicleType'];
    plateNumber: string | null;
    vehicleBrand: string;
    vehicleModel: string;
    rentalType: ExtendableRentalRecord['rentalType'];
    startDate: Date;
    endDate: Date;
    dailyPrice: number;
    garage: { type: ExtendableRentalRecord['garageType'] };
    renter: { fullName: string };
  }): ExtendableRentalRecord {
    return {
      id: baris.id,
      renterId: baris.renterId,
      renterName: baris.renter.fullName,
      garageId: baris.garageId,
      garageType: baris.garage.type,
      vehicleType: baris.vehicleType,
      plateNumber: baris.plateNumber,
      vehicleBrand: baris.vehicleBrand,
      vehicleModel: baris.vehicleModel,
      rentalType: baris.rentalType,
      startDate: baris.startDate,
      endDate: baris.endDate,
      dailyPrice: baris.dailyPrice,
    };
  }

  /**
   * Mengubah baris perpanjangan Prisma menjadi data biasa.
   *
   * @param baris Baris perpanjangan beserta nama Admin dan id penyewa.
   * @returns Perpanjangan sebagai data biasa.
   */
  private static toExtensionRecord(baris: {
    id: number;
    rentalId: number;
    previousEndDate: Date;
    newEndDate: Date;
    additionalDays: number;
    dailyPrice: number;
    amount: number;
    paymentProofFile: string;
    adminId: number;
    createdAt: Date;
    admin: { fullName: string };
    rental: { renterId: number };
  }): ExtensionRecord {
    return {
      id: baris.id,
      rentalId: baris.rentalId,
      renterId: baris.rental.renterId,
      previousEndDate: baris.previousEndDate,
      newEndDate: baris.newEndDate,
      additionalDays: baris.additionalDays,
      dailyPrice: baris.dailyPrice,
      amount: baris.amount,
      paymentProofFile: baris.paymentProofFile,
      adminId: baris.adminId,
      adminName: baris.admin.fullName,
      createdAt: baris.createdAt,
    };
  }
}
