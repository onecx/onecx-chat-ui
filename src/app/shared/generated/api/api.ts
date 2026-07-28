export * from './agent.service';
import { AgentService } from './agent.service';
export * from './chats.service';
import { ChatsService } from './chats.service';
export * from './participants.service';
import { ParticipantsService } from './participants.service';
export const APIS = [AgentService, ChatsService, ParticipantsService];
