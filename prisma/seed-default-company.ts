/**
 * Data migration: creates the default company and assigns all existing records.
 * Run once after the first schema migration (company_id nullable).
 * After this script, run the second migration to make company_id NOT NULL.
 *
 * Usage: npx tsx prisma/seed-default-company.ts
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import pg from 'pg';

const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_COMPANY_SLUG = 'nairim';
const DEFAULT_COMPANY_NAME = 'Nairim Holding';

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter } as any);

  console.log('🏢 Creating default company...');

  const company = await prisma.company.upsert({
    where: { slug: DEFAULT_COMPANY_SLUG },
    update: {},
    create: {
      id: DEFAULT_COMPANY_ID,
      name: DEFAULT_COMPANY_NAME,
      slug: DEFAULT_COMPANY_SLUG,
      is_active: true,
    },
  });

  console.log(`✅ Company created: ${company.name} (${company.id})`);

  console.log('🎨 Creating default branding...');
  await prisma.companyBranding.upsert({
    where: { company_id: company.id },
    update: {},
    create: {
      company_id: company.id,
      company_name: DEFAULT_COMPANY_NAME,
    },
  });
  console.log('✅ Branding created.');

  console.log('🔗 Associating existing records to default company...');

  const COMPANY_ID = company.id;

  const users = await prisma.user.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Users: ${users.count}`);

  const prefs = await prisma.userColumnPreference.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ UserColumnPreferences: ${prefs.count}`);

  const agencies = await prisma.agency.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Agencies: ${agencies.count}`);

  const propertyTypes = await prisma.propertyType.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ PropertyTypes: ${propertyTypes.count}`);

  const properties = await prisma.property.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Properties: ${properties.count}`);

  const documents = await prisma.document.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Documents: ${documents.count}`);

  const favorites = await prisma.favorite.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Favorites: ${favorites.count}`);

  const owners = await prisma.owner.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Owners: ${owners.count}`);

  const tenants = await prisma.tenant.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Tenants: ${tenants.count}`);

  const leases = await prisma.lease.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Leases: ${leases.count}`);

  const institutions = await prisma.financialInstitution.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ FinancialInstitutions: ${institutions.count}`);

  const cards = await prisma.card.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Cards: ${cards.count}`);

  const invoices = await prisma.invoice.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Invoices: ${invoices.count}`);

  const categories = await prisma.category.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Categories: ${categories.count}`);

  const subcategories = await prisma.subcategory.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Subcategories: ${subcategories.count}`);

  const centers = await prisma.center.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Centers: ${centers.count}`);

  const suppliers = await prisma.supplier.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Suppliers: ${suppliers.count}`);

  const recurringConfigs = await prisma.recurringConfig.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ RecurringConfigs: ${recurringConfigs.count}`);

  const transactions = await prisma.transaction.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Transactions: ${transactions.count}`);

  const plannings = await prisma.planning.updateMany({ where: { company_id: null }, data: { company_id: COMPANY_ID } });
  console.log(`  ✅ Plannings: ${plannings.count}`);

  console.log('\n🎉 Data migration complete!');
  console.log(`   Default company ID: ${COMPANY_ID}`);
  console.log('   Next step: update schema to make company_id NOT NULL, then run:');
  console.log('   npx prisma db push');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
