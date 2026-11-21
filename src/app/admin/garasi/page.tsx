import type { Metadata } from 'next';
import { GarageBatchForm } from '@/components/forms/GarageBatchForm';
import { FadeIn } from '@/components/motion/FadeIn';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GARAGE_TYPE_CODES, GarageFactory, formatRupiah } from '@/domain';
import { requireRole } from '@/lib/auth/dal';
import { garageService } from '@/lib/container';

/** Judul tab halaman kelola garasi. */
export const metadata: Metadata = { title: 'Kelola Garasi' };

/**
 * Halaman Kelola Garasi: tabel harga per tipe, formulir pembuatan garasi
 * berkelompok, dan daftar semua garasi dengan harga serta statusnya. Satu
 * tabel biasa urut menurut ID, tanpa halaman dan tanpa penyaring.
 *
 * @returns Judul halaman, kartu harga per tipe, formulir, dan daftar garasi.
 */
export default async function GaragesPage() {
  await requireRole('ADMIN');
  const [konfigurasi, garasi] = await Promise.all([
    garageService.getTypeConfigs(),
    garageService.listGarages(),
  ]);

  // Hanya objek biasa yang boleh melewati batas ke komponen klien.
  const typeOptions = GARAGE_TYPE_CODES.map((kode) => ({
    value: kode,
    label: GarageFactory.create(kode).label,
  }));

  return (
    <FadeIn>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Kelola Garasi</h1>

        <Card>
          <CardHeader>
            <CardTitle>Harga per Tipe</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>Harga bulanan adalah 25 kali harga harian.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Awalan ID</TableHead>
                  <TableHead>Harga Harian</TableHead>
                  <TableHead>Harga Bulanan (25 x harian)</TableHead>
                  <TableHead>Harga per kWh</TableHead>
                  <TableHead>Jumlah Garasi</TableHead>
                  <TableHead>Sisa Kuota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {konfigurasi.map((tipe) => (
                  <TableRow key={tipe.code}>
                    <TableCell className="font-medium">{tipe.label}</TableCell>
                    <TableCell>{tipe.prefix}</TableCell>
                    <TableCell>
                      {tipe.dailyPrice > 0 ? formatRupiah(tipe.dailyPrice) : 'Belum diatur'}
                    </TableCell>
                    <TableCell>
                      {tipe.monthlyPrice === null ? 'Belum diatur' : formatRupiah(tipe.monthlyPrice)}
                    </TableCell>
                    <TableCell>
                      {tipe.usesKwhPrice
                        ? tipe.pricePerKwh === null
                          ? 'Belum diatur'
                          : formatRupiah(tipe.pricePerKwh)
                        : '-'}
                    </TableCell>
                    <TableCell>{tipe.totalCreated}</TableCell>
                    <TableCell>{tipe.remainingQuota}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buat Garasi Berkelompok</CardTitle>
          </CardHeader>
          <CardContent>
            <GarageBatchForm typeOptions={typeOptions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Garasi ({garasi.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {garasi.length === 0 ? (
              <p className="text-muted-foreground">Belum ada garasi.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Harga Harian</TableHead>
                    <TableHead>Harga Bulanan</TableHead>
                    <TableHead>Harga per kWh</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {garasi.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.id}</TableCell>
                      <TableCell>{item.typeLabel}</TableCell>
                      <TableCell>{formatRupiah(item.dailyPrice)}</TableCell>
                      <TableCell>{formatRupiah(item.monthlyPrice)}</TableCell>
                      <TableCell>
                        {item.pricePerKwh === null ? '-' : formatRupiah(item.pricePerKwh)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'AVAILABLE' ? 'secondary' : 'outline'}>
                          {item.statusLabel}
                        </Badge>
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
