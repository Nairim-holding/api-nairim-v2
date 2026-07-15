-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "is_cancellation_charge" BOOLEAN NOT NULL DEFAULT false;
