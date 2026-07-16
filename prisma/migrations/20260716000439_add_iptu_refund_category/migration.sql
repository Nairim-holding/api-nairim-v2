-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "iptu_refund_category_id" TEXT,
ADD COLUMN     "iptu_refund_subcategory_id" TEXT;

-- CreateIndex
CREATE INDEX "Property_iptu_refund_category_id_idx" ON "Property"("iptu_refund_category_id");

-- CreateIndex
CREATE INDEX "Property_iptu_refund_subcategory_id_idx" ON "Property"("iptu_refund_subcategory_id");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_iptu_refund_category_id_fkey" FOREIGN KEY ("iptu_refund_category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_iptu_refund_subcategory_id_fkey" FOREIGN KEY ("iptu_refund_subcategory_id") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
