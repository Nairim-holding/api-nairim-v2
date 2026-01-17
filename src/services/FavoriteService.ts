import prisma from '../lib/prisma';

export class FavoriteService {
  static async getFavorites(params: any = {}) {
    try {
      console.log('🔍 Executing getFavorites with params:', params);
      
      const { 
        limit = 10, 
        page = 1, 
        user_id,
        property_id,
        search = '',
        includeDeleted = false 
      } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      // Construir where clause
      const where: any = {};
      
      // Por padrão, não mostra deletados
      if (!includeDeleted) {
        where.deleted_at = null;
      }
      
      if (user_id) {
        where.user_id = user_id;
      }
      
      if (property_id) {
        where.property_id = property_id;
      }

      if (search) {
        const searchTerm = search.trim();
        where.OR = [
          {
            user: {
              name: { contains: searchTerm, mode: 'insensitive' }
            }
          },
          {
            user: {
              email: { contains: searchTerm, mode: 'insensitive' }
            }
          },
          {
            property: {
              title: { contains: searchTerm, mode: 'insensitive' }
            }
          }
        ];
      }

      console.log('📊 Query parameters:', { where, skip, take });

      // Buscar dados
      const favorites = await prisma.favorite.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          property: {
            select: {
              id: true,
              title: true,
              type: {
                select: {
                  description: true
                }
              },
              values: {
                where: { deleted_at: null },
                orderBy: { created_at: 'desc' },
                take: 1
              }
            }
          }
        }
      });

      // Contar total
      const total = await prisma.favorite.count({ where });

      console.log(`✅ Found ${favorites.length} favorites, total: ${total}`);

      return {
        data: favorites || [],
        count: total || 0,
        totalPages: total ? Math.ceil(total / take) : 0,
        currentPage: page,
      };

    } catch (error: any) {
      console.error('❌ Error in FavoriteService.getFavorites:', error);
      throw new Error('Failed to fetch favorites');
    }
  }

  static async getFavoriteById(id: string) {
    try {
      console.log(`🔍 Getting favorite by ID: ${id}`);
      
      const favorite = await prisma.favorite.findUnique({
        where: { 
          id,
          deleted_at: null // Só retorna se não estiver deletado
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              birth_date: true,
              gender: true
            }
          },
          property: {
            select: {
              id: true,
              title: true,
              type: {
                select: {
                  description: true
                }
              },
              addresses: {
                where: { deleted_at: null },
                include: {
                  address: true
                }
              },
              values: {
                where: { deleted_at: null },
                orderBy: { created_at: 'desc' },
                take: 1
              }
            }
          }
        }
      });

      if (!favorite) {
        throw new Error('Favorite not found');
      }

      console.log(`✅ Found favorite for user: ${favorite.user_id}`);
      return favorite;

    } catch (error: any) {
      console.error(`❌ Error getting favorite ${id}:`, error);
      throw error;
    }
  }

  static async createFavorite(data: any) {
    try {
      console.log('➕ Creating new favorite:', { user_id: data.user_id, property_id: data.property_id });
      
      // Verificar se já existe
      const existing = await prisma.favorite.findFirst({
        where: {
          user_id: data.user_id,
          property_id: data.property_id,
          deleted_at: null
        }
      });

      if (existing) {
        throw new Error('Property already in favorites');
      }

      // Verificar se o usuário existe
      const user = await prisma.user.findUnique({
        where: { 
          id: data.user_id,
          deleted_at: null 
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verificar se a propriedade existe
      const property = await prisma.property.findUnique({
        where: { 
          id: data.property_id,
          deleted_at: null 
        }
      });

      if (!property) {
        throw new Error('Property not found');
      }

      // Criar favorito
      const favorite = await prisma.favorite.create({
        data: {
          user_id: data.user_id,
          property_id: data.property_id
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          property: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });

      console.log(`✅ Favorite created: ${favorite.id}`);
      return favorite;

    } catch (error: any) {
      console.error('❌ Error creating favorite:', error);
      throw error;
    }
  }

  static async deleteFavorite(id: string) {
    try {
      console.log(`🗑️ Soft deleting favorite: ${id}`);
      
      // Verificar se o favorito existe e não está deletado
      const favorite = await prisma.favorite.findUnique({
        where: { 
          id,
          deleted_at: null // Só procura por registros não deletados
        },
      });

      if (!favorite) {
        throw new Error('Favorite not found or already deleted');
      }

      // SOFT DELETE: atualizar o campo deleted_at
      await prisma.favorite.update({
        where: { id },
        data: { 
          deleted_at: new Date()
        },
      });

      console.log(`✅ Favorite soft deleted: ${id}`);
      return favorite;

    } catch (error: any) {
      console.error(`❌ Error soft deleting favorite ${id}:`, error);
      throw error;
    }
  }

  static async deleteFavoriteByUserAndProperty(user_id: string, property_id: string) {
    try {
      console.log(`🗑️ Deleting favorite by user and property:`, { user_id, property_id });
      
      // Encontrar o favorito
      const favorite = await prisma.favorite.findFirst({
        where: {
          user_id,
          property_id,
          deleted_at: null
        }
      });

      if (!favorite) {
        throw new Error('Favorite not found');
      }

      // SOFT DELETE
      await prisma.favorite.update({
        where: { id: favorite.id },
        data: { 
          deleted_at: new Date()
        },
      });

      console.log(`✅ Favorite deleted: ${favorite.id}`);
      return favorite;

    } catch (error: any) {
      console.error(`❌ Error deleting favorite:`, error);
      throw error;
    }
  }

  static async restoreFavorite(id: string) {
    try {
      console.log(`♻️ Restoring favorite: ${id}`);
      
      // Verificar se o favorito existe
      const favorite = await prisma.favorite.findUnique({
        where: { id },
        select: { 
          id: true,
          deleted_at: true 
        }
      });

      if (!favorite) {
        throw new Error('Favorite not found');
      }

      if (!favorite.deleted_at) {
        throw new Error('Favorite is not deleted');
      }

      // Restaurar: setar deleted_at para null
      await prisma.favorite.update({
        where: { id },
        data: { 
          deleted_at: null
        }
      });
      
      console.log(`✅ Favorite restored: ${id}`);
      return favorite;

    } catch (error: any) {
      console.error(`❌ Error restoring favorite ${id}:`, error);
      throw error;
    }
  }

  static async getUserFavorites(user_id: string, params: any = {}) {
    try {
      console.log(`📋 Getting favorites for user: ${user_id}`);
      
      const { 
        limit = 10, 
        page = 1,
        includeDeleted = false 
      } = params;

      const take = Math.max(1, Math.min(limit, 100));
      const skip = (Math.max(1, page) - 1) * take;

      const where: any = {
        user_id
      };
      
      if (!includeDeleted) {
        where.deleted_at = null;
      }

      const [favorites, total] = await Promise.all([
        prisma.favorite.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: 'desc' },
          include: {
            property: {
              include: {
                type: {
                  select: {
                    description: true
                  }
                },
                values: {
                  where: { deleted_at: null },
                  orderBy: { created_at: 'desc' },
                  take: 1
                },
                addresses: {
                  where: { deleted_at: null },
                  include: {
                    address: true
                  }
                }
              }
            }
          }
        }),
        prisma.favorite.count({ where })
      ]);

      return {
        data: favorites || [],
        count: total || 0,
        totalPages: total ? Math.ceil(total / take) : 0,
        currentPage: page,
      };

    } catch (error: any) {
      console.error(`❌ Error getting user favorites:`, error);
      throw new Error('Failed to fetch user favorites');
    }
  }

  static async checkIfFavorite(user_id: string, property_id: string) {
    try {
      console.log(`🔍 Checking if property ${property_id} is favorite for user ${user_id}`);
      
      const favorite = await prisma.favorite.findFirst({
        where: {
          user_id,
          property_id,
          deleted_at: null
        },
        select: {
          id: true,
          created_at: true
        }
      });

      return {
        isFavorite: !!favorite,
        favorite
      };

    } catch (error: any) {
      console.error(`❌ Error checking favorite:`, error);
      throw new Error('Failed to check favorite status');
    }
  }
}