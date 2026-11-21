'use server';

/**
 * @file Server Action perpanjangan sewa oleh Admin.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readFormFields, toActionState, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/dal';
import { rentalExtensionService } from '@/lib/container';
import type { ExtensionView } from '@/services';

/**
 * Memperpanjang satu sewa yang masih aktif. Server Action adalah endpoint POST
 * yang bisa dipanggil langsung, jadi peran Admin diperiksa lebih dulu. Id Admin
 * diambil dari sesi; tanggal selesai lama dan baru, tambahan hari, harga harian,
 * dan sisa biaya dihitung layanan dari sewa tersimpan, tidak pernah dari formulir.
 *
 * @param _previous Hasil sebelumnya (tidak dipakai).
 * @param formData Data formulir: `rentalId`, `extensionType` (HARIAN atau BULANAN),
 *   `quantity` (hari atau bulan), dan berkas `paymentProof`.
 * @returns Pesan error per field bila gagal; bila berhasil Admin dialihkan ke
 *   halaman perpanjangan sewa yang sama dengan pemberitahuan.
 */
export async function extendRentalAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole('ADMIN');
  const values = readFormFields(formData, ['rentalId', 'extensionType', 'quantity']);

  // Berkas dibaca menjadi byte; berkas kosong dianggap tidak diunggah.
  const berkas = formData.get('paymentProof');
  const paymentProof =
    berkas instanceof File && berkas.size > 0
      ? new Uint8Array(await berkas.arrayBuffer())
      : undefined;

  let hasil: ExtensionView;
  try {
    hasil = await rentalExtensionService.extendRental(user.id, { ...values, paymentProof });
  } catch (error) {
    // Berkas tidak ikut dikembalikan ke formulir; hanya isian teks.
    return toActionState(error, values);
  }

  revalidatePath('/admin/perpanjangan');
  revalidatePath('/penyewa/sewa');
  redirect(`/admin/perpanjangan?sewa=${hasil.rentalId}&berhasil=1`);
}
