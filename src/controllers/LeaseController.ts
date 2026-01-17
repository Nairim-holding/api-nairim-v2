import { Request, Response } from 'express';
import { LeaseService } from '../services/LeaseService';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { LeaseValidator } from '../lib/validators/lease';

export class LeaseController {
  static async getLeases(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 10);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      const sortOptions = {
        sort_id: ValidationUtil.parseStringParam(req.query?.sort_id),
        sort_contract_number: ValidationUtil.parseStringParam(req.query?.sort_contract_number),
        sort_start_date: ValidationUtil.parseStringParam(req.query?.sort_start_date),
        sort_end_date: ValidationUtil.parseStringParam(req.query?.sort_end_date),
        sort_rent_amount: ValidationUtil.parseStringParam(req.query?.sort_rent_amount),
        sort_condominium_fee: ValidationUtil.parseStringParam(req.query?.sort_condominium_fee),
        sort_iptu: ValidationUtil.parseStringParam(req.query?.sort_iptu),
        sort_extra_fees: ValidationUtil.parseStringParam(req.query?.sort_extra_fees),
        sort_commission_value: ValidationUtil.parseStringParam(req.query?.sort_commission_value),
        sort_rent_due_day: ValidationUtil.parseStringParam(req.query?.sort_rent_due_day),
        sort_tax_due_day: ValidationUtil.parseStringParam(req.query?.sort_tax_due_day),
        sort_condo_due_day: ValidationUtil.parseStringParam(req.query?.sort_condo_due_day),
        sort_property: ValidationUtil.parseStringParam(req.query?.sort_property),
        sort_type: ValidationUtil.parseStringParam(req.query?.sort_type),
        sort_owner: ValidationUtil.parseStringParam(req.query?.sort_owner),
        sort_tenant: ValidationUtil.parseStringParam(req.query?.sort_tenant),
      };

      const validation = LeaseValidator.validateQueryParams(req.query);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const result = await LeaseService.getLeases({
        limit,
        page,
        search,
        sortOptions,
        includeInactive,
      });

      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error getting leases:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getLeaseById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }
      
      const lease = await LeaseService.getLeaseById(id);

      res.status(200).json(
        ApiResponse.success(lease, 'Lease retrieved successfully')
      );
    } catch (error: any) {
      if (error.message === 'Lease not found') {
        return res.status(404).json(ApiResponse.error('Lease not found'));
      }
      console.error('Error getting lease:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createLease(req: Request, res: Response) {
    try {
      const validation = LeaseValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const lease = await LeaseService.createLease(req.body);

      res.status(201).json(
        ApiResponse.success(lease, `Lease ${lease.contract_number} created successfully`)
      );
    } catch (error: any) {
      console.error('Error creating lease:', error);
      res.status(400).json(ApiResponse.error(`Error creating lease: ${error.message}`));
    }
  }

  static async updateLease(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const validation = LeaseValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const lease = await LeaseService.updateLease(id, req.body);

      res.status(200).json(
        ApiResponse.success(lease, `Lease ${lease.contract_number} updated successfully`)
      );
    } catch (error: any) {
      console.error('Error updating lease:', error);

      if (error.message === 'Lease not found') {
        return res.status(404).json(ApiResponse.error('Lease not found'));
      }

      res.status(400).json(ApiResponse.error(`Error updating lease: ${error.message}`));
    }
  }

  static async deleteLease(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const lease = await LeaseService.deleteLease(id);

      res.status(200).json(
        ApiResponse.success(null, `Lease ${lease.contract_number} marked as deleted successfully`)
      );
    } catch (error: any) {
      console.error('Error deleting lease:', error);

      if (error.message === 'Lease not found or already deleted') {
        return res.status(404).json(ApiResponse.error('Lease not found or already deleted'));
      }

      res.status(500).json(ApiResponse.error('Error deleting lease'));
    }
  }

  static async restoreLease(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const lease = await LeaseService.restoreLease(id);

      res.status(200).json(
        ApiResponse.success(null, `Lease ${lease.contract_number} restored successfully`)
      );
    } catch (error: any) {
      console.error('Error restoring lease:', error);

      if (error.message === 'Lease not found') {
        return res.status(404).json(ApiResponse.error('Lease not found'));
      }

      if (error.message === 'Lease is not deleted') {
        return res.status(400).json(ApiResponse.error('Lease is not deleted'));
      }

      res.status(500).json(ApiResponse.error('Error restoring lease'));
    }
  }

  static async getLeaseFilters(req: Request, res: Response) {
    try {
      const filters = await LeaseService.getLeaseFilters();
      res.status(200).json(
        ApiResponse.success(filters, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('Error getting filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}