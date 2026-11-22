/**
 * @file Layanan sewa: aturan bisnis sewa baru (kecocokan kendaraan dan garasi,
 * ketersediaan, tanggal, biaya, bukti pembayaran) dan tampilan sewa penyewa.
 *
 * Tanggal mulai boleh hari ini sampai satu tahun ke depan, tidak boleh
 * kemarin; tanggal berakhir selalu dihitung server dari tanggal mulai itu.
 * Asumsi sederhana: garasi langsung berstatus used begitu disewa, juga untuk
 * tanggal mulai di masa depan. Garasi baru dilepas oleh pelepasan yang sudah
 * ada, yaitu saat semua sewanya berakhir sebelum hari ini, sehingga garasi
 * yang disewa untuk masa depan tidak tersedia bagi penyewa lain sementara itu.
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
  latestStartDate,
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
  /** Hari ini di Jakarta, format `YYYY-MM-DD`: nilai bawaan dan batas paling awal tanggal mulai. */
  today: string;
  /** Tanggal mulai paling akhir yang diizinkan (satu tahun dari hari ini), format `YYYY-MM-DD`. */
  maxStartDate: string;
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
  /** Sisa baterai (kWh) saat disewa; hanya mobil listrik. */
  remainingKwh: number | null;
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
  /** Total biaya sewa awal dalam rupiah (tanpa perpanjangan). */
  totalCost: number;
  /** Perpanjangan sewa ini, dari yang paling lama; kosong bila belum pernah diperpanjang. */
  extensions: RentalExtensionLine[];
  /** Jumlah sisa biaya seluruh perpanjangan. */
  extensionTotal: number;
  /** Total biaya yang dibayar penyewa: biaya sewa awal ditambah seluruh perpanjangan. */
  grandTotal: number;
  /** Apakah sewa masih berlaku. */
  isActive: boolean;
  /** "Belum mulai", "Aktif", atau "Selesai". */
  statusLabel: string;
}

/** Satu perpanjangan pada sewa, untuk ditampilkan kepada penyewa. */
export interface RentalExtensionLine {
  /** Id perpanjangan (untuk tautan `/bukti-perpanjangan/<id>`). */
  id: number;
  /** Nama jenis perpanjangan ("Harian" atau "Bulanan"). */
  typeLabel: string;
  /** Jumlah dengan satuannya, misalnya "10 hari" atau "2 bulan". */
  quantityLabel: string;
  /** Tanggal berakhir baru dalam Bahasa Indonesia. */
  newEndDateLabel: string;
  /** Sisa biaya perpanjangan dalam rupiah. */
  amount: number;
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
   * Menyiapkan data formulir sewa baru: batas tanggal mulai dan garasi tersedia.
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
   * Mengambil semua sewa milik seorang penyewa beserta perpanjangannya.
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
   * Melepas garasi yang sewanya sudah berakhir, lalu mengembalikan batas
   * tanggal mulai (hari ini sampai satu tahun ke depan) dan garasi yang tersedia.
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
        maxStartDate: toIsoDate(latestStartDate(today)),
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
   * Membuat sewa baru. Tanggal mulai dari formulir diperiksa ulang terhadap
   * hari ini menurut server (tidak boleh kemarin, paling jauh satu tahun
   * ke depan); tanggal berakhir, biaya, dan harga dihitung server dari data
   * database. Garasi langsung berstatus used walau tanggal mulai di masa depan
   * (lihat catatan di bagian atas berkas). Berkas bukti disimpan setelah semua pemeriksaan lolos dan
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
    const data = parseInput(createRentalSchema(today), input);
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
      const endDate = computeEndDate(data.startDate, data.rentalType, data.days);
      const biaya = calculateRentalCost({
        rentalType: data.rentalType,
        days: data.rentalType === 'HARIAN' ? (data.days ?? null) : null,
        dailyPrice: garage.dailyPrice,
        chargesBattery,
        batteryKwh: data.batteryKwh ?? null,
        remainingKwh: data.remainingKwh ?? null,
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
        remainingKwh: vehicle.requiresBattery() ? (data.remainingKwh ?? null) : null,
        rentalType: data.rentalType,
        days: data.rentalType === 'HARIAN' ? (data.days ?? null) : null,
        startDate: data.startDate,
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
   * Mengambil sewa milik satu penyewa beserta perpanjangannya; sewa penyewa lain
   * tidak pernah ikut.
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
    const belumMulai = row.startDate.getTime() > today.getTime();
    const extensionTotal = row.extensions.reduce((jumlah, item) => jumlah + item.amount, 0);
    return {
      id: row.id,
      garageId: row.garageId,
      garageTypeLabel: GarageFactory.create(row.garageType).label,
      vehicleTypeLabel: VehicleFactory.create(row.vehicleType).label,
      vehicleBrand: row.vehicleBrand,
      vehicleModel: row.vehicleModel,
      plateNumber: row.plateNumber,
      batteryKwh: row.batteryKwh,
      remainingKwh: row.remainingKwh,
      rentalTypeLabel: RENTAL_TYPE_LABELS[row.rentalType],
      days: row.days,
      startDate: toIsoDate(row.startDate),
      endDate: toIsoDate(row.endDate),
      startDateLabel: formatTanggal(row.startDate),
      endDateLabel: formatTanggal(row.endDate),
      dailyPrice: row.dailyPrice,
      chargeCost: row.chargeCost,
      totalCost: row.totalCost,
      extensions: row.extensions.map((item) => ({
        id: item.id,
        typeLabel: RENTAL_TYPE_LABELS[item.extensionType],
        quantityLabel: `${item.quantity} ${item.extensionType === 'BULANAN' ? 'bulan' : 'hari'}`,
        newEndDateLabel: formatTanggal(item.newEndDate),
        amount: item.amount,
      })),
      extensionTotal,
      grandTotal: row.totalCost + extensionTotal,
      isActive: aktif,
      statusLabel: !aktif ? 'Selesai' : belumMulai ? 'Belum mulai' : 'Aktif',
    };
  }
}
