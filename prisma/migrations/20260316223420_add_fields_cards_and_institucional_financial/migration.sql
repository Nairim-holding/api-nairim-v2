/*
  Warnings:

  - You are about to drop the column `closing_day` on the `FinancialInstitution` table. All the data in the column will be lost.
  - You are about to drop the column `due_day` on the `FinancialInstitution` table. All the data in the column will be lost.
  - You are about to drop the column `limit` on the `FinancialInstitution` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "closing_day" INTEGER,
ADD COLUMN     "due_day" INTEGER;

-- AlterTable
ALTER TABLE "FinancialInstitution" DROP COLUMN "closing_day",
DROP COLUMN "due_day",
DROP COLUMN "limit",
ADD COLUMN     "account_number" VARCHAR(50),
ADD COLUMN     "agency_number" VARCHAR(20),
ADD COLUMN     "bank_number" VARCHAR(20);
