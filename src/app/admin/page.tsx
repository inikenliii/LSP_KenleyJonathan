import type { Metadata } from 'next';
import { FadeIn } from '@/components/motion/FadeIn';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { requireRole } from '@/lib/auth/dal';

/** Judul tab dasbor admin. */
export const metadata: Metadata = { title: 'Dasbor Admin' };

/**
 * Dasbor Admin.
 *
 * @param props.searchParams Parameter alamat; `akses=ditolak` menampilkan pemberitahuan tanpa akses.
 * @returns Sapaan untuk Admin dan penjelasan singkat tugasnya.
 */
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ akses?: string }>;
}) {
  const user = await requireRole('ADMIN');
  const { akses } = await searchParams;

  return (
    <FadeIn>
      <div className="flex flex-col gap-4">
        {akses === 'ditolak' && (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>Anda tidak memiliki akses ke halaman tersebut.</AlertDescription>
          </Alert>
        )}
        <h1 className="text-2xl font-semibold">Dasbor Admin</h1>
        <p>Selamat datang, {user.fullName}.</p>
        <p className="text-muted-foreground">
          Di sini Admin memverifikasi pendaftar penyewa dan mengelola garasi yang tersedia untuk
          disewa.
        </p>
      </div>
    </FadeIn>
  );
}
