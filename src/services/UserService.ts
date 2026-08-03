import bcrypt from 'bcrypt';
import { Prisma } from '@/generated/prisma/client';
import prisma from '../lib/prisma';
import { UserGroupPermissionService } from './UserGroupPermissionService';
import { timeToString } from '../utils/time';
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

/** Colunas devolvidas na listagem. Nunca inclui `password`. */
const USER_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  birth_date: true,
  gender: true,
  role: true,
  is_active: true,
  user_group_id: true,
  group: { select: { id: true, description: true } },
  created_at: true,
  updated_at: true,
} as const;

/** Campo de texto vazio vindo do formulário vira NULL, não string vazia. */
function emptyToNull(value: any): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

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
    'updated_at': { type: 'date', realField: 'updated_at' },
    'is_active': { type: 'direct', realField: 'is_active' },
    'user_group_id': { type: 'direct', realField: 'user_group_id' }
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
          select: USER_LIST_SELECT,
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
            select: USER_LIST_SELECT,
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
      if (['id', 'name', 'email', 'birth_date', 'gender', 'role', 'created_at', 'updated_at', 'is_active'].includes(field)) {
        orderBy.push({ [field]: direction });
      }
      // Ordenação pela descrição do grupo (coluna aninhada da grid)
      else if (field === 'group.description' || field === 'group') {
        orderBy.push({ group: { description: direction } });
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
      // Grupo de usuário: id exato
      else if (key === 'user_group_id') {
        conditions[key] = { equals: String(value) };
      }
      // Ativo: chega como string do querystring
      else if (key === 'is_active') {
        conditions[key] = { equals: value === true || value === 'true' };
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
          user_group_id: true,
          // Descrição do grupo para exibir na tela de visualização
          group: { select: { id: true, description: true } },
          // Campos de perfil
          is_active: true,
          photo_url: true,
          phone_country_code: true,
          phone_area_code: true,
          phone: true,
          phone_extension: true,
          has_time_restriction: true,
          access_schedules: {
            select: { day_of_week: true, start_time: true, end_time: true },
            orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
          },
          // Auditoria
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
          created_at: true,
          updated_at: true,
          // Não retornar password
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      console.log(`✅ Found user: ${user.name}`);

      // Horários dos intervalos viram "HH:MM" para o formulário consumir direto
      return {
        ...user,
        access_schedules: user.access_schedules.map((s) => ({
          day_of_week: s.day_of_week,
          start_time: timeToString(s.start_time),
          end_time: timeToString(s.end_time),
        })),
      };

    } catch (error) {
      console.error(`❌ Error getting user ${id}:`, error);
      throw error;
    }
  }

  /** Liga/desliga o usuário — usado pelo botão da listagem. */
  static async setActive(id: string, isActive: boolean, updatedBy?: string | null) {
    try {
      // findFirst é escopado por empresa pela extensão do Prisma
      const existing = await prisma.user.findFirst({
        where: { id, deleted_at: null },
        select: { id: true },
      });

      if (!existing) {
        throw new Error('User not found');
      }

      const user = await prisma.user.update({
        where: { id },
        data: { is_active: isActive, updated_by: updatedBy || null },
        select: USER_LIST_SELECT,
      });

      console.log(`✅ User ${id} ${isActive ? 'ativado' : 'desativado'}`);
      return user;

    } catch (error) {
      console.error(`❌ Error setting active on user ${id}:`, error);
      throw error;
    }
  }

  /** Grava a URL da foto após o upload. */
  static async setPhoto(id: string, photoUrl: string, updatedBy?: string | null) {
    try {
      const existing = await prisma.user.findFirst({
        where: { id, deleted_at: null },
        select: { id: true },
      });

      if (!existing) {
        throw new Error('User not found');
      }

      return await prisma.user.update({
        where: { id },
        data: { photo_url: photoUrl, updated_by: updatedBy || null },
        select: USER_LIST_SELECT,
      });

    } catch (error) {
      console.error(`❌ Error setting photo on user ${id}:`, error);
      throw error;
    }
  }

  static async getUserByEmail(email: string) {
    try {
      console.log(`🔍 Getting user by email: ${email}`);
      
      const user = await prisma.user.findFirst({
        where: { email, deleted_at: null }
      });

      return user;

    } catch (error) {
      console.error(`❌ Error getting user by email ${email}:`, error);
      throw error;
    }
  }

  static async createUser(data: any, company_id: string) {
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
          user_group_id: data.user_group_id || null,
          // company_id escalar, não `company: { connect }`: misturar a forma de
          // relação com FKs escalares joga o Prisma no modo "checked", que
          // rejeita user_group_id/created_by/updated_by.
          company_id,

          // Campos de perfil (migração incremental) — todos opcionais
          is_active: data.is_active ?? true,
          photo_url: data.photo_url || null,
          phone_country_code: emptyToNull(data.phone_country_code),
          phone_area_code: emptyToNull(data.phone_area_code),
          phone: emptyToNull(data.phone),
          phone_extension: emptyToNull(data.phone_extension),
          has_time_restriction: data.has_time_restriction ?? false,
          created_by: data.created_by || null,
          updated_by: data.created_by || null,
        },
        select: USER_LIST_SELECT,
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
      // String vazia no select do form significa "sem grupo"
      if (data.user_group_id !== undefined) {
        updateData.user_group_id = data.user_group_id || null;
      }

      // Campos de perfil (migração incremental)
      if (data.is_active !== undefined) updateData.is_active = data.is_active;
      if (data.photo_url !== undefined) updateData.photo_url = emptyToNull(data.photo_url);
      if (data.phone_country_code !== undefined) updateData.phone_country_code = emptyToNull(data.phone_country_code);
      if (data.phone_area_code !== undefined) updateData.phone_area_code = emptyToNull(data.phone_area_code);
      if (data.phone !== undefined) updateData.phone = emptyToNull(data.phone);
      if (data.phone_extension !== undefined) updateData.phone_extension = emptyToNull(data.phone_extension);
      if (data.has_time_restriction !== undefined) updateData.has_time_restriction = data.has_time_restriction;
      if (data.updated_by !== undefined) updateData.updated_by = data.updated_by || null;

      // Atualizar senha se fornecida
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: USER_LIST_SELECT,
      });

      // Trocar o grupo muda as permissões efetivas: derruba o cache do guard
      if (data.user_group_id !== undefined) {
        UserGroupPermissionService.invalidateUser(id);
      }

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

      // Gera um email único com timestamp para liberar o email original
      const timestamp = new Date().getTime();
      const deletedEmail = `ex_${timestamp}_${user.email}`;

      // SOFT DELETE: atualizar o campo deleted_at E alterar o email
      const deletedUser = await prisma.user.update({
        where: { id },
        data: { 
          deleted_at: new Date(),
          email: deletedEmail 
        }
      });

      console.log(`✅ User soft deleted and email freed: ${id}`);
      return deletedUser;

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
      // Nota: O email continuará como "ex_..." para evitar conflitos se o email original já foi reusado.
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
            // Grupo de usuário: id exato
            else if (key === 'user_group_id') {
              where[key] = String(value);
            }
            // Ativo: chega como string do querystring
            else if (key === 'is_active') {
              where[key] = value === true || value === 'true';
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
            updated_at: true,
            is_active: true,
            user_group_id: true,
            group: { select: { id: true, description: true } }
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

      // Grupos presentes no conjunto filtrado, para o select do filtro
      const uniqueGroups = Array.from(
        new Map(
          users
            .filter(u => u.group)
            .map(u => [u.group!.id, { value: u.group!.id, label: u.group!.description }])
        ).values()
      ).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

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
          field: 'user_group_id',
          type: 'select',
          label: 'Grupo usuário',
          description: 'Grupo de usuário vinculado',
          values: uniqueGroups.map(g => g.value),
          options: uniqueGroups,
          searchable: true,
          autocomplete: true
        } as any,
        {
          field: 'is_active',
          type: 'boolean',
          label: 'Ativo',
          description: 'Situação do usuário',
          options: [
            { value: 'true', label: 'Sim' },
            { value: 'false', label: 'Não' }
          ]
        } as any,
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