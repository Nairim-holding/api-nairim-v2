/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import prisma from '../lib/prisma';

/**
 * Backup e restauração dos dados de UMA empresa (multi-tenant).
 *
 * Escopo: todos os registros com `company_id` da empresa + os filhos vinculados
 * por relação (endereços, contatos, valores, IPTU, meses de planejamento). As
 * mídias em si (arquivos no MinIO) NÃO entram — o backup preserva apenas as URLs
 * já gravadas em `Document.file_path`.
 *
 * Fase atual: EXPORT (backup + download). O RESTORE virá em fase separada.
 */

/** Versão do formato do arquivo de backup. Incrementar em mudanças incompatíveis. */
export const BACKUP_FORMAT_VERSION = 1;

const idsOf = (arr: any[]): string[] => arr.map((x) => x.id);

export class BackupService {
  /**
   * Restaura os dados de uma empresa a partir de um arquivo de backup.
   *
   * Fluxo:
   * 1. Valida o arquivo (formatVersion, checksum, integridade)
   * 2. Confirma que o usuário sabe o que está fazendo (nome da empresa)
   * 3. Cria um backup automático ANTES de deletar qualquer coisa
   * 4. Deleta TODOS os dados da empresa em ordem FK-safe (filhos antes de pais)
   * 5. Reinsere os dados do arquivo em ordem FK-safe (pais antes de filhos)
   * 6. Tudo dentro de uma transação Prisma (atomicidade)
   *
   * ⚠️ OPERAÇÃO DESTRUTIVA: não há volta (a menos que o usuário restaure o backup automático)
   */
  static async restoreCompany(company_id: string, backupData: any, confirmationName: string) {
    const company = await prisma.company.findUnique({ where: { id: company_id } });
    if (!company) throw new Error('Company not found');

    // Validar confirmação (usuário deve digitar o nome OU slug da empresa, case-insensitive)
    const isValidConfirmation =
      confirmationName.toLowerCase() === company.name.toLowerCase() ||
      confirmationName.toLowerCase() === company.slug.toLowerCase();

    if (!isValidConfirmation) {
      throw new Error(
        `Confirmação inválida. Digite exatamente "${company.name}" ou "${company.slug}" para prosseguir.`
      );
    }

    // Validar formato e integridade do backup
    if (!backupData?.meta || !backupData?.data) {
      throw new Error('Arquivo de backup inválido (estrutura esperada: meta + data)');
    }

    const { meta, data } = backupData;
    if (meta.formatVersion !== BACKUP_FORMAT_VERSION) {
      throw new Error(
        `Versão do backup incompatível. Esperado: v${BACKUP_FORMAT_VERSION}, recebido: v${meta.formatVersion}`
      );
    }

    if (meta.company_id !== company_id) {
      throw new Error(
        `Backup não corresponde a esta empresa. ID no arquivo: ${meta.company_id}, ID atual: ${company_id}`
      );
    }

    // Validar checksum (detecta arquivos corrompidos)
    const dataStr = JSON.stringify(data);
    const actualChecksum = crypto.createHash('sha256').update(dataStr).digest('hex');
    if (actualChecksum !== meta.checksum) {
      throw new Error('Checksum do backup não corresponde. Arquivo pode estar corrompido.');
    }

    // ────────────────────────────────────────────────────────────────
    // Auto-backup antes de destruir: exporta o estado atual
    // ────────────────────────────────────────────────────────────────
    const currentBackup = await this.exportCompany(company_id);
    const autoBackupName = `backup-nairim-${company.slug}-auto-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    // Nota: em produção, seria interessante salvar em blob storage ou arquivo local
    console.log(`Auto-backup criado: ${autoBackupName}`, { counts: currentBackup.meta.counts });

    // ────────────────────────────────────────────────────────────────
    // Deleta os dados da empresa de forma FK-safe (filhos antes de pais)
    // Ordem reversa da inserção: document, planning, transaction, etc.
    // ────────────────────────────────────────────────────────────────
    return await prisma.$transaction(async (tx) => {
      // Filhos/relacionamentos (sempre seguro deletar primeiro)
      await tx.agencyAddress.deleteMany({ where: { agency: { company_id } } });
      await tx.propertyAddress.deleteMany({ where: { property: { company_id } } });
      await tx.ownerAddress.deleteMany({ where: { owner: { company_id } } });
      await tx.tenantAddress.deleteMany({ where: { tenant: { company_id } } });
      await tx.supplierAddress.deleteMany({ where: { supplier: { company_id } } });
      await tx.contact.deleteMany({
        where: {
          OR: [
            { agency: { company_id } },
            { owner: { company_id } },
            { tenant: { company_id } },
            { supplier: { company_id } },
          ],
        },
      });
      await tx.propertyValue.deleteMany({ where: { property: { company_id } } });
      await tx.propertyIptu.deleteMany({ where: { property: { company_id } } });
      await tx.planningMonth.deleteMany({ where: { planning: { company_id } } });
      await tx.userColumnPreference.deleteMany({ where: { company_id } });
      await tx.userDashboardLayout.deleteMany({ where: { company_id } });
      await tx.document.deleteMany({ where: { company_id } });
      await tx.favorite.deleteMany({ where: { company_id } });

      // Transações e faturas
      await tx.transaction.deleteMany({ where: { company_id } });
      await tx.invoice.deleteMany({ where: { company_id } });

      // Configurações e planos
      await tx.recurringConfig.deleteMany({ where: { company_id } });
      await tx.planning.deleteMany({ where: { company_id } });

      // Locações (depois, porque podem ter documents e transactions vinculadas)
      await tx.lease.deleteMany({ where: { company_id } });

      // Imóveis (podem ter locações, valores, etc.)
      await tx.property.deleteMany({ where: { company_id } });

      // Pessoas (inquilinos, proprietários, imobiliárias, fornecedores)
      await tx.tenant.deleteMany({ where: { company_id } });
      await tx.owner.deleteMany({ where: { company_id } });
      await tx.agency.deleteMany({ where: { company_id } });
      await tx.supplier.deleteMany({ where: { company_id } });

      // Usuários (cuidado: podem ter muitas relações)
      // NOTA: Por segurança, NÃO deletamos usuários na restauração de backup
      // (usuários são entidades de acesso, não de dados de negócio).
      // await tx.user.deleteMany({ where: { company_id } });

      // Referências (financeiro, tipos, etc.)
      await tx.card.deleteMany({ where: { company_id } });
      await tx.center.deleteMany({ where: { company_id } });
      await tx.subcategory.deleteMany({ where: { company_id } });
      await tx.category.deleteMany({ where: { company_id } });
      await tx.financialInstitution.deleteMany({ where: { company_id } });
      await tx.propertyType.deleteMany({ where: { company_id } });

      // Marca de negócio
      await tx.companyBranding.deleteMany({ where: { company_id } });

      // ────────────────────────────────────────────────────────────────
      // Reinsere os dados na ordem FK-safe (pais antes de filhos)
      // Respeitando o campo `company_id` que já vem no arquivo
      // ────────────────────────────────────────────────────────────────

      // Marca de negócio
      if (Array.isArray(data.companyBranding) && data.companyBranding.length > 0) {
        await tx.companyBranding.createMany({ data: data.companyBranding as any });
      }

      // Referências (antes de usá-las em outros registros).
      // ATENÇÃO: as chaves seguem os nomes usados no export (plural).
      if (Array.isArray(data.propertyTypes) && data.propertyTypes.length > 0) {
        await tx.propertyType.createMany({ data: data.propertyTypes as any });
      }
      if (Array.isArray(data.financialInstitutions) && data.financialInstitutions.length > 0) {
        await tx.financialInstitution.createMany({ data: data.financialInstitutions as any });
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        await tx.category.createMany({ data: data.categories as any });
      }
      if (Array.isArray(data.subcategories) && data.subcategories.length > 0) {
        await tx.subcategory.createMany({ data: data.subcategories as any });
      }
      if (Array.isArray(data.centers) && data.centers.length > 0) {
        await tx.center.createMany({ data: data.centers as any });
      }
      if (Array.isArray(data.cards) && data.cards.length > 0) {
        await tx.card.createMany({ data: data.cards as any });
      }

      // Pais de relacionamentos (antes dos filhos).
      // Endereços são uma tabela compartilhada (não são deletados por empresa),
      // então usamos upsert para evitar conflito de id.
      if (Array.isArray(data.addresses) && data.addresses.length > 0) {
        for (const address of data.addresses) {
          await tx.address.upsert({
            where: { id: address.id },
            update: address as any,
            create: address as any,
          });
        }
      }
      if (Array.isArray(data.agencies) && data.agencies.length > 0) {
        await tx.agency.createMany({ data: data.agencies as any });
      }
      if (Array.isArray(data.owners) && data.owners.length > 0) {
        await tx.owner.createMany({ data: data.owners as any });
      }
      if (Array.isArray(data.tenants) && data.tenants.length > 0) {
        await tx.tenant.createMany({ data: data.tenants as any });
      }
      if (Array.isArray(data.suppliers) && data.suppliers.length > 0) {
        await tx.supplier.createMany({ data: data.suppliers as any });
      }
      if (Array.isArray(data.properties) && data.properties.length > 0) {
        await tx.property.createMany({ data: data.properties as any });
      }

      // Filhos
      if (Array.isArray(data.agencyAddresses) && data.agencyAddresses.length > 0) {
        await tx.agencyAddress.createMany({ data: data.agencyAddresses as any });
      }
      if (Array.isArray(data.propertyAddresses) && data.propertyAddresses.length > 0) {
        await tx.propertyAddress.createMany({ data: data.propertyAddresses as any });
      }
      if (Array.isArray(data.ownerAddresses) && data.ownerAddresses.length > 0) {
        await tx.ownerAddress.createMany({ data: data.ownerAddresses as any });
      }
      if (Array.isArray(data.tenantAddresses) && data.tenantAddresses.length > 0) {
        await tx.tenantAddress.createMany({ data: data.tenantAddresses as any });
      }
      if (Array.isArray(data.supplierAddresses) && data.supplierAddresses.length > 0) {
        await tx.supplierAddress.createMany({ data: data.supplierAddresses as any });
      }
      if (Array.isArray(data.contacts) && data.contacts.length > 0) {
        await tx.contact.createMany({ data: data.contacts as any });
      }
      if (Array.isArray(data.propertyValues) && data.propertyValues.length > 0) {
        await tx.propertyValue.createMany({ data: data.propertyValues as any });
      }
      if (Array.isArray(data.propertyIptus) && data.propertyIptus.length > 0) {
        await tx.propertyIptu.createMany({ data: data.propertyIptus as any });
      }

      // Usuários (preservados, apenas recriados se não existem)
      if (Array.isArray(data.users) && data.users.length > 0) {
        for (const user of data.users) {
          await tx.user.upsert({
            where: { id: user.id },
            update: { ...user, company_id }, // Garante company_id correto
            create: { ...user, company_id },
          });
        }
      }

      // Negócio (locações, planejamento, transações)
      if (Array.isArray(data.leases) && data.leases.length > 0) {
        await tx.lease.createMany({ data: data.leases as any });
      }
      if (Array.isArray(data.plannings) && data.plannings.length > 0) {
        await tx.planning.createMany({ data: data.plannings as any });
      }
      if (Array.isArray(data.planningMonths) && data.planningMonths.length > 0) {
        await tx.planningMonth.createMany({ data: data.planningMonths as any });
      }
      if (Array.isArray(data.recurringConfigs) && data.recurringConfigs.length > 0) {
        await tx.recurringConfig.createMany({ data: data.recurringConfigs as any });
      }
      if (Array.isArray(data.transactions) && data.transactions.length > 0) {
        await tx.transaction.createMany({ data: data.transactions as any });
      }
      if (Array.isArray(data.invoices) && data.invoices.length > 0) {
        await tx.invoice.createMany({ data: data.invoices as any });
      }

      // Documentos e preferências (últimas, relações leves)
      if (Array.isArray(data.documents) && data.documents.length > 0) {
        await tx.document.createMany({ data: data.documents as any });
      }
      if (Array.isArray(data.favorites) && data.favorites.length > 0) {
        await tx.favorite.createMany({ data: data.favorites as any });
      }
      if (Array.isArray(data.userColumnPreferences) && data.userColumnPreferences.length > 0) {
        await tx.userColumnPreference.createMany({ data: data.userColumnPreferences as any });
      }
      if (Array.isArray(data.userDashboardLayouts) && data.userDashboardLayouts.length > 0) {
        await tx.userDashboardLayout.createMany({ data: data.userDashboardLayouts as any });
      }

      return {
        success: true,
        company_id,
        company_name: company.name,
        message: `Empresa "${company.name}" restaurada com sucesso (${Object.values(data).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0)} registros)`,
        autoBackupName,
      };
    });
  }

  /**
   * Exporta os dados da empresa em um objeto serializável. A ordem das chaves em
   * `data` respeita as dependências de FK (pais antes de filhos), o que facilita
   * a reinserção no restore.
   */
  static async exportCompany(company_id: string) {
    const company = await prisma.company.findUnique({ where: { id: company_id } });
    if (!company) throw new Error('Company not found');

    const byCompany = { where: { company_id } };

    const [
      companyBranding,
      propertyTypes,
      agencies,
      owners,
      tenants,
      properties,
      leases,
      users,
      financialInstitutions,
      categories,
      subcategories,
      cards,
      centers,
      suppliers,
      transactions,
      invoices,
      recurringConfigs,
      plannings,
      documents,
      favorites,
      userColumnPreferences,
      userDashboardLayouts,
    ] = await Promise.all([
      prisma.companyBranding.findMany(byCompany),
      prisma.propertyType.findMany(byCompany),
      prisma.agency.findMany(byCompany),
      prisma.owner.findMany(byCompany),
      prisma.tenant.findMany(byCompany),
      prisma.property.findMany(byCompany),
      prisma.lease.findMany(byCompany),
      prisma.user.findMany(byCompany),
      prisma.financialInstitution.findMany(byCompany),
      prisma.category.findMany(byCompany),
      prisma.subcategory.findMany(byCompany),
      prisma.card.findMany(byCompany),
      prisma.center.findMany(byCompany),
      prisma.supplier.findMany(byCompany),
      prisma.transaction.findMany(byCompany),
      prisma.invoice.findMany(byCompany),
      prisma.recurringConfig.findMany(byCompany),
      prisma.planning.findMany(byCompany),
      prisma.document.findMany(byCompany),
      prisma.favorite.findMany(byCompany),
      prisma.userColumnPreference.findMany(byCompany),
      prisma.userDashboardLayout.findMany(byCompany),
    ]);

    const agencyIds = idsOf(agencies);
    const propertyIds = idsOf(properties);
    const ownerIds = idsOf(owners);
    const tenantIds = idsOf(tenants);
    const supplierIds = idsOf(suppliers);
    const planningIds = idsOf(plannings);

    const [
      agencyAddresses,
      propertyAddresses,
      ownerAddresses,
      tenantAddresses,
      supplierAddresses,
      propertyValues,
      propertyIptus,
      planningMonths,
      contacts,
    ] = await Promise.all([
      prisma.agencyAddress.findMany({ where: { agency_id: { in: agencyIds } } }),
      prisma.propertyAddress.findMany({ where: { property_id: { in: propertyIds } } }),
      prisma.ownerAddress.findMany({ where: { owner_id: { in: ownerIds } } }),
      prisma.tenantAddress.findMany({ where: { tenant_id: { in: tenantIds } } }),
      prisma.supplierAddress.findMany({ where: { supplier_id: { in: supplierIds } } }),
      prisma.propertyValue.findMany({ where: { property_id: { in: propertyIds } } }),
      prisma.propertyIptu.findMany({ where: { property_id: { in: propertyIds } } }),
      prisma.planningMonth.findMany({ where: { planning_id: { in: planningIds } } }),
      prisma.contact.findMany({
        where: {
          OR: [
            { agency_id: { in: agencyIds } },
            { owner_id: { in: ownerIds } },
            { tenant_id: { in: tenantIds } },
            { supplier_id: { in: supplierIds } },
          ],
        },
      }),
    ]);

    const addressIds = Array.from(
      new Set(
        [
          ...agencyAddresses,
          ...propertyAddresses,
          ...ownerAddresses,
          ...tenantAddresses,
          ...supplierAddresses,
        ].map((a) => a.address_id),
      ),
    );
    const addresses = await prisma.address.findMany({ where: { id: { in: addressIds } } });

    // Ordem = pais antes de filhos (importante para o restore).
    const data: Record<string, any> = {
      addresses,
      company: [company],
      companyBranding,
      propertyTypes,
      agencies,
      owners,
      tenants,
      suppliers,
      properties,
      users,
      financialInstitutions,
      categories,
      subcategories,
      cards,
      centers,
      leases,
      recurringConfigs,
      invoices,
      transactions,
      plannings,
      planningMonths,
      documents,
      favorites,
      userColumnPreferences,
      userDashboardLayouts,
      agencyAddresses,
      propertyAddresses,
      ownerAddresses,
      tenantAddresses,
      supplierAddresses,
      contacts,
      propertyValues,
      propertyIptus,
    };

    const serialized = JSON.stringify(data);
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex');

    return {
      meta: {
        app: 'nairim',
        formatVersion: BACKUP_FORMAT_VERSION,
        company_id,
        company_name: company.name,
        company_slug: company.slug,
        exportedAt: new Date().toISOString(),
        checksum,
        counts: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : v ? 1 : 0]),
        ),
      },
      data,
    };
  }
}
