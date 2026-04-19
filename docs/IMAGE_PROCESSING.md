# 📸 Processamento e Conversão de Imagens

## Visão Geral

O sistema implementa conversão automática de imagens para o formato AVIF com alto nível de compressão, mantendo boa qualidade visual. Todas as imagens enviadas são automaticamente convertidas para AVIF durante o upload.

## ✨ Características

- **Conversão Automática para AVIF**: Todas as imagens são convertidas automaticamente
- **Alta Compressão**: Redução de 40-70% no tamanho de arquivo
- **Qualidade Mantida**: Qualidade padrão de 80% (configurável)
- **Fallback Automático**: Se houver erro na conversão, salva no formato original
- **Suporte Múltiplos Formatos**: JPEG, PNG, WebP, GIF, TIFF, ICO
- **Otimização com Sharp**: Utiliza a biblioteca Sharp para máxima performance

## 🔧 Formatos Suportados

Entrada (original):
- `image/jpeg` → AVIF
- `image/png` → AVIF
- `image/webp` → AVIF
- `image/gif` → AVIF
- `image/tiff` → AVIF
- `image/x-icon` → AVIF

Saída:
- Sempre: `image/avif` com extensão `.avif`

## 📊 Redução de Tamanho

Exemplos típicos:

| Formato Original | Tamanho | AVIF | Redução |
|-----------------|---------|------|---------|
| PNG (foto)      | 2.5 MB  | 0.8 MB | 68% |
| JPEG            | 1.2 MB  | 0.4 MB | 67% |
| WebP            | 0.9 MB  | 0.3 MB | 67% |

## 🚀 Uso

### Integração Automática (Recomendado)

O sistema está integrado automaticamente ao fluxo de upload. Qualquer imagem enviada será convertida:

```typescript
// Em qualquer endpoint que aceita upload de arquivo
const { UploadServiceFactory } = require('../utils/uploadServiceFactory');
const uploadService = UploadServiceFactory.create();

// O arquivo será automaticamente convertido para AVIF
const fileUrl = await uploadService.uploadFile(file, 'documents/images');
// Resultado: fileUrl terminará em .avif
```

### Uso Avançado com Middleware

#### 1. Validar se arquivo é imagem

```typescript
import { Router } from 'express';
import { validateImageMiddleware } from '../middlewares/imageProcessing';
import { upload } from '../utils/upload';

const router = Router();

router.post(
  '/upload-photo',
  upload.single('photo'),
  validateImageMiddleware('photo'),
  async (req, res) => {
    // req.file contém a imagem
    // Será validado antes de chegar aqui
    res.json({ success: true });
  }
);
```

#### 2. Converter manualmente com controle de qualidade

```typescript
import { ImageConverter } from '../utils/imageConverter';

// Converter com qualidade customizada (1-100)
const avifBuffer = await ImageConverter.convertToAVIF(imageBuffer, 90);
```

#### 3. Obter informações da imagem

```typescript
const imageInfo = await ImageConverter.getImageInfo(imageBuffer);
console.log(imageInfo);
// {
//   width: 1920,
//   height: 1080,
//   format: 'jpeg',
//   space: 'srgb',
//   hasAlpha: false
// }
```

#### 4. Redimensionar imagem

```typescript
// Redimensionar mantendo proporção (fit)
const resized = await ImageConverter.resizeImage(imageBuffer, 800);

// Redimensionar com crop (cobre exatamente as dimensões)
const cropped = await ImageConverter.resizeImage(imageBuffer, 200, 200, true);

// Com altura específica
const thumbnail = await ImageConverter.resizeImage(imageBuffer, 200, 150);
```

## 🎯 Casos de Uso

### Case 1: Upload de Documento com Imagem

```typescript
static async createDocument(req: Request, res: Response) {
  try {
    const files = (req as any).files;
    const imageFile = files.document_image?.[0];

    if (imageFile) {
      // Imagem será automaticamente convertida para AVIF
      const { UploadServiceFactory } = require('../utils/uploadServiceFactory');
      const uploadService = UploadServiceFactory.create();
      const imageUrl = await uploadService.uploadFile(imageFile, 'documents');
      
      // imageUrl agora é .avif
    }

    res.json(ApiResponse.success({ image_url: imageUrl }));
  } catch (error) {
    res.status(500).json(ApiResponse.error('Erro ao processar imagem'));
  }
}
```

### Case 2: Criar Thumbnail com Redimensionamento

```typescript
import { ImageConverter } from '../utils/imageConverter';

async function createThumbnail(imageBuffer: Buffer) {
  // 1. Redimensionar para 200x200 com crop
  const resized = await ImageConverter.resizeImage(imageBuffer, 200, 200, true);
  
  // 2. Converter para AVIF com qualidade alta
  const thumbnail = await ImageConverter.convertToAVIF(resized, 90);
  
  return thumbnail;
}
```

### Case 3: Validar e Processar em Etapas

```typescript
async function processPropertyImage(file: Express.Multer.File) {
  // 1. Validar formato
  if (!ImageConverter.isSupportedImageFormat(file.mimetype)) {
    throw new Error('Formato não suportado');
  }

  // 2. Obter informações
  const info = await ImageConverter.getImageInfo(file.buffer);
  
  // 3. Redimensionar se necessário
  let processedBuffer = file.buffer;
  if (info.width > 2000 || info.height > 2000) {
    processedBuffer = await ImageConverter.resizeImage(
      file.buffer,
      1920,
      undefined,
      false
    );
  }

  // 4. Converter para AVIF
  const avifBuffer = await ImageConverter.convertToAVIF(processedBuffer, 85);
  
  return avifBuffer;
}
```

## ⚙️ Configuração

### Qualidade Padrão

A qualidade padrão é 80% e pode ser alterada:

```typescript
// Qualidade baixa (mais compressão, menos qualidade)
const lowQuality = await ImageConverter.convertToAVIF(imageBuffer, 60);

// Qualidade alta (menos compressão, melhor qualidade)
const highQuality = await ImageConverter.convertToAVIF(imageBuffer, 95);
```

### Níveis de Esforço

No código, o nível de esforço é 6 (escala 0-9). Isso controla o tempo de conversão:

- **Mais rápido**: 0-3 (menos compressão)
- **Padrão**: 4-6 (equilíbrio)
- **Máxima compressão**: 7-9 (mais lento)

Para ajustar, edite `src/utils/imageConverter.ts` linha ~22:
```typescript
effort: 6 // Altere conforme necessário
```

## 🌐 Compatibilidade com Navegadores

### Suporte Nativo (2024+)

| Navegador | AVIF | Fallback |
|-----------|------|----------|
| Chrome 85+ | ✅ | - |
| Firefox 93+ | ✅ | - |
| Safari 16+ | ✅ | - |
| Edge 85+ | ✅ | - |
| Opera 71+ | ✅ | - |

### Para Navegadores Antigos

Use tag `<picture>` com fallback:

```html
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Descrição">
</picture>
```

## 📝 Logs e Monitoramento

O sistema registra informações de conversão:

```
🎨 Processando imagem: photo.jpg (image/jpeg)
📊 Dimensões originais: 1920x1080px
🖼️ Convertendo imagem para AVIF (qualidade: 80)
✅ Conversão bem-sucedida: 2500.00KB → 750.00KB (redução: 70.00%)
✅ Imagem convertida com sucesso para AVIF
```

## ⚠️ Tratamento de Erros

Se houver erro na conversão, o sistema automaticamente:

1. Registra aviso com detalhes do erro
2. Salva a imagem no formato original
3. Continua o fluxo normalmente
4. Não interrompe o upload

```
⚠️ Falha ao converter para AVIF, salvando no formato original: <erro>
```

## 🔒 Segurança

- ✅ Validação de tipo MIME obrigatória
- ✅ Sharp sanitiza entrada automaticamente
- ✅ Isolamento de processamento
- ✅ Sem armazenamento temporário em disco para originais

## 📈 Performance

### Tempos Típicos (Máquina padrão)

| Operação | Tempo |
|----------|-------|
| Converter 2MB JPEG → AVIF | 300-500ms |
| Converter 1MB PNG → AVIF | 200-400ms |
| Redimensionar 4MB → 1920px | 150-300ms |

### Otimizações

- Processamento assíncrono
- Memory buffer (sem arquivo temporário)
- Effort level 6 (balanço velocidade/compressão)
- Fallback automático se erro

## 🆘 Troubleshooting

### Erro: "Cannot find module 'sharp'"

```bash
npm install sharp
```

### Erro: "Platform linux-x64 is not supported by sharp"

Sharp recompila para sua plataforma. Execute:
```bash
npm rebuild sharp
```

### Imagem não está sendo convertida

Verifique:
1. Tipo MIME é suportado: `ImageConverter.isSupportedImageFormat()`
2. Sharp está instalado: `npm list sharp`
3. Tamanho: Sharp não processa arquivos > 500MB por padrão

### Qualidade muito baixa após conversão

Aumente o parâmetro quality:
```typescript
ImageConverter.convertToAVIF(buffer, 90) // Padrão é 80
```

## 📚 Referências

- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [AVIF Format](https://en.wikipedia.org/wiki/AVIF)
- [MDN Web Docs - Image Format](https://developer.mozilla.org/en-US/docs/Glossary/MIME_type)
