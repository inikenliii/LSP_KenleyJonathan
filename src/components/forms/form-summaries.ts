/**
 * @file Teks ringkas pilihan formulir yang dihitung dari nilai yang sedang terpilih.
 *
 * Modul ini murni (tanpa React) sehingga mudah diuji.
 */
import { RENTAL_TYPE_LABELS, formatRupiah, type RentalTypeCode } from '@/domain';

/**
 * Menyusun satu baris konfirmasi pilihan perpanjangan yang akan dikirim, misalnya
 * "Akan disimpan: Bulanan, 2 bulan, sisa biaya Rp 500.000".
 *
 * @param extensionType Jenis perpanjangan yang terpilih.
 * @param quantity Isian jumlah hari atau bulan (teks, boleh kosong).
 * @param amount Sisa biaya hasil pratinjau, atau `null` bila belum bisa dihitung.
 * @returns Kalimat konfirmasi; menyebut jumlah dan biaya hanya bila sudah terisi.
 */
export function describeExtensionChoice(
  extensionType: RentalTypeCode,
  quantity: string,
  amount: number | null,
): string {
  const satuan = extensionType === 'BULANAN' ? 'bulan' : 'hari';
  const bagian = [RENTAL_TYPE_LABELS[extensionType]];
  if (quantity.trim() !== '') {
    bagian.push(`${quantity.trim()} ${satuan}`);
  }
  if (amount !== null) {
    bagian.push(`sisa biaya ${formatRupiah(amount)}`);
  }
  return `Akan disimpan: ${bagian.join(', ')}`;
}
