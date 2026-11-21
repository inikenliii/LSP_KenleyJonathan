/**
 * @file Layanan perpanjangan sewa: daftar sewa yang aktif hari ini, perpanjangan
 * oleh Admin dengan sisa biaya yang dihitung server, riwayat perpanjangan, dan
 * akses bukti pembayaran perpanjangan.
 */
import {
  ConflictError,
  EXTENSION_TOO_FAR_MESSAGE,
  ExtensionQuantityError,
  ExtensionTooFarError,
  GarageFactory,
  NotFoundError,
  PROOF_CONTENT_TYPES,
  RENTAL_TYPE_LABELS,
  ValidationError,
  VehicleFactory,
  calculateExtensionCost,
  detectProofImageType,
  formatTanggal,
  formatTanggalWaktu,
  isRentalActive,
  maxExtensionDays,
  toAppError,
  toIsoDate,
  todayInJakarta,
  type ExtensionCostBreakdown,
  type ProofImageType,
  type RentalTypeCode,
} from '@/domain';
import type { IPaymentProofStorage } from '@/lib/payment-proof-storage';
import type {
  ExtendableRentalRecord,
  ExtensionRecord,
  IRentalExtensionRepository,
} from '@/repositories';
import { extendRentalSchema, parseInput } from '@/validation';
import type { PaymentProofFile, ProofViewer } from './RentalService';

/** Satu sewa yang bisa diperpanjang, siap ditampilkan kepada Admin. */
export interface ExtendableRentalView {
  /** Id sewa. */
  id: number;
  /** ID garasi. */
  garageId: string;
  /** Nama tipe garasi. */
  garageTypeLabel: string;
  /** Nama lengkap penyewa. */
  renterName: string;
  /** Nama tipe kendaraan. */
  vehicleTypeLabel: string;
  /** Nomor plat; null untuk sepeda. */
  plateNumber: string | null;
  /** Merek kendaraan. */
  vehicleBrand: string;
  /** Tipe/model kendaraan. */
  vehicleModel: string;
  /** Nama tipe sewa ("Harian" atau "Bulanan"). */
  rentalTypeLabel: string;
  /** Tanggal mulai, `YYYY-MM-DD`. */
  startDate: string;
  /** Tanggal berakhir saat ini, `YYYY-MM-DD`. */
  endDate: string;
  /** Tanggal mulai dalam Bahasa Indonesia. */
  startDateLabel: string;
  /** Tanggal berakhir dalam Bahasa Indonesia. */
  endDateLabel: string;
  /** Salinan harga harian sewa, dasar sisa biaya perpanjangan. */
  dailyPrice: number;
  /** Apakah sewa masih berlaku hari ini. */
  isActive: boolean;
  /** Jumlah hari terbanyak untuk perpanjangan harian (hari pada bulan tanggal berakhir - 1). */
  maxExtensionDays: number;
}

/** Satu perpanjangan yang sudah tersimpan, siap ditampilkan. */
export interface ExtensionView {
  /** Id perpanjangan. */
  id: number;
  /** Id sewa yang diperpanjang. */
  rentalId: number;
  /** Tanggal berakhir sebelumnya, `YYYY-MM-DD`. */
  previousEndDate: string;
  /** Tanggal berakhir baru, `YYYY-MM-DD`. */
  newEndDate: string;
  /** Tanggal berakhir sebelumnya dalam Bahasa Indonesia. */
  previousEndDateLabel: string;
  /** Tanggal berakhir baru dalam Bahasa Indonesia. */
  newEndDateLabel: string;
  /** Jenis perpanjangan: "HARIAN" atau "BULANAN". */
  extensionType: RentalTypeCode;
  /** Nama jenis perpanjangan ("Harian" atau "Bulanan"). */
  extensionTypeLabel: string;
  /** Jumlah hari (harian) atau jumlah bulan (bulanan). */
  quantity: number;
  /** Jumlah dengan satuannya, misalnya "10 hari" atau "2 bulan". */
  quantityLabel: string;
  /** Jumlah hari kalender tambahan. */
  additionalDays: number;
  /** Salinan harga harian yang dipakai. */
  dailyPrice: number;
  /** Sisa biaya dalam rupiah bulat. */
  amount: number;
  /** Nama Admin yang menyimpan. */
  adminName: string;
  /** Waktu perpanjangan disimpan dalam Bahasa Indonesia (Asia/Jakarta). */
  createdAtLabel: string;
}

/** Sewa beserta riwayat perpanjangannya. */
export interface RentalExtensionDetail {
  /** Sewa yang dipilih. */
  rental: ExtendableRentalView;
  /** Perpanjangan sewa itu, dari yang paling lama. */
  extensions: ExtensionView[];
}

/** Kontrak layanan perpanjangan sewa. */
export interface IRentalExtensionService {
  /**
   * Membaca sewa yang aktif hari ini.
   *
   * @returns Sewa aktif, urut menurut ID garasi.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  listActiveRentals(): Promise<ExtendableRentalView[]>;

  /**
   * Membaca satu sewa beserta riwayat perpanjangannya.
   *
   * @param rentalId Id sewa.
   * @returns Sewa dan perpanjangannya.
   * @throws {NotFoundError} Bila sewa tidak ada.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  getRentalExtensions(rentalId: number): Promise<RentalExtensionDetail>;

  /**
   * Memperpanjang sewa yang masih aktif secara harian atau bulanan. Tanggal berakhir
   * lama dan baru, tambahan hari, harga harian, dan sisa biaya dihitung server dari
   * sewa tersimpan.
   *
   * @param adminId Id Admin dari sesi (bukan dari formulir).
   * @param input Isian formulir mentah (id sewa, jenis, jumlah, dan byte bukti pembayaran).
   * @returns Perpanjangan yang tersimpan.
   * @throws {ValidationError} Bila isian tidak sah, jumlah di luar batas jenisnya, atau hasilnya
   *   terlalu jauh sehingga tambahan hari atau sisa biaya melewati batas database.
   * @throws {NotFoundError} Bila sewa tidak ada.
   * @throws {ConflictError} Bila sewa sudah berakhir atau berubah saat disimpan.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  extendRental(adminId: number, input: unknown): Promise<ExtensionView>;

  /**
   * Mengambil bukti pembayaran satu perpanjangan untuk Admin atau pemilik sewa.
   *
   * @param viewer Pengguna yang meminta.
   * @param extensionId Id perpanjangan.
   * @returns Isi gambar dan tipe kontennya.
   * @throws {NotFoundError} Bila perpanjangan atau berkas tidak ada, atau pengguna tidak berhak.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  getExtensionProof(viewer: ProofViewer, extensionId: number): Promise<PaymentProofFile>;
}

/**
 * Menangani perpanjangan sewa oleh Admin. Repository, penyimpanan berkas, dan
 * jam diterima lewat konstruktor sehingga mudah diganti saat pengujian.
 */
export class RentalExtensionService implements IRentalExtensionService {
  /**
   * @param extensions Repository perpanjangan sewa.
   * @param proofs Penyimpanan bukti pembayaran.
   * @param clock Sumber waktu; bawaannya jam sistem.
   */
  constructor(
    private readonly extensions: IRentalExtensionRepository,
    private readonly proofs: IPaymentProofStorage,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * Membaca sewa yang aktif hari ini (hari ini di Jakarta).
   *
   * @returns Sewa aktif, urut menurut ID garasi.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async listActiveRentals(): Promise<ExtendableRentalView[]> {
    const today = todayInJakarta(this.clock());
    try {
      const baris = await this.extensions.findActiveRentals(today);
      return baris.map((row) => this.toRentalView(row, today));
    } catch (error) {
      throw toAppError(error);
    }
  }

  /**
   * Membaca satu sewa beserta riwayat perpanjangannya.
   *
   * @param rentalId Id sewa.
   * @returns Sewa dan perpanjangannya, dari yang paling lama.
   * @throws {NotFoundError} Bila sewa tidak ada.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async getRentalExtensions(rentalId: number): Promise<RentalExtensionDetail> {
    const today = todayInJakarta(this.clock());
    try {
      const sewa = await this.extensions.findRentalById(rentalId);
      if (sewa === null) {
        throw new NotFoundError('Sewa tidak ditemukan.');
      }
      const riwayat = await this.extensions.findByRental(rentalId);
      return {
        rental: this.toRentalView(sewa, today),
        extensions: riwayat.map((row) => this.toExtensionView(row)),
      };
    } catch (error) {
      throw toAppError(error);
    }
  }

  /**
   * Memperpanjang sewa secara harian atau bulanan. Berkas bukti disimpan setelah semua
   * pemeriksaan lolos dan dihapus lagi bila penyimpanan perpanjangan gagal (misalnya kalah balapan).
   *
   * @param adminId Id Admin dari sesi.
   * @param input Isian formulir mentah.
   * @returns Perpanjangan yang tersimpan.
   * @throws {ValidationError} Bila isian tidak sah, jumlah di luar batas jenisnya, atau hasilnya
   *   terlalu jauh sehingga tambahan hari atau sisa biaya melewati batas database.
   * @throws {NotFoundError} Bila sewa tidak ada.
   * @throws {ConflictError} Bila sewa sudah berakhir atau berubah saat disimpan.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async extendRental(adminId: number, input: unknown): Promise<ExtensionView> {
    const today = todayInJakarta(this.clock());
    const data = parseInput(extendRentalSchema, input);
    const proofType = detectProofImageType(data.paymentProof) as ProofImageType;

    let berkas: string | null = null;
    try {
      const sewa = await this.extensions.findRentalById(data.rentalId);
      if (sewa === null) {
        throw new NotFoundError('Sewa tidak ditemukan.');
      }
      if (sewa.startDate.getTime() > today.getTime() || !isRentalActive(sewa.endDate, today)) {
        throw new ConflictError('Sewa sudah berakhir dan tidak bisa diperpanjang');
      }
      let biaya: ExtensionCostBreakdown;
      try {
        biaya = calculateExtensionCost({
          extensionType: data.extensionType,
          quantity: data.quantity,
          currentEndDate: sewa.endDate,
          dailyPrice: sewa.dailyPrice,
        });
      } catch (error) {
        if (error instanceof ExtensionQuantityError) {
          throw new ValidationError({ quantity: [error.message] });
        }
        if (error instanceof ExtensionTooFarError) {
          throw new ValidationError({ quantity: [EXTENSION_TOO_FAR_MESSAGE] });
        }
        throw error;
      }

      berkas = await this.proofs.save(data.paymentProof, proofType);
      const tersimpan = await this.extensions.createExtension(
        {
          rentalId: sewa.id,
          previousEndDate: sewa.endDate,
          newEndDate: biaya.newEndDate,
          extensionType: data.extensionType,
          quantity: data.quantity,
          additionalDays: biaya.additionalDays,
          dailyPrice: sewa.dailyPrice,
          amount: biaya.amount,
          paymentProofFile: berkas,
          adminId,
        },
        today,
      );
      return this.toExtensionView(tersimpan);
    } catch (error) {
      if (berkas !== null) {
        await this.proofs.remove(berkas).catch(() => undefined);
      }
      throw toAppError(error);
    }
  }

  /**
   * Mengambil bukti pembayaran perpanjangan bagi Admin atau pemilik sewa.
   * Pengguna lain mendapat error yang sama dengan perpanjangan yang tidak ada
   * agar keberadaannya tidak bocor.
   *
   * @param viewer Pengguna yang meminta.
   * @param extensionId Id perpanjangan.
   * @returns Isi gambar dan tipe kontennya.
   * @throws {NotFoundError} Bila perpanjangan atau berkas tidak ada, atau pengguna tidak berhak.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async getExtensionProof(viewer: ProofViewer, extensionId: number): Promise<PaymentProofFile> {
    try {
      const perpanjangan = await this.extensions.findById(extensionId);
      if (
        perpanjangan === null ||
        (viewer.role !== 'ADMIN' && perpanjangan.renterId !== viewer.id)
      ) {
        throw new NotFoundError('Bukti pembayaran tidak ditemukan.');
      }
      const bytes = await this.proofs.read(perpanjangan.paymentProofFile);
      const ekstensi = perpanjangan.paymentProofFile.split('.').pop() as ProofImageType;
      return { bytes, contentType: PROOF_CONTENT_TYPES[ekstensi] };
    } catch (error) {
      throw toAppError(error);
    }
  }

  /**
   * Mengubah data sewa menjadi tampilan dengan label dan batas hari perpanjangan harian.
   *
   * @param row Sewa dari repository.
   * @param today Tanggal hari ini (tanggal-saja).
   * @returns Tampilan sewa.
   */
  private toRentalView(row: ExtendableRentalRecord, today: Date): ExtendableRentalView {
    return {
      id: row.id,
      garageId: row.garageId,
      garageTypeLabel: GarageFactory.create(row.garageType).label,
      renterName: row.renterName,
      vehicleTypeLabel: VehicleFactory.create(row.vehicleType).label,
      plateNumber: row.plateNumber,
      vehicleBrand: row.vehicleBrand,
      vehicleModel: row.vehicleModel,
      rentalTypeLabel: RENTAL_TYPE_LABELS[row.rentalType],
      startDate: toIsoDate(row.startDate),
      endDate: toIsoDate(row.endDate),
      startDateLabel: formatTanggal(row.startDate),
      endDateLabel: formatTanggal(row.endDate),
      dailyPrice: row.dailyPrice,
      isActive: row.startDate.getTime() <= today.getTime() && isRentalActive(row.endDate, today),
      maxExtensionDays: maxExtensionDays(row.endDate),
    };
  }

  /**
   * Mengubah data perpanjangan menjadi tampilan dengan label tanggal dan waktu.
   *
   * @param row Perpanjangan dari repository.
   * @returns Tampilan perpanjangan.
   */
  private toExtensionView(row: ExtensionRecord): ExtensionView {
    return {
      id: row.id,
      rentalId: row.rentalId,
      previousEndDate: toIsoDate(row.previousEndDate),
      newEndDate: toIsoDate(row.newEndDate),
      previousEndDateLabel: formatTanggal(row.previousEndDate),
      newEndDateLabel: formatTanggal(row.newEndDate),
      extensionType: row.extensionType,
      extensionTypeLabel: RENTAL_TYPE_LABELS[row.extensionType],
      quantity: row.quantity,
      quantityLabel: `${row.quantity} ${row.extensionType === 'BULANAN' ? 'bulan' : 'hari'}`,
      additionalDays: row.additionalDays,
      dailyPrice: row.dailyPrice,
      amount: row.amount,
      adminName: row.adminName,
      createdAtLabel: formatTanggalWaktu(row.createdAt),
    };
  }
}
