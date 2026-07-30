// src/controller/DashboardController.ts
import { Request, Response } from "express";
import { DashboardService } from "../services/DashboardService";
import { StorageUsageService } from "../services/StorageUsageService";
import { DatabaseUsageService } from "../services/DatabaseUsageService";
import { getCurrentCompanyId } from "../lib/tenantContext";
import { ApiResponse } from "../utils/api-response";

export class DashboardController {
  /**
   * Consumo de banco de dados da empresa (usado/contratado). Medição somente
   * leitura; não recebe período.
   */
  static async getDatabaseUsage(req: Request, res: Response) {
    try {
      const companyId = getCurrentCompanyId();

      if (!companyId) {
        return res.status(403).json(
          ApiResponse.error("Contexto de empresa não identificado.")
        );
      }

      const forceRefresh = req.query.refresh === "true" || req.query.refresh === "1";
      const usage = await DatabaseUsageService.getDatabaseUsage(companyId, forceRefresh);

      return res.status(200).json(
        ApiResponse.success(usage, "Database usage retrieved successfully")
      );

    } catch (error: any) {
      console.error('❌ Error in DashboardController.getDatabaseUsage:', error);
      return res.status(500).json(
        ApiResponse.error(error.message || "Erro ao buscar consumo de banco de dados")
      );
    }
  }

  /**
   * Espaço ocupado pelos anexos/mídias da empresa, por local de armazenamento.
   * Não recebe período: é uma foto do storage hoje, não uma série temporal.
   */
  static async getStorage(req: Request, res: Response) {
    try {
      const companyId = getCurrentCompanyId();

      if (!companyId) {
        return res.status(403).json(
          ApiResponse.error("Contexto de empresa não identificado.")
        );
      }

      const forceRefresh = req.query.refresh === "true" || req.query.refresh === "1";
      const usage = await StorageUsageService.getStorageUsage(companyId, forceRefresh);

      return res.status(200).json(
        ApiResponse.success(usage, "Storage usage retrieved successfully")
      );

    } catch (error: any) {
      console.error('❌ Error in DashboardController.getStorage:', error);
      return res.status(500).json(
        ApiResponse.error(error.message || "Erro ao buscar consumo de armazenamento")
      );
    }
  }

  static async getFinancial(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json(
          ApiResponse.error("startDate e endDate são obrigatórios")
        );
      }

      const metrics = await DashboardService.getFinancialMetrics(
        new Date(startDate as string),
        new Date(endDate as string)
      );

      return res.status(200).json(
        ApiResponse.success(metrics, "Financial metrics retrieved successfully")
      );

    } catch (error: any) {
      console.error('❌ Error in DashboardController.getFinancial:', error);
      return res.status(500).json(
        ApiResponse.error(error.message || "Erro ao buscar métricas financeiras")
      );
    }
  }

  static async getPortfolio(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json(
          ApiResponse.error("startDate e endDate são obrigatórios")
        );
      }

      const metrics = await DashboardService.getPortfolioMetrics(
        new Date(startDate as string),
        new Date(endDate as string)
      );

      return res.status(200).json(
        ApiResponse.success(metrics, "Portfolio metrics retrieved successfully")
      );

    } catch (error: any) {
      console.error('❌ Error in DashboardController.getPortfolio:', error);
      return res.status(500).json(
        ApiResponse.error(error.message || "Erro ao buscar métricas do portfólio")
      );
    }
  }

  static async getClients(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json(
          ApiResponse.error("startDate e endDate são obrigatórios")
        );
      }

      const metrics = await DashboardService.getClientsMetrics(
        new Date(startDate as string),
        new Date(endDate as string)
      );

      return res.status(200).json(
        ApiResponse.success(metrics, "Clients metrics retrieved successfully")
      );

    } catch (error: any) {
      console.error('❌ Error in DashboardController.getClients:', error);
      return res.status(500).json(
        ApiResponse.error(error.message || "Erro ao buscar métricas de clientes")
      );
    }
  }

  /** Distribuição das locações por faixa de tempo de permanência do inquilino. */
  static async getTenantTenure(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json(
          ApiResponse.error("startDate e endDate são obrigatórios")
        );
      }

      const distribution = await DashboardService.getTenantTenureDistribution(
        new Date(startDate as string),
        new Date(endDate as string)
      );

      return res.status(200).json(
        ApiResponse.success(distribution, "Tenant tenure distribution retrieved successfully")
      );

    } catch (error: any) {
      console.error('❌ Error in DashboardController.getTenantTenure:', error);
      return res.status(500).json(
        ApiResponse.error(error.message || "Erro ao buscar tempo de permanência dos inquilinos")
      );
    }
  }

  static async getMap(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json(
          ApiResponse.error("startDate e endDate são obrigatórios")
        );
      }

      const geoloc = await DashboardService.getGeolocation(
        new Date(startDate as string),
        new Date(endDate as string)
      );

      return res.status(200).json(
        ApiResponse.success(geoloc, "Geolocation data retrieved successfully")
      );

    } catch (error: any) {
      console.error('❌ Error in DashboardController.getMap:', error);
      return res.status(500).json(
        ApiResponse.error(error.message || "Erro ao buscar dados de geolocalização")
      );
    }
  }

  // Método completo para compatibilidade (opcional)
  static async getAll(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json(
          ApiResponse.error("startDate e endDate são obrigatórios")
        );
      }

      const [financial, portfolio, clients, map] = await Promise.all([
        DashboardService.getFinancialMetrics(
          new Date(startDate as string),
          new Date(endDate as string)
        ),
        DashboardService.getPortfolioMetrics(
          new Date(startDate as string),
          new Date(endDate as string)
        ),
        DashboardService.getClientsMetrics(
          new Date(startDate as string),
          new Date(endDate as string)
        ),
        DashboardService.getGeolocation(
          new Date(startDate as string),
          new Date(endDate as string)
        )
      ]);

      return res.status(200).json(
        ApiResponse.success({
          financial,
          portfolio,
          clients,
          map
        }, "Dashboard data retrieved successfully")
      );

    } catch (error: any) {
      console.error('❌ Error in DashboardController.getAll:', error);
      return res.status(500).json(
        ApiResponse.error(error.message || "Erro ao buscar todos os dados do dashboard")
      );
    }
  }
}