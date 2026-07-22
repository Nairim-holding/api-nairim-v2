import cron from 'node-cron';
import { RecurringService } from '../services/RecurringService';
import logger from './logger';

/**
 * Agendador embutido do serviço de manutenção de recorrências.
 *
 * Roda dentro do processo do server (que fica de pé 24/7). Diariamente estende
 * todas as recorrências ativas para manter sempre ~5 anos de lançamentos à
 * frente. Idempotente (unique + skipDuplicates) — rodar todo dia não duplica.
 *
 * O script manual `npm run generate-recurring` continua disponível como fallback.
 */

// Todos os dias às 03:00 (horário do servidor). Cron: min hora dia mês diaSem.
const SCHEDULE = process.env.RECURRING_CRON ?? '0 3 * * *';

let running = false;

async function runMaintenance(trigger: string) {
  if (running) {
    logger.warn('[recurring] Execução ignorada — já há uma manutenção em andamento');
    return;
  }
  running = true;
  try {
    logger.info(`[recurring] Manutenção iniciada (${trigger})`);
    const result = await RecurringService.extendActiveRecurrences();
    logger.info(
      `[recurring] Manutenção concluída: ${result.totalGenerated} lançamentos em ${result.configs} recorrências ativas`,
    );
  } catch (err) {
    logger.error('[recurring] Falha na manutenção de recorrências', err);
  } finally {
    running = false;
  }
}

export function startRecurringScheduler() {
  if (!cron.validate(SCHEDULE)) {
    logger.error(`[recurring] Expressão cron inválida: "${SCHEDULE}" — agendador NÃO iniciado`);
    return;
  }

  cron.schedule(SCHEDULE, () => {
    void runMaintenance(`cron ${SCHEDULE}`);
  });

  logger.info(`⏰ Agendador de recorrências ativo (cron: "${SCHEDULE}")`);

  // Executa uma vez no boot para cobrir o tempo em que o server ficou parado
  // (não bloqueia a inicialização do server).
  void runMaintenance('boot');
}
