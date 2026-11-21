'use client';

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from 'react';
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
  ExtensionQuantityError,
  ExtensionTooFarError,
  PAYMENT_PROOF_MAX_BYTES,
  RENTAL_TYPE_CODES,
  RENTAL_TYPE_LABELS,
  calculateExtensionCost,
  formatRupiah,
  formatTanggal,
  parseIsoDate,
  type ExtensionCostBreakdown,
  type RentalTypeCode,
} from '@/domain';
import { INITIAL_ACTION_STATE, type ActionState } from '@/lib/action-state';
import { describeExtensionChoice } from './form-summaries';
import { submitWithoutReset } from './submit-form';

/** Kelas tampilan pilihan jenis agar serupa dengan kotak isian. */
const KELAS_PILIHAN =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30';

/** Pesan bila berkas bukti melebihi batas ukuran. */
const PESAN_UKURAN = 'Ukuran bukti pembayaran paling besar 2 MB';

/**
 * Menghitung pratinjau tanggal selesai baru, tambahan hari, dan sisa biaya dengan
 * fungsi domain yang sama dengan server. Nilai ini hanya tampilan; server menghitung
 * ulang dari sewa yang tersimpan.
 *
 * @param extensionType Jenis perpanjangan yang dipilih.
 * @param quantity Isian jumlah hari atau bulan, atau kosong.
 * @param currentEndDate Tanggal selesai saat ini, `YYYY-MM-DD`.
 * @param dailyPrice Salinan harga harian sewa.
 * @returns Rincian perpanjangan; `{ error }` berisi pesan bila jumlah di luar batas atau hasilnya
 *   terlalu jauh; atau `null` bila jumlah masih kosong atau bukan bilangan bulat.
 */
function previewExtension(
  extensionType: RentalTypeCode,
  quantity: string,
  currentEndDate: string,
  dailyPrice: number,
): ExtensionCostBreakdown | { error: string } | null {
  if (!/^\d{1,7}$/.test(quantity.trim())) {
    return null;
  }
  try {
    return calculateExtensionCost({
      extensionType,
      quantity: Number(quantity),
      currentEndDate: parseIsoDate(currentEndDate),
      dailyPrice,
    });
  } catch (error) {
    if (error instanceof ExtensionQuantityError || error instanceof ExtensionTooFarError) {
      return { error: error.message };
    }
    throw error;
  }
}

/**
 * Formulir perpanjangan satu sewa: jenis (harian atau bulanan) dan jumlah hari atau
 * bulan dengan pratinjau tanggal selesai baru, tambahan hari, dan sisa biaya, serta
 * unggahan bukti pembayaran perpanjangan. Pesan error server tampil di bawah field masing-masing.
 *
 * Semua kontrol dikendalikan state dan formulir dikirim lewat `onSubmit` (bukan atribut
 * `action`) agar React tidak mereset kontrol setelah server menolak: yang tampil di layar
 * selalu sama dengan yang terkirim. Hanya kotak berkas yang dikosongkan setelah galat
 * karena berkas tidak bisa dipulihkan; pengguna diminta memilihnya lagi.
 *
 * @param props.rentalId Id sewa yang diperpanjang (dikirim sebagai field tersembunyi).
 * @param props.currentEndDate Tanggal selesai saat ini, `YYYY-MM-DD`.
 * @param props.currentEndDateLabel Tanggal selesai saat ini dalam Bahasa Indonesia.
 * @param props.maxExtensionDays Jumlah hari terbanyak untuk perpanjangan harian.
 * @param props.dailyPrice Salinan harga harian sewa, dasar sisa biaya.
 * @returns Formulir dengan tombol "Simpan Perpanjangan" dan kotak pesan hasil.
 */
export function ExtensionForm({
  rentalId,
  currentEndDate,
  currentEndDateLabel,
  maxExtensionDays,
  dailyPrice,
}: {
  rentalId: number;
  currentEndDate: string;
  currentEndDateLabel: string;
  maxExtensionDays: number;
  dailyPrice: number;
}) {
  const [state, formAction, pending] = useActionState(extendRentalAction, INITIAL_ACTION_STATE);
  const galat = state.fieldErrors ?? {};

  const [extensionType, setExtensionType] = useState<RentalTypeCode>(
    RENTAL_TYPE_CODES.find((kode) => kode === state.values?.extensionType) ?? 'HARIAN',
  );
  const [quantity, setQuantity] = useState(state.values?.quantity ?? '');
  const [fileError, setFileError] = useState<string | null>(null);
  const berkasRef = useRef<HTMLInputElement>(null);
  // Hasil aksi terakhir tempat pengguna sudah memilih ulang berkas (untuk menyembunyikan petunjuk).
  const [dipilihUlangUntuk, setDipilihUlangUntuk] = useState<ActionState | null>(null);

  // Setelah galat server, berkas lama dikosongkan (tidak bisa dipulihkan); isian lain tetap.
  useEffect(() => {
    if (state.message && !state.ok && berkasRef.current) {
      berkasRef.current.value = '';
    }
  }, [state]);

  const preview = previewExtension(extensionType, quantity, currentEndDate, dailyPrice);
  const satuan = extensionType === 'BULANAN' ? 'bulan' : 'hari';

  /**
   * Menolak berkas bukti yang lebih besar dari batas sebelum dikirim.
   *
   * @param event Perubahan pada isian berkas.
   */
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const berkas = event.target.files?.[0];
    setFileError(berkas !== undefined && berkas.size > PAYMENT_PROOF_MAX_BYTES ? PESAN_UKURAN : null);
    setDipilihUlangUntuk(state);
  }

  const pesanBerkas = fileError ?? galat.paymentProof?.[0];
  const perluPilihUlang = !state.ok && Boolean(state.message) && dipilihUlangUntuk !== state;
  const jumlahBiaya = preview !== null && !('error' in preview) ? preview.amount : null;

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

      <input type="hidden" name="rentalId" value={rentalId} />

      <FieldGroup>
        <Field data-invalid={galat.rentalId?.[0] ? true : undefined}>
          <FieldLabel htmlFor="currentEndDate">Tanggal Selesai Saat Ini</FieldLabel>
          <Input id="currentEndDate" value={currentEndDateLabel} readOnly />
          {galat.rentalId?.[0] && <FieldError>{galat.rentalId[0]}</FieldError>}
        </Field>

        <Field data-invalid={galat.extensionType?.[0] ? true : undefined}>
          <FieldLabel htmlFor="extensionType">Jenis Perpanjangan</FieldLabel>
          <select
            id="extensionType"
            name="extensionType"
            className={KELAS_PILIHAN}
            value={extensionType}
            onChange={(event) => setExtensionType(event.target.value as RentalTypeCode)}
            aria-invalid={galat.extensionType?.[0] ? true : undefined}
          >
            {RENTAL_TYPE_CODES.map((kode) => (
              <option key={kode} value={kode}>
                {RENTAL_TYPE_LABELS[kode]}
              </option>
            ))}
          </select>
          {galat.extensionType?.[0] && <FieldError>{galat.extensionType[0]}</FieldError>}
        </Field>

        <Field data-invalid={galat.quantity?.[0] ? true : undefined}>
          <FieldLabel htmlFor="quantity">
            {extensionType === 'BULANAN' ? 'Jumlah Bulan' : 'Jumlah Hari'}
          </FieldLabel>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            aria-invalid={galat.quantity?.[0] ? true : undefined}
          />
          {galat.quantity?.[0] ? (
            <FieldError>{galat.quantity[0]}</FieldError>
          ) : (
            <FieldDescription>
              {extensionType === 'BULANAN'
                ? 'Bilangan bulat 1 sampai 1200 bulan; tiap bulan menambah jumlah hari pada bulan tempat langkahnya dimulai.'
                : `Maksimal ${maxExtensionDays} hari (jumlah hari pada bulan tanggal selesai saat ini dikurangi satu).`}
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
              Isi jumlah {satuan} untuk melihat tanggal selesai baru dan sisa biaya.
            </p>
          ) : 'error' in preview ? (
            <p className="text-destructive">{preview.error}</p>
          ) : (
            <dl className="flex flex-col gap-1">
              <div className="flex justify-between gap-4">
                <dt>Tanggal selesai baru</dt>
                <dd>{formatTanggal(preview.newEndDate)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Tambahan hari</dt>
                <dd>{preview.additionalDays} hari</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Harga harian (salinan saat sewa dibuat)</dt>
                <dd>{formatRupiah(dailyPrice)}</dd>
              </div>
              <div className="flex justify-between gap-4 font-semibold">
                <dt>Sisa biaya</dt>
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
            ref={berkasRef}
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            aria-invalid={pesanBerkas ? true : undefined}
          />
          {pesanBerkas ? (
            <FieldError>{pesanBerkas}</FieldError>
          ) : (
            <FieldDescription>
              {perluPilihUlang
                ? 'Pilih ulang berkas bukti pembayaran; berkas tidak disimpan setelah ada kesalahan.'
                : 'JPEG, PNG, atau WebP, maksimal 2 MB. Pilih ulang berkas bila ada kesalahan.'}
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={pending || fileError !== null}>
          {pending ? 'Menyimpan...' : 'Simpan Perpanjangan'}
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {describeExtensionChoice(extensionType, quantity, jumlahBiaya)}
        </p>
      </div>
    </form>
  );
}
