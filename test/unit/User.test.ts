/**
 * @file Tes unit entitas User: hak akses, label, dan bentuk DTO.
 */
import { describe, expect, it } from 'vitest';
import { User, type UserRole, type VerificationStatus } from '@/domain';

/**
 * Membuat User uji dengan peran dan status tertentu.
 *
 * @param role Peran pengguna.
 * @param verificationStatus Status verifikasi.
 * @returns Objek User.
 */
function buatUser(role: UserRole, verificationStatus: VerificationStatus): User {
  return new User({
    id: 1,
    nik: role === 'RENTER' ? '3578010101010001' : null,
    fullName: 'Pengguna Uji',
    phone: null,
    email: 'uji@garasi.test',
    role,
    verificationStatus,
    verifiedAt: null,
    verifiedById: null,
    createdAt: null,
  });
}

describe('User', () => {
  it('mengizinkan masuk untuk Admin dan penyewa yang diterima saja', () => {
    expect(buatUser('ADMIN', 'ACCEPTED').canAccessSystem()).toBe(true);
    expect(buatUser('RENTER', 'ACCEPTED').canAccessSystem()).toBe(true);
    expect(buatUser('RENTER', 'PENDING').canAccessSystem()).toBe(false);
    expect(buatUser('RENTER', 'REJECTED').canAccessSystem()).toBe(false);
  });

  it('mengizinkan menyewa hanya untuk penyewa yang diterima', () => {
    expect(buatUser('RENTER', 'ACCEPTED').canRent()).toBe(true);
    expect(buatUser('RENTER', 'PENDING').canRent()).toBe(false);
    expect(buatUser('RENTER', 'REJECTED').canRent()).toBe(false);
    expect(buatUser('ADMIN', 'ACCEPTED').canRent()).toBe(false);
  });

  it('memberi label status dan peran dalam Bahasa Indonesia', () => {
    expect(buatUser('RENTER', 'PENDING').statusLabel).toBe('Menunggu verifikasi');
    expect(buatUser('RENTER', 'ACCEPTED').statusLabel).toBe('Diterima');
    expect(buatUser('RENTER', 'REJECTED').statusLabel).toBe('Ditolak');
    expect(buatUser('ADMIN', 'ACCEPTED').roleLabel).toBe('Admin');
    expect(buatUser('RENTER', 'ACCEPTED').roleLabel).toBe('Penyewa');
  });

  it('menghasilkan DTO polos tanpa hash password', () => {
    const dto = buatUser('RENTER', 'ACCEPTED').toDTO();

    expect(dto.email).toBe('uji@garasi.test');
    expect(dto.role).toBe('RENTER');
    expect(Object.getPrototypeOf(dto)).toBe(Object.prototype);
    expect(Object.keys(dto)).not.toContain('passwordHash');
    expect(Object.keys(dto)).not.toContain('password');
  });
});
