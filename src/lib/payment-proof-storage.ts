/**
 * @file Penyimpanan berkas bukti pembayaran: kontrak dan implementasi di folder
 * lokal `uploads/` (di luar `public/`, tidak masuk Git).
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NotFoundError, type ProofImageType } from '@/domain';

/** Folder bawaan tempat bukti pembayaran disimpan. */
export const DEFAULT_PAYMENT_PROOF_DIR = path.join(process.cwd(), 'uploads', 'bukti-pembayaran');

/** Kontrak penyimpanan bukti pembayaran, agar layanan tidak bergantung pada sistem berkas. */
export interface IPaymentProofStorage {
  /**
   * Menyimpan bukti pembayaran dengan nama acak yang dibuat server.
   *
   * @param bytes Isi gambar.
   * @param type Jenis gambar hasil deteksi tanda tangan byte.
   * @returns Nama berkas yang disimpan (tanpa folder).
   */
  save(bytes: Uint8Array, type: ProofImageType): Promise<string>;

  /**
   * Membaca bukti pembayaran.
   *
   * @param fileName Nama berkas yang dikembalikan `save`.
   * @returns Isi berkas.
   * @throws {NotFoundError} Bila nama tidak sah atau berkas tidak ada.
   */
  read(fileName: string): Promise<Uint8Array<ArrayBuffer>>;

  /**
   * Menghapus bukti pembayaran; berkas yang sudah tidak ada diabaikan.
   *
   * @param fileName Nama berkas yang dikembalikan `save`.
   * @throws {NotFoundError} Bila nama tidak sah.
   */
  remove(fileName: string): Promise<void>;
}

/** Penyimpanan bukti pembayaran pada folder lokal. */
export class LocalPaymentProofStorage implements IPaymentProofStorage {
  /** Pola nama berkas yang sah: UUID dan ekstensi gambar; mencegah path keluar folder. */
  private static readonly NAME_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

  /**
   * @param directory Folder penyimpanan; bawaannya `uploads/bukti-pembayaran`.
   */
  constructor(private readonly directory: string = DEFAULT_PAYMENT_PROOF_DIR) {}

  /**
   * Menyimpan berkas dengan nama acak `UUID.ekstensi`; folder dibuat bila belum ada.
   *
   * @param bytes Isi gambar.
   * @param type Jenis gambar.
   * @returns Nama berkas yang disimpan.
   */
  async save(bytes: Uint8Array, type: ProofImageType): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const nama = `${randomUUID()}.${type}`;
    await writeFile(path.join(/*turbopackIgnore: true*/ this.directory, nama), bytes, { flag: 'wx' });
    return nama;
  }

  /**
   * Membaca berkas setelah memeriksa pola namanya.
   *
   * @param fileName Nama berkas.
   * @returns Isi berkas.
   * @throws {NotFoundError} Bila nama tidak sah atau berkas tidak ada.
   */
  async read(fileName: string): Promise<Uint8Array<ArrayBuffer>> {
    const lokasi = this.resolve(fileName);
    try {
      return new Uint8Array(await readFile(lokasi));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundError('Bukti pembayaran tidak ditemukan.');
      }
      throw error;
    }
  }

  /**
   * Menghapus berkas setelah memeriksa pola namanya; berkas yang tidak ada diabaikan.
   *
   * @param fileName Nama berkas.
   * @throws {NotFoundError} Bila nama tidak sah.
   */
  async remove(fileName: string): Promise<void> {
    await rm(this.resolve(fileName), { force: true });
  }

  /**
   * Mengubah nama berkas menjadi lokasi di dalam folder penyimpanan.
   *
   * @param fileName Nama berkas.
   * @returns Lokasi lengkap berkas.
   * @throws {NotFoundError} Bila nama tidak cocok dengan pola yang sah.
   */
  private resolve(fileName: string): string {
    if (!LocalPaymentProofStorage.NAME_PATTERN.test(fileName)) {
      throw new NotFoundError('Bukti pembayaran tidak ditemukan.');
    }
    return path.join(/*turbopackIgnore: true*/ this.directory, fileName);
  }
}
