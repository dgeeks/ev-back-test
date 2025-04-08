import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, TravelMode } from '@googlemaps/google-maps-services-js';

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);
  private client: Client;

  constructor(private configService: ConfigService) {
    this.client = new Client({});
  }


  async getDistanceMatrix(
    origins: { lat: number; lng: number }[],
    destinations: { lat: number; lng: number }[],
    mode: TravelMode = TravelMode.driving,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('Google Maps API key is missing');
    }
    
    try {
      const response = await this.client.distancematrix({
        params: {
          origins: origins.map((origin) => `${origin.lat},${origin.lng}`),
          destinations: destinations.map(
            (destination) => `${destination.lat},${destination.lng}`,
          ),
          mode: mode,
          key: apiKey,
        },
      });
      
      this.logger.log('Google Maps API response received');
      return response.data;
    } catch (error) {
      this.logger.error('Google Maps API error:', error);
      throw new BadRequestException('Failed to fetch distance matrix');
    }
  }

  async getAddressFromCoordinates(lat: number, lng: number) {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('Google Maps API key is missing');
    }
  
    try {
      const response = await this.client.reverseGeocode({
        params: {
          latlng: `${lat},${lng}`,
          key: apiKey,
        },
      });
  
      if (response.data.results.length === 0) {
        throw new BadRequestException('No address found for the given coordinates');
      }
  
      const address = response.data.results[0].formatted_address;
      this.logger.log(`Address found: ${address}`);
      return address;
    } catch (error) {
      this.logger.error('Google Maps API error:', error);
      throw new BadRequestException('Failed to fetch address from coordinates');
    }
  }
  
}