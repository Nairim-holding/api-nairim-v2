-- CreateEnum
CREATE TYPE "DfcGroup" AS ENUM ('TAXES', 'VARIABLE_EXPENSE', 'FIXED_EXPENSE', 'PAYROLL');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "dfc_group" "DfcGroup";
