-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "property_tax_cash" DECIMAL(20,2),
ADD COLUMN     "property_tax_installment" DECIMAL(20,2),
ADD COLUMN     "property_tax_second_installment" DECIMAL(20,2);
