'use server';

/**
 * @file Server Action halaman masuk dan keluar.
 */
import { redirect } from 'next/navigation';
import { readFormFields, toActionState, type ActionState } from '@/lib/action-state';
import { homePathFor } from '@/lib/auth/dal';
import { createSession, destroySession } from '@/lib/auth/session';
import { authService } from '@/lib/container';
import type { UserDTO } from '@/domain';

/**
 * Memproses formulir masuk. Aksi ini terbuka untuk umum. Bila berhasil, sesi
 * baru dibuat dan pengguna dialihkan ke beranda sesuai perannya.
 *
 * @param _previous Hasil sebelumnya (tidak dipakai).
 * @param formData Data formulir masuk.
 * @returns Pesan error beserta email yang diketik (tanpa password) bila gagal.
 */
export async function loginAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readFormFields(formData, ['email']);
  const password = formData.get('password');

  let user: UserDTO;
  try {
    user = await authService.authenticate({
      ...values,
      password: typeof password === 'string' ? password : undefined,
    });
    await createSession(user.id);
  } catch (error) {
    return toActionState(error, values);
  }

  // Pengalihan bekerja dengan melempar, jadi harus di luar try/catch.
  redirect(homePathFor(user.role));
}

/**
 * Keluar: menghapus sesi lalu kembali ke halaman masuk. Dipanggil dari tombol
 * formulir (POST), tidak pernah dari tautan.
 */
export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login?keluar=1');
}
