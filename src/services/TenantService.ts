import prisma from '../lib/prisma';
import { GetTenantsParams, PaginatedTenantResponse } from '../types/tenant';

export class TenantService {
  static async getTenants(params: GetTenantsParams = {}): Promise<PaginatedTenantResponse> {
    try {
      console.log('🔍 Executing getTenants with params:', params);
      
      const { 
        limit = 10, 
        page = 1, 
        search = '',
        sortOptions = {},
        includeInactive = false 
      } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      // Construir where clause
      const where: any = {};
      
      // Por padrão, não mostra deletados
      if (!includeInactive) {
        where.deleted_at = null;
      }
      
      if (search) {
        const searchTerm = search.trim();
        where.OR = [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { internal_code: { contains: searchTerm, mode: 'insensitive' } },
          { occupation: { contains: searchTerm, mode: 'insensitive' } },
          { marital_status: { contains: searchTerm, mode: 'insensitive' } },
          { cpf: { contains: searchTerm, mode: 'insensitive' } },
          { cnpj: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }

      // Construir orderBy a partir de sortOptions
      const orderBy: any[] = [];
      
      if (sortOptions.sort_id) {
        orderBy.push({ id: sortOptions.sort_id.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_name) {
        orderBy.push({ name: sortOptions.sort_name.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_internal_code) {
        orderBy.push({ internal_code: sortOptions.sort_internal_code.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_occupation) {
        orderBy.push({ occupation: sortOptions.sort_occupation.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_marital_status) {
        orderBy.push({ marital_status: sortOptions.sort_marital_status.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_cnpj) {
        orderBy.push({ cnpj: sortOptions.sort_cnpj.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_cpf) {
        orderBy.push({ cpf: sortOptions.sort_cpf.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }

      // Ordenação padrão se não houver sortOptions
      if (orderBy.length === 0) {
        orderBy.push({ id: 'asc' });
      }

      console.log('📊 Query parameters:', { where, skip, take, orderBy });

      // Buscar dados
      const tenants = await prisma.tenant.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          addresses: {
            where: { deleted_at: null },
            include: {
              address: true
            }
          },
          contacts: {
            where: { deleted_at: null },
            include: {
              contact: true
            }
          }
        }
      }) as any;

      // Contar total
      const total = await prisma.tenant.count({ where });

      console.log(`✅ Found ${tenants.length} tenants, total: ${total}`);

      return {
        data: tenants || [],
        count: total || 0,
        totalPages: total ? Math.ceil(total / take) : 0,
        currentPage: page,
      };

    } catch (error: any) {
      console.error('❌ Error in TenantService.getTenants:', error);
      throw new Error('Failed to fetch tenants');
    }
  }

  static async getTenantById(id: string) {
    try {
      console.log(`🔍 Getting tenant by ID: ${id}`);
      
      const tenant = await prisma.tenant.findUnique({
        where: { 
          id,
          deleted_at: null // Só retorna se não estiver deletado
        },
        include: {
          leases: true,
          addresses: {
            where: { deleted_at: null },
            include: {
              address: true
            }
          },
          contacts: {
            where: { deleted_at: null },
            include: {
              contact: true
            }
          }
        }
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      console.log(`✅ Found tenant: ${tenant.name}`);
      return tenant;

    } catch (error: any) {
      console.error(`❌ Error getting tenant ${id}:`, error);
      throw error;
    }
  }

  static async createTenant(data: any) {
    try {
      console.log('➕ Creating new tenant:', data.name);
      
      const tenant = await prisma.$transaction(async (tx: any) => {
        // Verificar CPF único se fornecido
        if (data.cpf) {
          const existingCPF = await tx.tenant.findFirst({
            where: { 
              cpf: data.cpf,
              deleted_at: null
            }
          });

          if (existingCPF) {
            throw new Error('CPF already registered');
          }
        }

        // Verificar CNPJ único se fornecido
        if (data.cnpj) {
          const existingCNPJ = await tx.tenant.findFirst({
            where: { 
              cnpj: data.cnpj,
              deleted_at: null
            }
          });

          if (existingCNPJ) {
            throw new Error('CNPJ already registered');
          }
        }

        // Criar inquilino
        const newTenant = await tx.tenant.create({
          data: {
            name: data.name,
            internal_code: data.internal_code,
            occupation: data.occupation,
            marital_status: data.marital_status,
            cpf: data.cpf || null,
            cnpj: data.cnpj || null,
          }
        });

        // Adicionar contatos
        if (data.contacts && data.contacts.length > 0) {
          for (const contact of data.contacts) {
            const newContact = await tx.contact.create({
              data: {
                contact: contact.contact,
                phone: contact.phone,
                email: contact.email || null,
                whatsapp: contact.whatsapp || false,
              }
            });

            await tx.tenantContact.create({
              data: {
                tenant_id: newTenant.id,
                contact_id: newContact.id
              }
            });
          }
        }

        // Adicionar endereços
        if (data.addresses && data.addresses.length > 0) {
          for (const address of data.addresses) {
            const newAddress = await tx.address.create({
              data: {
                zip_code: address.zip_code,
                street: address.street,
                number: address.number,
                district: address.district,
                city: address.city,
                state: address.state,
                country: address.country || 'Brasil',
              }
            });

            await tx.tenantAddress.create({
              data: {
                tenant_id: newTenant.id,
                address_id: newAddress.id
              }
            });
          }
        }

        return newTenant;
      });

      console.log(`✅ Tenant created: ${tenant.id}`);
      return tenant;

    } catch (error: any) {
      console.error('❌ Error creating tenant:', error);
      throw error;
    }
  }

  static async updateTenant(id: string, data: any) {
    try {
      console.log(`✏️ Updating tenant: ${id}`);
      
      const tenant = await prisma.$transaction(async (tx: any) => {
        // Verificar se existe e não está deletada
        const existing = await tx.tenant.findUnique({ 
          where: { 
            id,
            deleted_at: null 
          } 
        });
        
        if (!existing) {
          throw new Error('Tenant not found');
        }

        // Verificar CPF único se mudou
        if (data.cpf && data.cpf !== existing.cpf) {
          const cpfExists = await tx.tenant.findFirst({
            where: { 
              cpf: data.cpf, 
              NOT: { id },
              deleted_at: null
            }
          });
          
          if (cpfExists) {
            throw new Error('CPF already registered for another tenant');
          }
        }

        // Verificar CNPJ único se mudou
        if (data.cnpj && data.cnpj !== existing.cnpj) {
          const cnpjExists = await tx.tenant.findFirst({
            where: { 
              cnpj: data.cnpj, 
              NOT: { id },
              deleted_at: null
            }
          });
          
          if (cnpjExists) {
            throw new Error('CNPJ already registered for another tenant');
          }
        }

        // Atualizar dados básicos
        const updatedTenant = await tx.tenant.update({
          where: { id },
          data: {
            name: data.name,
            internal_code: data.internal_code,
            occupation: data.occupation,
            marital_status: data.marital_status,
            cpf: data.cpf !== undefined ? data.cpf : existing.cpf,
            cnpj: data.cnpj !== undefined ? data.cnpj : existing.cnpj,
          }
        });

        // Atualizar contatos (substituir todos) se fornecido
        if (data.contacts !== undefined) {
          // Soft delete dos contatos existentes
          await tx.tenantContact.updateMany({
            where: { 
              tenant_id: id,
              deleted_at: null 
            },
            data: { deleted_at: new Date() }
          });

          // Adicionar novos contatos
          if (data.contacts && data.contacts.length > 0) {
            for (const contact of data.contacts) {
              const newContact = await tx.contact.create({
                data: {
                  contact: contact.contact,
                  phone: contact.phone,
                  email: contact.email || null,
                  whatsapp: contact.whatsapp || false,
                }
              });

              await tx.tenantContact.create({
                data: {
                  tenant_id: id,
                  contact_id: newContact.id
                }
              });
            }
          }
        }

        // Atualizar endereços (substituir todos) se fornecido
        if (data.addresses !== undefined) {
          // Soft delete dos endereços existentes
          await tx.tenantAddress.updateMany({
            where: { 
              tenant_id: id,
              deleted_at: null 
            },
            data: { deleted_at: new Date() }
          });

          // Adicionar novos endereços
          if (data.addresses && data.addresses.length > 0) {
            for (const address of data.addresses) {
              const newAddress = await tx.address.create({
                data: {
                  zip_code: address.zip_code,
                  street: address.street,
                  number: address.number,
                  district: address.district,
                  city: address.city,
                  state: address.state,
                  country: address.country || 'Brasil',
                }
              });

              await tx.tenantAddress.create({
                data: {
                  tenant_id: id,
                  address_id: newAddress.id
                }
              });
            }
          }
        }

        return updatedTenant;
      });

      console.log(`✅ Tenant updated: ${tenant.id}`);
      return tenant;

    } catch (error: any) {
      console.error(`❌ Error updating tenant ${id}:`, error);
      throw error;
    }
  }

  static async deleteTenant(id: string) {
    try {
      console.log(`🗑️ Soft deleting tenant: ${id}`);
      
      // Verificar se o inquilino existe e não está deletado
      const tenant = await prisma.tenant.findUnique({
        where: { 
          id,
          deleted_at: null
        },
      });

      if (!tenant) {
        throw new Error('Tenant not found or already deleted');
      }

      // SOFT DELETE: atualizar o campo deleted_at
      await prisma.tenant.update({
        where: { id },
        data: { 
          deleted_at: new Date(),
          // Também soft delete dos contatos e endereços relacionados
          contacts: {
            updateMany: {
              where: { tenant_id: id },
              data: { deleted_at: new Date() }
            }
          },
          addresses: {
            updateMany: {
              where: { tenant_id: id },
              data: { deleted_at: new Date() }
            }
          }
        },
      });

      console.log(`✅ Tenant soft deleted: ${id}`);
      return tenant;

    } catch (error: any) {
      console.error(`❌ Error soft deleting tenant ${id}:`, error);
      throw error;
    }
  }

  static async restoreTenant(id: string) {
    try {
      console.log(`♻️ Restoring tenant: ${id}`);
      
      // Verificar se o inquilino existe
      const tenant = await prisma.tenant.findUnique({
        where: { id },
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      if (!tenant.deleted_at) {
        throw new Error('Tenant is not deleted');
      }

      // Restaurar: setar deleted_at para null
      await prisma.tenant.update({
        where: { id },
        data: { 
          deleted_at: null,
          // Restaurar contatos e endereços relacionados
          contacts: {
            updateMany: {
              where: { tenant_id: id },
              data: { deleted_at: null }
            }
          },
          addresses: {
            updateMany: {
              where: { tenant_id: id },
              data: { deleted_at: null }
            }
          }
        }
      });
      
      console.log(`✅ Tenant restored: ${id}`);
      return tenant;

    } catch (error: any) {
      console.error(`❌ Error restoring tenant ${id}:`, error);
      throw error;
    }
  }

  static async getTenantFilters() {
    try {
      console.log('🔍 Building comprehensive tenant filters...');

      // Buscar todos os campos únicos para filtros
      const [
        names,
        internalCodes,
        occupations,
        maritalStatuses,
        cpfs,
        cnpjs,
        cities,
        states,
        countries,
        districts,
        contactNames,
        contactPhones,
        contactEmails,
        whatsappStatus,
        dateRange
      ] = await Promise.all([
        // Campos da tabela Tenant
        prisma.tenant.findMany({
          select: { name: true },
          distinct: ['name'],
          where: { deleted_at: null },
          orderBy: { name: 'asc' }
        }),
        prisma.tenant.findMany({
          select: { internal_code: true },
          distinct: ['internal_code'],
          where: { deleted_at: null },
          orderBy: { internal_code: 'asc' }
        }),
        prisma.tenant.findMany({
          select: { occupation: true },
          distinct: ['occupation'],
          where: { deleted_at: null },
          orderBy: { occupation: 'asc' }
        }),
        prisma.tenant.findMany({
          select: { marital_status: true },
          distinct: ['marital_status'],
          where: { deleted_at: null },
          orderBy: { marital_status: 'asc' }
        }),
        prisma.tenant.findMany({
          select: { cpf: true },
          distinct: ['cpf'],
          where: { 
            cpf: { not: null },
            deleted_at: null 
          },
          orderBy: { cpf: 'asc' }
        }),
        prisma.tenant.findMany({
          select: { cnpj: true },
          distinct: ['cnpj'],
          where: { 
            cnpj: { not: null },
            deleted_at: null 
          },
          orderBy: { cnpj: 'asc' }
        }),

        // Campos da tabela Address (relacionamento)
        prisma.address.findMany({
          select: { city: true },
          distinct: ['city'],
          where: { 
            city: { not: undefined },
            deleted_at: null,
            tenantAddresses: {
              some: {
                tenant: {
                  deleted_at: null
                }
              }
            }
          },
          orderBy: { city: 'asc' }
        }),
        prisma.address.findMany({
          select: { state: true },
          distinct: ['state'],
          where: { 
            state: { not: undefined },
            deleted_at: null,
            tenantAddresses: {
              some: {
                tenant: {
                  deleted_at: null
                }
              }
            }
          },
          orderBy: { state: 'asc' }
        }),
        prisma.address.findMany({
          select: { country: true },
          distinct: ['country'],
          where: { 
            country: { not: undefined },
            deleted_at: null,
            tenantAddresses: {
              some: {
                tenant: {
                  deleted_at: null
                }
              }
            }
          },
          orderBy: { country: 'asc' }
        }),
        prisma.address.findMany({
          select: { district: true },
          distinct: ['district'],
          where: { 
            district: { not: undefined },
            deleted_at: null,
            tenantAddresses: {
              some: {
                tenant: {
                  deleted_at: null
                }
              }
            }
          },
          orderBy: { district: 'asc' }
        }),

        // Campos da tabela Contact (relacionamento)
        prisma.contact.findMany({
          select: { contact: true },
          distinct: ['contact'],
          where: { 
            contact: { not: undefined },
            deleted_at: null,
            tenantContacts: {
              some: {
                tenant: {
                  deleted_at: null
                }
              }
            }
          },
          orderBy: { contact: 'asc' }
        }),
        prisma.contact.findMany({
          select: { phone: true },
          distinct: ['phone'],
          where: { 
            phone: { not: undefined },
            deleted_at: null,
            tenantContacts: {
              some: {
                tenant: {
                  deleted_at: null
                }
              }
            }
          },
          orderBy: { phone: 'asc' }
        }),
        prisma.contact.findMany({
          select: { email: true },
          distinct: ['email'],
          where: { 
            email: { not: null },
            deleted_at: null,
            tenantContacts: {
              some: {
                tenant: {
                  deleted_at: null
                }
              }
            }
          },
          orderBy: { email: 'asc' }
        }),
        prisma.contact.findMany({
          select: { whatsapp: true },
          distinct: ['whatsapp'],
          where: { 
            deleted_at: null,
            tenantContacts: {
              some: {
                tenant: {
                  deleted_at: null
                }
              }
            }
          }
        }),

        // Data range para filtros de data
        prisma.tenant.aggregate({
          where: { deleted_at: null },
          _min: { created_at: true },
          _max: { created_at: true }
        })
      ]);

      // Construir filtros para todos os campos
      const filters = [
        {
          field: 'id',
          type: 'string',
          label: 'ID',
          description: 'Identificador único'
        },
        {
          field: 'name',
          type: 'string',
          label: 'Nome',
          description: 'Nome completo',
          values: names
            .filter(t => t.name)
            .map(t => t.name.trim()),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'internal_code',
          type: 'string',
          label: 'Código Interno',
          description: 'Código interno do inquilino',
          values: internalCodes
            .filter(t => t.internal_code)
            .map(t => t.internal_code.trim()),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'occupation',
          type: 'string',
          label: 'Ocupação',
          description: 'Profissão/ocupação',
          values: occupations
            .filter(t => t.occupation)
            .map(t => t.occupation.trim()),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'marital_status',
          type: 'string',
          label: 'Estado Civil',
          description: 'Estado civil',
          values: maritalStatuses
            .filter(t => t.marital_status)
            .map(t => t.marital_status.trim()),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'cpf',
          type: 'string',
          label: 'CPF',
          description: 'Cadastro de Pessoa Física',
          values: cpfs
            .filter(t => t.cpf)
            .map(t => t.cpf?.trim()),
          searchable: true,
          autocomplete: true,
          mask: '999.999.999-99'
        },
        {
          field: 'cnpj',
          type: 'string',
          label: 'CNPJ',
          description: 'Cadastro Nacional da Pessoa Jurídica',
          values: cnpjs
            .filter(t => t.cnpj)
            .map(t => t.cnpj?.trim()),
          searchable: true,
          autocomplete: true,
          mask: '99.999.999/9999-99'
        },
        {
          field: 'created_at',
          type: 'date',
          label: 'Data de Criação',
          description: 'Data de cadastro no sistema',
          min: dateRange._min?.created_at?.toISOString(),
          max: dateRange._max?.created_at?.toISOString(),
          dateRange: true
        },
        {
          field: 'updated_at',
          type: 'date',
          label: 'Data de Atualização',
          description: 'Última atualização',
          dateRange: true
        },

        // Campos de Address (endereço)
        {
          field: 'address.zip_code',
          type: 'string',
          label: 'CEP',
          description: 'Código de Endereçamento Postal',
          searchable: true,
          mask: '99999-999'
        },
        {
          field: 'address.street',
          type: 'string',
          label: 'Rua',
          description: 'Logradouro',
          searchable: true
        },
        {
          field: 'address.number',
          type: 'string',
          label: 'Número',
          description: 'Número do endereço',
          searchable: true
        },
        {
          field: 'address.district',
          type: 'string',
          label: 'Bairro',
          description: 'Bairro',
          values: districts
            .filter(a => a.district)
            .map(a => a.district.trim()),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'address.city',
          type: 'string',
          label: 'Cidade',
          description: 'Cidade',
          values: cities
            .filter(a => a.city)
            .map(a => a.city.trim()),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'address.state',
          type: 'string',
          label: 'Estado',
          description: 'Unidade Federativa',
          values: states
            .filter(a => a.state)
            .map(a => a.state.trim()),
          searchable: true,
          autocomplete: true,
          options: [
            'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
            'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
            'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
          ]
        },
        {
          field: 'address.country',
          type: 'string',
          label: 'País',
          description: 'País',
          values: countries
            .filter(a => a.country)
            .map(a => a.country.trim()),
          searchable: true,
          autocomplete: true,
          defaultValue: 'Brasil'
        },

        // Campos de Contact (contato)
        {
          field: 'contact.contact',
          type: 'string',
          label: 'Nome do Contato',
          description: 'Nome da pessoa para contato',
          values: contactNames
            .filter(c => c.contact)
            .map(c => c.contact.trim()),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'contact.phone',
          type: 'string',
          label: 'Telefone',
          description: 'Número de telefone',
          values: contactPhones
            .filter(c => c.phone)
            .map(c => c.phone.trim()),
          searchable: true,
          autocomplete: true,
          mask: '(99) 99999-9999'
        },
        {
          field: 'contact.email',
          type: 'string',
          label: 'E-mail',
          description: 'Endereço de e-mail',
          values: contactEmails
            .filter(c => c.email)
            .map(c => c.email?.trim()),
          searchable: true,
          autocomplete: true,
          inputType: 'email'
        },
        {
          field: 'contact.whatsapp',
          type: 'boolean',
          label: 'Tem WhatsApp',
          description: 'Contato disponível no WhatsApp',
          values: whatsappStatus
            .map(w => w.whatsapp.toString()),
          options: ['true', 'false'],
          defaultValue: 'true'
        }
      ];

      const operators = {
        string: ['equals', 'contains', 'startsWith', 'endsWith', 'in', 'not'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between', 'not'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals']
      };

      return {
        filters: filters.filter(f => !f.values || f.values.length > 0),
        operators,
        defaultSort: 'created_at:desc',
        searchFields: [
          'name',
          'internal_code',
          'cpf',
          'cnpj',
          'address.city',
          'address.state',
          'contact.contact',
          'contact.email'
        ]
      };

    } catch (error) {
      console.error('❌ Error getting comprehensive tenant filters:', error);
      throw error;
    }
  }
}