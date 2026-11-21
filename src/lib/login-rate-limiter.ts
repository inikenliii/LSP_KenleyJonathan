/**
 * @file Pembatas percobaan masuk sederhana di memori.
 *
 * Tujuannya memperlambat tebakan password: tiap kunci (email dan alamat IP)
 * hanya boleh mencoba sejumlah kali dalam satu jendela waktu. Catatan penting:
 * hitungan disimpan di memori proses Node.js yang sedang berjalan, jadi hilang
 * saat server dimulai ulang dan tidak dibagi antarproses atau antarserver.
 * Itu cukup untuk satu server aplikasi ini, tetapi bukan pengganti pembatas
 * terpusat (misalnya di reverse proxy atau Redis) bila aplikasi dijalankan
 * pada banyak proses.
 */

/** Jendela waktu pembatasan: 15 menit, dalam milidetik. */
export const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

/** Batas percobaan bawaan bila `AUTH_RATE_LIMIT_MAX` tidak diatur atau tidak sah. */
export const DEFAULT_LOGIN_RATE_MAX = 10;

/** Jumlah kunci tersimpan yang memicu pembersihan catatan kedaluwarsa. */
const AMBANG_PEMBERSIHAN = 1000;

/**
 * Membaca batas percobaan dari variabel lingkungan `AUTH_RATE_LIMIT_MAX`.
 *
 * @param env Sumber variabel lingkungan; bawaannya `process.env`.
 * @returns Bilangan bulat positif dari variabel itu, atau 10 bila kosong atau tidak sah.
 */
export function readLoginRateLimitMax(
  env: Record<string, string | undefined> = process.env,
): number {
  const mentah = env.AUTH_RATE_LIMIT_MAX?.trim();
  if (mentah === undefined || !/^\d{1,6}$/.test(mentah)) {
    return DEFAULT_LOGIN_RATE_MAX;
  }
  const nilai = Number(mentah);
  return nilai >= 1 ? nilai : DEFAULT_LOGIN_RATE_MAX;
}

/**
 * Menyusun kunci pembatas dari email dan alamat IP klien.
 *
 * @param email Email yang sudah dirapikan (huruf kecil, tanpa spasi tepi).
 * @param clientIp Alamat IP klien bila diketahui.
 * @returns `email|ip`, atau hanya `email` bila IP tidak diketahui.
 */
export function buildLoginRateKey(email: string, clientIp?: string | null): string {
  const emailBersih = email.trim().toLowerCase();
  const ip = clientIp?.trim();
  return ip ? `${emailBersih}|${ip}` : emailBersih;
}

/** Catatan percobaan satu kunci pada jendela yang sedang berjalan. */
interface RateEntry {
  /** Jumlah percobaan sejak jendela dimulai. */
  count: number;
  /** Waktu (ms) jendela berakhir. */
  resetAt: number;
}

/**
 * Pembatas percobaan masuk dengan jendela tetap (fixed window). Percobaan
 * pertama pada suatu kunci memulai jendela baru; setelah jendela berakhir
 * hitungan mulai dari nol lagi. Percobaan yang ditolak tidak memperpanjang
 * jendela.
 */
export class LoginRateLimiter {
  readonly #entries = new Map<string, RateEntry>();
  readonly #maxAttempts: number;
  readonly #windowMs: number;
  readonly #now: () => number;

  /**
   * @param options.maxAttempts Jumlah percobaan yang diizinkan per jendela (bawaan 10).
   * @param options.windowMs Panjang jendela dalam milidetik (bawaan 15 menit).
   * @param options.now Sumber waktu dalam milidetik; dapat diganti saat pengujian.
   */
  constructor(
    options: { maxAttempts?: number; windowMs?: number; now?: () => number } = {},
  ) {
    this.#maxAttempts = options.maxAttempts ?? DEFAULT_LOGIN_RATE_MAX;
    this.#windowMs = options.windowMs ?? LOGIN_RATE_WINDOW_MS;
    this.#now = options.now ?? Date.now;
  }

  /**
   * Mencatat satu percobaan dan memutuskan apakah boleh dilanjutkan.
   *
   * @param key Kunci pembatas, lihat {@link buildLoginRateKey}.
   * @returns `true` bila percobaan masih dalam batas; `false` bila sudah melewati batas.
   */
  tryConsume(key: string): boolean {
    const sekarang = this.#now();
    this.#prune(sekarang);
    const catatan = this.#entries.get(key);
    if (catatan === undefined || catatan.resetAt <= sekarang) {
      this.#entries.set(key, { count: 1, resetAt: sekarang + this.#windowMs });
      return true;
    }
    if (catatan.count >= this.#maxAttempts) {
      return false;
    }
    catatan.count += 1;
    return true;
  }

  /**
   * Menghapus hitungan satu kunci, dipanggil setelah masuk berhasil.
   *
   * @param key Kunci pembatas.
   */
  reset(key: string): void {
    this.#entries.delete(key);
  }

  /**
   * Membuang catatan yang jendelanya sudah berakhir bila jumlahnya mulai banyak,
   * agar memori tidak terus bertambah.
   *
   * @param sekarang Waktu saat ini dalam milidetik.
   */
  #prune(sekarang: number): void {
    if (this.#entries.size < AMBANG_PEMBERSIHAN) {
      return;
    }
    for (const [kunci, catatan] of this.#entries) {
      if (catatan.resetAt <= sekarang) {
        this.#entries.delete(kunci);
      }
    }
  }
}
