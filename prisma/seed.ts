import 'dotenv/config';
import bcrypt from "bcrypt";

// Import direto do Prisma gerado
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

import {
  Gender,
  Role,
  PropertyStatus,
  Owner,
  Agency,
  Tenant,
  PropertyType,
  LeaseStatus,
  PaymentCondition
} from "../src/generated/prisma/client";

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateCPF(): string {
  const n = () => getRandomInt(0, 9);
  return `${n()}${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}-${n()}${n()}`;
}

function generateCNPJ(): string {
  const n = () => getRandomInt(0, 9);
  return `${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}/0001-${n()}${n()}`;
}

function generatePhone(type: 'cell' | 'landline'): string {
  const ddd = '11';
  const prefix = type === 'cell' ? '9' : '3';
  const part1 = getRandomInt(1000, 9999);
  const part2 = getRandomInt(1000, 9999);
  return `${ddd}${prefix}${part1}${part2}`;
}

function generateRandomAddressData() {
  const streets = ['Rua das Flores', 'Av. Paulista', 'Rua Augusta', 'Av. Faria Lima', 'Rua Oscar Freire', 'Alameda Santos', 'Rua Pamplona', 'Av. Brasil', 'Rua da Consolação', 'Rua Bela Cintra'];
  const districts = ['Jardins', 'Bela Vista', 'Pinheiros', 'Vila Madalena', 'Itaim Bibi', 'Moema', 'Centro', 'Perdizes'];
  
  return {
    street: getRandomElement(streets),
    number: String(getRandomInt(10, 2000)),
    district: getRandomElement(districts),
    city: 'São Paulo',
    state: 'SP',
    zip_code: `0${getRandomInt(100, 999)}-${getRandomInt(100, 999)}`,
    country: 'Brasil'
  };
}

async function createInBatches<T>(
  createFn: (items: any[]) => Promise<T[]>,
  items: any[],
  batchSize: number = 100
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await createFn(batch);
    results.push(...batchResults);
    console.log(`  Created ${Math.min(i + batchSize, items.length)}/${items.length} items...`);
  }
  return results;
}

async function main() {
  console.log('Cleaning database...');

  // Ordem de deleção respeitando todas as foreign keys
  // 1. Transações (dependem de tudo)
  await prisma.transaction.deleteMany();
  await prisma.recurringConfig.deleteMany();
  await prisma.invoice.deleteMany();

  // 2. Contatos (referencia Agency, Owner, Supplier, Tenant)
  await prisma.contact.deleteMany();

  // 3. Endereços de junção (referencia Entity + Address)
  await prisma.agencyAddress.deleteMany();
  await prisma.propertyAddress.deleteMany();
  await prisma.ownerAddress.deleteMany();
  await prisma.tenantAddress.deleteMany();
  await prisma.supplierAddress.deleteMany();

  // 4. Imóvel (referencia Agency, Owner, PropertyType)
  // Mas tem dependências: Favorite, Document, PropertyValue, PropertyIptu, Lease referenceiam Property
  await prisma.favorite.deleteMany();
  await prisma.document.deleteMany();
  await prisma.propertyValue.deleteMany();
  await prisma.propertyIptu.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.property.deleteMany();

  // 5. Usuários
  await prisma.userColumnPreference.deleteMany();
  await prisma.user.deleteMany();

  // 6. Pessoas (Agency, Owner, Supplier, Tenant)
  await prisma.tenant.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.agency.deleteMany();

  // 7. Endereços base (referenciado por *Address)
  await prisma.address.deleteMany();

  // 8. Tipos e categorias
  await prisma.propertyType.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();

  // 9. Lookup tables (sem dependências internas de dados)
  await prisma.card.deleteMany();
  await prisma.center.deleteMany();
  await prisma.financialInstitution.deleteMany();

  console.log('Seeding database with 10K+ records...');

  const passwordHash = await bcrypt.hash('admin123', 10);
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);

  console.log('Creating 10,000+ users...');
  await prisma.user.create({
    data: { name: 'Admin Nairim', email: 'admin@nairim.com', password: passwordHash, birth_date: new Date('1990-01-01'), gender: Gender.OTHER, role: Role.ADMIN }
  });

  const usersToCreate = [];
  for (let i = 0; i < 10000; i++) {
    usersToCreate.push({
      name: `User ${i + 1}`,
      email: `user${i + 1}@nairim.com`,
      password: passwordHash,
      birth_date: getRandomDate(new Date('1960-01-01'), new Date('2005-12-31')),
      gender: getRandomElement([Gender.MALE, Gender.FEMALE, Gender.OTHER]),
      role: Math.random() > 0.9 ? Role.ADMIN : Role.DEFAULT
    });
  }

  const createdUsers = await createInBatches(
    (items) => Promise.all(items.map(item => prisma.user.create({ data: item }))),
    usersToCreate,
    500
  );

  console.log('Creating property types...');
  const types = ['Apartamento', 'Casa', 'Cobertura', 'Sala Comercial', 'Galpão', 'Terreno'];

  const createdTypes: PropertyType[] = await Promise.all(
    types.map(desc => prisma.propertyType.create({ data: { description: desc } }))
  );

  console.log('Creating 10,000+ agencies...');
  const createdAgencies: Agency[] = [];

  for (let i = 0; i < 10000; i++) {
    const agencyName = `Agency ${i + 1}`;
    const agency = await prisma.agency.create({
      data: {
        trade_name: agencyName,
        legal_name: `${agencyName} LTDA`,
        cnpj: generateCNPJ(),
        state_registration: String(getRandomInt(100000000, 999999999)),
        license_number: `CRECI-${getRandomInt(10000, 99999)}`,
        created_at: getRandomDate(startDate, endDate),
        contacts: {
          create: [
            { contact: "Recepção", phone: generatePhone('landline'), email: `contato${i}@agency.com` }
          ]
        },
        addresses: {
          create: {
            address: { create: generateRandomAddressData() }
          }
        }
      }
    });
    createdAgencies.push(agency);
    if ((i + 1) % 1000 === 0) console.log(`  Created ${i + 1}/10000 agencies...`);
  }

  console.log('Creating 10,000+ owners...');
  const createdOwners: Owner[] = [];

  for (let i = 0; i < 10000; i++) {
    const isPJ = i % 5 === 0;
    const owner = await prisma.owner.create({
      data: {
        name: `Owner ${i + 1}`,
        internal_code: `OWN-${i + 1}`,
        occupation: isPJ ? null : getRandomElement(['Médico', 'Advogado', 'Engenheiro', 'Investidor']),
        marital_status: isPJ ? null : getRandomElement(['Casado', 'Solteiro', 'Divorciado']),
        cpf: isPJ ? null : generateCPF(),
        cnpj: isPJ ? generateCNPJ() : null,
        created_at: getRandomDate(startDate, endDate),
        contacts: {
          create: [
            { contact: "Pessoal", cellphone: generatePhone('cell'), email: `owner${i + 1}@email.com` }
          ]
        },
        addresses: {
          create: {
            address: { create: generateRandomAddressData() }
          }
        }
      }
    });
    createdOwners.push(owner);
    if ((i + 1) % 1000 === 0) console.log(`  Created ${i + 1}/10000 owners...`);
  }

  console.log('Creating 10,000+ tenants...');
  const createdTenants: Tenant[] = [];

  for (let i = 0; i < 10000; i++) {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Tenant ${i + 1}`,
        internal_code: `TEN-${i + 1}`,
        occupation: getRandomElement(['Estudante', 'Designer', 'Programador', 'Professor']),
        marital_status: getRandomElement(['Solteiro', 'Casado']),
        cpf: generateCPF(),
        created_at: getRandomDate(startDate, endDate),
        contacts: {
          create: [
            { contact: "Pessoal", cellphone: generatePhone('cell'), email: `tenant${i + 1}@email.com` }
          ]
        },
        addresses: {
          create: {
            address: { create: generateRandomAddressData() }
          }
        }
      }
    });
    createdTenants.push(tenant);
    if ((i + 1) % 1000 === 0) console.log(`  Created ${i + 1}/10000 tenants...`);
  }

  console.log('Creating 10,000+ properties...');
  const createdProperties: any[] = [];

  for (let i = 0; i < 10000; i++) {
    const type = getRandomElement(createdTypes);
    const owner = createdOwners[i % createdOwners.length];
    const agency = createdAgencies[i % createdAgencies.length];
    const area = getRandomInt(40, 500);
    const createdAt = getRandomDate(startDate, endDate);

    const property = await prisma.property.create({
      data: {
        title: `${type.description} ${i + 1}`,
        owner_id: owner.id,
        agency_id: agency.id,
        type_id: type.id,
        bedrooms: getRandomInt(1, 5),
        bathrooms: getRandomInt(1, 4),
        half_bathrooms: getRandomInt(0, 2),
        garage_spaces: getRandomInt(0, 4),
        area_total: area,
        area_built: area * 0.9,
        frontage: getRandomInt(5, 20),
        furnished: Math.random() > 0.6,
        floor_number: type.description === 'Casa' ? 0 : getRandomInt(1, 20),
        tax_registration: `IPTU-${i + 1}`,
        notes: "Imóvel para teste.",
        created_at: createdAt,
        addresses: {
          create: {
            address: { create: generateRandomAddressData() }
          }
        }
      }
    });
    createdProperties.push(property);
    if ((i + 1) % 1000 === 0) console.log(`  Created ${i + 1}/10000 properties...`);
  }

  console.log('Creating 10,000+ property values and leases...');

  for (let idx = 0; idx < createdProperties.length; idx++) {
    const property = createdProperties[idx];
    const purchaseVal = getRandomInt(300000, 2000000);
    const rentalVal = getRandomInt(1500, 10000);
    const condo = getRandomInt(300, 2000);

    const isLeased = Math.random() > 0.4;

    let tenantId = null;
    let start: Date | null = null;
    let end: Date | null = null;
    let status: LeaseStatus = LeaseStatus.ACTIVE;
    let canceledAt: Date | null = null;
    let penalty: number | null = null;
    let otherAmounts: number | null = null;
    let justification: string | null = null;

    if (isLeased) {
      const tenant = createdTenants[idx % createdTenants.length];
      tenantId = tenant.id;
      start = getRandomDate(property.created_at, new Date());
      end = new Date(start);
      end.setMonth(end.getMonth() + getRandomInt(6, 36));

      const now = new Date();
      const isCanceled = Math.random() > 0.8;

      if (isCanceled) {
        status = LeaseStatus.CANCELED;
        canceledAt = getRandomDate(start, now);
        penalty = getRandomInt(500, 3000);
        otherAmounts = getRandomInt(100, 500);
        justification = getRandomElement([
          "Transferência de emprego",
          "Quebra de contrato",
          "Problemas financeiros",
          "Insatisfação com o imóvel"
        ]);
      } else {
        const oneMonthFromNow = new Date(now);
        oneMonthFromNow.setMonth(now.getMonth() + 1);
        if (end < now) status = LeaseStatus.EXPIRED;
        else if (end <= oneMonthFromNow) status = LeaseStatus.EXPIRING;
        else status = LeaseStatus.ACTIVE;
      }
    }

    const currentStatus = (isLeased && status !== LeaseStatus.CANCELED && status !== LeaseStatus.EXPIRED)
      ? PropertyStatus.OCCUPIED
      : PropertyStatus.AVAILABLE;

    await prisma.propertyValue.create({
      data: {
        property_id: property.id,
        purchase_value: purchaseVal,
        rental_value: rentalVal,
        condo_fee: condo,
        property_tax: getRandomInt(100, 1000),
        status: currentStatus,
        created_at: getRandomDate(startDate, endDate)
      }
    });

    if (isLeased && tenantId && start && end) {
      await prisma.lease.create({
        data: {
          property_id: property.id,
          type_id: property.type_id,
          owner_id: property.owner_id,
          tenant_id: tenantId,
          contract_number: `CTR-${idx + 1}`,
          start_date: start,
          end_date: end,
          rent_amount: rentalVal,
          condo_fee: condo,
          property_tax: getRandomInt(100, 500),
          rent_due_day: getRandomInt(1, 15),
          tax_due_day: 20,
          condo_due_day: 10,
          status: status,
          payment_condition: getRandomElement([
            PaymentCondition.IN_FULL_15_DISCOUNT,
            PaymentCondition.SECOND_INSTALLMENT_10_DISCOUNT,
            PaymentCondition.INSTALLMENTS
          ]),
          cancellation_penalty: penalty,
          other_cancellation_amounts: otherAmounts,
          cancellation_justification: justification,
          canceled_at: canceledAt
        }
      });
    }

    if ((idx + 1) % 1000 === 0) console.log(`  Created ${idx + 1}/10000 property values and leases...`);
  }

  console.log('Creating financial institutions...');
  const institutions = await Promise.all([
    prisma.financialInstitution.create({ data: { name: 'Banco do Brasil', bank_number: '001', is_active: true } }),
    prisma.financialInstitution.create({ data: { name: 'Itaú', bank_number: '341', is_active: true } }),
    prisma.financialInstitution.create({ data: { name: 'Bradesco', bank_number: '237', is_active: true } }),
    prisma.financialInstitution.create({ data: { name: 'NuBank', bank_number: '260', is_active: true } }),
    prisma.financialInstitution.create({ data: { name: 'Inter', bank_number: '077', is_active: true } })
  ]);

  console.log('Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Aluguel Recebido', type: 'INCOME', is_active: true } }),
    prisma.category.create({ data: { name: 'Condomínio', type: 'EXPENSE', is_active: true } }),
    prisma.category.create({ data: { name: 'IPTU', type: 'EXPENSE', is_active: true } }),
    prisma.category.create({ data: { name: 'Manutenção', type: 'EXPENSE', is_active: true } }),
    prisma.category.create({ data: { name: 'Pagamento de Cartão', type: 'EXPENSE', is_active: true, is_system: true } })
  ]);

  console.log('Creating centers...');
  const centers = await Promise.all([
    prisma.center.create({ data: { name: 'Imobiliário', type: 'INCOME', is_active: true } }),
    prisma.center.create({ data: { name: 'Operacional', type: 'EXPENSE', is_active: true } })
  ]);

  console.log('Creating credit cards...');
  const cards = await Promise.all([
    prisma.card.create({ data: { name: 'Nubank Platinum', brand: 'Mastercard', limit: 10000, closing_day: 5, due_day: 15, is_active: true } }),
    prisma.card.create({ data: { name: 'Itaú Visa Infinite', brand: 'Visa', limit: 25000, closing_day: 10, due_day: 20, is_active: true } }),
    prisma.card.create({ data: { name: 'Amex Gold', brand: 'American Express', limit: 15000, closing_day: 3, due_day: 12, is_active: true } })
  ]);

  console.log('✅ Database seeded successfully with 10K+ records!');
  console.log(`\nSummary:`);
  console.log(` - Users: ${createdUsers.length + 1}`);
  console.log(` - Agencies: ${createdAgencies.length}`);
  console.log(` - Owners: ${createdOwners.length}`);
  console.log(` - Tenants: ${createdTenants.length}`);
  console.log(` - Properties: ${createdProperties.length}`);
  console.log(` - Property Values: ${createdProperties.length}`);
  console.log(` - Leases: ~${Math.round(createdProperties.length * 0.6)}`);
  console.log(` - Financial Institutions: ${institutions.length}`);
  console.log(` - Categories: ${categories.length}`);
  console.log(` - Centers: ${centers.length}`);
  console.log(` - Credit Cards: ${cards.length}\n`);
}

main()
  .then(async () => {
    console.log('Seeding completed!');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seeding error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });