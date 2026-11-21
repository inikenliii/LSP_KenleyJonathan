/**
 * @file Layanan garasi: aturan bisnis pembuatan garasi berkelompok.
 */
import { GarageFactory, GarageIdGenerator, toAppError } from '@/domain';
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
}

/**
 * Menangani pembuatan garasi berkelompok. Repository dan perencana ID
 * diterima lewat konstruktor sehingga mudah diganti saat pengujian.
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
}
