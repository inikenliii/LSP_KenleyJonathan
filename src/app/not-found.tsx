import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Halaman untuk alamat yang tidak ada.
 *
 * @returns Pesan "Halaman tidak ditemukan." dengan tautan kembali ke Beranda.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg">Halaman tidak ditemukan.</p>
      <Button nativeButton={false} render={<Link href="/" />}>
        Kembali ke Beranda
      </Button>
    </main>
  );
}
