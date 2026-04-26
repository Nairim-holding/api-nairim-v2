import { Request, Response } from 'express';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import busboy from 'busboy';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { PropertyValidator } from '../lib/validators/property';
import { PropertyService } from '@/services/PropertyService';
import { DocumentService } from '@/services/DocumentService';
import { GetPropertiesParams } from '../types/property';

const tempDir = path.join(process.cwd(), 'uploads', 'temp');

type TempFileInfo = {
  fieldname: string;
  tempPath: string;
  originalname: string;
  mimetype: string;
};

/** Apaga arquivos temp que ainda não foram movidos para o destino final */
async function cleanupTempFiles(files: TempFileInfo[]) {
  await Promise.all(files.map((f) => fs.unlink(f.tempPath).catch(() => {})));
}


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

  /**
   * Criação de imóvel com upload de mídias via busboy streaming.
   *
   * Fluxo:
   * 1. Campos de texto chegam primeiro (JSON pequeno — milissegundos).
   * 2. Quando o primeiro arquivo começa a ser recebido, todos os campos já estão
   *    disponíveis → criamos o imóvel no banco e respondemos imediatamente (< 1s).
   * 3. Os arquivos continuam sendo gravados em disco em background (sem bloquear a resposta).
   * 4. Após todos os arquivos concluídos → documentos criados no banco + AVIF agendado.
   *
   * Isso resolve o erro 502 do Nginx: a resposta chega ao proxy ANTES do timeout,
   * independentemente do tamanho do vídeo ou da velocidade de upload.
   */
  static createUnifiedProperty(req: Request, res: Response): void {
    if (!req.is('multipart/form-data')) {
      res.status(400).json(ApiResponse.error('Formato inválido. Use multipart/form-data'));
      return;
    }

    const bb = busboy({ headers: req.headers });
    const fields: Record<string, string> = {};
    const tempFiles: TempFileInfo[] = [];
    const fileWritePromises: Promise<void>[] = [];
    let propertyId: string | null = null;
    let responded = false;
    let failed = false;
    // Guard: garante que respondWithProperty seja chamada exatamente uma vez
    let respondPromise: Promise<void> | null = null;

    const sendError = (status: number, message: string) => {
      failed = true;
      if (!res.headersSent) res.status(status).json(ApiResponse.error(message));
    };

    const respondWithProperty = async () => {
      const { propertyData, addressData, valuesData, iptusData, userId } = fields;

      if (!propertyData || !addressData || !valuesData || !userId) {
        return sendError(400, 'Campos obrigatórios ausentes');
      }

      let parsedPropertyData, parsedAddressData, parsedValuesData, parsedIptusData;
      try {
        parsedPropertyData = JSON.parse(propertyData);
        parsedAddressData = JSON.parse(addressData);
        parsedValuesData = JSON.parse(valuesData);
        parsedIptusData = iptusData ? JSON.parse(iptusData) : [];
      } catch (e: any) {
        return sendError(400, `Formato JSON inválido: ${e.message}`);
      }

      const combinedData = { ...parsedPropertyData, address: parsedAddressData, values: parsedValuesData, iptus: parsedIptusData };
      const validation = PropertyValidator.validateCreate(combinedData);
      if (!validation.isValid) return sendError(400, 'Erro de validação');

      try {
        const { property } = await PropertyService.createPropertyTransaction(combinedData);
        propertyId = property!.id;
        responded = true;
        res.status(201).json(ApiResponse.success({ property, uploadedDocuments: [] }, 'Imóvel criado com sucesso'));
      } catch (err: any) {
        console.error('❌ Erro ao criar imóvel:', err);
        const status = err.message.includes('não encontrado') ? 404 : err.message.includes('já existe') ? 409 : 500;
        sendError(status, err.message);
      }
    };

    const triggerRespond = () => {
      if (!respondPromise && !failed) respondPromise = respondWithProperty();
    };

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (fieldname, stream, info) => {
      const ext = path.extname(info.filename).toLowerCase();
      const tempPath = path.join(tempDir, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
      tempFiles.push({ fieldname, tempPath, originalname: info.filename, mimetype: info.mimeType });

      const ws = createWriteStream(tempPath);
      stream.pipe(ws);
      fileWritePromises.push(
        new Promise<void>((resolve, reject) => {
          ws.on('finish', resolve);
          ws.on('error', reject);
          stream.on('error', reject);
        }),
      );

      // Ao primeiro arquivo: responde antecipadamente (evita timeout do Nginx em uploads grandes)
      triggerRespond();
    });

    bb.on('finish', async () => {
      // Sem arquivos: dispara agora; com arquivos: aguarda a transação iniciada pelo file event
      triggerRespond();
      await respondPromise;

      if (!failed && propertyId && fileWritePromises.length > 0) {
        const pid = propertyId;
        const uid = fields.userId;
        const featuredId = fields.featuredImageIdentifier;
        const filesToProcess = [...tempFiles];
        Promise.all(fileWritePromises)
          .then(() => PropertyService.processUploadedTempFiles(pid, filesToProcess, uid, featuredId))
          .catch(async (err) => {
            console.error('❌ Background upload error:', err);
            await cleanupTempFiles(filesToProcess);
          });
      }
    });

    bb.on('error', (err) => {
      console.error('❌ Busboy error:', err);
      sendError(500, 'Erro ao processar envio do formulário');
    });

    req.pipe(bb);
  }

  /**
   * Atualização de imóvel com upload de mídias via busboy streaming.
   * Mesma estratégia de resposta antecipada que createUnifiedProperty.
   */
  static updateUnifiedProperty(req: Request, res: Response): void {
    const id = String(req.params?.id || '');
    if (!id) { res.status(400).json(ApiResponse.error('ID da propriedade é obrigatório')); return; }

    if (!req.is('multipart/form-data')) {
      res.status(400).json(ApiResponse.error('Formato inválido. Use multipart/form-data'));
      return;
    }

    const bb = busboy({ headers: req.headers });
    const fields: Record<string, string> = {};
    const tempFiles: TempFileInfo[] = [];
    const fileWritePromises: Promise<void>[] = [];
    let propertyId: string | null = null;
    let responded = false;
    let failed = false;
    // Guard: garante que respondWithProperty seja chamada exatamente uma vez
    let respondPromise: Promise<void> | null = null;

    const sendError = (status: number, message: string) => {
      failed = true;
      if (!res.headersSent) res.status(status).json(ApiResponse.error(message));
    };

    const respondWithProperty = async () => {
      const { propertyData, addressData, valuesData, iptusData, userId, removedDocuments } = fields;

      if (!propertyData || !addressData || !valuesData || !userId) {
        return sendError(400, 'Campos obrigatórios ausentes');
      }

      let parsedPropertyData, parsedAddressData, parsedValuesData, parsedIptusData, parsedRemovedDocuments;
      try {
        parsedPropertyData = JSON.parse(propertyData);
        parsedAddressData = JSON.parse(addressData);
        parsedValuesData = JSON.parse(valuesData);
        parsedIptusData = iptusData ? JSON.parse(iptusData) : [];
        parsedRemovedDocuments = removedDocuments ? JSON.parse(removedDocuments) : [];
      } catch (e: any) {
        return sendError(400, `Formato JSON inválido: ${e.message}`);
      }

      const combinedData = { ...parsedPropertyData, address: parsedAddressData, values: parsedValuesData, iptus: parsedIptusData };
      const validation = PropertyValidator.validateUpdate(combinedData);
      if (!validation.isValid) return sendError(400, 'Erro de validação');

      try {
        const { property } = await PropertyService.updatePropertyTransaction(id, combinedData, parsedRemovedDocuments);
        propertyId = property!.id;
        responded = true;
        res.status(200).json(ApiResponse.success({ property, uploadedDocuments: [] }, 'Imóvel atualizado com sucesso'));
      } catch (err: any) {
        console.error('❌ Erro ao atualizar imóvel:', err);
        const status = err.message.includes('não encontrado') ? 404 : 500;
        sendError(status, err.message);
      }
    };

    const triggerRespond = () => {
      if (!respondPromise && !failed) respondPromise = respondWithProperty();
    };

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (fieldname, stream, info) => {
      const ext = path.extname(info.filename).toLowerCase();
      const tempPath = path.join(tempDir, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
      tempFiles.push({ fieldname, tempPath, originalname: info.filename, mimetype: info.mimeType });

      const ws = createWriteStream(tempPath);
      stream.pipe(ws);
      fileWritePromises.push(
        new Promise<void>((resolve, reject) => {
          ws.on('finish', resolve);
          ws.on('error', reject);
          stream.on('error', reject);
        }),
      );

      // Ao primeiro arquivo: responde antecipadamente (evita timeout do Nginx em uploads grandes)
      triggerRespond();
    });

    bb.on('finish', async () => {
      // Sem arquivos: dispara agora; com arquivos: aguarda a transação iniciada pelo file event
      triggerRespond();
      await respondPromise;

      if (!failed && propertyId && fileWritePromises.length > 0) {
        const pid = propertyId;
        const uid = fields.userId;
        const featuredId = fields.featuredImageIdentifier;
        const filesToProcess = [...tempFiles];
        Promise.all(fileWritePromises)
          .then(() => PropertyService.processUploadedTempFiles(pid, filesToProcess, uid, featuredId))
          .catch(async (err) => {
            console.error('❌ Background upload error:', err);
            await cleanupTempFiles(filesToProcess);
          });
      }
    });

    bb.on('error', (err) => {
      console.error('❌ Busboy error:', err);
      sendError(500, 'Erro ao processar envio do formulário');
    });

    req.pipe(bb);
  }
}