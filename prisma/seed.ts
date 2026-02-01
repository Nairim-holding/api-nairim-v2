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

  // 1. USERS - Completos com todos os campos
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
        name: 'João Silva', 
        email: 'joao@email.com', 
        password: passwordHash, 
        birth_date: new Date('1985-05-15'), 
        gender: Gender.MALE, 
        role: Role.DEFAULT 
      }
    }),
    prisma.user.create({ 
      data: { 
        name: 'Maria Souza', 
        email: 'maria@email.com', 
        password: passwordHash, 
        birth_date: new Date('1992-10-20'), 
        gender: Gender.FEMALE, 
        role: Role.DEFAULT 
      }
    }),
    prisma.user.create({ 
      data: { 
        name: 'Carlos Alberto', 
        email: 'carlos@email.com', 
        password: passwordHash, 
        birth_date: new Date('1978-03-30'), 
        gender: Gender.MALE, 
        role: Role.DEFAULT 
      }
    }),
    prisma.user.create({ 
      data: { 
        name: 'Fernanda Lima', 
        email: 'fernanda@email.com', 
        password: passwordHash, 
        birth_date: new Date('1995-07-12'), 
        gender: Gender.FEMALE, 
        role: Role.DEFAULT 
      }
    }),
  ]);

  // 2. PROPERTY TYPES - Todos os tipos de propriedade
  console.log('🏠 Creating property types...');
  const propertyTypes = await Promise.all([
    prisma.propertyType.create({ data: { description: 'Apartamento' } }),
    prisma.propertyType.create({ data: { description: 'Casa de Rua' } }),
    prisma.propertyType.create({ data: { description: 'Cobertura' } }),
    prisma.propertyType.create({ data: { description: 'Casa Condomínio' } }),
    prisma.propertyType.create({ data: { description: 'Sala Comercial' } }),
    prisma.propertyType.create({ data: { description: 'Galpão' } }),
    prisma.propertyType.create({ data: { description: 'Terreno' } }),
    prisma.propertyType.create({ data: { description: 'Sítio' } }),
    prisma.propertyType.create({ data: { description: 'Chácara' } }),
  ]);

  // 3. AGENCIES - Completas com todos os campos
  console.log('🏢 Creating agencies...');
  const agencies = await Promise.all([
    prisma.agency.create({ 
      data: { 
        trade_name: 'Nairim Imóveis', 
        legal_name: 'Nairim Negócios Imobiliários LTDA', 
        cnpj: '12.345.678/0001-01',
        state_registration: '123.456.789.000',
        municipal_registration: '987.654.321.000',
        license_number: 'CRECI-123456'
      } 
    }),
    prisma.agency.create({ 
      data: { 
        trade_name: 'Elite Properties', 
        legal_name: 'Elite Real Estate S/A', 
        cnpj: '98.765.432/0001-02',
        state_registration: '234.567.890.000',
        municipal_registration: '876.543.210.000',
        license_number: 'CRECI-654321'
      } 
    }),
    prisma.agency.create({ 
      data: { 
        trade_name: 'Lar Doce Lar', 
        legal_name: 'Lar Doce Lar Imobiliária ME', 
        cnpj: '11.222.333/0001-03',
        state_registration: '345.678.901.000',
        municipal_registration: '765.432.109.000',
        license_number: 'CRECI-789012'
      } 
    }),
    prisma.agency.create({ 
      data: { 
        trade_name: 'Skyline Imóveis', 
        legal_name: 'Skyline Empreendimentos Ltda', 
        cnpj: '44.555.666/0001-04',
        state_registration: '456.789.012.000',
        municipal_registration: '654.321.098.000',
        license_number: 'CRECI-345678'
      } 
    }),
  ]);

  // 4. OWNERS - Completos com todos os campos
  console.log('👨‍💼 Creating owners...');
  const owners = await Promise.all([
    prisma.owner.create({ 
      data: { 
        name: 'Carlos Mendes', 
        internal_code: 'OWN-2024-001', 
        occupation: 'Médico Cardiologista', 
        marital_status: 'Casado', 
        cpf: '111.111.111-11',
        state_registration: 'SP-123.456.789.101',
        municipal_registration: 'MUN-987.654.321.000'
      } 
    }),
    prisma.owner.create({ 
      data: { 
        name: 'Ana Paula Costa', 
        internal_code: 'OWN-2024-002', 
        occupation: 'Advogada Trabalhista', 
        marital_status: 'Solteira', 
        cpf: '222.222.222-22',
        cnpj: '22.333.444/0001-55',
        state_registration: 'RJ-234.567.890.111',
        municipal_registration: 'MUN-876.543.210.111'
      } 
    }),
    prisma.owner.create({ 
      data: { 
        name: 'Roberto Lima & Cia Ltda', 
        internal_code: 'OWN-2024-003', 
        occupation: 'Empresário do Setor Imobiliário', 
        marital_status: 'Divorciado', 
        cpf: '333.333.333-33',
        cnpj: '33.444.555/0001-66',
        state_registration: 'MG-345.678.901.222',
        municipal_registration: 'MUN-765.432.109.222'
      } 
    }),
    prisma.owner.create({ 
      data: { 
        name: 'Fernanda Santos Arquitetura ME', 
        internal_code: 'OWN-2024-004', 
        occupation: 'Arquiteta e Urbanista', 
        marital_status: 'Casada', 
        cpf: '444.444.444-44',
        cnpj: '44.555.666/0001-77',
        state_registration: 'SP-456.789.012.333',
        municipal_registration: 'MUN-654.321.098.333'
      } 
    }),
    prisma.owner.create({ 
      data: { 
        name: 'Ricardo Oliveira Engenharia', 
        internal_code: 'OWN-2024-005', 
        occupation: 'Engenheiro Civil', 
        marital_status: 'Solteiro', 
        cnpj: '55.666.777/0001-88',
        state_registration: 'RJ-567.890.123.444',
        municipal_registration: 'MUN-543.210.987.444'
      } 
    }),
    prisma.owner.create({ 
      data: { 
        name: 'Patrícia Almeida', 
        internal_code: 'OWN-2024-006', 
        occupation: 'Professora Universitária', 
        marital_status: 'Viúva', 
        cpf: '555.555.555-55',
        state_registration: 'SP-678.901.234.555',
        municipal_registration: 'MUN-432.109.876.555'
      } 
    }),
  ]);

  // 5. TENANTS - Completos com todos os campos (CORRIGIDO: marital_status é obrigatório)
  console.log('👨‍💻 Creating tenants...');
  const tenants = await Promise.all([
    prisma.tenant.create({ 
      data: { 
        name: 'Lucas Ferreira Silva', 
        internal_code: 'TEN-2024-001', 
        occupation: 'Estudante de Medicina', 
        marital_status: 'Solteiro', 
        cpf: '777.777.777-77'
      } 
    }),
    prisma.tenant.create({ 
      data: { 
        name: 'Fernanda Costa Design ME', 
        internal_code: 'TEN-2024-002', 
        occupation: 'Designer Gráfico', 
        marital_status: 'Casada', 
        cpf: '888.888.888-88',
        cnpj: '88.999.000/0001-99'
      } 
    }),
    prisma.tenant.create({ 
      data: { 
        name: 'Bruno Alves Tech Ltda', 
        internal_code: 'TEN-2024-003', 
        occupation: 'Programador Sênior', 
        marital_status: 'Solteiro', 
        cpf: '999.999.999-99',
        cnpj: '99.000.111/0001-00'
      } 
    }),
    prisma.tenant.create({ 
      data: { 
        name: 'Juliana Pereira', 
        internal_code: 'TEN-2024-004', 
        occupation: 'Enfermeira', 
        marital_status: 'Divorciada', 
        cpf: '101.101.101-10'
      } 
    }),
    prisma.tenant.create({ 
      data: { 
        name: 'Tech Solutions SA', 
        internal_code: 'TEN-2024-005', 
        occupation: 'Empresa de Tecnologia', 
        marital_status: 'Pessoa Jurídica', // CORRIGIDO: Adicionado marital_status
        cnpj: '11.222.333/0001-44'
      } 
    }),
  ]);

  // 6. ADDRESSES - Diversos endereços
  console.log('📍 Creating addresses...');
  const addresses = await Promise.all([
    // Endereços SP
    prisma.address.create({ 
      data: { 
        zip_code: '01001-000', 
        street: 'Praça da Sé', 
        number: '100', 
        district: 'Sé', 
        city: 'São Paulo', 
        state: 'SP', 
        country: 'Brasil' 
      } 
    }),
    prisma.address.create({ 
      data: { 
        zip_code: '01310-000', 
        street: 'Avenida Paulista', 
        number: '2000', 
        district: 'Bela Vista', 
        city: 'São Paulo', 
        state: 'SP', 
        country: 'Brasil' 
      } 
    }),
    prisma.address.create({ 
      data: { 
        zip_code: '01451-000', 
        street: 'Rua Haddock Lobo', 
        number: '746', 
        district: 'Cerqueira César', 
        city: 'São Paulo', 
        state: 'SP', 
        country: 'Brasil' 
      } 
    }),
    prisma.address.create({ 
      data: { 
        zip_code: '04538-133', 
        street: 'Avenida Brigadeiro Faria Lima', 
        number: '3477', 
        district: 'Itaim Bibi', 
        city: 'São Paulo', 
        state: 'SP', 
        country: 'Brasil' 
      } 
    }),
    
    // Endereços RJ
    prisma.address.create({ 
      data: { 
        zip_code: '20040-002', 
        street: 'Avenida Rio Branco', 
        number: '50', 
        district: 'Centro', 
        city: 'Rio de Janeiro', 
        state: 'RJ', 
        country: 'Brasil' 
      } 
    }),
    prisma.address.create({ 
      data: { 
        zip_code: '22440-030', 
        street: 'Rua Visconde de Pirajá', 
        number: '500', 
        district: 'Ipanema', 
        city: 'Rio de Janeiro', 
        state: 'RJ', 
        country: 'Brasil' 
      } 
    }),
    
    // Endereços MG
    prisma.address.create({ 
      data: { 
        zip_code: '30140-010', 
        street: 'Rua da Bahia', 
        number: '1200', 
        district: 'Lourdes', 
        city: 'Belo Horizonte', 
        state: 'MG', 
        country: 'Brasil' 
      } 
    }),
    prisma.address.create({ 
      data: { 
        zip_code: '30360-070', 
        street: 'Avenida do Contorno', 
        number: '8000', 
        district: 'Savassi', 
        city: 'Belo Horizonte', 
        state: 'MG', 
        country: 'Brasil' 
      } 
    }),
    
    // Endereços PR
    prisma.address.create({ 
      data: { 
        zip_code: '80010-000', 
        street: 'Rua das Flores', 
        number: '200', 
        district: 'Centro', 
        city: 'Curitiba', 
        state: 'PR', 
        country: 'Brasil' 
      } 
    }),
    
    // Endereços RS
    prisma.address.create({ 
      data: { 
        zip_code: '90010-000', 
        street: 'Rua dos Andradas', 
        number: '100', 
        district: 'Centro Histórico', 
        city: 'Porto Alegre', 
        state: 'RS', 
        country: 'Brasil' 
      } 
    }),
  ]);

  // 7. CONTACTS - Diversos contatos
  console.log('📞 Creating contacts...');
  const contacts = await Promise.all([
    // Contatos pessoais
    prisma.contact.create({ 
      data: { 
        contact: 'Carlos Mendes - Pessoal', 
        phone: '(11) 99999-9999', 
        email: 'carlos.mendes@email.com', 
        whatsapp: true 
      } 
    }),
    prisma.contact.create({ 
      data: { 
        contact: 'Ana Paula - Celular', 
        phone: '(21) 98888-8888', 
        email: 'ana.paula@email.com', 
        whatsapp: true 
      } 
    }),
    prisma.contact.create({ 
      data: { 
        contact: 'Roberto Lima - Comercial', 
        phone: '(31) 97777-7777', 
        email: 'roberto.lima@empresa.com', 
        whatsapp: false 
      } 
    }),
    prisma.contact.create({ 
      data: { 
        contact: 'Fernanda Santos - Escritório', 
        phone: '(11) 96666-6666', 
        email: 'fernanda@arquitetura.com', 
        whatsapp: true 
      } 
    }),
    prisma.contact.create({ 
      data: { 
        contact: 'Ricardo Oliveira - Assistente', 
        phone: '(21) 95555-5555', 
        email: 'assistente@engenharia.com', 
        whatsapp: true 
      } 
    }),
    
    // Contatos de emergência/alternativos
    prisma.contact.create({ 
      data: { 
        contact: 'Patrícia Almeida - Residencial', 
        phone: '(11) 3444-4444', 
        email: 'patricia.almeida@email.com', 
        whatsapp: false 
      } 
    }),
    prisma.contact.create({ 
      data: { 
        contact: 'Lucas Ferreira - Celular', 
        phone: '(11) 97777-7777', 
        email: 'lucas.ferreira@email.com', 
        whatsapp: true 
      } 
    }),
    prisma.contact.create({ 
      data: { 
        contact: 'Fernanda Costa - Trabalho', 
        phone: '(21) 96666-6666', 
        email: 'contato@design.com', 
        whatsapp: true 
      } 
    }),
    
    // Contatos das agências
    prisma.contact.create({ 
      data: { 
        contact: 'Nairim Imóveis - Central', 
        phone: '(11) 3333-3333', 
        email: 'contato@nairim.com', 
        whatsapp: true 
      } 
    }),
    prisma.contact.create({ 
      data: { 
        contact: 'Elite Properties - Vendas', 
        phone: '(21) 3222-2222', 
        email: 'vendas@eliteproperties.com', 
        whatsapp: true 
      } 
    }),
  ]);

  // 8. PROPERTIES - Completas com todos os campos
  console.log('🏘️ Creating properties...');
  const properties = await Promise.all([
    // Apartamentos
    prisma.property.create({
      data: {
        title: 'Apartamento Luxo Jardins 3 Quartos', 
        owner_id: owners[0].id, 
        agency_id: agencies[0].id, 
        type_id: propertyTypes[0].id,
        bedrooms: 3, 
        bathrooms: 3, 
        half_bathrooms: 1, 
        garage_spaces: 2, 
        area_total: 150.5, 
        area_built: 150.5, 
        frontage: 15.2,
        furnished: true, 
        floor_number: 10, 
        tax_registration: 'IPTU-001-2024',
        notes: 'Apartamento de luxo com vista para o parque, acabamento em mármore, cozinha americana, lavabo, dependência completa, 2 vagas de garagem cobertas'
      }
    }),
    prisma.property.create({
      data: {
        title: 'Apartamento Higienópolis Reformado', 
        owner_id: owners[3].id, 
        agency_id: agencies[0].id, 
        type_id: propertyTypes[0].id,
        bedrooms: 2, 
        bathrooms: 2, 
        half_bathrooms: 1, 
        garage_spaces: 1, 
        area_total: 120.3, 
        area_built: 110.8, 
        frontage: 12.5,
        furnished: true, 
        floor_number: 8, 
        tax_registration: 'IPTU-004-2024',
        notes: 'Apartamento totalmente reformado em 2023, com piso porcelanato, louças novas, armários planejados, portas blindadas'
      }
    }),
    
    // Casas
    prisma.property.create({
      data: {
        title: 'Casa de Vila Pinheiros com Jardim', 
        owner_id: owners[1].id, 
        agency_id: agencies[1].id, 
        type_id: propertyTypes[1].id,
        bedrooms: 2, 
        bathrooms: 2, 
        half_bathrooms: 0, 
        garage_spaces: 1, 
        area_total: 100.0, 
        area_built: 90.0, 
        frontage: 8.0,
        furnished: false, 
        floor_number: 0, 
        tax_registration: 'IPTU-002-2024',
        notes: 'Casa térrea com jardim frontal e quintal, sala ampla, cozinha com armários, área de serviço coberta'
      }
    }),
    prisma.property.create({
      data: {
        title: 'Sobrado Botafogo com Piscina', 
        owner_id: owners[4].id, 
        agency_id: agencies[1].id, 
        type_id: propertyTypes[1].id,
        bedrooms: 3, 
        bathrooms: 3, 
        half_bathrooms: 1, 
        garage_spaces: 2, 
        area_total: 180.0, 
        area_built: 160.0, 
        frontage: 10.0,
        furnished: false, 
        floor_number: 0, 
        tax_registration: 'IPTU-005-2024',
        notes: 'Sobrado com piscina, churrasqueira, 3 suítes, sala de estar e jantar, cozinha planejada, lavanderia'
      }
    }),
    
    // Coberturas
    prisma.property.create({
      data: {
        title: 'Cobertura Duplex Leblon Vista Mar', 
        owner_id: owners[2].id, 
        agency_id: agencies[2].id, 
        type_id: propertyTypes[2].id,
        bedrooms: 4, 
        bathrooms: 5, 
        half_bathrooms: 2, 
        garage_spaces: 3, 
        area_total: 300.0, 
        area_built: 280.0, 
        frontage: 20.0,
        furnished: true, 
        floor_number: 15, 
        tax_registration: 'IPTU-003-2024',
        notes: 'Cobertura duplex com vista panorâmica para o mar, terraço com piscina, churrasqueira, home theater, 3 vagas de garagem'
      }
    }),
    
    // Casa Condomínio
    prisma.property.create({
      data: {
        title: 'Casa Condomínio Alphaville', 
        owner_id: owners[5].id, 
        agency_id: agencies[3].id, 
        type_id: propertyTypes[3].id,
        bedrooms: 4, 
        bathrooms: 4, 
        half_bathrooms: 1, 
        garage_spaces: 3, 
        area_total: 250.0, 
        area_built: 220.0, 
        frontage: 12.0,
        furnished: true, 
        floor_number: 0, 
        tax_registration: 'IPTU-006-2024',
        notes: 'Casa em condomínio fechado, com segurança 24h, quadra de tênis, piscina adulto e infantil, salão de festas'
      }
    }),
    
    // Sala Comercial
    prisma.property.create({
      data: {
        title: 'Sala Comercial Faria Lima', 
        owner_id: owners[2].id, 
        agency_id: agencies[0].id, 
        type_id: propertyTypes[4].id,
        bedrooms: 0, 
        bathrooms: 2, 
        half_bathrooms: 1, 
        garage_spaces: 5, 
        area_total: 200.0, 
        area_built: 200.0, 
        frontage: 25.0,
        furnished: true, 
        floor_number: 12, 
        tax_registration: 'IPTU-007-2024',
        notes: 'Sala comercial em torre corporativa, com recepção, 4 salas, copa, banheiro para funcionários e visitantes, 5 vagas na garagem'
      }
    }),
    
    // Galpão
    prisma.property.create({
      data: {
        title: 'Galpão Logístico Marginal Tietê', 
        owner_id: owners[4].id, 
        agency_id: agencies[2].id, 
        type_id: propertyTypes[5].id,
        bedrooms: 0, 
        bathrooms: 2, 
        half_bathrooms: 0, 
        garage_spaces: 10, 
        area_total: 500.0, 
        area_built: 500.0, 
        frontage: 40.0,
        furnished: false, 
        floor_number: 0, 
        tax_registration: 'IPTU-008-2024',
        notes: 'Galpão com pé-direito de 8m, docas de carga, escritório anexo, estacionamento para caminhões, fácil acesso à marginal'
      }
    }),
  ]);

  // 9. LEASES - Completos com todos os campos
  console.log('📑 Creating leases...');
  const leases = await Promise.all([
    prisma.lease.create({
      data: {
        property_id: properties[0].id, 
        type_id: propertyTypes[0].id, 
        owner_id: owners[0].id, 
        tenant_id: tenants[0].id,
        contract_number: 'CONT-2024-001', 
        start_date: new Date('2024-01-01'), 
        end_date: new Date('2025-01-01'),
        rent_amount: 5000.00, 
        condo_fee: 1200.00, 
        property_tax: 300.00,
        extra_charges: 150.00,
        commission_amount: 2500.00,
        rent_due_day: 5,
        tax_due_day: 10,
        condo_due_day: 8
      }
    }),
    prisma.lease.create({
      data: {
        property_id: properties[1].id, 
        type_id: propertyTypes[0].id, 
        owner_id: owners[3].id, 
        tenant_id: tenants[1].id,
        contract_number: 'CONT-2024-002', 
        start_date: new Date('2024-02-01'), 
        end_date: new Date('2025-02-01'),
        rent_amount: 3500.00, 
        condo_fee: 800.00, 
        property_tax: 200.00,
        extra_charges: 100.00,
        commission_amount: 1750.00,
        rent_due_day: 10,
        tax_due_day: 15,
        condo_due_day: 12
      }
    }),
    prisma.lease.create({
      data: {
        property_id: properties[2].id, 
        type_id: propertyTypes[1].id, 
        owner_id: owners[1].id, 
        tenant_id: tenants[2].id,
        contract_number: 'CONT-2024-003', 
        start_date: new Date('2024-03-01'), 
        end_date: new Date('2025-03-01'),
        rent_amount: 2800.00, 
        property_tax: 180.00,
        extra_charges: 80.00,
        commission_amount: 1400.00,
        rent_due_day: 7
      }
    }),
    prisma.lease.create({
      data: {
        property_id: properties[3].id, 
        type_id: propertyTypes[1].id, 
        owner_id: owners[4].id, 
        tenant_id: tenants[3].id,
        contract_number: 'CONT-2024-004', 
        start_date: new Date('2024-04-01'), 
        end_date: new Date('2025-04-01'),
        rent_amount: 7000.00, 
        condo_fee: 500.00,
        property_tax: 400.00,
        extra_charges: 200.00,
        commission_amount: 3500.00,
        rent_due_day: 1,
        tax_due_day: 5,
        condo_due_day: 3
      }
    }),
    prisma.lease.create({
      data: {
        property_id: properties[6].id, 
        type_id: propertyTypes[4].id, 
        owner_id: owners[2].id, 
        tenant_id: tenants[4].id,
        contract_number: 'CONT-2024-005', 
        start_date: new Date('2024-05-01'), 
        end_date: new Date('2026-05-01'),
        rent_amount: 15000.00, 
        condo_fee: 3000.00, 
        property_tax: 800.00,
        extra_charges: 500.00,
        commission_amount: 7500.00,
        rent_due_day: 1,
        tax_due_day: 10,
        condo_due_day: 8
      }
    }),
  ]);

  // 10. PROPERTY VALUES - Histórico completo
  console.log('💰 Creating property values...');
  await Promise.all([
    // Propriedade 1 - Apartamento Jardins
    prisma.propertyValue.create({ 
      data: { 
        property_id: properties[0].id, 
        reference_date: new Date('2024-01-01'), 
        purchase_value: 1500000.00, 
        rental_value: 5000.00, 
        condo_fee: 1200.00, 
        property_tax: 300.00, 
        status: PropertyStatus.OCCUPIED,
        notes: 'Valor de compra em 2020, aluguel atualizado em 2024'
      } 
    }),
    prisma.propertyValue.create({ 
      data: { 
        property_id: properties[0].id, 
        reference_date: new Date('2023-01-01'), 
        purchase_value: 1400000.00, 
        rental_value: 4500.00, 
        condo_fee: 1100.00, 
        property_tax: 280.00, 
        status: PropertyStatus.OCCUPIED,
        notes: 'Reajuste anual do aluguel'
      } 
    }),
    
    // Propriedade 2 - Apartamento Higienópolis
    prisma.propertyValue.create({ 
      data: { 
        property_id: properties[1].id, 
        reference_date: new Date('2024-02-01'), 
        purchase_value: 1200000.00, 
        rental_value: 3500.00, 
        condo_fee: 800.00, 
        property_tax: 200.00, 
        status: PropertyStatus.OCCUPIED,
        notes: 'Apartamento reformado, valor atualizado'
      } 
    }),
    
    // Propriedade 3 - Casa Pinheiros
    prisma.propertyValue.create({ 
      data: { 
        property_id: properties[2].id, 
        reference_date: new Date('2024-03-01'), 
        purchase_value: 800000.00, 
        rental_value: 2800.00, 
        condo_fee: 0.00, 
        property_tax: 180.00, 
        status: PropertyStatus.OCCUPIED,
        notes: 'Casa sem condomínio'
      } 
    }),
    
    // Propriedade 4 - Sobrado Botafogo
    prisma.propertyValue.create({ 
      data: { 
        property_id: properties[3].id, 
        reference_date: new Date('2024-04-01'), 
        purchase_value: 2200000.00, 
        rental_value: 7000.00, 
        condo_fee: 500.00, 
        property_tax: 400.00, 
        status: PropertyStatus.OCCUPIED,
        notes: 'Sobrado com piscina, valor premium'
      } 
    }),
    
    // Propriedade 5 - Cobertura Leblon
    prisma.propertyValue.create({ 
      data: { 
        property_id: properties[4].id, 
        reference_date: new Date('2024-01-01'), 
        purchase_value: 5000000.00, 
        rental_value: 15000.00, 
        condo_fee: 3000.00, 
        property_tax: 800.00, 
        status: PropertyStatus.AVAILABLE,
        notes: 'Cobertura de luxo, disponível para locação'
      } 
    }),
    
    // Propriedade 6 - Casa Condomínio
    prisma.propertyValue.create({ 
      data: { 
        property_id: properties[5].id, 
        reference_date: new Date('2024-01-01'), 
        purchase_value: 2800000.00, 
        rental_value: 9000.00, 
        condo_fee: 1200.00, 
        property_tax: 600.00, 
        status: PropertyStatus.AVAILABLE,
        notes: 'Disponível para venda ou locação'
      } 
    }),
    
    // Propriedade 7 - Sala Comercial
    prisma.propertyValue.create({ 
      data: { 
        property_id: properties[6].id, 
        reference_date: new Date('2024-05-01'), 
        purchase_value: 3500000.00, 
        rental_value: 15000.00, 
        condo_fee: 3000.00, 
        property_tax: 800.00, 
        status: PropertyStatus.OCCUPIED,
        notes: 'Contrato corporativo de 2 anos'
      } 
    }),
    
    // Propriedade 8 - Galpão
    prisma.propertyValue.create({ 
      data: { 
        property_id: properties[7].id, 
        reference_date: new Date('2024-01-01'), 
        purchase_value: 4200000.00, 
        rental_value: 25000.00, 
        condo_fee: 0.00, 
        property_tax: 1500.00, 
        status: PropertyStatus.AVAILABLE,
        notes: 'Galpão logístico, disponível para locação'
      } 
    }),
  ]);

  // 11. DOCUMENTS - Diversos tipos de documentos
  console.log('📄 Creating documents...');
  await Promise.all([
    // Documentos da Propriedade 1
    prisma.document.create({ 
      data: { 
        property_id: properties[0].id, 
        created_by: users[0].id, 
        file_path: '/docs/prop1/escritura.pdf', 
        file_type: 'pdf', 
        description: 'Escritura Pública de Compra e Venda',
        type: DocumentType.TITLE_DEED 
      } 
    }),
    prisma.document.create({ 
      data: { 
        property_id: properties[0].id, 
        created_by: users[0].id, 
        file_path: '/docs/prop1/registro.pdf', 
        file_type: 'pdf', 
        description: 'Registro no Cartório de Imóveis',
        type: DocumentType.REGISTRATION 
      } 
    }),
    prisma.document.create({ 
      data: { 
        property_id: properties[0].id, 
        created_by: users[1].id, 
        file_path: '/docs/prop1/fachada.jpg', 
        file_type: 'jpg', 
        description: 'Foto da fachada do prédio',
        type: DocumentType.IMAGE 
      } 
    }),
    prisma.document.create({ 
      data: { 
        property_id: properties[0].id, 
        created_by: users[1].id, 
        file_path: '/docs/prop1/plantas.pdf', 
        file_type: 'pdf', 
        description: 'Plantas do apartamento',
        type: DocumentType.PROPERTY_RECORD 
      } 
    }),
    prisma.document.create({ 
      data: { 
        property_id: properties[0].id, 
        created_by: users[0].id, 
        file_path: '/docs/prop1/contrato.pdf', 
        file_type: 'pdf', 
        description: 'Contrato de Locação',
        type: DocumentType.OTHER 
      } 
    }),
    
    // Documentos da Propriedade 2
    prisma.document.create({ 
      data: { 
        property_id: properties[1].id, 
        created_by: users[0].id, 
        file_path: '/docs/prop2/escritura.pdf', 
        file_type: 'pdf', 
        description: 'Escritura do Apartamento',
        type: DocumentType.TITLE_DEED 
      } 
    }),
    
    // Documentos da Propriedade 5
    prisma.document.create({ 
      data: { 
        property_id: properties[4].id, 
        created_by: users[0].id, 
        file_path: '/docs/prop5/vista_mar.jpg', 
        file_type: 'jpg', 
        description: 'Vista do mar da cobertura',
        type: DocumentType.IMAGE 
      } 
    }),
    
    // Documentos da Propriedade 7
    prisma.document.create({ 
      data: { 
        property_id: properties[6].id, 
        created_by: users[0].id, 
        file_path: '/docs/prop7/contrato_corporativo.pdf', 
        file_type: 'pdf', 
        description: 'Contrato Corporativo de Locação',
        type: DocumentType.OTHER 
      } 
    }),
  ]);

  // 12. FAVORITES - Usuários favoritando propriedades
  console.log('❤️ Creating favorites...');
  await Promise.all([
    // Usuário 2 favorita 3 propriedades
    prisma.favorite.create({ data: { user_id: users[1].id, property_id: properties[0].id } }),
    prisma.favorite.create({ data: { user_id: users[1].id, property_id: properties[1].id } }),
    prisma.favorite.create({ data: { user_id: users[1].id, property_id: properties[4].id } }),
    
    // Usuário 3 favorita 2 propriedades
    prisma.favorite.create({ data: { user_id: users[2].id, property_id: properties[2].id } }),
    prisma.favorite.create({ data: { user_id: users[2].id, property_id: properties[5].id } }),
    
    // Usuário 4 favorita 1 propriedade
    prisma.favorite.create({ data: { user_id: users[3].id, property_id: properties[3].id } }),
    
    // Usuário 5 favorita 2 propriedades
    prisma.favorite.create({ data: { user_id: users[4].id, property_id: properties[6].id } }),
    prisma.favorite.create({ data: { user_id: users[4].id, property_id: properties[7].id } }),
  ]);

  // 13. PIVOT TABLES - Relacionamentos completos
  console.log('🔗 Creating relationships...');
  
  // Agências com endereços e contatos
  await Promise.all([
    // Agência 1 - Nairim Imóveis
    prisma.agencyAddress.create({ data: { agency_id: agencies[0].id, address_id: addresses[0].id } }), // Matriz
    prisma.agencyAddress.create({ data: { agency_id: agencies[0].id, address_id: addresses[3].id } }), // Filial
    prisma.agencyContact.create({ data: { agency_id: agencies[0].id, contact_id: contacts[8].id } }), // Contato central
    
    // Agência 2 - Elite Properties
    prisma.agencyAddress.create({ data: { agency_id: agencies[1].id, address_id: addresses[4].id } }), // Matriz RJ
    prisma.agencyContact.create({ data: { agency_id: agencies[1].id, contact_id: contacts[9].id } }), // Vendas
    
    // Agência 3 - Lar Doce Lar
    prisma.agencyAddress.create({ data: { agency_id: agencies[2].id, address_id: addresses[6].id } }), // Matriz BH
    prisma.agencyContact.create({ data: { agency_id: agencies[2].id, contact_id: contacts[2].id } }), // Comercial
    
    // Agência 4 - Skyline Imóveis
    prisma.agencyAddress.create({ data: { agency_id: agencies[3].id, address_id: addresses[8].id } }), // Matriz Curitiba
  ]);

  // Proprietários com endereços e contatos
  await Promise.all([
    // Proprietário 1 - Carlos Mendes
    prisma.ownerAddress.create({ data: { owner_id: owners[0].id, address_id: addresses[0].id } }), // Endereço residencial
    prisma.ownerAddress.create({ data: { owner_id: owners[0].id, address_id: addresses[2].id } }), // Endereço comercial
    prisma.ownerContact.create({ data: { owner_id: owners[0].id, contact_id: contacts[0].id } }), // Contato pessoal
    
    // Proprietário 2 - Ana Paula
    prisma.ownerAddress.create({ data: { owner_id: owners[1].id, address_id: addresses[4].id } }), // Endereço RJ
    prisma.ownerContact.create({ data: { owner_id: owners[1].id, contact_id: contacts[1].id } }), // Celular
    
    // Proprietário 3 - Roberto Lima
    prisma.ownerAddress.create({ data: { owner_id: owners[2].id, address_id: addresses[6].id } }), // Endereço BH
    prisma.ownerContact.create({ data: { owner_id: owners[2].id, contact_id: contacts[2].id } }), // Comercial
    
    // Proprietário 4 - Fernanda Santos
    prisma.ownerAddress.create({ data: { owner_id: owners[3].id, address_id: addresses[1].id } }), // Paulista
    prisma.ownerContact.create({ data: { owner_id: owners[3].id, contact_id: contacts[3].id } }), // Escritório
    
    // Proprietário 5 - Ricardo Oliveira
    prisma.ownerAddress.create({ data: { owner_id: owners[4].id, address_id: addresses[5].id } }), // Ipanema
    prisma.ownerContact.create({ data: { owner_id: owners[4].id, contact_id: contacts[4].id } }), // Assistente
    
    // Proprietário 6 - Patrícia Almeida
    prisma.ownerAddress.create({ data: { owner_id: owners[5].id, address_id: addresses[7].id } }), // Savassi BH
    prisma.ownerContact.create({ data: { owner_id: owners[5].id, contact_id: contacts[5].id } }), // Residencial
  ]);

  // Inquilinos com endereços e contatos
  await Promise.all([
    // Inquilino 1 - Lucas Ferreira
    prisma.tenantAddress.create({ data: { tenant_id: tenants[0].id, address_id: addresses[0].id } }), // Endereço atual
    prisma.tenantContact.create({ data: { tenant_id: tenants[0].id, contact_id: contacts[6].id } }), // Celular
    
    // Inquilino 2 - Fernanda Costa
    prisma.tenantAddress.create({ data: { tenant_id: tenants[1].id, address_id: addresses[4].id } }), // Endereço RJ
    prisma.tenantContact.create({ data: { tenant_id: tenants[1].id, contact_id: contacts[7].id } }), // Trabalho
    
    // Inquilino 3 - Bruno Alves
    prisma.tenantAddress.create({ data: { tenant_id: tenants[2].id, address_id: addresses[1].id } }), // Paulista
    prisma.tenantContact.create({ data: { tenant_id: tenants[2].id, contact_id: contacts[2].id } }), // Comercial
    
    // Inquilino 4 - Juliana Pereira
    prisma.tenantAddress.create({ data: { tenant_id: tenants[3].id, address_id: addresses[5].id } }), // Ipanema
    prisma.tenantContact.create({ data: { tenant_id: tenants[3].id, contact_id: contacts[1].id } }), // Celular
    
    // Inquilino 5 - Tech Solutions
    prisma.tenantAddress.create({ data: { tenant_id: tenants[4].id, address_id: addresses[3].id } }), // Faria Lima
    prisma.tenantContact.create({ data: { tenant_id: tenants[4].id, contact_id: contacts[3].id } }), // Escritório
  ]);

  // Propriedades com endereços
  await Promise.all([
    // Propriedade 1 - Apartamento Jardins
    prisma.propertyAddress.create({ data: { property_id: properties[0].id, address_id: addresses[2].id } }),
    
    // Propriedade 2 - Apartamento Higienópolis
    prisma.propertyAddress.create({ data: { property_id: properties[1].id, address_id: addresses[1].id } }),
    
    // Propriedade 3 - Casa Pinheiros
    prisma.propertyAddress.create({ data: { property_id: properties[2].id, address_id: addresses[0].id } }),
    
    // Propriedade 4 - Sobrado Botafogo
    prisma.propertyAddress.create({ data: { property_id: properties[3].id, address_id: addresses[5].id } }),
    
    // Propriedade 5 - Cobertura Leblon
    prisma.propertyAddress.create({ data: { property_id: properties[4].id, address_id: addresses[5].id } }),
    
    // Propriedade 6 - Casa Condomínio Alphaville
    prisma.propertyAddress.create({ data: { property_id: properties[5].id, address_id: addresses[9].id } }),
    
    // Propriedade 7 - Sala Comercial Faria Lima
    prisma.propertyAddress.create({ data: { property_id: properties[6].id, address_id: addresses[3].id } }),
    
    // Propriedade 8 - Galpão Marginal Tietê
    prisma.propertyAddress.create({ data: { property_id: properties[7].id, address_id: addresses[0].id } }),
  ]);

  console.log('✅ Database seeded successfully!');
  console.log(`📊 Summary:`);
  console.log(`   👥 Users: ${users.length}`);
  console.log(`   🏠 Property Types: ${propertyTypes.length}`);
  console.log(`   🏢 Agencies: ${agencies.length}`);
  console.log(`   👨‍💼 Owners: ${owners.length}`);
  console.log(`   👨‍💻 Tenants: ${tenants.length}`);
  console.log(`   📍 Addresses: ${addresses.length}`);
  console.log(`   📞 Contacts: ${contacts.length}`);
  console.log(`   🏘️ Properties: ${properties.length}`);
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