import { DocumentType, PropertyStatus } from '@/generated/prisma/enums';
import prisma from '../lib/prisma';
import { 
  GetPropertiesParams, 
  PaginatedPropertyResponse, 
  PropertyWithRelations,
  Address 
} from '../types/property';
import { Prisma } from '@/generated/prisma/client';
import { BlobService } from '@/lib/blobService';

export class PropertyService {
  private static readonly FIELD_MAPPING: Record<string, { 
    type: 'direct' | 'address' | 'relation', 
    realField: string,
    relationPath?: string 
  }> = {
    'title': { type: 'direct', realField: 'title' },
    'bedrooms': { type: 'direct', realField: 'bedrooms' },
    'bathrooms': { type: 'direct', realField: 'bathrooms' },
    'half_bathrooms': { type: 'direct', realField: 'half_bathrooms' },
    'garage_spaces': { type: 'direct', realField: 'garage_spaces' },
    'area_total': { type: 'direct', realField: 'area_total' },
    'area_built': { type: 'direct', realField: 'area_built' },
    'frontage': { type: 'direct', realField: 'frontage' },
    'furnished': { type: 'direct', realField: 'furnished' },
    'floor_number': { type: 'direct', realField: 'floor_number' },
    'tax_registration': { type: 'direct', realField: 'tax_registration' },
    'notes': { type: 'direct', realField: 'notes' },
    'created_at': { type: 'direct', realField: 'created_at' },
    'updated_at': { type: 'direct', realField: 'updated_at' },
    
    'owner_name': { type: 'relation', realField: 'name', relationPath: 'owner.name' },
    'type_description': { type: 'relation', realField: 'description', relationPath: 'type.description' },
    'agency_trade_name': { type: 'relation', realField: 'trade_name', relationPath: 'agency.trade_name' },
    
    'city': { type: 'address', realField: 'city', relationPath: 'addresses.0.address.city' },
    'state': { type: 'address', realField: 'state', relationPath: 'addresses.0.address.state' },
    'district': { type: 'address', realField: 'district', relationPath: 'addresses.0.address.district' },
    'street': { type: 'address', realField: 'street', relationPath: 'addresses.0.address.street' },
    'zip_code': { type: 'address', realField: 'zip_code', relationPath: 'addresses.0.address.zip_code' },
  };

  private static normalizeText(text: string): string {
    if (!text) return '';
    
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  
      .replace(/[çÇ]/g, 'c')       
      .replace(/[ñÑ]/g, 'n')           
      .toLowerCase()
      .trim();
  }

  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    if (direction.toLowerCase() === 'desc') {
      return 'desc';
    }
    return 'asc';
  }

  private static safeGetProperty<T>(obj: any, path: string): T | undefined {
    return path.split('.').reduce((acc, part) => {
      if (acc === null || acc === undefined) return undefined;
      return acc[part];
    }, obj);
  }

  private static sortByRelatedField<T>(
    items: T[],
    sortField: string,
    direction: 'asc' | 'desc',
    fieldMapping: Record<string, { type: string; relationPath?: string }>
  ): T[] {
    return [...items].sort((a, b) => {
      const fieldInfo = fieldMapping[sortField];
      if (!fieldInfo?.relationPath) return 0;

      let valueA = '';
      let valueB = '';

      if (fieldInfo.type === 'address' || fieldInfo.type === 'relation') {
        valueA = String(this.safeGetProperty(a, fieldInfo.relationPath) || '');
        valueB = String(this.safeGetProperty(b, fieldInfo.relationPath) || '');
      }

      const strA = this.normalizeText(valueA);
      const strB = this.normalizeText(valueB);

      if (direction === 'asc') {
        return strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' });
      } else {
        return strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
      }
    });
  }

  static async getProperties(params: GetPropertiesParams = {}): Promise<PaginatedPropertyResponse> {
    try {
      const { 
        limit = 10, 
        page = 1, 
        search = '',
        filters = {},
        sortOptions = {},
        includeInactive = false 
      } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      const where = this.buildWhereClauseWithoutSearch(filters, includeInactive);
      
      const sortEntries = Object.entries(sortOptions);
      const sortField = sortEntries.length > 0 ? sortEntries[0][0] : '';
      const sortDirection = sortEntries.length > 0 ? 
        this.normalizeSortDirection(sortEntries[0][1]) : 'asc';
      
      let properties: PropertyWithRelations[] = [];
      let total = 0;

      if (search.trim() || (sortField && sortDirection && this.FIELD_MAPPING[sortField]?.type !== 'direct')) {
        const allProperties = await prisma.property.findMany({
          where,
          include: {
            addresses: {
              where: { deleted_at: null },
              include: { address: true }
            },
            owner: {
              select: {
                id: true,
                name: true,
                internal_code: true
              }
            },
            type: {
              select: {
                id: true,
                description: true
              }
            },
            agency: {
              select: {
                id: true,
                trade_name: true
              }
            },
            documents: {
              where: { deleted_at: null },
              orderBy: { created_at: 'desc' }
            },
            values: {
              where: { deleted_at: null },
              orderBy: { created_at: 'desc' }
            },
            leases: {
              where: { deleted_at: null },
              take: 1,
              orderBy: { created_at: 'desc' }
            },
            favorites: {
              where: { deleted_at: null },
              include: { user: true }
            }
          }
        }) as unknown as PropertyWithRelations[];

        let filteredProperties = allProperties;
        if (search.trim()) {
          filteredProperties = this.filterPropertiesBySearch(allProperties, search);
        }

        total = filteredProperties.length;

        if (sortField && sortDirection) {
          if (this.FIELD_MAPPING[sortField]?.type !== 'direct') {
            properties = this.sortByRelatedField(filteredProperties, sortField, sortDirection, this.FIELD_MAPPING);
          } else {
            properties = this.sortByDirectField(filteredProperties, sortField, sortDirection);
          }
        } else {
          properties = filteredProperties.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        
        properties = properties.slice(skip, skip + take);
      } else {
        const orderBy = this.buildOrderBy(sortOptions);
        
        const [propertiesData, totalCount] = await Promise.all([
          prisma.property.findMany({
            where,
            skip,
            take,
            orderBy,
            include: {
              addresses: {
                where: { deleted_at: null },
                include: { address: true }
              },
              owner: {
                select: {
                  id: true,
                  name: true,
                  internal_code: true
                }
              },
              type: {
                select: {
                  id: true,
                  description: true
                }
              },
              agency: {
                select: {
                  id: true,
                  trade_name: true
                }
              },
              documents: {
                where: { deleted_at: null },
                orderBy: { created_at: 'desc' }
              },
              values: {
                where: { deleted_at: null },
                orderBy: { created_at: 'desc' }
              },
              leases: {
                where: { deleted_at: null },
                take: 1,
                orderBy: { created_at: 'desc' }
              },
              favorites: {
                where: { deleted_at: null },
                include: { user: true }
              }
            }
          }),
          prisma.property.count({ where })
        ]);

        properties = propertiesData as unknown as PropertyWithRelations[];
        total = totalCount;
      }

      return {
        data: properties,
        count: total || 0,
        totalPages: total ? Math.ceil(total / take) : 0,
        currentPage: page,
      };

    } catch (error: any) {
      throw new Error(`Failed to fetch properties: ${error.message}`);
    }
  }

  private static filterPropertiesBySearch(
    properties: PropertyWithRelations[],
    searchTerm: string
  ): PropertyWithRelations[] {
    if (!searchTerm.trim()) return properties;

    const normalizedSearchTerm = this.normalizeText(searchTerm);
    
    return properties.filter(property => {
      const directFields = [
        property.title,
        property.tax_registration,
        property.notes
      ].filter(Boolean).join(' ');

      const ownerFields = property.owner ? [
        property.owner.name,
        property.owner.internal_code
      ].filter(Boolean).join(' ') : '';

      const typeFields = property.type ? [
        property.type.description
      ].filter(Boolean).join(' ') : '';

      const agencyFields = property.agency ? [
        property.agency.trade_name
      ].filter(Boolean).join(' ') : '';

      const addressFields = property.addresses
        ?.map(pa => pa.address)
        .filter(Boolean)
        .map(addr => [
          addr.street,
          addr.district,
          addr.city,
          addr.state,
          addr.zip_code
        ].filter(Boolean).join(' '))
        .join(' ') || '';

      const allFields = [
        directFields,
        ownerFields,
        typeFields,
        agencyFields,
        addressFields
      ].join(' ');

      const normalizedAllFields = this.normalizeText(allFields);
      return normalizedAllFields.includes(normalizedSearchTerm);
    });
  }

  private static sortByDirectField<T>(
    items: T[],
    field: string,
    direction: 'asc' | 'desc'
  ): T[] {
    return [...items].sort((a: any, b: any) => {
      const valueA = a[field] || '';
      const valueB = b[field] || '';

      if (['title', 'tax_registration', 'notes'].includes(field)) {
        const strA = this.normalizeText(String(valueA));
        const strB = this.normalizeText(String(valueB));
        
        if (direction === 'asc') {
          return strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' });
        } else {
          return strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
        }
      } else {
        if (direction === 'asc') {
          return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
        } else {
          return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
        }
      }
    });
  }

  private static buildWhereClauseWithoutSearch(
    filters: Record<string, any>,
    includeInactive: boolean
  ): any {
    const where: any = {};
    
    if (!includeInactive) {
      where.deleted_at = null;
    }
    
    const filterConditions = this.buildFilterConditions(filters);
    if (Object.keys(filterConditions).length > 0) {
      where.AND = [filterConditions];
    }
    
    return where;
  }

  private static buildFilterConditions(filters: Record<string, any>): any {
    const conditions: any = {};
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      if (key === 'owner_id' || key === 'type_id' || key === 'agency_id') {
        conditions[key] = value;
      }
      else if (key === 'furnished') {
        const boolValue = typeof value === 'string' 
          ? value.toLowerCase() === 'true' 
          : Boolean(value);
        conditions.furnished = boolValue;
      }
      else if (['bedrooms', 'bathrooms', 'half_bathrooms', 'garage_spaces', 'floor_number'].includes(key)) {
        const numValue = parseInt(String(value));
        if (!isNaN(numValue)) {
          conditions[key] = numValue;
        }
      }
      else if (['area_total', 'area_built', 'frontage'].includes(key)) {
        const floatValue = parseFloat(String(value));
        if (!isNaN(floatValue)) {
          conditions[key] = floatValue;
        }
      }
      else if (['title', 'tax_registration', 'notes'].includes(key)) {
        conditions[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      else if (['city', 'state', 'district', 'street', 'zip_code'].includes(key)) {
        if (!conditions.addresses) {
          conditions.addresses = { some: { address: {} } };
        }
        conditions.addresses.some.address[key] = { 
          contains: String(value), 
          mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      else if (key === 'created_at') {
        conditions.created_at = this.buildDateCondition(value);
      }
    });
    
    return conditions;
  }

  private static buildDateCondition(value: any): any {
    if (typeof value === 'object' && value && 'from' in value && 'to' in value) {
      const dateRange = value as { from: string; to: string };
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
        return {
          gte: fromDate,
          lte: toDate
        };
      }
    } 
    else if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        return {
          gte: startOfDay,
          lte: endOfDay
        };
      }
    }
    
    return {};
  }

  private static buildOrderBy(sortOptions: Record<string, string>): any[] {
    const orderBy: any[] = [];

    Object.entries(sortOptions).forEach(([field, direction]) => {
      const normalizedDirection = this.normalizeSortDirection(direction);

      if (field === 'owner.name' || field === 'owner_name') {
        orderBy.push({ owner: { name: normalizedDirection } });
      } 
      else if (field === 'type.description' || field === 'type_description') {
        orderBy.push({ type: { description: normalizedDirection } });
      } 
      else if (field === 'agency.trade_name' || field === 'agency_trade_name') {
        orderBy.push({ agency: { trade_name: normalizedDirection } });
      }
      else if (['title', 'bedrooms', 'bathrooms', 'half_bathrooms', 'garage_spaces', 
                'area_total', 'area_built', 'frontage', 'furnished', 'floor_number',
                'tax_registration', 'notes', 'created_at', 'updated_at'].includes(field)) {
        orderBy.push({ [field]: normalizedDirection });
      }
    });

    if (orderBy.length === 0) {
      orderBy.push({ created_at: 'desc' });
    }

    return orderBy;
  }

  static async getPropertyById(id: string) {
    try {
      const property = await prisma.property.findUnique({
        where: { 
          id,
          deleted_at: null
        },
        include: {
          addresses: {
            where: { deleted_at: null },
            include: { address: true }
          },
          owner: true,
          type: true,
          documents: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' }
          },
          values: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' }
          },
          agency: true,
          leases: {
            where: { deleted_at: null },
            include: {
              tenant: true,
              owner: true
            }
          },
          favorites: {
            where: { deleted_at: null },
            include: { user: true }
          }
        }
      }) as unknown as PropertyWithRelations;

      if (!property) {
        throw new Error('Property not found');
      }

      return property;

    } catch (error: any) {
      throw error;
    }
  }

  static async createProperty(data: any) {
    try {
      const property = await prisma.$transaction(async (tx: any) => {
        const owner = await tx.owner.findUnique({
          where: { 
            id: data.owner_id,
            deleted_at: null
          }
        });

        if (!owner) {
          throw new Error('Owner not found');
        }

        const propertyType = await tx.propertyType.findUnique({
          where: { 
            id: data.type_id,
            deleted_at: null
          }
        });

        if (!propertyType) {
          throw new Error('Property type not found');
        }

        if (data.agency_id) {
          const agency = await tx.agency.findUnique({
            where: { 
              id: data.agency_id,
              deleted_at: null
            }
          });

          if (!agency) {
            throw new Error('Agency not found');
          }
        }

        const newProperty = await tx.property.create({
          data: {
            title: data.title,
            bedrooms: parseInt(data.bedrooms),
            bathrooms: parseInt(data.bathrooms),
            half_bathrooms: parseInt(data.half_bathrooms || 0),
            garage_spaces: parseInt(data.garage_spaces || 0),
            area_total: parseFloat(data.area_total),
            area_built: parseFloat(data.area_built || 0),
            frontage: parseFloat(data.frontage || 0),
            furnished: Boolean(data.furnished),
            floor_number: data.floor_number != null && data.floor_number !== '' ? parseInt(data.floor_number) : null,
            tax_registration: data.tax_registration,
            notes: data.notes,
            owner_id: data.owner_id,
            type_id: data.type_id,
            agency_id: data.agency_id || null,
          }
        });

        if (data.address) {
          const newAddress = await tx.address.create({
            data: {
              zip_code: data.address.zip_code,
              street: data.address.street,
              number: data.address.number,
              complement: data.address.complement || null,
              block: data.address.block || null,
              lot: data.address.lot || null,
              district: data.address.district,
              city: data.address.city,
              state: data.address.state,
              country: data.address.country || 'Brasil',
            }
          });

          await tx.propertyAddress.create({
            data: {
              property_id: newProperty.id,
              address_id: newAddress.id
            }
          });
        }

        if (data.values) {
          await tx.propertyValue.create({
            data: {
              property_id: newProperty.id,
              purchase_value: parseFloat(data.values.purchase_value),
              rental_value: parseFloat(data.values.rental_value),
              condo_fee: data.values.condo_fee != null && data.values.condo_fee !== '' ? parseFloat(data.values.condo_fee) : null,
              property_tax: parseFloat(data.values.property_tax || 0),
              sale_value: parseFloat(data.values.sale_value || 0),
              extra_charges: parseFloat(data.values.extra_charges || 0),
              status: data.values.status as PropertyStatus || 'AVAILABLE',
              notes: data.values.notes,
              sale_date: data.values.sale_date ? new Date(data.values.sale_date) : null,
            }
          });
        }

        return newProperty;
      });

      return property;

    } catch (error: any) {
      throw error;
    }
  }

  static async uploadFilesToProperty(
    propertyId: string, 
    files: Record<string, Express.Multer.File[]>, 
    userId: string
  ): Promise<any[]> {
    const uploadedDocuments = [];
    
    const fileTypes: Record<string, any> = {
      arquivosImagens: 'IMAGE',
      arquivosMatricula: 'REGISTRATION',
      arquivosRegistro: 'PROPERTY_RECORD',
      arquivosEscritura: 'TITLE_DEED',
      arquivosOutros: 'OTHER'
    };

    let userExists = false;
    
    if (userId && typeof userId === 'string' && userId.trim() !== '') {
      try {
        const userCount = await prisma.user.count({ where: { id: userId } });
        userExists = userCount > 0;
      } catch (e) {}
    }

    for (const [fieldName, docType] of Object.entries(fileTypes)) {
      if (files[fieldName] && files[fieldName].length > 0) {
        for (const file of files[fieldName]) {
          let blobResult;

          try {
            blobResult = await BlobService.uploadFile(
              file,
              file.originalname,
              `properties/${propertyId}`
            );
          } catch (uploadError: any) {
            throw new Error(`Erro na CDN ao processar arquivo ${file.originalname}: ${uploadError.message}`);
          }

          try {
            const fileNameWithoutExt = file.originalname.replace(/\.[^/.]+$/, "");
            
            const documentData: any = {
              property_id: propertyId,
              file_path: blobResult.url,
              file_type: file.mimetype?.substring(0, 100) || 'application/octet-stream',
              type: docType, 
              description: fileNameWithoutExt.substring(0, 250) 
            };

            if (userExists) {
              documentData.created_by = userId;
            }

            const document = await prisma.document.create({
              data: documentData
            });

            uploadedDocuments.push({
              id: document.id,
              type: docType,
              url: blobResult.url,
              filename: file.originalname, 
              name: fileNameWithoutExt, 
              displayName: fileNameWithoutExt, 
              mimetype: file.mimetype,
              size: file.size,
              description: fileNameWithoutExt 
            });

            await new Promise(resolve => setTimeout(resolve, 50));
            
          } catch (dbError: any) {
            throw new Error(`Falha no banco de dados ao salvar documento ${file.originalname}: ${dbError.message}`);
          }
        }
      }
    }

    return uploadedDocuments;
  }

  static async updateProperty(id: string, data: any) {
    try {
      const property = await prisma.$transaction(async (tx: any) => {
        const existing = await tx.property.findUnique({ 
          where: { 
            id,
            deleted_at: null 
          } 
        });
        
        if (!existing) {
          throw new Error('Property not found');
        }

        const updatedProperty = await tx.property.update({
          where: { id },
          data: {
            title: data.title,
            bedrooms: parseInt(data.bedrooms),
            bathrooms: parseInt(data.bathrooms),
            half_bathrooms: parseInt(data.half_bathrooms || 0),
            garage_spaces: parseInt(data.garage_spaces || 0),
            area_total: parseFloat(data.area_total),
            area_built: parseFloat(data.area_built || 0),
            frontage: parseFloat(data.frontage || 0),
            furnished: Boolean(data.furnished),
            floor_number: data.floor_number != null && data.floor_number !== '' ? parseInt(data.floor_number) : null,
            tax_registration: data.tax_registration,
            notes: data.notes,
            owner_id: data.owner_id,
            type_id: data.type_id,
            agency_id: data.agency_id || null,
          }
        });

        return updatedProperty;
      });

      return property;

    } catch (error: any) {
      throw error;
    }
  }

  static async deleteProperty(id: string) {
    try {
      const property = await prisma.property.findUnique({
        where: { 
          id,
          deleted_at: null
        },
      });

      if (!property) {
        throw new Error('Property not found or already deleted');
      }

      await prisma.property.update({
        where: { id },
        data: { deleted_at: new Date() }
      });

      return property;

    } catch (error: any) {
      throw error;
    }
  }

  static async restoreProperty(id: string) {
    try {
      const property = await prisma.property.findUnique({
        where: { id },
      });

      if (!property) {
        throw new Error('Property not found');
      }

      if (!property.deleted_at) {
        throw new Error('Property is not deleted');
      }

      await prisma.property.update({
        where: { id },
        data: { deleted_at: null }
      });
      
      return property;

    } catch (error: any) {
      throw error;
    }
  }

  static async getPropertyFilters(filters?: Record<string, any>) {
    try {
      const where: any = { deleted_at: null };
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            if (key === 'owner_id') {
              where.owner_id = value;
            } else if (key === 'type_id') {
              where.type_id = value;
            } else if (key === 'agency_id') {
              where.agency_id = value;
            } else if (key === 'city' || key === 'state' || key === 'district' || key === 'street') {
              where.addresses = {
                some: {
                  address: {
                    [key]: { contains: String(value), mode: 'insensitive' as Prisma.QueryMode }
                  }
                }
              };
            } else if (key === 'title' || key === 'tax_registration' || key === 'notes') {
              where[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
            }
          }
        });
      }

      const [
        properties,
        owners,
        propertyTypes,
        agencies,
        addresses,
        dateRange,
      ] = await Promise.all([
        prisma.property.findMany({
          where,
          select: {
            title: true,
            bedrooms: true,
            bathrooms: true,
            half_bathrooms: true,
            garage_spaces: true,
            area_total: true,
            area_built: true,
            frontage: true,
            furnished: true,
            floor_number: true,
            tax_registration: true,
            notes: true
          },
        }),
        prisma.owner.findMany({
          where: { deleted_at: null },
          select: { id: true, name: true },
          orderBy: { name: 'asc' }
        }),
        prisma.propertyType.findMany({
          where: { deleted_at: null },
          select: { id: true, description: true },
          orderBy: { description: 'asc' }
        }),
        prisma.agency.findMany({
          where: { deleted_at: null },
          select: { id: true, trade_name: true },
          orderBy: { trade_name: 'asc' }
        }),
        prisma.address.findMany({
          where: {
            deleted_at: null,
            propertyAddresses: {
              some: {
                property: {
                  deleted_at: null
                }
              }
            }
          },
          select: {
            city: true,
            state: true,
            district: true,
            street: true,
            zip_code: true
          },
          distinct: ['city', 'state', 'district', 'street', 'zip_code']
        }),
        prisma.property.aggregate({
          where,
          _min: { created_at: true },
          _max: { created_at: true }
        }),
      ]);

      const uniqueTitles = [...new Set(properties.filter(p => p.title).map(p => p.title.trim()))].sort();
      const uniqueTaxRegistrations = [...new Set(properties.filter(p => p.tax_registration).map(p => p.tax_registration.trim()))].sort();
      const uniqueCities = [...new Set(addresses.filter(a => a.city).map(a => a.city.trim()))].sort();
      const uniqueStates = [...new Set(addresses.filter(a => a.state).map(a => a.state.trim()))].sort();
      const uniqueDistricts = [...new Set(addresses.filter(a => a.district).map(a => a.district.trim()))].sort();
      const uniqueStreets = [...new Set(addresses.filter(a => a.street).map(a => a.street.trim()))].sort();
      const uniqueZipCodes = [...new Set(addresses.filter(a => a.zip_code).map(a => a.zip_code.trim()))].sort();

      const uniqueBedrooms = [...new Set(properties.filter(p => p.bedrooms !== null).map(p => p.bedrooms.toString()))]
        .sort((a, b) => parseInt(a) - parseInt(b));
      const uniqueBathrooms = [...new Set(properties.filter(p => p.bathrooms !== null).map(p => p.bathrooms.toString()))]
        .sort((a, b) => parseInt(a) - parseInt(b));
      const uniqueGarageSpaces = [...new Set(properties.filter(p => p.garage_spaces !== null).map(p => p.garage_spaces.toString()))]
        .sort((a, b) => parseInt(a) - parseInt(b));

      const filtersList = [
        {
          field: 'title',
          type: 'string',
          label: 'Título',
          description: 'Título da propriedade',
          values: uniqueTitles,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'bedrooms',
          type: 'number',
          label: 'Quartos',
          description: 'Número de quartos',
          values: uniqueBedrooms,
          searchable: true
        },
        {
          field: 'bathrooms',
          type: 'number',
          label: 'Banheiros',
          description: 'Número de banheiros',
          values: uniqueBathrooms,
          searchable: true
        },
        {
          field: 'garage_spaces',
          type: 'number',
          label: 'Vagas na Garagem',
          description: 'Número de vagas na garagem',
          values: uniqueGarageSpaces,
          searchable: true
        },
        {
          field: 'furnished',
          type: 'boolean',
          label: 'Mobiliado',
          description: 'Propriedade mobiliada',
          values: ['true', 'false'],
          options: ['true', 'false']
        },
        {
          field: 'tax_registration',
          type: 'string',
          label: 'Inscrição fiscal',
          description: 'Inscrição fiscal da propriedade',
          values: uniqueTaxRegistrations,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'owner_id',
          type: 'select',
          label: 'Proprietário',
          description: 'Proprietário da propriedade',
          options: owners.map(o => ({ value: o.id, label: o.name })),
          searchable: true
        },
        {
          field: 'type_id',
          type: 'select',
          label: 'Tipo do imóvel',
          description: 'Tipo da propriedade',
          options: propertyTypes.map(t => ({ value: t.id, label: t.description })),
          searchable: true
        },
        {
          field: 'agency_id',
          type: 'select',
          label: 'Agência',
          description: 'Agência responsável',
          options: agencies.map(a => ({ value: a.id, label: a.trade_name })),
          searchable: true
        },
        {
          field: 'city',
          type: 'string',
          label: 'Cidade',
          description: 'Cidade da propriedade',
          values: uniqueCities,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'state',
          type: 'string',
          label: 'Estado',
          description: 'Estado da propriedade',
          values: uniqueStates,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'district',
          type: 'string',
          label: 'Bairro',
          description: 'Bairro da propriedade',
          values: uniqueDistricts,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'street',
          type: 'string',
          label: 'Endereço',
          description: 'Endereço da propriedade',
          values: uniqueStreets,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'zip_code',
          type: 'string',
          label: 'CEP',
          description: 'CEP da propriedade',
          values: uniqueZipCodes,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'created_at',
          type: 'date',
          label: 'Criado em',
          description: 'Data de criação do registro',
          min: dateRange._min.created_at?.toISOString().split('T')[0],
          max: dateRange._max.created_at?.toISOString().split('T')[0],
          dateRange: true
        }
      ];

      const operators = {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals'],
        select: ['equals', 'in']
      };

      return {
        filters: filtersList,
        operators,
        defaultSort: 'created_at:desc',
        searchFields: [
          'title',
          'tax_registration',
          'notes',
          'owner.name',
          'type.description',
          'agency.trade_name',
          'address.city',
          'address.state',
          'address.district',
          'address.street',
          'address.zip_code'
        ]
      };

    } catch (error) {
      throw error;
    }
  }

  static async createPropertyWithFiles(data: any, files: Record<string, Express.Multer.File[]>, userId: string) {
    try {
      const { property, address, propertyValue } = await prisma.$transaction(async (tx: any) => {
        const owner = await tx.owner.findUnique({
          where: { id: data.owner_id, deleted_at: null }
        });
        if (!owner) throw new Error('Proprietário não encontrado');

        const propertyType = await tx.propertyType.findUnique({
          where: { id: data.type_id, deleted_at: null }
        });
        if (!propertyType) throw new Error('Tipo de propriedade não encontrado');

        if (data.agency_id) {
          const agency = await tx.agency.findUnique({
            where: { id: data.agency_id, deleted_at: null }
          });
          if (!agency) throw new Error('Agência não encontrada');
        }

        const property = await tx.property.create({
          data: {
            title: data.title,
            bedrooms: parseInt(data.bedrooms),
            bathrooms: parseInt(data.bathrooms),
            half_bathrooms: parseInt(data.half_bathrooms || 0),
            garage_spaces: parseInt(data.garage_spaces || 0),
            area_total: parseFloat(data.area_total),
            area_built: parseFloat(data.area_built || 0),
            frontage: parseFloat(data.frontage || 0),
            furnished: Boolean(data.furnished),
            floor_number: data.floor_number != null && data.floor_number !== '' ? parseInt(data.floor_number) : null,
            tax_registration: data.tax_registration,
            notes: data.notes,
            owner_id: data.owner_id,
            type_id: data.type_id,
            agency_id: data.agency_id || null,
          }
        });

        let address = null;
        if (data.address) {
          const newAddress = await tx.address.create({
            data: {
              zip_code: data.address.zip_code,
              street: data.address.street,
              number: data.address.number,
              complement: data.address.complement || null,
              block: data.address.block || null,
              lot: data.address.lot || null,
              district: data.address.district,
              city: data.address.city,
              state: data.address.state,
              country: data.address.country || 'Brasil',
            }
          });

          await tx.propertyAddress.create({
            data: {
              property_id: property.id,
              address_id: newAddress.id
            }
          });

          address = newAddress;
        }

        let propertyValue = null;
        if (data.values) {
          propertyValue = await tx.propertyValue.create({
            data: {
              property_id: property.id,
              purchase_value: parseFloat(data.values.purchase_value),
              rental_value: parseFloat(data.values.rental_value),
              condo_fee: data.values.condo_fee != null && data.values.condo_fee !== '' ? parseFloat(data.values.condo_fee) : null,
              property_tax: parseFloat(data.values.property_tax || 0),
              status: data.values.status as PropertyStatus || 'AVAILABLE',
              notes: data.values.notes,
              sale_value: parseFloat(data.values.sale_value || 0),
              extra_charges: parseFloat(data.values.extra_charges || 0),
              sale_date: data.values.sale_date ? new Date(data.values.sale_date) : null,
            }
          });
        }

        return { property, address, propertyValue };
      }, {
        timeout: 10000, 
      });

      const uploadedDocuments = await this.uploadFilesToProperty(property.id, files, userId);

      const fullProperty = await prisma.property.findUnique({
        where: { id: property.id },
        include: {
          addresses: {
            include: { address: true }
          },
          owner: true,
          type: true,
          documents: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' }
          },
          values: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' }
          },
          agency: true
        }
      });

      return {
        property: fullProperty,
        uploadedDocuments,
        message: 'Propriedade criada com sucesso'
      };

    } catch (error: any) {
      throw error;
    }
  }

  static async createUnifiedProperty(data: any) {
    try {
      const propertyData = data.property;
      const addressData = data.address;
      const valuesData = data.values;
      const userId = data.userId;
      
      return await this.createPropertyWithFiles(
        { ...propertyData, address: addressData, values: valuesData },
        data.files || {},
        userId
      );
    } catch (error) {
      throw error;
    }
  }

  static async updatePropertyWithFiles(
    id: string, 
    data: any, 
    files: Record<string, Express.Multer.File[]>, 
    userId: string,
    removedDocuments: string[] = []
  ) {
    try {
      if (removedDocuments.length > 0) {
        await prisma.document.updateMany({
          where: {
            id: { in: removedDocuments },
            property_id: id
          },
          data: { deleted_at: new Date() }
        });
      }

      const { property, address, propertyValue } = await prisma.$transaction(async (tx: any) => {
        const existingProperty = await tx.property.findUnique({
          where: { id, deleted_at: null }
        });
        if (!existingProperty) throw new Error('Propriedade não encontrada');

        const owner = await tx.owner.findUnique({
          where: { id: data.owner_id, deleted_at: null }
        });
        if (!owner) throw new Error('Proprietário não encontrado');

        const propertyType = await tx.propertyType.findUnique({
          where: { id: data.type_id, deleted_at: null }
        });
        if (!propertyType) throw new Error('Tipo de propriedade não encontrado');

        if (data.agency_id) {
          const agency = await tx.agency.findUnique({
            where: { id: data.agency_id, deleted_at: null }
          });
          if (!agency) throw new Error('Agência não encontrada');
        }

        const property = await tx.property.update({
          where: { id },
          data: {
            title: data.title,
            bedrooms: parseInt(data.bedrooms),
            bathrooms: parseInt(data.bathrooms),
            half_bathrooms: parseInt(data.half_bathrooms || 0),
            garage_spaces: parseInt(data.garage_spaces || 0),
            area_total: parseFloat(data.area_total),
            area_built: parseFloat(data.area_built || 0),
            frontage: parseFloat(data.frontage || 0),
            furnished: Boolean(data.furnished),
            floor_number: data.floor_number != null && data.floor_number !== '' ? parseInt(data.floor_number) : null,
            tax_registration: data.tax_registration,
            notes: data.notes,
            owner_id: data.owner_id,
            type_id: data.type_id,
            agency_id: data.agency_id || null,
          }
        });

        let address = null;
        if (data.address) {
          const propertyAddress = await tx.propertyAddress.findFirst({
            where: { property_id: id, deleted_at: null },
            include: { address: true }
          });

          if (propertyAddress) {
            address = await tx.address.update({
              where: { id: propertyAddress.address.id },
              data: {
                zip_code: data.address.zip_code,
                street: data.address.street,
                number: data.address.number,
                complement: data.address.complement || null,
                block: data.address.block || null,
                lot: data.address.lot || null,
                district: data.address.district,
                city: data.address.city,
                state: data.address.state,
                country: data.address.country || 'Brasil',
              }
            });
          } else {
            const newAddress = await tx.address.create({
              data: {
                zip_code: data.address.zip_code,
                street: data.address.street,
                number: data.address.number,
                complement: data.address.complement || null,
                block: data.address.block || null,
                lot: data.address.lot || null,
                district: data.address.district,
                city: data.address.city,
                state: data.address.state,
                country: data.address.country || 'Brasil',
              }
            });

            await tx.propertyAddress.create({
              data: {
                property_id: property.id,
                address_id: newAddress.id
              }
            });

            address = newAddress;
          }
        }

        let propertyValue = null;
        if (data.values) {
          const currentValue = await tx.propertyValue.findFirst({
            where: { property_id: id, deleted_at: null }
          });

          if (currentValue) {
            propertyValue = await tx.propertyValue.update({
              where: { id: currentValue.id },
              data: {
                purchase_value: parseFloat(data.values.purchase_value),
                rental_value: parseFloat(data.values.rental_value),
                condo_fee: data.values.condo_fee != null && data.values.condo_fee !== '' ? parseFloat(data.values.condo_fee) : null,
                property_tax: parseFloat(data.values.property_tax || 0),
                status: data.values.status as PropertyStatus || 'AVAILABLE',
                notes: data.values.notes,
                sale_date: data.values.sale_date ? new Date(data.values.sale_date) : null,
                sale_value: parseFloat(data.values.sale_value || 0),
                extra_charges: parseFloat(data.values.extra_charges || 0),
              }
            });
          } else {
            propertyValue = await tx.propertyValue.create({
              data: {
                property_id: property.id,
                purchase_value: parseFloat(data.values.purchase_value),
                rental_value: parseFloat(data.values.rental_value),
                condo_fee: data.values.condo_fee != null && data.values.condo_fee !== '' ? parseFloat(data.values.condo_fee) : null,
                property_tax: parseFloat(data.values.property_tax || 0),
                status: data.values.status as PropertyStatus || 'AVAILABLE',
                notes: data.values.notes,
                sale_date: data.values.sale_date ? new Date(data.values.sale_date) : null,
                sale_value: parseFloat(data.values.sale_value || 0),
                extra_charges: parseFloat(data.values.extra_charges || 0),
              }
            });
          }
        }

        return { property, address, propertyValue };
      }, {
        timeout: 10000,
      });

      const uploadedDocuments = await this.uploadFilesToProperty(property.id, files, userId);

      const fullProperty = await prisma.property.findUnique({
        where: { id: property.id },
        include: {
          addresses: {
            include: { address: true }
          },
          owner: true,
          type: true,
          documents: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' }
          },
          values: {
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' }
          },
          agency: true
        }
      });

      return {
        property: fullProperty,
        uploadedDocuments,
        removedDocuments,
        message: 'Propriedade atualizada com sucesso'
      };

    } catch (error: any) {
      throw error;
    }
  }
}