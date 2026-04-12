-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DEFAULT', 'ADMIN');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('OCCUPIED', 'AVAILABLE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('TITLE_DEED', 'REGISTRATION', 'OTHER', 'PROPERTY_RECORD', 'IMAGE');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('EXPIRED', 'EXPIRING', 'ACTIVE', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentCondition" AS ENUM ('IN_FULL_15_DISCOUNT', 'SECOND_INSTALLMENT_10_DISCOUNT', 'INSTALLMENTS');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('PARCELADO', 'RECORRENTE');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'CLOSED', 'PAID');

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "trade_name" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "cnpj" VARCHAR(18) NOT NULL,
    "state_registration" TEXT,
    "municipal_registration" TEXT,
    "license_number" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "agency_id" TEXT,
    "type_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "half_bathrooms" INTEGER NOT NULL,
    "garage_spaces" INTEGER NOT NULL,
    "area_total" DOUBLE PRECISION NOT NULL,
    "area_built" DOUBLE PRECISION NOT NULL,
    "frontage" DOUBLE PRECISION NOT NULL,
    "furnished" BOOLEAN NOT NULL,
    "floor_number" INTEGER,
    "tax_registration" VARCHAR(20) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIptu" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "property_tax_cash" DECIMAL(20,2),
    "property_tax_first_installment" DECIMAL(20,2),
    "property_tax_second_installment" DECIMAL(20,2),
    "iptu_installments_count" INTEGER,
    "iptu_installments" JSONB,
    "payment_condition" "PaymentCondition",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "PropertyIptu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DEFAULT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "description" TEXT,
    "type" "DocumentType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internal_code" TEXT NOT NULL,
    "occupation" TEXT,
    "marital_status" TEXT,
    "cpf" VARCHAR(14),
    "cnpj" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "municipal_registration" TEXT,
    "state_registration" TEXT,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internal_code" TEXT NOT NULL,
    "occupation" TEXT,
    "marital_status" TEXT,
    "cpf" VARCHAR(14),
    "cnpj" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "municipal_registration" TEXT,
    "state_registration" TEXT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "contract_number" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "rent_amount" DECIMAL(20,2) NOT NULL,
    "condo_fee" DECIMAL(20,2),
    "property_tax" DECIMAL(20,2),
    "extra_charges" DECIMAL(20,2),
    "commission_amount" DECIMAL(20,2),
    "rent_due_day" INTEGER NOT NULL,
    "tax_due_day" INTEGER,
    "condo_due_day" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "cancellation_justification" TEXT,
    "cancellation_penalty" DECIMAL(20,2),
    "other_cancellation_amounts" DECIMAL(20,2),
    "status" "LeaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "payment_condition" "PaymentCondition",
    "property_tax_cash" DECIMAL(20,2),
    "property_tax_second_installment" DECIMAL(20,2),
    "iptu_installments" JSONB,
    "iptu_installments_count" INTEGER,
    "property_tax_first_installment" DECIMAL(20,2),

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyValue" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "purchase_value" DECIMAL(20,2),
    "rental_value" DECIMAL(20,2) NOT NULL,
    "condo_fee" DECIMAL(20,2) NOT NULL,
    "property_tax" DECIMAL(20,2) NOT NULL,
    "status" "PropertyStatus" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "extra_charges" DECIMAL(20,2),
    "sale_value" DECIMAL(20,2),
    "sale_date" DATE,
    "purchase_date" DATE,

    CONSTRAINT "PropertyValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyType" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "PropertyType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "zip_code" VARCHAR(10) NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "block" TEXT,
    "complement" TEXT,
    "lot" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "cellphone" TEXT,
    "agency_id" TEXT,
    "owner_id" TEXT,
    "tenant_id" TEXT,
    "supplier_id" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyAddress" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "address_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "AgencyAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAddress" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "address_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "PropertyAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerAddress" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "address_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "OwnerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAddress" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "address_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "TenantAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialInstitution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "account_number" VARCHAR(50),
    "agency_number" VARCHAR(20),
    "bank_number" VARCHAR(20),

    CONSTRAINT "FinancialInstitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limit" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "closing_day" INTEGER,
    "due_day" INTEGER,
    "brand" TEXT NOT NULL DEFAULT 'Outro',
    "current_balance" DECIMAL(20,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Center" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "sequential_id" SERIAL NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "cnpj" VARCHAR(20),
    "state_registration" TEXT,
    "municipal_registration" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "cpf" VARCHAR(14),
    "internal_code" TEXT,
    "marital_status" TEXT,
    "occupation" TEXT,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierAddress" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "address_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "SupplierAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "effective_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "category_id" TEXT NOT NULL,
    "subcategory_id" TEXT,
    "financial_institution_id" TEXT NOT NULL,
    "card_id" TEXT,
    "center_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "supplier_id" TEXT,
    "installment_number" INTEGER,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "occurrence_number" INTEGER,
    "parent_transaction_id" TEXT,
    "payment_mode" "PaymentMode",
    "recurring_frequency" "RecurringFrequency",
    "recurring_group_id" TEXT,
    "total_installments" INTEGER,
    "invoice_id" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "total_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "closing_date" DATE,
    "due_date" DATE,
    "paid_date" DATE,
    "paid_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "institution_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringConfig" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "category_id" TEXT NOT NULL,
    "subcategory_id" TEXT,
    "financial_institution_id" TEXT NOT NULL,
    "card_id" TEXT,
    "center_id" TEXT,
    "supplier_id" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "next_generation_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "total_occurrences" INTEGER,
    "generated_occurrences" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "RecurringConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agency_cnpj_idx" ON "Agency"("cnpj");

-- CreateIndex
CREATE INDEX "Property_owner_id_idx" ON "Property"("owner_id");

-- CreateIndex
CREATE INDEX "Property_agency_id_idx" ON "Property"("agency_id");

-- CreateIndex
CREATE INDEX "PropertyIptu_property_id_idx" ON "PropertyIptu"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyIptu_property_id_year_key" ON "PropertyIptu"("property_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Document_property_id_idx" ON "Document"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_internal_code_key" ON "Owner"("internal_code");

-- CreateIndex
CREATE INDEX "Owner_cpf_idx" ON "Owner"("cpf");

-- CreateIndex
CREATE INDEX "Owner_cnpj_idx" ON "Owner"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_internal_code_key" ON "Tenant"("internal_code");

-- CreateIndex
CREATE INDEX "Tenant_cpf_idx" ON "Tenant"("cpf");

-- CreateIndex
CREATE INDEX "Tenant_cnpj_idx" ON "Tenant"("cnpj");

-- CreateIndex
CREATE INDEX "Lease_property_id_idx" ON "Lease"("property_id");

-- CreateIndex
CREATE INDEX "Lease_tenant_id_idx" ON "Lease"("tenant_id");

-- CreateIndex
CREATE INDEX "PropertyValue_property_id_idx" ON "PropertyValue"("property_id");

-- CreateIndex
CREATE INDEX "Contact_agency_id_idx" ON "Contact"("agency_id");

-- CreateIndex
CREATE INDEX "Contact_owner_id_idx" ON "Contact"("owner_id");

-- CreateIndex
CREATE INDEX "Contact_tenant_id_idx" ON "Contact"("tenant_id");

-- CreateIndex
CREATE INDEX "Contact_supplier_id_idx" ON "Contact"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_user_id_property_id_key" ON "Favorite"("user_id", "property_id");

-- CreateIndex
CREATE INDEX "Subcategory_category_id_idx" ON "Subcategory"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_internal_code_key" ON "Supplier"("internal_code");

-- CreateIndex
CREATE INDEX "Supplier_cnpj_idx" ON "Supplier"("cnpj");

-- CreateIndex
CREATE INDEX "Supplier_cpf_idx" ON "Supplier"("cpf");

-- CreateIndex
CREATE INDEX "SupplierAddress_supplier_id_idx" ON "SupplierAddress"("supplier_id");

-- CreateIndex
CREATE INDEX "SupplierAddress_address_id_idx" ON "SupplierAddress"("address_id");

-- CreateIndex
CREATE INDEX "Transaction_category_id_idx" ON "Transaction"("category_id");

-- CreateIndex
CREATE INDEX "Transaction_subcategory_id_idx" ON "Transaction"("subcategory_id");

-- CreateIndex
CREATE INDEX "Transaction_financial_institution_id_idx" ON "Transaction"("financial_institution_id");

-- CreateIndex
CREATE INDEX "Transaction_card_id_idx" ON "Transaction"("card_id");

-- CreateIndex
CREATE INDEX "Transaction_center_id_idx" ON "Transaction"("center_id");

-- CreateIndex
CREATE INDEX "Transaction_supplier_id_idx" ON "Transaction"("supplier_id");

-- CreateIndex
CREATE INDEX "Transaction_parent_transaction_id_idx" ON "Transaction"("parent_transaction_id");

-- CreateIndex
CREATE INDEX "Transaction_recurring_group_id_idx" ON "Transaction"("recurring_group_id");

-- CreateIndex
CREATE INDEX "Transaction_payment_mode_idx" ON "Transaction"("payment_mode");

-- CreateIndex
CREATE INDEX "Transaction_invoice_id_idx" ON "Transaction"("invoice_id");

-- CreateIndex
CREATE INDEX "invoices_card_id_idx" ON "invoices"("card_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_card_id_month_year_key" ON "invoices"("card_id", "month", "year");

-- CreateIndex
CREATE INDEX "RecurringConfig_category_id_idx" ON "RecurringConfig"("category_id");

-- CreateIndex
CREATE INDEX "RecurringConfig_subcategory_id_idx" ON "RecurringConfig"("subcategory_id");

-- CreateIndex
CREATE INDEX "RecurringConfig_financial_institution_id_idx" ON "RecurringConfig"("financial_institution_id");

-- CreateIndex
CREATE INDEX "RecurringConfig_card_id_idx" ON "RecurringConfig"("card_id");

-- CreateIndex
CREATE INDEX "RecurringConfig_center_id_idx" ON "RecurringConfig"("center_id");

-- CreateIndex
CREATE INDEX "RecurringConfig_supplier_id_idx" ON "RecurringConfig"("supplier_id");

-- CreateIndex
CREATE INDEX "RecurringConfig_is_active_idx" ON "RecurringConfig"("is_active");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "PropertyType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIptu" ADD CONSTRAINT "PropertyIptu_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "PropertyType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyValue" ADD CONSTRAINT "PropertyValue_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyAddress" ADD CONSTRAINT "AgencyAddress_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyAddress" ADD CONSTRAINT "AgencyAddress_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAddress" ADD CONSTRAINT "PropertyAddress_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAddress" ADD CONSTRAINT "PropertyAddress_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerAddress" ADD CONSTRAINT "OwnerAddress_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerAddress" ADD CONSTRAINT "OwnerAddress_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAddress" ADD CONSTRAINT "TenantAddress_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAddress" ADD CONSTRAINT "TenantAddress_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAddress" ADD CONSTRAINT "SupplierAddress_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAddress" ADD CONSTRAINT "SupplierAddress_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_financial_institution_id_fkey" FOREIGN KEY ("financial_institution_id") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_parent_transaction_id_fkey" FOREIGN KEY ("parent_transaction_id") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurring_group_id_fkey" FOREIGN KEY ("recurring_group_id") REFERENCES "RecurringConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringConfig" ADD CONSTRAINT "RecurringConfig_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringConfig" ADD CONSTRAINT "RecurringConfig_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringConfig" ADD CONSTRAINT "RecurringConfig_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringConfig" ADD CONSTRAINT "RecurringConfig_financial_institution_id_fkey" FOREIGN KEY ("financial_institution_id") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringConfig" ADD CONSTRAINT "RecurringConfig_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringConfig" ADD CONSTRAINT "RecurringConfig_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
