import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private s3: S3Client;
  private bucketName: string;
  private readonly logger = new Logger(S3Service.name);

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing AWS configuration');
    }

    this.s3 = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const bucketName = this.configService.get<string>('AWS_S3_BUCKET');
    if (!bucketName) {
      throw new Error('Missing S3 bucket name configuration');
    }
    this.bucketName = bucketName;
  }

  async uploadFile(
    file: Express.Multer.File,
    agentId: string,
    userName: string,
    cityState: string
  ): Promise<string> {
    if (!file || !file.buffer) {
      throw new Error('Invalid file provided');
    }
    if (!agentId || !userName || !cityState) {
      throw new Error('Missing user information');
    }

    const normalizedCityState = this.normalizePathSegment(cityState);
    const normalizedUserName = this.normalizePathSegment(userName);
    const normalizedFileName = this.normalizePathSegment(file.originalname);
    const uniqueFileName = `${uuidv4()}-${normalizedFileName}`;
    
    const key = `agents/${normalizedCityState}/${agentId}/${normalizedUserName}/${uniqueFileName}`;
    
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        'user-id': agentId,
        'user-name': userName,
        'city-state': cityState,
        'original-filename': file.originalname,
        'uploaded-at': new Date().toISOString()
      }
    };

    try {
      await this.s3.send(new PutObjectCommand(params));
      this.logger.log(`File uploaded successfully to: ${key}`);
      
      return `https://${this.bucketName}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${key}`;
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      const url = new URL(fileUrl);
      const key = url.pathname.substring(1);
      
      const params = {
        Bucket: this.bucketName,
        Key: key,
      };

      await this.s3.send(new DeleteObjectCommand(params));
      this.logger.log(`File deleted successfully: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete file: ${fileUrl}`, error.stack);
      return false;
    }
  }

  async getFileMetadata(fileUrl: string): Promise<Record<string, string>> {
    try {
      const url = new URL(fileUrl);
      const key = url.pathname.substring(1);
      
      const params = {
        Bucket: this.bucketName,
        Key: key,
      };

      const data = await this.s3.send(new HeadObjectCommand(params));
      return data.Metadata || {};
    } catch (error) {
      this.logger.error(`Failed to get file metadata: ${fileUrl}`, error.stack);
      return {};
    }
  }

  private normalizePathSegment(segment: string): string {
    return segment
      .toLowerCase()
      .normalize('NFD') 
      .replace(/[\u0300-\u036f]/g, '') 
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') 
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
