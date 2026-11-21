'use server';

/**
 * @file Server Action halaman pendaftaran.
 */
import { authService } from '@/lib/container';
import { readFormFields, toActionState, type ActionState } from '@/lib/action-state';

/**
 * Memproses formulir pendaftaran penyewa. Aksi ini sengaja terbuka untuk
 * umum karena hanya bisa membuat akun penyewa berstatus menunggu verifikasi.
 * Hanya lima field bernama yang diteruskan ke layanan, sehingga role atau
 * status yang disisipkan di formulir tidak pernah dipakai.
 *
 * @param _previous Hasil sebelumnya (tidak dipakai).
 * @param formData Data formulir pendaftaran.
 * @returns Hasil pendaftaran: berhasil, atau pesan error beserta isian yang dikirim (tanpa password).
 */
export async function registerAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readFormFields(formData, ['nik', 'fullName', 'phone', 'email']);
  const password = formData.get('password');
  const input = { ...values, password: typeof password === 'string' ? password : undefined };

  try {
    await authService.register(input);
    return { ok: true, message: 'Pendaftaran berhasil. Akun Anda menunggu verifikasi admin.' };
  } catch (error) {
    return toActionState(error, values);
  }
}
