// controllers/PropertyTypeController.ts
import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { PropertyTypeValidator } from '../lib/validators/property-type';
import { PropertyTypeService } from '@/services/PropertyTypeService';

export class PropertyTypeController {
  static async getPropertyTypes(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 30);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeInactive = ValidationUtil.parseBooleanParam(req.query?.includeInactive);

      // Processar sort no formato sort[field]=direction
      const sortOptions: any = {};
      const filters: Record<string, any> = {};
      
      console.log('📥 Query params recebidos para tipos de imóvel:', req.query);
      
      // Processar parâmetros de ordenação no formato sort[field]
      Object.entries(req.query || {}).forEach(([key, value]) => {
        console.log(`🔧 Processando parâmetro: ${key} =`, value);
        
        // Verificar se é parâmetro de ordenação no formato sort[field]
        if (key.startsWith('sort[') && key.endsWith(']')) {
          const field = key.substring(5, key.length - 1); // Extrai o nome do campo
          const direction = String(value).toLowerCase();
          
          if (direction === 'asc' || direction === 'desc') {
            sortOptions[`sort_${field}`] = direction;
            console.log(`📌 Ordenação detectada: ${field} -> ${direction}`);
          }
        }
        // Verificar se é parâmetro de ordenação no formato antigo sort_field
        else if (key.startsWith('sort_')) {
          const field = key.substring(5); // Remove "sort_"
          const direction = String(value).toLowerCase();
          
          if (direction === 'asc' || direction === 'desc') {
            sortOptions[`sort_${field}`] = direction;
            console.log(`📌 Ordenação detectada (formato antigo): ${field} -> ${direction}`);
          }
        }
        // Processar filtros (ignorando parâmetros padrão)
        else if (
          !['limit', 'page', 'search', 'includeInactive'].includes(key) &&
          !key.startsWith('sort')
        ) {
          if (key.startsWith('filter[')) {
            const filterField = key.substring(7, key.length - 1);
            if (value && value !== '' && value !== 'undefined' && value !== 'null') {
              filters[filterField] = value;
            }
          }
          // Tratar filtros diretos também
          else if (value && value !== '' && value !== 'undefined' && value !== 'null') {
            try {
              if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                const parsedValue = JSON.parse(value);
                if (parsedValue && typeof parsedValue === 'object') {
                  filters[key] = parsedValue;
                } else {
                  filters[key] = value;
                }
              } else {
                filters[key] = value;
              }
            } catch {
              filters[key] = value;
            }
          }
        }
      });

      console.log('🔍 Sort options extraídos:', sortOptions);
      console.log('📋 Filtros extraídos:', filters);

      const validation = PropertyTypeValidator.validateQueryParams({ ...req.query, ...sortOptions });
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const result = await PropertyTypeService.getPropertyTypes({
        limit,
        page,
        search,
        filters,
        sortOptions,
        includeInactive,
      });

      // Desabilitar cache
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
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
      // Extrair filtros dos query params para contexto
      const filters: Record<string, any> = {};
      
      console.log('📥 Received query params for property type filters:', req.query);

      // Processar parâmetros de filtro
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (value && value !== '' && value !== 'undefined' && value !== 'null') {
          console.log(`🔧 Processing filter param: ${key} =`, value);
          
          try {
            const parsedValue = JSON.parse(value as string);
            if (parsedValue && typeof parsedValue === 'object') {
              filters[key] = parsedValue;
            } else {
              filters[key] = value;
            }
          } catch {
            filters[key] = value;
          }
        }
      });

      console.log('📋 Parsed filters for context:', filters);

      const filtersData = await PropertyTypeService.getPropertyTypeFilters(filters);
      
      res.status(200).json(
        ApiResponse.success(filtersData, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('❌ Error getting property type filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}