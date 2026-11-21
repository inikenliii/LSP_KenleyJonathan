import type { Metadata } from 'next';
import { FadeIn } from '@/components/motion/FadeIn';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { requireRole } from '@/lib/auth/dal';

/** Judul tab beranda penyewa. */
export const metadata: Metadata = { title: 'Beranda Penyewa' };

/**
 * Beranda Penyewa.
 *
 * @param props.searchParams Parameter alamat; `akses=ditolak` menampilkan pemberitahuan tanpa akses.
 * @returns Sapaan untuk Penyewa beserta status akunnya.
 */
export default async function RenterHomePage({
  searchParams,
}: {
  searchParams: Promise<{ akses?: string }>;
}) {
  const user = await requireRole('RENTER');
  const { akses } = await searchParams;

  return (
    <FadeIn>
      <div className="flex flex-col gap-4">
        {akses === 'ditolak' && (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>Anda tidak memiliki akses ke halaman tersebut.</AlertDescription>
          </Alert>
        )}
        <h1 className="text-2xl font-semibold">Beranda Penyewa</h1>
        <p>Selamat datang, {user.fullName}.</p>
        <p className="text-muted-foreground">Status akun: {user.statusLabel}</p>
      </div>
    </FadeIn>
  );
}
