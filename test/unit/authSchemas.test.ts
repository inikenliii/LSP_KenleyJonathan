/**
 * @file Tes unit batas panjang password pada skema pendaftaran dan masuk
 * (batas bcrypt dihitung dalam byte, bukan karakter).
 */
import { describe, expect, it } from 'vitest';
import { loginSchema, registrationSchema } from '@/validation/authSchemas';

/**
 * Membuat isian pendaftaran yang sah dengan password tertentu.
 *
 * @param password Password yang diuji.
 * @returns Isian formulir mentah.
 */
function isian(password: string) {
  return {
    nik: '3201234567890123',
    fullName: 'Budi Santoso',
    phone: '081234567890',
    email: 'budi@garasi.test',
    password,
  };
}

/**
 * Mengambil pesan error password pertama dari pendaftaran.
 *
 * @param password Password yang diuji.
 * @returns Pesan error, atau `undefined` bila lolos.
 */
function pesanPassword(password: string): string | undefined {
  const hasil = registrationSchema.safeParse(isian(password));
  return hasil.success
    ? undefined
    : hasil.error.issues.find((isu) => isu.path[0] === 'password')?.message;
}

describe('registrationSchema: password', () => {
  it('menerima 8 sampai 72 karakter ASCII dan menolak 7 atau 73', () => {
    expect(pesanPassword('a'.repeat(8))).toBeUndefined();
    expect(pesanPassword('a'.repeat(72))).toBeUndefined();
    expect(pesanPassword('a'.repeat(7))).toBe('Password harus 8-72 karakter');
    expect(pesanPassword('a'.repeat(73))).toBe('Password harus 8-72 karakter');
  });

  it('menolak password multibyte yang melebihi 72 byte meski kurang dari 72 karakter', () => {
    // 40 huruf beraksen = 40 karakter tetapi 80 byte UTF-8.
    expect(pesanPassword('é'.repeat(40))).toBe(
      'Password paling panjang 72 byte (sekitar 72 karakter biasa)',
    );
    // 20 emoji = 20 titik kode tetapi 80 byte.
    expect(pesanPassword('😀'.repeat(20))).toBe(
      'Password paling panjang 72 byte (sekitar 72 karakter biasa)',
    );
  });

  it('menerima password multibyte tepat 72 byte', () => {
    expect(pesanPassword('é'.repeat(36))).toBeUndefined();
  });
});

describe('loginSchema: password', () => {
  it('menolak password lebih dari 72 byte dan menerima tepat 72 byte', () => {
    const dasar = { email: 'budi@garasi.test' };
    expect(loginSchema.safeParse({ ...dasar, password: 'é'.repeat(36) }).success).toBe(true);
    expect(loginSchema.safeParse({ ...dasar, password: 'é'.repeat(40) }).success).toBe(false);
    expect(loginSchema.safeParse({ ...dasar, password: 'a'.repeat(73) }).success).toBe(false);
  });
});
