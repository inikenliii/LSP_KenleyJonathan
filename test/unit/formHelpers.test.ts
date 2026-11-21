/**
 * @file Tes unit pembantu formulir: pengiriman tanpa reset otomatis React dan
 * kalimat konfirmasi pilihan perpanjangan (perbaikan formulir yang menampilkan
 * pilihan berbeda dari yang terkirim setelah server menolak).
 */
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { describeExtensionChoice } from '@/components/forms/form-summaries';
import { submitWithoutReset } from '@/components/forms/submit-form';

describe('submitWithoutReset', () => {
  it('membatalkan pengiriman bawaan dan memanggil aksi dengan isi formulir terbaca', () => {
    const preventDefault = vi.fn();
    const form = { nama: 'formulir' } as unknown as HTMLFormElement;
    const event = { preventDefault, currentTarget: form } as unknown as FormEvent<HTMLFormElement>;
    const data = new FormData();
    data.set('extensionType', 'BULANAN');
    const aksi = vi.fn();
    const buatFormData = vi.fn(() => data);

    submitWithoutReset(event, aksi, buatFormData);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(buatFormData).toHaveBeenCalledWith(form);
    expect(aksi).toHaveBeenCalledTimes(1);
    expect(aksi).toHaveBeenCalledWith(data);
  });
});

describe('describeExtensionChoice', () => {
  it('menyebut jenis, jumlah, dan sisa biaya yang akan dikirim', () => {
    expect(describeExtensionChoice('BULANAN', '2', 500000)).toBe(
      'Akan disimpan: Bulanan, 2 bulan, sisa biaya Rp 500.000',
    );
    expect(describeExtensionChoice('HARIAN', ' 3 ', 30000)).toBe(
      'Akan disimpan: Harian, 3 hari, sisa biaya Rp 30.000',
    );
  });

  it('hanya menyebut jenis bila jumlah dan biaya belum terisi', () => {
    expect(describeExtensionChoice('HARIAN', '', null)).toBe('Akan disimpan: Harian');
    expect(describeExtensionChoice('BULANAN', '  ', null)).toBe('Akan disimpan: Bulanan');
  });
});
