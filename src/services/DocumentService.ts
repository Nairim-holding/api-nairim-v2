import { DocumentType } from '@/generated/prisma/enums';
import prisma from '../lib/prisma';
import { UploadServiceFactory } from '../utils/uploadServiceFactory';
import fs from 'fs';
import path from 'path';

export class DocumentService {
  static async uploadDocuments(propertyId: string, userId: string, files: Record<string, Express.Multer.File[]>) {
    try {
      console.log(`📁 Uploading documents for property: ${propertyId}`);

      const property = await prisma.property.findUnique({
        where: { 
          id: propertyId,
          deleted_at: null
        }
      });

      if (!property) {
        throw new Error('Property not found');
      }

      const uploadService = UploadServiceFactory.create();
      const savedDocuments = [];

      for (const [key, fileArray] of Object.entries(files)) {
        for (const file of fileArray) {
          let fileUrl: string;

          if (uploadService) {
            const folder = this.getFolderName(key);
            fileUrl = await uploadService.uploadFile(file, folder);
          } else {
            const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
            const relativePath = path.relative(path.join(__dirname, '../../uploads'), file.path);
            fileUrl = `${baseUrl}/uploads/${relativePath.replace(/\\/g, '/')}`;
          }

          const documentType = this.getDocumentType(key);

          const document = await prisma.document.create({
            data: {
              property_id: propertyId,
              file_path: fileUrl,
              file_type: file.mimetype,
              description: this.getDescription(key),
              type: documentType,
              created_by: userId,
            }
          });

          savedDocuments.push(document);
        }
      }

      console.log(`✅ Documents uploaded: ${savedDocuments.length} files`);
      return savedDocuments;

    } catch (error: any) {
      console.error('❌ Error uploading documents:', error);
      throw error;
    }
  }

  static async updateDocuments(propertyId: string, userId: string, files: Record<string, Express.Multer.File[]>) {
    try {
      console.log(`📁 Updating documents for property: ${propertyId}`);

      const property = await prisma.property.findUnique({
        where: { 
          id: propertyId,
          deleted_at: null
        }
      });

      if (!property) {
        throw new Error('Property not found');
      }

      const uploadService = UploadServiceFactory.create();
      const savedDocuments = [];
      const newFileUrls: string[] = [];

      for (const [key, fileArray] of Object.entries(files)) {
        for (const file of fileArray) {
          let fileUrl: string;

          if (uploadService) {
            const folder = this.getFolderName(key);
            fileUrl = await uploadService.uploadFile(file, folder);
          } else {
            const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
            const relativePath = path.relative(path.join(__dirname, '../../uploads'), file.path);
            fileUrl = `${baseUrl}/uploads/${relativePath.replace(/\\/g, '/')}`;
          }

          newFileUrls.push(fileUrl);

          const documentType = this.getDocumentType(key);

          const document = await prisma.document.create({
            data: {
              property_id: propertyId,
              file_path: fileUrl,
              file_type: file.mimetype,
              description: this.getDescription(key),
              type: documentType,
              created_by: userId,
            }
          });

          savedDocuments.push(document);
        }
      }

      if (newFileUrls.length > 0) {
        const existingDocuments = await prisma.document.findMany({
          where: {
            property_id: propertyId,
            deleted_at: null
          }
        });

        const documentsToDelete = existingDocuments.filter(doc => !newFileUrls.includes(doc.file_path));

        for (const doc of documentsToDelete) {
          await this.deleteDocumentFile(doc.file_path);
          await prisma.document.update({
            where: { id: doc.id },
            data: { deleted_at: new Date() }
          });
        }
      }

      console.log(`✅ Documents updated: ${savedDocuments.length} new files`);
      return savedDocuments;

    } catch (error: any) {
      console.error('❌ Error updating documents:', error);
      throw error;
    }
  }

  private static async deleteDocumentFile(fileUrl: string) {
    try {
      const uploadService = UploadServiceFactory.create();

      if (uploadService) {
        await uploadService.deleteFile(fileUrl);
      } else {
        const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
        const filePath = fileUrl.replace(`${baseUrl}/uploads/`, '');
        const absolutePath = path.join(__dirname, '../../uploads', filePath);
        
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  private static getDocumentType(key: string): DocumentType {
    switch (key) {
      case 'arquivosImagens':
        return 'IMAGE';
      case 'arquivosMatricula':
        return 'REGISTRATION';
      case 'arquivosRegistro':
        return 'PROPERTY_RECORD';
      case 'arquivosEscritura':
        return 'TITLE_DEED';
      default:
        return 'OTHER';
    }
  }

  private static getDescription(key: string): string {
    switch (key) {
      case 'arquivosImagens':
        return 'Property Media';
      case 'arquivosMatricula':
        return 'Property Registration Document';
      case 'arquivosRegistro':
        return 'Property Record';
      case 'arquivosEscritura':
        return 'Property Title Deed';
      default:
        return 'Property Document';
    }
  }

  private static getFolderName(key: string): string {
    switch (key) {
      case 'arquivosImagens':
        return 'properties/images';
      case 'arquivosMatricula':
        return 'properties/registrations';
      case 'arquivosRegistro':
        return 'properties/records';
      case 'arquivosEscritura':
        return 'properties/title-deeds';
      default:
        return 'properties/documents';
    }
  }
}