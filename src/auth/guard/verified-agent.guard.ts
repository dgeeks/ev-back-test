import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AgentService } from '../../agent/agent.service';

@Injectable()
export class OtpVerificationGuard implements CanActivate {
  constructor(private readonly agentService: AgentService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { mobileNumber, otp } = request.body;

    if (!mobileNumber || !otp) {
      throw new UnauthorizedException('Mobile number and OTP are required');
    }

    const pendingAgent =
      await this.agentService.findAgentByMobileNumber(mobileNumber);

    if (!pendingAgent) {
      throw new UnauthorizedException(
        'No registration found for this mobile number',
      );
    }

    if (pendingAgent.isVerified) {
      throw new UnauthorizedException('This account is already verified');
    }

    

    return true;
  }
}
