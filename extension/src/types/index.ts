export interface ExtractedContact {
  platform_user_id: string;
  username: string | null;
  display_name: string | null;
  profile_url: string | null;
  has_active_listing: boolean;
}

export interface ExtractedMessage {
  platform_message_id: string | null;
  sender: 'user' | 'contact';
  body: string;
  sent_at: string;
}

export interface ExtractedConversation {
  platform_conversation_id: string;
  contact: ExtractedContact;
  messages: ExtractedMessage[];
}

export interface PlatformExtractor {
  platform: string;
  isOnDMPage(): boolean;
  isOnInboxPage(): boolean;
  getConversationList(): HTMLElement[];
  extractConversationId(element: HTMLElement): string | null;
  openConversation(element: HTMLElement): Promise<void>;
  extractCurrentConversation(): Promise<ExtractedConversation | null>;
  scrollToLoadMore(container: HTMLElement): Promise<boolean>;
  getInboxScrollContainer(): HTMLElement | null;
  getMessageScrollContainer(): HTMLElement | null;
}

export interface SyncProgress {
  total: number;
  current: number;
  status: 'idle' | 'syncing' | 'done' | 'error';
  message: string;
}

export interface StoredAuth {
  token: string;
  user: { id: string; email: string; name: string };
  apiUrl: string;
}
