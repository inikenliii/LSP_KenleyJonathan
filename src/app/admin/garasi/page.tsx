import type { Metadata } from 'next';
import { GarageBatchForm } from '@/components/forms/GarageBatchForm';
import { FadeIn } from '@/components/motion/FadeIn';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GARAGE_TYPE_CODES, GarageFactory } from '@/domain';
import { requireRole } from '@/lib/auth/dal';

/** Judul tab halaman kelola garasi. */
export const metadata: Metadata = { title: 'Kelola Garasi' };

/**
 * Halaman Kelola Garasi: Admin membuat garasi berkelompok per tipe. Tabel
 * harga dan daftar garasi ditambahkan pada tugas berikutnya.
 *
 * @returns Judul halaman dan kartu formulir pembuatan garasi.
 */
export default async function GaragesPage() {
  await requireRole('ADMIN');

  // Hanya objek biasa yang boleh melewati batas ke komponen klien.
  const typeOptions = GARAGE_TYPE_CODES.map((kode) => ({
    value: kode,
    label: GarageFactory.create(kode).label,
  }));

  return (
    <FadeIn>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Kelola Garasi</h1>

        <Card>
          <CardHeader>
            <CardTitle>Buat Garasi Berkelompok</CardTitle>
          </CardHeader>
          <CardContent>
            <GarageBatchForm typeOptions={typeOptions} />
          </CardContent>
        </Card>
      </div>
    </FadeIn>
  );
}
