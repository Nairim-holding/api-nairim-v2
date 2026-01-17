import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { PropertyTypeValidator } from '../lib/validators/property-type';
import { PropertyTypeService } from '@/services/PropertyTypeService';

export class PropertyTypeController {
  static async getPropertyTypes(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 10);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      const sortOptions = {
        sort_id: ValidationUtil.parseStringParam(req.query?.sort_id),
        sort_description: ValidationUtil.parseStringParam(req.query?.sort_description),
      };

      const validation = PropertyTypeValidator.validateQueryParams(req.query);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const result = await PropertyTypeService.getPropertyTypes({
        limit,
        page,
        search,
        sortOptions,
        includeInactive,
      });

      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error getting property types:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getPropertyTypeById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }
      
      const propertyType = await PropertyTypeService.getPropertyTypeById(id);

      res.status(200).json(
        ApiResponse.success(propertyType, 'Property type retrieved successfully')
      );
    } catch (error: any) {
      if (error.message === 'Property type not found') {
        return res.status(404).json(ApiResponse.error('Property type not found'));
      }
      console.error('Error getting property type:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createPropertyType(req: Request, res: Response) {
    try {
      const validation = PropertyTypeValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const propertyType = await PropertyTypeService.createPropertyType(req.body);

      res.status(201).json(
        ApiResponse.success(propertyType, `Property type "${propertyType.description}" created successfully`)
      );
    } catch (error: any) {
      console.error('Error creating property type:', error);
      
      if (error.message === 'Property type already exists') {
        return res.status(409).json(ApiResponse.error('Property type already exists'));
      }

      res.status(400).json(ApiResponse.error(`Error creating property type: ${error.message}`));
    }
  }

  static async updatePropertyType(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const validation = PropertyTypeValidator.validateUpdate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const propertyType = await PropertyTypeService.updatePropertyType(id, req.body);

      res.status(200).json(
        ApiResponse.success(propertyType, `Property type "${propertyType.description}" updated successfully`)
      );
    } catch (error: any) {
      console.error('Error updating property type:', error);

      if (error.message === 'Property type not found') {
        return res.status(404).json(ApiResponse.error('Property type not found'));
      }

      if (error.message === 'Property type already exists') {
        return res.status(409).json(ApiResponse.error('Property type already exists'));
      }

      res.status(400).json(ApiResponse.error(`Error updating property type: ${error.message}`));
    }
  }

  static async deletePropertyType(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const propertyType = await PropertyTypeService.deletePropertyType(id);

      res.status(200).json(
        ApiResponse.success(null, `Property type "${propertyType.description}" marked as deleted successfully`)
      );
    } catch (error: any) {
      console.error('Error deleting property type:', error);

      if (error.message === 'Property type not found or already deleted') {
        return res.status(404).json(ApiResponse.error('Property type not found or already deleted'));
      }

      res.status(500).json(ApiResponse.error('Error deleting property type'));
    }
  }

  static async restorePropertyType(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const propertyType = await PropertyTypeService.restorePropertyType(id);

      res.status(200).json(
        ApiResponse.success(null, `Property type "${propertyType.description}" restored successfully`)
      );
    } catch (error: any) {
      console.error('Error restoring property type:', error);

      if (error.message === 'Property type not found') {
        return res.status(404).json(ApiResponse.error('Property type not found'));
      }

      if (error.message === 'Property type is not deleted') {
        return res.status(400).json(ApiResponse.error('Property type is not deleted'));
      }

      res.status(500).json(ApiResponse.error('Error restoring property type'));
    }
  }

  static async getPropertyTypeFilters(req: Request, res: Response) {
    try {
      const filters = await PropertyTypeService.getPropertyTypeFilters();
      res.status(200).json(
        ApiResponse.success(filters, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('Error getting filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}