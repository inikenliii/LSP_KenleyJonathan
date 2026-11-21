/**
 * @file Pembantu untuk memvalidasi masukan memakai skema Zod.
 */
import { z } from 'zod';
import { ValidationError } from '@/domain';

/**
 * Memvalidasi masukan dengan skema Zod.
 *
 * @param schema Skema Zod yang dipakai.
 * @param input Data mentah yang diperiksa.
 * @returns Data hasil parse yang sudah dirapikan.
 * @throws {ValidationError} Bila ada isu validasi; isu tingkat formulir ada pada kunci `_form`.
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const hasil = schema.safeParse(input);
  if (hasil.success) {
    return hasil.data;
  }
  const { formErrors, fieldErrors } = z.flattenError(hasil.error);
  const semua: Record<string, string[]> = { ...(fieldErrors as Record<string, string[]>) };
  if (formErrors.length > 0) {
    semua._form = formErrors;
  }
  throw new ValidationError(semua);
}
