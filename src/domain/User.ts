/**
 * @file Entitas domain User: peran, status verifikasi, dan aturan hak akses.
 *
 * Modul ini murni: tidak mengimpor framework, ORM, maupun pustaka lain,
 * sehingga dapat diuji tanpa database.
 */

/** Peran yang dikenal sistem. */
export type UserRole = 'ADMIN' | 'RENTER';

/** Status verifikasi pendaftaran penyewa. */
export type VerificationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/** Nilai peran yang dipakai di seluruh kode agar tidak menulis string mentah. */
export const USER_ROLE = Object.freeze({
  ADMIN: 'ADMIN',
  RENTER: 'RENTER',
} as const satisfies Record<UserRole, UserRole>);

/** Nilai status verifikasi yang dipakai di seluruh kode. */
export const VERIFICATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
} as const satisfies Record<VerificationStatus, VerificationStatus>);

/** Data yang membentuk satu pengguna. Sengaja tanpa hash password. */
export interface UserProps {
  id: number;
  nik: string | null;
  fullName: string;
  phone: string | null;
  email: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
  verifiedAt: Date | null;
  verifiedById: number | null;
  createdAt: Date | null;
}

/** Bentuk pengguna yang aman dikirim ke tampilan (tanpa hash password). */
export interface UserDTO {
  id: number;
  nik: string | null;
  fullName: string;
  phone: string | null;
  email: string;
  role: UserRole;
  roleLabel: string;
  verificationStatus: VerificationStatus;
  statusLabel: string;
  createdAt: Date | null;
}

/**
 * Seorang pengguna sistem penyewaan garasi (Admin atau Penyewa). Data
 * disimpan di field privat dan dibuka lewat getter agar tidak berubah dari luar.
 */
export class User {
  /** Label peran dalam Bahasa Indonesia untuk antarmuka. */
  private static readonly ROLE_LABELS: Record<UserRole, string> = {
    ADMIN: 'Admin',
    RENTER: 'Penyewa',
  };

  /** Label status verifikasi dalam Bahasa Indonesia. */
  private static readonly STATUS_LABELS: Record<VerificationStatus, string> = {
    PENDING: 'Menunggu verifikasi',
    ACCEPTED: 'Diterima',
    REJECTED: 'Ditolak',
  };

  /** Data pengguna yang tidak dapat diubah dari luar kelas. */
  readonly #props: UserProps;

  /**
   * @param props Data pengguna yang sudah divalidasi.
   */
  constructor(props: UserProps) {
    this.#props = { ...props };
  }

  /** Identitas unik pengguna. */
  get id(): number {
    return this.#props.id;
  }

  /** NIK 16 digit (kosong untuk akun Admin). */
  get nik(): string | null {
    return this.#props.nik;
  }

  /** Nama lengkap. */
  get fullName(): string {
    return this.#props.fullName;
  }

  /** Nomor telepon. */
  get phone(): string | null {
    return this.#props.phone;
  }

  /** Email, juga dipakai sebagai username. */
  get email(): string {
    return this.#props.email;
  }

  /** Peran pengguna. */
  get role(): UserRole {
    return this.#props.role;
  }

  /** Status verifikasi pendaftaran. */
  get verificationStatus(): VerificationStatus {
    return this.#props.verificationStatus;
  }

  /** Waktu admin memutuskan verifikasi. */
  get verifiedAt(): Date | null {
    return this.#props.verifiedAt;
  }

  /** Id admin yang memverifikasi. */
  get verifiedById(): number | null {
    return this.#props.verifiedById;
  }

  /** Waktu akun dibuat. */
  get createdAt(): Date | null {
    return this.#props.createdAt;
  }

  /** Label peran dalam Bahasa Indonesia. */
  get roleLabel(): string {
    return User.ROLE_LABELS[this.role];
  }

  /** Label status verifikasi dalam Bahasa Indonesia. */
  get statusLabel(): string {
    return User.STATUS_LABELS[this.verificationStatus];
  }

  /**
   * Apakah pengguna ini seorang Admin.
   *
   * @returns `true` bila perannya ADMIN.
   */
  isAdmin(): boolean {
    return this.role === USER_ROLE.ADMIN;
  }

  /**
   * Apakah pengguna ini seorang Penyewa.
   *
   * @returns `true` bila perannya RENTER.
   */
  isRenter(): boolean {
    return this.role === USER_ROLE.RENTER;
  }

  /**
   * Apakah pendaftaran masih menunggu keputusan admin.
   *
   * @returns `true` bila statusnya PENDING.
   */
  isPending(): boolean {
    return this.verificationStatus === VERIFICATION_STATUS.PENDING;
  }

  /**
   * Apakah pendaftaran sudah diterima admin.
   *
   * @returns `true` bila statusnya ACCEPTED.
   */
  isAccepted(): boolean {
    return this.verificationStatus === VERIFICATION_STATUS.ACCEPTED;
  }

  /**
   * Apakah pendaftaran ditolak admin.
   *
   * @returns `true` bila statusnya REJECTED.
   */
  isRejected(): boolean {
    return this.verificationStatus === VERIFICATION_STATUS.REJECTED;
  }

  /**
   * Aturan akses masuk: Admin selalu boleh, Penyewa hanya setelah diterima.
   *
   * @returns `true` bila boleh masuk ke sistem.
   */
  canAccessSystem(): boolean {
    return this.isAdmin() || this.canRent();
  }

  /**
   * Aturan penyewaan: hanya Penyewa yang sudah diterima yang boleh menyewa.
   *
   * @returns `true` bila boleh menyewa garasi.
   */
  canRent(): boolean {
    return this.isRenter() && this.isAccepted();
  }

  /**
   * Mengubah pengguna menjadi objek polos yang aman dikirim ke tampilan.
   *
   * @returns Data pengguna tanpa hash password.
   */
  toDTO(): UserDTO {
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
      createdAt: this.createdAt,
    };
  }
}
