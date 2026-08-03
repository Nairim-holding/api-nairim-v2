import { isValidResource, isActionApplicable, PERMISSION_ACTIONS, ACTION_COLUMN } from '../menuResources';

export class UserGroupPermissionValidator {
  /**
   * Valida o payload da matriz. Rejeita recurso desconhecido e permissão marcada
   * numa ação que não se aplica ao recurso — a matriz não renderiza essas células,
   * então marcá-las só pode vir de payload forjado.
   */
  static validateUpsert(body: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!body || !Array.isArray(body.permissions)) {
      return { isValid: false, errors: ['O campo "permissions" deve ser uma lista'] };
    }

    const seen = new Set<string>();

    body.permissions.forEach((row: any, i: number) => {
      const where = `permissions[${i}]`;

      if (!row || typeof row.resource !== 'string' || !row.resource.trim()) {
        errors.push(`${where}: "resource" é obrigatório`);
        return;
      }

      const resource = row.resource.trim();

      if (!isValidResource(resource)) {
        errors.push(`${where}: recurso desconhecido "${resource}"`);
        return;
      }

      if (seen.has(resource)) {
        errors.push(`${where}: recurso "${resource}" repetido`);
        return;
      }
      seen.add(resource);

      for (const action of PERMISSION_ACTIONS) {
        const column = ACTION_COLUMN[action];
        const value = row[column];

        if (value === undefined || value === null) continue;

        if (typeof value !== 'boolean') {
          errors.push(`${where}.${column}: deve ser booleano`);
          continue;
        }

        if (value && !isActionApplicable(resource, action)) {
          errors.push(`${where}.${column}: ação "${action}" não se aplica ao recurso "${resource}"`);
        }
      }
    });

    return { isValid: errors.length === 0, errors };
  }
}
