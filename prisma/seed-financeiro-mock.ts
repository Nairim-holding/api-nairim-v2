/**
 * Popula dados financeiros fake (instituições, cartões, categorias,
 * subcategorias, centros de custo, fornecedores, planejamento e lançamentos)
 * cobrindo todos os 12 meses de 2025 e 2026, para visualizar todos os
 * gráficos da aba Financeiro com dados reais de teste.
 *
 * Idempotente: reutiliza entidades já existentes (por nome) e substitui só os
 * lançamentos/planejamento das categorias que este script gerencia — não toca
 * em Property/Owner/Lease nem em categorias/lançamentos de outras origens.
 *
 * Uso: npm run db:seed-financeiro-mock
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_COMPANY_SLUG = 'nairim';
const DEFAULT_COMPANY_NAME = 'Nairim Holding';

const YEARS = [2025, 2026];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function rand(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function dateUTC(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
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

  // ─── Empresa: mesma lógica de resolução do scripts/create-test-user.ts, para
  // garantir que os dados caiam na mesma empresa do usuário de teste. ────────
  let company = await prisma.company.findFirst({
    where: { OR: [{ id: DEFAULT_COMPANY_ID }, { slug: DEFAULT_COMPANY_SLUG }] },
  });
  if (!company) company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: { id: DEFAULT_COMPANY_ID, name: DEFAULT_COMPANY_NAME, slug: DEFAULT_COMPANY_SLUG, is_active: true },
    });
    await prisma.companyBranding.upsert({
      where: { company_id: company.id },
      update: {},
      create: { company_id: company.id, company_name: DEFAULT_COMPANY_NAME },
    });
  }
  const companyId = company.id;
  console.log(`🏢 Usando empresa: ${company.name} (${companyId})`);

  // ─── Find-or-create helpers (idempotentes por nome dentro da empresa) ──────
  async function findOrCreateInstitution(name: string) {
    const existing = await prisma.financialInstitution.findFirst({ where: { company_id: companyId, name } });
    if (existing) return existing;
    return prisma.financialInstitution.create({ data: { company_id: companyId, name, is_active: true } });
  }

  async function findOrCreateCard(name: string, limit: number) {
    const existing = await prisma.card.findFirst({ where: { company_id: companyId, name } });
    if (existing) return existing;
    return prisma.card.create({ data: { company_id: companyId, name, limit, closing_day: 5, due_day: 15 } });
  }

  async function findOrCreateCategory(name: string, type: 'INCOME' | 'EXPENSE') {
    const existing = await prisma.category.findFirst({ where: { company_id: companyId, name } });
    if (existing) return existing;
    return prisma.category.create({ data: { company_id: companyId, name, type } });
  }

  async function findOrCreateSubcategory(categoryId: string, name: string) {
    const existing = await prisma.subcategory.findFirst({ where: { company_id: companyId, category_id: categoryId, name } });
    if (existing) return existing;
    return prisma.subcategory.create({ data: { company_id: companyId, category_id: categoryId, name } });
  }

  async function findOrCreateCenter(name: string, type: 'INCOME' | 'EXPENSE') {
    const existing = await prisma.center.findFirst({ where: { company_id: companyId, name } });
    if (existing) return existing;
    return prisma.center.create({ data: { company_id: companyId, name, type } });
  }

  async function findOrCreateSupplier(legalName: string) {
    const existing = await prisma.supplier.findFirst({ where: { company_id: companyId, legal_name: legalName } });
    if (existing) return existing;
    return prisma.supplier.create({ data: { company_id: companyId, legal_name: legalName } });
  }

  // ─── Entidades base ─────────────────────────────────────────────────────────
  console.log('🏦 Criando instituições financeiras, cartões, categorias...');

  const institutions = await Promise.all([
    findOrCreateInstitution('Banco Itaú'),
    findOrCreateInstitution('Nubank'),
    findOrCreateInstitution('Banco Bradesco'),
  ]);

  const cardAdmin = await findOrCreateCard('Cartão Corporativo Nubank', 8000);
  const cardMarketing = await findOrCreateCard('Cartão Itaú Marketing', 4000);

  const catAluguéis = await findOrCreateCategory('Aluguéis Recebidos', 'INCOME');
  const catTaxaAdmin = await findOrCreateCategory('Taxas de Administração', 'INCOME');

  const catManutencao = await findOrCreateCategory('Manutenção de Imóveis', 'EXPENSE');
  const catImpostos = await findOrCreateCategory('Impostos e Taxas', 'EXPENSE');
  const catDespesasAdmin = await findOrCreateCategory('Despesas Administrativas', 'EXPENSE');
  const catMarketing = await findOrCreateCategory('Marketing e Publicidade', 'EXPENSE');

  const subReparoEletrico = await findOrCreateSubcategory(catManutencao.id, 'Reparos Elétricos');
  const subReparoHidraulico = await findOrCreateSubcategory(catManutencao.id, 'Reparos Hidráulicos');
  const subPintura = await findOrCreateSubcategory(catManutencao.id, 'Pintura e Acabamento');

  const subMaterialEscritorio = await findOrCreateSubcategory(catDespesasAdmin.id, 'Material de Escritório');
  const subSoftware = await findOrCreateSubcategory(catDespesasAdmin.id, 'Softwares e Assinaturas');

  const centerAdmin = await findOrCreateCenter('Centro Administrativo', 'EXPENSE');
  const centerComercial = await findOrCreateCenter('Centro Comercial', 'INCOME');

  const supplierConstrutora = await findOrCreateSupplier('Construtora Silva & Associados Ltda');
  const supplierTechSoft = await findOrCreateSupplier('TechSoft Soluções em Software Ltda');

  const expenseCategories = [catManutencao, catImpostos, catDespesasAdmin, catMarketing];

  // ─── Planejamento: 1 planning por categoria de despesa, com valor mensal
  // ligeiramente acima do que será realizado, para o gráfico "Realizado x
  // Planejado" mostrar barras com percentuais variados (não sempre 100%). ────
  console.log('📋 Criando planejamento (planned) para as categorias de despesa...');

  const PLANNED_MONTHLY: Record<string, number> = {
    [catManutencao.id]: 3200,
    [catImpostos.id]: 1800,
    [catDespesasAdmin.id]: 1400,
    [catMarketing.id]: 1100,
  };

  for (const cat of expenseCategories) {
    let planning = await prisma.planning.findFirst({
      where: { company_id: companyId, category_id: cat.id, subcategory_id: null },
    });
    if (!planning) {
      planning = await prisma.planning.create({
        data: { company_id: companyId, category_id: cat.id, type: 'VARIABLE', default_amount: PLANNED_MONTHLY[cat.id] },
      });
    }
    for (const month of MONTHS) {
      await prisma.planningMonth.upsert({
        where: { planning_id_month: { planning_id: planning.id, month } },
        update: { amount: PLANNED_MONTHLY[cat.id] },
        create: { planning_id: planning.id, month, amount: PLANNED_MONTHLY[cat.id] },
      });
    }
  }

  // ─── Lançamentos: limpa só os das categorias que este script gerencia, para
  // reexecuções não acumularem duplicados (não mexe em outras categorias). ───
  console.log('🧹 Limpando lançamentos anteriores destas categorias (reexecução idempotente)...');
  const managedCategoryIds = [catAluguéis.id, catTaxaAdmin.id, ...expenseCategories.map((c) => c.id)];
  await prisma.transaction.deleteMany({ where: { company_id: companyId, category_id: { in: managedCategoryIds } } });

  console.log('💰 Gerando lançamentos para 24 meses (2025 e 2026)...');

  let seed = 0;
  let created = 0;

  for (const year of YEARS) {
    for (const month of MONTHS) {
      seed++;

      // Receitas: 3 aluguéis + 1 taxa de administração por mês.
      for (let i = 0; i < 3; i++) {
        await prisma.transaction.create({
          data: {
            company_id: companyId,
            event_date: dateUTC(year, month, 5 + i),
            effective_date: dateUTC(year, month, 5 + i),
            description: `Aluguel recebido - Imóvel ${i + 1} - ${month}/${year}`,
            amount: rand(2500, 6000),
            status: 'COMPLETED',
            category_id: catAluguéis.id,
            financial_institution_id: pick(institutions, seed + i).id,
            center_id: centerComercial.id,
          },
        });
      }
      await prisma.transaction.create({
        data: {
          company_id: companyId,
          event_date: dateUTC(year, month, 10),
          effective_date: dateUTC(year, month, 10),
          description: `Taxa de administração - ${month}/${year}`,
          amount: rand(800, 1500),
          status: 'COMPLETED',
          category_id: catTaxaAdmin.id,
          financial_institution_id: pick(institutions, seed).id,
          center_id: centerComercial.id,
        },
      });

      // Despesas: manutenção (2, rotacionando subcategorias + fornecedor)
      const manutencaoSubs = [subReparoEletrico, subReparoHidraulico, subPintura];
      for (let i = 0; i < 2; i++) {
        await prisma.transaction.create({
          data: {
            company_id: companyId,
            event_date: dateUTC(year, month, 12 + i),
            effective_date: dateUTC(year, month, 12 + i),
            description: `Manutenção - ${manutencaoSubs[(seed + i) % manutencaoSubs.length].name} - ${month}/${year}`,
            amount: rand(300, 1200),
            status: 'COMPLETED',
            category_id: catManutencao.id,
            subcategory_id: manutencaoSubs[(seed + i) % manutencaoSubs.length].id,
            financial_institution_id: pick(institutions, seed + i + 1).id,
            center_id: centerAdmin.id,
            supplier_id: supplierConstrutora.id,
          },
        });
      }

      // Impostos e taxas (1)
      await prisma.transaction.create({
        data: {
          company_id: companyId,
          event_date: dateUTC(year, month, 15),
          effective_date: dateUTC(year, month, 15),
          description: `Impostos e taxas - ${month}/${year}`,
          amount: rand(600, 1500),
          status: 'COMPLETED',
          category_id: catImpostos.id,
          financial_institution_id: pick(institutions, seed + 2).id,
          center_id: centerAdmin.id,
        },
      });

      // Despesas administrativas: material de escritório + software (no cartão admin)
      await prisma.transaction.create({
        data: {
          company_id: companyId,
          event_date: dateUTC(year, month, 18),
          effective_date: dateUTC(year, month, 18),
          description: `Material de escritório - ${month}/${year}`,
          amount: rand(150, 500),
          status: 'COMPLETED',
          category_id: catDespesasAdmin.id,
          subcategory_id: subMaterialEscritorio.id,
          financial_institution_id: pick(institutions, seed).id,
          center_id: centerAdmin.id,
        },
      });
      await prisma.transaction.create({
        data: {
          company_id: companyId,
          event_date: dateUTC(year, month, 20),
          effective_date: dateUTC(year, month, 20),
          description: `Assinatura de software - ${month}/${year}`,
          amount: rand(200, 600),
          status: 'COMPLETED',
          category_id: catDespesasAdmin.id,
          subcategory_id: subSoftware.id,
          financial_institution_id: pick(institutions, seed + 1).id,
          card_id: cardAdmin.id,
          center_id: centerAdmin.id,
          supplier_id: supplierTechSoft.id,
        },
      });

      // Marketing (1, no cartão de marketing)
      await prisma.transaction.create({
        data: {
          company_id: companyId,
          event_date: dateUTC(year, month, 25),
          effective_date: dateUTC(year, month, 25),
          description: `Marketing e publicidade - ${month}/${year}`,
          amount: rand(200, 900),
          status: 'COMPLETED',
          category_id: catMarketing.id,
          financial_institution_id: pick(institutions, seed + 2).id,
          card_id: cardMarketing.id,
          center_id: centerAdmin.id,
        },
      });

      created += 8;
    }
  }

  console.log(`✅ ${created} lançamentos criados, cobrindo Jan a Dez de 2025 e 2026.`);
  console.log('\n🎉 Mock financeiro pronto!');
  console.log('--------------------------------------------------');
  console.log(`Empresa:         ${company.name} (${companyId})`);
  console.log('Período:         Jan/2025 a Dez/2026 (24 meses, todos com dados)');
  console.log('Instituições:    Banco Itaú, Nubank, Banco Bradesco');
  console.log('Cartões:         Cartão Corporativo Nubank, Cartão Itaú Marketing');
  console.log('Categorias:      Aluguéis Recebidos, Taxas de Administração (receita)');
  console.log('                 Manutenção de Imóveis, Impostos e Taxas,');
  console.log('                 Despesas Administrativas, Marketing e Publicidade (despesa)');
  console.log('Planejamento:    1 planning por categoria de despesa, 12 meses cada');
  console.log('--------------------------------------------------\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Erro ao gerar mock financeiro:', e);
  process.exit(1);
});
