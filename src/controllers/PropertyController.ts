import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { PropertyValidator } from '../lib/validators/property';
import { PropertyService } from '@/services/PropertyService';
import { DocumentService } from '@/services/DocumentService';

export class PropertyController {
  static async getProperties(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 10);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      const filters: Record<string, string> = {};
      const sortOptions: Record<string, string> = {};

      // Separar filtros e opções de ordenação
      Object.entries(req.query).forEach(([key, value]) => {
        if (key.startsWith('sort_') && typeof value === 'string') {
          sortOptions[key] = value;
        } else if (!['limit', 'page', 'search', 'includeInactive'].includes(key)) {
          filters[key] = String(value);
        }
      });

      const validation = PropertyValidator.validateQueryParams(req.query);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const result = await PropertyService.getProperties({
        limit,
        page,
        search,
        filters,
        sortOptions,
        includeInactive,
      });

      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error getting properties:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getPropertyById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }
      
      const property = await PropertyService.getPropertyById(id);

      res.status(200).json(
        ApiResponse.success(property, 'Property retrieved successfully')
      );
    } catch (error: any) {
      if (error.message === 'Property not found') {
        return res.status(404).json(ApiResponse.error('Property not found'));
      }
      console.error('Error getting property:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createProperty(req: Request, res: Response) {
    try {
      // Verificar se é multipart/form-data
      if (req.is('multipart/form-data')) {
        const { dataPropertys, addressProperty, valuesProperty } = req.body;
        
        if (!dataPropertys || !addressProperty || !valuesProperty) {
          return res.status(400).json(ApiResponse.error('Missing required fields in form data'));
        }

        const propertyData = JSON.parse(dataPropertys);
        const addressData = JSON.parse(addressProperty);
        const valuesData = JSON.parse(valuesProperty);

        const combinedData = {
          ...propertyData,
          address: addressData,
          values: valuesData
        };

        const validation = PropertyValidator.validateCreate(combinedData);
        if (!validation.isValid) {
          return res.status(400).json(
            ApiResponse.error('Validation error', validation.errors)
          );
        }

        const property = await PropertyService.createProperty(combinedData);

        return res.status(201).json(
          ApiResponse.success(property, `Property "${property.title}" created successfully`)
        );
      } else {
        // JSON request
        const validation = PropertyValidator.validateCreate(req.body);
        if (!validation.isValid) {
          return res.status(400).json(
            ApiResponse.error('Validation error', validation.errors)
          );
        }

        const property = await PropertyService.createProperty(req.body);

        return res.status(201).json(
          ApiResponse.success(property, `Property "${property.title}" created successfully`)
        );
      }
    } catch (error: any) {
      console.error('Error creating property:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json(ApiResponse.error(error.message));
      }
      
      if (error.message.includes('not found')) {
        return res.status(404).json(ApiResponse.error(error.message));
      }

      res.status(400).json(ApiResponse.error(`Error creating property: ${error.message}`));
    }
  }

  static async updateProperty(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      // Verificar se é multipart/form-data
      if (req.is('multipart/form-data')) {
        const { dataPropertys, addressProperty, valuesProperty } = req.body;
        
        let updateData: any = {};
        
        if (dataPropertys) {
          const propertyData = JSON.parse(dataPropertys);
          updateData = { ...updateData, ...propertyData };
        }
        
        if (addressProperty) {
          updateData.address = JSON.parse(addressProperty);
        }
        
        if (valuesProperty) {
          updateData.values = JSON.parse(valuesProperty);
        }

        const validation = PropertyValidator.validateUpdate(updateData);
        if (!validation.isValid) {
          return res.status(400).json(
            ApiResponse.error('Validation error', validation.errors)
          );
        }

        const property = await PropertyService.updateProperty(id, updateData);

        return res.status(200).json(
          ApiResponse.success(property, `Property "${property.title}" updated successfully`)
        );
      } else {
        // JSON request
        const validation = PropertyValidator.validateUpdate(req.body);
        if (!validation.isValid) {
          return res.status(400).json(
            ApiResponse.error('Validation error', validation.errors)
          );
        }

        const property = await PropertyService.updateProperty(id, req.body);

        return res.status(200).json(
          ApiResponse.success(property, `Property "${property.title}" updated successfully`)
        );
      }
    } catch (error: any) {
      console.error('Error updating property:', error);

      if (error.message === 'Property not found') {
        return res.status(404).json(ApiResponse.error('Property not found'));
      }

      res.status(400).json(ApiResponse.error(`Error updating property: ${error.message}`));
    }
  }

  static async deleteProperty(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const property = await PropertyService.deleteProperty(id);

      res.status(200).json(
        ApiResponse.success(null, `Property "${property.title}" marked as deleted successfully`)
      );
    } catch (error: any) {
      console.error('Error deleting property:', error);

      if (error.message === 'Property not found or already deleted') {
        return res.status(404).json(ApiResponse.error('Property not found or already deleted'));
      }

      res.status(500).json(ApiResponse.error('Error deleting property'));
    }
  }

  static async restoreProperty(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const property = await PropertyService.restoreProperty(id);

      res.status(200).json(
        ApiResponse.success(null, `Property "${property.title}" restored successfully`)
      );
    } catch (error: any) {
      console.error('Error restoring property:', error);

      if (error.message === 'Property not found') {
        return res.status(404).json(ApiResponse.error('Property not found'));
      }

      if (error.message === 'Property is not deleted') {
        return res.status(400).json(ApiResponse.error('Property is not deleted'));
      }

      res.status(500).json(ApiResponse.error('Error restoring property'));
    }
  }

  static async getPropertyFilters(req: Request, res: Response) {
    try {
      const filters = await PropertyService.getPropertyFilters();
      res.status(200).json(
        ApiResponse.success(filters, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('Error getting filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async uploadDocuments(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      const userId = String(req.body?.userId || '');
      
      if (!id) {
        return res.status(400).json(ApiResponse.error('Property ID is required'));
      }

      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json(ApiResponse.error('No files uploaded'));
      }

      const files = req.files as Record<string, Express.Multer.File[]>;
      const documents = await DocumentService.uploadDocuments(id, userId, files);

      res.status(200).json(
        ApiResponse.success(documents, 'Documents uploaded successfully')
      );
    } catch (error: any) {
      console.error('Error uploading documents:', error);
      
      if (error.message === 'Property not found') {
        return res.status(404).json(ApiResponse.error('Property not found'));
      }

      res.status(500).json(ApiResponse.error('Error uploading documents'));
    }
  }

  static async updateDocuments(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      const userId = String(req.body?.userId || '');
      
      if (!id) {
        return res.status(400).json(ApiResponse.error('Property ID is required'));
      }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const documents = await DocumentService.updateDocuments(id, userId, files || {});

      res.status(200).json(
        ApiResponse.success(documents, 'Documents updated successfully')
      );
    } catch (error: any) {
      console.error('Error updating documents:', error);
      
      if (error.message === 'Property not found') {
        return res.status(404).json(ApiResponse.error('Property not found'));
      }

      res.status(500).json(ApiResponse.error('Error updating documents'));
    }
  }
}