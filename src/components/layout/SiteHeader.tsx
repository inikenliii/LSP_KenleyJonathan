import Link from 'next/link';
import { logoutAction } from '@/app/(auth)/login/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { UserDTO } from '@/domain';

/** Satu tautan navigasi pada header. */
export type NavLink = { href: string; label: string };

/**
 * Header area terproteksi: nama aplikasi, navigasi, nama pengguna dengan
 * lencana perannya, dan tombol Keluar. Keluar berupa formulir (POST), bukan tautan.
 *
 * @param props.user Pengguna yang sedang masuk.
 * @param props.links Tautan navigasi sesuai area.
 * @returns Elemen header.
 */
export function SiteHeader({
  user,
  links,
}: {
  user: UserDTO;
  links: ReadonlyArray<NavLink>;
}) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <span className="font-semibold">Aplikasi Penyewaan Garasi</span>
        <nav className="flex flex-1 items-center gap-4 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span>{user.fullName}</span>
          <Badge variant="secondary">{user.roleLabel}</Badge>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Keluar
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
