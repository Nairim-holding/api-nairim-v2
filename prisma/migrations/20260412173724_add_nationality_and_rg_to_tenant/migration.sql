/*
  Warnings:

  - The `status` column on the `invoices` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "nationality" VARCHAR(100),
ADD COLUMN     "rg" VARCHAR(20);

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "status",
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "InvoiceStatus";

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");
