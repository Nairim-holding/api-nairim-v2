import prisma from '../lib/prisma';
import { BlobService } from '../lib/blobService';

export interface BrandingUpdateData {
  logo_url?: string;
  favicon_url?: string;
  primary_color?: string;
  secondary_color?: string;
  company_name?: string;
  company_info?: object;

  trade_name?: string;
  app_title?: string;
  app_description?: string;
  logo_sidebar_url?: string;
  logo_dark_url?: string;
  og_image_url?: string;

  accent_color?: string;
  success_color?: string;
  warning_color?: string;
  error_color?: string;
  info_color?: string;
  bg_color?: string;
  card_color?: string;
  border_color?: string;
  text_color?: string;

  primary_color_dark?: string;
  secondary_color_dark?: string;
  accent_color_dark?: string;
  success_color_dark?: string;
  warning_color_dark?: string;
  error_color_dark?: string;
  info_color_dark?: string;
  bg_color_dark?: string;
  card_color_dark?: string;
  border_color_dark?: string;
  text_color_dark?: string;
}

// Cache em memória do branding público por slug — endpoint chamado a cada
// renderização de página no front (ISR só amortece no nível do Next.js).
// TTL curto: dados mudam raramente e a invalidação explícita em updateBranding/
// uploadX já cobre o caso comum (admin altera e quer ver refletido na hora).
const BRANDING_CACHE_TTL_MS = 60_000;
const brandingCache = new Map<string, { data: { company: any; branding: any }; expiresAt: number }>();

function invalidateBrandingCacheBySlug(slug: string) {
  brandingCache.delete(slug);
}

async function invalidateBrandingCacheByCompanyId(company_id: string) {
  const company = await prisma.company.findUnique({ where: { id: company_id }, select: { slug: true } });
  if (company?.slug) invalidateBrandingCacheBySlug(company.slug);
}

export class CompanyService {
  // ─── Validação ────────────────────────────────────────────────────────────

  static async checkSlugExists(slug: string): Promise<boolean> {
    const company = await prisma.company.findUnique({ where: { slug } });
    return !!company;
  }

  // ─── Branding ─────────────────────────────────────────────────────────────

  static async getBrandingBySlug(slug: string) {
    const cached = brandingCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const company = await prisma.company.findUnique({
      where: { slug, is_active: true, deleted_at: null },
      include: { branding: true },
    });
    if (!company) return null;

    const data = { company, branding: company.branding };
    brandingCache.set(slug, { data, expiresAt: Date.now() + BRANDING_CACHE_TTL_MS });
    return data;
  }

  static async getBrandingByCompanyId(company_id: string) {
    return prisma.companyBranding.findUnique({ where: { company_id } });
  }

  static async updateBranding(company_id: string, data: BrandingUpdateData) {
    const updated = await prisma.companyBranding.upsert({
      where: { company_id },
      update: { ...data, updated_at: new Date() },
      create: { company_id, ...data },
    });
    await invalidateBrandingCacheByCompanyId(company_id);
    return updated;
  }

  static async uploadBrandingAsset(
    company_id: string,
    file: Express.Multer.File,
    field: 'logo_url' | 'favicon_url' | 'logo_sidebar_url' | 'logo_dark_url' | 'og_image_url',
  ): Promise<string> {
    const result = await BlobService.moveFile(file, file.originalname, `companies/${company_id}`);
    const url = result.result.url;

    const updateData: any = { [field]: url, updated_at: new Date() };
    const createData: any = { company_id, [field]: url };

    await prisma.companyBranding.upsert({
      where: { company_id },
      update: updateData,
      create: createData,
    });
    await invalidateBrandingCacheByCompanyId(company_id);
    return url;
  }

  static uploadLogo(company_id: string, file: Express.Multer.File): Promise<string> {
    return this.uploadBrandingAsset(company_id, file, 'logo_url');
  }

  static uploadFavicon(company_id: string, file: Express.Multer.File): Promise<string> {
    return this.uploadBrandingAsset(company_id, file, 'favicon_url');
  }

  static uploadLogoSidebar(company_id: string, file: Express.Multer.File): Promise<string> {
    return this.uploadBrandingAsset(company_id, file, 'logo_sidebar_url');
  }

  static uploadLogoDark(company_id: string, file: Express.Multer.File): Promise<string> {
    return this.uploadBrandingAsset(company_id, file, 'logo_dark_url');
  }

  static uploadOgImage(company_id: string, file: Express.Multer.File): Promise<string> {
    return this.uploadBrandingAsset(company_id, file, 'og_image_url');
  }

  // ─── CRUD de Empresas ─────────────────────────────────────────────────────

  static async listCompanies(params: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
  } = {}) {
    const { page = 1, limit = 30, search = '', includeInactive = false } = params;
    const take = Math.max(1, Math.min(limit, 100));
    const skip = (Math.max(1, page) - 1) * take;

    const where: any = {};
    if (!includeInactive) where.deleted_at = null;
    if (search.trim()) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, count] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: { branding: { select: { company_name: true, trade_name: true, logo_url: true, logo_dark_url: true, primary_color: true } } },
      }),
      prisma.company.count({ where }),
    ]);

    return { data, count, totalPages: Math.ceil(count / take), currentPage: page };
  }

  static async getCompanyById(id: string) {
    const company = await prisma.company.findUnique({
      where: { id },
      include: { branding: true },
    });
    if (!company) throw new Error('Empresa não encontrada');
    return company;
  }

  static async createCompany(data: {
    name: string;
    slug: string;
  } & BrandingUpdateData) {
    const existing = await prisma.company.findUnique({ where: { slug: data.slug } });
    if (existing) throw new Error('Já existe uma empresa com este slug');

    const { name, slug, ...branding } = data;
    const hasBranding = Object.values(branding).some(v => v !== undefined);

    return prisma.company.create({
      data: {
        name,
        slug,
        is_active: true,
        ...(hasBranding ? {
          branding: { create: { ...branding } },
        } : {}),
      },
      include: { branding: true },
    });
  }

  static async updateCompany(id: string, data: {
    name?: string;
    slug?: string;
    is_active?: boolean;
  } & BrandingUpdateData) {
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) throw new Error('Empresa não encontrada');

    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await prisma.company.findFirst({ where: { slug: data.slug, NOT: { id } } });
      if (slugExists) throw new Error('Já existe uma empresa com este slug');
    }

    const { name, slug, is_active, ...branding } = data;
    const hasBranding = Object.values(branding).some(v => v !== undefined);

    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(is_active !== undefined ? { is_active } : {}),
        ...(hasBranding ? {
          branding: {
            upsert: {
              create: { ...branding },
              update: { ...branding, updated_at: new Date() },
            },
          },
        } : {}),
      },
      include: { branding: true },
    });
    if (hasBranding) await invalidateBrandingCacheBySlug(updated.slug);
    return updated;
  }

  static async deleteCompany(id: string) {
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) throw new Error('Empresa não encontrada');
    return prisma.company.update({ where: { id }, data: { deleted_at: new Date(), is_active: false } });
  }

  static async restoreCompany(id: string) {
    return prisma.company.update({ where: { id }, data: { deleted_at: null, is_active: true } });
  }
}
