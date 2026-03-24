import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { PropertyValidator } from '../lib/validators/property';
import { PropertyService } from '@/services/PropertyService';
import { DocumentService } from '@/services/DocumentService';
import { GetPropertiesParams } from '../types/property';

export class PropertyController {
  static async getProperties(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 10);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      const sortOptions: Record<string, 'asc' | 'desc'> = {};
      const filters: Record<string, any> = {};
      
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (typeof value === 'string') {
          const sortMatch = key.match(/^sort\[(.+)\]$/);
          if (sortMatch) {
            const field = sortMatch[1];
            const direction = value.toLowerCase() as 'asc' | 'desc';
            if (direction === 'asc' || direction === 'desc') sortOptions[field] = direction;
          }
          else if (key.startsWith('sort_')) {
            const field = key.substring(5);
            const direction = value.toLowerCase() as 'asc' | 'desc';
            if (direction === 'asc' || direction === 'desc') sortOptions[field] = direction;
          }
          else if (!['limit', 'page', 'search', 'includeInactive'].includes(key) && value.trim() !== '') {
            const filterMatch = key.match(/^filter\[(.+)\]$/);
            if (filterMatch) {
              filters[filterMatch[1]] = value;
            }
            else if (key !== 'sort' && !key.startsWith('sort[') && !key.startsWith('sort_')) {
              try {
                filters[key] = JSON.parse(value);
              } catch {
                filters[key] = value;
              }
            }
          }
        }
      });

      const params: GetPropertiesParams = { limit, page, search, filters, sortOptions, includeInactive };

      const validation = PropertyValidator.validateQueryParams({ ...req.query, ...sortOptions });
      if (!validation.isValid) return res.status(400).json(ApiResponse.error('Validation error', validation.errors));

      const result = await PropertyService.getProperties(params);

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error getting properties:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getPropertyById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));
      
      const property = await PropertyService.getPropertyById(id);
      res.status(200).json(ApiResponse.success(property, 'Property retrieved successfully'));
    } catch (error: any) {
      if (error.message === 'Property not found') return res.status(404).json(ApiResponse.error('Property not found'));
      console.error('Error getting property:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  // CREATE NORMAL (Se ainda usar)
  static async createProperty(req: Request, res: Response) {
    try {
      if (req.is('multipart/form-data')) {
        const { dataPropertys, addressProperty, valuesProperty, iptusProperty } = req.body;
        
        if (!dataPropertys || !addressProperty || !valuesProperty) {
          return res.status(400).json(ApiResponse.error('Missing required fields in form data'));
        }

        const combinedData = {
          ...JSON.parse(dataPropertys),
          address: JSON.parse(addressProperty),
          values: JSON.parse(valuesProperty),
          iptus: iptusProperty ? JSON.parse(iptusProperty) : []
        };

        const validation = PropertyValidator.validateCreate(combinedData);
        if (!validation.isValid) return res.status(400).json(ApiResponse.error('Validation error', validation.errors));

        const property = await PropertyService.createProperty(combinedData);
        return res.status(201).json(ApiResponse.success(property, `Property "${property.title}" created successfully`));
      } else {
        const validation = PropertyValidator.validateCreate(req.body);
        if (!validation.isValid) return res.status(400).json(ApiResponse.error('Validation error', validation.errors));

        const property = await PropertyService.createProperty(req.body);
        return res.status(201).json(ApiResponse.success(property, `Property "${property.title}" created successfully`));
      }
    } catch (error: any) {
      console.error('Error creating property:', error);
      if (error.message.includes('already exists')) return res.status(409).json(ApiResponse.error(error.message));
      if (error.message.includes('not found')) return res.status(404).json(ApiResponse.error(error.message));
      res.status(400).json(ApiResponse.error(`Error creating property: ${error.message}`));
    }
  }

  static async uploadDocuments(req: Request, res: Response) {}

  // UPDATE NORMAL (Se ainda usar)
  static async updateProperty(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));

      if (req.is('multipart/form-data')) {
        const { dataPropertys, addressProperty, valuesProperty, iptusProperty } = req.body;
        let updateData: any = {};
        
        if (dataPropertys) updateData = { ...updateData, ...JSON.parse(dataPropertys) };
        if (addressProperty) updateData.address = JSON.parse(addressProperty);
        if (valuesProperty) updateData.values = JSON.parse(valuesProperty);
        if (iptusProperty) updateData.iptus = JSON.parse(iptusProperty);

        const validation = PropertyValidator.validateUpdate(updateData);
        if (!validation.isValid) return res.status(400).json(ApiResponse.error('Validation error', validation.errors));

        const property = await PropertyService.updateProperty(id, updateData);
        return res.status(200).json(ApiResponse.success(property, `Property "${property.title}" updated successfully`));
      } else {
        const validation = PropertyValidator.validateUpdate(req.body);
        if (!validation.isValid) return res.status(400).json(ApiResponse.error('Validation error', validation.errors));

        const property = await PropertyService.updateProperty(id, req.body);
        return res.status(200).json(ApiResponse.success(property, `Property "${property.title}" updated successfully`));
      }
    } catch (error: any) {
      console.error('Error updating property:', error);
      if (error.message === 'Property not found') return res.status(404).json(ApiResponse.error('Property not found'));
      res.status(400).json(ApiResponse.error(`Error updating property: ${error.message}`));
    }
  }

  static async deleteProperty(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));
      const property = await PropertyService.deleteProperty(id);
      res.status(200).json(ApiResponse.success(null, `Property "${property.title}" marked as deleted successfully`));
    } catch (error: any) {
      console.error('Error deleting property:', error);
      if (error.message === 'Property not found or already deleted') return res.status(404).json(ApiResponse.error('Property not found or already deleted'));
      res.status(500).json(ApiResponse.error('Error deleting property'));
    }
  }

  static async restoreProperty(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) return res.status(400).json(ApiResponse.error('ID is required'));
      const property = await PropertyService.restoreProperty(id);
      res.status(200).json(ApiResponse.success(null, `Property "${property.title}" restored successfully`));
    } catch (error: any) {
      if (error.message === 'Property not found') return res.status(404).json(ApiResponse.error('Property not found'));
      if (error.message === 'Property is not deleted') return res.status(400).json(ApiResponse.error('Property is not deleted'));
      res.status(500).json(ApiResponse.error('Error restoring property'));
    }
  }

  static async getPropertyFilters(req: Request, res: Response) {
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

      const filtersData = await PropertyService.getPropertyFilters(filters);
      res.status(200).json(ApiResponse.success(filtersData, 'Filters retrieved successfully'));
    } catch (error) {
      console.error('❌ Error getting property filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async updateDocuments(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      const userId = String(req.body?.userId || '');
      if (!id) return res.status(400).json(ApiResponse.error('Property ID is required'));
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const documents = await DocumentService.updateDocuments(id, userId, files || {});
      res.status(200).json(ApiResponse.success(documents, 'Documents updated successfully'));
    } catch (error: any) {
      if (error.message === 'Property not found') return res.status(404).json(ApiResponse.error('Property not found'));
      res.status(500).json(ApiResponse.error('Error updating documents'));
    }
  }

  static async createUnifiedProperty(req: Request, res: Response) {
    try {
      if (!req.is('multipart/form-data')) {
        return res.status(400).json(ApiResponse.error('Formato inválido. Use multipart/form-data'));
      }

      const { propertyData, addressData, valuesData, iptusData, userId, featuredImageIdentifier } = req.body;
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;

      if (!propertyData || !addressData || !valuesData || !userId) {
        return res.status(400).json(ApiResponse.error('Campos obrigatórios ausentes'));
      }

      let parsedPropertyData, parsedAddressData, parsedValuesData, parsedIptusData;
      try {
        parsedPropertyData = JSON.parse(propertyData);
        parsedAddressData = JSON.parse(addressData);
        parsedValuesData = JSON.parse(valuesData);
        parsedIptusData = iptusData ? JSON.parse(iptusData) : [];
      } catch (parseError: any) {
        return res.status(400).json(ApiResponse.error(`Formato JSON inválido: ${parseError.message}`));
      }

      const combinedData = {
        ...parsedPropertyData,
        address: parsedAddressData,
        values: parsedValuesData,
        iptus: parsedIptusData
      };

      const validation = PropertyValidator.validateCreate(combinedData);
      if (!validation.isValid) return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));

      const result = await PropertyService.createPropertyWithFiles(combinedData, files || {}, userId, featuredImageIdentifier);
      return res.status(201).json(ApiResponse.success(result, `Imóvel criado com sucesso`));

    } catch (error: any) {
      console.error('❌ Erro na criação unificada:', error);
      if (error.message.includes('não encontrado')) return res.status(404).json(ApiResponse.error(error.message));
      if (error.message.includes('já existe')) return res.status(409).json(ApiResponse.error(error.message));
      res.status(500).json(ApiResponse.error(`Erro ao criar imóvel: ${error.message}`));
    }
  }

  static async updateUnifiedProperty(req: Request, res: Response) {
    try {
      if (!req.is('multipart/form-data')) {
        return res.status(400).json(ApiResponse.error('Formato inválido. Use multipart/form-data'));
      }

      const { propertyData, addressData, valuesData, iptusData, userId, removedDocuments, featuredImageIdentifier } = req.body;
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const id = String(req.params?.id || '');

      if (!id) return res.status(400).json(ApiResponse.error('ID da propriedade é obrigatório'));
      if (!propertyData || !addressData || !valuesData || !userId) {
        return res.status(400).json(ApiResponse.error('Campos obrigatórios ausentes'));
      }

      let parsedPropertyData, parsedAddressData, parsedValuesData, parsedIptusData, parsedRemovedDocuments;
      try {
        parsedPropertyData = JSON.parse(propertyData);
        parsedAddressData = JSON.parse(addressData);
        parsedValuesData = JSON.parse(valuesData);
        parsedIptusData = iptusData ? JSON.parse(iptusData) : [];
        parsedRemovedDocuments = removedDocuments ? JSON.parse(removedDocuments) : [];
      } catch (parseError: any) {
        return res.status(400).json(ApiResponse.error(`Formato JSON inválido: ${parseError.message}`));
      }

      const combinedData = {
        ...parsedPropertyData,
        address: parsedAddressData,
        values: parsedValuesData,
        iptus: parsedIptusData
      };

      const validation = PropertyValidator.validateUpdate(combinedData);
      if (!validation.isValid) return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));

      const result = await PropertyService.updatePropertyWithFiles(id, combinedData, files || {}, userId, parsedRemovedDocuments, featuredImageIdentifier);
      return res.status(200).json(ApiResponse.success(result, `Imóvel atualizado com sucesso`));

    } catch (error: any) {
      console.error('❌ Erro na atualização unificada:', error);
      if (error.message.includes('não encontrado')) return res.status(404).json(ApiResponse.error(error.message));
      res.status(500).json(ApiResponse.error(`Erro ao atualizar imóvel: ${error.message}`));
    }
  }
}