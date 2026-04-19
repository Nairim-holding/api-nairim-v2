import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export class ImageConverter {
  /**
   * Converte uma imagem para o formato AVIF com compressão otimizada
   * @param inputBuffer Buffer da imagem original
   * @param quality Qualidade (1-100, padrão 80)
   * @returns Buffer da imagem convertida em AVIF
   */
  static async convertToAVIF(inputBuffer: Buffer, quality: number = 80): Promise<Buffer> {
    try {
      console.log(`🖼️ Convertendo imagem para AVIF (qualidade: ${quality})`);

      const avifBuffer = await sharp(inputBuffer)
        .avif({
          quality: Math.min(Math.max(quality, 1), 100),
          lossless: false,
          effort: 6 // Nível de esforço (0-9, padrão 4)
        })
        .toBuffer();

      const originalSize = inputBuffer.length;
      const convertedSize = avifBuffer.length;
      const reduction = (((originalSize - convertedSize) / originalSize) * 100).toFixed(2);

      console.log(`✅ Conversão bem-sucedida: ${(originalSize / 1024).toFixed(2)}KB → ${(convertedSize / 1024).toFixed(2)}KB (redução: ${reduction}%)`);

      return avifBuffer;
    } catch (error: any) {
      console.error(`❌ Erro ao converter imagem para AVIF: ${error.message}`);
      throw new Error(`Falha ao converter imagem para AVIF: ${error.message}`);
    }
  }

  /**
   * Verifica se um arquivo é uma imagem baseado no tipo MIME
   * @param mimetype Tipo MIME do arquivo
   * @returns true se for uma imagem suportada
   */
  static isSupportedImageFormat(mimetype: string): boolean {
    const supportedFormats = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/tiff',
      'image/x-icon'
    ];
    return supportedFormats.includes(mimetype.toLowerCase());
  }

  /**
   * Gera o nome de arquivo para a imagem convertida
   * @param originalFilename Nome original do arquivo
   * @returns Nome do arquivo em AVIF
   */
  static generateAVIFFilename(originalFilename: string): string {
    const nameWithoutExtension = path.parse(originalFilename).name;
    return `${nameWithoutExtension}.avif`;
  }

  /**
   * Obtém informações da imagem (dimensões, tipo, etc)
   * @param imageBuffer Buffer da imagem
   * @returns Informações da imagem
   */
  static async getImageInfo(imageBuffer: Buffer): Promise<{
    width: number;
    height: number;
    format: string;
    space: string;
    hasAlpha: boolean;
  }> {
    try {
      const metadata = await sharp(imageBuffer).metadata();

      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        space: metadata.space || 'unknown',
        hasAlpha: metadata.hasAlpha || false
      };
    } catch (error: any) {
      console.error(`⚠️ Erro ao obter informações da imagem: ${error.message}`);
      return {
        width: 0,
        height: 0,
        format: 'unknown',
        space: 'unknown',
        hasAlpha: false
      };
    }
  }

  /**
   * Redimensiona uma imagem mantendo proporção (com opção de crop)
   * @param imageBuffer Buffer da imagem
   * @param width Largura desejada
   * @param height Altura desejada
   * @param crop Se true, faz crop para manter proporção. Se false, fit (padrão)
   * @returns Buffer da imagem redimensionada
   */
  static async resizeImage(
    imageBuffer: Buffer,
    width: number,
    height?: number,
    crop: boolean = false
  ): Promise<Buffer> {
    try {
      console.log(`📐 Redimensionando imagem: ${width}x${height || 'auto'} (crop: ${crop})`);

      let sharpInstance = sharp(imageBuffer).resize(width, height || undefined, {
        fit: crop ? 'cover' : 'contain',
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      });

      const resizedBuffer = await sharpInstance.toBuffer();

      console.log(`✅ Redimensionamento concluído`);
      return resizedBuffer;
    } catch (error: any) {
      console.error(`❌ Erro ao redimensionar imagem: ${error.message}`);
      throw new Error(`Falha ao redimensionar imagem: ${error.message}`);
    }
  }
}
