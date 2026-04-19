-- AddColumn purchase_date to Transaction
ALTER TABLE "Transaction" ADD COLUMN "purchase_date" DATE;

-- Create index for purchase_date if needed for performance
CREATE INDEX "Transaction_purchase_date_idx" ON "Transaction"("purchase_date");
