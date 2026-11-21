/**
 * @file Aturan berkas bukti pembayaran: batas ukuran dan deteksi jenis gambar
 * dari tanda tangan byte (bukan dari nama berkas atau tipe yang diklaim klien).
 *
 * Modul ini murni: tidak mengimpor apa pun.
 */

/** Ukuran maksimum bukti pembayaran: 2 MB. */
export const PAYMENT_PROOF_MAX_BYTES = 2 * 1024 * 1024;

/** Jenis gambar yang diterima, dipakai juga sebagai ekstensi berkas. */
export type ProofImageType = 'jpg' | 'png' | 'webp';

/** Tipe konten HTTP untuk setiap jenis gambar yang diterima. */
export const PROOF_CONTENT_TYPES: Readonly<Record<ProofImageType, string>> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Tanda tangan awal berkas PNG. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/**
 * Memeriksa apakah byte pada posisi tertentu sama dengan pola.
 *
 * @param bytes Data berkas.
 * @param offset Posisi awal pemeriksaan.
 * @param pattern Deretan byte yang diharapkan.
 * @returns `true` bila seluruh pola cocok.
 */
function startsWith(bytes: Uint8Array, offset: number, pattern: readonly number[]): boolean {
  return pattern.every((nilai, indeks) => bytes[offset + indeks] === nilai);
}

/**
 * Mendeteksi jenis gambar dari tanda tangan byte.
 *
 * @param bytes Isi berkas.
 * @returns `'jpg'`, `'png'`, `'webp'`, atau `null` bila bukan gambar yang diterima.
 * @example
 * detectProofImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])); // "jpg"
 */
export function detectProofImageType(bytes: Uint8Array): ProofImageType | null {
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) {
    return 'jpg';
  }
  if (startsWith(bytes, 0, PNG_SIGNATURE)) {
    return 'png';
  }
  // WebP: "RIFF" + 4 byte ukuran + "WEBP"
  if (startsWith(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, 8, [0x57, 0x45, 0x42, 0x50])) {
    return 'webp';
  }
  return null;
}
