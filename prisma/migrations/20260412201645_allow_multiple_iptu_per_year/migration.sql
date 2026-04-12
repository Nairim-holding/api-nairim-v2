-- DropIndex
DROP INDEX "PropertyIptu_property_id_year_key";

-- CreateIndex
CREATE INDEX "PropertyIptu_year_idx" ON "PropertyIptu"("year");
