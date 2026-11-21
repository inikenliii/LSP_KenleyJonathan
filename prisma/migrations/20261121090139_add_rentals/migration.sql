-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SEPEDA', 'SEPEDA_MOTOR', 'MOBIL', 'MOBIL_LISTRIK');

-- CreateEnum
CREATE TYPE "RentalType" AS ENUM ('HARIAN', 'BULANAN');

-- CreateTable
CREATE TABLE "rentals" (
    "id" SERIAL NOT NULL,
    "renter_id" INTEGER NOT NULL,
    "garage_id" VARCHAR(4) NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL,
    "plate_number" VARCHAR(12),
    "vehicle_brand" VARCHAR(50) NOT NULL,
    "vehicle_model" VARCHAR(50) NOT NULL,
    "battery_kwh" DECIMAL(5,1),
    "rental_type" "RentalType" NOT NULL,
    "days" INTEGER,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "daily_price" INTEGER NOT NULL,
    "price_per_kwh" INTEGER,
    "charge_cost" INTEGER NOT NULL DEFAULT 0,
    "total_cost" INTEGER NOT NULL,
    "payment_proof_file" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rentals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rentals_renter_id_idx" ON "rentals"("renter_id");

-- CreateIndex
CREATE INDEX "rentals_garage_id_end_date_idx" ON "rentals"("garage_id", "end_date");

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_renter_id_fkey" FOREIGN KEY ("renter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_garage_id_fkey" FOREIGN KEY ("garage_id") REFERENCES "garages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
