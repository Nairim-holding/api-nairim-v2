import prisma from '../lib/prisma';

export class AgencyService {
  static async getAgencies(params: any = {}) {
    try {
      console.log('🔍 Executing getAgencies with params:', params);
      
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
          { trade_name: { contains: searchTerm, mode: 'insensitive' } },
          { legal_name: { contains: searchTerm, mode: 'insensitive' } },
          { cnpj: { contains: searchTerm, mode: 'insensitive' } },
          { state_registration: { contains: searchTerm, mode: 'insensitive' } },
          { municipal_registration: { contains: searchTerm, mode: 'insensitive' } },
          { license_number: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }

      // Construir orderBy a partir de sortOptions
      const orderBy: any[] = [];
      
      // Mapear sortOptions para orderBy do Prisma
      if (sortOptions.sort_id) {
        orderBy.push({ id: sortOptions.sort_id.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_trade_name) {
        orderBy.push({ trade_name: sortOptions.sort_trade_name.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_legal_name) {
        orderBy.push({ legal_name: sortOptions.sort_legal_name.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_cnpj) {
        orderBy.push({ cnpj: sortOptions.sort_cnpj.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_state_registration) {
        orderBy.push({ state_registration: sortOptions.sort_state_registration.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_municipal_registration) {
        orderBy.push({ municipal_registration: sortOptions.sort_municipal_registration.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }
      if (sortOptions.sort_license_number) {
        orderBy.push({ license_number: sortOptions.sort_license_number.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      }

      // Ordenação padrão se não houver sortOptions
      if (orderBy.length === 0) {
        orderBy.push({ id: 'asc' });
      }

      console.log('📊 Query parameters:', { where, skip, take, orderBy });

      // Buscar dados
      const agencies = await prisma.agency.findMany({
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
      });

      // Contar total
      const total = await prisma.agency.count({ where });

      console.log(`✅ Found ${agencies.length} agencies, total: ${total}`);

      // Retornar no formato esperado pelo controller original
      return {
        data: agencies || [],
        count: total || 0,
        totalPages: total ? Math.ceil(total / take) : 0,
        currentPage: page,
      };

    } catch (error: any) {
      console.error('❌ Error in AgencyService.getAgencies:', error);
      throw new Error('Failed to fetch agencies');
    }
  }

  static async getAgencyById(id: string) {
    try {
      console.log(`🔍 Getting agency by ID: ${id}`);
      
      const agency = await prisma.agency.findUnique({
        where: { 
          id,
          deleted_at: null // Só retorna se não estiver deletado
        },
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
      });

      if (!agency) {
        throw new Error('Agency not found');
      }

      console.log(`✅ Found agency: ${agency.trade_name}`);
      return agency;

    } catch (error: any) {
      console.error(`❌ Error getting agency ${id}:`, error);
      throw error;
    }
  }

  static async createAgency(data: any) {
    try {
      console.log('➕ Creating new agency:', data.trade_name);
      
      const agency = await prisma.$transaction(async (tx: any) => {
        // Verificar CNPJ único
        const existing = await tx.agency.findFirst({
          where: { 
            cnpj: data.cnpj,
            deleted_at: null // Não considerar deletados
          }
        });

        if (existing) {
          throw new Error('CNPJ already registered');
        }

        // Criar agência
        const newAgency = await tx.agency.create({
          data: {
            trade_name: data.trade_name,
            legal_name: data.legal_name,
            cnpj: data.cnpj,
            state_registration: data.state_registration,
            municipal_registration: data.municipal_registration,
            license_number: data.license_number,
          }
        });

        // Adicionar contatos
        if (data.contacts && data.contacts.length > 0) {
          for (const contact of data.contacts) {
            const newContact = await tx.contact.create({
              data: {
                contact: contact.contact,
                phone: contact.phone,
                email: contact.email,
                whatsapp: contact.whatsapp || false,
              }
            });

            await tx.agencyContact.create({
              data: {
                agency_id: newAgency.id,
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
                number: String(address.number),
                district: address.district,
                city: address.city,
                state: address.state,
                country: address.country || 'Brasil',
              }
            });

            await tx.agencyAddress.create({
              data: {
                agency_id: newAgency.id,
                address_id: newAddress.id
              }
            });
          }
        }

        return newAgency;
      });

      console.log(`✅ Agency created: ${agency.id}`);
      return agency;

    } catch (error: any) {
      console.error('❌ Error creating agency:', error);
      throw error;
    }
  }

  static async updateAgency(id: string, data: any) {
    try {
      console.log(`✏️ Updating agency: ${id}`);
      
      const agency = await prisma.$transaction(async (tx: any) => {
        // Verificar se existe e não está deletada
        const existing = await tx.agency.findUnique({ 
          where: { 
            id,
            deleted_at: null 
          } 
        });
        
        if (!existing) {
          throw new Error('Agency not found');
        }

        // Verificar CNPJ único se mudou
        if (data.cnpj && data.cnpj !== existing.cnpj) {
          const cnpjExists = await tx.agency.findFirst({
            where: { 
              cnpj: data.cnpj, 
              NOT: { id },
              deleted_at: null // Não considerar deletados
            }
          });
          
          if (cnpjExists) {
            throw new Error('CNPJ already registered for another agency');
          }
        }

        // Atualizar dados básicos
        const updatedAgency = await tx.agency.update({
          where: { id },
          data: {
            trade_name: data.trade_name,
            legal_name: data.legal_name,
            cnpj: data.cnpj,
            state_registration: data.state_registration,
            municipal_registration: data.municipal_registration,
            license_number: data.license_number,
          }
        });

        // Atualizar contatos (substituir todos)
        if (data.contacts !== undefined) {
          // Remover contatos existentes (soft delete)
          await tx.agencyContact.updateMany({
            where: { 
              agency_id: id,
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
                  email: contact.email,
                  whatsapp: contact.whatsapp || false,
                }
              });

              await tx.agencyContact.create({
                data: {
                  agency_id: id,
                  contact_id: newContact.id
                }
              });
            }
          }
        }

        // Atualizar endereços (substituir todos)
        if (data.addresses !== undefined) {
          // Remover endereços existentes (soft delete)
          await tx.agencyAddress.updateMany({
            where: { 
              agency_id: id,
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
                  number: String(address.number),
                  district: address.district,
                  city: address.city,
                  state: address.state,
                  country: address.country || 'Brasil',
                }
              });

              await tx.agencyAddress.create({
                data: {
                  agency_id: id,
                  address_id: newAddress.id
                }
              });
            }
          }
        }

        return updatedAgency;
      });

      console.log(`✅ Agency updated: ${agency.id}`);
      return agency;

    } catch (error: any) {
      console.error(`❌ Error updating agency ${id}:`, error);
      throw error;
    }
  }

  static async deleteAgency(id: string) {
    try {
      console.log(`🗑️ Soft deleting agency: ${id}`);
      
      // Verificar se a agência existe e não está deletada
      const agency = await prisma.agency.findUnique({
        where: { 
          id,
          deleted_at: null // Só procura por registros não deletados
        },
      });

      if (!agency) {
        throw new Error('Agency not found or already deleted');
      }

      // SOFT DELETE: atualizar o campo deleted_at
      const deletedAgency = await prisma.agency.update({
        where: { id },
        data: { 
          deleted_at: new Date(),
          // Opcional: também inativar contatos e endereços relacionados
          contacts: {
            updateMany: {
              where: { agency_id: id },
              data: { deleted_at: new Date() }
            }
          },
          addresses: {
            updateMany: {
              where: { agency_id: id },
              data: { deleted_at: new Date() }
            }
          }
        },
      });

      console.log(`✅ Agency soft deleted: ${id}`);
      return agency;

    } catch (error: any) {
      console.error(`❌ Error soft deleting agency ${id}:`, error);
      throw error;
    }
  }

  static async restoreAgency(id: string) {
    try {
      console.log(`♻️ Restoring agency: ${id}`);
      
      // Verificar se a agência existe
      const agency = await prisma.agency.findUnique({
        where: { id },
        select: { 
          legal_name: true,
          deleted_at: true 
        }
      });

      if (!agency) {
        throw new Error('Agency not found');
      }

      if (!agency.deleted_at) {
        throw new Error('Agency is not deleted');
      }

      // Restaurar: setar deleted_at para null
      const restoredAgency = await prisma.agency.update({
        where: { id },
        data: { 
          deleted_at: null,
          // Restaurar contatos e endereços relacionados
          contacts: {
            updateMany: {
              where: { agency_id: id },
              data: { deleted_at: null }
            }
          },
          addresses: {
            updateMany: {
              where: { agency_id: id },
              data: { deleted_at: null }
            }
          }
        }
      });
      
      console.log(`✅ Agency restored: ${id}`);
      return agency;

    } catch (error: any) {
      console.error(`❌ Error restoring agency ${id}:`, error);
      throw error;
    }
  }

    static async getAgencyFilters() {
    try {
        console.log('🔍 Building comprehensive agency filters...');

        // Buscar todos os campos únicos para filtros
        const [
        tradeNames,
        legalNames,
        cnpjs,
        stateRegistrations,
        municipalRegistrations,
        licenseNumbers,
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
        // Campos da tabela Agency
        prisma.agency.findMany({
            select: { trade_name: true },
            distinct: ['trade_name'],
            where: { deleted_at: null },
            orderBy: { trade_name: 'asc' }
        }),
        prisma.agency.findMany({
            select: { legal_name: true },
            distinct: ['legal_name'],
            where: { deleted_at: null },
            orderBy: { legal_name: 'asc' }
        }),
        prisma.agency.findMany({
            select: { cnpj: true },
            distinct: ['cnpj'],
            where: { deleted_at: null },
            orderBy: { cnpj: 'asc' }
        }),
        prisma.agency.findMany({
            select: { state_registration: true },
            distinct: ['state_registration'],
            where: { 
            state_registration: { not: null },
            deleted_at: null 
            },
            orderBy: { state_registration: 'asc' }
        }),
        prisma.agency.findMany({
            select: { municipal_registration: true },
            distinct: ['municipal_registration'],
            where: { 
            municipal_registration: { not: null },
            deleted_at: null 
            },
            orderBy: { municipal_registration: 'asc' }
        }),
        prisma.agency.findMany({
            select: { license_number: true },
            distinct: ['license_number'],
            where: { 
            license_number: { not: null },
            deleted_at: null 
            },
            orderBy: { license_number: 'asc' }
        }),

        // Campos da tabela Address (relacionamento)
        prisma.address.findMany({
            select: { city: true },
            distinct: ['city'],
            where: { 
            city: { not: undefined },
            deleted_at: null,
            agencyAddresses: {
                some: {
                agency: {
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
            agencyAddresses: {
                some: {
                agency: {
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
            agencyAddresses: {
                some: {
                agency: {
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
            agencyAddresses: {
                some: {
                agency: {
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
            agencyContacts: {
                some: {
                agency: {
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
            agencyContacts: {
                some: {
                agency: {
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
            agencyContacts: {
                some: {
                agency: {
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
            agencyContacts: {
                some: {
                agency: {
                    deleted_at: null
                }
                }
            }
            }
        }),

        // Data range para filtros de data
        prisma.agency.aggregate({
            where: { deleted_at: null },
            _min: { created_at: true },
            _max: { created_at: true }
        })
        ]);

        // Construir filtros para todos os campos
        const filters = [
        // Campos principais da Agency
        {
            field: 'id',
            type: 'string',
            label: 'ID',
            description: 'Identificador único'
        },
        {
            field: 'trade_name',
            type: 'string',
            label: 'Nome Fantasia',
            description: 'Nome comercial da imobiliária',
            values: tradeNames
            .filter(a => a.trade_name)
            .map(a => a.trade_name.trim()),
            searchable: true,
            autocomplete: true
        },
        {
            field: 'legal_name',
            type: 'string',
            label: 'Razão Social',
            description: 'Nome jurídico da empresa',
            values: legalNames
            .filter(a => a.legal_name)
            .map(a => a.legal_name.trim()),
            searchable: true,
            autocomplete: true
        },
        {
            field: 'cnpj',
            type: 'string',
            label: 'CNPJ',
            description: 'Cadastro Nacional da Pessoa Jurídica',
            values: cnpjs
            .filter(a => a.cnpj)
            .map(a => a.cnpj.trim()),
            searchable: true,
            autocomplete: true,
            mask: '99.999.999/9999-99'
        },
        {
            field: 'state_registration',
            type: 'string',
            label: 'Inscrição Estadual',
            description: 'Registro estadual',
            values: stateRegistrations
            .filter(a => a.state_registration)
            .map(a => a.state_registration?.trim()),
            searchable: true,
            autocomplete: true
        },
        {
            field: 'municipal_registration',
            type: 'string',
            label: 'Inscrição Municipal',
            description: 'Registro municipal',
            values: municipalRegistrations
            .filter(a => a.municipal_registration)
            .map(a => a.municipal_registration?.trim()),
            searchable: true,
            autocomplete: true
        },
        {
            field: 'license_number',
            type: 'string',
            label: 'Número da Licença',
            description: 'Número do registro CRECI',
            values: licenseNumbers
            .filter(a => a.license_number)
            .map(a => a.license_number?.trim()),
            searchable: true,
            autocomplete: true
        },
        {
            field: 'created_at',
            type: 'date',
            label: 'Data de Criação',
            description: 'Data de cadastro no sistema',
            min: dateRange._min.created_at?.toISOString(),
            max: dateRange._max.created_at?.toISOString(),
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
            .filter(a => a.contact)
            .map(a => a.contact.trim()),
            searchable: true,
            autocomplete: true
        },
        {
            field: 'contact.phone',
            type: 'string',
            label: 'Telefone',
            description: 'Número de telefone',
            values: contactPhones
            .filter(a => a.phone)
            .map(a => a.phone.trim()),
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
            .filter(a => a.email)
            .map(a => a.email?.trim()),
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
            .map(a => a.whatsapp.toString()),
            options: ['true', 'false'],
            defaultValue: 'true'
        }
        ];

        // Opções de ordenação


        // Tipos de operadores para cada tipo de campo
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
            'trade_name',
            'legal_name', 
            'cnpj',
            'state_registration',
            'municipal_registration',
            'license_number',
            'address.city',
            'address.state',
            'contact.contact',
            'contact.email'
        ]
        };

    } catch (error) {
        console.error('❌ Error getting comprehensive agency filters:', error);
        throw error;
    }
    }
}