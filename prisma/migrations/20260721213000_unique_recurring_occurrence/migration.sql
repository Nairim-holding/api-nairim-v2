-- CreateIndex
CREATE UNIQUE INDEX "Transaction_recurring_group_id_occurrence_number_key" ON "Transaction"("recurring_group_id", "occurrence_number");
