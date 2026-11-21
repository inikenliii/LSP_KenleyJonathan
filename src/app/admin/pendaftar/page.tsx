import type { Metadata } from 'next';
import { DecisionForm } from '@/components/forms/DecisionForm';
import { FadeIn } from '@/components/motion/FadeIn';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireRole } from '@/lib/auth/dal';
import { verificationService } from '@/lib/container';

/** Judul tab halaman verifikasi pendaftar. */
export const metadata: Metadata = { title: 'Verifikasi Pendaftar' };

/**
 * Halaman Verifikasi Pendaftar: daftar penyewa yang menunggu keputusan Admin,
 * terlama dulu, dengan pilihan Terima atau Tolak pada setiap baris.
 *
 * @param props.searchParams Parameter alamat; `keputusan` menampilkan hasil keputusan terakhir.
 * @returns Tabel pendaftar, atau pesan bila tidak ada yang menunggu.
 */
export default async function RegistrantsPage({
  searchParams,
}: {
  searchParams: Promise<{ keputusan?: string }>;
}) {
  await requireRole('ADMIN');
  const { keputusan } = await searchParams;
  const pendaftar = await verificationService.listPending();

  return (
    <FadeIn>
      <div className="flex flex-col gap-4">
        {keputusan === 'diterima' && (
          <Alert aria-live="polite">
            <AlertDescription>Pendaftar diterima. Penyewa sekarang dapat masuk.</AlertDescription>
          </Alert>
        )}
        {keputusan === 'ditolak' && (
          <Alert aria-live="polite">
            <AlertDescription>Pendaftar ditolak.</AlertDescription>
          </Alert>
        )}
        <h1 className="text-2xl font-semibold">Verifikasi Pendaftar</h1>
        <p className="text-muted-foreground">
          Cocokkan NIK dan nama lengkap dengan KTP pendaftar sebelum menerima pendaftaran.
        </p>

        {pendaftar.length === 0 ? (
          <Card>
            <CardContent>Tidak ada pendaftar yang menunggu verifikasi.</CardContent>
          </Card>
        ) : (
          <Table>
            <TableCaption>Pendaftar yang menunggu verifikasi</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Lengkap</TableHead>
                <TableHead>NIK</TableHead>
                <TableHead>Nomor Telepon</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tanggal Daftar</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendaftar.map((user) => (
                <TableRow key={user.id} data-user-id={user.id}>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>{user.nik}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.createdAt?.toLocaleDateString('id-ID')}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{user.statusLabel}</Badge>
                  </TableCell>
                  <TableCell>
                    <DecisionForm userId={user.id} fullName={user.fullName} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </FadeIn>
  );
}
