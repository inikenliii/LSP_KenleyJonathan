/**
 * @file Layanan garasi: aturan bisnis pembuatan garasi berkelompok dan
 * tampilan harga serta daftar garasi.
 */
import {
  GARAGE_TYPE_CODES,
  GarageFactory,
  GarageIdGenerator,
  monthlyPrice,
  toAppError,
  type GarageStatusCode,
  type GarageTypeCode,
} from '@/domain';
import type { IGarageRepository } from '@/repositories';
import { garageBatchSchema, parseInput } from '@/validation';

/** Hasil satu pembuatan garasi berkelompok. */
export interface GarageBatchResult {
  /** Nama tipe garasi, misalnya "Sepeda". */
  typeLabel: string;
  /** Jumlah garasi yang dibuat. */
  count: number;
  /** ID garasi pertama dalam batch. */
  firstId: string;
  /** ID garasi terakhir dalam batch. */
  lastId: string;
  /** Contoh ringkasan garasi dengan harganya. */
  summary: string;
}

/** Konfigurasi satu tipe garasi untuk tabel harga dan kuota. */
export interface GarageTypeConfigView {
  /** Kode tipe garasi. */
  code: GarageTypeCode;
  /** Nama tipe untuk tampilan. */
  label: string;
  /** Awalan ID, misalnya "S". */
  prefix: string;
  /** Apakah tipe ini memiliki harga per kWh. */
  usesKwhPrice: boolean;
  /** Harga harian dalam rupiah; 0 berarti belum diatur. */
  dailyPrice: number;
  /** Harga bulanan (25 x harian); null selama harga harian belum diatur. */
  monthlyPrice: number | null;
  /** Harga per kWh; null bila tidak ada. */
  pricePerKwh: number | null;
  /** Jumlah garasi yang sudah dibuat untuk tipe ini. */
  totalCreated: number;
  /** Sisa garasi yang masih boleh dibuat untuk tipe ini. */
  remainingQuota: number;
}

/** Satu baris daftar garasi untuk Admin. */
export interface GarageListItem {
  /** ID garasi, misalnya "S001". */
  id: string;
  /** Kode tipe garasi. */
  type: GarageTypeCode;
  /** Nama tipe untuk tampilan. */
  typeLabel: string;
  /** Harga harian dalam rupiah. */
  dailyPrice: number;
  /** Harga bulanan (25 x harian); tidak disimpan di database. */
  monthlyPrice: number;
  /** Harga per kWh; hanya untuk Mobil Listrik, selain itu null. */
  pricePerKwh: number | null;
  /** Kode status garasi. */
  status: GarageStatusCode;
  /** Label status: "tersedia" atau "used". */
  statusLabel: string;
}

/** Kontrak layanan garasi. */
export interface IGarageService {
  /**
   * Membuat garasi berkelompok untuk satu tipe.
   *
   * @param input Isian formulir (belum divalidasi): `type`, `quantity`, `dailyPrice`, `pricePerKwh`.
   * @returns Ringkasan batch yang dibuat.
   * @throws {ValidationError} Bila masukan tidak valid.
   * @throws {CapacityExceededError} Bila batch melebihi 999 garasi untuk tipe ini.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  createBatch(input: unknown): Promise<GarageBatchResult>;

  /**
   * Mengambil konfigurasi tiap tipe untuk tabel harga dan kuota.
   *
   * @returns Tiga tipe dalam urutan sepeda, mobil, mobil listrik.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  getTypeConfigs(): Promise<GarageTypeConfigView[]>;

  /**
   * Mengambil semua garasi untuk daftar Admin.
   *
   * @returns Garasi urut menurut ID, lengkap dengan harga dan status.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  listGarages(): Promise<GarageListItem[]>;
}

/**
 * Menangani pembuatan garasi berkelompok serta tampilan harga dan daftar
 * garasi. Repository dan perencana ID diterima lewat konstruktor sehingga
 * mudah diganti saat pengujian.
 */
export class GarageService implements IGarageService {
  /**
   * @param garages Repository garasi.
   * @param idGenerator Perencana ID garasi.
   */
  constructor(
    private readonly garages: IGarageRepository,
    private readonly idGenerator: GarageIdGenerator = new GarageIdGenerator(),
  ) {}

  /**
   * Membuat garasi berkelompok: memvalidasi masukan, lalu menyimpan batch dan
   * harga tipe dalam satu transaksi.
   *
   * @param input Isian formulir (belum divalidasi): `type`, `quantity`, `dailyPrice`, `pricePerKwh`.
   * @returns Ringkasan batch yang dibuat.
   * @throws {ValidationError} Bila masukan tidak valid.
   * @throws {CapacityExceededError} Bila batch melebihi 999 garasi untuk tipe ini.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async createBatch(input: unknown): Promise<GarageBatchResult> {
    const data = parseInput(garageBatchSchema, input);
    const garage = GarageFactory.create(data.type);
    try {
      const rencana = await this.garages.createBatch(data, (terakhir) =>
        this.idGenerator.planBatch(garage, terakhir, data.quantity),
      );
      const pertama = GarageFactory.create(data.type, rencana.ids[0]);
      // describe dipanggil sama untuk semua tipe; setiap subkelas menjawab dengan caranya.
      const ringkasan =
        data.pricePerKwh === undefined
          ? pertama.describe(data.dailyPrice)
          : pertama.describe(data.dailyPrice, data.pricePerKwh);
      return {
        typeLabel: garage.label,
        count: rencana.ids.length,
        firstId: rencana.ids[0],
        lastId: rencana.ids[rencana.ids.length - 1],
        summary: ringkasan,
      };
    } catch (error) {
      throw toAppError(error);
    }
  }

  /**
   * Mengambil konfigurasi tiap tipe untuk tabel harga dan kuota. Label,
   * awalan, dan aturan harga per kWh dijawab oleh subkelas Garage.
   *
   * @returns Tiga tipe dalam urutan `GARAGE_TYPE_CODES`.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async getTypeConfigs(): Promise<GarageTypeConfigView[]> {
    try {
      const baris = await this.garages.findAllConfigs();
      // Diurutkan eksplisit menurut GARAGE_TYPE_CODES, tidak bergantung urutan di database.
      baris.sort((a, b) => GARAGE_TYPE_CODES.indexOf(a.type) - GARAGE_TYPE_CODES.indexOf(b.type));
      return baris.map((row) => {
        const garage = GarageFactory.create(row.type);
        return {
          code: row.type,
          label: garage.label,
          prefix: garage.idPrefix,
          usesKwhPrice: garage.usesKwhPrice(),
          dailyPrice: row.dailyPrice,
          monthlyPrice: row.dailyPrice > 0 ? monthlyPrice(row.dailyPrice) : null,
          pricePerKwh: row.pricePerKwh,
          totalCreated: row.lastNumber,
          remainingQuota: this.idGenerator.remainingQuota(row.lastNumber),
        };
      });
    } catch (error) {
      throw toAppError(error);
    }
  }

  /**
   * Mengambil semua garasi untuk daftar Admin, urut menurut ID, lengkap dengan
   * harga harian, harga bulanan (25 x harian, tidak disimpan), harga per kWh,
   * dan status.
   *
   * @returns Daftar garasi.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async listGarages(): Promise<GarageListItem[]> {
    try {
      const baris = await this.garages.findAll();
      return baris.map((row) => {
        const garage = GarageFactory.create(row.type, row.id, row.status);
        return {
          id: row.id,
          type: garage.type,
          typeLabel: garage.label,
          dailyPrice: row.dailyPrice,
          monthlyPrice: monthlyPrice(row.dailyPrice),
          pricePerKwh: garage.usesKwhPrice() ? row.pricePerKwh : null,
          status: garage.status,
          statusLabel: garage.statusLabel,
        };
      });
    } catch (error) {
      throw toAppError(error);
    }
  }
}
