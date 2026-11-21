/**
 * @file Hierarki error domain untuk aplikasi penyewaan garasi.
 *
 * Modul ini murni: tidak mengimpor apa pun. Setiap error membawa kode singkat
 * dan pesan Bahasa Indonesia yang aman ditampilkan ke pengguna, kecuali
 * error yang ditandai `expose = false`.
 */

/**
 * Error dasar aplikasi. Semua error domain turunan dari kelas ini sehingga
 * penanganan error pusat cukup memeriksa `instanceof AppError`.
 */
export class AppError extends Error {
  /** Kode error singkat untuk mesin, misalnya `VALIDATION_ERROR`. */
  readonly code: string;

  /** Apakah pesan boleh ditampilkan langsung ke pengguna. */
  readonly expose: boolean;

  /**
   * @param message Pesan yang aman ditampilkan ke pengguna.
   * @param code Kode error singkat.
   * @param options Penyebab asli (`cause`) dan apakah pesan boleh ditampilkan (`expose`, bawaan true).
   */
  constructor(
    message: string,
    code: string,
    options: { cause?: unknown; expose?: boolean } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.expose = options.expose ?? true;
  }
}

/** Data masukan tidak lolos validasi. Menyimpan daftar pesan per field. */
export class ValidationError extends AppError {
  /** Pesan error untuk setiap nama field. */
  readonly fieldErrors: Record<string, string[]>;

  /**
   * @param fieldErrors Pesan error per nama field.
   * @param message Pesan umum.
   */
  constructor(
    fieldErrors: Record<string, string[]> = {},
    message = 'Periksa kembali data yang Anda isi.',
  ) {
    super(message, 'VALIDATION_ERROR');
    this.fieldErrors = fieldErrors;
  }

  /**
   * Mengambil pesan pertama untuk setiap field.
   *
   * @returns Satu pesan per field; field tanpa pesan dilewati.
   */
  firstErrors(): Record<string, string> {
    const hasil: Record<string, string> = {};
    for (const [field, pesan] of Object.entries(this.fieldErrors)) {
      if (pesan.length > 0) {
        hasil[field] = pesan[0];
      }
    }
    return hasil;
  }
}

/** Email atau NIK sudah dipakai pendaftar lain. */
export class DuplicateUserError extends AppError {
  /** Field yang bentrok, atau null bila tidak diketahui. */
  readonly field: 'email' | 'nik' | null;

  /**
   * @param field Field yang bentrok.
   * @param message Pesan untuk pengguna.
   */
  constructor(
    field: 'email' | 'nik' | null = null,
    message = 'Email atau NIK sudah terdaftar.',
  ) {
    super(message, 'DUPLICATE_USER');
    this.field = field;
  }
}

/** Email atau password salah saat login. */
export class AuthenticationError extends AppError {
  /**
   * @param message Pesan umum agar tidak membocorkan akun mana yang ada.
   */
  constructor(message = 'Email atau password salah.') {
    super(message, 'AUTHENTICATION_FAILED');
  }
}

/**
 * Terlalu banyak percobaan masuk dalam waktu singkat. Pesannya tidak menyebut
 * apakah akun ada atau tidak, sama untuk semua email.
 */
export class TooManyAttemptsError extends AppError {
  /**
   * @param message Pesan umum untuk pengguna.
   */
  constructor(message = 'Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.') {
    super(message, 'TOO_MANY_ATTEMPTS');
  }
}

/** Akun belum boleh masuk karena belum diterima admin. */
export class AccountNotVerifiedError extends AppError {
  /** Status verifikasi akun saat ditolak masuk. */
  readonly verificationStatus: string;

  /**
   * @param verificationStatus Status verifikasi akun (PENDING atau REJECTED).
   */
  constructor(verificationStatus: string) {
    super(
      verificationStatus === 'REJECTED'
        ? 'Pendaftaran Anda ditolak oleh admin.'
        : 'Akun Anda masih menunggu verifikasi admin.',
      'ACCOUNT_NOT_VERIFIED',
    );
    this.verificationStatus = verificationStatus;
  }
}

/** Pengguna tidak punya hak atas halaman atau aksi yang diminta. */
export class ForbiddenError extends AppError {
  /**
   * @param message Pesan untuk pengguna.
   */
  constructor(message = 'Anda tidak memiliki akses ke halaman ini.') {
    super(message, 'FORBIDDEN');
  }
}

/** Data atau halaman yang diminta tidak ditemukan. */
export class NotFoundError extends AppError {
  /**
   * @param message Pesan untuk pengguna.
   */
  constructor(message = 'Data tidak ditemukan.') {
    super(message, 'NOT_FOUND');
  }
}

/** Permintaan bertentangan dengan keadaan data saat ini. */
export class ConflictError extends AppError {
  /**
   * @param message Penjelasan konflik.
   */
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

/** Jumlah garasi yang diminta melewati batas maksimum per tipe. */
export class CapacityExceededError extends AppError {
  /** Nama tipe garasi untuk pesan. */
  readonly typeLabel: string;
  /** Jumlah garasi tipe ini saat ini. */
  readonly lastNumber: number;
  /** Jumlah garasi yang diminta. */
  readonly requested: number;
  /** Batas maksimum garasi per tipe. */
  readonly max: number;

  /**
   * @param detail Rincian kapasitas: `typeLabel`, `lastNumber`, `requested`, dan `max`.
   */
  constructor(detail: {
    typeLabel: string;
    lastNumber: number;
    requested: number;
    max: number;
  }) {
    super(
      `Jumlah garasi ${detail.typeLabel} akan melebihi batas ${detail.max}. ` +
        `Saat ini ${detail.lastNumber} garasi, sisa kuota ${detail.max - detail.lastNumber}.`,
      'CAPACITY_EXCEEDED',
    );
    this.typeLabel = detail.typeLabel;
    this.lastNumber = detail.lastNumber;
    this.requested = detail.requested;
    this.max = detail.max;
  }
}

/**
 * Kegagalan tak terduga saat mengakses database. Pesan untuk pengguna dibuat
 * umum; penyebab teknis disimpan di `cause` dan hanya dicatat di server.
 */
export class DatabaseError extends AppError {
  /**
   * @param message Pesan umum untuk pengguna.
   * @param options Error asli penyebab kegagalan (`cause`).
   */
  constructor(
    message = 'Terjadi kesalahan pada database. Silakan coba lagi nanti.',
    options: { cause?: unknown } = {},
  ) {
    super(message, 'DATABASE_ERROR', { cause: options.cause, expose: false });
  }
}

/**
 * Mengubah error apa pun menjadi AppError. AppError dikembalikan apa adanya,
 * sedangkan error lain dibungkus sebagai DatabaseError dengan error asli
 * sebagai penyebab.
 *
 * @param error Error yang tertangkap.
 * @returns Error yang aman ditangani penanganan error pusat.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  return new DatabaseError(undefined, { cause: error });
}
