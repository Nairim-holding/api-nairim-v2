// src/controller/DashboardController.ts
import { Request, Response } from "express";
import { DashboardService } from "../services/DashboardService";
import { ApiResponse } from "../utils/api-response";

export class DashboardController {
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