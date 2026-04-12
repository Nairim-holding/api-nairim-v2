-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "registration_number" VARCHAR(50);

-- AlterTable
ALTER TABLE "PropertyValue" ADD COLUMN     "market_value" DECIMAL(20,2),
ALTER COLUMN "rental_value" DROP NOT NULL;
