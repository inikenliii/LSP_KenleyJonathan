-- CreateTable
CREATE TABLE "rental_extensions" (
    "id" SERIAL NOT NULL,
    "rental_id" INTEGER NOT NULL,
    "previous_end_date" DATE NOT NULL,
    "new_end_date" DATE NOT NULL,
    "additional_days" INTEGER NOT NULL,
    "daily_price" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_proof_file" VARCHAR(64) NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rental_extensions_rental_id_idx" ON "rental_extensions"("rental_id");

-- AddForeignKey
ALTER TABLE "rental_extensions" ADD CONSTRAINT "rental_extensions_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_extensions" ADD CONSTRAINT "rental_extensions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
