/**
 * @file Hierarki error domain untuk aplikasi penyewaan garasi.
 *
 * Modul ini murni: tidak mengimpor apa pun. Setiap error membawa kode status
 * HTTP dan pesan Bahasa Indonesia yang aman ditampilkan ke pengguna.
 */

/**
 * Error dasar aplikasi. Semua error domain turunan dari kelas ini sehingga
 * penanganan error pusat cukup memeriksa `instanceof AppError`.
 */
export class AppError extends Error {
  /**
   * @param {string} message Pesan yang aman ditampilkan ke pengguna.
   * @param {object} [options]
   * @param {number} [options.statusCode] Kode status HTTP.
   * @param {string} [options.code] Kode error singkat untuk mesin.
   */
  constructor(message, { statusCode = 400, code = 'APP_ERROR' } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.expose = true;
  }
}

/**
 * Data masukan tidak lolos validasi. Menyimpan daftar pesan per field.
 */
export class ValidationError extends AppError {
  /**
   * @param {Record<string, string[]>} [fieldErrors] Pesan error per nama field.
   * @param {string} [message] Pesan umum.
   */
  constructor(fieldErrors = {}, message = 'Data yang dikirim tidak valid.') {
    super(message, { statusCode: 422, code: 'VALIDATION_ERROR' });
    this.fieldErrors = fieldErrors;
  }

  /**
   * Mengambil pesan pertama untuk setiap field.
   * @returns {Record<string, string>}
   */
  firstErrors() {
    const result = {};
    for (const [field, messages] of Object.entries(this.fieldErrors)) {
      if (messages.length > 0) {
        result[field] = messages[0];
      }
    }
    return result;
  }

  /**
   * Memvalidasi masukan memakai skema bergaya Zod (memiliki `safeParse`).
   * Skema dipakai secara duck-typing agar modul ini tetap tanpa impor.
   *
   * @param {{ safeParse: Function }} schema Skema validasi.
   * @param {unknown} input Data yang diperiksa.
   * @returns {any} Data hasil parse bila valid.
   * @throws {ValidationError} Bila ada isu validasi.
   */
  static parse(schema, input) {
    const result = schema.safeParse(input);
    if (result.success) {
      return result.data;
    }
    const fieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path.length > 0 ? String(issue.path[0]) : '_form';
      if (!fieldErrors[key]) {
        fieldErrors[key] = [];
      }
      fieldErrors[key].push(issue.message);
    }
    throw new ValidationError(fieldErrors);
  }
}

/**
 * Email atau NIK sudah dipakai pendaftar lain.
 */
export class DuplicateUserError extends AppError {
  /**
   * @param {'email'|'nik'|null} [field] Field yang bentrok.
   * @param {string} [message] Pesan untuk pengguna.
   */
  constructor(field = null, message = 'Email atau NIK sudah terdaftar.') {
    super(message, { statusCode: 409, code: 'DUPLICATE_USER' });
    this.field = field;
  }
}

/**
 * Email atau password salah saat login.
 */
export class AuthenticationError extends AppError {
  /**
   * @param {string} [message] Pesan umum agar tidak membocorkan akun mana yang ada.
   */
  constructor(message = 'Email atau password salah.') {
    super(message, { statusCode: 401, code: 'AUTHENTICATION_FAILED' });
  }
}

/**
 * Akun belum boleh masuk karena belum diterima admin.
 */
export class AccountNotVerifiedError extends AppError {
  /**
   * @param {string} verificationStatus Status verifikasi akun (PENDING atau REJECTED).
   */
  constructor(verificationStatus) {
    const message =
      verificationStatus === 'REJECTED'
        ? 'Pendaftaran Anda ditolak oleh admin.'
        : 'Akun Anda masih menunggu verifikasi admin.';
    super(message, { statusCode: 403, code: 'ACCOUNT_NOT_VERIFIED' });
    this.verificationStatus = verificationStatus;
  }
}

/**
 * Pengguna tidak punya hak atas halaman atau aksi yang diminta.
 */
export class ForbiddenError extends AppError {
  /**
   * @param {string} [message] Pesan untuk pengguna.
   */
  constructor(message = 'Anda tidak memiliki akses ke halaman ini.') {
    super(message, { statusCode: 403, code: 'FORBIDDEN' });
  }
}

/**
 * Data atau halaman yang diminta tidak ditemukan.
 */
export class NotFoundError extends AppError {
  /**
   * @param {string} [message] Pesan untuk pengguna.
   */
  constructor(message = 'Halaman tidak ditemukan.') {
    super(message, { statusCode: 404, code: 'NOT_FOUND' });
  }
}

/**
 * Permintaan bertentangan dengan keadaan data saat ini.
 */
export class ConflictError extends AppError {
  /**
   * @param {string} message Penjelasan konflik.
   */
  constructor(message) {
    super(message, { statusCode: 409, code: 'CONFLICT' });
  }
}

/**
 * Terlalu banyak percobaan dalam waktu singkat (pembatasan laju).
 */
export class TooManyRequestsError extends AppError {
  /**
   * @param {string} [message] Pesan untuk pengguna.
   */
  constructor(message = 'Terlalu banyak percobaan. Silakan coba lagi dalam beberapa menit.') {
    super(message, { statusCode: 429, code: 'TOO_MANY_REQUESTS' });
  }
}

/**
 * Jumlah garasi yang diminta melewati batas maksimum per tipe.
 */
export class CapacityExceededError extends AppError {
  /**
   * @param {object} detail
   * @param {string} detail.typeLabel Nama tipe garasi untuk pesan.
   * @param {number} detail.lastNumber Jumlah garasi tipe ini saat ini.
   * @param {number} detail.requested Jumlah yang diminta.
   * @param {number} detail.max Batas maksimum per tipe.
   */
  constructor({ typeLabel, lastNumber, requested, max }) {
    super(
      `Jumlah garasi ${typeLabel} akan melebihi batas ${max}. ` +
        `Saat ini ${lastNumber} garasi, sisa kuota ${max - lastNumber}.`,
      { statusCode: 422, code: 'CAPACITY_EXCEEDED' },
    );
    this.typeLabel = typeLabel;
    this.lastNumber = lastNumber;
    this.requested = requested;
    this.max = max;
  }
}
