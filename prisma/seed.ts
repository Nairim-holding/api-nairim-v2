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

async function main() {
  console.log('🧹 Cleaning database...');

  // Ordem de exclusão rigorosa para evitar erros de Foreign Key
  // Tabelas de relacionamento (Pivot) e dependentes primeiro
  await prisma.agencyContact.deleteMany();
  await prisma.agencyAddress.deleteMany();
  await prisma.propertyAddress.deleteMany();
  await prisma.ownerAddress.deleteMany();
  await prisma.ownerContact.deleteMany();
  await prisma.tenantAddress.deleteMany();
  await prisma.tenantContact.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.document.deleteMany();
  await prisma.propertyValue.deleteMany();
  await prisma.lease.deleteMany();
  
  // Tabelas principais
  await prisma.property.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.agency.deleteMany();
  await prisma.propertyType.deleteMany();
  await prisma.address.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.user.deleteMany();

  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  // 1. USERS
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@nairim.com' },
      update: {},
      create: { name: 'Admin Nairim', email: 'admin@nairim.com', password: passwordHash, birth_date: new Date('1990-01-01'), gender: Gender.OTHER, role: Role.ADMIN },
    }),
    prisma.user.upsert({
      where: { email: 'joao@email.com' },
      update: {},
      create: { name: 'João Silva', email: 'joao@email.com', password: passwordHash, birth_date: new Date('1985-05-15'), gender: Gender.MALE, role: Role.DEFAULT },
    }),
    prisma.user.upsert({
      where: { email: 'maria@email.com' },
      update: {},
      create: { name: 'Maria Souza', email: 'maria@email.com', password: passwordHash, birth_date: new Date('1992-10-20'), gender: Gender.FEMALE, role: Role.DEFAULT },
    }),
  ]);

  // 2. PROPERTY TYPES
  const types = await Promise.all([
    prisma.propertyType.create({ data: { description: 'Apartamento' } }),
    prisma.propertyType.create({ data: { description: 'Casa de Rua' } }),
    prisma.propertyType.create({ data: { description: 'Cobertura' } }),
  ]);

  // 3. AGENCIES
  const agencies = await Promise.all([
    prisma.agency.create({ data: { trade_name: 'Nairim Imóveis', legal_name: 'Nairim Negócios LTDA', cnpj: '12.345.678/0001-01' } }),
    prisma.agency.create({ data: { trade_name: 'Elite Properties', legal_name: 'Elite Real Estate SA', cnpj: '98.765.432/0001-02' } }),
    prisma.agency.create({ data: { trade_name: 'Lar Doce Lar', legal_name: 'Lar Doce Lar Imobiliária', cnpj: '11.222.333/0001-03' } }),
  ]);

  // 4. OWNERS
  const owners = await Promise.all([
    prisma.owner.create({ data: { name: 'Carlos Mendes', internal_code: 'OWN-001', occupation: 'Médico', marital_status: 'Casado', cpf: '111.111.111-11' } }),
    prisma.owner.create({ data: { name: 'Ana Paula', internal_code: 'OWN-002', occupation: 'Advogada', marital_status: 'Solteira', cpf: '222.222.222-22' } }),
    prisma.owner.create({ data: { name: 'Roberto Lima', internal_code: 'OWN-003', occupation: 'Empresário', marital_status: 'Divorciado', cpf: '333.333.333-33' } }),
  ]);

  // 5. TENANTS
  const tenants = await Promise.all([
    prisma.tenant.create({ data: { name: 'Lucas Ferreira', internal_code: 'TEN-001', occupation: 'Estudante', marital_status: 'Solteiro', cpf: '444.444.444-44' } }),
    prisma.tenant.create({ data: { name: 'Fernanda Costa', internal_code: 'TEN-002', occupation: 'Designer', marital_status: 'Casada', cpf: '555.555.555-55' } }),
    prisma.tenant.create({ data: { name: 'Bruno Alves', internal_code: 'TEN-003', occupation: 'Programador', marital_status: 'Solteiro', cpf: '666.666.666-66' } }),
  ]);

  // 6. ADDRESSES
  const addresses = await Promise.all([
    prisma.address.create({ data: { zip_code: '01001-000', street: 'Praça da Sé', number: '100', district: 'Sé', city: 'São Paulo', state: 'SP', country: 'Brasil' } }),
    prisma.address.create({ data: { zip_code: '20040-002', street: 'Av. Rio Branco', number: '50', district: 'Centro', city: 'Rio de Janeiro', state: 'RJ', country: 'Brasil' } }),
    prisma.address.create({ data: { zip_code: '30140-010', street: 'Rua da Bahia', number: '1200', district: 'Lourdes', city: 'Belo Horizonte', state: 'MG', country: 'Brasil' } }),
  ]);

  // 7. CONTACTS
  const contacts = await Promise.all([
    prisma.contact.create({ data: { contact: 'Principal', phone: '(11) 99999-9999', email: 'contato1@email.com', whatsapp: true } }),
    prisma.contact.create({ data: { contact: 'Comercial', phone: '(21) 88888-8888', email: 'contato2@email.com', whatsapp: true } }),
    prisma.contact.create({ data: { contact: 'Financeiro', phone: '(31) 77777-7777', email: 'contato3@email.com', whatsapp: false } }),
  ]);

  // 8. PROPERTIES
  const properties = await Promise.all([
    prisma.property.create({
      data: {
        title: 'Apartamento Luxo Jardins', owner_id: owners[0].id, agency_id: agencies[0].id, type_id: types[0].id,
        bedrooms: 3, bathrooms: 3, half_bathrooms: 1, garage_spaces: 2, area_total: 150, area_built: 150, frontage: 15,
        furnished: true, floor_number: 10, tax_registration: 'IPTU-001'
      }
    }),
    prisma.property.create({
      data: {
        title: 'Casa de Vila Pinheiros', owner_id: owners[1].id, agency_id: agencies[1].id, type_id: types[1].id,
        bedrooms: 2, bathrooms: 2, half_bathrooms: 0, garage_spaces: 1, area_total: 100, area_built: 90, frontage: 8,
        furnished: false, floor_number: 0, tax_registration: 'IPTU-002'
      }
    }),
    prisma.property.create({
      data: {
        title: 'Cobertura Duplex Leblon', owner_id: owners[2].id, agency_id: agencies[2].id, type_id: types[2].id,
        bedrooms: 4, bathrooms: 5, half_bathrooms: 2, garage_spaces: 3, area_total: 300, area_built: 280, frontage: 20,
        furnished: true, floor_number: 15, tax_registration: 'IPTU-003'
      }
    }),
  ]);

  // 9. LEASES (Contratos)
  await Promise.all([
    prisma.lease.create({
      data: {
        property_id: properties[0].id, type_id: types[0].id, owner_id: owners[0].id, tenant_id: tenants[0].id,
        contract_number: 'CONT-2024-001', start_date: new Date('2024-01-01'), end_date: new Date('2025-01-01'),
        rent_amount: 5000, condo_fee: 1200, property_tax: 300, rent_due_day: 5
      }
    }),
    prisma.lease.create({
      data: {
        property_id: properties[1].id, type_id: types[1].id, owner_id: owners[1].id, tenant_id: tenants[1].id,
        contract_number: 'CONT-2024-002', start_date: new Date('2024-02-01'), end_date: new Date('2025-02-01'),
        rent_amount: 3500, property_tax: 200, rent_due_day: 10
      }
    }),
    prisma.lease.create({
      data: {
        property_id: properties[2].id, type_id: types[2].id, owner_id: owners[2].id, tenant_id: tenants[2].id,
        contract_number: 'CONT-2024-003', start_date: new Date('2024-03-01'), end_date: new Date('2025-03-01'),
        rent_amount: 15000, condo_fee: 3000, property_tax: 800, rent_due_day: 1
      }
    }),
  ]);

  // 10. PROPERTY VALUES (Histórico)
  await Promise.all([
    prisma.propertyValue.create({ data: { property_id: properties[0].id, reference_date: new Date(), purchase_value: 1500000, rental_value: 5000, condo_fee: 1200, property_tax: 300, status: PropertyStatus.OCCUPIED } }),
    prisma.propertyValue.create({ data: { property_id: properties[1].id, reference_date: new Date(), purchase_value: 800000, rental_value: 3500, condo_fee: 0, property_tax: 200, status: PropertyStatus.OCCUPIED } }),
    prisma.propertyValue.create({ data: { property_id: properties[2].id, reference_date: new Date(), purchase_value: 5000000, rental_value: 15000, condo_fee: 3000, property_tax: 800, status: PropertyStatus.AVAILABLE } }),
  ]);

  // 11. DOCUMENTS
  await Promise.all([
    prisma.document.create({ data: { property_id: properties[0].id, created_by: users[0].id, file_path: '/docs/escritura1.pdf', file_type: 'pdf', type: DocumentType.TITLE_DEED } }),
    prisma.document.create({ data: { property_id: properties[1].id, created_by: users[0].id, file_path: '/docs/registro1.pdf', file_type: 'pdf', type: DocumentType.REGISTRATION } }),
    prisma.document.create({ data: { property_id: properties[2].id, created_by: users[0].id, file_path: '/docs/outro1.pdf', file_type: 'pdf', type: DocumentType.OTHER } }),
  ]);

  // 12. FAVORITES
  await Promise.all([
    prisma.favorite.create({ data: { user_id: users[1].id, property_id: properties[0].id } }),
    prisma.favorite.create({ data: { user_id: users[1].id, property_id: properties[1].id } }),
    prisma.favorite.create({ data: { user_id: users[2].id, property_id: properties[2].id } }),
  ]);

  // 13. PIVOT TABLES (Exemplos)
  await prisma.agencyAddress.create({ data: { agency_id: agencies[0].id, address_id: addresses[0].id } });
  await prisma.propertyAddress.create({ data: { property_id: properties[0].id, address_id: addresses[1].id } });
  await prisma.ownerContact.create({ data: { owner_id: owners[0].id, contact_id: contacts[0].id } });

  console.log('✅ Database cleaned and seeded successfully!');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });