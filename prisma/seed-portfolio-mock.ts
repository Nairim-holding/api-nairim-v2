/**
 * Popula dados fake de portfólio (imóveis, proprietário, inquilino e
 * contratos) para os 6 widgets "legados" da aba Financeiro que dependem de
 * Property/Lease (Ticket Médio do Aluguel, Valor Total de Aluguel, Impostos e
 * Taxas, Valor de Aquisição, Vacância em Meses, Índice de Vacância
 * Financeira) — esses widgets são filtrados por Property.created_at dentro do
 * período selecionado no filtro, então este script cria imóveis com
 * created_at espalhado por todos os 12 meses de 2025 e 2026, igual ao mock
 * de lançamentos financeiros (ver prisma/seed-financeiro-mock.ts).
 *
 * Idempotente: remove e recria apenas os imóveis com título prefixado
 * "[MOCK]" desta empresa — não toca em nenhum outro dado.
 *
 * Uso: npm run db:seed-portfolio-mock
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_COMPANY_SLUG = 'nairim';
const DEFAULT_COMPANY_NAME = 'Nairim Holding';

const YEARS = [2025, 2026];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const MOCK_PREFIX = '[MOCK]';

function rand(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function dateUTC(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addMonthsUTC(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL não configurado no .env');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log('🔄 Conectando ao banco de dados...');

  // ─── Empresa: mesma lógica de resolução dos outros scripts de teste ────────
  let company = await prisma.company.findFirst({
    where: { OR: [{ id: DEFAULT_COMPANY_ID }, { slug: DEFAULT_COMPANY_SLUG }] },
  });
  if (!company) company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: { id: DEFAULT_COMPANY_ID, name: DEFAULT_COMPANY_NAME, slug: DEFAULT_COMPANY_SLUG, is_active: true },
    });
  }
  const companyId = company.id;
  console.log(`🏢 Usando empresa: ${company.name} (${companyId})`);

  // ─── Entidades base (find-or-create) ────────────────────────────────────────
  let propertyType = await prisma.propertyType.findFirst({ where: { company_id: companyId, description: 'Apartamento' } });
  if (!propertyType) {
    propertyType = await prisma.propertyType.create({ data: { company_id: companyId, description: 'Apartamento' } });
  }

  let owner = await prisma.owner.findFirst({ where: { company_id: companyId, internal_code: 'MOCK-OWNER-01' } });
  if (!owner) {
    owner = await prisma.owner.create({
      data: { company_id: companyId, name: 'Proprietário Mock', internal_code: 'MOCK-OWNER-01' },
    });
  }

  let tenant = await prisma.tenant.findFirst({ where: { company_id: companyId, internal_code: 'MOCK-TENANT-01' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { company_id: companyId, name: 'Inquilino Mock', internal_code: 'MOCK-TENANT-01' },
    });
  }

  // ─── Limpa imóveis mock de execuções anteriores (idempotente) ──────────────
  console.log('🧹 Limpando imóveis mock anteriores (reexecução idempotente)...');
  const previousMockProperties = await prisma.property.findMany({
    where: { company_id: companyId, title: { startsWith: MOCK_PREFIX } },
    select: { id: true },
  });
  const previousIds = previousMockProperties.map((p) => p.id);
  if (previousIds.length > 0) {
    await prisma.lease.deleteMany({ where: { property_id: { in: previousIds } } });
    await prisma.propertyValue.deleteMany({ where: { property_id: { in: previousIds } } });
    await prisma.property.deleteMany({ where: { id: { in: previousIds } } });
  }

  console.log('🏠 Gerando imóveis para 24 meses (2025 e 2026)...');

  let created = 0;

  for (const year of YEARS) {
    for (const month of MONTHS) {
      const monthDate = dateUTC(year, month, 15);

      // Imóvel 1: disponível/vago (status AVAILABLE), com um contrato recém
      // expirado — alimenta "Índice de Vacância Financeira" e "Total da
      // Vacância em Meses" com valores variados (não sempre 12 meses).
      const vacantProperty = await prisma.property.create({
        data: {
          company_id: companyId,
          owner_id: owner.id,
          type_id: propertyType.id,
          title: `${MOCK_PREFIX} Imóvel Vago ${month}/${year}`,
          bedrooms: 2,
          bathrooms: 1,
          half_bathrooms: 0,
          garage_spaces: 1,
          area_total: rand(55, 120),
          area_built: rand(50, 110),
          frontage: rand(6, 10),
          furnished: false,
          tax_registration: `MOCKV${String(year).slice(2)}${String(month).padStart(2, '0')}`,
          created_at: monthDate,
        },
      });
      const vacantRent = rand(2000, 5000);
      await prisma.propertyValue.create({
        data: {
          property_id: vacantProperty.id,
          status: 'AVAILABLE',
          rental_value: vacantRent,
          purchase_value: rand(250000, 550000),
          condo_fee: rand(200, 450),
          property_tax: rand(100, 300),
          created_at: monthDate,
        },
      });
      const leaseEnd = addMonthsUTC(monthDate, -(1 + (month % 4)));
      await prisma.lease.create({
        data: {
          company_id: companyId,
          property_id: vacantProperty.id,
          type_id: propertyType.id,
          owner_id: owner.id,
          tenant_id: tenant.id,
          contract_number: `MOCK-${year}${String(month).padStart(2, '0')}-V`,
          start_date: addMonthsUTC(leaseEnd, -12),
          end_date: leaseEnd,
          rent_amount: vacantRent,
          rent_due_day: 5,
          status: 'EXPIRED',
        },
      });

      // Imóvel 2: ocupado (status OCCUPIED) — alimenta "Valor Total de
      // Aquisição do Portfólio" e "Total de Impostos e Taxas" para todo mês.
      const occupiedProperty = await prisma.property.create({
        data: {
          company_id: companyId,
          owner_id: owner.id,
          type_id: propertyType.id,
          title: `${MOCK_PREFIX} Imóvel Ocupado ${month}/${year}`,
          bedrooms: 3,
          bathrooms: 2,
          half_bathrooms: 1,
          garage_spaces: 2,
          area_total: rand(90, 200),
          area_built: rand(85, 190),
          frontage: rand(8, 14),
          furnished: true,
          tax_registration: `MOCKO${String(year).slice(2)}${String(month).padStart(2, '0')}`,
          created_at: monthDate,
        },
      });
      await prisma.propertyValue.create({
        data: {
          property_id: occupiedProperty.id,
          status: 'OCCUPIED',
          rental_value: rand(3500, 9000),
          purchase_value: rand(400000, 900000),
          condo_fee: rand(300, 700),
          property_tax: rand(150, 450),
          created_at: monthDate,
        },
      });

      created += 2;
    }
  }

  console.log(`✅ ${created} imóveis criados, cobrindo Jan a Dez de 2025 e 2026.`);
  console.log('\n🎉 Mock de portfólio pronto!');
  console.log('--------------------------------------------------');
  console.log(`Empresa:  ${company.name} (${companyId})`);
  console.log('Período:  Jan/2025 a Dez/2026 (24 meses, todos com dados)');
  console.log('Por mês:  1 imóvel vago (com contrato expirado) + 1 imóvel ocupado');
  console.log('--------------------------------------------------\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Erro ao gerar mock de portfólio:', e);
  process.exit(1);
});
