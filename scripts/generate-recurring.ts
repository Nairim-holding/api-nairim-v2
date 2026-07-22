/**
 * Serviço de manutenção de recorrências (Fase 3).
 *
 * Estende TODAS as recorrências ativas para manter sempre ~5 anos de
 * lançamentos à frente. Idempotente — reexecuções NÃO duplicam (protegido pelo
 * unique [recurring_group_id, occurrence_number] + skipDuplicates).
 *
 * Uso (manual ou via cron do SO/Docker):
 *   npm run generate-recurring
 *
 * Exemplo de cron (rodar todo dia 1º às 03:00):
 *   0 3 1 * *  cd /app && npm run generate-recurring
 *
 * Roda sem contexto de tenant → processa recorrências de todas as empresas.
 */
import 'dotenv/config';
import { RecurringService } from '../src/services/RecurringService';
import prisma from '../src/lib/prisma';

async function main() {
  console.log('🔁 Manutenção de recorrências: iniciando...');
  const result = await RecurringService.extendActiveRecurrences();
  console.log(
    `✅ Manutenção concluída: ${result.totalGenerated} lançamentos gerados em ${result.configs} recorrências ativas.`,
  );
  for (const d of result.details) {
    console.log(`   • ${d.recurring_group_id}: +${d.generated}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Falha na manutenção de recorrências:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
