/**
 * Migração dos lançamentos de IPTU (Crédito) já gerados por locações para o novo
 * padrão de RESTITUIÇÃO DE IPTU.
 *
 * O que faz em cada transação de IPTU vinculada a uma locação
 * (lease_id != null, description começando com "IPTU", não é encargo de
 * cancelamento e não está deletada):
 *   1. Reescreve a descrição trocando APENAS o prefixo "IPTU" -> "Restituição IPTU"
 *      (mantém parcela/total, contrato e o restante idênticos).
 *   2. Se o IMÓVEL da locação tiver os campos de Restituição preenchidos
 *      (iptu_refund_category_id), passa a transação a usar essa
 *      categoria/subcategoria de Restituição. Se NÃO tiver (campos opcionais),
 *      mantém a categoria/subcategoria atual — só renomeia a descrição.
 *
 * Por que é necessário: a geração passou a usar o prefixo "Restituição IPTU" e a
 * chave de idempotência do sync olha a 1ª palavra da descrição. Sem renomear os
 * antigos ("IPTU ..."), um novo sync não os reconhece e cria duplicatas.
 *
 * É idempotente: rodar de novo não muda nada já no formato correto.
 * Alcança TODAS as empresas e tanto PENDING quanto COMPLETED (histórico).
 *
 * Uso:
 *   tsx scripts/migrate-iptu-refund-transactions.ts            # dry-run (apenas mostra)
 *   tsx scripts/migrate-iptu-refund-transactions.ts --apply    # aplica de fato
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const APPLY = process.argv.includes('--apply');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL não configurado no .env');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log(`🔄 Modo: ${APPLY ? 'APLICAR (escreve no banco)' : 'DRY-RUN (somente leitura)'}`);

  // 1. Transações de IPTU geradas por locação, ainda no padrão antigo.
  //    startsWith 'IPTU' não casa com 'Restituição IPTU' — logo já ignora as novas.
  const iptuTxs = await prisma.transaction.findMany({
    where: {
      lease_id: { not: null },
      deleted_at: null,
      is_cancellation_charge: false,
      description: { startsWith: 'IPTU' },
    },
    select: {
      id: true,
      description: true,
      category_id: true,
      subcategory_id: true,
      lease_id: true,
    },
  });

  console.log(`📋 ${iptuTxs.length} transações de IPTU (padrão antigo) encontradas.`);
  if (iptuTxs.length === 0) {
    await prisma.$disconnect();
    return;
  }

  // 2. Carrega as locações -> imóvel (campos de restituição) num map.
  const leaseIds = Array.from(new Set(iptuTxs.map((t) => t.lease_id!).filter(Boolean)));
  const leases = await prisma.lease.findMany({
    where: { id: { in: leaseIds } },
    select: {
      id: true,
      property: {
        select: { iptu_refund_category_id: true, iptu_refund_subcategory_id: true },
      },
    },
  });
  const leaseMap = new Map(leases.map((l) => [l.id, l]));

  let renamedOnly = 0;
  let recategorized = 0;
  let skipped = 0;
  let unresolved = 0;

  for (const tx of iptuTxs) {
    const lease = tx.lease_id ? leaseMap.get(tx.lease_id) : null;
    if (!lease) {
      unresolved++;
      continue;
    }

    // Descrição: troca só o prefixo "IPTU" -> "Restituição IPTU".
    const newDescription = tx.description.replace(/^IPTU\b/, 'Restituição IPTU');

    // Categoria/subcategoria: usa as de restituição do imóvel se definidas; senão mantém.
    const refundCat = lease.property?.iptu_refund_category_id ?? null;
    const refundSub = refundCat ? (lease.property?.iptu_refund_subcategory_id ?? null) : null;

    const willRecategorize = refundCat != null && refundCat !== tx.category_id;
    const newCategoryId = refundCat ?? tx.category_id;
    const newSubcategoryId = refundCat ? refundSub : tx.subcategory_id;

    const descChanged = newDescription !== tx.description;
    if (!descChanged && !willRecategorize) {
      skipped++;
      continue;
    }

    if (APPLY) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          description: newDescription,
          category_id: newCategoryId,
          subcategory_id: newSubcategoryId,
        },
      });
    } else {
      console.log(
        `  "${tx.description}"\n→ "${newDescription}"` +
          (willRecategorize ? `  [categoria: ${tx.category_id} → ${newCategoryId}]` : ''),
      );
    }

    if (willRecategorize) recategorized++;
    else renamedOnly++;
  }

  console.log('─────────────────────────────────────────────');
  console.log(`✅ ${APPLY ? 'Recategorizadas' : 'Seriam recategorizadas'} (imóvel c/ Restituição definida): ${recategorized}`);
  console.log(`✏️  ${APPLY ? 'Só renomeadas' : 'Só seriam renomeadas'} (imóvel sem Restituição — mantém categoria): ${renamedOnly}`);
  console.log(`⏭️  Já no formato correto (puladas): ${skipped}`);
  if (unresolved > 0) console.log(`⚠️  Não resolvidas (sem locação/imóvel): ${unresolved}`);
  if (!APPLY) console.log('\nDry-run. Rode novamente com --apply para gravar as alterações.');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Erro na migração de IPTU:', e);
  process.exit(1);
});
