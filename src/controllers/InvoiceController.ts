import { Request, Response } from 'express';
import { InvoiceService } from '../services/InvoiceService';

export class InvoiceController {
  
  // GET /financial-invoice?cardId=uuid&month=4&year=2026
  static async getInvoice(req: Request, res: Response) {
    try {
      const { cardId, month, year } = req.query;

      // Validações
      if (!cardId || !month || !year) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros obrigatórios: cardId, month, year'
        });
      }

      const monthNum = Number(month);
      const yearNum = Number(year);

      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(400).json({
          success: false,
          error: 'Mês inválido. Deve ser entre 1 e 12'
        });
      }

      if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        return res.status(400).json({
          success: false,
          error: 'Ano inválido'
        });
      }

      const invoice = await InvoiceService.getInvoice({
        cardId: String(cardId),
        month: monthNum,
        year: yearNum
      });

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Fatura não encontrada'
        });
      }

      return res.status(200).json({
        success: true,
        data: invoice
      });

    } catch (error: any) {
      console.error('Erro ao buscar fatura:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno ao buscar fatura'
      });
    }
  }

  // POST /financial-invoice
  static async createInvoice(req: Request, res: Response) {
    try {
      const { card_id, month, year, closing_date, due_date } = req.body;

      // Validações
      if (!card_id || month === undefined || year === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Campos obrigatórios: card_id, month, year'
        });
      }

      const monthNum = Number(month);
      const yearNum = Number(year);

      if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(400).json({
          success: false,
          error: 'Mês inválido. Deve ser entre 1 e 12'
        });
      }

      if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        return res.status(400).json({
          success: false,
          error: 'Ano inválido'
        });
      }

      const invoice = await InvoiceService.createInvoice({
        card_id,
        month: monthNum,
        year: yearNum,
        closing_date,
        due_date
      });

      return res.status(201).json({
        success: true,
        message: 'Fatura criada com sucesso',
        data: invoice
      });

    } catch (error: any) {
      console.error('Erro ao criar fatura:', error);
      
      if (error.message.includes('já existe')) {
        return res.status(409).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('não encontrado')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno ao criar fatura'
      });
    }
  }

  // PUT /financial-invoice/:id/status
  static async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      let { status, effective_date, paid_amount } = req.body;

      // Validar status
      if (!status || !['PENDING', 'COMPLETED'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Status inválido. Use: PENDING ou COMPLETED'
        });
      }

      const invoice = await InvoiceService.updateStatus(String(id), {
        status,
        effective_date,
        paid_amount
      });

      return res.status(200).json({
        success: true,
        message: `Status atualizado para ${status}`,
        data: invoice
      });

    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      
      if (error.message.includes('não encontrada')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      if (error.message.includes('Não é possível')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno ao atualizar status'
      });
    }
  }

  // GET /financial-invoice/:id/transactions
  static async getInvoiceTransactions(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const transactions = await InvoiceService.getInvoiceTransactions(String(id));

      return res.status(200).json({
        success: true,
        data: transactions
      });

    } catch (error: any) {
      console.error('Erro ao listar transações:', error);
      
      if (error.message.includes('não encontrada')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno ao listar transações'
      });
    }
  }

  // GET /financial-invoice/card/:cardId
  static async getInvoicesByCard(req: Request, res: Response) {
    try {
      const { cardId } = req.params;
      const { year } = req.query;

      const invoices = await InvoiceService.getInvoicesByCard(
        String(cardId), 
        year ? Number(year) : undefined
      );

      return res.status(200).json({
        success: true,
        data: invoices
      });

    } catch (error: any) {
      console.error('Erro ao listar faturas:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno ao listar faturas'
      });
    }
  }
}
