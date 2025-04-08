import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { BcryptService } from '../common/services/bcrypt.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterAuthDto } from './dto/registerUser-auth.dto';
import { Agent } from '../agent/entities/agent.entity';
import { LoginAuthDto } from './dto/loginUser-auth.dto';
import { TwilioService } from '../twilio/twilio.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VeriffService } from '../veriff/veriff.service';
import { DriverLicenseVerificationDto } from '../agent/dto/agent-verification.dto';
import { ConfigService } from '@nestjs/config';
import { FileService } from '../file/file.service';
import { DocumentType } from '../common/enum/documentType.enum';
import { DataSource, QueryRunner } from 'typeorm';
import { WorkAreaDto } from '../common/interfaces/workArea';
import { AgentAvailabilityDto } from '../agent/dto/agent-availability.dto';
import { AdditionalAddressDto } from '../agent/dto/additional-address.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly agentService: AgentService,
    private readonly bcryptService: BcryptService,
    private readonly jwtService: JwtService,
    private readonly twilioService: TwilioService,
    private readonly veriffService: VeriffService,
    private readonly configService: ConfigService,
    private readonly fileService: FileService,
    private readonly dataSource: DataSource,
  ) {}

  async registerWithDocuments(
    registerDto: RegisterAuthDto,
    files: {
      driverLicense: Express.Multer.File;
      insurance: Express.Multer.File;
      electricCertificate: Express.Multer.File;
    },
  ): Promise<{ message: string; agentId: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.validateRegistrationInputs(registerDto, files);

      await this.checkEmailAvailability(registerDto.email);

      const hashedPassword = await this.bcryptService.hashPassword(
        registerDto.password,
      );

      const agent = await queryRunner.manager.save(Agent, {
        ...registerDto,
        password: hashedPassword,
      });

      await this.processDocumentsInParallel(agent, files, queryRunner);

      await this.twilioService.sendOtp(registerDto.mobileNumber);

      await queryRunner.commitTransaction();

      return {
        message: 'Registration initiated. OTP sent to your mobile number.',
        agentId: agent.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof AggregateError) {
        throw new BadRequestException(
          error.errors.map((e) => e.message).join('; '),
        );
      }

      throw this.normalizeError(error);
    } finally {
      await queryRunner.release();
    }
  }

  private validateRegistrationInputs(
    registerDto: RegisterAuthDto,
    files: Record<string, Express.Multer.File>,
  ): void {
    // Validate phone number format
    if (!this.isValidPhoneNumber(registerDto.mobileNumber)) {
      throw new BadRequestException('Invalid phone number format');
    }

    // Validate required files exist
    const requiredFiles = ['driverLicense', 'insurance', 'electricCertificate'];
    for (const fileKey of requiredFiles) {
      if (!files[fileKey]) {
        throw new BadRequestException(`Missing required document: ${fileKey}`);
      }
    }
  }

  private async processDocumentsInParallel(
    agent: Agent,
    files: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const fileMapping = {
      driverLicense: DocumentType.DRIVER_LICENSE,
      insurance: DocumentType.INSURANCE,
      electricCertificate: DocumentType.ELECTRICIAN_CERTIFICATE,
    };

    const documentPromises = Object.entries(fileMapping).map(
      ([fileKey, documentType]) =>
        this.fileService
          .uploadAndProcessFile(
            files[fileKey],
            agent,
            documentType,
            queryRunner,
          )
          .catch((error) => {
            throw new BadRequestException(
              `${documentType} document error: ${error.message}`,
            );
          }),
    );

    await Promise.all(documentPromises);
  }

  async checkEmailAvailability(email: string): Promise<void> {
    const existingAgent = await this.agentService.findAgentByEmail(email);
    if (existingAgent) {
      throw new ConflictException('Email already exists');
    }
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    return /^\+?\d{10,15}$/.test(phoneNumber);
  }

  async verifyOtpAndRegister(
    verifyOtpDto: VerifyOtpDto,
  ): Promise<{ message: string }> {
    const { mobileNumber, code } = verifyOtpDto;

    try {
      const isValid = await this.twilioService.verifyOtp(mobileNumber, code);

      if (!isValid) {
        throw new UnauthorizedException('Invalid OTP');
      }

      const agent =
        await this.agentService.findAgentByMobileNumber(mobileNumber);
      if (!agent) {
        throw new NotFoundException(
          'No registration found for this mobile number',
        );
      }

      await this.agentService.markAgentAsVerified(agent.id);
      return { message: 'Verification successful' };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'OTP verification service unavailable',
      );
    }
  }

  async login(loginAuthDto: LoginAuthDto): Promise<{ accessToken: string }> {
    const agent = await this.agentService.findAgentWithPassword(
      loginAuthDto.email,
    );

    if (!agent) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.bcryptService.comparePassword(
      loginAuthDto.password,
      agent.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!agent.isVerified) {
      throw new UnauthorizedException(
        'Account not verified. Please verify your account first.',
      );
    }

    return this.generateAuthResponse(agent);
  }

  async resendOtp(mobileNumber: string): Promise<{ message: string }> {
    const agent = await this.agentService.findAgentByMobileNumber(mobileNumber);

    if (!agent) {
      throw new NotFoundException(
        'No registration found for this mobile number',
      );
    }

    try {
      await this.twilioService.sendOtp(mobileNumber);
      return { message: 'OTP resent to your mobile number' };
    } catch (error) {
      throw new ServiceUnavailableException(
        'Unable to resend OTP at the moment. Please try again later.',
      );
    }
  }

  async initiateDriverLicenseVerification(
    verifyDto: DriverLicenseVerificationDto,
  ): Promise<{
    success: boolean;
    verificationUrl?: string;
    sessionId?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const { sessionId, verificationUrl } =
        await this.veriffService.createDriverLicenseVerificationSession(
          verifyDto.agentId,
          verifyDto.country,
          verifyDto.state,
        );

      if (!sessionId || !verificationUrl) {
        throw new Error('Missing required verification data');
      }

      await this.agentService.updateAgent(verifyDto.agentId, {
        licenseVerificationStatus: 'pending',
        licenseVerificationSessionId: sessionId,
      });

      return {
        success: true,
        verificationUrl,
        sessionId,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error initiating license verification',
        error: error.message,
      };
    }
  }

  async checkVerificationStatus(sessionId: string): Promise<{
    status: string;
    agent: Agent | null;
    sessionData: any;
    decisionData: any;
  }> {
    const agent =
      await this.agentService.findAgentByVerificationSessionId(sessionId);

    if (!agent) {
      throw new NotFoundException(
        'No agent found with this verification session',
      );
    }

    const [sessionData, decisionData] = await Promise.all([
      this.getSessionData(sessionId),
      this.getDecisionData(sessionId, agent),
    ]);

    const status = this.determineVerificationStatus(sessionData, decisionData);

    await this.updateAgentVerificationStatus(agent.id, status);

    return {
      status,
      agent,
      sessionData,
      decisionData,
    };
  }

  private async getSessionData(sessionId: string): Promise<any> {
    try {
      return await this.veriffService.getSession(sessionId);
    } catch (error) {
      return { error: error.message };
    }
  }

  private async getDecisionData(sessionId: string, agent: Agent): Promise<any> {
    try {
      return await this.veriffService.getVerificationDecision(sessionId);
    } catch (error) {
      // Development mode auto-approval simulation
      if (
        agent?.licenseVerificationStatus === 'pending' &&
        this.configService.get('NODE_ENV') !== 'production'
      ) {
        return {
          verification: {
            status: 'approved',
            id: sessionId,
          },
        };
      }
      return { error: error.message };
    }
  }

  private determineVerificationStatus(
    sessionData: any,
    decisionData: any,
  ): string {
    const status =
      decisionData?.verification?.status ||
      sessionData?.verification?.status ||
      'pending';

    // Auto-approve in non-production environments
    if (
      status === 'submitted' &&
      this.configService.get('NODE_ENV') !== 'production'
    ) {
      return 'approved';
    }

    return status;
  }

  private async updateAgentVerificationStatus(
    agentId: string,
    status: string,
  ): Promise<void> {
    const updates: any = {
      licenseVerificationStatus: status,
    };

    if (status === 'approved') {
      updates.isLicenseVerified = true;
    }

    await this.agentService.updateAgent(agentId, updates);
  }

  async updateVerificationStatus(
    agentId: string,
    status: string,
  ): Promise<void> {
    const agent = await this.agentService.findOneAgent(agentId);

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const updates = {
      licenseVerificationStatus: status,
      ...(status === 'approved' ? { isLicenseVerified: true } : {}),
    };

    await this.agentService.updateAgent(agent.id, updates);
  }

  private generateToken(id: string, email: string, role: string): string {
    return this.jwtService.sign({ id, email, role });
  }

  private generateAuthResponse(entity: Agent): { accessToken: string } {
    return {
      accessToken: this.generateToken(entity.id, entity.email, entity.role),
    };
  }

  private normalizeError(error: any): Error {
    if (error instanceof Error) {
      return error;
    }

    return new BadRequestException(
      error?.message || 'An unknown error occurred',
    );
  }

  parseWorkAreas(workAreas: string | WorkAreaDto[]): WorkAreaDto[] {
    if (typeof workAreas !== 'string') {
      return workAreas;
    }

    try {
      return JSON.parse(workAreas) as WorkAreaDto[];
    } catch (error) {
      throw new BadRequestException('Invalid format for workAreas');
    }
  }

  parseAdditionalAddresses(
    additionalAddresses: string | AdditionalAddressDto[],
  ): AdditionalAddressDto[] {
    if (typeof additionalAddresses !== 'string') {
      return additionalAddresses;
    }

    try {
      return JSON.parse(additionalAddresses) as AdditionalAddressDto[];
    } catch (error) {
      throw new BadRequestException('Invalid format for additionalAddresses');
    }
  }

  parseAgentAvailability(
    agentAvailability: string | AgentAvailabilityDto[],
  ): AgentAvailabilityDto[] {
    if (typeof agentAvailability !== 'string') {
      return agentAvailability;
    }

    try {
      return JSON.parse(agentAvailability) as AgentAvailabilityDto[];
    } catch (error) {
      throw new BadRequestException('Invalid format for agentAvailability');
    }
  }
}
