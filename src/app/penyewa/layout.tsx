import type { ReactNode } from 'react';
import { SiteHeader, type NavLink } from '@/components/layout/SiteHeader';
import { requireRole } from '@/lib/auth/dal';

/** Tautan navigasi area Penyewa. */
const RENTER_LINKS: ReadonlyArray<NavLink> = [{ href: '/penyewa', label: 'Beranda' }];

/**
 * Kerangka area Penyewa. Hanya Penyewa yang sudah diterima yang boleh membuka
 * halaman di bawah /penyewa; pemeriksaan peran juga diulang di setiap halaman.
 *
 * @param props.children Halaman penyewa yang sedang dibuka.
 * @returns Header dan kolom isi di tengah.
 */
export default async function RenterLayout({ children }: { children: ReactNode }) {
  const user = await requireRole('RENTER');

  return (
    <>
      <SiteHeader user={user} links={RENTER_LINKS} />
      <main className="mx-auto w-full max-w-5xl p-6">{children}</main>
    </>
  );
}
