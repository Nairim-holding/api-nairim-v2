import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { IptuPropertyService } from '../services/IptuPropertyService';

export class IptuPropertyController {
  static async getIptuPropertyFilters(req: Request, res: Response) {
    try {
      const filters: Record<string, any> = {};
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
          try {
            const parsedValue = JSON.parse(value as string);
            filters[key] = (parsedValue && typeof parsedValue === 'object') ? parsedValue : value;
          } catch {
            filters[key] = value;
          }
        }
      });

      const filtersData = await IptuPropertyService.getIptuPropertyFilters(filters);
      res.status(200).json(ApiResponse.success(filtersData, 'Filtros de IPTU recuperados com sucesso'));
    } catch (error) {
      console.error('❌ Erro ao buscar filtros de IPTU:', error);
      res.status(500).json(ApiResponse.error('Erro interno do servidor'));
    }
  }
}
