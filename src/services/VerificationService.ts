/**
 * @file Layanan verifikasi pendaftar: aturan bisnis admin menerima atau
 * menolak penyewa baru.
 */
import {
  ConflictError,
  NotFoundError,
  VERIFICATION_STATUS,
  toAppError,
  type UserDTO,
} from '@/domain';
import type { IUserRepository } from '@/repositories';
import { parseInput, verificationDecisionSchema } from '@/validation';

/** Hasil satu keputusan verifikasi. */
export interface VerificationResult {
  /** Status baru pendaftar. */
  status: 'ACCEPTED' | 'REJECTED';
  /** Nama lengkap pendaftar yang diputuskan. */
  fullName: string;
}

/** Kontrak layanan verifikasi pendaftar. */
export interface IVerificationService {
  /**
   * Mengambil penyewa yang menunggu verifikasi.
   *
   * @returns Pendaftar berstatus PENDING, terlama dulu.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  listPending(): Promise<UserDTO[]>;

  /**
   * Menerima atau menolak seorang pendaftar.
   *
   * @param input Data keputusan (belum divalidasi): `userId`, `decision`, dan `ktpValidated`.
   * @param adminId Id admin yang memutuskan (dari sesi, bukan dari formulir).
   * @returns Status baru dan nama pendaftar.
   * @throws {NotFoundError} Bila id tidak valid, tidak ada, atau bukan penyewa.
   * @throws {ValidationError} Bila keputusan tidak valid atau konfirmasi KTP belum dicentang.
   * @throws {ConflictError} Bila pendaftar sudah diputuskan sebelumnya.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  decide(input: unknown, adminId: number): Promise<VerificationResult>;
}

/**
 * Menangani daftar pendaftar baru dan keputusan verifikasinya. Repository
 * diterima lewat konstruktor sehingga mudah diganti saat pengujian.
 */
export class VerificationService implements IVerificationService {
  /** Pesan bila pendaftar tidak ada atau bukan penyewa. */
  private static readonly NOT_FOUND_MESSAGE = 'Pendaftar tidak ditemukan.';

  /** Pesan bila pendaftar sudah diterima atau ditolak sebelumnya. */
  private static readonly ALREADY_DECIDED_MESSAGE = 'Pendaftar ini sudah diproses sebelumnya.';

  /**
   * @param users Repository pengguna.
   */
  constructor(private readonly users: IUserRepository) {}

  /**
   * Mengambil penyewa yang menunggu verifikasi.
   *
   * @returns Pendaftar berstatus PENDING, terlama dulu.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async listPending(): Promise<UserDTO[]> {
    try {
      const pendaftar = await this.users.findPendingRenters();
      return pendaftar.map((user) => user.toDTO());
    } catch (error) {
      throw toAppError(error);
    }
  }

  /**
   * Menerima atau menolak seorang pendaftar. Menerima mewajibkan konfirmasi
   * bahwa KTP sudah divalidasi. Admin yang memutuskan dan waktunya disimpan.
   *
   * @param input Data keputusan (belum divalidasi): `userId`, `decision`, dan `ktpValidated`.
   * @param adminId Id admin yang memutuskan.
   * @returns Status baru dan nama pendaftar.
   * @throws {NotFoundError} Bila id tidak valid, tidak ada, atau bukan penyewa.
   * @throws {ValidationError} Bila keputusan tidak valid atau konfirmasi KTP belum dicentang.
   * @throws {ConflictError} Bila pendaftar sudah diputuskan sebelumnya.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async decide(input: unknown, adminId: number): Promise<VerificationResult> {
    const { userId, decision, ktpValidated } = (input ?? {}) as Record<string, unknown>;
    if (typeof userId !== 'string' || !/^\d+$/.test(userId) || Number(userId) < 1) {
      throw new NotFoundError(VerificationService.NOT_FOUND_MESSAGE);
    }
    const id = Number(userId);
    const data = parseInput(verificationDecisionSchema, { decision, ktpValidated });

    try {
      const target = await this.users.findById(id);
      if (target === null || !target.isRenter()) {
        throw new NotFoundError(VerificationService.NOT_FOUND_MESSAGE);
      }
      if (!target.isPending()) {
        throw new ConflictError(VerificationService.ALREADY_DECIDED_MESSAGE);
      }
      const status =
        data.decision === 'ACCEPT' ? VERIFICATION_STATUS.ACCEPTED : VERIFICATION_STATUS.REJECTED;
      const jumlahBerubah = await this.users.decideVerification(id, {
        status,
        verifiedById: adminId,
      });
      if (jumlahBerubah === 0) {
        throw new ConflictError(VerificationService.ALREADY_DECIDED_MESSAGE);
      }
      return { status, fullName: target.fullName };
    } catch (error) {
      throw toAppError(error);
    }
  }
}
