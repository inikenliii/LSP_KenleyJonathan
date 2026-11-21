/**
 * @file Penyaji bukti pembayaran. Gambar tidak ada di folder publik; hanya
 * pemilik sewa atau Admin yang boleh membukanya lewat Route Handler ini.
 */
import { NotFoundError, toAppError } from '@/domain';
import { getCurrentUser } from '@/lib/auth/dal';
import { rentalService } from '@/lib/container';

/** Pesan umum untuk kegagalan tak terduga; tanpa rincian teknis. */
const PESAN_UMUM = 'Terjadi kesalahan pada server. Silakan coba lagi nanti.';

/**
 * Menampilkan bukti pembayaran satu sewa. Pengunjung yang belum masuk
 * mendapat 401. Sewa yang tidak ada, bukan milik pengguna, atau Id yang
 * bukan angka mendapat 404 yang sama agar keberadaan sewa tidak bocor.
 * Lokasi berkas tidak pernah diambil dari alamat; hanya Id sewa.
 *
 * @param _request Permintaan masuk (tidak dipakai).
 * @param context Parameter rute; `rentalId` adalah Id sewa.
 * @returns Gambar bukti pembayaran, atau tanggapan 401, 404, atau 500.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ rentalId: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (user === null) {
    return new Response('Silakan masuk terlebih dahulu.', { status: 401 });
  }

  const { rentalId } = await context.params;
  if (!/^\d{1,9}$/.test(rentalId)) {
    return new Response('Bukti pembayaran tidak ditemukan.', { status: 404 });
  }

  try {
    const { bytes, contentType } = await rentalService.getPaymentProof(
      { id: user.id, role: user.role },
      Number(rentalId),
    );
    return new Response(bytes as Uint8Array<ArrayBuffer>, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const galat = toAppError(error);
    if (galat instanceof NotFoundError) {
      return new Response('Bukti pembayaran tidak ditemukan.', { status: 404 });
    }
    console.error(galat.cause ?? galat);
    return new Response(PESAN_UMUM, { status: 500 });
  }
}
