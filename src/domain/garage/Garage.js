/**
 * @file Kelas dasar abstrak Garage. Setiap tipe garasi (Sepeda, Mobil, Mobil
 * Listrik) adalah subkelas yang menyediakan kode tipe, label, dan awalan ID.
 *
 * Modul ini murni: tidak mengimpor framework, ORM, atau driver database.
 */

/**
 * Garasi abstrak. Kelas ini tidak dapat dibuat langsung; gunakan subkelasnya
 * (atau fungsi createGarage di index.js).
 *
 * @abstract
 */
export class Garage {
  /** Batas maksimum jumlah garasi per tipe. */
  static MAX_PER_TYPE = 999;

  /** Jumlah digit angka pada ID garasi (S001 memakai 3 digit). */
  static ID_DIGITS = 3;

  /** Status garasi yang dikenal sistem. */
  static STATUS = Object.freeze({ AVAILABLE: 'AVAILABLE', USED: 'USED' });

  /** Label status dalam Bahasa Indonesia. */
  static STATUS_LABEL = Object.freeze({ AVAILABLE: 'tersedia', USED: 'used' });

  /** @type {string|null} */
  #id;

  /** @type {string} */
  #status;

  /**
   * @param {string|null} [id] ID garasi, misalnya "S001"; null bila belum dibuat.
   * @param {string} [status] Salah satu nilai Garage.STATUS.
   * @throws {TypeError} Bila dipanggil langsung pada kelas Garage (abstrak).
   * @public
   */
  constructor(id = null, status = Garage.STATUS.AVAILABLE) {
    if (new.target === Garage) {
      throw new TypeError('Garage adalah kelas abstrak dan tidak dapat dibuat langsung.');
    }
    this.#id = id;
    this.#status = status;
  }

  /**
   * ID garasi.
   * @returns {string|null}
   * @public
   */
  get id() {
    return this.#id;
  }

  /**
   * Status garasi (nilai Garage.STATUS).
   * @returns {string}
   * @public
   */
  get status() {
    return this.#status;
  }

  /**
   * Label status dalam Bahasa Indonesia.
   * @returns {string}
   * @public
   */
  get statusLabel() {
    return Garage.STATUS_LABEL[this.#status];
  }

  /**
   * Kode tipe seperti yang disimpan di database. Wajib ditimpa subkelas.
   *
   * @abstract
   * @returns {string}
   * @throws {Error} Bila subkelas belum mengimplementasikannya.
   * @public
   */
  typeCode() {
    throw new Error('Subkelas harus mengimplementasikan typeCode().');
  }

  /**
   * Nama tipe untuk ditampilkan. Wajib ditimpa subkelas.
   *
   * @abstract
   * @returns {string}
   * @throws {Error} Bila subkelas belum mengimplementasikannya.
   * @public
   */
  typeLabel() {
    throw new Error('Subkelas harus mengimplementasikan typeLabel().');
  }

  /**
   * Huruf awalan ID. Wajib ditimpa subkelas.
   *
   * @abstract
   * @returns {string}
   * @throws {Error} Bila subkelas belum mengimplementasikannya.
   * @public
   */
  idPrefix() {
    throw new Error('Subkelas harus mengimplementasikan idPrefix().');
  }

  /**
   * Apakah tipe ini memiliki harga per kWh. Bawaannya tidak; Mobil Listrik
   * menimpanya.
   *
   * @returns {boolean}
   * @public
   */
  usesKwhPrice() {
    return false;
  }

  /**
   * Membentuk ID dari nomor urut, misalnya formatId(7) menjadi "S007".
   *
   * @param {number} sequenceNumber Nomor urut (bilangan bulat, minimal 1).
   * @param {number} [digits] Jumlah digit angka; bawaan Garage.ID_DIGITS.
   * @returns {string} ID lengkap dengan awalan tipe.
   * @throws {RangeError} Bila nomor bukan bilangan bulat di antara 1 dan 10^digits - 1.
   * @public
   */
  formatId(sequenceNumber, digits = Garage.ID_DIGITS) {
    if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1 || sequenceNumber >= 10 ** digits) {
      throw new RangeError(`Nomor urut harus bilangan bulat antara 1 dan ${10 ** digits - 1}.`);
    }
    return `${this.idPrefix()}${this.#pad(sequenceNumber, digits)}`;
  }

  /**
   * Ringkasan garasi untuk ditampilkan, misalnya
   * "Sepeda S001, Rp 5.000 per hari".
   *
   * @param {number|null} [dailyPrice] Harga harian; dilewati bila kosong.
   * @returns {string}
   * @public
   */
  describe(dailyPrice = null) {
    const text = this._labelWithId();
    return dailyPrice === null ? text : `${text}, ${this._formatRupiah(dailyPrice)} per hari`;
  }

  /**
   * Memformat rupiah, misalnya 25000 menjadi "Rp 25.000".
   *
   * @param {number} amount Jumlah rupiah.
   * @returns {string}
   * @protected
   */
  _formatRupiah(amount) {
    return `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`;
  }

  /**
   * Label tipe disertai ID bila ada, misalnya "Sepeda S001".
   *
   * @returns {string}
   * @protected
   */
  _labelWithId() {
    return this.#id ? `${this.typeLabel()} ${this.#id}` : this.typeLabel();
  }

  /**
   * Melengkapi angka dengan nol di depan.
   *
   * @param {number} value Angka.
   * @param {number} digits Panjang hasil.
   * @returns {string}
   * @private
   */
  #pad(value, digits) {
    return String(value).padStart(digits, '0');
  }
}
