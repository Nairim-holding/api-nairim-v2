import { isValidTimeString, timeStringToMinutes } from '../../utils/time';

export class UserAccessScheduleValidator {
  /**
   * Valida a agenda inteira enviada pela grade. Rejeita dia fora de 0–6,
   * horário fora do formato, intervalo invertido e sobreposição dentro do
   * mesmo dia (a grade não deveria produzir sobreposição, mas o backend não
   * confia só na UI).
   */
  static validate(body: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!body || !Array.isArray(body.schedules)) {
      return { isValid: false, errors: ['O campo "schedules" deve ser uma lista'] };
    }

    const byDay = new Map<number, Array<{ start: number; end: number }>>();

    body.schedules.forEach((row: any, i: number) => {
      const where = `schedules[${i}]`;

      const day = Number(row?.day_of_week);
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        errors.push(`${where}: "day_of_week" deve ser um número de 0 (Domingo) a 6 (Sábado)`);
        return;
      }

      if (!isValidTimeString(row?.start_time) || !isValidTimeString(row?.end_time)) {
        errors.push(`${where}: horários devem estar no formato HH:MM`);
        return;
      }

      const start = timeStringToMinutes(row.start_time);
      const end = timeStringToMinutes(row.end_time);

      if (start >= end) {
        errors.push(`${where}: o horário inicial deve ser anterior ao final`);
        return;
      }

      const existing = byDay.get(day) ?? [];
      const overlaps = existing.some((r) => start < r.end && end > r.start);
      if (overlaps) {
        errors.push(`${where}: sobrepõe outro intervalo do mesmo dia`);
        return;
      }
      existing.push({ start, end });
      byDay.set(day, existing);
    });

    return { isValid: errors.length === 0, errors };
  }
}
