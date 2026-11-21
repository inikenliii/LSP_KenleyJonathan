/**
 * @file Kontrak hasil Server Action untuk formulir.
 *
 * Modul ini tidak memakai API khusus server sehingga aman diimpor oleh
 * komponen klien (untuk tipe dan nilai awal) maupun oleh Server Action.
 */
import { DuplicateUserError, ValidationError, toAppError } from '@/domain';

/** Hasil satu pengiriman formulir yang dikembalikan Server Action ke komponen formulir. */
export type ActionState = {
  /** `true` bila aksi berhasil. */
  ok: boolean;
  /** Pesan umum untuk pengguna. */
  message?: string;
  /** Pesan error per nama field. */
  fieldErrors?: Record<string, string[]>;
  /** Isian yang dikirim, dikembalikan agar tidak hilang (tidak pernah berisi password). */
  values?: Record<string, string>;
};

/** Keadaan awal formulir sebelum dikirim. */
export const INITIAL_ACTION_STATE: ActionState = { ok: false };

/** Pesan umum untuk kegagalan tak terduga; tanpa jejak tumpukan, SQL, atau kode error. */
const PESAN_UMUM = 'Terjadi kesalahan pada server. Silakan coba lagi nanti.';

/**
 * Mengambil isian bertipe teks dari FormData untuk nama field yang disebutkan.
 *
 * @param formData Data formulir yang dikirim.
 * @param fields Nama field yang diambil.
 * @returns Pasangan nama field dan isiannya; field yang bukan teks dilewati.
 */
export function readFormFields(
  formData: FormData,
  fields: readonly string[],
): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const nama of fields) {
    const nilai = formData.get(nama);
    if (typeof nilai === 'string') {
      hasil[nama] = nilai;
    }
  }
  return hasil;
}

/**
 * Mengubah error menjadi ActionState yang aman ditampilkan. Error tak terduga
 * hanya dicatat di server dan diganti pesan umum.
 *
 * @param error Error yang tertangkap.
 * @param values Isian formulir yang dikembalikan agar tidak hilang.
 * @returns ActionState gagal.
 */
export function toActionState(error: unknown, values?: Record<string, string>): ActionState {
  const galat = toAppError(error);

  if (galat instanceof ValidationError) {
    return { ok: false, message: galat.message, fieldErrors: galat.fieldErrors, values };
  }
  if (galat instanceof DuplicateUserError && galat.field !== null) {
    return {
      ok: false,
      message: galat.message,
      fieldErrors: { [galat.field]: [galat.message] },
      values,
    };
  }
  if (galat.expose) {
    return { ok: false, message: galat.message, values };
  }

  console.error(galat.cause ?? galat);
  return { ok: false, message: PESAN_UMUM, values };
}
