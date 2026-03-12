import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class LocalUploadService {
  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    try {
      const fileName = `${uuidv4()}${path.extname(file.originalname)}`;
      const relativePath = path.posix.join(folder, fileName);
      const absolutePath = path.join(process.cwd(), 'uploads', relativePath);

      // Cria a pasta se não existir
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      
      // Salva o arquivo
      fs.writeFileSync(absolutePath, file.buffer);

      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      return `${baseUrl}/uploads/${relativePath}`;
    } catch (error) {
      console.error('Error uploading locally:', error);
      throw error;
    }
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const filePath = url.replace(`${baseUrl}/uploads/`, '');
      const absolutePath = path.join(process.cwd(), 'uploads', filePath);

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (error) {
      console.error('Error deleting local file:', error);
      throw error;
    }
  }
}

// Factory agora sempre retorna o serviço local
export class UploadServiceFactory {
  static create() {
    return new LocalUploadService();
  }
}