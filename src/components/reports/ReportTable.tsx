import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRupiah, type RentalReport } from '@/domain';

/** Catatan aturan penghitungan yang ditampilkan di bawah setiap tabel laporan. */
const CATATAN_LAPORAN =
  'Sewa dihitung pada periode tanggal mulainya. Pendapatan = total biaya sewa + biaya perpanjangan.';

/**
 * Tabel satu laporan sewa: satu baris per kelompok dengan jumlah sewa dan
 * total pendapatan, ditutup baris Total. Komponen server yang hanya
 * menampilkan data dari properti.
 *
 * @param props.title Judul kartu.
 * @param props.labelHeading Judul kolom pertama (Bulan, Tanggal, Tipe Garasi, atau Penyewa).
 * @param props.detailHeading Judul kolom keterangan; kolom hanya ada bila diberikan.
 * @param props.report Laporan yang ditampilkan.
 * @param props.emptyText Teks pengganti tabel bila laporan tidak punya baris.
 * @returns Kartu berisi tabel laporan dan baris Total.
 */
export function ReportTable({
  title,
  labelHeading,
  detailHeading,
  report,
  emptyText,
}: {
  title: string;
  labelHeading: string;
  detailHeading?: string;
  report: RentalReport;
  emptyText?: string;
}) {
  const adaDetail = detailHeading !== undefined;
  const kosong = report.rows.length === 0 && emptyText !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {kosong ? (
          <p className="text-muted-foreground">{emptyText}</p>
        ) : (
          <Table>
            <TableCaption>{CATATAN_LAPORAN}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{labelHeading}</TableHead>
                {adaDetail && <TableHead>{detailHeading}</TableHead>}
                <TableHead className="text-right">Jumlah Sewa</TableHead>
                <TableHead className="text-right">Total Pendapatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((baris) => (
                <TableRow key={baris.key}>
                  <TableCell className="font-medium">{baris.label}</TableCell>
                  {adaDetail && <TableCell>{baris.detail}</TableCell>}
                  <TableCell className="text-right">{baris.count}</TableCell>
                  <TableCell className="text-right">{formatRupiah(baris.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                {adaDetail && <TableCell />}
                <TableCell className="text-right font-semibold">{report.totalCount}</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatRupiah(report.totalAmount)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
