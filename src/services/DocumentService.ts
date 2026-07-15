import { DocumentType } from '@/generated/prisma/enums';
import prisma from '../lib/prisma';
import { UploadServiceFactory } from '../utils/uploadServiceFactory';
import fs from 'fs';
import path from 'path';

export class DocumentService {
  static async uploadDocuments(propertyId: string, userId: string, files: Record<string, Express.Multer.File[]>, company_id: string) {
    try {
      console.log(`📁 Uploading documents for property: ${propertyId}`);

      const property = await prisma.property.findFirst({
        where: { id: propertyId, company_id, deleted_at: null }
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
              company_id,
              file_path: fileUrl,
              file_type: file.mimetype,
              description: this.getDescription(key),
              type: documentType,
              created_by: userId?.trim() || null,
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

  static async updateDocuments(propertyId: string, userId: string, files: Record<string, Express.Multer.File[]>, company_id: string) {
    try {
      console.log(`📁 Updating documents for property: ${propertyId}`);

      const property = await prisma.property.findFirst({
        where: { id: propertyId, company_id, deleted_at: null }
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
              company_id,
              file_path: fileUrl,
              file_type: file.mimetype,
              description: this.getDescription(key),
              type: documentType,
              created_by: userId?.trim() || null,
            }
          });

          savedDocuments.push(document);
        }
      }

      // Removida a lógica destrutiva que deletava arquivos existentes.
      // O formulário unificado já cuida da remoção explícita se necessário.

      console.log(`✅ Documents updated: ${savedDocuments.length} new files`);
      return savedDocuments;

    } catch (error: any) {
      console.error('❌ Error updating documents:', error);
      throw error;
    }
  }

  /**
   * Anexa documentos (ex.: contrato de locação) a uma Locação. Reaproveita o
   * mesmo mecanismo de storage de Imóveis (UploadServiceFactory) e a mesma
   * tabela `Document`, apenas vinculando via `lease_id` em vez de `property_id`.
   */
  static async uploadLeaseDocuments(leaseId: string, userId: string, files: Record<string, Express.Multer.File[]>, company_id: string) {
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, company_id, deleted_at: null }
    });
    if (!lease) {
      throw new Error('Lease not found');
    }

    const uploadService = UploadServiceFactory.create();
    const savedDocuments = [];

    for (const [key, fileArray] of Object.entries(files)) {
      for (const file of fileArray) {
        let fileUrl: string;

        if (uploadService) {
          fileUrl = await uploadService.uploadFile(file, 'leases/documents');
        } else {
          const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
          const relativePath = path.relative(path.join(__dirname, '../../uploads'), file.path);
          fileUrl = `${baseUrl}/uploads/${relativePath.replace(/\\/g, '/')}`;
        }

        const document = await prisma.document.create({
          data: {
            lease_id: leaseId,
            company_id,
            file_path: fileUrl,
            file_type: file.mimetype,
            description: this.getLeaseDescription(key),
            type: 'LEASE_CONTRACT',
            created_by: userId?.trim() || null,
          }
        });

        savedDocuments.push(document);
      }
    }

    return savedDocuments;
  }

  /**
   * Remoção (soft-delete) de documentos de uma Locação e do arquivo no storage.
   * Restringe por `lease_id` + `company_id` para não afetar documentos de outra
   * locação/empresa.
   */
  static async removeLeaseDocuments(leaseId: string, documentIds: string[], company_id: string) {
    if (!documentIds || documentIds.length === 0) return;

    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds }, lease_id: leaseId, company_id, deleted_at: null }
    });

    for (const document of documents) {
      await this.deleteDocumentFile(document.file_path);
    }

    await prisma.document.updateMany({
      where: { id: { in: documents.map(d => d.id) } },
      data: { deleted_at: new Date() }
    });
  }

  static async setFeaturedDocument(propertyId: string, documentId: string) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        
        await tx.document.updateMany({
          where: { 
            property_id: propertyId,
            is_featured: true 
          },
          data: { 
            is_featured: false 
          }
        });

        const featuredDocument = await tx.document.update({
          where: { 
            id: documentId,
            property_id: propertyId 
          },
          data: { 
            is_featured: true 
          }
        });

        return featuredDocument;
      });

      console.log(`✅ Document ${documentId} is now featured for property ${propertyId}`);
      return result;

    } catch (error: any) {
      console.error('❌ Error setting featured document:', error);
      throw new Error(`Failed to set featured document: ${error.message}`);
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

  private static getLeaseDescription(key: string): string {
    switch (key) {
      case 'arquivosLocacao':
        return 'Lease Contract';
      default:
        return 'Lease Document';
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