'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/(auth)/login/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { INITIAL_ACTION_STATE } from '@/lib/action-state';

/**
 * Formulir masuk dengan email dan password. Pesan error tampil di bawah field
 * yang bermasalah; email yang diketik dipertahankan, password tidak.
 *
 * @returns Formulir dengan dua isian, tombol Masuk, dan kotak pesan gagal.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_ACTION_STATE);
  const pesanEmail = state.fieldErrors?.email?.[0];
  const pesanPassword = state.fieldErrors?.password?.[0];
  const adaPesanField = Boolean(pesanEmail || pesanPassword);

  return (
    <div className="flex flex-col gap-4">
      {state.message && !adaPesanField && (
        <Alert aria-live="polite" variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <form action={formAction} className="flex flex-col gap-5" noValidate>
        <FieldGroup>
          <Field data-invalid={pesanEmail ? true : undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              defaultValue={state.values?.email}
              aria-invalid={pesanEmail ? true : undefined}
            />
            {pesanEmail && <FieldError>{pesanEmail}</FieldError>}
          </Field>
          <Field data-invalid={pesanPassword ? true : undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={pesanPassword ? true : undefined}
            />
            {pesanPassword && <FieldError>{pesanPassword}</FieldError>}
          </Field>
        </FieldGroup>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Memproses...' : 'Masuk'}
        </Button>
      </form>
    </div>
  );
}
