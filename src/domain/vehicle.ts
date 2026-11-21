/**
 * @file Hierarki kendaraan penyewa. Setiap tipe kendaraan adalah subkelas dari
 * `Vehicle` yang menjawab secara polimorfik tipe garasi mana yang cocok dan
 * data apa yang wajib diisi (plat nomor, kapasitas baterai).
 *
 * Modul ini murni: hanya mengimpor berkas domain lain.
 */
import { ValidationError } from './errors';
import type { GarageTypeCode } from './garage';

/** Kode tipe kendaraan seperti yang disimpan di database. */
export type VehicleTypeCode = 'SEPEDA' | 'SEPEDA_MOTOR' | 'MOBIL' | 'MOBIL_LISTRIK';

/** Semua kode tipe kendaraan dalam urutan tampilan. */
export const VEHICLE_TYPE_CODES = ['SEPEDA', 'SEPEDA_MOTOR', 'MOBIL', 'MOBIL_LISTRIK'] as const;

/**
 * Kendaraan abstrak. Kelas ini tidak dapat dibuat langsung; gunakan
 * subkelasnya atau `VehicleFactory.create`.
 */
export abstract class Vehicle {
  /** Kode tipe seperti yang disimpan di database. Wajib diisi subkelas. */
  public abstract get type(): VehicleTypeCode;

  /** Nama tipe untuk ditampilkan. Wajib diisi subkelas. */
  public abstract get label(): string;

  /**
   * Tipe garasi yang boleh dipakai kendaraan ini. Wajib diisi subkelas.
   *
   * @returns Daftar kode tipe garasi yang cocok.
   */
  public abstract allowedGarageTypes(): readonly GarageTypeCode[];

  /**
   * Apakah kendaraan ini wajib memiliki nomor plat. Bawaannya wajib; Sepeda
   * menimpanya.
   *
   * @returns `true` bila nomor plat wajib diisi.
   */
  public requiresPlate(): boolean {
    return true;
  }

  /**
   * Apakah kendaraan ini wajib menyebutkan kapasitas baterai. Bawaannya tidak;
   * Mobil Listrik menimpanya.
   *
   * @returns `true` bila kapasitas baterai (kWh) wajib diisi.
   */
  public requiresBattery(): boolean {
    return false;
  }

  /**
   * Memeriksa apakah kendaraan ini boleh disimpan di garasi bertipe tertentu.
   *
   * @param garageType Kode tipe garasi.
   * @returns `true` bila tipe garasi termasuk `allowedGarageTypes()`.
   */
  public canParkIn(garageType: GarageTypeCode): boolean {
    return this.allowedGarageTypes().includes(garageType);
  }

  /**
   * Apakah penyewaan di garasi bertipe ini dikenai biaya pengisian baterai
   * penuh. Hanya kendaraan berbaterai di garasi Mobil Listrik yang dikenai.
   *
   * @param garageType Kode tipe garasi yang disewa.
   * @returns `true` bila biaya pengisian harus ditambahkan.
   */
  public chargesBatteryIn(garageType: GarageTypeCode): boolean {
    return this.requiresBattery() && garageType === 'ELECTRIC_CAR';
  }
}

/** Sepeda biasa: tanpa plat, hanya garasi sepeda. */
export class Bicycle extends Vehicle {
  /** @inheritdoc */
  public override get type(): VehicleTypeCode {
    return 'SEPEDA';
  }

  /** @inheritdoc */
  public override get label(): string {
    return 'Sepeda';
  }

  /**
   * @returns Hanya garasi sepeda.
   */
  public override allowedGarageTypes(): readonly GarageTypeCode[] {
    return ['BICYCLE'];
  }

  /**
   * @returns Selalu `false`: sepeda tidak memiliki plat.
   */
  public override requiresPlate(): boolean {
    return false;
  }
}

/** Sepeda motor: wajib plat, memakai garasi sepeda. */
export class Motorcycle extends Vehicle {
  /** @inheritdoc */
  public override get type(): VehicleTypeCode {
    return 'SEPEDA_MOTOR';
  }

  /** @inheritdoc */
  public override get label(): string {
    return 'Sepeda Motor';
  }

  /**
   * @returns Hanya garasi sepeda.
   */
  public override allowedGarageTypes(): readonly GarageTypeCode[] {
    return ['BICYCLE'];
  }
}

/** Mobil bermesin: wajib plat, hanya garasi mobil. */
export class Car extends Vehicle {
  /** @inheritdoc */
  public override get type(): VehicleTypeCode {
    return 'MOBIL';
  }

  /** @inheritdoc */
  public override get label(): string {
    return 'Mobil';
  }

  /**
   * @returns Hanya garasi mobil.
   */
  public override allowedGarageTypes(): readonly GarageTypeCode[] {
    return ['CAR'];
  }
}

/** Mobil listrik: wajib plat dan kapasitas baterai, boleh garasi mobil atau mobil listrik. */
export class ElectricCar extends Vehicle {
  /** @inheritdoc */
  public override get type(): VehicleTypeCode {
    return 'MOBIL_LISTRIK';
  }

  /** @inheritdoc */
  public override get label(): string {
    return 'Mobil Listrik';
  }

  /**
   * @returns Garasi mobil dan garasi mobil listrik.
   */
  public override allowedGarageTypes(): readonly GarageTypeCode[] {
    return ['CAR', 'ELECTRIC_CAR'];
  }

  /**
   * @returns Selalu `true`: kapasitas baterai wajib diisi.
   */
  public override requiresBattery(): boolean {
    return true;
  }
}

/** Membuat objek kendaraan yang sesuai dengan kode tipenya. */
export class VehicleFactory {
  /** Pemetaan kode tipe ke kelas turunannya. */
  private static readonly CLASSES: Readonly<Record<VehicleTypeCode, new () => Vehicle>> = {
    SEPEDA: Bicycle,
    SEPEDA_MOTOR: Motorcycle,
    MOBIL: Car,
    MOBIL_LISTRIK: ElectricCar,
  };

  /**
   * Memeriksa apakah nilai adalah kode tipe kendaraan yang sah.
   *
   * @param value Nilai yang diperiksa.
   * @returns `true` bila nilai adalah salah satu `VEHICLE_TYPE_CODES`.
   */
  public static isTypeCode(value: unknown): value is VehicleTypeCode {
    return typeof value === 'string' && (VEHICLE_TYPE_CODES as readonly string[]).includes(value);
  }

  /**
   * Membuat objek kendaraan untuk satu tipe.
   *
   * @param type Kode tipe kendaraan.
   * @returns Instans Bicycle, Motorcycle, Car, atau ElectricCar.
   * @throws {ValidationError} Bila kode tipe tidak dikenal.
   */
  public static create(type: string): Vehicle {
    if (!VehicleFactory.isTypeCode(type)) {
      throw new ValidationError({ vehicleType: ['Tipe kendaraan tidak valid'] });
    }
    return new VehicleFactory.CLASSES[type]();
  }
}
