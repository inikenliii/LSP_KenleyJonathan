/**
 * @file Pengiriman formulir yang tidak mereset isian setelah aksi server selesai.
 *
 * Pada React 19, formulir yang memakai `<form action={...}>` direset otomatis
 * setelah aksi selesai: kontrol tak terkendali (misalnya pilihan jenis) kembali
 * ke nilai awalnya, sedangkan `useState` tetap menyimpan pilihan lama. Akibatnya
 * yang tampil di layar bisa berbeda dari yang terkirim. Dengan mengirim lewat
 * `onSubmit` dan memanggil aksi secara langsung, formulir tidak pernah direset
 * sehingga isian pengguna tetap utuh saat server menolak.
 */
import { startTransition, type FormEvent } from 'react';

/**
 * Mengirim formulir ke aksi server tanpa memicu reset otomatis React.
 *
 * Dipasang pada `onSubmit`. Pengiriman bawaan peramban dibatalkan, isi formulir
 * dibaca sebagai `FormData`, lalu aksi dipanggil di dalam transisi (syarat
 * `useActionState`) agar status `pending` tetap menyala selama aksi berjalan.
 *
 * @param event Peristiwa kirim dari formulir.
 * @param formAction Fungsi aksi dari `useActionState`.
 * @param buatFormData Pembuat `FormData` dari elemen formulir; bawaannya `new FormData(form)`.
 *   Dapat diganti saat pengujian karena `FormData` dari elemen butuh DOM.
 */
export function submitWithoutReset(
  event: FormEvent<HTMLFormElement>,
  formAction: (payload: FormData) => void,
  buatFormData: (form: HTMLFormElement) => FormData = (form) => new FormData(form),
): void {
  event.preventDefault();
  const data = buatFormData(event.currentTarget);
  startTransition(() => {
    formAction(data);
  });
}
