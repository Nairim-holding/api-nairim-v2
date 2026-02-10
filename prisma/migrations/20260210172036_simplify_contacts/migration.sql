/*
  Warnings:

  - You are about to drop the `AgencyContact` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OwnerContact` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TenantContact` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AgencyContact" DROP CONSTRAINT "AgencyContact_agency_id_fkey";

-- DropForeignKey
ALTER TABLE "AgencyContact" DROP CONSTRAINT "AgencyContact_contact_id_fkey";

-- DropForeignKey
ALTER TABLE "OwnerContact" DROP CONSTRAINT "OwnerContact_contact_id_fkey";

-- DropForeignKey
ALTER TABLE "OwnerContact" DROP CONSTRAINT "OwnerContact_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "TenantContact" DROP CONSTRAINT "TenantContact_contact_id_fkey";

-- DropForeignKey
ALTER TABLE "TenantContact" DROP CONSTRAINT "TenantContact_tenant_id_fkey";

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "agency_id" TEXT,
ADD COLUMN     "owner_id" TEXT,
ADD COLUMN     "tenant_id" TEXT;

-- DropTable
DROP TABLE "AgencyContact";

-- DropTable
DROP TABLE "OwnerContact";

-- DropTable
DROP TABLE "TenantContact";

-- CreateIndex
CREATE INDEX "Contact_agency_id_idx" ON "Contact"("agency_id");

-- CreateIndex
CREATE INDEX "Contact_owner_id_idx" ON "Contact"("owner_id");

-- CreateIndex
CREATE INDEX "Contact_tenant_id_idx" ON "Contact"("tenant_id");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
