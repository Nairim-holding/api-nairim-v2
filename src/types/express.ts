import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    company_id: string;
    iat: number;
    exp: number;
  };
}
