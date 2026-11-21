/**
 * @file Tes layanan verifikasi pendaftar (VER-01 dan VER-02) pada database uji.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '@/domain';
import { UserRepository } from '@/repositories';
import { VerificationService } from '@/services';
import { createTestPrisma, resetDatabase } from '../support/db';
import { insertUser } from '../support/users';

const prisma = createTestPrisma();
const service = new VerificationService(new UserRepository(prisma));

const PASSWORD = 'rahasia123';

/** Id pengguna uji yang dibuat ulang sebelum setiap tes. */
let adminId: number;
let pendingPertamaId: number;
let pendingKeduaId: number;
let diterimaId: number;
let ditolakId: number;

beforeEach(async () => {
  await resetDatabase(prisma);
  adminId = await insertUser(prisma, {
    email: 'admin@garasi.test',
    password: PASSWORD,
    role: 'ADMIN',
    verificationStatus: 'ACCEPTED',
    fullName: 'Admin Garasi',
  });
  pendingPertamaId = await insertUser(prisma, {
    email: 'pertama@garasi.test',
    password: PASSWORD,
    role: 'RENTER',
    verificationStatus: 'PENDING',
    fullName: 'Pendaftar Pertama',
  });
  pendingKeduaId = await insertUser(prisma, {
    email: 'kedua@garasi.test',
    password: PASSWORD,
    role: 'RENTER',
    verificationStatus: 'PENDING',
    fullName: 'Pendaftar Kedua',
  });
  diterimaId = await insertUser(prisma, {
    email: 'diterima@garasi.test',
    password: PASSWORD,
    role: 'RENTER',
    verificationStatus: 'ACCEPTED',
  });
  ditolakId = await insertUser(prisma, {
    email: 'ditolak@garasi.test',
    password: PASSWORD,
    role: 'RENTER',
    verificationStatus: 'REJECTED',
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Membaca status dan kolom audit seorang pengguna langsung dari database.
 *
 * @param id Id pengguna.
 * @returns Baris pengguna dengan status, verifiedById, dan verifiedAt.
 */
async function bacaBaris(id: number) {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: { verificationStatus: true, verifiedById: true, verifiedAt: true },
  });
}

describe('VerificationService.listPending (VER-01)', () => {
  it('hanya memuat penyewa menunggu verifikasi, terlama dulu', async () => {
    const daftar = await service.listPending();

    expect(daftar.map((u) => u.id)).toEqual([pendingPertamaId, pendingKeduaId]);
    expect(daftar.every((u) => u.role === 'RENTER' && u.verificationStatus === 'PENDING')).toBe(
      true,
    );
  });

  it('tidak memuat penyewa diterima, penyewa ditolak, maupun Admin', async () => {
    const id = (await service.listPending()).map((u) => u.id);

    expect(id).not.toContain(diterimaId);
    expect(id).not.toContain(ditolakId);
    expect(id).not.toContain(adminId);
  });

  it('tidak membocorkan hash password', async () => {
    const daftar = await service.listPending();

    expect(daftar.length).toBeGreaterThan(0);
    for (const dto of daftar) {
      expect(dto).not.toHaveProperty('passwordHash');
    }
  });
});

describe('VerificationService.decide (VER-02)', () => {
  it('menolak penerimaan tanpa konfirmasi KTP dan status tetap menunggu', async () => {
    const galat = await service
      .decide({ userId: String(pendingPertamaId), decision: 'ACCEPT' }, adminId)
      .catch((e: unknown) => e);

    expect(galat).toBeInstanceOf(ValidationError);
    expect((galat as ValidationError).fieldErrors.ktpValidated).toEqual([
      'Centang konfirmasi validasi KTP sebelum menerima pendaftar.',
    ]);
    expect((await bacaBaris(pendingPertamaId)).verificationStatus).toBe('PENDING');
  });

  it('menerima dengan konfirmasi KTP dan menyimpan siapa yang memutuskan serta waktunya', async () => {
    const hasil = await service.decide(
      { userId: String(pendingPertamaId), decision: 'ACCEPT', ktpValidated: 'on' },
      adminId,
    );

    expect(hasil).toEqual({ status: 'ACCEPTED', fullName: 'Pendaftar Pertama' });
    const baris = await bacaBaris(pendingPertamaId);
    expect(baris.verificationStatus).toBe('ACCEPTED');
    expect(baris.verifiedById).toBe(adminId);
    expect(baris.verifiedAt).not.toBeNull();
  });

  it('menolak pendaftar tanpa perlu konfirmasi KTP', async () => {
    const hasil = await service.decide(
      { userId: String(pendingKeduaId), decision: 'REJECT' },
      adminId,
    );

    expect(hasil.status).toBe('REJECTED');
    const baris = await bacaBaris(pendingKeduaId);
    expect(baris.verificationStatus).toBe('REJECTED');
    expect(baris.verifiedById).toBe(adminId);
    expect(baris.verifiedAt).not.toBeNull();
  });

  it('menolak keputusan kedua untuk pendaftar yang sama', async () => {
    await service.decide({ userId: String(pendingPertamaId), decision: 'REJECT' }, adminId);

    const galat = await service
      .decide(
        { userId: String(pendingPertamaId), decision: 'ACCEPT', ktpValidated: 'on' },
        adminId,
      )
      .catch((e: unknown) => e);

    expect(galat).toBeInstanceOf(ConflictError);
    expect((galat as ConflictError).message).toBe('Pendaftar ini sudah diproses sebelumnya.');
    expect((await bacaBaris(pendingPertamaId)).verificationStatus).toBe('REJECTED');
  });

  it('hanya satu dari dua keputusan bersamaan yang berhasil', async () => {
    const hasil = await Promise.allSettled([
      service.decide({ userId: String(pendingKeduaId), decision: 'REJECT' }, adminId),
      service.decide({ userId: String(pendingKeduaId), decision: 'REJECT' }, adminId),
    ]);

    expect(hasil.filter((h) => h.status === 'fulfilled')).toHaveLength(1);
    const ditolak = hasil.find((h) => h.status === 'rejected') as PromiseRejectedResult;
    expect(ditolak.reason).toBeInstanceOf(ConflictError);
  });

  it.each(['999999', 'abc', '', '0', '-3', '1.5'])(
    'menjawab "Pendaftar tidak ditemukan." untuk id %j',
    async (userId) => {
      const galat = await service
        .decide({ userId, decision: 'REJECT' }, adminId)
        .catch((e: unknown) => e);

      expect(galat).toBeInstanceOf(NotFoundError);
      expect((galat as NotFoundError).message).toBe('Pendaftar tidak ditemukan.');
    },
  );

  it('menjawab "Pendaftar tidak ditemukan." untuk id Admin sendiri', async () => {
    const galat = await service
      .decide({ userId: String(adminId), decision: 'REJECT' }, adminId)
      .catch((e: unknown) => e);

    expect(galat).toBeInstanceOf(NotFoundError);
    expect((galat as NotFoundError).message).toBe('Pendaftar tidak ditemukan.');
    expect((await bacaBaris(adminId)).verificationStatus).toBe('ACCEPTED');
  });

  it('menolak keputusan di luar ACCEPT dan REJECT', async () => {
    const galat = await service
      .decide({ userId: String(pendingPertamaId), decision: 'MAYBE' }, adminId)
      .catch((e: unknown) => e);

    expect(galat).toBeInstanceOf(ValidationError);
    expect((galat as ValidationError).fieldErrors.decision).toEqual(['Keputusan tidak valid']);
  });
});
