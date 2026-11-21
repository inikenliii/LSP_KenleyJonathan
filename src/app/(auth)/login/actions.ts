'use server';

/**
 * @file Server Action halaman masuk dan keluar.
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { readFormFields, toActionState, type ActionState } from '@/lib/action-state';
import { homePathFor } from '@/lib/auth/dal';
import { createSession, destroySession } from '@/lib/auth/session';
import { authService } from '@/lib/container';
import type { UserDTO } from '@/domain';

/**
 * Mengambil alamat IP klien dari header permintaan: entri pertama
 * `x-forwarded-for` (diisi proxy), lalu `x-real-ip`. Di server tanpa proxy
 * keduanya kosong sehingga pembatasan percobaan hanya memakai email.
 *
 * @returns Alamat IP, atau `null` bila tidak ada.
 */
async function readClientIp(): Promise<string | null> {
  const daftar = await headers();
  const diteruskan = daftar.get('x-forwarded-for')?.split(',')[0]?.trim();
  return diteruskan || daftar.get('x-real-ip')?.trim() || null;
}

/**
 * Memproses formulir masuk. Aksi ini terbuka untuk umum. Bila berhasil, sesi
 * baru dibuat dan pengguna dialihkan ke beranda sesuai perannya. Percobaan
 * dibatasi per email dan IP (lihat `LoginRateLimiter`).
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
    user = await authService.authenticate(
      {
        ...values,
        password: typeof password === 'string' ? password : undefined,
      },
      { clientIp: await readClientIp() },
    );
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
