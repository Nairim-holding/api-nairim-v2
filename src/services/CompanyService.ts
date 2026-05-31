import prisma from '../lib/prisma';
import { BlobService } from '../lib/blobService';

export class CompanyService {
  // ─── Branding ─────────────────────────────────────────────────────────────

  static async getBrandingBySlug(slug: string) {
    const company = await prisma.company.findUnique({
      where: { slug, is_active: true, deleted_at: null },
      include: { branding: true },
    });
    if (!company) return null;
    return { company, branding: company.branding };
  }

  static async getBrandingByCompanyId(company_id: string) {
    return prisma.companyBranding.findUnique({ where: { company_id } });
  }

  static async updateBranding(company_id: string, data: {
    logo_url?: string;
    favicon_url?: string;
    primary_color?: string;
    secondary_color?: string;
    company_name?: string;
    company_info?: object;
  }) {
    return prisma.companyBranding.upsert({
      where: { company_id },
      update: { ...data, updated_at: new Date() },
      create: { company_id, ...data },
    });
  }

  static async uploadLogo(company_id: string, file: Express.Multer.File): Promise<string> {
    const result = await BlobService.moveFile(file, file.originalname, `companies/${company_id}`);
    await prisma.companyBranding.upsert({
      where: { company_id },
      update: { logo_url: result.result.url },
      create: { company_id, logo_url: result.result.url },
    });
    return result.result.url;
  }

  static async uploadFavicon(company_id: string, file: Express.Multer.File): Promise<string> {
    const result = await BlobService.moveFile(file, file.originalname, `companies/${company_id}`);
    await prisma.companyBranding.upsert({
      where: { company_id },
      update: { favicon_url: result.result.url },
      create: { company_id, favicon_url: result.result.url },
    });
    return result.result.url;
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
        include: { branding: { select: { company_name: true, logo_url: true, primary_color: true } } },
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
    company_name?: string;
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string;
    favicon_url?: string;
  }) {
    const existing = await prisma.company.findUnique({ where: { slug: data.slug } });
    if (existing) throw new Error('Já existe uma empresa com este slug');

    const { name, slug, ...branding } = data;
    const hasBranding = Object.values(branding).some(v => v);

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
    company_name?: string;
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string;
    favicon_url?: string;
  }) {
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) throw new Error('Empresa não encontrada');

    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await prisma.company.findFirst({ where: { slug: data.slug, NOT: { id } } });
      if (slugExists) throw new Error('Já existe uma empresa com este slug');
    }

    const { name, slug, is_active, company_name, primary_color, secondary_color, logo_url, favicon_url } = data;
    const hasBranding = [company_name, primary_color, secondary_color, logo_url, favicon_url].some(v => v !== undefined);

    return prisma.company.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(is_active !== undefined ? { is_active } : {}),
        ...(hasBranding ? {
          branding: {
            upsert: {
              create: { company_name, primary_color, secondary_color, logo_url, favicon_url },
              update: {
                ...(company_name !== undefined ? { company_name } : {}),
                ...(primary_color !== undefined ? { primary_color } : {}),
                ...(secondary_color !== undefined ? { secondary_color } : {}),
                ...(logo_url !== undefined ? { logo_url } : {}),
                ...(favicon_url !== undefined ? { favicon_url } : {}),
              },
            },
          },
        } : {}),
      },
      include: { branding: true },
    });
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
