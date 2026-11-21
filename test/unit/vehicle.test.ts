/**
 * @file Tes unit hierarki kendaraan: kecocokan dengan tipe garasi, kewajiban
 * plat dan baterai, serta pabrik objek.
 */
import { describe, expect, it } from 'vitest';
import {
  Bicycle,
  Car,
  ElectricCar,
  GARAGE_TYPE_CODES,
  Motorcycle,
  VEHICLE_TYPE_CODES,
  ValidationError,
  Vehicle,
  VehicleFactory,
} from '@/domain';

describe('VehicleFactory.create', () => {
  it('SEPEDA menjadi Bicycle tanpa plat dan tanpa baterai', () => {
    const v = VehicleFactory.create('SEPEDA');
    expect(v).toBeInstanceOf(Bicycle);
    expect(v).toBeInstanceOf(Vehicle);
    expect(v.label).toBe('Sepeda');
    expect(v.allowedGarageTypes()).toEqual(['BICYCLE']);
    expect(v.requiresPlate()).toBe(false);
    expect(v.requiresBattery()).toBe(false);
  });

  it('SEPEDA_MOTOR menjadi Motorcycle yang wajib plat dan memakai garasi sepeda', () => {
    const v = VehicleFactory.create('SEPEDA_MOTOR');
    expect(v).toBeInstanceOf(Motorcycle);
    expect(v.label).toBe('Sepeda Motor');
    expect(v.allowedGarageTypes()).toEqual(['BICYCLE']);
    expect(v.requiresPlate()).toBe(true);
    expect(v.requiresBattery()).toBe(false);
  });

  it('MOBIL menjadi Car yang hanya cocok dengan garasi mobil', () => {
    const v = VehicleFactory.create('MOBIL');
    expect(v).toBeInstanceOf(Car);
    expect(v.label).toBe('Mobil');
    expect(v.allowedGarageTypes()).toEqual(['CAR']);
    expect(v.requiresPlate()).toBe(true);
  });

  it('MOBIL_LISTRIK menjadi ElectricCar yang wajib baterai dan boleh dua tipe garasi', () => {
    const v = VehicleFactory.create('MOBIL_LISTRIK');
    expect(v).toBeInstanceOf(ElectricCar);
    expect(v.label).toBe('Mobil Listrik');
    expect(v.allowedGarageTypes()).toEqual(['CAR', 'ELECTRIC_CAR']);
    expect(v.requiresBattery()).toBe(true);
    expect(v.requiresPlate()).toBe(true);
  });

  it('menolak kode tipe yang tidak dikenal dengan pesan di field vehicleType', () => {
    try {
      VehicleFactory.create('TRUK');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fieldErrors.vehicleType).toEqual([
        'Tipe kendaraan tidak valid',
      ]);
    }
  });

  it('isTypeCode mengenali empat kode yang sah saja', () => {
    expect(VehicleFactory.isTypeCode('MOBIL')).toBe(true);
    expect(VehicleFactory.isTypeCode('TRUK')).toBe(false);
    expect(VehicleFactory.isTypeCode(1)).toBe(false);
  });

  it('empat kode menghasilkan empat label berbeda secara polimorfik', () => {
    const labels = VEHICLE_TYPE_CODES.map((code) => VehicleFactory.create(code).label);
    expect(new Set(labels).size).toBe(4);
  });
});

describe('canParkIn dan chargesBatteryIn', () => {
  it('memeriksa kecocokan kendaraan dengan tipe garasi', () => {
    expect(new Bicycle().canParkIn('CAR')).toBe(false);
    expect(new Motorcycle().canParkIn('BICYCLE')).toBe(true);
    expect(new Car().canParkIn('ELECTRIC_CAR')).toBe(false);
    expect(new ElectricCar().canParkIn('CAR')).toBe(true);
    expect(new ElectricCar().canParkIn('ELECTRIC_CAR')).toBe(true);
    expect(new ElectricCar().canParkIn('BICYCLE')).toBe(false);
  });

  it('biaya pengisian hanya untuk mobil listrik di garasi mobil listrik', () => {
    expect(new ElectricCar().chargesBatteryIn('ELECTRIC_CAR')).toBe(true);
    expect(new ElectricCar().chargesBatteryIn('CAR')).toBe(false);
    expect(new Car().chargesBatteryIn('ELECTRIC_CAR')).toBe(false);
    expect(new Bicycle().chargesBatteryIn('ELECTRIC_CAR')).toBe(false);
  });
});

describe('matriks kecocokan kendaraan dan tipe garasi', () => {
  it('canParkIn: 4 tipe kendaraan x 3 tipe garasi sesuai aturan kecocokan', () => {
    const diharapkan = {
      SEPEDA: { BICYCLE: true, CAR: false, ELECTRIC_CAR: false },
      SEPEDA_MOTOR: { BICYCLE: true, CAR: false, ELECTRIC_CAR: false },
      MOBIL: { BICYCLE: false, CAR: true, ELECTRIC_CAR: false },
      MOBIL_LISTRIK: { BICYCLE: false, CAR: true, ELECTRIC_CAR: true },
    };
    const aktual = Object.fromEntries(
      VEHICLE_TYPE_CODES.map((kendaraan) => [
        kendaraan,
        Object.fromEntries(
          GARAGE_TYPE_CODES.map((garasi) => [
            garasi,
            VehicleFactory.create(kendaraan).canParkIn(garasi),
          ]),
        ),
      ]),
    );
    expect(aktual).toEqual(diharapkan);
  });

  it('chargesBatteryIn: hanya Mobil Listrik di garasi Mobil Listrik dari 12 kombinasi', () => {
    const diharapkan = {
      SEPEDA: { BICYCLE: false, CAR: false, ELECTRIC_CAR: false },
      SEPEDA_MOTOR: { BICYCLE: false, CAR: false, ELECTRIC_CAR: false },
      MOBIL: { BICYCLE: false, CAR: false, ELECTRIC_CAR: false },
      MOBIL_LISTRIK: { BICYCLE: false, CAR: false, ELECTRIC_CAR: true },
    };
    const aktual = Object.fromEntries(
      VEHICLE_TYPE_CODES.map((kendaraan) => [
        kendaraan,
        Object.fromEntries(
          GARAGE_TYPE_CODES.map((garasi) => [
            garasi,
            VehicleFactory.create(kendaraan).chargesBatteryIn(garasi),
          ]),
        ),
      ]),
    );
    expect(aktual).toEqual(diharapkan);
  });
});
