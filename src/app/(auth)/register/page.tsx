import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/forms/RegisterForm';
import { FadeIn } from '@/components/motion/FadeIn';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getCurrentUser, homePathFor } from '@/lib/auth/dal';

/** Judul tab halaman pendaftaran. */
export const metadata: Metadata = { title: 'Daftar Penyewa' };

/**
 * Halaman pendaftaran penyewa. Pengguna yang sudah masuk dialihkan ke beranda perannya.
 *
 * @returns Kartu berisi formulir pendaftaran dan tautan ke halaman masuk.
 */
export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user !== null) {
    redirect(homePathFor(user.role));
  }

  return (
    <FadeIn>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Pendaftaran Penyewa</CardTitle>
          <CardDescription>
            Isi data sesuai KTP. Akun dapat dipakai setelah diverifikasi admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Sudah punya akun?&nbsp;
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Masuk
          </Link>
        </CardFooter>
      </Card>
    </FadeIn>
  );
}
