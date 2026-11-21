/**
 * @file Penyaji bukti pembayaran perpanjangan. Gambar tidak ada di folder
 * publik; hanya Admin atau penyewa pemilik sewa yang boleh membukanya lewat
 * Route Handler ini.
 */
import { NotFoundError, toAppError } from '@/domain';
import { getCurrentUser } from '@/lib/auth/dal';
import { rentalExtensionService } from '@/lib/container';

/** Pesan umum untuk kegagalan tak terduga; tanpa rincian teknis. */
const PESAN_UMUM = 'Terjadi kesalahan pada server. Silakan coba lagi nanti.';

/**
 * Menampilkan bukti pembayaran satu perpanjangan. Pengunjung yang belum masuk
 * mendapat 401. Perpanjangan yang tidak ada, bukan milik sewa pengguna (kecuali
 * Admin), atau Id yang bukan angka mendapat 404 yang sama agar keberadaannya
 * tidak bocor. Lokasi berkas tidak pernah diambil dari alamat; hanya Id
 * perpanjangan, dan hak akses diperiksa layanan.
 *
 * @param _request Permintaan masuk (tidak dipakai).
 * @param context Parameter rute; `extensionId` adalah Id perpanjangan.
 * @returns Gambar bukti pembayaran, atau tanggapan 401, 404, atau 500.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ extensionId: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (user === null) {
    return new Response('Silakan masuk terlebih dahulu.', { status: 401 });
  }

  const { extensionId } = await context.params;
  if (!/^\d{1,9}$/.test(extensionId)) {
    return new Response('Bukti pembayaran tidak ditemukan.', { status: 404 });
  }

  try {
    const { bytes, contentType } = await rentalExtensionService.getExtensionProof(
      { id: user.id, role: user.role },
      Number(extensionId),
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
