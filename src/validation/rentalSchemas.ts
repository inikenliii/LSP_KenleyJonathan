/**
 * @file Skema validasi (Zod) untuk sewa baru beserta pesan Bahasa Indonesia.
 *
 * Skema sengaja tidak memuat id penyewa, status, harga, atau tanggal berakhir:
 * nilai itu selalu dihitung server, dan kunci yang tidak dikenal dibuang.
 * Satu-satunya tanggal dari klien adalah tanggal mulai, yang diperiksa ulang
 * terhadap tanggal hari ini milik server.
 */
import { z } from 'zod';
import {
  GARAGE_TYPE_CODES,
  RENTAL_TYPE_CODES,
  VEHICLE_TYPE_CODES,
  VehicleFactory,
  latestStartDate,
  maxDailyDays,
  parseIsoDate,
  toIsoDate,
} from '@/domain';
import { paymentProofSchema } from './paymentProofSchema';
import { wholeNumber } from './wholeNumber';

/** Pesan untuk kapasitas baterai yang bukan angka positif dengan satu desimal. */
const PESAN_BATERAI = 'Kapasitas baterai berupa angka positif dengan paling banyak satu desimal';

/** Pesan untuk sisa baterai yang bukan angka nol atau lebih dengan satu desimal. */
const PESAN_SISA = 'Sisa baterai berupa angka nol atau lebih dengan paling banyak satu desimal';

/** Pesan untuk tanggal mulai yang bukan tanggal kalender `YYYY-MM-DD` yang sah. */
const PESAN_TANGGAL = 'Tanggal mulai harus tanggal yang sah';

/** Pesan untuk tanggal mulai yang sudah lewat. */
const PESAN_TANGGAL_LAMPAU = 'Tanggal mulai tidak boleh sebelum hari ini';

/** Pesan untuk tanggal mulai yang lebih dari satu tahun ke depan. */
const PESAN_TANGGAL_JAUH = 'Tanggal mulai paling jauh satu tahun dari hari ini';

/**
 * Membuat skema tanggal mulai: teks `YYYY-MM-DD` yang sah, tidak sebelum
 * `today`, dan tidak lebih dari satu tahun setelah `today`. Hasilnya `Date`
 * tanggal-saja (UTC tengah malam).
 *
 * @param today Tanggal hari ini menurut server (tanggal-saja).
 * @returns Skema Zod tanggal mulai.
 */
function startDateSchema(today: Date) {
  const terjauh = latestStartDate(today);
  return z
    .string({ error: PESAN_TANGGAL })
    .transform((teks, ctx) => {
      let tanggal: Date;
      try {
        tanggal = parseIsoDate(teks);
      } catch {
        ctx.issues.push({ code: 'custom', message: PESAN_TANGGAL, input: teks });
        return z.NEVER;
      }
      if (tanggal.getTime() < today.getTime()) {
        ctx.issues.push({ code: 'custom', message: PESAN_TANGGAL_LAMPAU, input: teks });
        return z.NEVER;
      }
      if (tanggal.getTime() > terjauh.getTime()) {
        ctx.issues.push({ code: 'custom', message: PESAN_TANGGAL_JAUH, input: teks });
        return z.NEVER;
      }
      return tanggal;
    });
}

/**
 * Merapikan isian formulir sebelum divalidasi: teks dipangkas, isian kosong
 * dianggap tidak diisi, plat dijadikan huruf besar tanpa spasi ganda, koma
 * desimal kapasitas dan sisa baterai diganti titik, isian yang tidak
 * berlaku untuk tipe kendaraan atau tipe sewa dibuang, dan tanggal mulai
 * yang kosong atau tidak dikirim diisi dengan hari ini.
 *
 * @param body Isi formulir mentah.
 * @param today Tanggal hari ini menurut server (tanggal-saja).
 * @returns Isian yang sudah dirapikan.
 */
function normalizeRentalInput(body: unknown, today: Date): unknown {
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
  if (typeof input.remainingKwh === 'string') {
    input.remainingKwh = input.remainingKwh.replace(',', '.');
  }
  if (input.vehicleType === 'SEPEDA') {
    input.plateNumber = undefined;
  }
  if (input.vehicleType !== 'MOBIL_LISTRIK') {
    input.batteryKwh = undefined;
    input.remainingKwh = undefined;
  }
  if (input.rentalType !== 'HARIAN') {
    input.days = undefined;
  }
  if (input.startDate === undefined) {
    input.startDate = toIsoDate(today);
  }
  return input;
}

/**
 * Membuat skema sewa baru.
 *
 * Tanggal mulai boleh hari ini sampai satu tahun ke depan (tidak boleh
 * kemarin). Batas jumlah hari sewa harian mengikuti bulan tanggal mulai
 * (hari dalam bulan itu dikurangi satu), bukan bulan hari ini.
 *
 * @param today Tanggal hari ini menurut server (tanggal-saja, lihat `todayInJakarta`);
 *   dipakai sebagai batas bawah tanggal mulai dan nilai bawaan bila tidak diisi.
 * @returns Skema Zod untuk isian sewa baru.
 */
export function createRentalSchema(today: Date) {
  return z.preprocess(
    (body) => normalizeRentalInput(body, today),
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
          .regex(/^\d{1,4}(\.\d)?$/, { error: PESAN_BATERAI })
          .transform(Number)
          .refine((nilai) => nilai > 0, { error: PESAN_BATERAI })
          .optional(),
        remainingKwh: z
          .string({ error: PESAN_SISA })
          .regex(/^\d{1,4}(\.\d)?$/, { error: PESAN_SISA })
          .transform(Number)
          .optional(),
        rentalType: z.enum(RENTAL_TYPE_CODES, { error: 'Pilih tipe sewa' }),
        days: wholeNumber('Jumlah hari wajib diisi angka', 'Jumlah hari harus bilangan bulat')
          .pipe(z.number().min(1, { error: 'Jumlah hari paling sedikit 1' }))
          .optional(),
        startDate: startDateSchema(today),
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
      .refine(
        (data) =>
          data.remainingKwh !== undefined ||
          !VehicleFactory.create(data.vehicleType).requiresBattery(),
        {
          path: ['remainingKwh'],
          error: 'Sisa baterai wajib diisi untuk mobil listrik',
        },
      )
      .refine(
        (data) =>
          data.remainingKwh === undefined ||
          data.batteryKwh === undefined ||
          data.remainingKwh <= data.batteryKwh,
        {
          path: ['remainingKwh'],
          error: 'Sisa baterai tidak boleh melebihi kapasitas baterai',
        },
      )
      .refine((data) => data.rentalType !== 'HARIAN' || data.days !== undefined, {
        path: ['days'],
        error: 'Jumlah hari wajib diisi untuk sewa harian',
      })
      .superRefine((data, ctx) => {
        // Tanggal mulai yang gagal diparse sudah punya pesan sendiri; lewati pemeriksaan hari.
        if (!(data.startDate instanceof Date)) {
          return;
        }
        const batas = maxDailyDays(data.startDate);
        if (data.days !== undefined && data.days > batas) {
          ctx.addIssue({
            code: 'custom',
            path: ['days'],
            message: `Jumlah hari maksimal ${batas} untuk bulan mulai sewa`,
          });
        }
      })
      .refine((data) => VehicleFactory.create(data.vehicleType).canParkIn(data.garageType), {
        path: ['garageType'],
        error: 'Tipe garasi tidak sesuai dengan tipe kendaraan',
      }),
  );
}

/** Data sewa baru yang sudah lolos validasi. */
export type RentalInput = z.output<ReturnType<typeof createRentalSchema>>;
