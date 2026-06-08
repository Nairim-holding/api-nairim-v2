import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../utils/api-response';
import { CompanyService } from '@/services/CompanyService';
import { ValidationUtil } from '../utils/validation';
import { env } from '@/env';

const BRANDING_FIELDS = [
  'primary_color', 'secondary_color', 'company_name', 'company_info', 'logo_url', 'favicon_url',
  'trade_name', 'app_title', 'app_description', 'logo_sidebar_url', 'logo_dark_url', 'og_image_url',
  'accent_color', 'success_color', 'warning_color', 'error_color', 'info_color',
  'bg_color', 'card_color', 'border_color', 'text_color',
  'primary_color_dark', 'secondary_color_dark', 'accent_color_dark', 'success_color_dark',
  'warning_color_dark', 'error_color_dark', 'info_color_dark',
  'bg_color_dark', 'card_color_dark', 'border_color_dark', 'text_color_dark',
] as const;

function pickBrandingFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const field of BRANDING_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

// Validação de upload de assets de branding — multer (utils/upload.ts) não aplica
// fileFilter/limits por ser usado em vários fluxos; checagem fica aqui, específica
// para imagens de marca (logos, favicon, OG).
function validateBrandingImage(file: Express.Multer.File, maxSizeMB: number): string | null {
  if (!file.mimetype.startsWith('image/')) return 'Arquivo deve ser uma imagem';
  if (file.size > maxSizeMB * 1024 * 1024) return `Arquivo excede o limite de ${maxSizeMB}MB`;
  return null;
}

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
      const updated = await CompanyService.updateBranding(company_id, pickBrandingFields(req.body));
      return res.json(ApiResponse.success(updated));
    } catch (error: any) {
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  // `companyId` explícito permite que o admin gerencie assets de QUALQUER empresa
  // (telas de cadastrar/editar empresa); sem ele, usa o company_id do próprio JWT
  // (auto-atendimento via /company/branding/*).
  private static async handleAssetUpload(
    req: Request,
    res: Response,
    maxSizeMB: number,
    upload: (company_id: string, file: Express.Multer.File) => Promise<string>,
    companyId?: string,
  ) {
    try {
      const company_id = companyId ?? (req as any).user.company_id;
      if (!req.file) return res.status(400).json(ApiResponse.error('Nenhum arquivo enviado'));
      const validationError = validateBrandingImage(req.file, maxSizeMB);
      if (validationError) return res.status(400).json(ApiResponse.error(validationError));
      const url = await upload(company_id, req.file);
      return res.json(ApiResponse.success({ url }));
    } catch (error: any) {
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  static uploadLogo(req: Request, res: Response) {
    return CompanyController.handleAssetUpload(req, res, 5, (cid, file) => CompanyService.uploadLogo(cid, file));
  }

  static uploadFavicon(req: Request, res: Response) {
    return CompanyController.handleAssetUpload(req, res, 5, (cid, file) => CompanyService.uploadFavicon(cid, file));
  }

  static uploadLogoSidebar(req: Request, res: Response) {
    return CompanyController.handleAssetUpload(req, res, 5, (cid, file) => CompanyService.uploadLogoSidebar(cid, file));
  }

  static uploadLogoDark(req: Request, res: Response) {
    return CompanyController.handleAssetUpload(req, res, 5, (cid, file) => CompanyService.uploadLogoDark(cid, file));
  }

  static uploadOgImage(req: Request, res: Response) {
    return CompanyController.handleAssetUpload(req, res, 10, (cid, file) => CompanyService.uploadOgImage(cid, file));
  }

  // ─── Upload de assets para QUALQUER empresa (admin gerenciando outras empresas) ──

  static uploadLogoForCompany(req: Request, res: Response) {
    return CompanyController.handleAssetUpload(req, res, 5, (cid, file) => CompanyService.uploadLogo(cid, file), String(req.params.id));
  }

  static uploadFaviconForCompany(req: Request, res: Response) {
    return CompanyController.handleAssetUpload(req, res, 5, (cid, file) => CompanyService.uploadFavicon(cid, file), String(req.params.id));
  }

  static uploadLogoSidebarForCompany(req: Request, res: Response) {
    return CompanyController.handleAssetUpload(req, res, 5, (cid, file) => CompanyService.uploadLogoSidebar(cid, file), String(req.params.id));
  }

  static uploadLogoDarkForCompany(req: Request, res: Response) {
    return CompanyController.handleAssetUpload(req, res, 5, (cid, file) => CompanyService.uploadLogoDark(cid, file), String(req.params.id));
  }

  static uploadOgImageForCompany(req: Request, res: Response) {
    return CompanyController.handleAssetUpload(req, res, 10, (cid, file) => CompanyService.uploadOgImage(cid, file), String(req.params.id));
  }

  // ─── CRUD de Empresas ─────────────────────────────────────────────────────

  static async checkSlugAvailability(req: Request, res: Response) {
    try {
      const slug = String(req.params.slug ?? '').toLowerCase().trim();
      if (!slug) return res.status(400).json(ApiResponse.error('Slug é obrigatório'));

      const existing = await CompanyService.checkSlugExists(slug);
      return res.json(ApiResponse.success({ available: !existing }));
    } catch (error: any) {
      return res.status(500).json(ApiResponse.error(error.message));
    }
  }

  static async listCompanies(req: Request, res: Response) {
    try {
      const page = ValidationUtil.parseNumberParam(req.query.page, 1);
      const limit = ValidationUtil.parseNumberParam(req.query.limit, 30);
      const search = ValidationUtil.parseStringParam(req.query.search) ?? '';
      const includeInactive = req.query.includeInactive === 'true';
      const result = await CompanyService.listCompanies({ page, limit, search, includeInactive });
      // Formato flat esperado pelo DataTable (igual a UserController.getUsers)
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({
        data: result.data,
        count: result.count,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      });
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
      const { name, slug } = req.body;
      if (!name || !slug) return res.status(400).json(ApiResponse.error('name e slug são obrigatórios'));
      const company = await CompanyService.createCompany({
        name,
        slug: slug.toLowerCase().trim(),
        ...pickBrandingFields(req.body),
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
      const { name, slug, is_active } = req.body;
      const updated = await CompanyService.updateCompany(id, {
        name,
        slug: slug ? slug.toLowerCase().trim() : undefined,
        is_active,
        ...pickBrandingFields(req.body),
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
        user: { ...currentUser, company_id: target.company.id, company_slug: target.company.slug },
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
