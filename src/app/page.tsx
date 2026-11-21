import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FadeIn } from '@/components/fade-in';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getCurrentUser, homePathFor } from '@/lib/auth/dal';

/**
 * Halaman Beranda: perkenalan singkat aplikasi dengan dua tombol menuju
 * pendaftaran penyewa dan halaman masuk. Pengguna yang sudah masuk langsung
 * dialihkan ke beranda perannya.
 *
 * @returns Kartu di tengah layar berisi judul, penjelasan, dan dua tautan.
 */
export default async function Home() {
  const user = await getCurrentUser();
  if (user !== null) {
    redirect(homePathFor(user.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <FadeIn>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Aplikasi Penyewaan Garasi</CardTitle>
            <CardDescription>
              Garasi Sepeda, Mobil, dan Mobil Listrik dapat disewa secara
              harian atau bulanan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/register" />}
            >
              Daftar sebagai Penyewa
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/login" />}
            >
              Masuk
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    </main>
  );
}
