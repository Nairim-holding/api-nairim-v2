/**
 * Script para criar um usuário de teste no banco de dados.
 * Uso: npm run db:create-test-user
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_COMPANY_SLUG = 'nairim';
const DEFAULT_COMPANY_NAME = 'Nairim Holding';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL não configurado no .env');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log('🔄 Conectando ao banco de dados...');

  // 1. Verificar/criar empresa para multi-tenant
  let company = await prisma.company.findFirst({
    where: {
      OR: [
        { id: DEFAULT_COMPANY_ID },
        { slug: DEFAULT_COMPANY_SLUG }
      ]
    }
  });

  if (!company) {
    // Se não achou a padrão, tenta pegar qualquer uma existente
    company = await prisma.company.findFirst();
  }

  if (!company) {
    console.log('🏢 Nenhuma empresa cadastrada. Criando empresa padrão...');
    company = await prisma.company.create({
      data: {
        id: DEFAULT_COMPANY_ID,
        name: DEFAULT_COMPANY_NAME,
        slug: DEFAULT_COMPANY_SLUG,
        is_active: true,
      },
    });
    console.log(`✅ Empresa padrão criada: ${company.name} (${company.id})`);

    // Criar branding padrão para a empresa recém-criada
    await prisma.companyBranding.upsert({
      where: { company_id: company.id },
      update: {},
      create: {
        company_id: company.id,
        company_name: DEFAULT_COMPANY_NAME,
      },
    });
    console.log('🎨 Branding padrão criado.');
  } else {
    console.log(`🏢 Usando a empresa existente: ${company.name} (${company.id})`);
  }

  const email = 'teste2@gmail.com';
  const rawPassword = '123456';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  console.log(`👤 Verificando se o usuário ${email} já existe...`);

  // 2. Deletar se existir e criar novo usuário de teste
  const existingUser = await prisma.user.findUnique({
    where: {
      company_id_email: {
        company_id: company.id,
        email: email,
      },
    },
  });

  if (existingUser) {
    console.log(`🗑️ Usuário existente encontrado. Deletando...`);
    await prisma.user.delete({
      where: {
        company_id_email: {
          company_id: company.id,
          email: email,
        },
      },
    });
  }

  const testUser = await prisma.user.create({
    data: {
      company_id: company.id,
      name: 'João Silva',
      email: email,
      password: hashedPassword,
      birth_date: new Date('1990-01-01'),
      gender: 'MALE',
      role: 'SUPER_ADMIN',
    },
  });

  console.log('\n🎉 Usuário de teste criado/atualizado com sucesso!');
  console.log('--------------------------------------------------');
  console.log(`ID:         ${testUser.id}`);
  console.log(`Nome:       ${testUser.name}`);
  console.log(`E-mail:     ${testUser.email}`);
  console.log(`Senha:      ${rawPassword} (salva criptografada)`);
  console.log(`Data Nasc.: 1990-01-01`);
  console.log(`Gênero:     ${testUser.gender}`);
  console.log(`Role:       ${testUser.role}`);
  console.log(`Empresa:    ${company.name} (ID: ${company.id})`);
  console.log('--------------------------------------------------\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Erro ao criar usuário de teste:', e);
  process.exit(1);
});
