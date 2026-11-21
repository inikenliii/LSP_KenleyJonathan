'use server';

/**
 * @file Server Action keputusan verifikasi pendaftar.
 */
import { redirect } from 'next/navigation';
import { readFormFields, toActionState, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/dal';
import { verificationService } from '@/lib/container';
import type { VerificationResult } from '@/services';

/**
 * Menerima atau menolak satu pendaftar. Server Action adalah endpoint POST
 * yang bisa dipanggil langsung, jadi peran Admin diperiksa di sini dan id
 * admin diambil dari sesi, bukan dari formulir.
 *
 * @param _previous Hasil sebelumnya (tidak dipakai).
 * @param formData Data formulir: `userId`, `decision`, dan `ktpValidated`.
 * @returns Pesan error untuk baris pendaftar bila gagal; bila berhasil, halaman dialihkan.
 */
export async function decideRegistrantAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole('ADMIN');
  const fields = readFormFields(formData, ['userId', 'decision', 'ktpValidated']);

  let result: VerificationResult;
  try {
    result = await verificationService.decide(fields, admin.id);
  } catch (error) {
    return toActionState(error);
  }

  // Pengalihan bekerja dengan melempar, jadi harus di luar try/catch.
  redirect(
    result.status === 'ACCEPTED'
      ? '/admin/pendaftar?keputusan=diterima'
      : '/admin/pendaftar?keputusan=ditolak',
  );
}
