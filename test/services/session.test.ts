/**
 * @file Tes penyimpanan sesi login pada tabel session di database uji.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SessionRepository } from '@/repositories';
import { createTestPrisma, resetDatabase } from '../support/db';

const prisma = createTestPrisma();
const sessions = new SessionRepository(prisma);

const SEKARANG = new Date('2026-11-21T10:00:00.000Z');
const SATU_JAM = 60 * 60 * 1000;

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('SessionRepository', () => {
  it('menemukan id pengguna selama sesi belum kedaluwarsa', async () => {
    await sessions.create('hash-a', 7, new Date(SEKARANG.getTime() + SATU_JAM));

    expect(await sessions.findUserId('hash-a', SEKARANG)).toBe(7);
  });

  it('tidak menemukan sesi yang sudah kedaluwarsa', async () => {
    await sessions.create('hash-a', 7, new Date(SEKARANG.getTime() + SATU_JAM));

    const sesudahKedaluwarsa = new Date(SEKARANG.getTime() + 2 * SATU_JAM);
    expect(await sessions.findUserId('hash-a', sesudahKedaluwarsa)).toBeNull();
  });

  it('tidak menemukan sesi yang sudah dihapus', async () => {
    await sessions.create('hash-a', 7, new Date(SEKARANG.getTime() + SATU_JAM));
    await sessions.delete('hash-a');

    expect(await sessions.findUserId('hash-a', SEKARANG)).toBeNull();
  });

  it('tidak error saat menghapus sesi yang tidak ada', async () => {
    await expect(sessions.delete('tidak-ada')).resolves.toBeUndefined();
  });

  it('deleteExpired hanya menghapus baris kedaluwarsa dan mengembalikan jumlahnya', async () => {
    await sessions.create('lama-1', 1, new Date(SEKARANG.getTime() - SATU_JAM));
    await sessions.create('lama-2', 2, new Date(SEKARANG.getTime() - 2 * SATU_JAM));
    await sessions.create('baru', 3, new Date(SEKARANG.getTime() + SATU_JAM));

    expect(await sessions.deleteExpired(SEKARANG)).toBe(2);
    expect(await sessions.findUserId('baru', SEKARANG)).toBe(3);
    expect(await prisma.session.count()).toBe(1);
  });

  it('menganggap baris tanpa userId bilangan bulat positif sebagai tidak valid', async () => {
    const kedaluwarsa = new Date(SEKARANG.getTime() + SATU_JAM);
    await prisma.session.create({ data: { sid: 'tanpa-id', sess: {}, expire: kedaluwarsa } });
    await prisma.session.create({
      data: { sid: 'teks', sess: { userId: '7' }, expire: kedaluwarsa },
    });
    await prisma.session.create({
      data: { sid: 'nol', sess: { userId: 0 }, expire: kedaluwarsa },
    });
    await prisma.session.create({
      data: { sid: 'pecahan', sess: { userId: 1.5 }, expire: kedaluwarsa },
    });

    expect(await sessions.findUserId('tanpa-id', SEKARANG)).toBeNull();
    expect(await sessions.findUserId('teks', SEKARANG)).toBeNull();
    expect(await sessions.findUserId('nol', SEKARANG)).toBeNull();
    expect(await sessions.findUserId('pecahan', SEKARANG)).toBeNull();
  });
});
