/**
 * Backup completo do banco de dados PostgreSQL.
 * Uso: npm run db:backup
 *
 * Salva em <projeto>/backup/backup_YYYY-MM-DD_HH-MM-SS.sql
 * O diretório é criado automaticamente se não existir.
 */

import 'dotenv/config';
import { spawnSync } from 'child_process';
import { mkdirSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL não configurado no .env');
  process.exit(1);
}

// Diretório de backup (relativo à raiz do projeto)
const BACKUP_DIR = path.resolve(process.cwd(), 'backup');
// Quantos backups manter (os mais antigos serão removidos)
const MAX_BACKUPS = Number(process.env.BACKUP_MAX_FILES ?? 10);

// Cria o diretório se não existir
mkdirSync(BACKUP_DIR, { recursive: true });

// Nome do arquivo com timestamp
const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
const filename = `backup_${timestamp}.sql`;
const filepath = path.join(BACKUP_DIR, filename);

console.log(`\n📦  Iniciando backup do banco de dados...`);
console.log(`🗄️   Destino: ${filepath}\n`);

const result = spawnSync('pg_dump', ['--no-password', DATABASE_URL], {
  maxBuffer: 1024 * 1024 * 512, // 512 MB
  timeout: 5 * 60 * 1000,       // 5 minutos
});

if (result.error) {
  console.error('❌  Erro ao executar pg_dump:', result.error.message);
  console.error('    Verifique se o PostgreSQL client (pg_dump) está instalado e no PATH.');
  process.exit(1);
}

if (result.status !== 0) {
  const stderr = result.stderr?.toString() ?? '';
  console.error('❌  pg_dump retornou erro:\n', stderr);
  process.exit(1);
}

if (!result.stdout || result.stdout.length === 0) {
  console.error('❌  pg_dump não retornou dados. Verifique a DATABASE_URL.');
  process.exit(1);
}

writeFileSync(filepath, result.stdout);

const sizeMB = (result.stdout.length / 1024 / 1024).toFixed(2);
console.log(`✅  Backup concluído!`);
console.log(`📄  Arquivo : ${filename}`);
console.log(`📏  Tamanho : ${sizeMB} MB`);

// Remove backups antigos mantendo apenas os MAX_BACKUPS mais recentes
try {
  const files = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
    .map(f => ({ name: f, mtime: statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);

  const toDelete = files.slice(MAX_BACKUPS);
  toDelete.forEach(f => {
    unlinkSync(path.join(BACKUP_DIR, f.name));
    console.log(`🗑️   Removido backup antigo: ${f.name}`);
  });

  console.log(`\n📁  Total de backups mantidos: ${Math.min(files.length, MAX_BACKUPS)}/${MAX_BACKUPS}`);
} catch {
  // Rotação de backups é opcional — ignora erros
}

console.log();
