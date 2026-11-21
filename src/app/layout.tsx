import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

/** Metadata dasar halaman: judul tab dan deskripsi aplikasi. */
export const metadata: Metadata = {
  title: 'Aplikasi Penyewaan Garasi',
  description:
    'Aplikasi web penyewaan garasi sepeda, mobil, dan mobil listrik secara harian atau bulanan.',
};

/**
 * Kerangka dasar seluruh halaman. Tidak memakai font dari internet (huruf
 * sistem dipakai lewat `--font-sans` di globals.css) agar aplikasi tetap
 * tampil normal saat demo tanpa koneksi.
 *
 * @param props.children Isi halaman yang sedang dibuka.
 * @returns Dokumen HTML berbahasa Indonesia.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className="font-sans">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
