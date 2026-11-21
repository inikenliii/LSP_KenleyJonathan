/**
 * @file Tes unit untuk hierarki error domain dan pemetaan toAppError.
 */
import { describe, expect, it } from 'vitest';
import {
  AccountNotVerifiedError,
  AppError,
  CapacityExceededError,
  DatabaseError,
  ValidationError,
  toAppError,
} from '@/domain';

describe('toAppError', () => {
  it('membungkus error biasa menjadi DatabaseError yang tidak ditampilkan ke pengguna', () => {
    const asli = new Error('x');
    const hasil = toAppError(asli);

    expect(hasil).toBeInstanceOf(DatabaseError);
    expect(hasil.expose).toBe(false);
    expect(hasil.message).toBe('Terjadi kesalahan pada database. Silakan coba lagi nanti.');
    expect(hasil.cause).toBe(asli);
  });

  it('mengembalikan AppError apa adanya', () => {
    const galat = new ValidationError({ nik: ['salah'] });
    expect(toAppError(galat)).toBe(galat);
    expect(galat).toBeInstanceOf(AppError);
  });
});

describe('ValidationError.firstErrors', () => {
  it('mengambil pesan pertama untuk setiap field', () => {
    const galat = new ValidationError({
      nik: ['NIK harus 16 digit angka', 'pesan kedua'],
      email: ['Format email tidak valid'],
      kosong: [],
    });

    expect(galat.firstErrors()).toEqual({
      nik: 'NIK harus 16 digit angka',
      email: 'Format email tidak valid',
    });
  });
});

describe('AccountNotVerifiedError', () => {
  it('membawa pesan sesuai status verifikasi', () => {
    expect(new AccountNotVerifiedError('PENDING').message).toBe(
      'Akun Anda masih menunggu verifikasi admin.',
    );
    expect(new AccountNotVerifiedError('REJECTED').message).toBe(
      'Pendaftaran Anda ditolak oleh admin.',
    );
  });
});

describe('CapacityExceededError', () => {
  it('menyusun pesan dengan sisa kuota', () => {
    const galat = new CapacityExceededError({
      typeLabel: 'Sepeda',
      lastNumber: 990,
      requested: 20,
      max: 999,
    });

    expect(galat.message).toBe(
      'Jumlah garasi Sepeda akan melebihi batas 999. Saat ini 990 garasi, sisa kuota 9.',
    );
  });
});
