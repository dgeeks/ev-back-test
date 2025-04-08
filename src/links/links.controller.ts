import { Controller, Get, Param, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { ServicesService } from '../services/services.service';
import { LinkService } from './links.service';
import { Service } from '../services/entities/service.entity';
import { TwilioService } from '../twilio/twilio.service';

@Controller('links')
export class LinksController {
  constructor(
    private readonly linkService: LinkService,
    @Inject(forwardRef(() => ServicesService))
    private readonly servicesService: ServicesService,
    private readonly twilioService: TwilioService,
  ) {}

  @Get(':id')
  async handleLinkClick(@Param('id') linkId: string): Promise<Service> {
    const link = await this.getAndValidateLink(linkId);
    const service = await this.getAndValidateService(link.serviceId);
    const updateData = this.prepareServiceUpdateData(service, link.agentId);
    
    await this.servicesService.update(link.serviceId, updateData);
    const updatedService = await this.servicesService.findOne(link.serviceId);
    
    if (updateData.isJobInProgress) {
      await this.sendSchedulingNotification(service, link.agentId, updateData.scheduledAt);
    }
    
    return updatedService;
  }

  private async getAndValidateLink(linkId: string) {
    const link = await this.linkService.findOne(linkId);
    if (!link) {
      throw new NotFoundException('Link not found.');
    }
    return link;
  }

  private async getAndValidateService(serviceId: string) {
    const service = await this.servicesService.findOne(serviceId);
    if (!service) {
      throw new NotFoundException('Service not found.');
    }
    return service;
  }

  private prepareServiceUpdateData(service: Service, agentId: string) {
    const updateData: any = { agentId };
    
    if (service.userAvailable && service.userAvailable.length === 1) {
      updateData.scheduledAt = service.userAvailable[0].startTime;
      updateData.isJobInProgress = true;
    }
    
    return updateData;
  }

  private async sendSchedulingNotification(service: Service, agentId: string, scheduledAt: string) {
    if (!service.mobileNumber) return;
    
    try {
      const agent = await this.servicesService.findAgent(agentId);
      const { formattedDate, formattedTime } = this.formatScheduleDateTime(scheduledAt);
      const message = `Your service has been scheduled. ${agent.firstName} will arrive on ${formattedDate} at ${formattedTime}.`;
      
      await this.twilioService.sendSms(service.mobileNumber, message);
    } catch (error) {
      console.error('Failed to send notification SMS:', error);
    }
  }

  private formatScheduleDateTime(dateString: string) {
    const scheduledDate = new Date(dateString);
    
    return {
      formattedDate: scheduledDate.toLocaleDateString(),
      formattedTime: scheduledDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  }
}