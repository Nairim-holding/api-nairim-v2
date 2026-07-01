import { randomUUID } from 'crypto';
import prisma from '../lib/prisma';
import { parseLocalDate } from '../utils/date-utils';

/**
 * Serviço de Transferências entre Contas.
 *
 * Conceito: uma transferência é um par de lançamentos espelhados — uma SAÍDA na
 * conta de origem e uma ENTRADA na conta de destino — de mesmo valor. O dinheiro
 * não sai do total: apenas migra de uma instituição financeira para outra.
 *
 * Fase 1: garante a existência das duas categorias INTERNAS de sistema usadas
 * pelas pernas da transferência. Seguem o mesmo padrão lazy "find-or-create" por
 * empresa adotado para "Pagamento de Cartão" (ver InvoiceService).
 */
export class TransferService {
  /** Nomes canônicos das categorias internas de transferência. */
  static readonly OUTFLOW_CATEGORY_NAME = 'Transferência entre Contas – Saída';
  static readonly INFLOW_CATEGORY_NAME = 'Transferência entre Contas – Entrada';

  /**
   * Garante que as duas categorias internas de transferência existam para a
   * empresa. Idempotente: cria apenas o que faltar e retorna ambas.
   */
  static async ensureTransferCategories(company_id: string) {
    const outflow = await this.findOrCreateSystemCategory(
      this.OUTFLOW_CATEGORY_NAME,
      'EXPENSE',
      company_id
    );
    const inflow = await this.findOrCreateSystemCategory(
      this.INFLOW_CATEGORY_NAME,
      'INCOME',
      company_id
    );

    return { outflow, inflow };
  }

  private static async findOrCreateSystemCategory(
    name: string,
    type: 'INCOME' | 'EXPENSE',
    company_id: string
  ) {
    let category = await prisma.category.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        type,
        company_id,
        deleted_at: null,
      },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name,
          type,
          is_system: true,
          company: { connect: { id: company_id } },
        },
      });
    }

    return category;
  }

  /**
   * Cria uma transferência entre contas: o lançamento de origem (como o usuário
   * informou) + o lançamento espelho gerado automaticamente na conta de destino,
   * com a categoria oposta. Ambos compartilham um `transfer_group_id`, recebem
   * `is_transfer: true` e copiam datas/status/valor da origem. Saldo global neutro.
   */
  static async createTransfer(data: any, company_id: string) {
    const originInstitutionId = data.financial_institution_id;
    const destinationInstitutionId = data.destination_institution_id;

    if (!originInstitutionId) throw new Error('Instituição de origem é obrigatória.');
    if (!destinationInstitutionId) throw new Error('Instituição de destino é obrigatória.');
    if (String(originInstitutionId) === String(destinationInstitutionId)) {
      throw new Error('A conta de destino deve ser diferente da conta de origem.');
    }

    const amount = Number(data.amount);
    if (!amount || amount <= 0) throw new Error('Valor da transferência deve ser maior que zero.');

    // Garante e resolve as categorias internas de transferência.
    const { outflow, inflow } = await this.ensureTransferCategories(company_id);

    // A categoria escolhida pelo usuário define o tipo da perna de origem.
    let mirrorCategoryId: string;
    if (String(data.category_id) === String(outflow.id)) {
      mirrorCategoryId = inflow.id; // origem = saída → espelho = entrada
    } else if (String(data.category_id) === String(inflow.id)) {
      mirrorCategoryId = outflow.id; // origem = entrada → espelho = saída
    } else {
      throw new Error('Categoria de transferência inválida.');
    }

    // Valida que as instituições existem e pertencem à empresa.
    const [originInst, destinationInst] = await Promise.all([
      prisma.financialInstitution.findFirst({
        where: { id: originInstitutionId, company_id, deleted_at: null },
      }),
      prisma.financialInstitution.findFirst({
        where: { id: destinationInstitutionId, company_id, deleted_at: null },
      }),
    ]);
    if (!originInst) throw new Error('Conta de origem não encontrada.');
    if (!destinationInst) throw new Error('Conta de destino não encontrada.');

    const transferGroupId = randomUUID();
    const eventDate = parseLocalDate(data.event_date);
    const effectiveDate = parseLocalDate(data.effective_date);
    const status = data.status || 'COMPLETED';
    const baseDescription = String(data.description ?? '').trim();
    const parseFK = (val: any) => (val === '' || val === 'null' || !val ? null : val);
    const centerId = parseFK(data.center_id);

    const mirrorDescription = baseDescription
      ? `${baseDescription} – Origem conta ${originInst.name}`
      : `Transferência – Origem conta ${originInst.name}`;

    const [origin, mirror] = await prisma.$transaction([
      // Perna de origem (como o usuário informou).
      prisma.transaction.create({
        data: {
          event_date: eventDate,
          effective_date: effectiveDate,
          description: baseDescription,
          amount,
          status,
          category_id: data.category_id,
          financial_institution_id: originInstitutionId,
          center_id: centerId,
          is_transfer: true,
          transfer_group_id: transferGroupId,
          company_id,
        },
        include: { category: true, financial_institution: true },
      }),
      // Perna espelho gerada automaticamente na conta de destino.
      prisma.transaction.create({
        data: {
          event_date: eventDate,
          effective_date: effectiveDate,
          description: mirrorDescription,
          amount,
          status,
          category_id: mirrorCategoryId,
          financial_institution_id: destinationInstitutionId,
          center_id: centerId,
          is_transfer: true,
          transfer_group_id: transferGroupId,
          company_id,
        },
        include: { category: true, financial_institution: true },
      }),
    ]);

    return { transfer_group_id: transferGroupId, origin, mirror };
  }
}
