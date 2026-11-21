/**
 * @file Entitas domain User: peran, status verifikasi, dan aturan hak akses.
 *
 * Modul ini murni (pure): tidak mengimpor framework, ORM, driver database,
 * library hashing, maupun library validasi, sehingga dapat diuji langsung
 * tanpa database.
 */

/**
 * Representasi seorang pengguna sistem penyewaan garasi (Admin atau Penyewa).
 * Objek ini sengaja tidak menyimpan hash password agar tidak pernah ikut
 * terkirim ke tampilan.
 */
export class User {
  /** Daftar peran yang dikenal sistem. */
  static ROLE = Object.freeze({ ADMIN: 'ADMIN', RENTER: 'RENTER' });

  /** Daftar status verifikasi pendaftaran penyewa. */
  static STATUS = Object.freeze({
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
  });

  /** Label peran dalam Bahasa Indonesia untuk ditampilkan di antarmuka. */
  static ROLE_LABEL = Object.freeze({ ADMIN: 'Admin', RENTER: 'Penyewa' });

  /** Label status verifikasi dalam Bahasa Indonesia. */
  static STATUS_LABEL = Object.freeze({
    PENDING: 'Menunggu verifikasi',
    ACCEPTED: 'Diterima',
    REJECTED: 'Ditolak',
  });

  /** Biaya (cost factor) bcrypt yang dipakai untuk meng-hash password. */
  static PASSWORD_HASH_ROUNDS = 12;

  /**
   * Membuat objek User dari data yang sudah divalidasi.
   *
   * @param {object} data Data pengguna.
   * @param {number} data.id Identitas unik pengguna.
   * @param {string|null} [data.nik] NIK 16 digit (kosong untuk akun Admin).
   * @param {string} data.fullName Nama lengkap.
   * @param {string|null} [data.phone] Nomor telepon.
   * @param {string} data.email Email (juga dipakai sebagai username).
   * @param {string} data.role Salah satu nilai User.ROLE.
   * @param {string} data.verificationStatus Salah satu nilai User.STATUS.
   * @param {Date|null} [data.verifiedAt] Waktu admin memutuskan verifikasi.
   * @param {number|null} [data.verifiedById] Id admin yang memverifikasi.
   * @param {Date|null} [data.createdAt] Waktu akun dibuat.
   */
  constructor({
    id,
    nik = null,
    fullName,
    phone = null,
    email,
    role,
    verificationStatus,
    verifiedAt = null,
    verifiedById = null,
    createdAt = null,
  }) {
    this.id = id;
    this.nik = nik;
    this.fullName = fullName;
    this.phone = phone;
    this.email = email;
    this.role = role;
    this.verificationStatus = verificationStatus;
    this.verifiedAt = verifiedAt;
    this.verifiedById = verifiedById;
    this.createdAt = createdAt;
  }

  /**
   * Apakah pengguna ini seorang Admin.
   * @returns {boolean}
   */
  isAdmin() {
    return this.role === User.ROLE.ADMIN;
  }

  /**
   * Apakah pengguna ini seorang Penyewa.
   * @returns {boolean}
   */
  isRenter() {
    return this.role === User.ROLE.RENTER;
  }

  /**
   * Apakah pendaftaran masih menunggu keputusan admin.
   * @returns {boolean}
   */
  isPending() {
    return this.verificationStatus === User.STATUS.PENDING;
  }

  /**
   * Apakah pendaftaran sudah diterima admin.
   * @returns {boolean}
   */
  isAccepted() {
    return this.verificationStatus === User.STATUS.ACCEPTED;
  }

  /**
   * Apakah pendaftaran ditolak admin.
   * @returns {boolean}
   */
  isRejected() {
    return this.verificationStatus === User.STATUS.REJECTED;
  }

  /**
   * Aturan akses masuk: Admin selalu boleh, Penyewa hanya setelah diterima.
   * @returns {boolean}
   */
  canAccessSystem() {
    return this.isAdmin() || (this.isRenter() && this.isAccepted());
  }

  /**
   * Aturan penyewaan: hanya Penyewa yang sudah diterima yang boleh menyewa.
   * @returns {boolean}
   */
  canRent() {
    return this.isRenter() && this.isAccepted();
  }

  /**
   * Label peran dalam Bahasa Indonesia.
   * @returns {string}
   */
  get roleLabel() {
    return User.ROLE_LABEL[this.role] ?? this.role;
  }

  /**
   * Label status verifikasi dalam Bahasa Indonesia.
   * @returns {string}
   */
  get statusLabel() {
    return User.STATUS_LABEL[this.verificationStatus] ?? this.verificationStatus;
  }

  /**
   * Bentuk objek polos yang aman dikirim ke template (tanpa hash password).
   * @returns {object}
   */
  toView() {
    return {
      id: this.id,
      nik: this.nik,
      fullName: this.fullName,
      phone: this.phone,
      email: this.email,
      role: this.role,
      roleLabel: this.roleLabel,
      verificationStatus: this.verificationStatus,
      statusLabel: this.statusLabel,
      verifiedAt: this.verifiedAt,
      createdAt: this.createdAt,
    };
  }

  /**
   * Membangun User dari satu baris data database. Properti passwordHash pada
   * baris tersebut sengaja diabaikan.
   *
   * @param {object} record Baris data pengguna dari repository.
   * @returns {User}
   */
  static fromRecord(record) {
    return new User({
      id: record.id,
      nik: record.nik,
      fullName: record.fullName,
      phone: record.phone,
      email: record.email,
      role: record.role,
      verificationStatus: record.verificationStatus,
      verifiedAt: record.verifiedAt,
      verifiedById: record.verifiedById,
      createdAt: record.createdAt,
    });
  }
}
