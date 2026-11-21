/**
 * @file Pengaman password: kontrak dan implementasi bcrypt.
 */
import bcrypt from 'bcryptjs';

/** Biaya (cost) bcrypt yang dipakai untuk menyimpan password. */
export const PASSWORD_HASH_ROUNDS = 12;

/** Kontrak pengaman password, agar layanan tidak bergantung pada pustaka tertentu. */
export interface IPasswordHasher {
  /**
   * Mengubah password asli menjadi hash.
   *
   * @param plain Password asli.
   * @returns Hash yang aman disimpan di database.
   */
  hash(plain: string): Promise<string>;

  /**
   * Memeriksa kecocokan password asli dengan hash.
   *
   * @param plain Password asli yang dimasukkan pengguna.
   * @param hash Hash yang tersimpan di database.
   * @returns `true` bila cocok.
   */
  verify(plain: string, hash: string): Promise<boolean>;
}

/** Implementasi IPasswordHasher memakai bcryptjs dengan cost 12. */
export class BcryptPasswordHasher implements IPasswordHasher {
  /**
   * Membuat hash bcrypt dari password asli.
   *
   * @param plain Password asli.
   * @returns Hash bcrypt dengan cost 12.
   */
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, PASSWORD_HASH_ROUNDS);
  }

  /**
   * Membandingkan password asli dengan hash bcrypt.
   *
   * @param plain Password asli yang dimasukkan pengguna.
   * @param hash Hash bcrypt yang tersimpan.
   * @returns `true` bila password cocok dengan hash.
   */
  async verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
