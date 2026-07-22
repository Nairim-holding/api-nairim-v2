/**
 * Backfill idempotente: atribui um `installment_group_id` compartilhado às
 * parcelas (payment_mode='PARCELADO') criadas antes da introdução do campo.
 *
 * Agrupa por assinatura em comum da série:
 *   purchase_date + total_installments + category_id +
 *   financial_institution_id + descrição-base (sem o sufixo " - Parcela N/M"
 *   ou " - Receita N/M") + company_id
 *
 * Só toca em parcelas com installment_group_id NULL — rodar de novo é seguro.
 *
 * Uso: npx tsx prisma/backfillInstallmentGroups.ts
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Remove o sufixo de numeração (" - Parcela 3/12", " - Receita 3/12") para
// obter a descrição-base compartilhada por toda a série.
function baseDescription(description: string | null): string {
  if (!description) return '';
  return description.replace(/\s*-\s*(Parcela|Receita)\s+\d+\/\d+\s*$/i, '').trim();
}

function toDayKey(date: Date | null): string {
  if (!date) return 'null';
  return date.toISOString().slice(0, 10);
}

async function main() {
  const pending = await prisma.transaction.findMany({
    where: {
      payment_mode: 'PARCELADO',
      installment_group_id: null,
      deleted_at: null,
    },
    select: {
      id: true,
      description: true,
      purchase_date: true,
      total_installments: true,
      category_id: true,
      financial_institution_id: true,
      company_id: true,
    },
  });

  console.log(`Parcelas sem grupo encontradas: ${pending.length}`);
  if (pending.length === 0) {
    console.log('Nada a fazer.');
    return;
  }

  // Agrupa por assinatura.
  const groups = new Map<string, string[]>();
  for (const t of pending) {
    const signature = [
      t.company_id,
      t.category_id,
      t.financial_institution_id ?? 'null',
      t.total_installments ?? 'null',
      toDayKey(t.purchase_date),
      baseDescription(t.description),
    ].join('||');

    const arr = groups.get(signature) ?? [];
    arr.push(t.id);
    groups.set(signature, arr);
  }

  console.log(`Séries identificadas: ${groups.size}`);

  let updated = 0;
  for (const ids of groups.values()) {
    const groupId = randomUUID();
    const res = await prisma.transaction.updateMany({
      where: { id: { in: ids } },
      data: { installment_group_id: groupId },
    });
    updated += res.count;
  }

  console.log(`Parcelas atualizadas: ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
