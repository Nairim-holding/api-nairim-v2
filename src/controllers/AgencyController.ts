import { Request, Response } from 'express';
import { AgencyService } from '../services/AgencyService';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { AgencyValidator } from '../lib/validators/agency';

export class AgencyController {
  static async getAgencies(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 10);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      const sortOptions = {
        sort_id: ValidationUtil.parseStringParam(req.query?.sort_id),
        sort_trade_name: ValidationUtil.parseStringParam(req.query?.sort_trade_name),
        sort_legal_name: ValidationUtil.parseStringParam(req.query?.sort_legal_name),
        sort_cnpj: ValidationUtil.parseStringParam(req.query?.sort_cnpj),
        sort_state_registration: ValidationUtil.parseStringParam(req.query?.sort_state_registration),
        sort_municipal_registration: ValidationUtil.parseStringParam(req.query?.sort_municipal_registration),
        sort_license_number: ValidationUtil.parseStringParam(req.query?.sort_license_number),
      };

      const validation = AgencyValidator.validateQueryParams(req.query);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const result = await AgencyService.getAgencies({
        limit,
        page,
        search,
        sortOptions,
        includeInactive,
      });

      // Usar a nova estrutura com pagination
      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error getting agencies:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getAgencyById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }
      
      const agency = await AgencyService.getAgencyById(id);

      res.status(200).json(
        ApiResponse.success(agency, 'Agency retrieved successfully')
      );
    } catch (error: any) {
      if (error.message === 'Agency not found' || error.message === 'Agency not found or deleted') {
        return res.status(404).json(ApiResponse.error('Agency not found'));
      }
      console.error('Error getting agency:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createAgency(req: Request, res: Response) {
    try {
      const validation = AgencyValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const agency = await AgencyService.createAgency(req.body);

      res.status(201).json(
        ApiResponse.success(agency, `Agency ${agency.legal_name} created successfully`)
      );
    } catch (error: any) {
      console.error('Error creating agency:', error);

      if (error.message === 'CNPJ already registered' || error.message === 'CNPJ already exists') {
        return res.status(409).json(ApiResponse.error('CNPJ already registered'));
      }

      res.status(400).json(ApiResponse.error(`Error creating agency: ${error.message}`));
    }
  }

  static async updateAgency(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const validation = AgencyValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const agency = await AgencyService.updateAgency(id, req.body);

      res.status(200).json(
        ApiResponse.success(agency, `Agency ${agency.legal_name} updated successfully`)
      );
    } catch (error: any) {
      console.error('Error updating agency:', error);

      if (error.message === 'Agency not found') {
        return res.status(404).json(ApiResponse.error('Agency not found'));
      }

      if (error.message === 'CNPJ already registered for another agency' || error.message === 'CNPJ already used by another agency') {
        return res.status(409).json(ApiResponse.error('CNPJ already registered for another agency'));
      }

      res.status(400).json(ApiResponse.error(`Error updating agency: ${error.message}`));
    }
  }

  static async deleteAgency(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const agency = await AgencyService.deleteAgency(id);

      res.status(200).json(
        ApiResponse.success(null, `Agency ${agency.legal_name} marked as deleted successfully (soft delete)`)
      );
    } catch (error: any) {
      console.error('Error deleting agency:', error);

      if (error.message === 'Agency not found or already deleted') {
        return res.status(404).json(ApiResponse.error('Agency not found or already deleted'));
      }

      res.status(500).json(ApiResponse.error('Error deleting agency'));
    }
  }

  static async getAgencyFilters(req: Request, res: Response) {
    try {
      const filters = await AgencyService.getAgencyFilters();
      res.status(200).json(
        ApiResponse.success(filters, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('Error getting filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  // Método opcional para restaurar agência
  static async restoreAgency(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const agency = await AgencyService.restoreAgency(id);

      res.status(200).json(
        ApiResponse.success(null, `Agency ${agency.legal_name} restored successfully`)
      );
    } catch (error: any) {
      console.error('Error restoring agency:', error);

      if (error.message === 'Agency not found') {
        return res.status(404).json(ApiResponse.error('Agency not found'));
      }

      if (error.message === 'Agency is not deleted') {
        return res.status(400).json(ApiResponse.error('Agency is not deleted'));
      }

      res.status(500).json(ApiResponse.error('Error restoring agency'));
    }
  }
}