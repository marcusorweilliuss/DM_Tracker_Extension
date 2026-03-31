export interface User {
  id: string;
  email: string;
  name: string;
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
  conversations?: Conversation[];
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
  contacts?: Contact;
  users?: User;
  messages?: Message[];
}

export interface Message {
  id: string;
  conversation_id: string;
  platform_message_id: string | null;
  sender: 'user' | 'contact';
  body: string;
  sent_at: string;
}

export type ConversationStatus = 'New' | 'Responded' | 'Following Up' | 'Converted' | 'Not Interested';

export interface AuthState {
  token: string;
  user: User;
}
