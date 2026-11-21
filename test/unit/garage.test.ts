/**
 * @file Tes unit hierarki Garage: pewarisan, polimorfisme, overload describe, dan pabrik.
 */
import { describe, expect, it } from 'vitest';
import {
  GARAGE_TYPE_CODES,
  Garage,
  GarageFactory,
  Mobil,
  MobilListrik,
  Sepeda,
  ValidationError,
} from '@/domain';

describe('Garage dan subkelasnya', () => {
  it('membentuk ID dengan awalan dan tiga digit', () => {
    expect(new Sepeda().formatId(1)).toBe('S001');
    expect(new Mobil().formatId(10)).toBe('C010');
    expect(new MobilListrik().formatId(999)).toBe('E999');
  });

  it('menolak nomor urut di luar 1 sampai 999', () => {
    expect(() => new Sepeda().formatId(0)).toThrow(RangeError);
    expect(() => new Sepeda().formatId(1000)).toThrow(RangeError);
    expect(() => new Sepeda().formatId(1.5)).toThrow(RangeError);
  });

  it('setiap subkelas menjawab tipe, label, dan awalan', () => {
    expect([new Sepeda().type, new Sepeda().label, new Sepeda().idPrefix]).toEqual([
      'BICYCLE',
      'Sepeda',
      'S',
    ]);
    expect([new Mobil().type, new Mobil().label, new Mobil().idPrefix]).toEqual([
      'CAR',
      'Mobil',
      'C',
    ]);
    expect([new MobilListrik().type, new MobilListrik().label, new MobilListrik().idPrefix]).toEqual(
      ['ELECTRIC_CAR', 'Mobil Listrik', 'E'],
    );
  });

  it('hanya Mobil Listrik memakai harga per kWh', () => {
    expect(new Sepeda().usesKwhPrice()).toBe(false);
    expect(new Mobil().usesKwhPrice()).toBe(false);
    expect(new MobilListrik().usesKwhPrice()).toBe(true);
  });

  it('garasi baru tersedia; status USED berlabel "used"', () => {
    expect(new Sepeda().status).toBe('AVAILABLE');
    expect(new Sepeda().statusLabel).toBe('tersedia');
    expect(new Sepeda('S001', 'USED').statusLabel).toBe('used');
  });

  it('describe memiliki tiga bentuk pemanggilan', () => {
    expect(new Sepeda('S001').describe()).toBe('Sepeda S001');
    expect(new Sepeda('S001').describe(10000)).toBe('Sepeda S001, Rp 10.000 per hari');
    expect(new MobilListrik('E001').describe(50000, 2500)).toBe(
      'Mobil Listrik E001, Rp 50.000 per hari, Rp 2.500 per kWh',
    );
  });

  it('tipe non-listrik mengabaikan harga per kWh', () => {
    expect(new Mobil('C001').describe(50000, 2500)).toBe('Mobil C001, Rp 50.000 per hari');
  });
});

describe('GarageFactory', () => {
  it('membuat subkelas sesuai kode tipe', () => {
    const garasi = GarageFactory.create('BICYCLE');
    expect(garasi).toBeInstanceOf(Sepeda);
    expect(garasi).toBeInstanceOf(Garage);
  });

  it('menolak tipe yang tidak dikenal', () => {
    try {
      GarageFactory.create('TRUCK');
      expect.unreachable('seharusnya melempar ValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fieldErrors.type).toEqual(['Tipe garasi tidak valid']);
    }
  });

  it('polimorfisme: awalan ID tiap tipe tanpa instanceof', () => {
    const awalan = GARAGE_TYPE_CODES.map((kode) => GarageFactory.create(kode).formatId(1));
    expect(awalan).toEqual(['S001', 'C001', 'E001']);
  });

  it('mengenali kode tipe yang sah', () => {
    expect(GarageFactory.isTypeCode('CAR')).toBe(true);
    expect(GarageFactory.isTypeCode('TRUCK')).toBe(false);
  });
});
