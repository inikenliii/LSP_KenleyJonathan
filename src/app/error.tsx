'use client';

import { Button } from '@/components/ui/button';

/**
 * Halaman cadangan saat terjadi error tak terduga. Pesan dan digest dari
 * error yang tertangkap sengaja tidak ditampilkan.
 *
 * @param props.reset Fungsi untuk mencoba memuat ulang bagian halaman.
 * @returns Pesan umum dengan tombol Coba lagi.
 */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Terjadi kesalahan</h1>
      <p className="text-muted-foreground">
        Maaf, permintaan tidak dapat diproses. Silakan coba lagi.
      </p>
      <Button onClick={() => reset()}>Coba lagi</Button>
    </main>
  );
}
