/**
 * Backfill das descrições dos lançamentos de ALUGUEL gerados por locações.
 *
 * Reescreve a descrição das receitas de aluguel já lançadas para o novo padrão:
 *   "Aluguel do imóvel XX/XX – nome do inquilino – Contrato XXXX/XX"
 *
 * Só toca em transações de aluguel vinculadas a uma locação (lease_id != null e
 * description começando com "Aluguel"). Comissão e IPTU NÃO são alterados.
 * É idempotente: rodar de novo não muda nada já no formato correto.
 *
 * Uso:
 *   tsx scripts/backfill-lease-rent-descriptions.ts            # dry-run (apenas mostra)
 *   tsx scripts/backfill-lease-rent-descriptions.ts --apply    # aplica de fato
 *   npm run db:backfill-rent-descriptions -- --apply
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const APPLY = process.argv.includes('--apply');

/** Monta a descrição no padrão novo. */
function buildDescription(
  num: number,
  total: number,
  tenantName: string,
  contractNumber: string,
): string {
  return `Aluguel do imóvel ${num}/${total} – ${tenantName} – Contrato ${contractNumber}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL não configurado no .env');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log(`🔄 Modo: ${APPLY ? 'APLICAR (escreve no banco)' : 'DRY-RUN (somente leitura)'}`);

  // 1. Transações de aluguel geradas por locação.
  const rentTxs = await prisma.transaction.findMany({
    where: {
      lease_id: { not: null },
      deleted_at: null,
      description: { startsWith: 'Aluguel' },
    },
    select: {
      id: true,
      description: true,
      installment_number: true,
      total_installments: true,
      lease_id: true,
    },
  });

  console.log(`📋 ${rentTxs.length} transações de aluguel encontradas.`);
  if (rentTxs.length === 0) {
    await prisma.$disconnect();
    return;
  }

  // 2. Carrega as locações referenciadas (contrato + nome do inquilino) num map.
  const leaseIds = Array.from(new Set(rentTxs.map((t) => t.lease_id!).filter(Boolean)));
  const leases = await prisma.lease.findMany({
    where: { id: { in: leaseIds } },
    select: { id: true, contract_number: true, tenant: { select: { name: true } } },
  });
  const leaseMap = new Map(leases.map((l) => [l.id, l]));

  let updated = 0;
  let skipped = 0;
  let unresolved = 0;

  for (const tx of rentTxs) {
    const lease = tx.lease_id ? leaseMap.get(tx.lease_id) : null;
    if (!lease) {
      unresolved++;
      continue;
    }

    // Parcela: usa os campos persistidos; se ausentes, tenta extrair "X/Y" da descrição antiga.
    let num = tx.installment_number ?? 0;
    let total = tx.total_installments ?? 0;
    if (!num || !total) {
      const m = tx.description.match(/(\d+)\s*\/\s*(\d+)/);
      if (m) {
        num = num || parseInt(m[1], 10);
        total = total || parseInt(m[2], 10);
      }
    }
    if (!num || !total) {
      unresolved++;
      console.warn(`⚠️  Sem nº de parcela: ${tx.id} — "${tx.description}"`);
      continue;
    }

    const tenantName = lease.tenant?.name ?? 'Inquilino';
    const newDescription = buildDescription(num, total, tenantName, lease.contract_number);

    if (newDescription === tx.description) {
      skipped++;
      continue;
    }

    if (APPLY) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { description: newDescription },
      });
    } else {
      console.log(`  "${tx.description}"\n→ "${newDescription}"`);
    }
    updated++;
  }

  console.log('─────────────────────────────────────────────');
  console.log(`✅ ${APPLY ? 'Atualizadas' : 'Seriam atualizadas'}: ${updated}`);
  console.log(`⏭️  Já no formato correto (puladas): ${skipped}`);
  if (unresolved > 0) console.log(`⚠️  Não resolvidas (sem locação/parcela): ${unresolved}`);
  if (!APPLY) console.log('\nDry-run. Rode novamente com --apply para gravar as alterações.');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Erro no backfill:', e);
  process.exit(1);
});
