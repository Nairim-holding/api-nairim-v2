-- CreateEnum
CREATE TYPE "PaymentCondition" AS ENUM ('IN_FULL_15_DISCOUNT', 'SECOND_INSTALLMENT_10_DISCOUNT', 'INSTALLMENTS_12X');

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "payment_condition" "PaymentCondition";
