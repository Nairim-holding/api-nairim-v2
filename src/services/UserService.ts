import bcrypt from 'bcrypt';
import { Prisma } from '@/generated/prisma/client';
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
import { Gender, Role } from '@/generated/prisma/client';

export class UserService {
  static readonly FIELD_MAPPING: Record<string, { 
    type: 'direct' | 'enum' | 'date',
    realField: string
  }> = {
    'id': { type: 'direct', realField: 'id' },
    'name': { type: 'direct', realField: 'name' },
    'email': { type: 'direct', realField: 'email' },
    'birth_date': { type: 'date', realField: 'birth_date' },
    'gender': { type: 'enum', realField: 'gender' },
    'role': { type: 'enum', realField: 'role' },
    'created_at': { type: 'date', realField: 'created_at' },
    'updated_at': { type: 'date', realField: 'updated_at' }
  };

  // Método para normalizar texto (remover acentos e caracteres especiais)
  private static normalizeText(text: string): string {
    if (!text) return '';
    
    // Normaliza para a forma NFD (Decomposição) e remove os diacríticos
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
      .replace(/[çÇ]/g, 'c')             // Substitui ç por c
      .replace(/[ñÑ]/g, 'n')             // Substitui ñ por n
      .toLowerCase()
      .trim();
  }

  static async getUsers({
    limit = 10,
    page = 1,
    search,
    sortOptions = {},
    includeInactive = false,
    filters = {}
  }: GetUsersParams): Promise<PaginatedResponse<any>> {
    try {
      console.log('🔍 Executando getUsers com parâmetros:', { 
        limit, page, search, 
        sortOptions: JSON.stringify(sortOptions, null, 2),
        filters: JSON.stringify(filters, null, 2) 
      });
      
      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      // Construir where clause sem busca global (busca será feita em memória)
      const where = this.buildWhereClauseWithoutSearch(filters, includeInactive);
      
      // Normalizar sortOptions para o formato que o buildOrderBy espera
      const normalizedSortOptions: Record<string, 'asc' | 'desc'> = {};
      
      // Converter sortOptions do frontend para o formato interno
      Object.entries(sortOptions).forEach(([key, value]) => {
        if (value && (value.toLowerCase() === 'asc' || value.toLowerCase() === 'desc')) {
          const fieldName = key.replace('sort_', '');
          normalizedSortOptions[fieldName] = value.toLowerCase() as 'asc' | 'desc';
        }
      });
      
      // Verificar tipo de ordenação
      const sortField = Object.keys(normalizedSortOptions)[0];
      const sortDirection = sortField ? normalizedSortOptions[sortField] : undefined;
      
      console.log(`🔧 Campo de ordenação: ${sortField} -> ${sortDirection}`);

      let users: any[] = [];
      let total = 0;

      // Se houver busca, buscar todos para processar em memória
      if (search && search.trim()) {
        console.log(`🔄 Processando em memória (busca: "${search.trim()}")`);
        
        // Buscar TODOS os usuários para processamento em memória
        const allUsers = await prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            birth_date: true,
            gender: true,
            role: true,
            created_at: true,
            updated_at: true,
          },
        });

        // Aplicar filtro de busca em memória
        let filteredUsers = allUsers;
        if (search.trim()) {
          filteredUsers = this.filterUsersBySearch(allUsers, search);
        }

        total = filteredUsers.length;

        // Ordenar em memória se necessário
        if (sortField && sortDirection) {
          users = this.sortByDirectField(filteredUsers, sortField, sortDirection);
        } else {
          // Ordenação padrão por data de criação (mais recente primeiro)
          users = filteredUsers.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        
        // Aplicar paginação
        users = users.slice(skip, skip + take);
      } else {
        // Sem busca global - usar ordenação do Prisma
        const orderBy = this.buildOrderBy(normalizedSortOptions);
        
        console.log('📊 ORDER BY direto:', JSON.stringify(orderBy, null, 2));
        
        // Buscar com ordenação do Prisma
        const [usersData, totalCount] = await Promise.all([
          prisma.user.findMany({
            where,
            skip,
            take,
            orderBy,
            select: {
              id: true,
              name: true,
              email: true,
              birth_date: true,
              gender: true,
              role: true,
              created_at: true,
              updated_at: true,
            },
          }),
          prisma.user.count({ where })
        ]);

        users = usersData;
        total = totalCount;
      }

      console.log(`✅ Encontrados ${users.length} usuários, total: ${total}`);

      return {
        data: users || [],
        count: total || 0,
        totalPages: total ? Math.ceil(total / take) : 0,
        currentPage: page,
      };

    } catch (error) {
      console.error('❌ Erro em UserService.getUsers:', error);
      throw new Error('Falha ao buscar usuários');
    }
  }

  /**
   * Filtra usuários em memória com base no termo de busca (ignorando acentos)
   */
  private static filterUsersBySearch(
    users: any[],
    searchTerm: string
  ): any[] {
    if (!searchTerm.trim()) return users;

    const normalizedSearchTerm = this.normalizeText(searchTerm);
    
    return users.filter(user => {
      // Campos diretos do usuário
      const directFields = [
        user.name,
        user.email,
        user.gender,
        user.role,
        user.id
      ].filter(Boolean).join(' ');

      // Normalizar e verificar se contém o termo de busca
      const normalizedAllFields = this.normalizeText(directFields);
      return normalizedAllFields.includes(normalizedSearchTerm);
    });
  }

  /**
   * Ordenação por campo direto em memória
   */
  private static sortByDirectField<T>(
    items: T[],
    field: string,
    direction: 'asc' | 'desc'
  ): T[] {
    return [...items].sort((a: any, b: any) => {
      const valueA = a[field] || '';
      const valueB = b[field] || '';

      const strA = this.normalizeText(String(valueA));
      const strB = this.normalizeText(String(valueB));

      if (direction === 'asc') {
        return strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base' });
      } else {
        return strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base' });
      }
    });
  }

  /**
   * Constrói ORDER BY para campos diretos
   */
  private static buildOrderBy(sortOptions: Record<string, 'asc' | 'desc'>): any[] {
    const orderBy: any[] = [];

    Object.entries(sortOptions).forEach(([field, value]) => {
      if (!value) return;

      const direction = String(value).toLowerCase() === 'desc' ? 'desc' : 'asc';
      
      console.log(`🔧 Processando ordenação direta: ${field} -> ${direction}`);

      // Campos diretos que o Prisma pode ordenar
      if (['id', 'name', 'email', 'birth_date', 'gender', 'role', 'created_at', 'updated_at'].includes(field)) {
        orderBy.push({ [field]: direction });
      }
    });

    if (orderBy.length === 0) {
      orderBy.push({ created_at: 'desc' });
      console.log('🔄 Usando ordenação padrão: created_at desc');
    }

    return orderBy;
  }

  /**
   * Constrói a cláusula WHERE para a query (sem busca global)
   */
  private static buildWhereClauseWithoutSearch(
    filters: Record<string, any>,
    includeInactive: boolean
  ): any {
    const where: any = {};
    
    // Filtrar por status deletado
    if (!includeInactive) {
      where.deleted_at = null;
    }
    
    // Filtros específicos
    const filterConditions = this.buildFilterConditions(filters);
    if (Object.keys(filterConditions).length > 0) {
      where.AND = [filterConditions];
    }
    
    return where;
  }

  /**
   * Constrói condições de filtro específicas
   */
  private static buildFilterConditions(filters: Record<string, any>): any {
    const conditions: any = {};
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      console.log(`🔄 Aplicando filtro ${key}:`, value);

      // Campos diretos do usuário
      if (['name', 'email'].includes(key)) {
        conditions[key] = { 
          contains: String(value), 
          mode: 'insensitive' as Prisma.QueryMode 
        };
      }
      // Campos de enum
      else if (['gender', 'role'].includes(key)) {
        conditions[key] = { equals: String(value).toUpperCase() };
      }
      // Campos de data
      else if (['birth_date', 'created_at', 'updated_at'].includes(key)) {
        conditions[key] = this.buildDateCondition(value);
      }
    });
    
    return conditions;
  }

  /**
   * Constrói condição para filtro de data
   */
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

  static async getUserFilters(filters?: Record<string, any>): Promise<FiltersResponse> {
    try {
      console.log('🔍 Building comprehensive user filters with context...');
      console.log('📦 Active filters for context:', filters);

      // Construir where clause com base nos filtros atuais
      const where: any = { deleted_at: null };
      
      // Aplicar filtros de forma correta
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            console.log(`🔄 Processing filter: ${key} =`, value);
            
            // Para campos de texto (name, email)
            if (key === 'name' || key === 'email') {
              where[key] = {
                contains: String(value),
                mode: 'insensitive' as Prisma.QueryMode
              };
            }
            // Para enum (gender, role) - deve ser string exata
            else if (key === 'gender' || key === 'role') {
              where[key] = value;
            }
            // Para datas (range ou string)
            else if (key === 'birth_date' || key === 'created_at' || key === 'updated_at') {
              // Se for objeto com from/to (date range)
              if (typeof value === 'object' && 'from' in value && 'to' in value) {
                const fromDate = new Date(value.from);
                const toDate = new Date(value.to);
                
                // Ajustar para incluir todo o dia final
                toDate.setHours(23, 59, 59, 999);
                
                where[key] = {
                  gte: fromDate,
                  lte: toDate
                };
                console.log(`📅 Date range filter for ${key}:`, { from: fromDate, to: toDate });
              } 
              // Se for uma data única (string)
              else if (typeof value === 'string') {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
                  const endOfDay = new Date(date.setHours(23, 59, 59, 999));
                  
                  where[key] = {
                    gte: startOfDay,
                    lte: endOfDay
                  };
                  console.log(`📅 Single date filter for ${key}:`, startOfDay);
                }
              }
            }
          }
        });
      }

      console.log('📊 WHERE clause for contextual filters:', JSON.stringify(where, null, 2));

      // Buscar dados com base nos filtros atuais
      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            name: true,
            email: true,
            gender: true,
            role: true,
            birth_date: true,
            created_at: true,
            updated_at: true
          },
          orderBy: { name: 'asc' }
        }),
        prisma.user.count({ where })
      ]);

      console.log(`📈 Found ${users.length} users with current filters`);

      // Extrair valores únicos com base nos usuários filtrados
      const uniqueNames = Array.from(new Set(
        users
          .filter(u => u.name)
          .map(u => u.name.trim())
          .sort()
      ));

      const uniqueEmails = Array.from(new Set(
        users
          .filter(u => u.email)
          .map(u => u.email.trim())
          .sort()
      ));

      const uniqueGenders = Array.from(new Set(
        users
          .filter(u => u.gender)
          .map(u => u.gender)
      )).sort();

      const uniqueRoles = Array.from(new Set(
        users
          .filter(u => u.role)
          .map(u => u.role)
      )).sort();

      // Buscar range de datas considerando os filtros
      const dateRangeData = await prisma.user.aggregate({
        where,
        _min: { 
          birth_date: true,
          created_at: true 
        },
        _max: { 
          birth_date: true,
          created_at: true 
        }
      });

      // Construir filtros com opções contextuais
      const filtersList: FilterOption[] = [
        {
          field: 'name',
          type: 'string',
          label: fieldLabels.name,
          description: 'Nome completo do usuário',
          values: uniqueNames,
          searchable: true,
          autocomplete: true
        },
        {
          field: 'email',
          type: 'string',
          label: fieldLabels.email,
          description: 'Endereço de email',
          values: uniqueEmails,
          searchable: true,
          autocomplete: true,
          inputType: 'email'
        },
        {
          field: 'gender',
          type: 'enum',
          label: fieldLabels.gender,
          description: 'Gênero',
          values: uniqueGenders,
          options: Object.values(Gender),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'role',
          type: 'enum',
          label: fieldLabels.role,
          description: 'Papel/role do usuário',
          values: uniqueRoles,
          options: Object.values(Role),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'birth_date',
          type: 'date',
          label: fieldLabels.birth_date,
          description: 'Data de nascimento',
          min: dateRangeData._min.birth_date?.toISOString().split('T')[0],
          max: dateRangeData._max.birth_date?.toISOString().split('T')[0],
          dateRange: true
        },
        {
          field: 'created_at',
          type: 'date',
          label: fieldLabels.created_at,
          description: 'Data de criação do cadastro',
          min: dateRangeData._min.created_at?.toISOString().split('T')[0],
          max: dateRangeData._max.created_at?.toISOString().split('T')[0],
          dateRange: true
        }
      ];

      // Tipos de operadores
      const operators = {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
        boolean: ['equals'],
        enum: ['equals', 'in']
      };

      return {
        filters: filtersList,
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