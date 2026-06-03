-- ============================================================
-- MIGRAÇÃO DE PRODUÇÃO: Multi-Tenant + White Label
-- Execução segura em 3 fases para bancos com dados existentes.
-- Execute dentro do container: psql $DATABASE_URL -f migrate-production.sql
-- ============================================================

BEGIN;

-- ============================================================
-- FASE 1: Criar tabelas de empresa (se não existirem)
-- ============================================================

CREATE TABLE IF NOT EXISTS "Company" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "slug"       TEXT NOT NULL,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Company_slug_key" ON "Company"("slug");

CREATE TABLE IF NOT EXISTS "CompanyBranding" (
  "id"              TEXT NOT NULL,
  "company_id"      TEXT NOT NULL,
  "logo_url"        TEXT,
  "favicon_url"     TEXT,
  "primary_color"   TEXT,
  "secondary_color" TEXT,
  "company_name"    TEXT,
  "company_info"    JSONB,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyBranding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyBranding_company_id_key" ON "CompanyBranding"("company_id");

-- ============================================================
-- FASE 2: Criar empresa padrão
-- ============================================================

INSERT INTO "Company" ("id", "name", "slug", "is_active", "created_at", "updated_at")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Nairim Holding',
  'nairim',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CompanyBranding" ("id", "company_id", "company_name", "created_at", "updated_at")
VALUES (
  gen_random_uuid()::text,
  '00000000-0000-0000-0000-000000000001',
  'Nairim Holding',
  NOW(),
  NOW()
)
ON CONFLICT ("company_id") DO NOTHING;

-- ============================================================
-- FASE 3: Adicionar company_id como NULLABLE em cada tabela
-- ============================================================

ALTER TABLE "Agency"               ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Card"                 ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Category"             ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Center"               ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Document"             ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Favorite"             ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "FinancialInstitution" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Lease"                ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Owner"                ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Planning"             ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Property"             ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "PropertyType"         ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "RecurringConfig"      ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Subcategory"          ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Supplier"             ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Tenant"               ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Transaction"          ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "User"                 ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "UserColumnPreference" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "invoices"             ADD COLUMN IF NOT EXISTS "company_id" TEXT;

-- ============================================================
-- FASE 4: Popular company_id em todos os registros existentes
-- ============================================================

UPDATE "Agency"               SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Card"                 SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Category"             SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Center"               SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Document"             SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Favorite"             SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "FinancialInstitution" SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Lease"                SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Owner"                SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Planning"             SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Property"             SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "PropertyType"         SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "RecurringConfig"      SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Subcategory"          SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Supplier"             SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Tenant"               SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "Transaction"          SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "User"                 SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "UserColumnPreference" SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;
UPDATE "invoices"             SET "company_id" = '00000000-0000-0000-0000-000000000001' WHERE "company_id" IS NULL;

-- ============================================================
-- FASE 5: Adicionar NOT NULL constraint (depois de popular)
-- ============================================================

ALTER TABLE "Agency"               ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Card"                 ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Category"             ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Center"               ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Document"             ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Favorite"             ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "FinancialInstitution" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Lease"                ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Owner"                ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Planning"             ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Property"             ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "PropertyType"         ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "RecurringConfig"      ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Subcategory"          ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Supplier"             ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Tenant"               ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "Transaction"          ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "User"                 ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "UserColumnPreference" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "invoices"             ALTER COLUMN "company_id" SET NOT NULL;

-- ============================================================
-- FASE 6: Foreign keys para Company (idempotente via DO/EXCEPTION)
-- ============================================================

DO $$ BEGIN ALTER TABLE "CompanyBranding"    ADD CONSTRAINT "CompanyBranding_company_id_fkey"    FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Agency"               ADD CONSTRAINT "Agency_company_id_fkey"               FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Card"                 ADD CONSTRAINT "Card_company_id_fkey"                 FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Category"             ADD CONSTRAINT "Category_company_id_fkey"             FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Center"               ADD CONSTRAINT "Center_company_id_fkey"               FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Document"             ADD CONSTRAINT "Document_company_id_fkey"             FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Favorite"             ADD CONSTRAINT "Favorite_company_id_fkey"             FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "FinancialInstitution" ADD CONSTRAINT "FinancialInstitution_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Lease"                ADD CONSTRAINT "Lease_company_id_fkey"                FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Owner"                ADD CONSTRAINT "Owner_company_id_fkey"                FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Planning"             ADD CONSTRAINT "Planning_company_id_fkey"             FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Property"             ADD CONSTRAINT "Property_company_id_fkey"             FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "PropertyType"         ADD CONSTRAINT "PropertyType_company_id_fkey"         FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "RecurringConfig"      ADD CONSTRAINT "RecurringConfig_company_id_fkey"      FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Subcategory"          ADD CONSTRAINT "Subcategory_company_id_fkey"          FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Supplier"             ADD CONSTRAINT "Supplier_company_id_fkey"             FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Tenant"               ADD CONSTRAINT "Tenant_company_id_fkey"               FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Transaction"          ADD CONSTRAINT "Transaction_company_id_fkey"          FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "User"                 ADD CONSTRAINT "User_company_id_fkey"                 FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "UserColumnPreference" ADD CONSTRAINT "UserColumnPreference_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "invoices"             ADD CONSTRAINT "invoices_company_id_fkey"             FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- FASE 7: Índices de performance
-- ============================================================

CREATE INDEX IF NOT EXISTS "Agency_company_id_idx"               ON "Agency"("company_id");
CREATE INDEX IF NOT EXISTS "Card_company_id_idx"                 ON "Card"("company_id");
CREATE INDEX IF NOT EXISTS "Category_company_id_idx"             ON "Category"("company_id");
CREATE INDEX IF NOT EXISTS "Center_company_id_idx"               ON "Center"("company_id");
CREATE INDEX IF NOT EXISTS "Document_company_id_idx"             ON "Document"("company_id");
CREATE INDEX IF NOT EXISTS "Favorite_company_id_idx"             ON "Favorite"("company_id");
CREATE INDEX IF NOT EXISTS "FinancialInstitution_company_id_idx" ON "FinancialInstitution"("company_id");
CREATE INDEX IF NOT EXISTS "Lease_company_id_idx"                ON "Lease"("company_id");
CREATE INDEX IF NOT EXISTS "Owner_company_id_idx"                ON "Owner"("company_id");
CREATE INDEX IF NOT EXISTS "Planning_company_id_idx"             ON "Planning"("company_id");
CREATE INDEX IF NOT EXISTS "Property_company_id_idx"             ON "Property"("company_id");
CREATE INDEX IF NOT EXISTS "PropertyType_company_id_idx"         ON "PropertyType"("company_id");
CREATE INDEX IF NOT EXISTS "RecurringConfig_company_id_idx"      ON "RecurringConfig"("company_id");
CREATE INDEX IF NOT EXISTS "Subcategory_company_id_idx"          ON "Subcategory"("company_id");
CREATE INDEX IF NOT EXISTS "Supplier_company_id_idx"             ON "Supplier"("company_id");
CREATE INDEX IF NOT EXISTS "Tenant_company_id_idx"               ON "Tenant"("company_id");
CREATE INDEX IF NOT EXISTS "Transaction_company_id_idx"          ON "Transaction"("company_id");
CREATE INDEX IF NOT EXISTS "User_company_id_idx"                 ON "User"("company_id");
CREATE INDEX IF NOT EXISTS "UserColumnPreference_company_id_idx" ON "UserColumnPreference"("company_id");
CREATE INDEX IF NOT EXISTS "invoices_company_id_idx"             ON "invoices"("company_id");

-- ============================================================
-- FASE 8: Unique constraints compostos (substituem os antigos)
-- ============================================================

-- User.email: era @unique, vira @@unique([company_id, email])
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_company_id_email_key" ON "User"("company_id", "email");

-- Owner.internal_code
ALTER TABLE "Owner" DROP CONSTRAINT IF EXISTS "Owner_internal_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Owner_company_id_internal_code_key" ON "Owner"("company_id", "internal_code");

-- Tenant.internal_code
ALTER TABLE "Tenant" DROP CONSTRAINT IF EXISTS "Tenant_internal_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_company_id_internal_code_key" ON "Tenant"("company_id", "internal_code");

-- Supplier.internal_code
ALTER TABLE "Supplier" DROP CONSTRAINT IF EXISTS "Supplier_internal_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_company_id_internal_code_key" ON "Supplier"("company_id", "internal_code") WHERE "internal_code" IS NOT NULL;

-- Planning: era @@unique([category_id, subcategory_id, year])
ALTER TABLE "Planning" DROP CONSTRAINT IF EXISTS "Planning_category_id_subcategory_id_year_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Planning_company_id_category_id_subcategory_id_year_key"
  ON "Planning"("company_id", "category_id", "subcategory_id", "year");

COMMIT;

-- ============================================================
-- FASE 9: Enum Role - adicionar SUPER_ADMIN
-- (fora da transação: ALTER TYPE ADD VALUE não suporta transações no PostgreSQL)
-- ============================================================

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- Verificação final
SELECT
  'Company'              AS tabela, COUNT(*) AS registros FROM "Company"
UNION ALL SELECT 'Agency',               COUNT(*) FROM "Agency"
UNION ALL SELECT 'User',                 COUNT(*) FROM "User"
UNION ALL SELECT 'Property',             COUNT(*) FROM "Property"
ORDER BY tabela;
