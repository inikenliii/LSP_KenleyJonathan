'use client';

import { useActionState, useState, type ChangeEvent } from 'react';
import { createRentalAction } from '@/app/penyewa/sewa/actions';
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
  GarageFactory,
  PAYMENT_PROOF_MAX_BYTES,
  RENTAL_TYPE_CODES,
  RENTAL_TYPE_LABELS,
  VEHICLE_TYPE_CODES,
  VehicleFactory,
  calculateRentalCost,
  computeEndDate,
  formatRupiah,
  formatTanggal,
  parseIsoDate,
  type GarageTypeCode,
  type RentalCostBreakdown,
  type RentalTypeCode,
  type VehicleTypeCode,
} from '@/domain';
import { INITIAL_ACTION_STATE } from '@/lib/action-state';
import type { AvailableGarageOption } from '@/services';

/** Kelas tampilan pilihan tipe agar serupa dengan kotak isian. */
const KELAS_PILIHAN =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30';

/** Pesan bila berkas bukti melebihi batas ukuran. */
const PESAN_UKURAN = 'Ukuran bukti pembayaran paling besar 2 MB';

/** Pola kapasitas baterai: angka positif dengan paling banyak satu desimal. */
const POLA_BATERAI = /^\d{1,3}([.,]\d)?$/;

/**
 * Menghitung tanggal berakhir untuk pratinjau dengan fungsi domain yang sama
 * dengan server.
 *
 * @param today Tanggal mulai `YYYY-MM-DD`.
 * @param rentalType Tipe sewa.
 * @param days Isian jumlah hari (teks).
 * @returns Tanggal berakhir dalam Bahasa Indonesia, atau `null` bila isian belum sah.
 */
function previewEndDate(today: string, rentalType: RentalTypeCode, days: string): string | null {
  try {
    const jumlah = days.trim() === '' ? null : Number(days);
    return formatTanggal(computeEndDate(parseIsoDate(today), rentalType, jumlah));
  } catch {
    return null;
  }
}

/**
 * Menghitung pratinjau biaya dengan `calculateRentalCost` yang sama dengan
 * server. Nilai ini hanya tampilan; server menghitung ulang dari harga
 * database.
 *
 * @param input Pilihan saat ini di formulir.
 * @param input.vehicleType Tipe kendaraan.
 * @param input.rentalType Tipe sewa.
 * @param input.days Isian jumlah hari (teks).
 * @param input.batteryKwh Isian kapasitas baterai (teks).
 * @param input.garage Garasi yang dipilih, atau `undefined` bila belum ada.
 * @returns Rincian biaya, atau `null` bila isian belum lengkap atau belum sah.
 */
function previewCost(input: {
  vehicleType: VehicleTypeCode;
  rentalType: RentalTypeCode;
  days: string;
  batteryKwh: string;
  garage: AvailableGarageOption | undefined;
}): RentalCostBreakdown | null {
  const { garage } = input;
  if (garage === undefined) {
    return null;
  }
  const chargesBattery = VehicleFactory.create(input.vehicleType).chargesBatteryIn(garage.type);
  const baterai = POLA_BATERAI.test(input.batteryKwh.trim())
    ? Number(input.batteryKwh.trim().replace(',', '.'))
    : null;
  try {
    return calculateRentalCost({
      rentalType: input.rentalType,
      days: input.days.trim() === '' ? null : Number(input.days),
      dailyPrice: garage.dailyPrice,
      chargesBattery,
      batteryKwh: baterai !== null && baterai > 0 ? baterai : null,
      pricePerKwh: garage.pricePerKwh,
    });
  } catch {
    // Isian belum lengkap: ringkasan biaya belum ditampilkan.
    return null;
  }
}

/**
 * Formulir sewa baru: data kendaraan, tipe sewa, tipe dan ID garasi, serta
 * unggahan bukti pembayaran. Field yang tidak berlaku disembunyikan, tanggal
 * berakhir dan biaya dipratinjau di browser dengan fungsi domain yang sama
 * dengan server, dan pesan error server tampil di bawah field masing-masing.
 *
 * @param props.today Tanggal mulai (hari ini di Jakarta), `YYYY-MM-DD`.
 * @param props.todayLabel Tanggal mulai dalam Bahasa Indonesia.
 * @param props.maxDailyDays Batas jumlah hari sewa harian bulan ini.
 * @param props.garages Garasi yang tersedia beserta harganya.
 * @returns Formulir dengan tombol "Simpan" dan kotak pesan hasil.
 */
export function RentalForm({
  today,
  todayLabel,
  maxDailyDays,
  garages,
}: {
  today: string;
  todayLabel: string;
  maxDailyDays: number;
  garages: ReadonlyArray<AvailableGarageOption>;
}) {
  const [state, formAction, pending] = useActionState(createRentalAction, INITIAL_ACTION_STATE);
  const galat = state.fieldErrors ?? {};

  const [vehicleType, setVehicleType] = useState<VehicleTypeCode>('SEPEDA');
  const [rentalType, setRentalType] = useState<RentalTypeCode>('HARIAN');
  const [days, setDays] = useState('');
  const [garageType, setGarageType] = useState<GarageTypeCode>(
    () => VehicleFactory.create('SEPEDA').allowedGarageTypes()[0],
  );
  const [garageId, setGarageId] = useState('');
  const [batteryKwh, setBatteryKwh] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);

  const vehicle = VehicleFactory.create(vehicleType);
  const garageOptions = garages.filter((garasi) => garasi.type === garageType);
  const selectedGarage = garageOptions.find((garasi) => garasi.id === garageId);
  const endDateLabel = previewEndDate(today, rentalType, days);
  const cost = previewCost({ vehicleType, rentalType, days, batteryKwh, garage: selectedGarage });
  const showCharge = selectedGarage !== undefined && vehicle.chargesBatteryIn(selectedGarage.type);

  /**
   * Mengganti tipe kendaraan: tipe garasi dikembalikan ke pilihan pertama yang
   * cocok dan garasi yang dipilih dikosongkan.
   *
   * @param event Perubahan pada pilihan tipe kendaraan.
   */
  function handleVehicleChange(event: ChangeEvent<HTMLSelectElement>) {
    const baru = event.target.value as VehicleTypeCode;
    setVehicleType(baru);
    setGarageType(VehicleFactory.create(baru).allowedGarageTypes()[0]);
    setGarageId('');
  }

  /**
   * Mengganti tipe garasi dan mengosongkan garasi yang dipilih.
   *
   * @param event Perubahan pada pilihan tipe garasi.
   */
  function handleGarageTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    setGarageType(event.target.value as GarageTypeCode);
    setGarageId('');
  }

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

      <FieldGroup>
        <Field data-invalid={galat.vehicleType?.[0] ? true : undefined}>
          <FieldLabel htmlFor="vehicleType">Tipe Kendaraan</FieldLabel>
          <select
            id="vehicleType"
            name="vehicleType"
            className={KELAS_PILIHAN}
            value={vehicleType}
            onChange={handleVehicleChange}
            aria-invalid={galat.vehicleType?.[0] ? true : undefined}
          >
            {VEHICLE_TYPE_CODES.map((kode) => (
              <option key={kode} value={kode}>
                {VehicleFactory.create(kode).label}
              </option>
            ))}
          </select>
          {galat.vehicleType?.[0] && <FieldError>{galat.vehicleType[0]}</FieldError>}
        </Field>

        {vehicle.requiresPlate() && (
          <Field data-invalid={galat.plateNumber?.[0] ? true : undefined}>
            <FieldLabel htmlFor="plateNumber">Nomor Plat</FieldLabel>
            <Input
              id="plateNumber"
              name="plateNumber"
              autoComplete="off"
              defaultValue={state.values?.plateNumber}
              aria-invalid={galat.plateNumber?.[0] ? true : undefined}
            />
            {galat.plateNumber?.[0] && <FieldError>{galat.plateNumber[0]}</FieldError>}
          </Field>
        )}

        <Field data-invalid={galat.vehicleBrand?.[0] ? true : undefined}>
          <FieldLabel htmlFor="vehicleBrand">Merek</FieldLabel>
          <Input
            id="vehicleBrand"
            name="vehicleBrand"
            autoComplete="off"
            defaultValue={state.values?.vehicleBrand}
            aria-invalid={galat.vehicleBrand?.[0] ? true : undefined}
          />
          {galat.vehicleBrand?.[0] && <FieldError>{galat.vehicleBrand[0]}</FieldError>}
        </Field>

        <Field data-invalid={galat.vehicleModel?.[0] ? true : undefined}>
          <FieldLabel htmlFor="vehicleModel">Tipe/Model</FieldLabel>
          <Input
            id="vehicleModel"
            name="vehicleModel"
            autoComplete="off"
            defaultValue={state.values?.vehicleModel}
            aria-invalid={galat.vehicleModel?.[0] ? true : undefined}
          />
          {galat.vehicleModel?.[0] && <FieldError>{galat.vehicleModel[0]}</FieldError>}
        </Field>

        {vehicle.requiresBattery() && (
          <Field data-invalid={galat.batteryKwh?.[0] ? true : undefined}>
            <FieldLabel htmlFor="batteryKwh">Kapasitas Baterai (kWh)</FieldLabel>
            <Input
              id="batteryKwh"
              name="batteryKwh"
              inputMode="decimal"
              autoComplete="off"
              value={batteryKwh}
              onChange={(event) => setBatteryKwh(event.target.value)}
              aria-invalid={galat.batteryKwh?.[0] ? true : undefined}
            />
            {galat.batteryKwh?.[0] ? (
              <FieldError>{galat.batteryKwh[0]}</FieldError>
            ) : (
              <FieldDescription>Angka positif, paling banyak satu desimal.</FieldDescription>
            )}
          </Field>
        )}

        <Field data-invalid={galat.rentalType?.[0] ? true : undefined}>
          <FieldLabel htmlFor="rentalType">Tipe Sewa</FieldLabel>
          <select
            id="rentalType"
            name="rentalType"
            className={KELAS_PILIHAN}
            value={rentalType}
            onChange={(event) => setRentalType(event.target.value as RentalTypeCode)}
            aria-invalid={galat.rentalType?.[0] ? true : undefined}
          >
            {RENTAL_TYPE_CODES.map((kode) => (
              <option key={kode} value={kode}>
                {RENTAL_TYPE_LABELS[kode]}
              </option>
            ))}
          </select>
          {galat.rentalType?.[0] && <FieldError>{galat.rentalType[0]}</FieldError>}
        </Field>

        {rentalType === 'HARIAN' && (
          <Field data-invalid={galat.days?.[0] ? true : undefined}>
            <FieldLabel htmlFor="days">Jumlah Hari</FieldLabel>
            <Input
              id="days"
              name="days"
              type="number"
              min={1}
              max={maxDailyDays}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              aria-invalid={galat.days?.[0] ? true : undefined}
            />
            {galat.days?.[0] ? (
              <FieldError>{galat.days[0]}</FieldError>
            ) : (
              <FieldDescription>Maksimal {maxDailyDays} hari untuk bulan ini</FieldDescription>
            )}
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="startDate">Tanggal Mulai</FieldLabel>
          <Input id="startDate" value={todayLabel} readOnly />
        </Field>

        <Field>
          <FieldLabel htmlFor="endDate">Tanggal Selesai</FieldLabel>
          <Input id="endDate" value={endDateLabel ?? '-'} readOnly />
          <FieldDescription>Dihitung otomatis; server menghitung ulang saat menyimpan.</FieldDescription>
        </Field>

        <Field data-invalid={galat.garageType?.[0] ? true : undefined}>
          <FieldLabel htmlFor="garageType">Tipe Garasi</FieldLabel>
          <select
            id="garageType"
            name="garageType"
            className={KELAS_PILIHAN}
            value={garageType}
            onChange={handleGarageTypeChange}
            aria-invalid={galat.garageType?.[0] ? true : undefined}
          >
            {vehicle.allowedGarageTypes().map((kode) => (
              <option key={kode} value={kode}>
                {GarageFactory.create(kode).label}
              </option>
            ))}
          </select>
          {galat.garageType?.[0] && <FieldError>{galat.garageType[0]}</FieldError>}
        </Field>

        <Field data-invalid={galat.garageId?.[0] ? true : undefined}>
          <FieldLabel htmlFor="garageId">Garasi Tersedia</FieldLabel>
          {garageOptions.length === 0 ? (
            <FieldDescription>Belum ada garasi tersedia untuk tipe ini.</FieldDescription>
          ) : (
            <select
              id="garageId"
              name="garageId"
              className={KELAS_PILIHAN}
              value={garageId}
              onChange={(event) => setGarageId(event.target.value)}
              aria-invalid={galat.garageId?.[0] ? true : undefined}
            >
              <option value="">Pilih garasi</option>
              {garageOptions.map((garasi) => (
                <option key={garasi.id} value={garasi.id}>
                  {garasi.id} - {formatRupiah(garasi.dailyPrice)} per hari
                </option>
              ))}
            </select>
          )}
          {galat.garageId?.[0] && <FieldError>{galat.garageId[0]}</FieldError>}
        </Field>

        <div
          className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3 text-sm"
          aria-live="polite"
        >
          <p className="font-medium">Ringkasan Biaya</p>
          {cost === null ? (
            <p className="text-muted-foreground">Lengkapi data untuk melihat total biaya.</p>
          ) : (
            <dl className="flex flex-col gap-1">
              <div className="flex justify-between gap-4">
                <dt>Biaya sewa</dt>
                <dd>{formatRupiah(cost.rentalCost)}</dd>
              </div>
              {showCharge && (
                <div className="flex justify-between gap-4">
                  <dt>Biaya isi listrik penuh</dt>
                  <dd>{formatRupiah(cost.chargeCost)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 font-semibold">
                <dt>Total</dt>
                <dd>{formatRupiah(cost.totalCost)}</dd>
              </div>
            </dl>
          )}
        </div>

        <Field data-invalid={pesanBerkas ? true : undefined}>
          <FieldLabel htmlFor="paymentProof">Bukti Pembayaran</FieldLabel>
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
        {pending ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}
