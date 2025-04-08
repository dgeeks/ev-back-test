import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AgentService } from './agent.service';
import { UpdateLocationDto } from './dto/update-location.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly agentService: AgentService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('updateLocation')
  async handleUpdateLocation(
    @MessageBody() data: UpdateLocationDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { agentId, latitude, longitude } = data;

      const agent = await this.agentService.updateAgentLatitudeAndLongitude(
        agentId,
        {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          latitude,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          longitude,
        },
      );

      this.server.emit('locationUpdated', agent);
      client.emit('locationUpdateSuccess', {
        message: 'Location updated successfully',
        agent,
      });

      return { success: true, agent };
    } catch (error) {
      console.error('Error updating location:', error);

      client.emit('locationUpdateError', {
        message: 'Failed to update location',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        error: error.message,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      return { success: false, error: error.message };
    }
  }
}
