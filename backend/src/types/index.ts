export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
}

export interface Contact {
  id: string;
  platform: string;
  platform_user_id: string;
  username: string | null;
  display_name: string | null;
  profile_url: string | null;
  has_active_listing: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  platform: string;
  platform_conversation_id: string;
  contact_id: string;
  logged_by: string;
  summary: string | null;
  status: ConversationStatus;
  last_message_at: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  platform_message_id: string | null;
  sender: 'user' | 'contact';
  body: string;
  sent_at: string;
  created_at: string;
}

export type ConversationStatus = 'New' | 'Leave it' | 'To Follow Up' | 'Converted' | 'Other';

// API request/response types

export interface SyncPayload {
  platform: string;
  conversations: SyncConversation[];
}

export interface SyncConversation {
  platform_conversation_id: string;
  contact: {
    platform_user_id: string;
    username: string | null;
    display_name: string | null;
    profile_url: string | null;
    has_active_listing: boolean;
  };
  messages: {
    platform_message_id: string | null;
    sender: 'user' | 'contact';
    body: string;
    sent_at: string;
  }[];
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends AuthRequest {
  name: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
}
