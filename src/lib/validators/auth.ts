// src/lib/validators/auth.ts
export class AuthValidator {
  static validateLogin(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.email?.trim()) {
      errors.push('Email é obrigatório');
    }

    if (!data.password?.trim()) {
      errors.push('Senha é obrigatória');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateToken(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.token?.trim()) {
      errors.push('Token é obrigatório');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}