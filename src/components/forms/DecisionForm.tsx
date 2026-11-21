'use client';

import { useActionState } from 'react';
import { decideRegistrantAction } from '@/app/admin/pendaftar/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { INITIAL_ACTION_STATE } from '@/lib/action-state';

/**
 * Pilihan keputusan untuk satu pendaftar: Terima (dengan kotak "KTP sudah
 * divalidasi") dan Tolak. Kedua formulir memakai satu hasil aksi sehingga
 * pesan kesalahan tampil di bawah baris yang bersangkutan.
 *
 * @param props.userId Id pendaftar.
 * @param props.fullName Nama pendaftar, dipakai pada label tombol.
 * @returns Dua formulir kecil dan tempat pesan kesalahan.
 */
export function DecisionForm({ userId, fullName }: { userId: number; fullName: string }) {
  const [state, formAction, pending] = useActionState(
    decideRegistrantAction,
    INITIAL_ACTION_STATE,
  );
  const pesan = state.fieldErrors?.ktpValidated?.[0] ?? state.message;
  const idKtp = `ktp-${userId}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="decision" value="ACCEPT" />
          <label htmlFor={idKtp} className="flex items-center gap-2 text-sm">
            <Checkbox id={idKtp} name="ktpValidated" value="on" disabled={pending} />
            KTP sudah divalidasi
          </label>
          <Button type="submit" size="sm" disabled={pending} aria-label={`Terima ${fullName}`}>
            Terima
          </Button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="decision" value="REJECT" />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={pending}
            aria-label={`Tolak ${fullName}`}
          >
            Tolak
          </Button>
        </form>
      </div>
      {pesan && (
        <p role="alert" className="text-sm text-destructive">
          {pesan}
        </p>
      )}
    </div>
  );
}
