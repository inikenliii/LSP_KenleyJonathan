'use server';

/**
 * @file Server Action pembuatan sewa baru oleh Penyewa.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readFormFields, toActionState, type ActionState } from '@/lib/action-state';
import { requireRole } from '@/lib/auth/dal';
import { rentalService } from '@/lib/container';

/**
 * Membuat sewa baru. Server Action adalah endpoint POST yang bisa dipanggil
 * langsung, jadi peran Penyewa diperiksa lebih dulu. Id penyewa diambil dari
 * sesi; tanggal, status, dan biaya dihitung layanan, tidak pernah dari formulir.
 *
 * @param _previous Hasil sebelumnya (tidak dipakai).
 * @param formData Data formulir: data kendaraan, tipe sewa, jumlah hari, tipe
 *   dan ID garasi, serta berkas `paymentProof`.
 * @returns Pesan error per field bila gagal; bila berhasil pengguna dialihkan
 *   ke daftar sewa.
 */
export async function createRentalAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole('RENTER');
  const values = readFormFields(formData, [
    'vehicleType',
    'plateNumber',
    'vehicleBrand',
    'vehicleModel',
    'batteryKwh',
    'rentalType',
    'days',
    'garageType',
    'garageId',
  ]);

  // Berkas dibaca menjadi byte; berkas kosong dianggap tidak diunggah.
  const berkas = formData.get('paymentProof');
  const paymentProof =
    berkas instanceof File && berkas.size > 0
      ? new Uint8Array(await berkas.arrayBuffer())
      : undefined;

  try {
    await rentalService.createRental(user.id, { ...values, paymentProof });
  } catch (error) {
    // Berkas tidak ikut dikembalikan ke formulir; hanya isian teks.
    return toActionState(error, values);
  }

  revalidatePath('/penyewa/sewa');
  revalidatePath('/penyewa/sewa/baru');
  redirect('/penyewa/sewa?baru=1');
}
