/**
 * @file Layanan sewa: aturan bisnis sewa baru (kecocokan kendaraan dan garasi,
 * ketersediaan, tanggal, biaya, bukti pembayaran) dan tampilan sewa penyewa.
 */
import {
  ConflictError,
  GarageFactory,
  NotFoundError,
  PROOF_CONTENT_TYPES,
  RENTAL_TYPE_LABELS,
  ValidationError,
  VehicleFactory,
  calculateRentalCost,
  computeEndDate,
  detectProofImageType,
  formatTanggal,
  isRentalActive,
  maxDailyDays,
  toAppError,
  toIsoDate,
  todayInJakarta,
  type GarageTypeCode,
  type ProofImageType,
  type UserRole,
} from '@/domain';
import type { IPaymentProofStorage } from '@/lib/payment-proof-storage';
import type { IRentalRepository, RentalRecord } from '@/repositories';
import { createRentalSchema, parseInput } from '@/validation';

/** Satu garasi tersedia beserta harga untuk pilihan di formulir. */
export interface AvailableGarageOption {
  /** ID garasi, misalnya "S001". */
  id: string;
  /** Kode tipe garasi. */
  type: GarageTypeCode;
  /** Nama tipe untuk tampilan. */
  typeLabel: string;
  /** Harga harian dalam rupiah. */
  dailyPrice: number;
  /** Harga per kWh; hanya Mobil Listrik, selain itu null. */
  pricePerKwh: number | null;
}

/** Data awal formulir sewa baru. */
export interface NewRentalOptions {
  /** Tanggal mulai (hari ini di Jakarta), format `YYYY-MM-DD`. */
  today: string;
  /** Tanggal mulai dalam Bahasa Indonesia. */
  todayLabel: string;
  /** Batas jumlah hari sewa harian bulan ini. */
  maxDailyDays: number;
  /** Garasi yang tersedia, urut menurut ID. */
  garages: AvailableGarageOption[];
}

/** Satu sewa untuk ditampilkan kepada penyewa. */
export interface RentalView {
  /** Id sewa. */
  id: number;
  /** ID garasi. */
  garageId: string;
  /** Nama tipe garasi. */
  garageTypeLabel: string;
  /** Nama tipe kendaraan. */
  vehicleTypeLabel: string;
  /** Merek kendaraan. */
  vehicleBrand: string;
  /** Tipe/model kendaraan. */
  vehicleModel: string;
  /** Nomor plat; null untuk sepeda. */
  plateNumber: string | null;
  /** Kapasitas baterai (kWh); hanya mobil listrik. */
  batteryKwh: number | null;
  /** Nama tipe sewa ("Harian" atau "Bulanan"). */
  rentalTypeLabel: string;
  /** Jumlah hari; hanya sewa harian. */
  days: number | null;
  /** Tanggal mulai, `YYYY-MM-DD`. */
  startDate: string;
  /** Tanggal berakhir, `YYYY-MM-DD`. */
  endDate: string;
  /** Tanggal mulai dalam Bahasa Indonesia. */
  startDateLabel: string;
  /** Tanggal berakhir dalam Bahasa Indonesia. */
  endDateLabel: string;
  /** Salinan harga harian saat sewa dibuat. */
  dailyPrice: number;
  /** Biaya pengisian baterai. */
  chargeCost: number;
  /** Total biaya dalam rupiah. */
  totalCost: number;
  /** Apakah sewa masih berlaku. */
  isActive: boolean;
  /** "Aktif" atau "Selesai". */
  statusLabel: string;
}

/** Isi dan tipe konten bukti pembayaran. */
export interface PaymentProofFile {
  /** Isi gambar. */
  bytes: Uint8Array;
  /** Tipe konten HTTP, misalnya "image/png". */
  contentType: string;
}

/** Pengguna yang meminta bukti pembayaran. */
export interface ProofViewer {
  /** Id pengguna. */
  id: number;
  /** Peran pengguna. */
  role: UserRole;
}

/** Kontrak layanan sewa. */
export interface IRentalService {
  /**
   * Menyiapkan data formulir sewa baru: tanggal mulai, batas hari, dan garasi tersedia.
   *
   * @returns Pilihan untuk formulir.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  getNewRentalOptions(): Promise<NewRentalOptions>;

  /**
   * Membuat sewa baru untuk seorang penyewa.
   *
   * @param renterId Id penyewa dari sesi (bukan dari formulir).
   * @param input Isian formulir mentah, termasuk byte bukti pembayaran.
   * @returns Sewa yang tersimpan.
   * @throws {ValidationError} Bila isian tidak sah atau tidak cocok dengan garasi.
   * @throws {ConflictError} Bila garasi sudah disewa atau harga per kWh belum diatur.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  createRental(renterId: number, input: unknown): Promise<RentalView>;

  /**
   * Mengambil semua sewa milik seorang penyewa.
   *
   * @param renterId Id penyewa.
   * @returns Sewa terbaru lebih dulu.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  listMyRentals(renterId: number): Promise<RentalView[]>;

  /**
   * Mengambil bukti pembayaran satu sewa untuk pemiliknya atau Admin.
   *
   * @param viewer Pengguna yang meminta.
   * @param rentalId Id sewa.
   * @returns Isi gambar dan tipe kontennya.
   * @throws {NotFoundError} Bila sewa atau berkas tidak ada, atau pengguna bukan pemilik maupun Admin.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  getPaymentProof(viewer: ProofViewer, rentalId: number): Promise<PaymentProofFile>;
}

/**
 * Menangani sewa baru dan daftar sewa. Repository, penyimpanan berkas, dan
 * jam diterima lewat konstruktor sehingga mudah diganti saat pengujian.
 */
export class RentalService implements IRentalService {
  /**
   * @param rentals Repository sewa.
   * @param proofs Penyimpanan bukti pembayaran.
   * @param clock Sumber waktu; bawaannya jam sistem.
   */
  constructor(
    private readonly rentals: IRentalRepository,
    private readonly proofs: IPaymentProofStorage,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * Melepas garasi yang sewanya sudah berakhir, lalu mengembalikan tanggal
   * mulai, batas hari, dan garasi yang tersedia.
   *
   * @returns Pilihan untuk formulir sewa baru.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async getNewRentalOptions(): Promise<NewRentalOptions> {
    const today = todayInJakarta(this.clock());
    try {
      await this.rentals.releaseExpiredGarages(today);
      const baris = await this.rentals.findAvailableGarages();
      return {
        today: toIsoDate(today),
        todayLabel: formatTanggal(today),
        maxDailyDays: maxDailyDays(today),
        garages: baris.map((row) => {
          const garage = GarageFactory.create(row.type, row.id, row.status);
          return {
            id: row.id,
            type: row.type,
            typeLabel: garage.label,
            dailyPrice: row.dailyPrice,
            pricePerKwh: garage.usesKwhPrice() ? row.pricePerKwh : null,
          };
        }),
      };
    } catch (error) {
      throw toAppError(error);
    }
  }

  /**
   * Membuat sewa baru. Tanggal, biaya, dan harga dihitung server dari data
   * database; berkas bukti disimpan setelah semua pemeriksaan lolos dan
   * dihapus lagi bila penyimpanan sewa gagal.
   *
   * @param renterId Id penyewa dari sesi.
   * @param input Isian formulir mentah.
   * @returns Sewa yang tersimpan.
   * @throws {ValidationError} Bila isian tidak sah atau tidak cocok dengan garasi.
   * @throws {ConflictError} Bila garasi sudah disewa atau harga per kWh belum diatur.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async createRental(renterId: number, input: unknown): Promise<RentalView> {
    const today = todayInJakarta(this.clock());
    const data = parseInput(createRentalSchema(maxDailyDays(today)), input);
    const vehicle = VehicleFactory.create(data.vehicleType);
    const proofType = detectProofImageType(data.paymentProof) as ProofImageType;

    let berkas: string | null = null;
    try {
      await this.rentals.releaseExpiredGarages(today);
      const garage = await this.rentals.findGarageById(data.garageId);
      if (garage === null || garage.type !== data.garageType) {
        throw new ValidationError({
          garageId: ['Garasi tidak sesuai dengan tipe garasi yang dipilih'],
        });
      }
      if (garage.status !== 'AVAILABLE') {
        throw new ConflictError('Garasi sudah disewa, pilih garasi lain');
      }

      const chargesBattery = vehicle.chargesBatteryIn(garage.type);
      if (chargesBattery && garage.pricePerKwh === null) {
        throw new ConflictError('Harga per kWh belum diatur');
      }
      const endDate = computeEndDate(today, data.rentalType, data.days);
      const biaya = calculateRentalCost({
        rentalType: data.rentalType,
        days: data.rentalType === 'HARIAN' ? (data.days ?? null) : null,
        dailyPrice: garage.dailyPrice,
        chargesBattery,
        batteryKwh: data.batteryKwh ?? null,
        pricePerKwh: garage.pricePerKwh,
      });

      berkas = await this.proofs.save(data.paymentProof, proofType);
      const tersimpan = await this.rentals.createRental({
        renterId,
        garageId: garage.id,
        vehicleType: data.vehicleType,
        plateNumber: vehicle.requiresPlate() ? (data.plateNumber ?? null) : null,
        vehicleBrand: data.vehicleBrand,
        vehicleModel: data.vehicleModel,
        batteryKwh: vehicle.requiresBattery() ? (data.batteryKwh ?? null) : null,
        rentalType: data.rentalType,
        days: data.rentalType === 'HARIAN' ? (data.days ?? null) : null,
        startDate: today,
        endDate,
        dailyPrice: garage.dailyPrice,
        pricePerKwh: chargesBattery ? garage.pricePerKwh : null,
        chargeCost: biaya.chargeCost,
        totalCost: biaya.totalCost,
        paymentProofFile: berkas,
      });
      return this.toView(tersimpan, today);
    } catch (error) {
      if (berkas !== null) {
        await this.proofs.remove(berkas).catch(() => undefined);
      }
      throw toAppError(error);
    }
  }

  /**
   * Mengambil sewa milik satu penyewa; sewa penyewa lain tidak pernah ikut.
   *
   * @param renterId Id penyewa.
   * @returns Sewa terbaru lebih dulu.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async listMyRentals(renterId: number): Promise<RentalView[]> {
    const today = todayInJakarta(this.clock());
    try {
      const baris = await this.rentals.findByRenter(renterId);
      return baris.map((row) => this.toView(row, today));
    } catch (error) {
      throw toAppError(error);
    }
  }

  /**
   * Mengambil bukti pembayaran bagi pemilik sewa atau Admin. Pengguna lain
   * mendapat error yang sama dengan sewa yang tidak ada agar keberadaan sewa
   * tidak bocor.
   *
   * @param viewer Pengguna yang meminta.
   * @param rentalId Id sewa.
   * @returns Isi gambar dan tipe kontennya.
   * @throws {NotFoundError} Bila sewa atau berkas tidak ada, atau pengguna tidak berhak.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async getPaymentProof(viewer: ProofViewer, rentalId: number): Promise<PaymentProofFile> {
    try {
      const sewa = await this.rentals.findById(rentalId);
      if (sewa === null || (viewer.role !== 'ADMIN' && sewa.renterId !== viewer.id)) {
        throw new NotFoundError('Bukti pembayaran tidak ditemukan.');
      }
      const bytes = await this.proofs.read(sewa.paymentProofFile);
      const ekstensi = sewa.paymentProofFile.split('.').pop() as ProofImageType;
      return { bytes, contentType: PROOF_CONTENT_TYPES[ekstensi] };
    } catch (error) {
      throw toAppError(error);
    }
  }

  /**
   * Mengubah data sewa menjadi tampilan lengkap dengan label dan status aktif.
   *
   * @param row Sewa dari repository.
   * @param today Tanggal hari ini (tanggal-saja).
   * @returns Tampilan sewa.
   */
  private toView(row: RentalRecord, today: Date): RentalView {
    const aktif = isRentalActive(row.endDate, today);
    return {
      id: row.id,
      garageId: row.garageId,
      garageTypeLabel: GarageFactory.create(row.garageType).label,
      vehicleTypeLabel: VehicleFactory.create(row.vehicleType).label,
      vehicleBrand: row.vehicleBrand,
      vehicleModel: row.vehicleModel,
      plateNumber: row.plateNumber,
      batteryKwh: row.batteryKwh,
      rentalTypeLabel: RENTAL_TYPE_LABELS[row.rentalType],
      days: row.days,
      startDate: toIsoDate(row.startDate),
      endDate: toIsoDate(row.endDate),
      startDateLabel: formatTanggal(row.startDate),
      endDateLabel: formatTanggal(row.endDate),
      dailyPrice: row.dailyPrice,
      chargeCost: row.chargeCost,
      totalCost: row.totalCost,
      isActive: aktif,
      statusLabel: aktif ? 'Aktif' : 'Selesai',
    };
  }
}
