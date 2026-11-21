/**
 * @file Pembaca bilangan bulat ketat untuk isian formulir dan alamat.
 *
 * Pengganti `z.coerce.number()`, yang memakai `Number(teks)` sehingga ikut
 * menerima bentuk seperti `0x2`, `1e1`, `2e3`, dan `+5`. Di sini teks hanya
 * diterima bila seluruhnya angka desimal biasa (boleh diawali tanda minus
 * agar batas bawah tetap memberi pesannya sendiri).
 */
import { z } from 'zod';

/** Pola bilangan bulat desimal biasa: angka saja, boleh diawali minus. */
const POLA_BULAT = /^-?\d+$/;

/** Pola bilangan desimal biasa dengan titik atau koma, mis. `1.5` atau `2,5`. */
const POLA_DESIMAL = /^-?\d+[.,]\d+$/;

/**
 * Membuat aturan dasar bilangan bulat dari teks. Angka bertipe number dari kode
 * (bukan dari formulir) diubah ke teks lebih dulu. Teks dipangkas, lalu harus
 * berupa angka desimal biasa; bentuk lain (heksadesimal, eksponen, tanda plus,
 * spasi di tengah, kosong) ditolak. Hasilnya bertipe `number`, sehingga batas
 * `.min()` dan `.max()` dapat disambungkan oleh pemanggil.
 *
 * @param pesanBukanAngka Pesan bila isian bukan angka desimal biasa atau kosong.
 * @param pesanBukanBulat Pesan bila isian berupa angka berpecahan (mis. `1.5`).
 * @returns Skema Zod yang menghasilkan `number`; batas `.min()` dan `.max()` disambungkan
 *   pemanggil lewat `.pipe(z.number()...)`.
 */
export function wholeNumber(pesanBukanAngka: string, pesanBukanBulat: string) {
  return z.preprocess(
    (nilai) => (typeof nilai === 'number' ? String(nilai) : nilai),
    z
      .string({ error: pesanBukanAngka })
      .trim()
      .transform((teks, ctx) => {
        if (POLA_BULAT.test(teks)) {
          return Number(teks);
        }
        ctx.issues.push({
          code: 'custom',
          message: POLA_DESIMAL.test(teks) ? pesanBukanBulat : pesanBukanAngka,
          input: teks,
        });
        return z.NEVER;
      }),
  );
}
