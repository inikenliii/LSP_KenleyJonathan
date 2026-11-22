'use client';

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
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
  kwhToCharge,
  maxDailyDays as maxDailyDaysFor,
  parseIsoDate,
  type GarageTypeCode,
  type RentalCostBreakdown,
  type RentalTypeCode,
  type VehicleTypeCode,
} from '@/domain';
import { INITIAL_ACTION_STATE, type ActionState } from '@/lib/action-state';
import type { AvailableGarageOption } from '@/services';
import { submitWithoutReset } from './submit-form';

/** Kelas tampilan pilihan tipe agar serupa dengan kotak isian. */
const KELAS_PILIHAN =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30';

/** Pesan bila berkas bukti melebihi batas ukuran. */
const PESAN_UKURAN = 'Ukuran bukti pembayaran paling besar 2 MB';

/** Pola kapasitas dan sisa baterai: angka dengan paling banyak satu desimal. */
const POLA_BATERAI = /^\d{1,3}([.,]\d)?$/;

/**
 * Membaca isian kWh menjadi angka.
 *
 * @param teks Isian kapasitas atau sisa baterai.
 * @returns Angkanya, atau `null` bila belum sesuai pola (koma boleh sebagai desimal).
 */
function parseKwh(teks: string): number | null {
  const bersih = teks.trim();
  return POLA_BATERAI.test(bersih) ? Number(bersih.replace(',', '.')) : null;
}

/**
 * Menghitung kWh yang diisi dari isian kapasitas dan sisa baterai.
 *
 * @param batteryKwh Isian kapasitas baterai (teks).
 * @param remainingKwh Isian sisa baterai (teks).
 * @returns kWh yang diisi, atau `null` bila isian belum sah atau sisa melebihi kapasitas.
 */
function previewKwhToCharge(batteryKwh: string, remainingKwh: string): number | null {
  const kapasitas = parseKwh(batteryKwh);
  const sisa = parseKwh(remainingKwh);
  if (kapasitas === null || kapasitas <= 0 || sisa === null || sisa > kapasitas) {
    return null;
  }
  return kwhToCharge(kapasitas, sisa);
}

/**
 * Membaca isian tanggal mulai menjadi tanggal-saja. Tanggal di luar rentang
 * yang diizinkan dianggap belum sah (server tetap memeriksa ulang).
 *
 * @param startDate Isian tanggal mulai `YYYY-MM-DD`.
 * @param min Tanggal paling awal (hari ini), `YYYY-MM-DD`.
 * @param max Tanggal paling akhir (satu tahun dari hari ini), `YYYY-MM-DD`.
 * @returns Tanggalnya, atau `null` bila kosong, tidak sah, atau di luar rentang.
 */
function parseStartDate(startDate: string, min: string, max: string): Date | null {
  // Teks `YYYY-MM-DD` dapat dibandingkan langsung sebagai teks.
  if (startDate < min || startDate > max) {
    return null;
  }
  try {
    return parseIsoDate(startDate);
  } catch {
    return null;
  }
}

/**
 * Menghitung tanggal berakhir untuk pratinjau dengan fungsi domain yang sama
 * dengan server, dari tanggal mulai yang dipilih.
 *
 * @param start Tanggal mulai (sudah dibaca), atau `null` bila belum sah.
 * @param rentalType Tipe sewa.
 * @param days Isian jumlah hari (teks).
 * @returns Tanggal berakhir dalam Bahasa Indonesia, atau `null` bila isian belum sah.
 */
function previewEndDate(start: Date | null, rentalType: RentalTypeCode, days: string): string | null {
  if (start === null) {
    return null;
  }
  try {
    const jumlah = days.trim() === '' ? null : Number(days);
    return formatTanggal(computeEndDate(start, rentalType, jumlah));
  } catch {
    return null;
  }
}

/**
 * Menghitung pratinjau biaya dengan `calculateRentalCost` yang sama dengan
 * server. Nilai ini hanya tampilan; server menghitung ulang dari harga
 * database. Bulan tanggal mulai menentukan batas hari sewa harian, sehingga
 * jumlah hari yang melebihi batas itu tidak dipratinjau (server menolaknya).
 *
 * @param input Pilihan saat ini di formulir.
 * @param input.vehicleType Tipe kendaraan.
 * @param input.rentalType Tipe sewa.
 * @param input.days Isian jumlah hari (teks).
 * @param input.start Tanggal mulai yang dipilih, atau `null` bila belum sah.
 * @param input.batteryKwh Isian kapasitas baterai (teks).
 * @param input.remainingKwh Isian sisa baterai (teks).
 * @param input.garage Garasi yang dipilih, atau `undefined` bila belum ada.
 * @returns Rincian biaya, atau `null` bila isian belum lengkap atau belum sah.
 */
function previewCost(input: {
  vehicleType: VehicleTypeCode;
  rentalType: RentalTypeCode;
  days: string;
  start: Date | null;
  batteryKwh: string;
  remainingKwh: string;
  garage: AvailableGarageOption | undefined;
}): RentalCostBreakdown | null {
  const { garage, start } = input;
  if (garage === undefined || start === null) {
    return null;
  }
  if (input.rentalType === 'HARIAN' && Number(input.days) > maxDailyDaysFor(start)) {
    return null;
  }
  const chargesBattery = VehicleFactory.create(input.vehicleType).chargesBatteryIn(garage.type);
  const kapasitas = parseKwh(input.batteryKwh);
  const sisa = parseKwh(input.remainingKwh);
  const sisaSah = kapasitas !== null && sisa !== null && sisa <= kapasitas;
  try {
    return calculateRentalCost({
      rentalType: input.rentalType,
      days: input.days.trim() === '' ? null : Number(input.days),
      dailyPrice: garage.dailyPrice,
      chargesBattery,
      batteryKwh: kapasitas !== null && kapasitas > 0 ? kapasitas : null,
      remainingKwh: sisaSah ? sisa : null,
      pricePerKwh: garage.pricePerKwh,
    });
  } catch {
    // Isian belum lengkap: ringkasan biaya belum ditampilkan.
    return null;
  }
}

/**
 * Formulir sewa baru: data kendaraan, tipe sewa, tipe dan ID garasi, serta
 * unggahan bukti pembayaran. Tanggal mulai bisa dipilih mulai hari ini sampai
 * satu tahun ke depan (tidak bisa kemarin). Field yang tidak berlaku disembunyikan,
 * batas jumlah hari harian mengikuti bulan tanggal mulai, tanggal
 * berakhir dan biaya dipratinjau di browser dengan fungsi domain yang sama
 * dengan server, dan pesan error server tampil di bawah field masing-masing.
 *
 * Semua kontrol dikendalikan state (nilai awal dari `state.values` bila ada) dan formulir
 * dikirim lewat `onSubmit` agar React tidak mereset pilihan dan isian setelah server menolak;
 * ringkasan biaya selalu sesuai dengan isian yang terkirim. Hanya kotak berkas yang
 * dikosongkan setelah galat karena berkas tidak bisa dipulihkan.
 *
 * @param props.today Hari ini di Jakarta, `YYYY-MM-DD`: nilai awal dan batas paling awal tanggal mulai.
 * @param props.maxStartDate Tanggal mulai paling akhir (satu tahun dari hari ini), `YYYY-MM-DD`.
 * @param props.garages Garasi yang tersedia beserta harganya.
 * @returns Formulir dengan tombol "Simpan" dan kotak pesan hasil.
 */
export function RentalForm({
  today,
  maxStartDate,
  garages,
}: {
  today: string;
  maxStartDate: string;
  garages: ReadonlyArray<AvailableGarageOption>;
}) {
  const [state, formAction, pending] = useActionState(createRentalAction, INITIAL_ACTION_STATE);
  const galat = state.fieldErrors ?? {};

  const awal = state.values;
  const [vehicleType, setVehicleType] = useState<VehicleTypeCode>(
    VEHICLE_TYPE_CODES.find((kode) => kode === awal?.vehicleType) ?? 'SEPEDA',
  );
  const [rentalType, setRentalType] = useState<RentalTypeCode>(
    RENTAL_TYPE_CODES.find((kode) => kode === awal?.rentalType) ?? 'HARIAN',
  );
  const [days, setDays] = useState(awal?.days ?? '');
  const [startDate, setStartDate] = useState(awal?.startDate ?? today);
  const [garageType, setGarageType] = useState<GarageTypeCode>(
    () =>
      VehicleFactory.create(vehicleType)
        .allowedGarageTypes()
        .find((kode) => kode === awal?.garageType) ??
      VehicleFactory.create(vehicleType).allowedGarageTypes()[0],
  );
  const [garageId, setGarageId] = useState(awal?.garageId ?? '');
  const [plateNumber, setPlateNumber] = useState(awal?.plateNumber ?? '');
  const [vehicleBrand, setVehicleBrand] = useState(awal?.vehicleBrand ?? '');
  const [vehicleModel, setVehicleModel] = useState(awal?.vehicleModel ?? '');
  const [batteryKwh, setBatteryKwh] = useState(awal?.batteryKwh ?? '');
  const [remainingKwh, setRemainingKwh] = useState(awal?.remainingKwh ?? '');
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

  const vehicle = VehicleFactory.create(vehicleType);
  const garageOptions = garages.filter((garasi) => garasi.type === garageType);
  const selectedGarage = garageOptions.find((garasi) => garasi.id === garageId);
  const start = parseStartDate(startDate, today, maxStartDate);
  const maxDailyDays = start === null ? null : maxDailyDaysFor(start);
  const endDateLabel = previewEndDate(start, rentalType, days);
  const cost = previewCost({
    vehicleType,
    rentalType,
    days,
    start,
    batteryKwh,
    remainingKwh,
    garage: selectedGarage,
  });
  const showCharge = selectedGarage !== undefined && vehicle.chargesBatteryIn(selectedGarage.type);
  const kwhDiisi = previewKwhToCharge(batteryKwh, remainingKwh);

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
   * Membuka kalender bawaan peramban saat bagian mana pun dari kotak tanggal
   * diklik (bawaannya hanya ikon kalender yang membukanya). Peramban yang belum
   * mendukung `showPicker` tetap memakai perilaku bawaan.
   *
   * @param event Klik pada kotak tanggal mulai.
   */
  function handleStartDateClick(event: MouseEvent<HTMLInputElement>) {
    try {
      event.currentTarget.showPicker();
    } catch {
      // showPicker tidak tersedia atau ditolak: kotak tanggal tetap bisa diisi dengan papan ketik.
    }
  }

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
              value={plateNumber}
              onChange={(event) => setPlateNumber(event.target.value)}
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
            value={vehicleBrand}
            onChange={(event) => setVehicleBrand(event.target.value)}
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
            value={vehicleModel}
            onChange={(event) => setVehicleModel(event.target.value)}
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

        {vehicle.requiresBattery() && (
          <Field data-invalid={galat.remainingKwh?.[0] ? true : undefined}>
            <FieldLabel htmlFor="remainingKwh">Sisa Baterai (kWh)</FieldLabel>
            <Input
              id="remainingKwh"
              name="remainingKwh"
              inputMode="decimal"
              autoComplete="off"
              value={remainingKwh}
              onChange={(event) => setRemainingKwh(event.target.value)}
              aria-invalid={galat.remainingKwh?.[0] ? true : undefined}
            />
            {galat.remainingKwh?.[0] ? (
              <FieldError>{galat.remainingKwh[0]}</FieldError>
            ) : (
              <FieldDescription>
                Nol atau lebih, paling banyak satu desimal, tidak melebihi kapasitas.
              </FieldDescription>
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
              onWheel={(event) => event.currentTarget.blur()}
              min={1}
              max={maxDailyDays ?? undefined}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              aria-invalid={galat.days?.[0] ? true : undefined}
            />
            {galat.days?.[0] ? (
              <FieldError>{galat.days[0]}</FieldError>
            ) : (
              <FieldDescription>
                {maxDailyDays === null
                  ? 'Pilih tanggal mulai yang sah untuk melihat batas hari'
                  : `Maksimal ${maxDailyDays} hari untuk bulan tanggal mulai`}
              </FieldDescription>
            )}
          </Field>
        )}

        <Field data-invalid={galat.startDate?.[0] ? true : undefined}>
          <FieldLabel htmlFor="startDate">Tanggal Mulai</FieldLabel>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            min={today}
            max={maxStartDate}
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            onClick={handleStartDateClick}
            className="cursor-pointer"
            aria-invalid={galat.startDate?.[0] ? true : undefined}
          />
          {galat.startDate?.[0] ? (
            <FieldError>{galat.startDate[0]}</FieldError>
          ) : (
            <FieldDescription>
              Mulai hari ini sampai satu tahun ke depan; tidak bisa memilih tanggal yang sudah lewat.
            </FieldDescription>
          )}
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
              {showCharge && kwhDiisi !== null && (
                <div className="flex justify-between gap-4">
                  <dt>kWh yang diisi</dt>
                  <dd>{kwhDiisi} kWh</dd>
                </div>
              )}
              {showCharge && (
                <div className="flex justify-between gap-4">
                  <dt>Biaya isi listrik</dt>
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
            ref={berkasRef}
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            aria-invalid={pesanBerkas ? true : undefined}
          />
          {pesanBerkas && <FieldError>{pesanBerkas}</FieldError>}
          {(!pesanBerkas || perluPilihUlang) && (
            <FieldDescription>
              {perluPilihUlang
                ? 'Pilih ulang berkas bukti pembayaran; berkas tidak disimpan setelah ada kesalahan.'
                : 'JPEG, PNG, atau WebP, maksimal 2 MB. Pilih ulang berkas bila ada kesalahan.'}
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
