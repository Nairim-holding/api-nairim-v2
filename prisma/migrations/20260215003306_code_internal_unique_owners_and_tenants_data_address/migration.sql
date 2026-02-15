/*
  Warnings:

  - A unique constraint covering the columns `[internal_code]` on the table `Owner` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[internal_code]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "block" TEXT,
ADD COLUMN     "complement" TEXT,
ADD COLUMN     "lot" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Owner_internal_code_key" ON "Owner"("internal_code");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_internal_code_key" ON "Tenant"("internal_code");
