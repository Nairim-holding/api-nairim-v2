# Upload de Arquivos - Configuração (2026-05-24)

## Resumo

Upload de PDFs e outros arquivos **NÃO possui limite de tamanho**.

## Arquitetura do Upload

### Duas rotas de upload:

1. **Rota via Busboy (streaming)** — Usada pelo formulário unificado de imóveis
   - `POST /property/create-unified` → `PropertyController.createUnifiedProperty`
   - `PUT /property/update-unified/:id` → `PropertyController.updateUnifiedProperty`
   - Arquivo: `src/controllers/PropertyController.ts` (linhas ~269 e ~383)
   - Config: `busboy({ headers, limits: { files: 100 } })` — sem `fileSize`

2. **Rota via Multer (diskStorage)** — Upload avulso de documentos
   - `POST /property/:id/documents`
   - `PUT /property/:id/documents`
   - Arquivo: `src/utils/upload.ts`
   - Config: `multer({ storage })` — sem `limits` (padrão = sem limite de tamanho)

### Express body-parser (JSON/urlencoded)
- Arquivo: `src/app.ts` (linha 39-40)
- Config: `express.json({ limit: '4000mb' })` e `express.urlencoded({ limit: '4000mb' })`
- Isso NÃO afeta multipart/form-data (que usa busboy/multer)

## Limites Atuais

| Camada | Limite | Onde |
|--------|--------|------|
| Busboy fileSize | **Sem limite** | `PropertyController.ts` linhas 269, 383 |
| Busboy files (quantidade) | 100 arquivos por request | `PropertyController.ts` linhas 269, 383 |
| Multer fileSize | **Sem limite** | `src/utils/upload.ts` |
| Express JSON body | 4000mb | `src/app.ts` linha 39 |
| Express urlencoded | 4000mb | `src/app.ts` linha 40 |

## Fluxo de Upload (Busboy Streaming)

```
Cliente envia multipart/form-data
    ↓
Busboy parseia campo por campo (streaming)
    ↓
Campos JSON chegam primeiro → valida → cria/atualiza imóvel no banco
    ↓
Responde HTTP 201/200 ao cliente (antes dos arquivos terminarem!)
    ↓
Arquivos continuam gravando em disco (background)
    ↓
Após todos concluídos → cria Documents no banco + agenda conversão AVIF
```

**Vantagem**: Evita timeout do Nginx em uploads grandes. A resposta é enviada em < 1s.

## Fluxo de Upload (Multer)

```
Cliente envia multipart/form-data
    ↓
Multer grava em uploads/temp/ (diskStorage)
    ↓
Quando completo, handler roda → BlobService.moveFile → destino final
    ↓
Cria Document no banco → responde ao cliente
```

## Arquivos Relevantes

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/utils/upload.ts` | Configuração do Multer (diskStorage, temp dir) |
| `src/controllers/PropertyController.ts` | Busboy streaming para create/update unificado |
| `src/services/DocumentService.ts` | Lógica de persistência de documentos |
| `src/utils/uploadServiceFactory.ts` | LocalUploadService → BlobService.moveFile |
| `src/lib/blobService.ts` | Move arquivo para destino final, agenda AVIF |
| `src/app.ts` | Express body limits (JSON/urlencoded) |

## Encoding de Nomes (Resolvido)

- Regex de sanitização preserva caracteres portugueses (é, ã, ç, etc.)
- Apenas caracteres inválidos do filesystem são removidos: `< > : " / \ | ? *`
- Arquivo: `src/lib/blobService.ts` e `src/utils/uploadServiceFactory.ts`

## Se Precisar Adicionar Limite no Futuro

```typescript
// Em PropertyController.ts (busboy):
const bb = busboy({ headers: req.headers, limits: { files: 100, fileSize: X * 1024 * 1024 } });

// Em src/utils/upload.ts (multer):
const multerUpload = multer({ storage, limits: { fileSize: X * 1024 * 1024 } });
```

## Bug Fix: Upload Múltiplo (2026-05-24)

**Problema**: Upload de vários arquivos simultâneos falhava silenciosamente — resposta era 201 mas nenhum documento era salvo.

**Causa Raiz**: `Promise.all(fileWritePromises)` rejeita se QUALQUER stream falhar. O `.catch` limpava TODOS os temp files, zerando o upload inteiro.

**Correção**: Substituído `Promise.all` por `Promise.allSettled`:
- Processa apenas os arquivos gravados com sucesso
- Limpa apenas os que falharam
- Logs detalhados de quais falharam e quais foram processados

**Código** (`src/controllers/PropertyController.ts` linhas ~355 e ~495):
```typescript
Promise.allSettled(fileWritePromises)
  .then(async (results) => {
    // Separa successFiles vs failedFiles
    // Processa apenas successFiles
    // Cleanup apenas failedFiles
  })
```

## Considerações de Deploy

- **Nginx**: Verificar `client_max_body_size` no nginx.conf (deve ser grande ou 0 para ilimitado)
- **Cloudflare/CDN**: Verificar limite de upload do plano (Free = 100MB, Pro = 500MB)
- **Disco**: Monitorar espaço em `uploads/temp/` e destino final
- **BlobService.cleanupTempFiles()**: Executa na inicialização para limpar orphans
