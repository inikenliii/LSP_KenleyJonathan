-- AlterTable
-- Kolom baru diberi nilai bawaan sementara agar baris perpanjangan lama tetap sah.
ALTER TABLE "rental_extensions" ADD COLUMN     "extension_type" "RentalType" NOT NULL DEFAULT 'HARIAN',
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 0;

-- Perpanjangan lama adalah perpanjangan harian: jumlahnya sama dengan tambahan hari.
UPDATE "rental_extensions" SET "quantity" = "additional_days";

-- Model tidak memakai nilai bawaan, jadi nilai bawaan sementara dilepas lagi.
ALTER TABLE "rental_extensions" ALTER COLUMN "extension_type" DROP DEFAULT,
ALTER COLUMN "quantity" DROP DEFAULT;
