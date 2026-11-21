import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/forms/LoginForm';
import { FadeIn } from '@/components/motion/FadeIn';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getCurrentUser, homePathFor } from '@/lib/auth/dal';

/** Judul tab halaman masuk. */
export const metadata: Metadata = { title: 'Masuk' };

/**
 * Halaman masuk. Pengguna yang sudah masuk langsung dialihkan ke beranda perannya.
 *
 * @param props.searchParams Parameter alamat; `keluar=1` menampilkan pemberitahuan sudah keluar.
 * @returns Kartu berisi formulir masuk dan tautan ke pendaftaran.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ keluar?: string }>;
}) {
  const user = await getCurrentUser();
  if (user !== null) {
    redirect(homePathFor(user.role));
  }
  const { keluar } = await searchParams;

  return (
    <FadeIn>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle as="h1" className="text-xl">
            Masuk
          </CardTitle>
          <CardDescription>Gunakan email dan password yang Anda daftarkan.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {keluar === '1' && (
            <Alert aria-live="polite">
              <AlertDescription>Anda telah keluar.</AlertDescription>
            </Alert>
          )}
          <LoginForm />
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Belum punya akun?&nbsp;
          <Link
            href="/register"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Daftar
          </Link>
        </CardFooter>
      </Card>
    </FadeIn>
  );
}
