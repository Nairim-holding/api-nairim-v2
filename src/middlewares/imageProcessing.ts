import { Request, Response, NextFunction } from 'express';
import { ImageConverter } from '../utils/imageConverter';

/**
 * Middleware para processar e converter imagens
 * Adiciona métodos ao request para manipular imagens antes de salvar
 */
export const imageProcessingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Adicionar método para converter imagem no request
  (req as any).convertImageToAVIF = async (imageBuffer: Buffer, quality: number = 80) => {
    try {
      return await ImageConverter.convertToAVIF(imageBuffer, quality);
    } catch (error: any) {
      console.error(`Erro ao converter imagem: ${error.message}`);
      throw error;
    }
  };

  // Adicionar método para redimensionar imagem
  (req as any).resizeImage = async (
    imageBuffer: Buffer,
    width: number,
    height?: number,
    crop: boolean = false
  ) => {
    try {
      return await ImageConverter.resizeImage(imageBuffer, width, height, crop);
    } catch (error: any) {
      console.error(`Erro ao redimensionar imagem: ${error.message}`);
      throw error;
    }
  };

  // Adicionar método para obter informações da imagem
  (req as any).getImageInfo = async (imageBuffer: Buffer) => {
    try {
      return await ImageConverter.getImageInfo(imageBuffer);
    } catch (error: any) {
      console.error(`Erro ao obter informações da imagem: ${error.message}`);
      throw error;
    }
  };

  next();
};

/**
 * Middleware para validar se arquivo é imagem
 * Retorna erro 400 se o arquivo não for uma imagem suportada
 */
export const validateImageMiddleware = (fieldName: string = 'image') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const files = (req as any).files || {};
    const fileArray = files[fieldName];

    if (!fileArray || fileArray.length === 0) {
      return next(); // Continua se não houver arquivo (pode ser opcional)
    }

    const file = fileArray[0];

    if (!ImageConverter.isSupportedImageFormat(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `Formato de imagem não suportado: ${file.mimetype}`,
        supportedFormats: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'image/tiff',
          'image/x-icon'
        ]
      });
    }

    next();
  };
};
