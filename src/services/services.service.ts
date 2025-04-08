import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { AgentService } from '../agent/agent.service';
import { Agent } from '../agent/entities/agent.entity';
import { TwilioService } from '../twilio/twilio.service';
import { TravelMode } from '@googlemaps/google-maps-services-js';
import { GoogleMapsService } from '../common/services/google-maps.service';
import { LinkService } from '../links/links.service';
import { WorkAreaDto } from '../common/interfaces/workArea';
import { AdminNotificationService } from '../common/services/adminNotification.service';

interface AgentWithDistance {
  agent: Agent;
  distance: number;
  isDirectDistance: boolean;
  travelDuration?: number;
}

interface Coordinates {
  lat: number;
  lng: number;
}

@Injectable()
export class ServicesService {
  private agentContactMap = new Map<string, AgentWithDistance[]>();
  private readonly logger = new Logger(ServicesService.name);
  private readonly EARTH_RADIUS_MILES = 3958.8;
  private readonly BASE_URL = 'https://evconnect.vercel.app/';
  private readonly DEFAULT_EXPIRATION_MINUTES = 2;

  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly agentService: AgentService,
    private readonly googleMapsService: GoogleMapsService,
    private readonly linkService: LinkService,
    private readonly twilioService: TwilioService,
    private readonly adminNotificationService: AdminNotificationService,
  ) {}

  async create(createServiceDto: CreateServiceDto): Promise<Service> {
    const service = this.serviceRepository.create(createServiceDto);
    const savedService = await this.serviceRepository.save(service);

    if (this.hasValidCoordinates(savedService)) {
      await this.findAndNotifyNearestAgent(savedService);
    }

    return savedService;
  }

  async findAll(): Promise<Service[]> {
    return await this.serviceRepository.find();
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.serviceRepository.findOne({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Service with id ${id} not found`);
    }

    return service;
  }

  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
  ): Promise<Service> {
    const service = await this.findOne(id);

    const isBeingScheduled =
      updateServiceDto.isJobInProgress === true &&
      updateServiceDto.scheduledAt &&
      !service.isJobInProgress;

    Object.assign(service, updateServiceDto);
    const updatedService = await this.serviceRepository.save(service);

    if (
      isBeingScheduled &&
      service.mobileNumber &&
      service.agentId &&
      updateServiceDto.scheduledAt
    ) {
      try {
        const agent = await this.findAgent(service.agentId);

        const scheduledDate = new Date(updateServiceDto.scheduledAt);
        const formattedDate = scheduledDate.toLocaleDateString();
        const formattedTime = scheduledDate.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        const message = `Your service has been scheduled.
         ${agent.firstName} will arrive on ${formattedDate} at ${formattedTime}.`;

        await this.twilioService.sendSms(service.mobileNumber, message);
      } catch (error) {
        console.error('Failed to send notification SMS:', error);
      }
    }

    return updatedService;
  }
  async remove(id: string): Promise<void> {
    const service = await this.findOne(id);
    await this.serviceRepository.remove(service);
  }

  async findAgent(agentId: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
    });
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }
    return agent;
  }

  async findServicesByAgentId(agentId: string): Promise<Service[]> {
    if (!agentId) {
      throw new BadRequestException('Agent ID is required');
    }

    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    const services = await this.serviceRepository
      .createQueryBuilder('service')
      .where('service.agentId = :agentId', { agentId })
      .getMany();

    return services;
  }
  async assignNearestAgentToService(serviceId: string): Promise<boolean> {
    try {
      const service = await this.findOne(serviceId);

      if (!this.hasValidCoordinates(service)) {
        throw new Error(
          `Service ${serviceId} has no valid location coordinates`,
        );
      }

      await this.findAndNotifyNearestAgent(service);
      return true;
    } catch (error) {
      this.logger.error(
        `Error assigning agent to service ${serviceId}: ${error.message}`,
      );
      throw new Error(
        `Error assigning agent to service ${serviceId}: ${error.message}`,
      );
    }
  }

  private async findAndNotifyNearestAgent(service: Service): Promise<void> {
    try {
      if (!this.hasValidCoordinates(service)) {
        throw new Error(`Service ${service.id} has invalid coordinates`);
      }
  
      const allAgents = await this.agentService.findAllAgents();
      if (allAgents.length === 0) {
        throw new Error(`No agents registered for service ${service.id}`);
      }
  
      const validAgents = this.filterValidAgents(allAgents);
      if (validAgents.length === 0) {
        throw new Error(
          `No agents with valid coordinates for service ${service.id}`,
        );
      }
  
      const serviceLocation = this.extractCoordinates(service);
  
      let serviceAddress = 'Unknown location';
      try {
        serviceAddress = await this.googleMapsService.getAddressFromCoordinates(
          serviceLocation.lat,
          serviceLocation.lng,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to get address for service ${service.id}: ${error.message}`,
        );
      }
  
      const agentsInWorkArea = this.filterAgentsByWorkArea(
        validAgents,
        serviceLocation,
      );
  
      if (agentsInWorkArea.length === 0) {
        await this.adminNotificationService.notifyAdmin({
          type: 'NO_AGENTS_IN_WORK_AREA',
          message: `No available agents found in ${service.city} for the ${service.type.toLowerCase()} service requested by ${service.firstName}. The service is located at: ${serviceAddress}.`,
          context: {
            serviceId: service.id,
            serviceLocation,
            serviceAddress,
          },
        });
  
        this.logger.warn(
          `No agents found in work area for service ${service.id}, falling back to all valid agents`,
        );
  
        // IMPORTANT: Continue with processing agents
        return this.processAgentsForContact(
          service.id,
          await this.calculateAgentDistances(
            serviceLocation,
            validAgents,
            service,
          ),
        );
      }
  
      // Add similar processing for agents in work area
      return this.processAgentsForContact(
        service.id,
        await this.calculateAgentDistances(
          serviceLocation,
          agentsInWorkArea,
          service,
        ),
      );
    } catch (error) {
      // Error handling remains the same
      this.logger.error(`Error finding nearest agent: ${error.message}`);
  
      await this.adminNotificationService.notifyAdmin({
        type: 'AGENT_ASSIGNMENT_ERROR',
        message: `Error finding nearest agent for service ${service.id}: ${error.message}`,
        context: {
          serviceId: service.id,
          errorMessage: error.message,
        },
      });
  
      throw error;
    }
  }
  private filterAgentsByWorkArea(
    agents: Agent[],
    serviceLocation: Coordinates,
  ): Agent[] {
    return agents.filter((agent) => {
      if (!agent.workAreas || agent.workAreas.length === 0) {
        return false;
      }

      return agent.workAreas.some((workArea) => {
        switch (workArea.type) {
          case 'circle':
            return this.checkCircularWorkArea(workArea, serviceLocation);
          case 'polygon':
            return this.checkPolygonWorkArea(workArea, serviceLocation);
          default:
            this.logger.warn(`Unsupported work area type: ${workArea.type}`);
            return false;
        }
      });
    });
  }

  private checkCircularWorkArea(
    workArea: WorkAreaDto,
    serviceLocation: Coordinates,
  ): boolean {
    if (!workArea.center || !workArea.radius) {
      this.logger.warn(`Invalid circular work area: missing center or radius`);
      return false;
    }

    if (!this.isValidCoordinate(workArea.center.lat, workArea.center.lng)) {
      this.logger.warn(`Invalid work area center coordinates`);
      return false;
    }

    const distance = this.calculateDirectDistance(
      serviceLocation.lat,
      serviceLocation.lng,
      workArea.center.lat,
      workArea.center.lng,
    );

    const radiusMiles = (workArea.radius || 0) / 1609.344;

    return distance <= radiusMiles;
  }

  private checkPolygonWorkArea(
    workArea: WorkAreaDto,
    serviceLocation: Coordinates,
  ): boolean {
    if (!workArea.coordinates || workArea.coordinates.length < 3) {
      this.logger.warn('Polygon work area requires at least 3 coordinates');
      return false;
    }

    const validCoordinates = workArea.coordinates.every((coord) =>
      this.isValidCoordinate(coord.lat, coord.lng),
    );

    if (!validCoordinates) {
      this.logger.warn('Invalid polygon work area coordinates');
      return false;
    }

    return this.pointInPolygon(serviceLocation, workArea.coordinates);
  }

  private pointInPolygon(
    point: Coordinates,
    polygonCoords: Coordinates[],
  ): boolean {
    let inside = false;
    const x = point.lng;
    const y = point.lat;

    for (
      let i = 0, j = polygonCoords.length - 1;
      i < polygonCoords.length;
      j = i++
    ) {
      const xi = polygonCoords[i].lng,
        yi = polygonCoords[i].lat;
      const xj = polygonCoords[j].lng,
        yj = polygonCoords[j].lat;

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  private async calculateAgentDistances(
    serviceLocation: Coordinates,
    validAgents: Agent[],
    service: Service,
  ): Promise<AgentWithDistance[]> {
    try {
      return await this.getAgentsWithGoogleMapsDistance(
        serviceLocation,
        validAgents,
        service,
      );
    } catch (error) {
      this.logger.warn(
        `Google Maps API failed: ${error.message}. Falling back to direct distance.`,
      );
      return this.getAgentsWithDirectDistance(serviceLocation, validAgents);
    }
  }

  private async processAgentsForContact(
    serviceId: string,
    agentsWithDistance: AgentWithDistance[],
  ): Promise<void> {
    const sortedAgents = agentsWithDistance.sort(
      (a, b) => a.distance - b.distance,
    );

    if (sortedAgents.length > 0) {
      if (sortedAgents[0].isDirectDistance) {
        this.logger.log(
          `Using direct distance calculation for ${serviceId}. Nearest agent is ${sortedAgents[0].distance.toFixed(2)} miles away.`,
        );
      }
      this.agentContactMap.set(serviceId, sortedAgents);
      await this.contactNextAgent(serviceId, 0);
    } else {
      throw new Error(`No valid agents found for service ${serviceId}`);
    }
  }

  private async getAgentsWithGoogleMapsDistance(
    serviceLocation: Coordinates,
    validAgents: Agent[],
    service: Service,
  ): Promise<AgentWithDistance[]> {
    const origins = [serviceLocation];
    const destinations = validAgents.map((agent) =>
      this.extractCoordinates(agent),
    );

    const distanceMatrix = await this.googleMapsService.getDistanceMatrix(
      origins,
      destinations,
      TravelMode.driving,
    );

    this.logger.log(
      'Distance Matrix Response: ' + JSON.stringify(distanceMatrix, null, 2),
    );

    if (distanceMatrix.status !== 'OK') {
      throw new Error(`Google Maps API error: ${distanceMatrix.status}`);
    }

    return validAgents.map((agent, index) => {
      const element = distanceMatrix.rows[0].elements[index];

      if (
        !element ||
        element.status !== 'OK' ||
        !element.distance ||
        !element.duration
      ) {
        this.logger.warn(
          `No distance calculated for agent ${agent.id}. Status: ${element?.status}`,
        );

        const directDistance = this.calculateDirectDistance(
          Number(service.latitude),
          Number(service.longitude),
          Number(agent.latitude),
          Number(agent.longitude),
        );

        return {
          agent,
          distance: directDistance,
          travelDuration: undefined,
          isDirectDistance: true,
        };
      }

      const distanceInMeters = element.distance.value;
      const distanceInMiles = distanceInMeters * 0.000621371;

      return {
        agent,
        distance: distanceInMiles,
        travelDuration: element.duration.value,
        isDirectDistance: false,
      };
    });
  }

  private getAgentsWithDirectDistance(
    serviceLocation: Coordinates,
    validAgents: Agent[],
  ): AgentWithDistance[] {
    return validAgents.map((agent) => {
      const directDistance = this.calculateDirectDistance(
        serviceLocation.lat,
        serviceLocation.lng,
        Number(agent.latitude),
        Number(agent.longitude),
      );

      return {
        agent,
        distance: directDistance,
        isDirectDistance: true,
      };
    });
  }

  private async contactNextAgent(
    serviceId: string,
    agentIndex: number,
  ): Promise<void> {
    const agentsList = this.agentContactMap.get(serviceId);
    if (!agentsList || agentIndex >= agentsList.length) {
      this.logger.warn(`No more agents available for service ${serviceId}`);
      return;
    }

    try {
      const service = await this.findOne(serviceId);
      if (service.agentId) {
        this.logger.log(
          `Service ${serviceId} already has agent ${service.agentId} assigned`,
        );
        this.agentContactMap.delete(serviceId);
        return;
      }

      const { agent, distance, travelDuration } = agentsList[agentIndex];

      const serviceLocation = this.extractCoordinates(service);

      const origins = [serviceLocation];
      const destinations = [this.extractCoordinates(agent)];

      try {
        const distanceMatrix = await this.googleMapsService.getDistanceMatrix(
          origins,
          destinations,
          TravelMode.driving,
        );

        const element = distanceMatrix.rows[0].elements[0];

        if (element.status === 'OK') {
          const preciseMiles = element.distance.value * 0.000621371;
          const preciseTravelTime = element.duration.value;

          const MAX_REASONABLE_DISTANCE = 50;
          const MAX_TRAVEL_TIME = 3600;

          if (
            preciseMiles > MAX_REASONABLE_DISTANCE ||
            preciseTravelTime > MAX_TRAVEL_TIME
          ) {
            this.logger.warn(
              `Agent ${agent.id} too far or long travel time. Distance: ${preciseMiles.toFixed(2)} miles, Travel Time: ${(preciseTravelTime / 60).toFixed(2)} minutes`,
            );
            await this.contactNextAgent(serviceId, agentIndex + 1);
            return;
          }

          const isInWorkArea = this.isAgentInWorkArea(agent, serviceLocation);

          if (!isInWorkArea) {
            const workAreaFlexibility = this.calculateWorkAreaFlexibility(
              agent,
              serviceLocation,
              preciseMiles,
              preciseTravelTime,
            );

            if (workAreaFlexibility < 0.5) {
              this.logger.warn(
                `Agent ${agent.id} outside work area. Flexibility too low.`,
              );
              await this.contactNextAgent(serviceId, agentIndex + 1);
              return;
            }
          }
        } else {
          this.logger.warn(
            `Google Maps API returned status: ${element.status}`,
          );
          await this.contactNextAgent(serviceId, agentIndex + 1);
          return;
        }
      } catch (googleMapsError) {
        this.logger.error(`Google Maps API error: ${googleMapsError.message}`);
        if (distance > 50) {
          await this.contactNextAgent(serviceId, agentIndex + 1);
          return;
        }
      }

      if (!agent.mobileNumber) {
        this.logger.warn(
          `Agent ${agent.id} has no mobile number, trying next agent`,
        );
        await this.contactNextAgent(serviceId, agentIndex + 1);
        return;
      }

      await this.sendServiceRequestLink(
        serviceId,
        agent,
        distance,
        false,
        travelDuration,
        agentIndex,
      );
    } catch (error) {
      this.logger.error(`Error contacting agent: ${error.message}`);
      await this.contactNextAgent(serviceId, agentIndex + 1);
    }
  }

  private calculateWorkAreaFlexibility(
    agent: Agent,
    serviceLocation: Coordinates,
    preciseMiles: number,
    preciseTravelTime: number,
  ): number {
    let flexibilityScore = 1.0;

    const distanceFlexibilityFactor = Math.max(0, 1 - preciseMiles / 50);

    const travelTimeFactor = Math.max(0, 1 - preciseTravelTime / 3600);

    const workAreaTypeFactor = agent.workAreas?.some(
      (area) => area.type === 'polygon',
    )
      ? 0.8
      : 1.0;

    flexibilityScore *=
      distanceFlexibilityFactor * travelTimeFactor * workAreaTypeFactor;

    this.logger.log(
      `Flexibility for agent ${agent.id}: 
      Distance: ${preciseMiles.toFixed(2)} miles, 
      Travel Time: ${(preciseTravelTime / 60).toFixed(2)} minutes, 
      Flexibility Score: ${flexibilityScore.toFixed(2)}`,
    );

    return flexibilityScore;
  }

  private isAgentInWorkArea(
    agent: Agent,
    serviceLocation: Coordinates,
  ): boolean {
    if (!agent.workAreas || agent.workAreas.length === 0) {
      return false;
    }

    return agent.workAreas.some((workArea) => {
      switch (workArea.type) {
        case 'circle':
          return this.checkCircularWorkArea(workArea, serviceLocation);
        case 'polygon':
          return this.checkPolygonWorkArea(workArea, serviceLocation);
        default:
          this.logger.warn(`Unsupported work area type: ${workArea.type}`);
          return false;
      }
    });
  }

  private async sendServiceRequestLink(
    serviceId: string,
    agent: Agent,
    distance: number,
    isDirectDistance: boolean,
    travelDuration: number | undefined,
    agentIndex: number,
  ): Promise<void> {
    const expirationMinutes = this.DEFAULT_EXPIRATION_MINUTES;
    const link = await this.linkService.createLink(
      agent.id,
      serviceId,
      expirationMinutes,
    );
    const linkUrl = `${this.BASE_URL}link/${link.id}`;

    const message = this.createNotificationMessage(
      distance,
      isDirectDistance,
      linkUrl,
      expirationMinutes,
      travelDuration,
    );

    await this.twilioService.sendSms(agent.mobileNumber, message);
    this.logger.log(
      `SMS sent to agent ${agent.firstName} for service ${serviceId} with ${expirationMinutes} minute expiration`,
    );

    this.scheduleAgentResponseCheck(
      link.id,
      serviceId,
      agent,
      agentIndex,
      expirationMinutes,
    );
  }

  private createNotificationMessage(
    distance: number,
    isDirectDistance: boolean,
    linkUrl: string,
    expirationMinutes: number,
    travelDuration?: number,
  ): string {
    let messagePrefix = `You have a nearby service request (${distance.toFixed(2)} miles away)`;

    if (isDirectDistance) {
      messagePrefix = `You have a service request (approx. ${distance.toFixed(2)} miles away as the crow flies)`;
    }

    const travelTimeInfo = travelDuration
      ? `. Estimated travel time: ${this.formatTravelTime(travelDuration)}`
      : '';

    return `${messagePrefix}${travelTimeInfo}. Click the link to accept: ${linkUrl}. Link expires in ${expirationMinutes} minutes.`;
  }

  private formatTravelTime(durationInSeconds: number): string {
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`;
    }
    return `${minutes} min`;
  }
  private scheduleAgentResponseCheck(
    linkId: string,
    serviceId: string,
    agent: Agent,
    agentIndex: number,
    expirationMinutes: number,
  ): void {
    setTimeout(
      async () => {
        try {
          const updatedLink = await this.linkService.findOne(linkId);
          const updatedService = await this.findOne(serviceId);

          if (updatedService.agentId) {
            this.logger.log(
              `Service ${serviceId} already assigned to an agent`,
            );
            return;
          }

          if (updatedLink.clickedAt) {
            await this.assignServiceToAgent(serviceId, agent);
          } else {
            this.logger.log(
              `Agent ${agent.id} did not respond within ${expirationMinutes} minutes, trying next agent`,
            );
            await this.contactNextAgent(serviceId, agentIndex + 1);
          }
        } catch (error) {
          this.logger.error(`Error checking agent response: ${error.message}`);
          await this.contactNextAgent(serviceId, agentIndex + 1);
        }
      },
      expirationMinutes * 60 * 1000,
    );
  }

  private async assignServiceToAgent(
    serviceId: string,
    agent: Agent,
  ): Promise<void> {
    await this.update(serviceId, { agentId: agent.id });
    this.logger.log(`Agent ${agent.id} accepted service ${serviceId}`);

    await this.twilioService.sendSms(
      agent.mobileNumber,
      `You have successfully accepted service #${serviceId}.`,
    );

    this.agentContactMap.delete(serviceId);
  }

  private calculateDirectDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_MILES * c;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  private isValidCoordinate(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  private hasValidCoordinates(entity: Service | Agent): boolean {
    return !!(
      entity.latitude &&
      entity.longitude &&
      !isNaN(Number(entity.latitude)) &&
      !isNaN(Number(entity.longitude)) &&
      this.isValidCoordinate(Number(entity.latitude), Number(entity.longitude))
    );
  }

  private extractCoordinates(entity: Service | Agent): Coordinates {
    return {
      lat: Number(entity.latitude),
      lng: Number(entity.longitude),
    };
  }

  private filterValidAgents(agents: Agent[]): Agent[] {
    return agents.filter(
      (agent) =>
        agent.latitude &&
        agent.longitude &&
        agent.mobileNumber &&
        !isNaN(Number(agent.latitude)) &&
        !isNaN(Number(agent.longitude)) &&
        this.isValidCoordinate(Number(agent.latitude), Number(agent.longitude)),
    );
  }
}
