'use client';

import { useActionState, useState, type ChangeEvent } from 'react';
import { extendRentalAction } from '@/app/admin/perpanjangan/actions';
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
import {
  ExtensionTooFarError,
  PAYMENT_PROOF_MAX_BYTES,
  calculateExtensionCost,
  formatRupiah,
  parseIsoDate,
  type ExtensionCostBreakdown,
} from '@/domain';
import { INITIAL_ACTION_STATE } from '@/lib/action-state';

/** Pesan bila berkas bukti melebihi batas ukuran. */
const PESAN_UKURAN = 'Ukuran bukti pembayaran paling besar 2 MB';

/**
 * Menghitung pratinjau tambahan hari dan sisa biaya dengan fungsi domain yang
 * sama dengan server. Nilai ini hanya tampilan; server menghitung ulang dari
 * sewa yang tersimpan.
 *
 * @param currentEndDate Tanggal selesai saat ini, `YYYY-MM-DD`.
 * @param newEndDate Isian tanggal selesai baru, `YYYY-MM-DD` atau kosong.
 * @param dailyPrice Salinan harga harian sewa.
 * @returns Rincian perpanjangan; `{ error }` berisi pesan bila tanggal terlalu jauh sehingga
 *   melewati batas database; atau `null` bila tanggal kosong, tidak sah, atau tidak setelah tanggal saat ini.
 */
function previewExtension(
  currentEndDate: string,
  newEndDate: string,
  dailyPrice: number,
): ExtensionCostBreakdown | { error: string } | null {
  if (newEndDate === '') {
    return null;
  }
  try {
    return calculateExtensionCost({
      currentEndDate: parseIsoDate(currentEndDate),
      newEndDate: parseIsoDate(newEndDate),
      dailyPrice,
    });
  } catch (error) {
    if (error instanceof ExtensionTooFarError) {
      return { error: error.message };
    }
    // Tanggal belum sah atau tidak setelah tanggal saat ini: jumlah tidak ditampilkan.
    return null;
  }
}

/**
 * Formulir perpanjangan satu sewa: tanggal selesai baru dengan pratinjau
 * tambahan hari dan sisa biaya, serta unggahan bukti pembayaran perpanjangan.
 * Pesan error server tampil di bawah field masing-masing.
 *
 * @param props.rentalId Id sewa yang diperpanjang (dikirim sebagai field tersembunyi).
 * @param props.currentEndDate Tanggal selesai saat ini, `YYYY-MM-DD`.
 * @param props.currentEndDateLabel Tanggal selesai saat ini dalam Bahasa Indonesia.
 * @param props.minNewEndDate Tanggal selesai baru paling awal, `YYYY-MM-DD`.
 * @param props.dailyPrice Salinan harga harian sewa, dasar sisa biaya.
 * @returns Formulir dengan tombol "Simpan Perpanjangan" dan kotak pesan hasil.
 */
export function ExtensionForm({
  rentalId,
  currentEndDate,
  currentEndDateLabel,
  minNewEndDate,
  dailyPrice,
}: {
  rentalId: number;
  currentEndDate: string;
  currentEndDateLabel: string;
  minNewEndDate: string;
  dailyPrice: number;
}) {
  const [state, formAction, pending] = useActionState(extendRentalAction, INITIAL_ACTION_STATE);
  const galat = state.fieldErrors ?? {};

  const [newEndDate, setNewEndDate] = useState(state.values?.newEndDate ?? '');
  const [fileError, setFileError] = useState<string | null>(null);

  const preview = previewExtension(currentEndDate, newEndDate, dailyPrice);

  /**
   * Menolak berkas bukti yang lebih besar dari batas sebelum dikirim.
   *
   * @param event Perubahan pada isian berkas.
   */
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const berkas = event.target.files?.[0];
    setFileError(berkas !== undefined && berkas.size > PAYMENT_PROOF_MAX_BYTES ? PESAN_UKURAN : null);
  }

  const pesanBerkas = fileError ?? galat.paymentProof?.[0];

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.message && (
        <Alert aria-live="polite" variant={state.ok ? 'default' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <input type="hidden" name="rentalId" value={rentalId} />

      <FieldGroup>
        <Field data-invalid={galat.rentalId?.[0] ? true : undefined}>
          <FieldLabel htmlFor="currentEndDate">Tanggal Selesai Saat Ini</FieldLabel>
          <Input id="currentEndDate" value={currentEndDateLabel} readOnly />
          {galat.rentalId?.[0] && <FieldError>{galat.rentalId[0]}</FieldError>}
        </Field>

        <Field data-invalid={galat.newEndDate?.[0] ? true : undefined}>
          <FieldLabel htmlFor="newEndDate">Tanggal Selesai Baru</FieldLabel>
          <Input
            id="newEndDate"
            name="newEndDate"
            type="date"
            min={minNewEndDate}
            value={newEndDate}
            onChange={(event) => setNewEndDate(event.target.value)}
            aria-invalid={galat.newEndDate?.[0] ? true : undefined}
          />
          {galat.newEndDate?.[0] ? (
            <FieldError>{galat.newEndDate[0]}</FieldError>
          ) : (
            <FieldDescription>
              Harus setelah {currentEndDateLabel}; tidak ada batas maksimal.
            </FieldDescription>
          )}
        </Field>

        <div
          className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3 text-sm"
          aria-live="polite"
        >
          <p className="font-medium">Ringkasan Perpanjangan</p>
          {preview === null ? (
            <p className="text-muted-foreground">
              Pilih tanggal selesai baru setelah {currentEndDateLabel} untuk melihat sisa biaya.
            </p>
          ) : 'error' in preview ? (
            <p className="text-destructive">{preview.error}</p>
          ) : (
            <dl className="flex flex-col gap-1">
              <div className="flex justify-between gap-4">
                <dt>Tambahan hari</dt>
                <dd>{preview.additionalDays} hari</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Harga harian (salinan saat sewa dibuat)</dt>
                <dd>{formatRupiah(dailyPrice)}</dd>
              </div>
              <div className="flex justify-between gap-4 font-semibold">
                <dt>Sisa biaya yang harus dibayar</dt>
                <dd>{formatRupiah(preview.amount)}</dd>
              </div>
            </dl>
          )}
          <p className="text-muted-foreground">Dihitung ulang server saat menyimpan.</p>
        </div>

        <Field data-invalid={pesanBerkas ? true : undefined}>
          <FieldLabel htmlFor="paymentProof">Bukti Pembayaran Perpanjangan</FieldLabel>
          <Input
            id="paymentProof"
            name="paymentProof"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            aria-invalid={pesanBerkas ? true : undefined}
          />
          {pesanBerkas ? (
            <FieldError>{pesanBerkas}</FieldError>
          ) : (
            <FieldDescription>
              JPEG, PNG, atau WebP, maksimal 2 MB. Pilih ulang berkas bila ada kesalahan.
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>

      <Button type="submit" size="lg" disabled={pending || fileError !== null}>
        {pending ? 'Menyimpan...' : 'Simpan Perpanjangan'}
      </Button>
    </form>
  );
}
