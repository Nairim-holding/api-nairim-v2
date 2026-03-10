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
      
      console.log('📥 Query params recebidos para propriedades:', req.query);
      
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (typeof value === 'string') {
          const sortMatch = key.match(/^sort\[(.+)\]$/);
          if (sortMatch) {
            const field = sortMatch[1];
            const direction = value.toLowerCase() as 'asc' | 'desc';
            if (direction === 'asc' || direction === 'desc') {
              sortOptions[field] = direction;
              console.log(`📌 Ordenação detectada: ${field} -> ${direction}`);
            }
          }
          else if (key.startsWith('sort_')) {
            const field = key.substring(5);
            const direction = value.toLowerCase() as 'asc' | 'desc';
            if (direction === 'asc' || direction === 'desc') {
              sortOptions[field] = direction;
              console.log(`📌 Ordenação detectada (formato antigo): ${field} -> ${direction}`);
            }
          }
          else if (!['limit', 'page', 'search', 'includeInactive'].includes(key) && value.trim() !== '') {
            const filterMatch = key.match(/^filter\[(.+)\]$/);
            if (filterMatch) {
              const field = filterMatch[1];
              filters[field] = value;
            }
            else if (key !== 'sort' && !key.startsWith('sort[') && !key.startsWith('sort_')) {
              try {
                const parsedValue = JSON.parse(value);
                filters[key] = parsedValue;
              } catch {
                filters[key] = value;
              }
            }
          }
        }
      });

      console.log('🔍 Sort options extraídos:', sortOptions);
      console.log('📋 Filtros extraídos:', filters);

      const params: GetPropertiesParams = {
        limit,
        page,
        search,
        filters,
        sortOptions,
        includeInactive,
      };

      const validation = PropertyValidator.validateQueryParams({ ...req.query, ...sortOptions });
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

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

  static async uploadDocuments(req: Request, res: Response) {
  }

  static async updateProperty(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

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
      const filters: Record<string, any> = {};
      
      console.log('📥 Received query params for property filters:', req.query);

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

      const filtersData = await PropertyService.getPropertyFilters(filters);
      
      res.status(200).json(
        ApiResponse.success(filtersData, 'Filters retrieved successfully')
      );
    } catch (error) {
      console.error('❌ Error getting property filters:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
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

  static async createUnifiedProperty(req: Request, res: Response) {
    try {
      console.log('🚀 Recebendo requisição unificada para criar propriedade');
      
      if (!req.is('multipart/form-data')) {
        return res.status(400).json(ApiResponse.error(
          'Formato inválido. Use multipart/form-data para envio de arquivos'
        ));
      }

      const {
        propertyData,
        addressData,
        valuesData,
        userId,
        featuredImageIdentifier // <-- AGORA ESTÁ EXTRAINDO CORRETAMENTE
      } = req.body;

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;

      if (!propertyData || !addressData || !valuesData || !userId) {
        console.error('❌ Campos obrigatórios ausentes');
        return res.status(400).json(ApiResponse.error(
          'Campos obrigatórios ausentes: propertyData, addressData, valuesData e userId são necessários'
        ));
      }

      let parsedPropertyData, parsedAddressData, parsedValuesData;
      
      try {
        parsedPropertyData = JSON.parse(propertyData);
        parsedAddressData = JSON.parse(addressData);
        parsedValuesData = JSON.parse(valuesData);
      } catch (parseError: any) {
        console.error('❌ Erro ao fazer parse do JSON:', parseError);
        return res.status(400).json(ApiResponse.error(
          `Formato JSON inválido: ${parseError.message}`
        ));
      }

      const combinedData = {
        ...parsedPropertyData,
        address: parsedAddressData,
        values: parsedValuesData
      };

      const validation = PropertyValidator.validateCreate(combinedData);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Erro de validação', validation.errors)
        );
      }

      // Passando o featuredImageIdentifier para a Service
      const result = await PropertyService.createPropertyWithFiles(
        combinedData,
        files || {},
        userId,
        featuredImageIdentifier
      );

      return res.status(201).json(
        ApiResponse.success(
          result,
          `Imóvel "${result.property?.title}" criado com sucesso com ${result.uploadedDocuments.length} arquivos`
        )
      );

    } catch (error: any) {
      console.error('❌ Erro na criação unificada:', error);
      if (error.message.includes('não encontrado')) {
        return res.status(404).json(ApiResponse.error(error.message));
      }
      if (error.message.includes('já existe')) {
        return res.status(409).json(ApiResponse.error(error.message));
      }

      res.status(500).json(ApiResponse.error(`Erro ao criar imóvel: ${error.message}`));
    }
  }

  static async updateUnifiedProperty(req: Request, res: Response) {
    try {
      console.log('🚀 Recebendo requisição unificada para atualizar propriedade');
      
      if (!req.is('multipart/form-data')) {
        return res.status(400).json(ApiResponse.error(
          'Formato inválido. Use multipart/form-data para envio de arquivos'
        ));
      }

      const {
        propertyData,
        addressData,
        valuesData,
        userId,
        removedDocuments,
        featuredImageIdentifier // <-- AGORA ESTÁ EXTRAINDO CORRETAMENTE
      } = req.body;

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;

      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID da propriedade é obrigatório'));
      }

      if (!propertyData || !addressData || !valuesData || !userId) {
        return res.status(400).json(ApiResponse.error(
          'Campos obrigatórios ausentes: propertyData, addressData, valuesData e userId são necessários'
        ));
      }

      let parsedPropertyData, parsedAddressData, parsedValuesData, parsedRemovedDocuments;
      
      try {
        parsedPropertyData = JSON.parse(propertyData);
        parsedAddressData = JSON.parse(addressData);
        parsedValuesData = JSON.parse(valuesData);
        parsedRemovedDocuments = removedDocuments ? JSON.parse(removedDocuments) : [];
      } catch (parseError: any) {
        return res.status(400).json(ApiResponse.error(`Formato JSON inválido: ${parseError.message}`));
      }

      const combinedData = {
        ...parsedPropertyData,
        address: parsedAddressData,
        values: parsedValuesData
      };

      const validation = PropertyValidator.validateUpdate(combinedData);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Erro de validação', validation.errors));
      }

      // Passando o featuredImageIdentifier para a Service
      const result = await PropertyService.updatePropertyWithFiles(
        id,
        combinedData,
        files || {},
        userId,
        parsedRemovedDocuments,
        featuredImageIdentifier
      );

      return res.status(200).json(
        ApiResponse.success(
          result,
          `Imóvel "${result.property?.title}" atualizado com sucesso com ${result.uploadedDocuments.length} arquivos novos e ${result.removedDocuments.length} removidos`
        )
      );

    } catch (error: any) {
      console.error('❌ Erro na atualização unificada:', error);
      if (error.message.includes('não encontrado')) {
        return res.status(404).json(ApiResponse.error(error.message));
      }
      if (error.message.includes('já existe')) {
        return res.status(409).json(ApiResponse.error(error.message));
      }

      res.status(500).json(ApiResponse.error(`Erro ao atualizar imóvel: ${error.message}`));
    }
  }
}