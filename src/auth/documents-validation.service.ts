import { Injectable, BadRequestException } from '@nestjs/common';

const MAX_FILE_SIZE = 5 * 1024 * 1024; 

@Injectable()
export class DocumentsValidationService {

  validateRequiredDocuments(files: any): void {
    if (!files.driverLicense?.[0] || !files.insurance?.[0] || !files.electricCertificate?.[0]) {
      throw new BadRequestException('All documents are required');
    }
  }

  validateFilesSize(files: Express.Multer.File[]): void {
    const oversizedFiles = files
      .filter(file => file.size > MAX_FILE_SIZE)
      .map(file => file.originalname);
    
    if (oversizedFiles.length > 0) {
      throw new BadRequestException(
        `Following files exceed size limit of 5MB: ${oversizedFiles.join(', ')}`
      );
    }
  }
}