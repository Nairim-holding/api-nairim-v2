/*
  Warnings:

  - You are about to drop the column `reference_date` on the `PropertyValue` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PropertyValue" DROP COLUMN "reference_date",
ADD COLUMN     "sale_date" DATE;
