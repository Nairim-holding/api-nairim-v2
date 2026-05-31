import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../utils/api-response';
import { CompanyService } from '@/services/CompanyService';
import { ValidationUtil } from '../utils/validation';
import { env } from '@/env';

export class CompanyController {
  // ─── Branding (public + admin) ────────────────────────────────────────────

  static async getPublicBranding(req: Request, res: Response) {
    try {
      const slug = req.query.slug as string;
      if (!slug) return res.status(400).json(ApiResponse.error('Parâmetro "slug" é obrigatório'));
      const data = await CompanyService.getBrandingBySlug(slug);
      if (!data) return res.status(404).json(ApiResponse.error('Empresa não encontrada'));
      return res.json(ApiResponse.success(data));
    } catch (error: any) {
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  static async getMyBranding(req: Request, res: Response) {
    try {
      const { company_id } = (req as any).user;
      const branding = await CompanyService.getBrandingByCompanyId(company_id);
      return res.json(ApiResponse.success(branding));
    } catch (error: any) {
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  static async updateBranding(req: Request, res: Response) {
    try {
      const { company_id } = (req as any).user;
      const { primary_color, secondary_color, company_name, company_info, logo_url, favicon_url } = req.body;
      const updated = await CompanyService.updateBranding(company_id, {
        primary_color, secondary_color, company_name, company_info, logo_url, favicon_url,
      });
      return res.json(ApiResponse.success(updated));
    } catch (error: any) {
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  static async uploadLogo(req: Request, res: Response) {
    try {
      const { company_id } = (req as any).user;
      if (!req.file) return res.status(400).json(ApiResponse.error('Nenhum arquivo enviado'));
      const url = await CompanyService.uploadLogo(company_id, req.file);
      return res.json(ApiResponse.success({ url }));
    } catch (error: any) {
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  static async uploadFavicon(req: Request, res: Response) {
    try {
      const { company_id } = (req as any).user;
      if (!req.file) return res.status(400).json(ApiResponse.error('Nenhum arquivo enviado'));
      const url = await CompanyService.uploadFavicon(company_id, req.file);
      return res.json(ApiResponse.success({ url }));
    } catch (error: any) {
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  // ─── CRUD de Empresas ─────────────────────────────────────────────────────

  static async listCompanies(req: Request, res: Response) {
    try {
      const page = ValidationUtil.parseNumberParam(req.query.page, 1);
      const limit = ValidationUtil.parseNumberParam(req.query.limit, 30);
      const search = ValidationUtil.parseStringParam(req.query.search) ?? '';
      const includeInactive = req.query.includeInactive === 'true';
      const result = await CompanyService.listCompanies({ page, limit, search, includeInactive });
      return res.json(ApiResponse.success(result));
    } catch (error: any) {
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  static async getCompanyById(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const company = await CompanyService.getCompanyById(id);
      return res.json(ApiResponse.success(company));
    } catch (error: any) {
      if (error.message === 'Empresa não encontrada') return res.status(404).json(ApiResponse.error(error.message));
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  static async createCompany(req: Request, res: Response) {
    try {
      const { name, slug, company_name, primary_color, secondary_color, logo_url, favicon_url } = req.body;
      if (!name || !slug) return res.status(400).json(ApiResponse.error('name e slug são obrigatórios'));
      const company = await CompanyService.createCompany({
        name,
        slug: slug.toLowerCase().trim(),
        company_name,
        primary_color,
        secondary_color,
        logo_url,
        favicon_url,
      });
      return res.status(201).json(ApiResponse.success(company, 'Empresa criada com sucesso'));
    } catch (error: any) {
      if (error.message.includes('slug')) return res.status(409).json(ApiResponse.error(error.message));
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  static async updateCompany(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { name, slug, is_active, company_name, primary_color, secondary_color, logo_url, favicon_url } = req.body;
      const updated = await CompanyService.updateCompany(id, {
        name,
        slug: slug ? slug.toLowerCase().trim() : undefined,
        is_active,
        company_name,
        primary_color,
        secondary_color,
        logo_url,
        favicon_url,
      });
      return res.json(ApiResponse.success(updated, 'Empresa atualizada com sucesso'));
    } catch (error: any) {
      if (error.message === 'Empresa não encontrada') return res.status(404).json(ApiResponse.error(error.message));
      if (error.message.includes('slug')) return res.status(409).json(ApiResponse.error(error.message));
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  static async deleteCompany(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      await CompanyService.deleteCompany(id);
      return res.json(ApiResponse.success(null, 'Empresa desativada com sucesso'));
    } catch (error: any) {
      if (error.message === 'Empresa não encontrada') return res.status(404).json(ApiResponse.error(error.message));
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  // Emite um novo JWT com o company_id da empresa destino.
  // O usuário permanece autenticado — apenas o contexto de empresa muda.
  static async switchCompany(req: Request, res: Response) {
    try {
      const { slug } = req.body;
      if (!slug) return res.status(400).json(ApiResponse.error('"slug" é obrigatório'));

      // Company não está no TENANT_MODELS, então esta query ignora o filtro de empresa
      const target = await CompanyService.getBrandingBySlug(slug);
      if (!target?.company) return res.status(404).json(ApiResponse.error('Empresa não encontrada ou inativa'));

      const currentUser = (req as any).user;
      const payload = {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        company_id: target.company.id,
      };

      const token = jwt.sign(payload, env.JWT_SECRET as string, { expiresIn: '2h' });

      return res.json(ApiResponse.success({
        token,
        user: { ...currentUser, company_id: target.company.id },
        company: { id: target.company.id, name: target.company.name, slug: target.company.slug },
      }, 'Contexto de empresa alterado com sucesso'));
    } catch (error: any) {
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  static async getCompanyFilters(_req: Request, res: Response) {
    try {
      return res.json(ApiResponse.success({
        filters: [
          { field: 'name', type: 'string', label: 'Nome', searchable: true },
          { field: 'slug', type: 'string', label: 'Slug', searchable: true },
          { field: 'is_active', type: 'select', label: 'Status', values: [
            { value: 'true', label: 'Ativo' },
            { value: 'false', label: 'Inativo' },
          ]},
        ],
        operators: { string: ['contains', 'equals'], select: ['equals'], boolean: ['equals'] },
        defaultSort: 'name:asc',
        searchFields: ['name', 'slug'],
      }));
    } catch (error: any) {
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  static async restoreCompany(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const company = await CompanyService.restoreCompany(id);
      return res.json(ApiResponse.success(company, 'Empresa reativada com sucesso'));
    } catch (error: any) {
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }
}
