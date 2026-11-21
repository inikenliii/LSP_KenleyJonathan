import type { Metadata } from 'next';
import { RentalForm } from '@/components/forms/RentalForm';
import { FadeIn } from '@/components/motion/FadeIn';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/dal';
import { rentalService } from '@/lib/container';

/** Judul tab halaman sewa baru. */
export const metadata: Metadata = { title: 'Sewa Baru' };

/**
 * Halaman Sewa Baru. Pilihan formulir diambil lewat layanan sewa, yang lebih
 * dulu melepas garasi dengan sewa yang sudah berakhir sebelum mendaftar garasi
 * yang tersedia.
 *
 * @returns Kartu berisi formulir sewa baru.
 */
export default async function NewRentalPage() {
  await requireRole('RENTER');
  const options = await rentalService.getNewRentalOptions();

  return (
    <FadeIn>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sewa Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <RentalForm
              today={options.today}
              todayLabel={options.todayLabel}
              maxDailyDays={options.maxDailyDays}
              garages={options.garages}
            />
          </CardContent>
        </Card>
      </div>
    </FadeIn>
  );
}
