import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryRunner, Repository } from 'typeorm';
import { File } from './file.entity';
import { Agent } from '../agent/entities/agent.entity';
import { S3Service } from '../s3/s3.service';
import { GoogleAiService } from '../google-ai-service/google-ai-service.service';
import { DocumentType } from '../common/enum/documentType.enum';

// Define a consistent interface for document processors
interface DocumentProcessor {
  validate(data: any): void;
  updateAgent(agent: Agent, data: any): void;
}

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  private readonly VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
  private readonly documentProcessors: Record<DocumentType, DocumentProcessor>;

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly s3Service: S3Service,
    private readonly googleAiService: GoogleAiService,
  ) {
    this.documentProcessors = {
      [DocumentType.DRIVER_LICENSE]: new DriverLicenseProcessor(),
      [DocumentType.INSURANCE]: new InsuranceProcessor(),
      [DocumentType.ELECTRICIAN_CERTIFICATE]: new ElectricCertificateProcessor(),
    };
  }

  async uploadAndProcessFile(
    file: Express.Multer.File,
    agent: Agent,
    documentType: DocumentType,
    queryRunner?: QueryRunner,
  ): Promise<Agent> {
    this.validateFile(file);
    const manager = queryRunner?.manager || this.fileRepository.manager;

    const [extractedData, fileUrl] = await Promise.all([
      this.googleAiService.extractDocumentData(file, documentType),
      this.uploadFileToS3(file, agent),
    ]);

    try {
      this.validateExtractedData(documentType, extractedData);
      this.validateDocumentContent(agent, documentType, extractedData);
      
      const newFile = await this.createFileRecord(file, fileUrl, agent, documentType, manager);
      await this.updateAgentWithDocument(agent, documentType, extractedData, newFile, fileUrl, manager);
      
      return agent;
    } catch (error) {
      await this.cleanupOnError(fileUrl);
      throw error;
    }
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file?.buffer || file.size === 0) {
      throw new BadRequestException('Invalid file: empty buffer');
    }

    if (!this.VALID_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds ${this.MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }
  }

  private validateExtractedData(
    documentType: DocumentType,
    extractedData: Record<string, any>,
  ): void {
    if (!extractedData || typeof extractedData !== 'object') {
      throw new BadRequestException('Failed to extract document data');
    }

    const processor = this.documentProcessors[documentType];
    processor.validate(extractedData);
  }

  private validateDocumentContent(
    agent: Agent,
    documentType: DocumentType,
    extractedData: Record<string, any>,
  ): void {
    if (documentType === DocumentType.DRIVER_LICENSE) {
      this.validateDriverLicenseName(agent, extractedData.full_name);
    }
  }

  private validateDriverLicenseName(agent: Agent, licenseName: string): void {
    const registeredName = `${agent.firstName} ${agent.lastName}`;
    if (!this.normalizeAndCompareNames(licenseName, registeredName)) {
      throw new BadRequestException(
        `Name on document (${licenseName}) doesn't match registered name (${registeredName})`,
      );
    }
  }

  private normalizeAndCompareNames(name1: string, name2: string): boolean {
    if (!name1 || !name2) return false;

    const normalize = (name: string) =>
      name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z ]/g, '');

    const [names1, names2] = [normalize(name1).split(' '), normalize(name2).split(' ')];
    return names1.some(n => names2.includes(n)) && names2.some(n => names1.includes(n));
  }

  private async uploadFileToS3(file: Express.Multer.File, agent: Agent): Promise<string> {
    const userName = `${agent.firstName} ${agent.lastName}`;
    return this.s3Service.uploadFile(file, agent.id, userName, agent.state);
  }

  private async createFileRecord(
    file: Express.Multer.File,
    fileUrl: string,
    agent: Agent,
    documentType: DocumentType,
    manager: EntityManager,
  ): Promise<File> {
    const newFile = manager.getRepository(File).create({
      originalName: file.originalname,
      fileUrl,
      mimeType: file.mimetype,
      documentType,
      agent,
    });

    return manager.getRepository(File).save(newFile);
  }

  private async updateAgentWithDocument(
    agent: Agent,
    documentType: DocumentType,
    extractedData: Record<string, any>,
    newFile: File,
    fileUrl: string,
    manager: EntityManager,
  ): Promise<void> {
    const processor = this.documentProcessors[documentType];
    processor.updateAgent(agent, extractedData);

    this.updateAgentDocuments(agent, documentType, {
      id: newFile.id,
      type: documentType,
      url: fileUrl,
      originalName: newFile.originalName,
      uploadedAt: new Date(),
      mimeType: newFile.mimeType,
      isVerified: true,
    });

    await manager.getRepository(Agent).save(agent);
  }

  private updateAgentDocuments(agent: Agent, documentType: DocumentType, documentEntry: any): void {
    agent.documents = agent.documents?.filter(doc => doc.type !== documentType) || [];
    agent.documents.push(documentEntry);
  }

  private async cleanupOnError(fileUrl: string | null): Promise<void> {
    if (!fileUrl) return;

    try {
      await this.s3Service.deleteFile(fileUrl);
    } catch (error) {
      this.logger.error('Failed to cleanup file from S3', error.stack);
    }
  }

  getDocumentByType(agent: Agent, documentType: DocumentType) {
    return agent.documents?.find(doc => doc.type === documentType);
  }

  async deleteAllAgentFiles(agentId: string): Promise<void> {
    try {
      const files = await this.fileRepository.find({ where: { agent: { id: agentId } } });
      await Promise.all(files.map(file => this.safeDeleteFile(file.fileUrl)));
      await this.fileRepository.delete({ agent: { id: agentId } });
    } catch (error) {
      this.logger.error(`Error deleting files for agent ${agentId}:`, error.stack);
      throw new InternalServerErrorException('Failed to delete agent files');
    }
  }

  private async safeDeleteFile(fileUrl: string): Promise<void> {
    try {
      await this.s3Service.deleteFile(fileUrl);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${fileUrl}`, error.stack);
    }
  }
}

// Processor Implementations
class DriverLicenseProcessor implements DocumentProcessor {
  private readonly requiredFields = ['license_number', 'expiration_date'];

  validate(data: any): void {
    this.validateRequiredFields(data);
  }

  private validateRequiredFields(data: any): void {
    const missingFields = this.requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      throw new BadRequestException(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  updateAgent(agent: Agent, data: any): void {
    agent.licenseNumber = data.license_number;
    agent.licenseExpirationDate = data.expiration_date ? new Date(data.expiration_date) : undefined;
  }
}

class InsuranceProcessor implements DocumentProcessor {
  private readonly requiredFields = ['policy_number', 'insurance_provider'];

  validate(data: any): void {
    this.validateRequiredFields(data);
  }

  private validateRequiredFields(data: any): void {
    const missingFields = this.requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      throw new BadRequestException(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  updateAgent(agent: Agent, data: any): void {
    agent.insuranceDetails = {
      insured_name: data.insured_name,
      policy_number: data.policy_number,
      insurance_provider: data.insurance_provider,
      policy_type: data.policy_type,
      effective_date: data.effective_date,
      expiration_date: data.expiration_date,
    };
  }
}

class ElectricCertificateProcessor implements DocumentProcessor {
  private readonly requiredFields = ['license_type', 'expiration_date'];

  validate(data: any): void {
    this.validateRequiredFields(data);
  }

  private validateRequiredFields(data: any): void {
    const missingFields = this.requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      throw new BadRequestException(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  updateAgent(agent: Agent, data: any): void {
    agent.electricCertificateDetails = {
      full_name: data.full_name,
      license_type: data.license_type,
      expiration_date: data.expiration_date,
      city: data.city,
    };
  }
}