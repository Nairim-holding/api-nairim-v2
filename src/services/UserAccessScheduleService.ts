// services/UserAccessScheduleService.ts
import prisma from '../lib/prisma';
import { getCurrentCompanyId } from '../lib/tenantContext';
import { timeStringToDate, timeToString } from '../utils/time';
import type { AccessScheduleRow } from '../types/user-access-schedule';

export class UserAccessScheduleService {
  static async getSchedule(userId: string): Promise<AccessScheduleRow[]> {
    // findFirst é escopado por empresa pela extensão do Prisma
    const user = await prisma.user.findFirst({
      where: { id: userId, deleted_at: null },
      select: { id: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const rows = await prisma.userAccessSchedule.findMany({
      where: { user_id: userId },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    return rows.map((r) => ({
      day_of_week: r.day_of_week,
      start_time: timeToString(r.start_time)!,
      end_time: timeToString(r.end_time)!,
    }));
  }

  /** Substitui a agenda inteira do usuário (troca atômica). */
  static async setSchedule(userId: string, rows: AccessScheduleRow[]): Promise<AccessScheduleRow[]> {
    const companyId = getCurrentCompanyId();
    if (!companyId) {
      throw new Error('Company context not found');
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, deleted_at: null },
      select: { id: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.userAccessSchedule.deleteMany({ where: { user_id: userId, company_id: companyId } });

      if (rows.length > 0) {
        await tx.userAccessSchedule.createMany({
          data: rows.map((r) => ({
            company_id: companyId,
            user_id: userId,
            day_of_week: r.day_of_week,
            start_time: timeStringToDate(r.start_time),
            end_time: timeStringToDate(r.end_time),
          })),
        });
      }
    });

    console.log(`✅ Agenda de acesso do usuário ${userId}: ${rows.length} intervalo(s)`);

    return this.getSchedule(userId);
  }
}
