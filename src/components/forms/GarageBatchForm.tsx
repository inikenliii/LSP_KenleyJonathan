'use client';

import { useActionState, useState } from 'react';
import { createGarageBatchAction } from '@/app/admin/garasi/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { GarageTypeCode } from '@/domain';
import { INITIAL_ACTION_STATE } from '@/lib/action-state';
import { submitWithoutReset } from './submit-form';

/** Kelas tampilan pilihan tipe agar serupa dengan kotak isian. */
const KELAS_PILIHAN =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30';

/**
 * Formulir pembuatan garasi berkelompok: tipe, jumlah, harga harian, dan
 * harga per kWh (wajib hanya untuk Mobil Listrik). Pesan error tampil di
 * bawah field yang bermasalah dan isian lama dipertahankan: semua kontrol dikendalikan state
 * dan formulir dikirim lewat `onSubmit` agar React tidak mereset pilihan tipe setelah server
 * menolak. Setelah berhasil, isian dikosongkan dan tipe kembali ke pilihan pertama.
 *
 * @param props.typeOptions Pilihan tipe garasi (kode dan nama tampilan).
 * @returns Formulir dengan tombol "Buat Garasi" dan kotak pesan hasil.
 */
export function GarageBatchForm({
  typeOptions,
}: {
  typeOptions: ReadonlyArray<{ value: GarageTypeCode; label: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    createGarageBatchAction,
    INITIAL_ACTION_STATE,
  );
  const galat = state.fieldErrors ?? {};

  const tipeAwal = typeOptions[0]?.value ?? '';
  const [type, setType] = useState(state.values?.type ?? tipeAwal);
  const [quantity, setQuantity] = useState(state.values?.quantity ?? '');
  const [dailyPrice, setDailyPrice] = useState(state.values?.dailyPrice ?? '');
  const [pricePerKwh, setPricePerKwh] = useState(state.values?.pricePerKwh ?? '');

  // Setelah hasil baru berupa berhasil, kosongkan isian (penyesuaian state saat render).
  const [hasilDitangani, setHasilDitangani] = useState(state);
  if (hasilDitangani !== state) {
    setHasilDitangani(state);
    if (state.ok) {
      setType(tipeAwal);
      setQuantity('');
      setDailyPrice('');
      setPricePerKwh('');
    }
  }

  return (
    <form
      onSubmit={(event) => submitWithoutReset(event, formAction)}
      className="flex flex-col gap-5"
      noValidate
    >
      {state.message && (
        <Alert aria-live="polite" variant={state.ok ? 'default' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <Field data-invalid={galat.type?.[0] ? true : undefined}>
          <FieldLabel htmlFor="type">Tipe Garasi</FieldLabel>
          <select
            id="type"
            name="type"
            className={KELAS_PILIHAN}
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-invalid={galat.type?.[0] ? true : undefined}
          >
            {typeOptions.map((opsi) => (
              <option key={opsi.value} value={opsi.value}>
                {opsi.label}
              </option>
            ))}
          </select>
          {galat.type?.[0] && <FieldError>{galat.type[0]}</FieldError>}
        </Field>

        <Field data-invalid={galat.quantity?.[0] ? true : undefined}>
          <FieldLabel htmlFor="quantity">Jumlah Garasi</FieldLabel>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={999}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            aria-invalid={galat.quantity?.[0] ? true : undefined}
          />
          {galat.quantity?.[0] ? (
            <FieldError>{galat.quantity[0]}</FieldError>
          ) : (
            <FieldDescription>Antara 1 dan 999 per tipe.</FieldDescription>
          )}
        </Field>

        <Field data-invalid={galat.dailyPrice?.[0] ? true : undefined}>
          <FieldLabel htmlFor="dailyPrice">Harga Harian (Rp)</FieldLabel>
          <Input
            id="dailyPrice"
            name="dailyPrice"
            type="number"
            min={1}
            value={dailyPrice}
            onChange={(event) => setDailyPrice(event.target.value)}
            aria-invalid={galat.dailyPrice?.[0] ? true : undefined}
          />
          {galat.dailyPrice?.[0] ? (
            <FieldError>{galat.dailyPrice[0]}</FieldError>
          ) : (
            <FieldDescription>Harga harian berlaku untuk semua garasi bertipe sama.</FieldDescription>
          )}
        </Field>

        <Field data-invalid={galat.pricePerKwh?.[0] ? true : undefined}>
          <FieldLabel htmlFor="pricePerKwh">Harga per kWh (Rp)</FieldLabel>
          <Input
            id="pricePerKwh"
            name="pricePerKwh"
            type="number"
            min={1}
            value={pricePerKwh}
            onChange={(event) => setPricePerKwh(event.target.value)}
            aria-invalid={galat.pricePerKwh?.[0] ? true : undefined}
          />
          {galat.pricePerKwh?.[0] ? (
            <FieldError>{galat.pricePerKwh[0]}</FieldError>
          ) : (
            <FieldDescription>Wajib untuk Mobil Listrik, diabaikan untuk tipe lain.</FieldDescription>
          )}
        </Field>
      </FieldGroup>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Memproses...' : 'Buat Garasi'}
      </Button>
    </form>
  );
}
