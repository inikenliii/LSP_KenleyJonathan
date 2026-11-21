/**
 * @file Tes unit perencana ID garasi: urutan per tipe dan batas 999.
 */
import { describe, expect, it } from 'vitest';
import { CapacityExceededError, GarageIdGenerator, Mobil, Sepeda } from '@/domain';

const generator = new GarageIdGenerator();

describe('GarageIdGenerator.planBatch', () => {
  it('melanjutkan dari nomor terakhir', () => {
    const rencana = generator.planBatch(new Sepeda(), 4, 2);
    expect(rencana.ids).toEqual(['S005', 'S006']);
    expect(rencana.firstNumber).toBe(5);
    expect(rencana.lastNumber).toBe(6);
  });

  it('mulai dari 001 bila belum ada garasi', () => {
    expect(generator.planBatch(new Mobil(), 0, 3).ids).toEqual(['C001', 'C002', 'C003']);
  });

  it('boleh sampai tepat 999', () => {
    const rencana = generator.planBatch(new Mobil(), 990, 9);
    expect(rencana.ids[0]).toBe('C991');
    expect(rencana.ids.at(-1)).toBe('C999');
    expect(rencana.lastNumber).toBe(999);
  });

  it('menolak batch yang melewati 999 dengan sisa kuota', () => {
    expect(() => generator.planBatch(new Mobil(), 990, 10)).toThrow(CapacityExceededError);
    expect(() => generator.planBatch(new Mobil(), 990, 10)).toThrow(/sisa kuota 9/);
  });

  it('menolak jumlah atau nomor terakhir yang tidak valid', () => {
    expect(() => generator.planBatch(new Sepeda(), 0, 0)).toThrow(RangeError);
    expect(() => generator.planBatch(new Sepeda(), -1, 1)).toThrow(RangeError);
  });
});

describe('GarageIdGenerator.remainingQuota', () => {
  it('menghitung sisa kuota dari 999', () => {
    expect(generator.remainingQuota(990)).toBe(9);
    expect(generator.remainingQuota(0)).toBe(999);
  });
});
