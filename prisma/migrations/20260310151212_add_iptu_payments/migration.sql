/*
  Warnings:

  - The values [INSTALLMENTS_12X] on the enum `PaymentCondition` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `property_tax_installment` on the `Lease` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentCondition_new" AS ENUM ('IN_FULL_15_DISCOUNT', 'SECOND_INSTALLMENT_10_DISCOUNT', 'INSTALLMENTS');
ALTER TABLE "Lease" ALTER COLUMN "payment_condition" TYPE "PaymentCondition_new" USING ("payment_condition"::text::"PaymentCondition_new");
ALTER TYPE "PaymentCondition" RENAME TO "PaymentCondition_old";
ALTER TYPE "PaymentCondition_new" RENAME TO "PaymentCondition";
DROP TYPE "public"."PaymentCondition_old";
COMMIT;

-- AlterTable
ALTER TABLE "Lease" DROP COLUMN "property_tax_installment",
ADD COLUMN     "iptu_installments" JSONB,
ADD COLUMN     "iptu_installments_count" INTEGER;
