-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PropertyValue" ADD COLUMN     "purchase_date" DATE,
ALTER COLUMN "purchase_value" DROP NOT NULL;
