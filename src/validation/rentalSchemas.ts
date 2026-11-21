/**
 * @file Skema validasi (Zod) untuk sewa baru beserta pesan Bahasa Indonesia.
 *
 * Skema sengaja tidak memuat id penyewa, status, harga, atau tanggal: nilai
 * itu selalu dihitung server, dan kunci yang tidak dikenal dibuang.
 */
import { z } from 'zod';
import { GARAGE_TYPE_CODES, RENTAL_TYPE_CODES, VEHICLE_TYPE_CODES, VehicleFactory } from '@/domain';
import { paymentProofSchema } from './paymentProofSchema';

/** Pesan untuk kapasitas baterai yang bukan angka positif dengan satu desimal. */
const PESAN_BATERAI = 'Kapasitas baterai berupa angka positif dengan paling banyak satu desimal';

/**
 * Merapikan isian formulir sebelum divalidasi: teks dipangkas, isian kosong
 * dianggap tidak diisi, plat dijadikan huruf besar tanpa spasi ganda, koma
 * desimal baterai diganti titik, dan isian yang tidak berlaku untuk tipe
 * kendaraan atau tipe sewa dibuang.
 *
 * @param body Isi formulir mentah.
 * @returns Isian yang sudah dirapikan.
 */
function normalizeRentalInput(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) {
    return {};
  }
  const input: Record<string, unknown> = { ...body };
  for (const [kunci, nilai] of Object.entries(input)) {
    if (kunci === 'paymentProof') {
      continue;
    }
    if (typeof nilai === 'number') {
      input[kunci] = String(nilai);
    } else if (typeof nilai === 'string') {
      input[kunci] = nilai.trim() === '' ? undefined : nilai.trim();
    }
  }
  if (typeof input.plateNumber === 'string') {
    input.plateNumber = input.plateNumber.toUpperCase().replace(/\s+/g, ' ');
  }
  if (typeof input.batteryKwh === 'string') {
    input.batteryKwh = input.batteryKwh.replace(',', '.');
  }
  if (input.vehicleType === 'SEPEDA') {
    input.plateNumber = undefined;
  }
  if (input.vehicleType !== 'MOBIL_LISTRIK') {
    input.batteryKwh = undefined;
  }
  if (input.rentalType !== 'HARIAN') {
    input.days = undefined;
  }
  return input;
}

/**
 * Membuat skema sewa baru.
 *
 * @param maxDays Batas jumlah hari sewa harian untuk bulan ini (hari dalam bulan dikurangi satu).
 * @returns Skema Zod untuk isian sewa baru.
 */
export function createRentalSchema(maxDays: number) {
  const pesanHari = `Jumlah hari maksimal ${maxDays} untuk bulan ini`;
  return z.preprocess(
    normalizeRentalInput,
    z
      .object({
        vehicleType: z.enum(VEHICLE_TYPE_CODES, { error: 'Pilih tipe kendaraan' }),
        vehicleBrand: z
          .string({ error: 'Merek kendaraan wajib diisi' })
          .max(50, { error: 'Merek kendaraan paling banyak 50 karakter' }),
        vehicleModel: z
          .string({ error: 'Tipe/model kendaraan wajib diisi' })
          .max(50, { error: 'Tipe/model kendaraan paling banyak 50 karakter' }),
        plateNumber: z
          .string()
          .max(12, { error: 'Nomor plat paling banyak 12 karakter' })
          .regex(/^[A-Z0-9 ]+$/, { error: 'Nomor plat hanya boleh huruf dan angka' })
          .optional(),
        batteryKwh: z
          .string({ error: PESAN_BATERAI })
          .regex(/^\d{1,3}(\.\d)?$/, { error: PESAN_BATERAI })
          .transform(Number)
          .refine((nilai) => nilai > 0, { error: PESAN_BATERAI })
          .optional(),
        rentalType: z.enum(RENTAL_TYPE_CODES, { error: 'Pilih tipe sewa' }),
        days: z.coerce
          .number({ error: 'Jumlah hari wajib diisi angka' })
          .int({ error: 'Jumlah hari harus bilangan bulat' })
          .min(1, { error: 'Jumlah hari paling sedikit 1' })
          .max(maxDays, { error: pesanHari })
          .optional(),
        garageType: z.enum(GARAGE_TYPE_CODES, { error: 'Pilih tipe garasi' }),
        garageId: z
          .string({ error: 'Pilih garasi yang tersedia' })
          .regex(/^[SCE]\d{3}$/, { error: 'Pilih garasi yang tersedia' }),
        paymentProof: paymentProofSchema,
      })
      .refine(
        (data) =>
          data.plateNumber !== undefined || !VehicleFactory.create(data.vehicleType).requiresPlate(),
        {
          path: ['plateNumber'],
          error: 'Nomor plat wajib diisi',
        },
      )
      .refine(
        (data) =>
          data.batteryKwh !== undefined ||
          !VehicleFactory.create(data.vehicleType).requiresBattery(),
        {
          path: ['batteryKwh'],
          error: 'Kapasitas baterai wajib diisi untuk mobil listrik',
        },
      )
      .refine((data) => data.rentalType !== 'HARIAN' || data.days !== undefined, {
        path: ['days'],
        error: 'Jumlah hari wajib diisi untuk sewa harian',
      })
      .refine((data) => VehicleFactory.create(data.vehicleType).canParkIn(data.garageType), {
        path: ['garageType'],
        error: 'Tipe garasi tidak sesuai dengan tipe kendaraan',
      }),
  );
}

/** Data sewa baru yang sudah lolos validasi. */
export type RentalInput = z.output<ReturnType<typeof createRentalSchema>>;
