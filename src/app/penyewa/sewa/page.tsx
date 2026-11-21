import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
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
import type { RentalView } from '@/services';

/** Judul tab halaman daftar sewa penyewa. */
export const metadata: Metadata = { title: 'Sewa Saya' };

/**
 * Teks kendaraan: tipe, merek, model, plat, dan baterai bila ada.
 *
 * @param props.item Sewa yang ditampilkan.
 * @returns Teks ringkas kendaraan.
 */
function VehicleText({ item }: { item: RentalView }) {
  return (
    <>
      {item.vehicleTypeLabel}
      <br />
      <span className="text-muted-foreground">
        {item.vehicleBrand} {item.vehicleModel}
        {item.plateNumber !== null && ` - ${item.plateNumber}`}
        {item.batteryKwh !== null && ` - ${item.batteryKwh} kWh`}
        {item.remainingKwh !== null && ` (sisa ${item.remainingKwh} kWh)`}
      </span>
    </>
  );
}

/**
 * Total biaya satu sewa: biaya sewa awal ditambah perpanjangan, dengan catatan
 * kecil rincian isi listrik dan perpanjangan bila ada.
 *
 * @param props.item Sewa yang ditampilkan.
 * @returns Total biaya beserta catatannya.
 */
function TotalCostText({ item }: { item: RentalView }) {
  return (
    <>
      {formatRupiah(item.grandTotal)}
      {item.chargeCost > 0 && (
        <>
          <br />
          <span className="text-muted-foreground">
            termasuk isi listrik {formatRupiah(item.chargeCost)}
          </span>
        </>
      )}
      {item.extensionTotal > 0 && (
        <>
          <br />
          <span className="text-muted-foreground">
            termasuk perpanjangan {formatRupiah(item.extensionTotal)}
          </span>
        </>
      )}
    </>
  );
}

/**
 * Daftar perpanjangan satu sewa: jenis dan jumlah, tanggal selesai baru, biaya,
 * dan tautan bukti pembayaran perpanjangan.
 *
 * @param props.item Sewa yang ditampilkan.
 * @returns Daftar perpanjangan, atau tidak ada tampilan bila belum pernah diperpanjang.
 */
function ExtensionList({ item }: { item: RentalView }) {
  if (item.extensions.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-medium">Perpanjangan ({item.extensions.length})</p>
      <ul className="flex flex-col gap-1">
        {item.extensions.map((perpanjangan) => (
          <li key={perpanjangan.id} className="flex flex-wrap gap-x-2">
            <span>
              {perpanjangan.typeLabel} {perpanjangan.quantityLabel}, selesai{' '}
              {perpanjangan.newEndDateLabel}, {formatRupiah(perpanjangan.amount)}
            </span>
            <a
              href={`/bukti-perpanjangan/${perpanjangan.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Lihat bukti
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Tautan bukti pembayaran sewa awal.
 *
 * @param props.rentalId Id sewa.
 * @returns Tautan "Lihat" yang terbuka di tab baru.
 */
function ProofLink({ rentalId }: { rentalId: number }) {
  return (
    <a
      href={`/bukti-pembayaran/${rentalId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4"
    >
      Lihat
    </a>
  );
}

/**
 * Halaman Sewa Saya: semua sewa milik penyewa yang sedang masuk, terbaru di
 * atas, tanpa halaman dan tanpa penyaring. Total biaya sudah termasuk
 * perpanjangan, dan tiap perpanjangan tampil lengkap dengan tautan buktinya.
 * Di layar lebar sewa ditampilkan sebagai tabel; di layar sempit (di bawah
 * breakpoint `md`) tiap sewa menjadi kartu bertumpuk. Id penyewa diambil dari
 * sesi, bukan dari alamat atau formulir.
 *
 * @param props.searchParams Parameter alamat; `baru=1` menampilkan pemberitahuan sewa berhasil disimpan.
 * @returns Pemberitahuan (bila ada) dan daftar sewa beserta tautan bukti pembayaran.
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
              Sewa berhasil disimpan. Garasi yang Anda pilih kini berstatus terpakai.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle as="h1">Sewa Saya ({sewa.length})</CardTitle>
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
              <>
                <ul className="flex flex-col gap-3 md:hidden">
                  {sewa.map((item) => (
                    <li key={item.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-medium">{item.garageId}</span>
                          <br />
                          <span className="text-muted-foreground">{item.garageTypeLabel}</span>
                        </div>
                        <Badge variant={item.isActive ? 'secondary' : 'outline'}>
                          {item.statusLabel}
                        </Badge>
                      </div>
                      <div>
                        <VehicleText item={item} />
                      </div>
                      <div>
                        {item.rentalTypeLabel}
                        {item.days !== null && ` (${item.days} hari)`}
                        <br />
                        <span className="text-muted-foreground">
                          {item.startDateLabel} sampai {item.endDateLabel}
                        </span>
                      </div>
                      <div className="font-medium">
                        <TotalCostText item={item} />
                      </div>
                      <div>
                        Bukti pembayaran: <ProofLink rentalId={item.id} />
                      </div>
                      <ExtensionList item={item} />
                    </li>
                  ))}
                </ul>

                <div className="hidden md:block">
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
                        <Fragment key={item.id}>
                          <TableRow>
                            <TableCell>
                              <span className="font-medium">{item.garageId}</span>
                              <br />
                              <span className="text-muted-foreground">{item.garageTypeLabel}</span>
                            </TableCell>
                            <TableCell>
                              <VehicleText item={item} />
                            </TableCell>
                            <TableCell>
                              {item.rentalTypeLabel}
                              {item.days !== null && ` (${item.days} hari)`}
                            </TableCell>
                            <TableCell>{item.startDateLabel}</TableCell>
                            <TableCell>{item.endDateLabel}</TableCell>
                            <TableCell>
                              <TotalCostText item={item} />
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.isActive ? 'secondary' : 'outline'}>
                                {item.statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <ProofLink rentalId={item.id} />
                            </TableCell>
                          </TableRow>
                          {item.extensions.length > 0 && (
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={8}>
                                <ExtensionList item={item} />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </FadeIn>
  );
}
