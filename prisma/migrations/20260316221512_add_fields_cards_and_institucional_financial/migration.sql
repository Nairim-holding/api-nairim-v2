-- AlterTable
ALTER TABLE "FinancialInstitution" ADD COLUMN     "closing_day" INTEGER,
ADD COLUMN     "due_day" INTEGER,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "limit" DECIMAL(20,2);
