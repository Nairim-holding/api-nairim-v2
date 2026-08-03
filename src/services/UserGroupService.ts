// services/UserGroupService.ts
import prisma from '../lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { getCurrentCompanyId } from '../lib/tenantContext';
import { GetUserGroupsParams, PaginatedUserGroupResponse } from '../types/user-group';

// Autoria exibida no grid: só o necessário para mostrar o nome de quem
// cadastrou/alterou, sem vazar e-mail, senha ou role.
const AUTHOR_SELECT = { select: { id: true, name: true } } as const;

const USER_GROUP_SELECT = {
  id: true,
  description: true,
  created_by: true,
  created_at: true,
  updated_by: true,
  updated_at: true,
  deleted_at: true,
  creator: AUTHOR_SELECT,
  updater: AUTHOR_SELECT,
} as const;

export class UserGroupService {
  // Método para normalizar texto (remover acentos e caracteres especiais)
  private static normalizeText(text: string): string {
    if (!text) return '';

    // Normaliza para a forma NFD (Decomposição) e remove os diacríticos
    return text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')    // Remove acentos
      .replace(/[çÇ]/g, 'c')             // Substitui ç por c
      .replace(/[ñÑ]/g, 'n')             // Substitui ñ por n
      .toLowerCase()
      .trim();
  }

  // Método auxiliar para normalizar direção de ordenação
  private static normalizeSortDirection(direction: string): 'asc' | 'desc' {
    if (direction.toLowerCase() === 'desc') {
      return 'desc';
    }
    return 'asc'; // default
  }

  static async getUserGroups(params: GetUserGroupsParams = {}): Promise<PaginatedUserGroupResponse> {
    try {
      console.log('🔍 Executing getUserGroups with params:', JSON.stringify(params, null, 2));

      const {
        limit = 30,
        page = 1,
        search = '',
        filters = {},
        sortOptions = {},
        includeInactive = false
      } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      // Construir where clause sem busca global (busca será feita em memória)
      const where = this.buildWhereClauseWithoutSearch(filters, includeInactive);

      // Verificar tipo de ordenação
      const sortEntries = Object.entries(sortOptions);
      const sortField = sortEntries.length > 0 ? sortEntries[0][0] : '';
      const sortDirection = sortEntries.length > 0 ?
        this.normalizeSortDirection(sortEntries[0][1]) : 'asc';

      console.log(`🔧 Campo de ordenação: ${sortField} -> ${sortDirection}`);

      let userGroups: any[] = [];
      let total = 0;

      // Se houver busca, processar em memória
      if (search.trim()) {
        console.log(`🔄 Processando busca em memória: "${search}"`);

        // Buscar TODOS os grupos para processamento em memória
        const allUserGroups = await prisma.userGroup.findMany({
          where,
          select: USER_GROUP_SELECT,
        });

        // Aplicar filtro de busca em memória
        const filteredUserGroups = this.filterUserGroupsBySearch(allUserGroups, search);
        total = filteredUserGroups.length;

        // Ordenar em memória se necessário
        if (sortField && sortDirection) {
          userGroups = this.sortUserGroups(filteredUserGroups, sortField, sortDirection);
        } else {
          // Ordenação padrão por descrição
          userGroups = filteredUserGroups.sort((a, b) =>
            this.normalizeText(a.description).localeCompare(this.normalizeText(b.description), 'pt-BR', { sensitivity: 'base' })
          );
        }

        // Aplicar paginação
        userGroups = userGroups.slice(skip, skip + take);
      } else {
        // Sem busca, fazer query normal
        const orderBy = this.buildOrderBy(sortOptions);

        console.log('📊 ORDER BY:', JSON.stringify(orderBy, null, 2));

        // Buscar com ordenação do Prisma
        const [userGroupsData, totalCount] = await Promise.all([
          prisma.userGroup.findMany({
            where,
            skip,
            take,
            orderBy,
            select: USER_GROUP_SELECT,
          }),
          prisma.userGroup.count({ where })
        ]);

        userGroups = userGroupsData;
        total = totalCount;
      }

      console.log(`✅ Found ${userGroups.length} user groups, total: ${total}`);

      return {
        data: userGroups || [],
        count: total || 0,
        totalPages: total ? Math.ceil(total / take) : 0,
        currentPage: page,
      };

    } catch (error: any) {
      console.error('❌ Error in UserGroupService.getUserGroups:', error);
      throw new Error(`Failed to fetch user groups: ${error.message}`);
    }
  }

  /**
   * Filtra grupos em memória com base no termo de busca (ignorando acentos)
   */
  private static filterUserGroupsBySearch(
    userGroups: any[],
    searchTerm: string
  ): any[] {
    if (!searchTerm.trim()) return userGroups;

    const normalizedSearchTerm = this.normalizeText(searchTerm);

    return userGroups.filter(userGroup => {
      // Campos para busca
      const searchFields = [
        userGroup.description
      ].filter(Boolean).join(' ');

      // Normalizar e verificar se contém o termo de busca
      const normalizedFields = this.normalizeText(searchFields);
      return normalizedFields.includes(normalizedSearchTerm);
    });
  }

  /**
   * Ordenação de grupos em memória
   */
  private static sortUserGroups(
    items: any[],
    field: string,
    direction: 'asc' | 'desc'
  ): any[] {
    return [...items].sort((a, b) => {
      let valueA = a[field] ?? '';
      let valueB = b[field] ?? '';

      // Datas comparam por valor numérico, não por texto
      if (valueA instanceof Date || valueB instanceof Date) {
        const timeA = valueA instanceof Date ? valueA.getTime() : 0;
        const timeB = valueB instanceof Date ? valueB.getTime() : 0;
        return direction === 'asc' ? timeA - timeB : timeB - timeA;
      }

      valueA = this.normalizeText(String(valueA));
      valueB = this.normalizeText(String(valueB));

      if (direction === 'asc') {
        return valueA.localeCompare(valueB, 'pt-BR', { sensitivity: 'base' });
      } else {
        return valueB.localeCompare(valueA, 'pt-BR', { sensitivity: 'base' });
      }
    });
  }

  /**
   * Constrói a cláusula WHERE para a query (sem busca global)
   */
  private static buildWhereClauseWithoutSearch(
    filters: Record<string, any>,
    includeInactive: boolean
  ): any {
    const where: any = {};

    // Por padrão, não mostra deletados
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
        console.log(`⚠️  Valor vazio para filtro ${key}:`, value);
        return;
      }

      console.log(`🔄 Aplicando filtro ${key}:`, value);

      // Para campos diretos
      if (['description'].includes(key)) {
        conditions[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
      }
      // Para campos de data
      else if (key === 'created_at' || key === 'updated_at') {
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

  /**
   * Constrói ORDER BY
   */
  private static buildOrderBy(sortOptions: Record<string, string>): any[] {
    const orderBy: any[] = [];

    Object.entries(sortOptions).forEach(([key, value]) => {
      if (!value) return;

      const direction = this.normalizeSortDirection(value);
      const field = key.replace('sort_', '');

      console.log(`🔧 Processando ordenação: ${field} -> ${direction}`);

      // Campos diretos
      if (['description', 'created_at', 'updated_at'].includes(field)) {
        orderBy.push({ [field]: direction });
      }
      // Ordenação pelo nome do autor (campos aninhados do grid)
      else if (field === 'creator.name' || field === 'creator_name') {
        orderBy.push({ creator: { name: direction } });
      }
      else if (field === 'updater.name' || field === 'updater_name') {
        orderBy.push({ updater: { name: direction } });
      }
    });

    if (orderBy.length === 0) {
      orderBy.push({ description: 'asc' });
    }

    return orderBy;
  }

  static async getUserGroupById(id: string) {
    try {
      console.log(`🔍 Getting user group by ID: ${id}`);

      // findFirst (não findUnique) para que a extensão do Prisma injete
      // company_id e o grupo de outra empresa não seja acessível.
      const userGroup = await prisma.userGroup.findFirst({
        where: {
          id,
          deleted_at: null // Só retorna se não estiver deletado
        },
        select: USER_GROUP_SELECT,
      });

      if (!userGroup) {
        throw new Error('User group not found');
      }

      console.log(`✅ Found user group: ${userGroup.description}`);
      return userGroup;

    } catch (error: any) {
      console.error(`❌ Error getting user group ${id}:`, error);
      throw error;
    }
  }

  static async createUserGroup(data: any) {
    try {
      console.log('➕ Creating new user group:', data.description);

      const description = String(data.description).trim();

      // Verificar se já existe (não deletado) — findFirst já é escopado por empresa
      const existing = await prisma.userGroup.findFirst({
        where: {
          description,
          deleted_at: null
        }
      });

      if (existing) {
        throw new Error('User group already exists');
      }

      // company_id vem do contexto da request (garantido pelo middleware requireTenant).
      // Passado explicitamente em vez de depender da injeção da extensão do Prisma.
      const companyId = getCurrentCompanyId();
      if (!companyId) {
        throw new Error('Company context not found');
      }

      const userGroup = await prisma.userGroup.create({
        data: {
          description,
          company_id: companyId,
          created_by: data.created_by ?? null,
          updated_by: data.created_by ?? null,
        },
        select: USER_GROUP_SELECT,
      });

      console.log(`✅ User group created: ${userGroup.id}`);
      return userGroup;

    } catch (error: any) {
      console.error('❌ Error creating user group:', error);
      throw error;
    }
  }

  /**
   * Clona um grupo: cria um grupo NOVO e copia todas as diretivas de acesso da
   * origem. Operação não destrutiva — nenhum grupo existente é alterado.
   */
  static async cloneUserGroup(sourceId: string, data: any) {
    try {
      console.log(`📋 Cloning user group ${sourceId}`);

      const companyId = getCurrentCompanyId();
      if (!companyId) {
        throw new Error('Company context not found');
      }

      // findFirst é escopado por empresa: origem de outra empresa é inalcançável
      const source = await prisma.userGroup.findFirst({
        where: { id: sourceId, deleted_at: null },
        select: { id: true, description: true },
      });

      if (!source) {
        throw new Error('User group not found');
      }

      const description = String(data.description).trim();

      const existing = await prisma.userGroup.findFirst({
        where: { description, deleted_at: null },
      });

      if (existing) {
        throw new Error('User group already exists');
      }

      // Diretivas da origem, sem os campos próprios de cada linha (id/datas)
      const sourcePermissions = await prisma.userGroupPermission.findMany({
        where: { user_group_id: sourceId },
        select: {
          resource: true,
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: true,
          can_export: true,
          can_custom_field: true,
        },
      });

      const clone = await prisma.$transaction(async (tx: any) => {
        const created = await tx.userGroup.create({
          data: {
            description,
            company_id: companyId,
            created_by: data.created_by ?? null,
            updated_by: data.created_by ?? null,
          },
          select: USER_GROUP_SELECT,
        });

        if (sourcePermissions.length > 0) {
          await tx.userGroupPermission.createMany({
            data: sourcePermissions.map((p) => ({
              ...p,
              company_id: companyId,
              user_group_id: created.id,
            })),
          });
        }

        return created;
      });

      console.log(
        `✅ User group cloned: ${clone.id} (${sourcePermissions.length} diretiva(s) copiada(s) de "${source.description}")`
      );

      return { group: clone, clonedPermissions: sourcePermissions.length };

    } catch (error: any) {
      console.error(`❌ Error cloning user group ${sourceId}:`, error);
      throw error;
    }
  }

  static async updateUserGroup(id: string, data: any) {
    try {
      console.log(`✏️ Updating user group: ${id}`);

      // findFirst garante que o grupo pertence à empresa do usuário logado
      const existing = await prisma.userGroup.findFirst({
        where: {
          id,
          deleted_at: null
        }
      });

      if (!existing) {
        throw new Error('User group not found');
      }

      const description = data.description !== undefined
        ? String(data.description).trim()
        : undefined;

      // Verificar se nova descrição já existe (não deletada)
      if (description && description !== existing.description) {
        const descriptionExists = await prisma.userGroup.findFirst({
          where: {
            description,
            deleted_at: null,
            NOT: { id }
          }
        });

        if (descriptionExists) {
          throw new Error('User group already exists');
        }
      }

      const userGroup = await prisma.userGroup.update({
        where: { id },
        data: {
          ...(description !== undefined ? { description } : {}),
          updated_by: data.updated_by ?? null,
        },
        select: USER_GROUP_SELECT,
      });

      console.log(`✅ User group updated: ${userGroup.id}`);
      return userGroup;

    } catch (error: any) {
      console.error(`❌ Error updating user group ${id}:`, error);
      throw error;
    }
  }

  /**
   * Marca o grupo como alterado (updated_by / updated_at) sem mexer nos dados.
   * Usado ao salvar as diretivas de acesso, que também são alteração do grupo.
   */
  static async touchUserGroup(id: string, updatedBy?: string | null) {
    const existing = await prisma.userGroup.findFirst({
      where: { id, deleted_at: null },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('User group not found');
    }

    await prisma.userGroup.update({
      where: { id },
      data: { updated_by: updatedBy ?? null },
    });
  }

  static async deleteUserGroup(id: string, deletedBy?: string | null) {
    try {
      console.log(`🗑️ Soft deleting user group: ${id}`);

      // findFirst garante que o grupo pertence à empresa do usuário logado
      const userGroup = await prisma.userGroup.findFirst({
        where: {
          id,
          deleted_at: null
        },
        select: USER_GROUP_SELECT,
      });

      if (!userGroup) {
        throw new Error('User group not found or already deleted');
      }

      // SOFT DELETE: atualizar o campo deleted_at
      await prisma.userGroup.update({
        where: { id },
        data: {
          deleted_at: new Date(),
          updated_by: deletedBy ?? null,
        },
      });

      console.log(`✅ User group soft deleted: ${id}`);
      return userGroup;

    } catch (error: any) {
      console.error(`❌ Error soft deleting user group ${id}:`, error);
      throw error;
    }
  }

  static async restoreUserGroup(id: string, restoredBy?: string | null) {
    try {
      console.log(`♻️ Restoring user group: ${id}`);

      // findFirst garante que o grupo pertence à empresa do usuário logado
      const userGroup = await prisma.userGroup.findFirst({
        where: { id },
        select: USER_GROUP_SELECT,
      });

      if (!userGroup) {
        throw new Error('User group not found');
      }

      if (!userGroup.deleted_at) {
        throw new Error('User group is not deleted');
      }

      // Restaurar: setar deleted_at para null
      await prisma.userGroup.update({
        where: { id },
        data: {
          deleted_at: null,
          updated_by: restoredBy ?? null,
        }
      });

      console.log(`✅ User group restored: ${id}`);
      return userGroup;

    } catch (error: any) {
      console.error(`❌ Error restoring user group ${id}:`, error);
      throw error;
    }
  }

  static async getUserGroupFilters(filters?: Record<string, any>) {
    try {
      console.log('🔍 Building user group filters with context...');
      console.log('📦 Active filters for context:', filters);

      // Construir where clause com base nos filtros atuais
      const where: any = { deleted_at: null };

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            if (['description'].includes(key)) {
              where[key] = { contains: String(value), mode: 'insensitive' as Prisma.QueryMode };
            }
          }
        });
      }

      console.log('📊 WHERE clause para filtros contextuais:', JSON.stringify(where, null, 2));

      // Buscar todas as descrições únicas
      const userGroups = await prisma.userGroup.findMany({
        where,
        select: { description: true },
        distinct: ['description'],
        orderBy: { description: 'asc' }
      });

      // Data range para filtros de data
      const dateRange = await prisma.userGroup.aggregate({
        where,
        _min: { created_at: true },
        _max: { created_at: true }
      });

      const filtersList = [
        {
          field: 'description',
          type: 'string',
          label: 'Descrição',
          description: 'Descrição do grupo de usuário',
          values: userGroups
            .filter(ug => ug.description)
            .map(ug => ug.description.trim()),
          searchable: true,
          autocomplete: true
        },
        {
          field: 'created_at',
          type: 'date',
          label: 'Data de Cadastro',
          description: 'Data de cadastro no sistema',
          min: dateRange._min.created_at?.toISOString().split('T')[0],
          max: dateRange._max.created_at?.toISOString().split('T')[0],
          dateRange: true
        }
      ];

      const operators = {
        string: ['contains', 'equals', 'startsWith', 'endsWith'],
        date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between']
      };

      return {
        filters: filtersList,
        operators,
        defaultSort: 'description:asc',
        searchFields: [
          'description'
        ]
      };

    } catch (error) {
      console.error('❌ Error getting user group filters:', error);
      throw error;
    }
  }
}
