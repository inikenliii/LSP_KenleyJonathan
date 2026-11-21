-- CreateEnum
CREATE TYPE "GarageType" AS ENUM ('BICYCLE', 'CAR', 'ELECTRIC_CAR');

-- CreateEnum
CREATE TYPE "GarageStatus" AS ENUM ('AVAILABLE', 'USED');

-- CreateTable
CREATE TABLE "garage_type_configs" (
    "type" "GarageType" NOT NULL,
    "daily_price" INTEGER NOT NULL DEFAULT 0,
    "price_per_kwh" INTEGER,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garage_type_configs_pkey" PRIMARY KEY ("type")
);

-- CreateTable
CREATE TABLE "garages" (
    "id" VARCHAR(4) NOT NULL,
    "type" "GarageType" NOT NULL,
    "status" "GarageStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "garages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "garages_type_status_idx" ON "garages"("type", "status");

-- AddForeignKey
ALTER TABLE "garages" ADD CONSTRAINT "garages_type_fkey" FOREIGN KEY ("type") REFERENCES "garage_type_configs"("type") ON DELETE RESTRICT ON UPDATE CASCADE;
