/**
 * @file Kontrak penyimpanan sesi login.
 */

/**
 * Kontrak repository sesi. Sesi dikenali lewat hash SHA-256 dari token cookie,
 * bukan token aslinya, sehingga isi tabel tidak bisa dipakai untuk masuk.
 */
export interface ISessionRepository {
  /**
   * Menyimpan sesi baru.
   *
   * @param sidHash Hash SHA-256 (heksadesimal) dari token sesi.
   * @param userId Id pengguna pemilik sesi.
   * @param expiresAt Waktu sesi kedaluwarsa.
   */
  create(sidHash: string, userId: number, expiresAt: Date): Promise<void>;

  /**
   * Mencari pemilik sesi yang masih berlaku.
   *
   * @param sidHash Hash SHA-256 dari token sesi.
   * @param now Waktu saat ini sebagai pembanding kedaluwarsa.
   * @returns Id pengguna, atau `null` bila sesi tidak ada, sudah kedaluwarsa, atau isinya tidak valid.
   */
  findUserId(sidHash: string, now: Date): Promise<number | null>;

  /**
   * Menghapus satu sesi; tidak error bila sesi tidak ada.
   *
   * @param sidHash Hash SHA-256 dari token sesi.
   */
  delete(sidHash: string): Promise<void>;

  /**
   * Menghapus semua sesi yang sudah kedaluwarsa.
   *
   * @param now Waktu saat ini sebagai pembanding.
   * @returns Jumlah sesi yang dihapus.
   */
  deleteExpired(now: Date): Promise<number>;
}
