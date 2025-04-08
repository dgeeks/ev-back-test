import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class VeriffService {
  private readonly apiKey: string;
  private readonly secret: string;
  private readonly baseUrl: string;
  private readonly callbackUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get('VERIFF_API_KEY') ?? '';
    this.secret = this.configService.get('VERIFF_SECRET') ?? '';
    this.baseUrl = this.configService.get('VERIFF_BASE_URL') ?? '';
    this.callbackUrl = `${this.configService.get('API_URL')}/auth/verification-callback`;
  }

  private generateSignature(payload: any): string {
    const payloadString = typeof payload === 'string'
      ? payload
      : JSON.stringify(payload);
   
    return crypto
      .createHmac('sha256', this.secret)
      .update(payloadString)
      .digest('hex');
  }

  async createDriverLicenseVerificationSession(
    vendorData: string,
    country: string,
    state?: string,
  ) {
    try {
      const payload = {
        verification: {
          callback: this.callbackUrl,
          person: {
            firstName: "",
            lastName: "",
          },
          document: {
            type: "DRIVERS_LICENSE",
            country: country,
          },
          vendorData: vendorData,
        }
      };
     
      if (country === 'US' && state) {
        payload.verification.document['state'] = state;
      }
     
      const signature = this.generateSignature(payload);
     
      const headers = {
        'X-AUTH-CLIENT': this.apiKey,
        'X-HMAC-SIGNATURE': signature,
        'Content-Type': 'application/json',
      };
      
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/v1/sessions`, payload, { headers }),
      );
     
      const sessionId = response.data.verification?.id;
      
      return {
        sessionId: sessionId,
        verificationUrl: response.data.verification?.url,
        status: response.data.status,
        rawResponse: response.data
      };
    } catch (error) {
      throw new Error(`Error creating verification session: ${error.message}`);
    }
  }

  async getVerificationDecision(sessionId: string) {
    try {
      const payload = {};
      const signature = this.generateSignature(payload);
     
      const headers = {
        'X-AUTH-CLIENT': this.apiKey,
        'X-HMAC-SIGNATURE': signature,
        'Content-Type': 'application/json',
      };
     
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/v1/sessions/${sessionId}/decision`, { headers }),
      );
     
      return response.data;
    } catch (error) {
      throw new Error(`Error getting decision: ${error.message}`);
    }
  }
  
  async getSession(sessionId: string) {
    try {
      const payload = {};
      const signature = this.generateSignature(payload);
     
      const headers = {
        'X-AUTH-CLIENT': this.apiKey,
        'X-HMAC-SIGNATURE': signature,
        'Content-Type': 'application/json',
      };
     
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/v1/sessions/${sessionId}`, { headers }),
      );
     
      return response.data;
    } catch (error) {
      throw new Error(`Error getting session info: ${error.message}`);
    }
  }

  verifyWebhookSignature(headers: any, body: string): boolean {
    try {
      const receivedSignature = headers['x-hmac-signature'];
      if (!receivedSignature) {
        return false;
      }
     
      const calculatedSignature = this.generateSignature(body);
      
      return receivedSignature === calculatedSignature;
    } catch (error) {
      return false;
    }
  }
}