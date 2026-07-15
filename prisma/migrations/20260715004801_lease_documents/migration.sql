-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'LEASE_CONTRACT';

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_property_id_fkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "lease_id" TEXT,
ALTER COLUMN "property_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Document_lease_id_idx" ON "Document"("lease_id");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
