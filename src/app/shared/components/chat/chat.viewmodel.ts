import { MessageType } from 'src/app/shared/generated';

export interface ChatMessage {
  creationDate: Date;
  id: string;
  type: MessageType;
  text: string;
  userName: string;
  userNameKey?: string;
  isLoadingInfo?: boolean;
  isFailed?: boolean;
}
