import 'dotenv/config';
import bcrypt from "bcrypt";
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

import { Gender, Role } from "../src/generated/prisma/client";

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

async function main() {
  console.log('Seeding financial data only...');

  // Limpar existentes (respeitar FK)
  await prisma.transaction.deleteMany();
  await prisma.recurringConfig.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.planning.deleteMany();
  await prisma.userColumnPreference.deleteMany();
  await prisma.user.deleteMany();
  await prisma.companyBranding.deleteMany();
  await prisma.company.deleteMany();

  // Criar company e user
  const company = await prisma.company.create({
    data: { name: 'Teste Financeiro', slug: 'teste-financeiro' }
  });

  const passwordHash = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.create({
    data: {
      name: 'Admin Teste',
      email: 'admin.teste@nairim.com',
      password: passwordHash,
      birth_date: new Date('1990-01-01'),
      gender: Gender.OTHER,
      role: Role.ADMIN,
      company: { connect: { id: company.id } }
    }
  });

  console.log(`Created company: ${company.id}`);
  console.log(`Created user: ${user.id}`);

  // Criar instituições
  console.log('Creating financial institutions...');
  const institutions = await Promise.all([
    prisma.financialInstitution.create({
      data: { name: 'Banco do Brasil', bank_number: '001', is_active: true, company_id: company.id }
    }),
    prisma.financialInstitution.create({
      data: { name: 'Itaú', bank_number: '341', is_active: true, company_id: company.id }
    }),
    prisma.financialInstitution.create({
      data: { name: 'Bradesco', bank_number: '237', is_active: true, company_id: company.id }
    })
  ]);

  // Criar categorias
  console.log('Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({
      data: { name: 'Aluguel Recebido', type: 'INCOME', is_active: true, company_id: company.id }
    }),
    prisma.category.create({
      data: { name: 'Condomínio', type: 'EXPENSE', is_active: true, company_id: company.id }
    }),
    prisma.category.create({
      data: { name: 'IPTU', type: 'EXPENSE', is_active: true, company_id: company.id }
    }),
    prisma.category.create({
      data: { name: 'Manutenção', type: 'EXPENSE', is_active: true, company_id: company.id }
    })
  ]);

  // Criar centros
  console.log('Creating centers...');
  const centers = await Promise.all([
    prisma.center.create({
      data: { name: 'Imobiliário', type: 'INCOME', is_active: true, company_id: company.id }
    }),
    prisma.center.create({
      data: { name: 'Operacional', type: 'EXPENSE', is_active: true, company_id: company.id }
    })
  ]);

  // Criar transações dos últimos 3 meses
  console.log('Creating 100+ transactions...');
  const now = new Date();
  const transactionsToCreate = [];

  for (let i = 0; i < 100; i++) {
    const daysAgo = getRandomInt(0, 90);
    const eventDate = new Date(now);
    eventDate.setDate(eventDate.getDate() - daysAgo);

    const isIncome = Math.random() > 0.4;
    const category = isIncome ? categories[0] : getRandomElement([categories[1], categories[2], categories[3]]);
    const status = Math.random() > 0.3 ? 'COMPLETED' : 'PENDING';
    const amount = isIncome ? getRandomInt(1000, 15000) : getRandomInt(100, 5000);
    const institution = getRandomElement(institutions);

    transactionsToCreate.push({
      event_date: eventDate,
      effective_date: new Date(eventDate),
      description: isIncome ? `Aluguel - Imóvel ${i}` : `Despesa operacional ${i}`,
      amount,
      status,
      category_id: category.id,
      financial_institution_id: institution.id,
      center_id: getRandomElement(centers).id,
      company_id: company.id
    });
  }

  const createdTransactions = await Promise.all(
    transactionsToCreate.map(item => prisma.transaction.create({ data: item }))
  );

  console.log('✅ Financial data seeded successfully!');
  console.log(`\nSummary:`);
  console.log(` - Company: 1`);
  console.log(` - User: 1`);
  console.log(` - Financial Institutions: ${institutions.length}`);
  console.log(` - Categories: ${categories.length}`);
  console.log(` - Centers: ${centers.length}`);
  console.log(` - Transactions: ${createdTransactions.length}\n`);
}

main()
  .then(async () => {
    console.log('Seeding completed!');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seeding error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
