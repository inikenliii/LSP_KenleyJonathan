import Link from 'next/link';
import { FadeIn } from '@/components/fade-in';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Halaman Beranda: perkenalan singkat aplikasi dengan dua tombol menuju
 * pendaftaran penyewa dan halaman masuk. Rute /register dan /login dibuat
 * pada plan berikutnya.
 *
 * @returns Kartu di tengah layar berisi judul, penjelasan, dan dua tautan.
 */
export default function Home() {
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
