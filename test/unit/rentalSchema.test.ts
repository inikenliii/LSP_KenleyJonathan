/**
 * @file Tes unit skema validasi sewa baru, khusus kapasitas dan sisa baterai
 * mobil listrik.
 */
import { describe, expect, it } from 'vitest';
import { createRentalSchema } from '@/validation/rentalSchemas';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

/**
 * Membuat isian mobil listrik yang sah, lalu menimpa sebagian isian.
 *
 * @param override Isian yang menggantikan isian dasar.
 * @returns Isian formulir mentah.
 */
function isianListrik(override: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    vehicleType: 'MOBIL_LISTRIK',
    vehicleBrand: 'Hyundai',
    vehicleModel: 'Ioniq 5',
    plateNumber: 'B 9 XYZ',
    batteryKwh: '60',
    remainingKwh: '20',
    rentalType: 'BULANAN',
    garageType: 'ELECTRIC_CAR',
    garageId: 'E001',
    paymentProof: PNG,
    ...override,
  };
}

const schema = createRentalSchema(30);

/**
 * Mengambil pesan error pertama suatu field dari hasil validasi.
 *
 * @param input Isian formulir mentah.
 * @param field Nama field.
 * @returns Pesan error, atau `undefined` bila field tidak bermasalah.
 */
function pesan(input: Record<string, unknown>, field: string): string | undefined {
  const hasil = schema.safeParse(input);
  return hasil.success
    ? undefined
    : hasil.error.issues.find((isu) => isu.path[0] === field)?.message;
}

describe('createRentalSchema: sisa baterai mobil listrik', () => {
  it('menerima sisa 0, sisa sama dengan kapasitas, dan koma desimal', () => {
    for (const sisa of ['0', '60', '12,5']) {
      expect(schema.safeParse(isianListrik({ remainingKwh: sisa })).success).toBe(true);
    }
    const hasil = schema.parse(isianListrik({ remainingKwh: '12,5' }));
    expect(hasil.remainingKwh).toBe(12.5);
  });

  it('wajib diisi untuk mobil listrik', () => {
    expect(pesan(isianListrik({ remainingKwh: undefined }), 'remainingKwh')).toBe(
      'Sisa baterai wajib diisi untuk mobil listrik',
    );
    expect(pesan(isianListrik({ remainingKwh: '  ' }), 'remainingKwh')).toBe(
      'Sisa baterai wajib diisi untuk mobil listrik',
    );
  });

  it('tidak boleh melebihi kapasitas', () => {
    expect(pesan(isianListrik({ remainingKwh: '60,1' }), 'remainingKwh')).toBe(
      'Sisa baterai tidak boleh melebihi kapasitas baterai',
    );
    expect(pesan(isianListrik({ batteryKwh: '17,3', remainingKwh: '20' }), 'remainingKwh')).toBe(
      'Sisa baterai tidak boleh melebihi kapasitas baterai',
    );
  });

  it('menolak negatif, bukan angka, dan lebih dari satu desimal', () => {
    for (const sisa of ['-1', 'abc', '5,55', '1e2', '5 kWh']) {
      expect(pesan(isianListrik({ remainingKwh: sisa }), 'remainingKwh')).toBeDefined();
    }
  });

  it('dibuang untuk tipe kendaraan selain mobil listrik', () => {
    const hasil = schema.parse({
      vehicleType: 'MOBIL',
      vehicleBrand: 'Toyota',
      vehicleModel: 'Avanza',
      plateNumber: 'B 1 A',
      batteryKwh: '60',
      remainingKwh: 'abc',
      rentalType: 'BULANAN',
      garageType: 'CAR',
      garageId: 'C001',
      paymentProof: PNG,
    });
    expect(hasil.remainingKwh).toBeUndefined();
    expect(hasil.batteryKwh).toBeUndefined();
  });
});
