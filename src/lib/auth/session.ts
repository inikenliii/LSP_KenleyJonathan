import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { sessionRepository } from '@/lib/container';

/**
 * @file Sesi login berbasis cookie.
 *
 * Cookie `sid` berisi token acak 256 bit. Di database hanya hash SHA-256 token
 * yang disimpan, sehingga isi tabel session tidak bisa dipakai untuk masuk.
 * Cookie hanya boleh ditulis dari Server Action, jadi `createSession` dan
 * `destroySession` dipanggil dari sana saja.
 */

/** Nama cookie sesi. */
export const SESSION_COOKIE_NAME = 'sid';

/** Masa berlaku sesi: 8 jam. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * Mengubah token cookie menjadi kunci sesi di database.
 *
 * @param token Token acak dari cookie.
 * @returns Hash SHA-256 dalam heksadesimal.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Membuat sesi baru untuk pengguna yang berhasil masuk. Sesi lama di browser
 * yang sama dihapus lebih dulu dan token selalu baru (mencegah session fixation).
 * Hanya boleh dipanggil dari Server Action.
 *
 * @param userId Id pengguna yang masuk.
 */
export async function createSession(userId: number): Promise<void> {
  const cookieStore = await cookies();
  const lama = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (lama) {
    await sessionRepository.delete(hashToken(lama));
  }

  const sekarang = new Date();
  await sessionRepository.deleteExpired(sekarang);

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(sekarang.getTime() + SESSION_TTL_MS);
  await sessionRepository.create(hashToken(token), userId, expiresAt);

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Mengakhiri sesi: menghapus baris sesi di database dan cookie di browser.
 * Hanya boleh dipanggil dari Server Action.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await sessionRepository.delete(hashToken(token));
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Membaca id pengguna dari cookie sesi yang sedang dibawa permintaan.
 *
 * @returns Id pengguna, atau `null` bila tidak ada cookie atau sesi tidak berlaku.
 */
export async function readSessionUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return sessionRepository.findUserId(hashToken(token), new Date());
}
