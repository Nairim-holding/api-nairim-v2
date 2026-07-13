import prisma from '../lib/prisma';
import {
  SaveColumnPreferencesInput,
  ColumnPreferencesResponse,
  SaveDashboardLayoutInput,
  DashboardLayoutResponse,
  DashboardLayoutItem
} from '../types/user-preferences';

export class UserPreferencesService {
  static async getColumnPreferences(
    userId: string,
    resource: string
  ): Promise<ColumnPreferencesResponse | null> {
    try {
      console.log(`🔍 Getting column preferences: user_id=${userId}, resource=${resource}`);

      const preferences = await prisma.userColumnPreference.findUnique({
        where: {
          user_id_resource: {
            user_id: userId,
            resource
          }
        }
      });

      if (!preferences) {
        console.log(`⚠️ No preferences found for user ${userId} and resource ${resource}`);
        return null;
      }

      console.log(`✅ Found preferences for user ${userId} and resource ${resource}`);

      return {
        id: preferences.id,
        user_id: preferences.user_id,
        resource: preferences.resource,
        columnOrder: (preferences.column_order as string[]) || [],
        columnWidths: (preferences.column_widths as Record<string, number>) || {},
        visibleColumns: (preferences.visible_columns as string[]) || [],
        created_at: preferences.created_at.toISOString(),
        updated_at: preferences.updated_at.toISOString()
      };
    } catch (error: any) {
      console.error(`❌ Error getting column preferences: ${error.message}`);
      throw error;
    }
  }

  static async saveColumnPreferences(
    userId: string,
    input: SaveColumnPreferencesInput,
    company_id: string
  ): Promise<ColumnPreferencesResponse> {
    try {
      console.log(`💾 Saving column preferences: user_id=${userId}, resource=${input.resource}`);

      // Verificar se preferências já existem
      const existingPreferences = await prisma.userColumnPreference.findUnique({
        where: {
          user_id_resource: {
            user_id: userId,
            resource: input.resource
          }
        }
      });

      let preferences;

      if (existingPreferences) {
        // Atualizar preferências existentes
        preferences = await prisma.userColumnPreference.update({
          where: {
            id: existingPreferences.id
          },
          data: {
            column_order: input.columnOrder,
            column_widths: input.columnWidths,
            visible_columns: input.visibleColumns,
            updated_at: new Date()
          }
        });

        console.log(`✏️ Updated preferences for user ${userId} and resource ${input.resource}`);
      } else {
        // Criar novas preferências
        preferences = await prisma.userColumnPreference.create({
          data: {
            user_id: userId,
            resource: input.resource,
            column_order: input.columnOrder,
            column_widths: input.columnWidths,
            visible_columns: input.visibleColumns,
            company_id,
          }
        });

        console.log(`➕ Created preferences for user ${userId} and resource ${input.resource}`);
      }

      return {
        id: preferences.id,
        user_id: preferences.user_id,
        resource: preferences.resource,
        columnOrder: (preferences.column_order as string[]) || [],
        columnWidths: (preferences.column_widths as Record<string, number>) || {},
        visibleColumns: (preferences.visible_columns as string[]) || [],
        created_at: preferences.created_at.toISOString(),
        updated_at: preferences.updated_at.toISOString()
      };
    } catch (error: any) {
      console.error(`❌ Error saving column preferences: ${error.message}`);
      throw error;
    }
  }

  static async getDashboardLayout(
    userId: string,
    resource: string
  ): Promise<DashboardLayoutResponse | null> {
    const layout = await prisma.userDashboardLayout.findUnique({
      where: {
        user_id_resource: {
          user_id: userId,
          resource
        }
      }
    });

    if (!layout) return null;

    return {
      id: layout.id,
      user_id: layout.user_id,
      resource: layout.resource,
      layout: (layout.layout as unknown as DashboardLayoutItem[]) || [],
      created_at: layout.created_at.toISOString(),
      updated_at: layout.updated_at.toISOString()
    };
  }

  static async saveDashboardLayout(
    userId: string,
    input: SaveDashboardLayoutInput,
    company_id: string
  ): Promise<DashboardLayoutResponse> {
    const existing = await prisma.userDashboardLayout.findUnique({
      where: {
        user_id_resource: {
          user_id: userId,
          resource: input.resource
        }
      }
    });

    const layout = existing
      ? await prisma.userDashboardLayout.update({
          where: { id: existing.id },
          data: { layout: input.layout as any, updated_at: new Date() }
        })
      : await prisma.userDashboardLayout.create({
          data: {
            user_id: userId,
            resource: input.resource,
            layout: input.layout as any,
            company_id
          }
        });

    return {
      id: layout.id,
      user_id: layout.user_id,
      resource: layout.resource,
      layout: (layout.layout as unknown as DashboardLayoutItem[]) || [],
      created_at: layout.created_at.toISOString(),
      updated_at: layout.updated_at.toISOString()
    };
  }
}
