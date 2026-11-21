/**
 * @file Tes unit aturan sewa: tanggal Jakarta, jumlah hari per bulan, tanggal
 * berakhir, status aktif, biaya sewa, dan deteksi tanda tangan berkas bukti bayar.
 */
import { describe, expect, it } from 'vitest';
import {
  PAYMENT_PROOF_MAX_BYTES,
  PROOF_CONTENT_TYPES,
  calculateRentalCost,
  computeEndDate,
  daysInMonth,
  detectProofImageType,
  formatTanggal,
  isRentalActive,
  kwhToCharge,
  maxDailyDays,
  parseIsoDate,
  todayInJakarta,
  toIsoDate,
} from '@/domain';

const iso = (text: string) => parseIsoDate(text);

describe('todayInJakarta', () => {
  it('memakai tanggal kalender Asia/Jakarta (UTC+7)', () => {
    expect(toIsoDate(todayInJakarta(new Date('2026-11-20T17:30:00Z')))).toBe('2026-11-21');
    expect(toIsoDate(todayInJakarta(new Date('2026-11-21T16:59:00Z')))).toBe('2026-11-21');
    expect(toIsoDate(todayInJakarta(new Date('2026-11-21T17:00:00Z')))).toBe('2026-11-22');
  });
});

describe('daysInMonth', () => {
  it('sadar tahun kabisat dan aturan abad', () => {
    expect(daysInMonth(iso('2027-02-10'))).toBe(28);
    expect(daysInMonth(iso('2028-02-10'))).toBe(29);
    expect(daysInMonth(iso('2100-02-01'))).toBe(28);
    expect(daysInMonth(iso('2000-02-01'))).toBe(29);
    expect(daysInMonth(iso('2026-11-21'))).toBe(30);
    expect(daysInMonth(iso('2026-01-05'))).toBe(31);
  });
});

describe('maxDailyDays', () => {
  it('jumlah hari bulan mulai dikurangi satu', () => {
    expect(maxDailyDays(iso('2026-11-21'))).toBe(29);
    expect(maxDailyDays(iso('2027-02-10'))).toBe(27);
    expect(maxDailyDays(iso('2028-02-10'))).toBe(28);
    expect(maxDailyDays(iso('2026-01-05'))).toBe(30);
  });
});

describe('computeEndDate HARIAN', () => {
  it('tanggal berakhir = mulai + jumlah hari', () => {
    expect(toIsoDate(computeEndDate(iso('2026-11-21'), 'HARIAN', 3))).toBe('2026-11-24');
    expect(toIsoDate(computeEndDate(iso('2026-11-21'), 'HARIAN', 29))).toBe('2026-12-20');
  });

  it('menolak hari di luar 1 sampai batas, pecahan, atau kosong', () => {
    const start = iso('2026-11-21');
    expect(() => computeEndDate(start, 'HARIAN', 30)).toThrow(RangeError);
    expect(() => computeEndDate(start, 'HARIAN', 0)).toThrow(RangeError);
    expect(() => computeEndDate(start, 'HARIAN', 1.5)).toThrow(RangeError);
    expect(() => computeEndDate(start, 'HARIAN')).toThrow(RangeError);
  });
});

describe('computeEndDate BULANAN (mulai + jumlah hari bulan mulai)', () => {
  const cases: Array<[string, string]> = [
    ['2026-11-21', '2026-12-21'], // November 30 hari
    ['2027-02-10', '2027-03-10'], // Februari 28 hari
    ['2028-02-10', '2028-03-10'], // Februari kabisat 29 hari
    ['2027-02-28', '2027-03-28'],
    ['2028-02-29', '2028-03-29'],
    ['2026-01-31', '2026-03-03'], // bulan 31 hari
    ['2026-03-31', '2026-05-01'],
    ['2026-12-15', '2027-01-15'],
  ];

  it.each(cases)('mulai %s berakhir %s', (start, end) => {
    expect(toIsoDate(computeEndDate(iso(start), 'BULANAN'))).toBe(end);
  });

  it('mengabaikan argumen days', () => {
    expect(toIsoDate(computeEndDate(iso('2026-11-21'), 'BULANAN', 5))).toBe('2026-12-21');
  });
});

describe('isRentalActive', () => {
  it('masih aktif pada tanggal berakhir, selesai sehari sesudahnya', () => {
    const today = iso('2026-11-21');
    expect(isRentalActive(iso('2026-11-21'), today)).toBe(true);
    expect(isRentalActive(iso('2026-11-20'), today)).toBe(false);
    expect(isRentalActive(iso('2026-11-22'), today)).toBe(true);
  });
});

describe('format tanggal', () => {
  it('formatTanggal memakai nama bulan Indonesia', () => {
    expect(formatTanggal(iso('2026-11-21'))).toBe('21 November 2026');
  });

  it('parseIsoDate hanya menerima YYYY-MM-DD', () => {
    expect(() => parseIsoDate('21-11-2026')).toThrow(RangeError);
    expect(() => parseIsoDate('2026-13-40')).toThrow(RangeError);
  });
});

describe('kwhToCharge', () => {
  it('kapasitas dikurangi sisa', () => {
    expect(kwhToCharge(60, 20)).toBe(40);
    expect(kwhToCharge(60, 0)).toBe(60);
  });

  it('sisa sama dengan kapasitas berarti tidak ada yang diisi', () => {
    expect(kwhToCharge(60, 60)).toBe(0);
  });

  it('tidak pernah negatif dan bebas galat pecahan', () => {
    expect(kwhToCharge(60, 70)).toBe(0);
    expect(kwhToCharge(60, 20.3)).toBe(39.7);
    expect(kwhToCharge(0.3, 0.1)).toBe(0.2);
  });
});

describe('calculateRentalCost', () => {
  it('harian = hari x harga harian tanpa biaya lain', () => {
    expect(
      calculateRentalCost({
        rentalType: 'HARIAN',
        days: 3,
        dailyPrice: 10000,
        chargesBattery: false,
        batteryKwh: null,
        remainingKwh: null,
        pricePerKwh: null,
      }),
    ).toEqual({ rentalCost: 30000, chargeCost: 0, totalCost: 30000 });
  });

  it('bulanan = 25 x harga harian', () => {
    expect(
      calculateRentalCost({
        rentalType: 'BULANAN',
        days: null,
        dailyPrice: 50000,
        chargesBattery: false,
        batteryKwh: null,
        remainingKwh: null,
        pricePerKwh: null,
      }).totalCost,
    ).toBe(1250000);
  });

  it('biaya pengisian = (kapasitas - sisa) x harga per kWh: 60, sisa 20, 2500 -> 40 kWh -> 100000', () => {
    expect(
      calculateRentalCost({
        rentalType: 'BULANAN',
        days: null,
        dailyPrice: 80000,
        chargesBattery: true,
        batteryKwh: 60,
        remainingKwh: 20,
        pricePerKwh: 2500,
      }),
    ).toEqual({ rentalCost: 2000000, chargeCost: 100000, totalCost: 2100000 });
  });

  it('sisa sama dengan kapasitas: biaya pengisian 0', () => {
    const hasil = calculateRentalCost({
      rentalType: 'BULANAN',
      days: null,
      dailyPrice: 80000,
      chargesBattery: true,
      batteryKwh: 60,
      remainingKwh: 60,
      pricePerKwh: 2500,
    });
    expect(hasil).toEqual({ rentalCost: 2000000, chargeCost: 0, totalCost: 2000000 });
  });

  it('sisa 0: diisi penuh sebesar kapasitas x harga per kWh', () => {
    const hasil = calculateRentalCost({
      rentalType: 'BULANAN',
      days: null,
      dailyPrice: 80000,
      chargesBattery: true,
      batteryKwh: 60,
      remainingKwh: 0,
      pricePerKwh: 2500,
    });
    expect(hasil.chargeCost).toBe(150000);
    expect(hasil.totalCost).toBe(2150000);
  });

  it('membulatkan biaya pengisian ke rupiah terdekat', () => {
    const base = {
      rentalType: 'HARIAN' as const,
      days: 1,
      dailyPrice: 1000,
      chargesBattery: true,
    };
    // 12,5 kWh x 2500 = 31250 (sudah bulat).
    expect(
      calculateRentalCost({ ...base, batteryKwh: 20, remainingKwh: 7.5, pricePerKwh: 2500 })
        .chargeCost,
    ).toBe(31250);
    // 33,3 kWh x 1234 = 41092,2 -> 41092.
    expect(
      calculateRentalCost({ ...base, batteryKwh: 40, remainingKwh: 6.7, pricePerKwh: 1234 })
        .chargeCost,
    ).toBe(41092);
    // 0,5 kWh x 2505 = 1252,5 -> 1253.
    expect(
      calculateRentalCost({ ...base, batteryKwh: 10, remainingKwh: 9.5, pricePerKwh: 2505 })
        .chargeCost,
    ).toBe(1253);
  });

  it('mengabaikan baterai dan harga kWh bila tidak diisi daya', () => {
    const hasil = calculateRentalCost({
      rentalType: 'HARIAN',
      days: 2,
      dailyPrice: 50000,
      chargesBattery: false,
      batteryKwh: 60,
      remainingKwh: 20,
      pricePerKwh: 2500,
    });
    expect(hasil).toEqual({ rentalCost: 100000, chargeCost: 0, totalCost: 100000 });
  });

  it('melempar RangeError bila data wajib kosong', () => {
    expect(() =>
      calculateRentalCost({
        rentalType: 'HARIAN',
        days: null,
        dailyPrice: 10000,
        chargesBattery: false,
        batteryKwh: null,
        remainingKwh: null,
        pricePerKwh: null,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateRentalCost({
        rentalType: 'BULANAN',
        days: null,
        dailyPrice: 10000,
        chargesBattery: true,
        batteryKwh: 60,
        remainingKwh: 20,
        pricePerKwh: null,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateRentalCost({
        rentalType: 'BULANAN',
        days: null,
        dailyPrice: 10000,
        chargesBattery: true,
        batteryKwh: null,
        remainingKwh: 20,
        pricePerKwh: 2500,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateRentalCost({
        rentalType: 'BULANAN',
        days: null,
        dailyPrice: 10000,
        chargesBattery: true,
        batteryKwh: 60,
        remainingKwh: null,
        pricePerKwh: 2500,
      }),
    ).toThrow(RangeError);
  });
});

describe('detectProofImageType', () => {
  it('mengenali JPEG, PNG, dan WebP dari tanda tangan byte', () => {
    expect(detectProofImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('jpg');
    expect(
      detectProofImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])),
    ).toBe('png');
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
    expect(detectProofImageType(webp)).toBe('webp');
  });

  it('menolak GIF, PDF, WAV, teks biasa, dan data kosong', () => {
    const enc = new TextEncoder();
    expect(detectProofImageType(enc.encode('GIF89a......'))).toBeNull();
    expect(detectProofImageType(enc.encode('%PDF-1.7 ....'))).toBeNull();
    expect(detectProofImageType(enc.encode('RIFF\0\0\0\0WAVEfmt '))).toBeNull();
    expect(detectProofImageType(enc.encode('halo, ini bukan gambar'))).toBeNull();
    expect(detectProofImageType(new Uint8Array())).toBeNull();
  });

  it('batas ukuran 2 MB dan tipe konten', () => {
    expect(PAYMENT_PROOF_MAX_BYTES).toBe(2097152);
    expect(PROOF_CONTENT_TYPES.png).toBe('image/png');
    expect(PROOF_CONTENT_TYPES.jpg).toBe('image/jpeg');
    expect(PROOF_CONTENT_TYPES.webp).toBe('image/webp');
  });
});
