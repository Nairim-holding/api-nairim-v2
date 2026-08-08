-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "transaction_id" TEXT;

-- CreateIndex
CREATE INDEX "Document_transaction_id_idx" ON "Document"("transaction_id");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
