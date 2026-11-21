import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { UserDTO, UserRole } from '@/domain';
import { userRepository } from '@/lib/container';
import { readSessionUserId } from './session';

/**
 * @file Lapisan akses data pengguna yang sedang masuk dan pemeriksaan hak akses.
 *
 * Pemeriksaan ini wajib dipanggil di setiap layout, halaman, dan Server Action
 * yang dilindungi: layout saja tidak melindungi halaman maupun aksi. Pengguna
 * dimuat ulang dari database pada setiap permintaan.
 */

/**
 * Alamat beranda sesuai peran.
 *
 * @param role Peran pengguna.
 * @returns `/admin` untuk Admin, `/penyewa` untuk Penyewa.
 */
export function homePathFor(role: UserRole): string {
  return role === 'ADMIN' ? '/admin' : '/penyewa';
}

/**
 * Mengambil pengguna yang sedang masuk. Hasilnya dipakai bersama selama satu
 * permintaan (React `cache`). Penyewa yang belum diterima atau ditolak dianggap
 * belum masuk.
 *
 * @returns Data pengguna yang aman dikirim ke tampilan, atau `null` bila belum masuk.
 */
export const getCurrentUser = cache(async (): Promise<UserDTO | null> => {
  const userId = await readSessionUserId();
  if (userId === null) {
    return null;
  }
  const user = await userRepository.findById(userId);
  if (user === null || !user.canAccessSystem()) {
    return null;
  }
  return user.toDTO();
});

/**
 * Mewajibkan pengguna sudah masuk.
 *
 * @returns Pengguna yang sedang masuk; pengunjung dialihkan ke `/login`.
 */
export async function requireUser(): Promise<UserDTO> {
  const user = await getCurrentUser();
  if (user === null) {
    redirect('/login');
  }
  return user;
}

/**
 * Mewajibkan pengguna masuk dengan peran tertentu. Pengunjung dialihkan ke
 * `/login`; pengguna dengan peran lain dikembalikan ke beranda perannya
 * sendiri disertai pemberitahuan.
 *
 * @param role Peran yang dibutuhkan.
 * @returns Pengguna yang sedang masuk dengan peran tersebut.
 */
export async function requireRole(role: UserRole): Promise<UserDTO> {
  const user = await requireUser();
  if (user.role !== role) {
    redirect(`${homePathFor(user.role)}?akses=ditolak`);
  }
  return user;
}
