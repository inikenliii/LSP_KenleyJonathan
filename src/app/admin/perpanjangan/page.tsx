import type { Metadata } from 'next';
import Link from 'next/link';
import { ExtensionForm } from '@/components/forms/ExtensionForm';
import { FadeIn } from '@/components/motion/FadeIn';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NotFoundError, formatRupiah, toAppError } from '@/domain';
import { requireRole } from '@/lib/auth/dal';
import { rentalExtensionService } from '@/lib/container';
import type { RentalExtensionDetail } from '@/services';

/** Judul tab halaman perpanjangan sewa. */
export const metadata: Metadata = { title: 'Perpanjangan Sewa' };

/**
 * Halaman Perpanjangan: daftar garasi yang disewa hari ini (urut menurut ID
 * garasi, tanpa halaman), pilihan satu sewa lewat tautan "Pilih", formulir
 * perpanjangan untuk sewa yang dipilih, dan riwayat perpanjangannya (tanggal
 * lama dan baru, jenis dan jumlah, tambahan hari, sisa biaya, bukti, Admin, dan waktu). Peran
 * Admin diperiksa di halaman ini sendiri.
 *
 * @param props.searchParams Parameter alamat; `sewa` adalah Id sewa terpilih (1 sampai 9 angka)
 *   dan `berhasil=1` menampilkan pemberitahuan perpanjangan tersimpan.
 * @returns Pemberitahuan (bila ada), daftar sewa aktif, kartu perpanjangan dan riwayat sewa terpilih.
 */
export default async function ExtensionsPage({
  searchParams,
}: {
  searchParams: Promise<{ sewa?: string; berhasil?: string }>;
}) {
  await requireRole('ADMIN');
  const { sewa, berhasil } = await searchParams;
  const aktif = await rentalExtensionService.listActiveRentals();

  let detail: RentalExtensionDetail | null = null;
  let sewaTidakDitemukan = false;
  if (sewa !== undefined) {
    if (/^\d{1,9}$/.test(sewa)) {
      try {
        detail = await rentalExtensionService.getRentalExtensions(Number(sewa));
      } catch (error) {
        if (toAppError(error) instanceof NotFoundError) {
          sewaTidakDitemukan = true;
        } else {
          throw error;
        }
      }
    } else {
      sewaTidakDitemukan = true;
    }
  }

  const terpilih = detail?.rental ?? null;

  return (
    <FadeIn>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Perpanjangan Sewa</h1>

        {berhasil === '1' && (
          <Alert aria-live="polite">
            <AlertDescription>
              Perpanjangan berhasil disimpan. Tanggal selesai sewa sudah diperbarui.
            </AlertDescription>
          </Alert>
        )}
        {sewaTidakDitemukan && (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>Sewa tidak ditemukan.</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Garasi yang Disewa Hari Ini ({aktif.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {aktif.length === 0 ? (
              <p className="text-muted-foreground">Tidak ada garasi yang sedang disewa hari ini.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Garasi</TableHead>
                    <TableHead>Penyewa</TableHead>
                    <TableHead>Kendaraan</TableHead>
                    <TableHead>Tipe Sewa</TableHead>
                    <TableHead>Mulai</TableHead>
                    <TableHead>Selesai</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aktif.map((item) => (
                    <TableRow key={item.id} data-state={terpilih?.id === item.id ? 'selected' : undefined}>
                      <TableCell>
                        <span className="font-medium">{item.garageId}</span>
                        <br />
                        <span className="text-muted-foreground">{item.garageTypeLabel}</span>
                      </TableCell>
                      <TableCell>{item.renterName}</TableCell>
                      <TableCell>
                        {item.vehicleTypeLabel}
                        <br />
                        <span className="text-muted-foreground">
                          {item.vehicleBrand} {item.vehicleModel}
                          {item.plateNumber !== null && ` - ${item.plateNumber}`}
                        </span>
                      </TableCell>
                      <TableCell>{item.rentalTypeLabel}</TableCell>
                      <TableCell>{item.startDateLabel}</TableCell>
                      <TableCell>{item.endDateLabel}</TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/perpanjangan?sewa=${item.id}`}
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          Pilih
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {terpilih !== null && (
          <Card>
            <CardHeader>
              <CardTitle>Perpanjang Sewa {terpilih.garageId}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Penyewa</dt>
                  <dd>{terpilih.renterName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Kendaraan</dt>
                  <dd>
                    {terpilih.vehicleTypeLabel} - {terpilih.vehicleBrand} {terpilih.vehicleModel}
                    {terpilih.plateNumber !== null && ` - ${terpilih.plateNumber}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tipe Sewa</dt>
                  <dd>{terpilih.rentalTypeLabel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Mulai</dt>
                  <dd>{terpilih.startDateLabel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Selesai saat ini</dt>
                  <dd>{terpilih.endDateLabel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Harga harian</dt>
                  <dd>{formatRupiah(terpilih.dailyPrice)}</dd>
                </div>
              </dl>

              {terpilih.isActive ? (
                <ExtensionForm
                  key={terpilih.id}
                  rentalId={terpilih.id}
                  currentEndDate={terpilih.endDate}
                  currentEndDateLabel={terpilih.endDateLabel}
                  maxExtensionDays={terpilih.maxExtensionDays}
                  dailyPrice={terpilih.dailyPrice}
                />
              ) : (
                <p className="text-muted-foreground">
                  Sewa ini sudah berakhir dan tidak bisa diperpanjang.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {detail !== null && (
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Perpanjangan ({detail.extensions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.extensions.length === 0 ? (
                <p className="text-muted-foreground">Belum ada perpanjangan untuk sewa ini.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal Selesai Lama</TableHead>
                      <TableHead>Tanggal Selesai Baru</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Jumlah</TableHead>
                      <TableHead>Tambahan Hari</TableHead>
                      <TableHead>Sisa Biaya Dibayar</TableHead>
                      <TableHead>Bukti</TableHead>
                      <TableHead>Disimpan Oleh</TableHead>
                      <TableHead>Waktu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.extensions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.previousEndDateLabel}</TableCell>
                        <TableCell>{item.newEndDateLabel}</TableCell>
                        <TableCell>{item.extensionTypeLabel}</TableCell>
                        <TableCell>{item.quantityLabel}</TableCell>
                        <TableCell>{item.additionalDays} hari</TableCell>
                        <TableCell>{formatRupiah(item.amount)}</TableCell>
                        <TableCell>
                          <a
                            href={`/bukti-perpanjangan/${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-4"
                          >
                            Lihat
                          </a>
                        </TableCell>
                        <TableCell>{item.adminName}</TableCell>
                        <TableCell>{item.createdAtLabel}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </FadeIn>
  );
}
