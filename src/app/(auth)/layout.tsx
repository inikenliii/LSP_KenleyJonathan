import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Kerangka halaman pendaftaran dan masuk: isi di tengah layar dengan tautan
 * kecil kembali ke Beranda.
 *
 * @param props.children Halaman yang sedang dibuka.
 * @returns Kolom setinggi layar berisi tautan Beranda dan halaman.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <Link
        href="/"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Aplikasi Penyewaan Garasi
      </Link>
      {children}
    </main>
  );
}
