'use server';

/**
 * @file Server Action pembuatan garasi berkelompok.
 */
import { revalidatePath } from 'next/cache';
import { readFormFields, toActionState, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/dal';
import { garageService } from '@/lib/container';

/**
 * Membuat garasi berkelompok untuk satu tipe. Server Action adalah endpoint
 * POST yang bisa dipanggil langsung, jadi peran Admin diperiksa lebih dulu.
 *
 * @param _previous Hasil sebelumnya (tidak dipakai).
 * @param formData Data formulir: `type`, `quantity`, `dailyPrice`, dan `pricePerKwh`.
 * @returns Pesan berhasil berisi rentang ID, atau pesan error per field.
 */
export async function createGarageBatchAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole('ADMIN');
  const values = readFormFields(formData, ['type', 'quantity', 'dailyPrice', 'pricePerKwh']);

  try {
    const hasil = await garageService.createBatch(values);
    revalidatePath('/admin/garasi');
    return {
      ok: true,
      message:
        `Berhasil membuat ${hasil.count} garasi ${hasil.typeLabel} ` +
        `(${hasil.firstId} sampai ${hasil.lastId}). Contoh: ${hasil.summary}.`,
    };
  } catch (error) {
    return toActionState(error, values);
  }
}
