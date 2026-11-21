/**
 * @file Tes unit aturan harga: harga bulanan 25 x harian dan format rupiah.
 */
import { describe, expect, it } from 'vitest';
import { MONTHLY_PRICE_MULTIPLIER, formatRupiah, monthlyPrice } from '@/domain';

describe('monthlyPrice', () => {
  it('pengali bulanan adalah 25', () => {
    expect(MONTHLY_PRICE_MULTIPLIER).toBe(25);
  });

  it('menghitung 25 x harga harian', () => {
    expect(monthlyPrice(10000)).toBe(250000);
    expect(monthlyPrice(0)).toBe(0);
  });

  it('menolak harga negatif atau bukan bilangan bulat', () => {
    expect(() => monthlyPrice(-1)).toThrow(RangeError);
    expect(() => monthlyPrice(1.5)).toThrow(RangeError);
  });
});

describe('formatRupiah', () => {
  it('memakai pemisah ribuan titik', () => {
    expect(formatRupiah(10000)).toBe('Rp 10.000');
    expect(formatRupiah(250000)).toBe('Rp 250.000');
  });
});
