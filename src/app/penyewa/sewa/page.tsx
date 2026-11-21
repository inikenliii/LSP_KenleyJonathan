import type { Metadata } from 'next';
import Link from 'next/link';
import { FadeIn } from '@/components/motion/FadeIn';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRupiah } from '@/domain';
import { requireRole } from '@/lib/auth/dal';
import { rentalService } from '@/lib/container';

/** Judul tab halaman daftar sewa penyewa. */
export const metadata: Metadata = { title: 'Sewa Saya' };

/**
 * Halaman Sewa Saya: semua sewa milik penyewa yang sedang masuk, terbaru di
 * atas, dalam satu tabel tanpa halaman dan tanpa penyaring. Id penyewa
 * diambil dari sesi, bukan dari alamat atau formulir.
 *
 * @param props.searchParams Parameter alamat; `baru=1` menampilkan pemberitahuan sewa berhasil disimpan.
 * @returns Pemberitahuan (bila ada) dan tabel sewa beserta tautan bukti pembayaran.
 */
export default async function MyRentalsPage({
  searchParams,
}: {
  searchParams: Promise<{ baru?: string }>;
}) {
  const user = await requireRole('RENTER');
  const { baru } = await searchParams;
  const sewa = await rentalService.listMyRentals(user.id);

  return (
    <FadeIn>
      <div className="flex flex-col gap-6">
        {baru === '1' && (
          <Alert aria-live="polite">
            <AlertDescription>
              Sewa berhasil disimpan. Garasi yang Anda pilih kini berstatus used.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Sewa Saya ({sewa.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {sewa.length === 0 ? (
              <p className="text-muted-foreground">
                Belum ada sewa.{' '}
                <Link href="/penyewa/sewa/baru" className="underline underline-offset-4">
                  Buat sewa baru
                </Link>
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Garasi</TableHead>
                    <TableHead>Kendaraan</TableHead>
                    <TableHead>Tipe Sewa</TableHead>
                    <TableHead>Mulai</TableHead>
                    <TableHead>Selesai</TableHead>
                    <TableHead>Total Biaya</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bukti</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sewa.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-medium">{item.garageId}</span>
                        <br />
                        <span className="text-muted-foreground">{item.garageTypeLabel}</span>
                      </TableCell>
                      <TableCell>
                        {item.vehicleTypeLabel}
                        <br />
                        <span className="text-muted-foreground">
                          {item.vehicleBrand} {item.vehicleModel}
                          {item.plateNumber !== null && ` - ${item.plateNumber}`}
                          {item.batteryKwh !== null && ` - ${item.batteryKwh} kWh`}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.rentalTypeLabel}
                        {item.days !== null && ` (${item.days} hari)`}
                      </TableCell>
                      <TableCell>{item.startDateLabel}</TableCell>
                      <TableCell>{item.endDateLabel}</TableCell>
                      <TableCell>
                        {formatRupiah(item.totalCost)}
                        {item.chargeCost > 0 && (
                          <>
                            <br />
                            <span className="text-muted-foreground">
                              termasuk isi listrik {formatRupiah(item.chargeCost)}
                            </span>
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? 'secondary' : 'outline'}>
                          {item.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`/bukti-pembayaran/${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-4"
                        >
                          Lihat
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </FadeIn>
  );
}
