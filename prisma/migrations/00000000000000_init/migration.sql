-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DEFAULT', 'ADMIN', 'SUPER_ADMIN');

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
CREATE TYPE "PlanningType" AS ENUM ('FIXED', 'VARIABLE');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyBranding" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "primary_color" TEXT,
    "secondary_color" TEXT,
    "company_name" TEXT,
    "company_info" JSONB,
    "trade_name" TEXT,
    "app_title" TEXT,
    "app_description" TEXT,
    "logo_sidebar_url" TEXT,
    "logo_dark_url" TEXT,
    "og_image_url" TEXT,
    "accent_color" TEXT,
    "success_color" TEXT,
    "warning_color" TEXT,
    "error_color" TEXT,
    "info_color" TEXT,
    "bg_color" TEXT,
    "card_color" TEXT,
    "border_color" TEXT,
    "text_color" TEXT,
    "primary_color_dark" TEXT,
    "secondary_color_dark" TEXT,
    "accent_color_dark" TEXT,
    "success_color_dark" TEXT,
    "warning_color_dark" TEXT,
    "error_color_dark" TEXT,
    "info_color_dark" TEXT,
    "bg_color_dark" TEXT,
    "card_color_dark" TEXT,
    "border_color_dark" TEXT,
    "text_color_dark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trade_name" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "cnpj" VARCHAR(18) NOT NULL,
    "state_registration" TEXT,
    "municipal_registration" TEXT,
    "license_number" VARCHAR(20),
    "commission_category_id" TEXT,
    "commission_subcategory_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "agency_id" TEXT,
    "type_id" TEXT NOT NULL,
    "center_id" TEXT,
    "debit_center_id" TEXT,
    "category_id" TEXT,
    "subcategory_id" TEXT,
    "title" TEXT NOT NULL,
    "registration_number" VARCHAR(50),
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
    "property_tax" DECIMAL(20,2),
    "property_tax_cash" DECIMAL(20,2),
    "property_tax_cash_due_date" DATE,
    "property_tax_first_installment" DECIMAL(20,2),
    "property_tax_first_installment_due_date" DATE,
    "property_tax_second_installment" DECIMAL(20,2),
    "property_tax_second_installment_due_date" DATE,
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
    "company_id" TEXT NOT NULL,
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
CREATE TABLE "UserColumnPreference" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "column_order" JSONB NOT NULL DEFAULT '[]',
    "column_widths" JSONB NOT NULL DEFAULT '{}',
    "visible_columns" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserColumnPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "created_by" TEXT,
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
    "company_id" TEXT NOT NULL,
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
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internal_code" TEXT NOT NULL,
    "nationality" VARCHAR(100),
    "occupation" TEXT,
    "marital_status" TEXT,
    "cpf" VARCHAR(14),
    "rg" VARCHAR(20),
    "rg_issuing_body" VARCHAR(50),
    "rg_issuing_state" VARCHAR(2),
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
    "company_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agency_id" TEXT,
    "financial_institution_id" TEXT,
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
    "property_tax_cash_due_date" DATE,
    "property_tax_first_installment" DECIMAL(20,2),
    "property_tax_first_installment_due_date" DATE,
    "property_tax_second_installment" DECIMAL(20,2),
    "property_tax_second_installment_due_date" DATE,
    "iptu_year" INTEGER,
    "iptu_installments" JSONB,
    "iptu_installments_due_dates" JSONB,
    "iptu_installments_count" INTEGER,
    "insurance_company" TEXT,
    "insurance_type" TEXT,
    "insurance_policy" TEXT,
    "guarantors" JSONB,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyValue" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "purchase_value" DECIMAL(20,2),
    "market_value" DECIMAL(20,2),
    "rental_value" DECIMAL(20,2),
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
    "company_id" TEXT NOT NULL,
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
    "company_id" TEXT NOT NULL,
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
    "company_id" TEXT NOT NULL,
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
    "company_id" TEXT NOT NULL,
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
    "company_id" TEXT NOT NULL,
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
    "company_id" TEXT NOT NULL,
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
    "company_id" TEXT NOT NULL,
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
    "company_id" TEXT NOT NULL,
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
    "created_via" TEXT DEFAULT 'full_form',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "marital_status" TEXT,
    "occupation" TEXT,
    "agency_id" TEXT,

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
    "company_id" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "effective_date" DATE NOT NULL,
    "purchase_date" DATE,
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
    "lease_id" TEXT,
    "transfer_group_id" TEXT,
    "is_transfer" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "total_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
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
    "company_id" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "Planning" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "subcategory_id" TEXT,
    "type" "PlanningType" NOT NULL,
    "default_amount" DECIMAL(20,2),
    "min_recommended" DECIMAL(20,2),
    "max_recommended" DECIMAL(20,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Planning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningMonth" (
    "id" TEXT NOT NULL,
    "planning_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,

    CONSTRAINT "PlanningMonth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyBranding_company_id_key" ON "CompanyBranding"("company_id");

-- CreateIndex
CREATE INDEX "Agency_cnpj_idx" ON "Agency"("cnpj");

-- CreateIndex
CREATE INDEX "Agency_commission_category_id_idx" ON "Agency"("commission_category_id");

-- CreateIndex
CREATE INDEX "Agency_commission_subcategory_id_idx" ON "Agency"("commission_subcategory_id");

-- CreateIndex
CREATE INDEX "Agency_company_id_idx" ON "Agency"("company_id");

-- CreateIndex
CREATE INDEX "Property_owner_id_idx" ON "Property"("owner_id");

-- CreateIndex
CREATE INDEX "Property_agency_id_idx" ON "Property"("agency_id");

-- CreateIndex
CREATE INDEX "Property_center_id_idx" ON "Property"("center_id");

-- CreateIndex
CREATE INDEX "Property_debit_center_id_idx" ON "Property"("debit_center_id");

-- CreateIndex
CREATE INDEX "Property_category_id_idx" ON "Property"("category_id");

-- CreateIndex
CREATE INDEX "Property_subcategory_id_idx" ON "Property"("subcategory_id");

-- CreateIndex
CREATE INDEX "Property_company_id_idx" ON "Property"("company_id");

-- CreateIndex
CREATE INDEX "PropertyIptu_property_id_idx" ON "PropertyIptu"("property_id");

-- CreateIndex
CREATE INDEX "PropertyIptu_year_idx" ON "PropertyIptu"("year");

-- CreateIndex
CREATE INDEX "User_company_id_idx" ON "User"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_company_id_email_key" ON "User"("company_id", "email");

-- CreateIndex
CREATE INDEX "UserColumnPreference_user_id_idx" ON "UserColumnPreference"("user_id");

-- CreateIndex
CREATE INDEX "UserColumnPreference_resource_idx" ON "UserColumnPreference"("resource");

-- CreateIndex
CREATE INDEX "UserColumnPreference_company_id_idx" ON "UserColumnPreference"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserColumnPreference_user_id_resource_key" ON "UserColumnPreference"("user_id", "resource");

-- CreateIndex
CREATE INDEX "Document_property_id_idx" ON "Document"("property_id");

-- CreateIndex
CREATE INDEX "Document_company_id_idx" ON "Document"("company_id");

-- CreateIndex
CREATE INDEX "Owner_cpf_idx" ON "Owner"("cpf");

-- CreateIndex
CREATE INDEX "Owner_cnpj_idx" ON "Owner"("cnpj");

-- CreateIndex
CREATE INDEX "Owner_company_id_idx" ON "Owner"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_company_id_internal_code_key" ON "Owner"("company_id", "internal_code");

-- CreateIndex
CREATE INDEX "Tenant_cpf_idx" ON "Tenant"("cpf");

-- CreateIndex
CREATE INDEX "Tenant_cnpj_idx" ON "Tenant"("cnpj");

-- CreateIndex
CREATE INDEX "Tenant_company_id_idx" ON "Tenant"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_company_id_internal_code_key" ON "Tenant"("company_id", "internal_code");

-- CreateIndex
CREATE INDEX "Lease_property_id_idx" ON "Lease"("property_id");

-- CreateIndex
CREATE INDEX "Lease_tenant_id_idx" ON "Lease"("tenant_id");

-- CreateIndex
CREATE INDEX "Lease_agency_id_idx" ON "Lease"("agency_id");

-- CreateIndex
CREATE INDEX "Lease_financial_institution_id_idx" ON "Lease"("financial_institution_id");

-- CreateIndex
CREATE INDEX "Lease_company_id_idx" ON "Lease"("company_id");

-- CreateIndex
CREATE INDEX "PropertyValue_property_id_idx" ON "PropertyValue"("property_id");

-- CreateIndex
CREATE INDEX "PropertyType_company_id_idx" ON "PropertyType"("company_id");

-- CreateIndex
CREATE INDEX "Contact_agency_id_idx" ON "Contact"("agency_id");

-- CreateIndex
CREATE INDEX "Contact_owner_id_idx" ON "Contact"("owner_id");

-- CreateIndex
CREATE INDEX "Contact_tenant_id_idx" ON "Contact"("tenant_id");

-- CreateIndex
CREATE INDEX "Contact_supplier_id_idx" ON "Contact"("supplier_id");

-- CreateIndex
CREATE INDEX "Favorite_company_id_idx" ON "Favorite"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_user_id_property_id_key" ON "Favorite"("user_id", "property_id");

-- CreateIndex
CREATE INDEX "FinancialInstitution_company_id_idx" ON "FinancialInstitution"("company_id");

-- CreateIndex
CREATE INDEX "Category_company_id_idx" ON "Category"("company_id");

-- CreateIndex
CREATE INDEX "Subcategory_category_id_idx" ON "Subcategory"("category_id");

-- CreateIndex
CREATE INDEX "Subcategory_company_id_idx" ON "Subcategory"("company_id");

-- CreateIndex
CREATE INDEX "Card_company_id_idx" ON "Card"("company_id");

-- CreateIndex
CREATE INDEX "Center_company_id_idx" ON "Center"("company_id");

-- CreateIndex
CREATE INDEX "Supplier_cnpj_idx" ON "Supplier"("cnpj");

-- CreateIndex
CREATE INDEX "Supplier_cpf_idx" ON "Supplier"("cpf");

-- CreateIndex
CREATE INDEX "Supplier_agency_id_idx" ON "Supplier"("agency_id");

-- CreateIndex
CREATE INDEX "Supplier_company_id_idx" ON "Supplier"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_company_id_internal_code_key" ON "Supplier"("company_id", "internal_code");

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
CREATE INDEX "Transaction_lease_id_idx" ON "Transaction"("lease_id");

-- CreateIndex
CREATE INDEX "Transaction_transfer_group_id_idx" ON "Transaction"("transfer_group_id");

-- CreateIndex
CREATE INDEX "Transaction_company_id_idx" ON "Transaction"("company_id");

-- CreateIndex
CREATE INDEX "invoices_card_id_idx" ON "invoices"("card_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_company_id_idx" ON "invoices"("company_id");

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

-- CreateIndex
CREATE INDEX "RecurringConfig_company_id_idx" ON "RecurringConfig"("company_id");

-- CreateIndex
CREATE INDEX "Planning_category_id_idx" ON "Planning"("category_id");

-- CreateIndex
CREATE INDEX "Planning_subcategory_id_idx" ON "Planning"("subcategory_id");

-- CreateIndex
CREATE INDEX "Planning_company_id_idx" ON "Planning"("company_id");

-- CreateIndex
CREATE INDEX "PlanningMonth_planning_id_idx" ON "PlanningMonth"("planning_id");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningMonth_planning_id_month_key" ON "PlanningMonth"("planning_id", "month");

-- AddForeignKey
ALTER TABLE "CompanyBranding" ADD CONSTRAINT "CompanyBranding_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_commission_category_id_fkey" FOREIGN KEY ("commission_category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_commission_subcategory_id_fkey" FOREIGN KEY ("commission_subcategory_id") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "PropertyType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_debit_center_id_fkey" FOREIGN KEY ("debit_center_id") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIptu" ADD CONSTRAINT "PropertyIptu_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserColumnPreference" ADD CONSTRAINT "UserColumnPreference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserColumnPreference" ADD CONSTRAINT "UserColumnPreference_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Owner" ADD CONSTRAINT "Owner_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "PropertyType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_financial_institution_id_fkey" FOREIGN KEY ("financial_institution_id") REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyValue" ADD CONSTRAINT "PropertyValue_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyType" ADD CONSTRAINT "PropertyType_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "FinancialInstitution" ADD CONSTRAINT "FinancialInstitution_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Center" ADD CONSTRAINT "Center_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_parent_transaction_id_fkey" FOREIGN KEY ("parent_transaction_id") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurring_group_id_fkey" FOREIGN KEY ("recurring_group_id") REFERENCES "RecurringConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "RecurringConfig" ADD CONSTRAINT "RecurringConfig_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningMonth" ADD CONSTRAINT "PlanningMonth_planning_id_fkey" FOREIGN KEY ("planning_id") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
