import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Headers,
  UnauthorizedException,
  Logger,
  NotFoundException,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { VeriffService } from '../veriff/veriff.service';
import { AgentService } from '../agent/agent.service';

import { RegisterAuthDto } from './dto/registerUser-auth.dto';
import { LoginAuthDto } from './dto/loginUser-auth.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { DriverLicenseVerificationDto } from '../agent/dto/agent-verification.dto';
import { DocumentsValidationService } from './documents-validation.service';
import { RequiredFiles } from '../common/types/files.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly veriffService: VeriffService,
    private readonly agentService: AgentService,
    private readonly documentsValidationService: DocumentsValidationService,
  ) {}

  @Post('verify-license')
  async initiateDriverLicenseVerification(
    @Body() verifyDto: DriverLicenseVerificationDto,
  ) {
    this.logger.debug(
      `Initiating driver license verification for agent: ${verifyDto.agentId}`,
    );
    return this.authService.initiateDriverLicenseVerification(verifyDto);
  }

  @Post('register')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'driverLicense', maxCount: 1 },
      { name: 'insurance', maxCount: 1 },
      { name: 'electricCertificate', maxCount: 1 },
    ]),
  )
  async register(
    @Body() registerDto: RegisterAuthDto,
    @UploadedFiles() files: Partial<RequiredFiles>,
  ) {
    this.logger.debug('Processing registration request');
    await this.authService.checkEmailAvailability(registerDto.email);

    this.documentsValidationService.validateRequiredDocuments(files);

    if (
      !files.driverLicense?.[0] ||
      !files.insurance?.[0] ||
      !files.electricCertificate?.[0]
    ) {
      throw new BadRequestException('All documents are required');
    }

    const documentFiles = {
      driverLicense: files.driverLicense[0],
      insurance: files.insurance[0],
      electricCertificate: files.electricCertificate[0],
    };

    this.documentsValidationService.validateFilesSize([
      documentFiles.driverLicense,
      documentFiles.insurance,
      documentFiles.electricCertificate,
    ]);

    if (registerDto.workAreas !== undefined) {
      registerDto.workAreas = this.authService.parseWorkAreas(
        registerDto.workAreas,
      );
    }

    if (registerDto.agentAvailable !== undefined) {
      registerDto.agentAvailable = this.authService.parseAgentAvailability(
        registerDto.agentAvailable,
      );
    }

    if (registerDto.additionalAddresses !== undefined) {
      registerDto.additionalAddresses =
        this.authService.parseAdditionalAddresses(
          registerDto.additionalAddresses,
        );
    }

    return this.authService.registerWithDocuments(registerDto, documentFiles);
  }

  @Post('register/verify')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtpAndRegister(verifyOtpDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginAuthDto) {
    return this.authService.login(loginDto);
  }

  @Post('resend-otp')
  async resendOtp(@Body('mobileNumber') mobileNumber: string) {
    return this.authService.resendOtp(mobileNumber);
  }

  @Get('verification-status/:verificationId')
  async checkVerificationStatus(
    @Param('verificationId') verificationId: string,
  ) {
    this.logger.debug(
      `Checking verification status for session: ${verificationId}`,
    );
    return this.authService.checkVerificationStatus(verificationId);
  }

  @Post('verification-callback')
  async handleVerificationCallback(@Body() body: any, @Headers() headers: any) {
    this.validateWebhookSignature(headers, body);
    this.validateWebhookPayload(body);

    const { verification } = body;
    const agentId = verification.vendorData;
    const status = verification.status;

    await this.authService.updateVerificationStatus(agentId, status);
    return { message: 'Webhook received and processed' };
  }

  @Post('simulate-verification-approval/:sessionId')
  async simulateVerificationApproval(@Param('sessionId') sessionId: string) {
    const agent =
      await this.agentService.findAgentByVerificationSessionId(sessionId);

    if (!agent) {
      throw new NotFoundException(
        'No agent found with this verification session',
      );
    }

    await this.agentService.updateAgent(agent.id, {
      licenseVerificationStatus: 'approved',
      isLicenseVerified: true,
    });

    return {
      success: true,
      message: 'Verification approval simulated',
      agent: agent.id,
      status: 'approved',
    };
  }

  private validateWebhookSignature(headers: any, body: any): void {
    const isValid = this.veriffService.verifyWebhookSignature(
      headers,
      JSON.stringify(body),
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private validateWebhookPayload(body: any): void {
    const { verification } = body;

    if (!verification || !verification.vendorData) {
      throw new UnauthorizedException('Invalid webhook payload');
    }
  }
}
