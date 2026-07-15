import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { BackupService } from '../services/BackupService';
import prisma from '../lib/prisma';

export class BackupController {
  /**
   * Gera e envia o backup da empresa atual como um arquivo .json para download.
   * O corpo é o próprio backup (não embrulhado em ApiResponse) para que o arquivo
   * salvo seja diretamente o backup.
   */
  static async exportBackup(req: Request, res: Response) {
    try {
      const { company_id } = (req as any).user;
      if (!company_id) {
        return res.status(400).json(ApiResponse.error('Empresa não identificada na sessão'));
      }

      const backup = await BackupService.exportCompany(company_id);

      const slug = backup.meta.company_slug || 'empresa';
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `backup-nairim-${slug}-${stamp}.json`;

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(JSON.stringify(backup));
    } catch (error: any) {
      if (error.message === 'Company not found') {
        return res.status(404).json(ApiResponse.error('Empresa não encontrada'));
      }
      console.error('Erro ao gerar backup:', error);
      res.status(500).json(ApiResponse.error('Erro ao gerar backup'));
    }
  }

  /**
   * Restaura os dados da empresa a partir de um arquivo de backup.
   *
   * Corpo (multipart/form-data):
   * - file: o arquivo .json do backup
   * - confirmationName: o nome da empresa (confirmação explícita)
   *
   * Fluxo:
   * 1. Valida o arquivo (formatVersion, checksum)
   * 2. Confirma que o usuário digitou o nome correto da empresa
   * 3. Cria um backup automático do estado ATUAL (antes de deletar)
   * 4. Deleta todos os dados da empresa em ordem FK-safe
   * 5. Reinsere os dados do arquivo em ordem FK-safe
   *
   * Resposta:
   * - 200: Sucesso com meta do restore
   * - 400: Validação falhou (arquivo inválido, confirmação errada)
   * - 404: Empresa não encontrada
   * - 500: Erro ao restaurar (problema de banco de dados)
   */
  static async restoreBackup(req: Request, res: Response) {
    try {
      const { company_id } = (req as any).user;
      if (!company_id) {
        return res.status(400).json(ApiResponse.error('Empresa não identificada na sessão'));
      }

      const { confirmationName } = req.body;
      const file = (req as any).file;

      if (!file) {
        return res.status(400).json(ApiResponse.error('Nenhum arquivo de backup fornecido'));
      }

      if (!confirmationName || typeof confirmationName !== 'string') {
        return res.status(400).json(ApiResponse.error('Confirmação (nome da empresa) é obrigatória'));
      }

      // Parse JSON do arquivo
      let backupData: any;
      try {
        backupData = JSON.parse(file.buffer.toString('utf-8'));
      } catch (e) {
        return res.status(400).json(ApiResponse.error('Arquivo de backup não é um JSON válido'));
      }

      // Restaura (transação Prisma garante atomicidade)
      const result = await BackupService.restoreCompany(company_id, backupData, confirmationName);

      console.log(`✅ Restore concluído para ${result.company_name}:`, result.message);
      return res.status(200).json(
        ApiResponse.success(result, `Restauração concluída: ${result.message}`)
      );
    } catch (error: any) {
      console.error('❌ Erro ao restaurar backup:', error);

      // Mensagens de erro específicas (do BackupService.restoreCompany)
      if (error.message.includes('Company not found')) {
        return res.status(404).json(ApiResponse.error('Empresa não encontrada'));
      }
      if (error.message.includes('Confirmação inválida')) {
        return res.status(400).json(ApiResponse.error(error.message));
      }
      if (error.message.includes('Arquivo de backup inválido')) {
        return res.status(400).json(ApiResponse.error(error.message));
      }
      if (error.message.includes('Versão do backup incompatível')) {
        return res.status(400).json(ApiResponse.error(error.message));
      }
      if (error.message.includes('Backup não corresponde')) {
        return res.status(400).json(ApiResponse.error(error.message));
      }
      if (error.message.includes('Checksum')) {
        return res.status(400).json(ApiResponse.error(error.message));
      }

      // Erro genérico
      res.status(500).json(ApiResponse.error('Erro ao restaurar dados da empresa'));
    }
  }

  /**
   * Lista os backups automáticos (pré-restore) gravados no servidor para a
   * empresa atual. Cada restore gera um deles antes de substituir os dados.
   */
  static async listAutoBackups(req: Request, res: Response) {
    try {
      const { company_id } = (req as any).user;
      if (!company_id) {
        return res.status(400).json(ApiResponse.error('Empresa não identificada na sessão'));
      }

      const company = await prisma.company.findUnique({ where: { id: company_id } });
      if (!company) return res.status(404).json(ApiResponse.error('Empresa não encontrada'));

      const backups = BackupService.listAutoBackups(company.slug);
      return res.status(200).json(ApiResponse.success(backups, 'Backups automáticos listados'));
    } catch (error: any) {
      console.error('Erro ao listar backups automáticos:', error);
      res.status(500).json(ApiResponse.error('Erro ao listar backups automáticos'));
    }
  }

  /**
   * Baixa um backup automático específico (pelo nome do arquivo). Valida que o
   * arquivo pertence à empresa antes de servir (evita path traversal).
   */
  static async downloadAutoBackup(req: Request, res: Response) {
    try {
      const { company_id } = (req as any).user;
      if (!company_id) {
        return res.status(400).json(ApiResponse.error('Empresa não identificada na sessão'));
      }

      const company = await prisma.company.findUnique({ where: { id: company_id } });
      if (!company) return res.status(404).json(ApiResponse.error('Empresa não encontrada'));

      const filename = String(req.params.filename);
      const fullPath = BackupService.resolveAutoBackupPath(company.slug, filename);
      if (!fullPath) {
        return res.status(404).json(ApiResponse.error('Backup automático não encontrado'));
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.download(fullPath, filename);
    } catch (error: any) {
      console.error('Erro ao baixar backup automático:', error);
      res.status(500).json(ApiResponse.error('Erro ao baixar backup automático'));
    }
  }
}
