
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import {
  GetUsersParams,
  PaginatedResponse,
  FilterOption,
  FiltersResponse,
  fieldLabels,
  genderLabels,
  roleLabels
} from '../types/user';
import { Gender, Prisma, Role } from '@/generated/prisma/client';

export class UserService {
  static async getUsers({
    limit = 10,
    page = 1,
    search,
    sortOptions,
    includeInactive = false,
    filters = {}
  }: GetUsersParams): Promise<PaginatedResponse<any>> {
    try {
      console.log('🔍 Executing getUsers with params:', { limit, page, search, filters });
      
      const insensitiveMode: Prisma.QueryMode = 'insensitive';

      // Construir where clause
      let whereClause: Prisma.UserWhereInput = {};

      // Por padrão, não mostra deletados
      if (!includeInactive) {
        whereClause.deleted_at = null;
      }

      // Aplicar filtros individuais
      if (Object.keys(filters).length > 0) {
        const filterConditions: Prisma.UserWhereInput[] = [];

        Object.entries(filters).forEach(([key, value]) => {
          if (value === undefined || value === '') return;

          switch (key) {
            case 'name':
            case 'email':
              filterConditions.push({
                [key]: { contains: String(value), mode: insensitiveMode }
              });
              break;

            case 'birth_date':
              try {
                const date = new Date(value as string);
                if (!isNaN(date.getTime())) {
                  filterConditions.push({
                    birth_date: { equals: date }
                  });
                }
              } catch (error) {
                console.warn('Invalid date filter:', value);
              }
              break;

            case 'gender':
              if (Object.values(Gender).includes(value as Gender)) {
                filterConditions.push({
                  gender: { equals: value as Gender }
                });
              }
              break;

            case 'role':
              if (Object.values(Role).includes(value as Role)) {
                filterConditions.push({
                  role: { equals: value as Role }
                });
              }
              break;

            case 'created_at':
            case 'updated_at':
              try {
                const date = new Date(value as string);
                if (!isNaN(date.getTime())) {
                  filterConditions.push({
                    [key]: { equals: date }
                  });
                }
              } catch (error) {
                console.warn('Invalid date filter:', value);
              }
              break;
          }
        });

        if (filterConditions.length > 0) {
          whereClause = { ...whereClause, AND: filterConditions };
        }
      }

      // Busca global
      if (search) {
        const normalized = search.trim();
        const orFilters: Prisma.UserWhereInput['OR'] = [
          { name: { contains: normalized, mode: insensitiveMode } },
          { email: { contains: normalized, mode: insensitiveMode } },
        ];

        // Verificar se é um gênero ou role
        if (Object.values(Gender).includes(normalized.toUpperCase() as Gender)) {
          orFilters.push({ gender: { equals: normalized.toUpperCase() as Gender } });
        }
        if (Object.values(Role).includes(normalized.toUpperCase() as Role)) {
          orFilters.push({ role: { equals: normalized.toUpperCase() as Role } });
        }

        // Se já tiver condições AND, adicionar OR dentro
        if (whereClause.AND) {
          whereClause = { AND: [whereClause, { OR: orFilters }] };
        } else {
          whereClause = { ...whereClause, OR: orFilters };
        }
      }

      // Ordenação
      const orderBy: Prisma.UserOrderByWithRelationInput[] = [];
      if (sortOptions?.sort_id) orderBy.push({ id: sortOptions.sort_id.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      if (sortOptions?.sort_name) orderBy.push({ name: sortOptions.sort_name.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      if (sortOptions?.sort_email) orderBy.push({ email: sortOptions.sort_email.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      if (sortOptions?.sort_birth_date) orderBy.push({ birth_date: sortOptions.sort_birth_date.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      if (sortOptions?.sort_gender) orderBy.push({ gender: sortOptions.sort_gender.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      if (sortOptions?.sort_role) orderBy.push({ role: sortOptions.sort_role.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      if (sortOptions?.sort_created_at) orderBy.push({ created_at: sortOptions.sort_created_at.toLowerCase() === 'desc' ? 'desc' : 'asc' });
      if (sortOptions?.sort_updated_at) orderBy.push({ updated_at: sortOptions.sort_updated_at.toLowerCase() === 'desc' ? 'desc' : 'asc' });

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      console.log('📊 User query parameters:', { where: whereClause, skip, take, orderBy });

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          skip,
          take,
          orderBy: orderBy.length > 0 ? orderBy : [{ created_at: 'desc' }],
          select: {
            id: true,
            name: true,
            email: true,
            birth_date: true,
            gender: true,
            role: true,
            created_at: true,
            updated_at: true,
            // Não retornar password por segurança
          },
        }),
        prisma.user.count({ where: whereClause }),
      ]);

      console.log(`✅ Found ${users.length} users, total: ${total}`);

      return {
        data: users || [],
        count: total || 0,
        totalPages: total ? Math.ceil(total / take) : 0,
        currentPage: page,
      };

    } catch (error) {
      console.error('❌ Error in UserService.getUsers:', error);
      throw new Error('Failed to fetch users');
    }
  }

  static async getUserById(id: string) {
    try {
      console.log(`🔍 Getting user by ID: ${id}`);
      
      const user = await prisma.user.findUnique({
        where: { 
          id,
          deleted_at: null // Só retorna se não estiver deletado
        },
        select: {
          id: true,
          name: true,
          email: true,
          birth_date: true,
          gender: true,
          role: true,
          created_at: true,
          updated_at: true,
          // Não retornar password
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      console.log(`✅ Found user: ${user.name}`);
      return user;

    } catch (error) {
      console.error(`❌ Error getting user ${id}:`, error);
      throw error;
    }
  }

  static async getUserByEmail(email: string) {
    try {
      console.log(`🔍 Getting user by email: ${email}`);
      
      const user = await prisma.user.findUnique({
        where: { 
          email,
          deleted_at: null
        }
      });

      return user;

    } catch (error) {
      console.error(`❌ Error getting user by email ${email}:`, error);
      throw error;
    }
  }

  static async createUser(data: any) {
    try {
      console.log('➕ Creating new user:', data.email);
      
      // Verificar se email já existe
      const existingUser = await prisma.user.findFirst({
        where: { 
          email: data.email,
          deleted_at: null
        }
      });

      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Criar usuário
      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: hashedPassword,
          birth_date: new Date(data.birth_date),
          gender: data.gender,
          role: data.role || Role.DEFAULT,
        },
        select: {
          id: true,
          name: true,
          email: true,
          birth_date: true,
          gender: true,
          role: true,
          created_at: true,
          updated_at: true,
        }
      });

      console.log(`✅ User created: ${user.id}`);
      return user;

    } catch (error: any) {
      console.error('❌ Error creating user:', error);
      throw error;
    }
  }

  static async updateUser(id: string, data: any) {
    try {
      console.log(`✏️ Updating user: ${id}`);
      
      // Verificar se usuário existe e não está deletado
      const existingUser = await prisma.user.findUnique({
        where: { 
          id,
          deleted_at: null
        }
      });

      if (!existingUser) {
        throw new Error('User not found');
      }

      // Verificar se email já existe em outro usuário
      if (data.email && data.email !== existingUser.email) {
        const emailExists = await prisma.user.findFirst({
          where: { 
            email: data.email,
            NOT: { id },
            deleted_at: null
          }
        });

        if (emailExists) {
          throw new Error('Email already registered for another user');
        }
      }

      // Preparar dados para atualização
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.birth_date !== undefined) updateData.birth_date = new Date(data.birth_date);
      if (data.gender !== undefined) updateData.gender = data.gender;
      if (data.role !== undefined) updateData.role = data.role;
      
      // Atualizar senha se fornecida
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          birth_date: true,
          gender: true,
          role: true,
          created_at: true,
          updated_at: true,
        }
      });

      console.log(`✅ User updated: ${updatedUser.id}`);
      return updatedUser;

    } catch (error: any) {
      console.error(`❌ Error updating user ${id}:`, error);
      throw error;
    }
  }

  static async deleteUser(id: string) {
    try {
      console.log(`🗑️ Soft deleting user: ${id}`);
      
      // Verificar se usuário existe e não está deletado
      const user = await prisma.user.findUnique({
        where: { 
          id,
          deleted_at: null
        }
      });

      if (!user) {
        throw new Error('User not found or already deleted');
      }

      // SOFT DELETE: atualizar o campo deleted_at
      await prisma.user.update({
        where: { id },
        data: { 
          deleted_at: new Date(),
          // Não deletar se for o último admin
        }
      });

      console.log(`✅ User soft deleted: ${id}`);
      return user;

    } catch (error: any) {
      console.error(`❌ Error soft deleting user ${id}:`, error);
      throw error;
    }
  }

  static async restoreUser(id: string) {
    try {
      console.log(`♻️ Restoring user: ${id}`);
      
      // Verificar se usuário existe
      const user = await prisma.user.findUnique({
        where: { id },
        select: { 
          name: true,
          deleted_at: true 
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.deleted_at) {
        throw new Error('User is not deleted');
      }

      // Restaurar: setar deleted_at para null
      await prisma.user.update({
        where: { id },
        data: { 
          deleted_at: null
        }
      });
      
      console.log(`✅ User restored: ${id}`);
      return user;

    } catch (error: any) {
      console.error(`❌ Error restoring user ${id}:`, error);
      throw error;
    }
  }

  static async getUserFilters(): Promise<FiltersResponse> {
    try {
      console.log('🔍 Building comprehensive user filters...');

      // Buscar todos os campos únicos para filtros
      const [
        names,
        emails,
        genders,
        roles,
        dateRange
      ] = await Promise.all([
        // Nomes
        prisma.user.findMany({
          select: { name: true },
          distinct: ['name'],
          where: { deleted_at: null },
          orderBy: { name: 'asc' }
        }),
        // Emails
        prisma.user.findMany({
          select: { email: true },
          distinct: ['email'],
          where: { deleted_at: null },
          orderBy: { email: 'asc' }
        }),
        // Gêneros
        prisma.user.findMany({
          select: { gender: true },
          distinct: ['gender'],
          where: { deleted_at: null }
        }),
        // Roles
        prisma.user.findMany({
          select: { role: true },
          distinct: ['role'],
          where: { deleted_at: null }
        }),
        // Data range
        prisma.user.aggregate({
          where: { deleted_at: null },
          _min: { 
            birth_date: true,
            created_at: true 
          },
          _max: { 
            birth_date: true,
            created_at: true 
          }
        })
      ]);

      // Construir filtros
      const filters: FilterOption[] = [
        // Campos principais
        {
          field: 'id',
          type: 'string',
          label: fieldLabels.id,
          description: 'Identificador único',
          searchable: true
        },
        {
          field: 'name',
          type: 'string',
          label: fieldLabels.name,
          description: 'Nome completo do usuário',
          values: names
            .filter(u => u.name)
            .map(u => u.name.trim()),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'email',
          type: 'string',
          label: fieldLabels.email,
          description: 'Endereço de email',
          values: emails
            .filter(u => u.email)
            .map(u => u.email.trim()),
          searchable: true,
          autocomplete: true,
          inputType: 'email'
        },
        {
          field: 'birth_date',
          type: 'date',
          label: fieldLabels.birth_date,
          description: 'Data de nascimento',
          min: dateRange._min.birth_date?.toISOString(),
          max: dateRange._max.birth_date?.toISOString(),
          dateRange: true
        },
        {
          field: 'gender',
          type: 'enum',
          label: fieldLabels.gender,
          description: 'Gênero',
          values: genders
            .filter(u => u.gender)
            .map(u => u.gender),
          options: Object.values(Gender),
          searchable: true,
          inputType: 'select'
        },
        {
          field: 'role',
          type: 'enum',
          label: fieldLabels.role,
          description: 'Função/perfil do usuário',
          values: roles
            .filter(u => u.role)
            .map(u => u.role),
          options: Object.values(Role),
          searchable: true,
          inputType: 'select'
        },
        {
          field: 'created_at',
          type: 'date',
          label: fieldLabels.created_at,
          description: 'Data de criação do cadastro',
          min: dateRange._min.created_at?.toISOString(),
          max: dateRange._max.created_at?.toISOString(),
          dateRange: true
        },
        {
          field: 'updated_at',
          type: 'date',
          label: fieldLabels.updated_at,
          description: 'Data da última atualização',
          dateRange: true
        }
      ];

      // Tipos de operadores
      const operators = {
        string: ['equals', 'contains', 'startsWith', 'endsWith', 'in', 'not'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between', 'not'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals'],
        enum: ['equals', 'in', 'not']
      };

      return {
        filters: filters.filter(f => !f.values || f.values.length > 0),
        operators,
        defaultSort: 'created_at:desc',
        searchFields: ['name', 'email', 'gender', 'role']
      };

    } catch (error) {
      console.error('❌ Error getting user filters:', error);
      throw error;
    }
  }

  static async changePassword(id: string, oldPassword: string, newPassword: string) {
    try {
      console.log(`🔐 Changing password for user: ${id}`);
      
      // Buscar usuário
      const user = await prisma.user.findUnique({
        where: { 
          id,
          deleted_at: null
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verificar senha atual
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash nova senha
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Atualizar senha
      await prisma.user.update({
        where: { id },
        data: { password: hashedPassword }
      });

      console.log(`✅ Password changed for user: ${id}`);
      return true;

    } catch (error: any) {
      console.error(`❌ Error changing password for user ${id}:`, error);
      throw error;
    }
  }
}