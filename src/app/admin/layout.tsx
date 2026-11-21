import type { ReactNode } from 'react';
import { SiteHeader, type NavLink } from '@/components/layout/SiteHeader';
import { requireRole } from '@/lib/auth/dal';

/** Tautan navigasi area Admin. */
const ADMIN_LINKS: ReadonlyArray<NavLink> = [
  { href: '/admin', label: 'Dasbor' },
  { href: '/admin/pendaftar', label: 'Pendaftar' },
  { href: '/admin/garasi', label: 'Garasi' },
];

/**
 * Kerangka area Admin. Hanya Admin yang boleh membuka halaman di bawah /admin;
 * pemeriksaan peran juga diulang di setiap halaman dan Server Action.
 *
 * @param props.children Halaman admin yang sedang dibuka.
 * @returns Header dan kolom isi di tengah.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole('ADMIN');

  return (
    <>
      <SiteHeader user={user} links={ADMIN_LINKS} />
      <main className="mx-auto w-full max-w-5xl p-6">{children}</main>
    </>
  );
}
