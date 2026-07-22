-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "installment_group_id" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_installment_group_id_idx" ON "Transaction"("installment_group_id");
