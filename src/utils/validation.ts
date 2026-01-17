export class ValidationUtil {
  static parseStringParam(param: any): string | undefined {
    if (param === undefined || param === null) return undefined;
    if (Array.isArray(param)) return String(param[0]);
    return String(param);
  }

  static parseNumberParam(param: any, defaultValue: number): number {
    const value = this.parseStringParam(param);
    if (!value) return defaultValue;
    
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  static parseBooleanParam(param: any): boolean {
    const value = this.parseStringParam(param);
    return value === 'true';
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateCNPJ(cnpj: string): boolean {
    const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
    return cleanCNPJ.length === 14;
  }

  static required(value: any, fieldName: string): string | null {
    if (value === undefined || value === null || value === '') {
      return `${fieldName} é obrigatório`;
    }
    return null;
  }
}