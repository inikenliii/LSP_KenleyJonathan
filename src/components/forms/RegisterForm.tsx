'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { registerAction } from '@/app/(auth)/register/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { INITIAL_ACTION_STATE } from '@/lib/action-state';

/** Daftar isian formulir; password sengaja tidak diberi nilai awal. */
const FIELDS = [
  {
    name: 'nik',
    label: 'NIK',
    description: '16 digit sesuai KTP',
    inputMode: 'numeric',
    autoComplete: 'off',
  },
  { name: 'fullName', label: 'Nama Lengkap', autoComplete: 'name' },
  { name: 'phone', label: 'Nomor Telepon', type: 'tel', autoComplete: 'tel' },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    autoComplete: 'email',
    description: 'Dipakai sebagai username saat masuk',
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    autoComplete: 'new-password',
    description: '8 sampai 72 karakter',
  },
] as const;

/**
 * Formulir pendaftaran penyewa. Pesan error tampil tepat di bawah field yang
 * bermasalah dan isian lama dipertahankan (kecuali password) karena React
 * mengosongkan formulir setelah aksi selesai.
 *
 * @returns Formulir dengan lima isian, tombol Daftar, dan kotak pesan hasil.
 */
export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, INITIAL_ACTION_STATE);

  return (
    <div className="flex flex-col gap-4">
      {state.message && (
        <Alert aria-live="polite" variant={state.ok ? 'default' : 'destructive'}>
          <AlertTitle>{state.ok ? 'Pendaftaran berhasil' : 'Pendaftaran gagal'}</AlertTitle>
          <AlertDescription>
            {state.message}
            {state.ok && (
              <>
                {' '}
                Status akun: Menunggu verifikasi.{' '}
                <Link href="/login" className="font-medium underline underline-offset-4">
                  Masuk
                </Link>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!state.ok && (
        <form action={formAction} className="flex flex-col gap-5" noValidate>
          <FieldGroup>
            {FIELDS.map((field) => {
              const pesan = state.fieldErrors?.[field.name]?.[0];
              const inputType = 'type' in field ? field.type : 'text';
              const inputMode = 'inputMode' in field ? field.inputMode : undefined;
              return (
                <Field key={field.name} data-invalid={pesan ? true : undefined}>
                  <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type={inputType}
                    inputMode={inputMode}
                    autoComplete={field.autoComplete}
                    defaultValue={field.name === 'password' ? undefined : state.values?.[field.name]}
                    aria-invalid={pesan ? true : undefined}
                  />
                  {'description' in field && !pesan && (
                    <FieldDescription>{field.description}</FieldDescription>
                  )}
                  {pesan && <FieldError>{pesan}</FieldError>}
                </Field>
              );
            })}
          </FieldGroup>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? 'Memproses...' : 'Daftar'}
          </Button>
        </form>
      )}
    </div>
  );
}
