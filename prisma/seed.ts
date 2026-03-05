import 'dotenv/config';
import bcrypt from "bcrypt";
import prisma from "../src/lib/prisma";

import {
  Gender,
  Role,
  PropertyStatus,
  DocumentType,
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

async function main() {
  console.log('Cleaning database...');

  await prisma.contact.deleteMany();
  
  await prisma.agencyAddress.deleteMany();
  await prisma.propertyAddress.deleteMany();
  await prisma.ownerAddress.deleteMany();
  await prisma.tenantAddress.deleteMany();
  
  await prisma.favorite.deleteMany();
  await prisma.document.deleteMany();
  await prisma.propertyValue.deleteMany();
  await prisma.lease.deleteMany();
  
  await prisma.property.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.agency.deleteMany();
  await prisma.propertyType.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding database with FULL COMPLETE data...');

  const passwordHash = await bcrypt.hash('admin123', 10);
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);

  console.log('Creating users...');
  const adminUser = await prisma.user.create({
    data: { name: 'Admin Nairim', email: 'admin@nairim.com', password: passwordHash, birth_date: new Date('1990-01-01'), gender: Gender.OTHER, role: Role.ADMIN }
  });
  
  await prisma.user.create({ data: { name: 'Corretor João', email: 'joao@nairim.com', password: passwordHash, birth_date: new Date('1985-05-15'), gender: Gender.MALE, role: Role.DEFAULT } });
  await prisma.user.create({ data: { name: 'Corretora Maria', email: 'maria@nairim.com', password: passwordHash, birth_date: new Date('1992-10-20'), gender: Gender.FEMALE, role: Role.DEFAULT } });

  console.log('Creating property types...');
  const types = ['Apartamento', 'Casa', 'Cobertura', 'Sala Comercial', 'Galpão', 'Terreno'];
  
  const createdTypes: PropertyType[] = await Promise.all(
    types.map(desc => prisma.propertyType.create({ data: { description: desc } }))
  );

  console.log('Creating agencies...');
  const agenciesList = [
    { name: 'Nairim Imóveis', legal: 'Nairim Negócios LTDA' },
    { name: 'Prime Estate', legal: 'Prime Real Estate SA' },
    { name: 'Urban Living', legal: 'Urban Living Corretora' }
  ];

  const createdAgencies: Agency[] = [];
  for (const agencyData of agenciesList) {
    const agency = await prisma.agency.create({
      data: {
        trade_name: agencyData.name,
        legal_name: agencyData.legal,
        cnpj: generateCNPJ(),
        state_registration: String(getRandomInt(100000000, 999999999)),
        license_number: `CRECI-${getRandomInt(10000, 99999)}`,
        created_at: getRandomDate(startDate, endDate),
        contacts: {
          create: [
            { contact: "Recepção", phone: generatePhone('landline'), email: `contato@${agencyData.name.split(' ')[0].toLowerCase()}.com` },
            { contact: "Financeiro", cellphone: generatePhone('cell'), email: `fin@${agencyData.name.split(' ')[0].toLowerCase()}.com` }
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
  }

  console.log('Creating owners...');
  const ownerNames = ['Carlos Mendes', 'Ana Paula', 'Roberto Silva', 'Fernanda Lima', 'Ricardo Oliveira', 'Patrícia Santos', 'Marcos Pereira', 'Juliana Almeida', 'Lucas Ferreira', 'Camila Rodrigues', 'Bruno Costa', 'Amanda Souza', 'Pedro Santos', 'Mariana Lima', 'Rafael Alves'];
  
  const createdOwners: Owner[] = [];
  for (let i = 0; i < ownerNames.length; i++) {
    const isPJ = i % 5 === 0;
    const owner = await prisma.owner.create({
      data: {
        name: ownerNames[i],
        internal_code: `OWN-${getRandomInt(1000, 9999)}`,
        occupation: isPJ ? null : getRandomElement(['Médico', 'Advogado', 'Engenheiro', 'Investidor']),
        marital_status: isPJ ? null : getRandomElement(['Casado', 'Solteiro', 'Divorciado']),
        cpf: isPJ ? null : generateCPF(),
        cnpj: isPJ ? generateCNPJ() : null,
        created_at: getRandomDate(startDate, endDate),
        contacts: {
          create: [
            { contact: ownerNames[i].split(' ')[0], cellphone: generatePhone('cell'), email: `${ownerNames[i].toLowerCase().replace(' ', '.')}@email.com` },
            { contact: "Secundário", phone: generatePhone('landline') }
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
  }

  console.log('Creating tenants...');
  const tenantNames = ['Lucas Silva', 'Fernanda Costa', 'Bruno Alves', 'Juliana Pereira', 'Roberto Santos', 'Camila Lima', 'Marcos Oliveira', 'Amanda Ferreira', 'Pedro Rodrigues', 'Mariana Almeida'];
  
  const createdTenants: Tenant[] = [];
  for (let i = 0; i < tenantNames.length; i++) {
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantNames[i],
        internal_code: `TEN-${getRandomInt(1000, 9999)}`,
        occupation: getRandomElement(['Estudante', 'Designer', 'Programador', 'Professor']),
        marital_status: getRandomElement(['Solteiro', 'Casado']),
        cpf: generateCPF(),
        created_at: getRandomDate(startDate, endDate),
        contacts: {
          create: [
            { contact: "Pessoal", cellphone: generatePhone('cell'), email: `${tenantNames[i].toLowerCase().replace(' ', '_')}@tenant.com` }
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
  }

  console.log('Creating properties...');
  const createdProperties = [];
  
  for (let i = 0; i < 40; i++) {
    const type = getRandomElement(createdTypes);
    const owner = getRandomElement(createdOwners);
    const agency = getRandomElement(createdAgencies);
    const area = getRandomInt(40, 500);
    const createdAt = getRandomDate(startDate, endDate);
    
    const property = await prisma.property.create({
      data: {
        title: `${type.description} em ${getRandomElement(['Jardins', 'Centro', 'Pinheiros'])} - Ref ${i+1}`,
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
        tax_registration: `IPTU-${getRandomInt(100000, 999999)}`,
        notes: "Imóvel em excelente estado de conservação.",
        created_at: createdAt,
        addresses: {
          create: {
            address: { create: generateRandomAddressData() }
          }
        },
        documents: {
          create: [
            { created_by: adminUser.id, file_path: `/docs/p${i}/doc1.pdf`, file_type: 'pdf', type: DocumentType.TITLE_DEED, description: 'Escritura' },
            { created_by: adminUser.id, file_path: `/docs/p${i}/img1.jpg`, file_type: 'jpg', type: DocumentType.IMAGE, description: 'Fachada' }
          ]
        }
      }
    });
    createdProperties.push(property);
  }

  console.log('Creating financial history and leases...');
  
  for (const property of createdProperties) {
    const purchaseVal = getRandomInt(300000, 2000000);
    const rentalVal = getRandomInt(1500, 10000);
    const condo = getRandomInt(300, 2000);
    
    const isLeased = Math.random() > 0.4;
    
    let tenantId = null;
    let start: Date | null = null;
    let end: Date | null = null;
    let status = LeaseStatus.ACTIVE;
    let canceledAt: Date | null = null;
    let penalty: number | null = null;
    let otherAmounts: number | null = null;
    let justification: string | null = null;

    if (isLeased) {
      const tenant = getRandomElement(createdTenants);
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
          contract_number: `CTR-${getRandomInt(10000, 99999)}`,
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
            PaymentCondition.INSTALLMENTS_12X
          ]),
          cancellation_penalty: penalty,
          other_cancellation_amounts: otherAmounts,
          cancellation_justification: justification,
          canceled_at: canceledAt
        }
      });
    }
  }

  console.log('Database seeded successfully!');
  console.log(`Summary:`);
  console.log(` - Users: 3`);
  console.log(` - Agencies: ${createdAgencies.length}`);
  console.log(` - Owners: ${createdOwners.length}`);
  console.log(` - Tenants: ${createdTenants.length}`);
  console.log(` - Properties: ${createdProperties.length}`);
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