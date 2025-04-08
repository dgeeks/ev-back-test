import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  Injectable, 
  Logger, 
  InternalServerErrorException, 
  BadRequestException,
  ServiceUnavailableException 
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType } from '../common/enum/documentType.enum';

@Injectable()
export class GoogleAiService {
  private readonly logger = new Logger(GoogleAiService.name);
  private readonly genAi: GoogleGenerativeAI;
  private readonly modelName = 'gemini-1.5-flash';
  private readonly timeout = 10000; 
  private readonly maxRetries = 2;
  private readonly maxConcurrentRequests = 5;
  private activeRequests = 0;
  private requestQueue: Array<() => void> = [];
  private model: any;
  private isInitialized = false;
  private readonly prompts: Record<DocumentType, string> = {
    [DocumentType.INSURANCE]: `
      ANALYZE THIS INSURANCE DOCUMENT CAREFULLY.
      Extract the following fields EXACTLY as shown in the document:
      - insured_name (string)
      - policy_number (string)
      - insurance_provider (string)
      - policy_type (string)
      - effective_date (format as "YYYY-MM-DD")
      - expiration_date (format as "YYYY-MM-DD")
      
      Return ONLY a VALID JSON object with these fields.
      If any field is missing or unclear, use null for that field.
      DO NOT include any additional text or explanations.
    `,
    [DocumentType.DRIVER_LICENSE]: `
      ANALYZE THIS DRIVER'S LICENSE DOCUMENT CAREFULLY.
      Extract the following fields EXACTLY as shown:
      - full_name (string)
      - license_number (string)
      - expiration_date (format as "YYYY-MM-DD")
      
      Return ONLY a VALID JSON object with these fields.
      If any field is missing or unclear, use null for that field.
      DO NOT include any additional text or explanations.
    `,
    [DocumentType.ELECTRICIAN_CERTIFICATE]: `
      ANALYZE THIS ELECTRICIAN CERTIFICATE DOCUMENT CAREFULLY.
      Extract the following fields EXACTLY as shown:
      - full_name (string)
      - license_type (string)
      - expiration_date (format as "YYYY-MM-DD")
      - city (string)
      
      Return ONLY a VALID JSON object with these fields.
      If any field is missing or unclear, use null for that field.
      DO NOT include any additional text or explanations.
    `
  };

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('Google API Key is not configured');
    }

    this.genAi = new GoogleGenerativeAI(apiKey);
    this.initializeModelAsync();
  }

  private async initializeModelAsync(): Promise<void> {
    try {
      this.model = this.genAi.getGenerativeModel({ 
        model: this.modelName,
        generationConfig: {
          temperature: 0,
          topP: 0.1,
          topK: 5,
          maxOutputTokens: 200
        }
      });
      this.isInitialized = true;
      this.logger.log('Model initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize model', error.stack);
    }
  }

  // Ensure model is initialized before processing
  private async ensureModelInitialized(): Promise<void> {
    if (!this.isInitialized) {
      try {
        await this.initializeModelAsync();
      } catch (error) {
        throw new ServiceUnavailableException('AI service initialization failed');
      }
    }
  }

  async extractDocumentData(
    file: Express.Multer.File, 
    documentType: DocumentType,
  ): Promise<Record<string, any>> {
    // Validate inputs first to fail fast
    this.validateFileInput(file, documentType);
    
    // Ensure model is initialized
    await this.ensureModelInitialized();
    
    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        await this.waitForAvailableSlot();
        
        const prompt = this.prompts[documentType];
        

        const result = await Promise.race([
          this.processDocumentWithModel(file.buffer, file.mimetype, prompt),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Processing timeout after ${this.timeout}ms`)), this.timeout)
          )
        ]);
        
        this.logger.debug(`Document processed successfully in ${Date.now() - startTime}ms`);
        return result;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === this.maxRetries) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } finally {
        this.releaseSlot();
      }
    }

    this.logger.error(`All attempts failed after ${Date.now() - startTime}ms`, lastError?.stack);
    throw this.transformError(lastError);
  }

  private async processDocumentWithModel(
    buffer: Buffer,
    mimeType: string,
    prompt: string
  ): Promise<Record<string, any>> {
    try {
      const filePart = {
        inlineData: {
          mimeType,
          data: buffer.toString('base64'),
        },
      };

      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            filePart
          ],
        }],
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE',
          }
        ]
      });

      const responseText = await result.response.text();
      return this.parseResponse(responseText);
    } catch (error) {
      this.logger.error('Processing failed', error.stack || error);
      throw new InternalServerErrorException('AI processing error');
    }
  }

  private parseResponse(responseText: string): Record<string, any> {
    try {
      // Extract JSON from response (robust approach)
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      
      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error('No JSON object found in response');
      }

      const jsonString = responseText.slice(jsonStart, jsonEnd);
      const result = JSON.parse(jsonString);
      
      if (typeof result !== 'object' || result === null) {
        throw new Error('Invalid JSON format');
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to parse AI response', error.stack || error);
      throw new InternalServerErrorException('Failed to parse AI response');
    }
  }

  private validateFileInput(file: Express.Multer.File, documentType: DocumentType): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Empty file provided');
    }

    if (!Object.values(DocumentType).includes(documentType)) {
      throw new BadRequestException('Invalid document type');
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, and PDF are supported');
    }
  }

  private async waitForAvailableSlot(): Promise<void> {
    if (this.activeRequests < this.maxConcurrentRequests) {
      this.activeRequests++;
      return;
    }

    return new Promise(resolve => {
      this.requestQueue.push(() => {
        this.activeRequests++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeRequests--;
    if (this.requestQueue.length > 0) {
      const nextRequest = this.requestQueue.shift();
      nextRequest?.();
    }
  }

  private transformError(error: Error | null): Error {
    if (!error) {
        return new InternalServerErrorException('Unknown error occurred');
    }

    if (error.message.includes('timeout')) {
        return new ServiceUnavailableException('AI processing timeout');
    }

    if (error.message.includes('safety') || error.message.includes('blocked')) {
        return new BadRequestException('Document content was blocked by safety filters');
    }

    if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) {
        return error;
    }

    return new InternalServerErrorException('Failed to process document');
}
}