// prisma/seed.ts
import 'dotenv/config'
import bcrypt from "bcrypt";
import prisma from "../src/lib/prisma";

// enums do Prisma gerado
import {
  Gender,
  Role,
  PropertyStatus,
  DocumentType
} from "../src/generated/prisma/client";

// Função para gerar datas aleatórias nos últimos 12 meses
function getRandomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Função para gerar valor aleatório dentro de uma faixa
function getRandomValue(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('🧹 Cleaning database...');

  // 1. Limpeza de tabelas dependentes (Filhos)
  // IMPORTANTE: Contact agora aponta para Owner/Agency/Tenant, então deve ser limpo antes deles.
  await prisma.contact.deleteMany(); 
  
  // Limpeza de tabelas pivô restantes e endereços
  await prisma.agencyAddress.deleteMany();
  await prisma.propertyAddress.deleteMany();
  await prisma.ownerAddress.deleteMany();
  await prisma.tenantAddress.deleteMany();
  
  await prisma.favorite.deleteMany();
  await prisma.document.deleteMany();
  await prisma.propertyValue.deleteMany();
  await prisma.lease.deleteMany();
  
  // 2. Limpeza de tabelas principais (Pais)
  await prisma.property.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.agency.deleteMany();
  await prisma.propertyType.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();

  console.log('🌱 Seeding database with realistic data for dashboard...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  // Datas de referência para distribuição nos últimos 12 meses
  const endDate = new Date(); // Hoje
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1); // 1 ano atrás

  // 1. USERS
  console.log('👥 Creating users...');
  const users = await Promise.all([
    prisma.user.create({ 
      data: { 
        name: 'Admin Nairim', 
        email: 'admin@nairim.com', 
        password: passwordHash, 
        birth_date: new Date('1990-01-01'), 
        gender: Gender.OTHER, 
        role: Role.ADMIN 
      }
    }),
    prisma.user.create({ 
      data: { 
        name: 'Corretor João', 
        email: 'joao@nairim.com', 
        password: passwordHash, 
        birth_date: new Date('1985-05-15'), 
        gender: Gender.MALE, 
        role: Role.DEFAULT 
      }
    }),
    prisma.user.create({ 
      data: { 
        name: 'Corretora Maria', 
        email: 'maria@nairim.com', 
        password: passwordHash, 
        birth_date: new Date('1992-10-20'), 
        gender: Gender.FEMALE, 
        role: Role.DEFAULT 
      }
    }),
  ]);

  // 2. PROPERTY TYPES
  console.log('🏠 Creating property types...');
  const propertyTypes = await Promise.all([
    prisma.propertyType.create({ data: { description: 'Apartamento' } }),
    prisma.propertyType.create({ data: { description: 'Casa' } }),
    prisma.propertyType.create({ data: { description: 'Cobertura' } }),
    prisma.propertyType.create({ data: { description: 'Sala Comercial' } }),
    prisma.propertyType.create({ data: { description: 'Galpão' } }),
    prisma.propertyType.create({ data: { description: 'Terreno' } }),
  ]);

  // 3. AGENCIES
  console.log('🏢 Creating agencies...');
  const agencies = await Promise.all([
    prisma.agency.create({ 
      data: { 
        trade_name: 'Nairim Imóveis', 
        legal_name: 'Nairim Negócios Imobiliários LTDA', 
        cnpj: '12.345.678/0001-01',
        state_registration: '123.456.789.000',
        license_number: 'CRECI-123456',
        created_at: getRandomDate(startDate, endDate),
        // Exemplo de criação de contato direto para Agência
        contacts: {
            create: [
                { contact: "Recepção", phone: "1133334444", email: "contato@nairim.com" },
                { contact: "Gerente Financeiro", cellphone: "11999998888", email: "financeiro@nairim.com" }
            ]
        }
      } 
    }),
    prisma.agency.create({ 
      data: { 
        trade_name: 'Imóveis Prime', 
        legal_name: 'Prime Real Estate S/A', 
        cnpj: '98.765.432/0001-02',
        state_registration: '234.567.890.000',
        license_number: 'CRECI-654321',
        created_at: getRandomDate(startDate, endDate)
      } 
    }),
    prisma.agency.create({ 
      data: { 
        trade_name: 'Lar Ideal', 
        legal_name: 'Lar Ideal Imobiliária ME', 
        cnpj: '11.222.333/0001-03',
        state_registration: '345.678.901.000',
        license_number: 'CRECI-789012',
        created_at: getRandomDate(startDate, endDate)
      } 
    }),
  ]);

  // 4. OWNERS (20 proprietários)
  console.log('👨‍💼 Creating owners...');
  const owners = [];
  const ownerNames = [
    'Carlos Mendes', 'Ana Paula Costa', 'Roberto Silva', 'Fernanda Lima', 
    'Ricardo Oliveira', 'Patrícia Santos', 'Marcos Pereira', 'Juliana Almeida',
    'Lucas Ferreira', 'Camila Rodrigues', 'Bruno Costa', 'Amanda Souza',
    'Pedro Santos', 'Mariana Lima', 'Rafael Alves', 'Carolina Martins',
    'Gustavo Pereira', 'Isabela Costa', 'Daniel Silva', 'Tatiane Oliveira'
  ];

  for (let i = 0; i < 20; i++) {
    const owner = await prisma.owner.create({ 
      data: { 
        name: ownerNames[i], 
        internal_code: `OWN-2023-${String(i+1).padStart(3, '0')}`, 
        occupation: ['Médico', 'Advogado', 'Engenheiro', 'Professor', 'Empresário', 'Arquiteto'][i % 6],
        marital_status: ['Casado', 'Solteiro', 'Divorciado', 'Viúvo'][i % 4],
        cpf: `${String(111111111 + i).padStart(11, '0').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`,
        created_at: getRandomDate(startDate, endDate),
        // ADICIONADO: Criando contatos múltiplos para cada owner
        contacts: {
            create: [
                { 
                    contact: `Pessoal (${ownerNames[i].split(' ')[0]})`, 
                    cellphone: `119${getRandomValue(10000000, 99999999)}`,
                    email: `${ownerNames[i].toLowerCase().replace(/ /g, '.')}@email.com`
                },
                {
                    contact: "Cônjuge / Comercial",
                    phone: `113${getRandomValue(1000000, 9999999)}`
                }
            ]
        }
      } 
    });
    owners.push(owner);
  }

  // 5. TENANTS (15 inquilinos)
  console.log('👨‍💻 Creating tenants...');
  const tenants = [];
  const tenantNames = [
    'Lucas Silva', 'Fernanda Costa', 'Bruno Alves', 'Juliana Pereira',
    'Roberto Santos', 'Camila Lima', 'Marcos Oliveira', 'Amanda Ferreira',
    'Pedro Rodrigues', 'Mariana Almeida', 'Rafael Martins', 'Carolina Souza',
    'Gustavo Costa', 'Isabela Pereira', 'Daniel Lima'
  ];

  for (let i = 0; i < 15; i++) {
    const tenant = await prisma.tenant.create({ 
      data: { 
        name: tenantNames[i], 
        internal_code: `TEN-2023-${String(i+1).padStart(3, '0')}`, 
        occupation: ['Estudante', 'Designer', 'Programador', 'Enfermeira', 'Empresário', 'Contador'][i % 6],
        marital_status: ['Solteiro', 'Casado', 'Divorciado', 'União Estável'][i % 4],
        cpf: `${String(222222222 + i).padStart(11, '0').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`,
        created_at: getRandomDate(startDate, endDate),
        // ADICIONADO: Criando contatos múltiplos para cada tenant
        contacts: {
            create: [
                { 
                    contact: "Whatsapp Principal", 
                    cellphone: `119${getRandomValue(10000000, 99999999)}`,
                    email: `${tenantNames[i].toLowerCase().replace(/ /g, '_')}@tenant.com`
                }
            ]
        }
      } 
    });
    tenants.push(tenant);
  }

  // 6. ADDRESSES
  console.log('📍 Creating addresses...');
  const addressesData = [
    // Zona Sul
    { street: 'Rua Augusta', number: '1500', district: 'Consolação', city: 'São Paulo', state: 'SP', zip_code: '01304-001' },
    { street: 'Avenida Paulista', number: '2000', district: 'Bela Vista', city: 'São Paulo', state: 'SP', zip_code: '01310-100' },
    { street: 'Rua Oscar Freire', number: '800', district: 'Cerqueira César', city: 'São Paulo', state: 'SP', zip_code: '01426-001' },
    { street: 'Alameda Santos', number: '2100', district: 'Jardim Paulista', city: 'São Paulo', state: 'SP', zip_code: '01418-200' },
    { street: 'Rua Haddock Lobo', number: '746', district: 'Cerqueira César', city: 'São Paulo', state: 'SP', zip_code: '01414-001' },
    // Zona Oeste
    { street: 'Rua Teodoro Sampaio', number: '1000', district: 'Pinheiros', city: 'São Paulo', state: 'SP', zip_code: '05406-100' },
    { street: 'Avenida Brigadeiro Faria Lima', number: '3477', district: 'Itaim Bibi', city: 'São Paulo', state: 'SP', zip_code: '04538-133' },
    { street: 'Rua dos Pinheiros', number: '870', district: 'Pinheiros', city: 'São Paulo', state: 'SP', zip_code: '05422-001' },
    { street: 'Avenida Rebouças', number: '2000', district: 'Pinheiros', city: 'São Paulo', state: 'SP', zip_code: '05401-000' },
    { street: 'Rua Butantã', number: '500', district: 'Pinheiros', city: 'São Paulo', state: 'SP', zip_code: '05503-000' },
    // Zona Norte
    { street: 'Avenida Braz Leme', number: '1000', district: 'Santana', city: 'São Paulo', state: 'SP', zip_code: '02012-000' },
    { street: 'Rua Voluntários da Pátria', number: '2000', district: 'Santana', city: 'São Paulo', state: 'SP', zip_code: '02011-000' },
    { street: 'Avenida Água Fria', number: '500', district: 'Água Fria', city: 'São Paulo', state: 'SP', zip_code: '02340-000' },
    // Zona Leste
    { street: 'Avenida Sapopemba', number: '3000', district: 'Sapopemba', city: 'São Paulo', state: 'SP', zip_code: '03223-000' },
    { street: 'Rua Tuiuti', number: '1500', district: 'Tatuapé', city: 'São Paulo', state: 'SP', zip_code: '03080-000' },
    { street: 'Avenida Radial Leste', number: '2000', district: 'Mooca', city: 'São Paulo', state: 'SP', zip_code: '03164-000' },
  ];

  const addresses = [];
  for (const addr of addressesData) {
    const address = await prisma.address.create({ 
      data: { 
        ...addr,
        country: 'Brasil'
      } 
    });
    addresses.push(address);
  }

  // 7. PROPERTIES
  console.log('🏘️ Creating properties...');
  const properties = [];
  const propertyTitles = [
    'Apartamento 2 Quartos Centro', 'Apartamento 3 Quartos Higienópolis', 'Studio República',
    'Apartamento 1 Quarto Pinheiros', 'Apartamento 4 Quartos Jardins', 'Apartamento 2 Quartos Itaim',
    'Apartamento 3 Quartos Moema', 'Apartamento 1 Quarto Vila Mariana', 'Apartamento 2 Quartos Perdizes',
    'Apartamento 3 Quartos Brooklin', 'Apartamento 4 Quartos Alto de Pinheiros', 'Apartamento 2 Quartos Bela Vista',
    'Casa 3 Quartos Vila Madalena', 'Casa 4 Quartos Alto da Lapa', 'Casa 2 Quartos Pompéia',
    'Casa 3 Quartos Butantã', 'Casa 4 Quartos Morumbi', 'Casa 2 Quartos Saúde',
    'Casa 3 Quartos Ipiranga', 'Casa 4 Quartos Campo Belo', 'Casa 2 Quartos Santo Amaro',
    'Cobertura 3 Quartos Jardins', 'Cobertura 4 Quartos Itaim Bibi', 'Cobertura 2 Quartos Moema',
    'Cobertura 3 Quartos Brooklin', 'Cobertura Penthouse Paulista',
    'Sala Comercial Paulista', 'Sala Comercial Faria Lima', 'Sala Comercial Berrini',
    'Loja Shopping Center', 'Galpão Logístico', 'Sala Comercial Centro',
    'Terreno Residencial', 'Terreno Comercial', 'Sítio Recreio', 'Chácara Fim de Semana'
  ];

  for (let i = 0; i < 50; i++) {
    const propertyTypeIndex = i % propertyTypes.length;
    const bedrooms = getRandomValue(1, 4);
    const bathrooms = getRandomValue(1, 3);
    const areaTotal = getRandomValue(50, 300);
    const createdDate = getRandomDate(startDate, endDate);
    
    const property = await prisma.property.create({
      data: {
        title: propertyTitles[i % propertyTitles.length], 
        owner_id: owners[getRandomValue(0, owners.length-1)].id, 
        agency_id: agencies[getRandomValue(0, agencies.length-1)].id, 
        type_id: propertyTypes[propertyTypeIndex].id,
        bedrooms: bedrooms, 
        bathrooms: bathrooms, 
        half_bathrooms: getRandomValue(0, 1), 
        garage_spaces: getRandomValue(0, 3), 
        area_total: areaTotal, 
        area_built: areaTotal * 0.9, 
        frontage: getRandomValue(5, 20),
        furnished: Math.random() > 0.5, 
        floor_number: propertyTypeIndex === 0 ? getRandomValue(1, 20) : 0, 
        tax_registration: `IPTU-2023-${String(i+1).padStart(3, '0')}`,
        notes: `Propriedade ${i+1} - Cadastrada em ${createdDate.toLocaleDateString('pt-BR')}`,
        created_at: createdDate
      }
    });
    properties.push(property);
  }

  // 8. PROPERTY VALUES
  console.log('💰 Creating property values with historical data...');
  for (const property of properties) {
    const numRecords = getRandomValue(2, 4);
    const basePurchaseValue = getRandomValue(300000, 2000000);
    const baseRentalValue = getRandomValue(1500, 8000);
    const basePropertyTax = getRandomValue(100, 1000);
    const baseCondoFee = property.type_id === propertyTypes[0].id ? getRandomValue(500, 2000) : 0;
    
    for (let i = 0; i < numRecords; i++) {
      const recordDate = new Date(startDate);
      recordDate.setMonth(recordDate.getMonth() + Math.floor((i * 12) / numRecords));
      
      const variation = 1 + (i * 0.05); 
      const purchaseValue = basePurchaseValue * variation;
      const rentalValue = baseRentalValue * variation;
      const propertyTax = basePropertyTax * variation;
      const condoFee = baseCondoFee * variation;
      
      const status = Math.random() > 0.3 ? PropertyStatus.OCCUPIED : PropertyStatus.AVAILABLE;
      
      await prisma.propertyValue.create({ 
        data: { 
          property_id: property.id, 
          reference_date: recordDate,
          purchase_value: purchaseValue,
          rental_value: rentalValue,
          condo_fee: condoFee,
          property_tax: propertyTax,
          sale_value: Math.random() > 0.7 ? purchaseValue * 1.2 : null,
          status: status,
          notes: `Valor registrado em ${recordDate.toLocaleDateString('pt-BR')}`
        } 
      });
    }
  }

  // 9. LEASES
  console.log('📑 Creating leases with time distribution...');
  const leases = [];
  const occupiedProperties = properties.filter((_, index) => index % 3 !== 0); 
    
  for (let i = 0; i < Math.min(occupiedProperties.length, tenants.length); i++) {
    const property = occupiedProperties[i];
    const startLeaseDate = getRandomDate(startDate, endDate);
    const endLeaseDate = new Date(startLeaseDate);
    endLeaseDate.setFullYear(endLeaseDate.getFullYear() + 1); 
    
    const latestValue = await prisma.propertyValue.findFirst({
      where: { property_id: property.id },
      orderBy: { reference_date: 'desc' }
    });
    
    if (latestValue) {
      const lease = await prisma.lease.create({
        data: {
          property_id: property.id, 
          type_id: property.type_id, 
          owner_id: property.owner_id, 
          tenant_id: tenants[i % tenants.length].id,
          contract_number: `CONT-2023-${String(i+1).padStart(3, '0')}`, 
          start_date: startLeaseDate, 
          end_date: endLeaseDate,
          rent_amount: Number(latestValue.rental_value), 
          condo_fee: Number(latestValue.condo_fee) || 0, 
          property_tax: Number(latestValue.property_tax),
          extra_charges: getRandomValue(0, 200),
          commission_amount: Number(latestValue.rental_value) * 0.5,
          rent_due_day: getRandomValue(1, 10),
          tax_due_day: getRandomValue(10, 20),
          condo_due_day: getRandomValue(5, 15),
          created_at: startLeaseDate
        }
      });
      leases.push(lease);
    }
  }

  // 10. DOCUMENTS
  console.log('📄 Creating documents...');
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    const numDocs = getRandomValue(0, 5); 
    
    const docTypes = [DocumentType.TITLE_DEED, DocumentType.REGISTRATION, DocumentType.PROPERTY_RECORD, DocumentType.IMAGE, DocumentType.OTHER];
    
    for (let j = 0; j < numDocs; j++) {
      await prisma.document.create({ 
        data: { 
          property_id: property.id, 
          created_by: users[0].id, 
          file_path: `/docs/prop${i+1}/doc${j+1}.pdf`, 
          file_type: 'pdf', 
          description: `Documento ${j+1} - ${docTypes[j % docTypes.length]}`,
          type: docTypes[j % docTypes.length],
          created_at: getRandomDate(property.created_at, endDate)
        } 
      });
    }
  }

  // 11. ADDRESSES RELATIONSHIPS
  console.log('🔗 Linking addresses...');
  for (let i = 0; i < properties.length; i++) {
    await prisma.propertyAddress.create({ 
      data: { 
        property_id: properties[i].id, 
        address_id: addresses[i % addresses.length].id 
      } 
    });
  }

  for (let i = 0; i < Math.min(owners.length, addresses.length); i++) {
    await prisma.ownerAddress.create({ 
      data: { 
        owner_id: owners[i].id, 
        address_id: addresses[(i + 5) % addresses.length].id 
      } 
    });
  }

  for (let i = 0; i < Math.min(tenants.length, addresses.length); i++) {
    await prisma.tenantAddress.create({ 
      data: { 
        tenant_id: tenants[i].id, 
        address_id: addresses[(i + 10) % addresses.length].id 
      } 
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log(`📊 Dashboard-ready Summary:`);
  console.log(`   👥 Users: ${users.length}`);
  console.log(`   🏠 Property Types: ${propertyTypes.length}`);
  console.log(`   🏢 Agencies: ${agencies.length} (com contatos)`);
  console.log(`   👨‍💼 Owners: ${owners.length} (com múltiplos contatos)`);
  console.log(`   👨‍💻 Tenants: ${tenants.length} (com contatos)`);
  console.log(`   📍 Addresses: ${addresses.length}`);
  console.log(`   🏘️ Properties: ${properties.length}`);
  console.log(`   💰 Property Values: ~${properties.length * 3}`);
  console.log(`   📑 Leases: ${leases.length}`);
}

main()
  .then(async () => { 
    console.log('🎉 Seeding completed!');
    await prisma.$disconnect(); 
  })
  .catch(async (e) => {
    console.error('❌ Seeding error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });