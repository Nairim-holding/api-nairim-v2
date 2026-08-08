-- CreateTable
CREATE TABLE "IptuAuditSettings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "income_category_id" TEXT,
    "income_subcategory_id" TEXT,
    "expense_category_id" TEXT,
    "expense_subcategory_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IptuAuditSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IptuAuditSettings_company_id_key" ON "IptuAuditSettings"("company_id");

-- CreateIndex
CREATE INDEX "IptuAuditSettings_company_id_idx" ON "IptuAuditSettings"("company_id");

-- AddForeignKey
ALTER TABLE "IptuAuditSettings" ADD CONSTRAINT "IptuAuditSettings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IptuAuditSettings" ADD CONSTRAINT "IptuAuditSettings_income_category_id_fkey" FOREIGN KEY ("income_category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IptuAuditSettings" ADD CONSTRAINT "IptuAuditSettings_income_subcategory_id_fkey" FOREIGN KEY ("income_subcategory_id") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IptuAuditSettings" ADD CONSTRAINT "IptuAuditSettings_expense_category_id_fkey" FOREIGN KEY ("expense_category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IptuAuditSettings" ADD CONSTRAINT "IptuAuditSettings_expense_subcategory_id_fkey" FOREIGN KEY ("expense_subcategory_id") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
