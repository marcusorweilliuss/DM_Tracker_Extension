import { PlatformExtractor, ExtractedConversation, ExtractedMessage, ExtractedContact } from '../../types';
import { waitForElement, scrollAndWait, sleep } from '../../utils/dom';

/**
 * Carousell DM extractor.
 *
 * Carousell's chat UI is a SPA — selectors here are best-effort and may need
 * updating if Carousell ships a redesign. The class names are obfuscated, so
 * we rely on structural selectors and data attributes where possible.
 */
export class CarousellExtractor implements PlatformExtractor {
  platform = 'carousell';

  isOnDMPage(): boolean {
    return window.location.pathname.startsWith('/inbox/');
  }

  isOnInboxPage(): boolean {
    return (
      window.location.pathname === '/inbox' ||
      window.location.pathname === '/inbox/'
    );
  }

  getConversationList(): HTMLElement[] {
    // Carousell renders conversation items inside the left sidebar list
    const items = document.querySelectorAll<HTMLElement>(
      '[data-testid="chat-list-item"], [class*="ChatList"] a, [class*="chatList"] a'
    );
    return Array.from(items);
  }

  extractConversationId(element: HTMLElement): string | null {
    // Try href first (e.g. /inbox/CONV_ID)
    const link = element.closest('a') || element.querySelector('a');
    if (link) {
      const match = link.getAttribute('href')?.match(/\/inbox\/([^/?]+)/);
      if (match) return match[1];
    }
    // Fallback: data attribute
    return element.getAttribute('data-conversation-id') || null;
  }

  async openConversation(element: HTMLElement): Promise<void> {
    element.click();
    await sleep(1500);
  }

  getInboxScrollContainer(): HTMLElement | null {
    // The scrollable conversation list
    return document.querySelector<HTMLElement>(
      '[data-testid="chat-list-container"], [class*="ChatList"], [class*="chatList"]'
    );
  }

  getMessageScrollContainer(): HTMLElement | null {
    // The scrollable message area
    return document.querySelector<HTMLElement>(
      '[data-testid="message-list"], [class*="MessageList"], [class*="messageList"], [class*="chatMessages"]'
    );
  }

  async scrollToLoadMore(container: HTMLElement): Promise<boolean> {
    return scrollAndWait(container, 'down', 2000);
  }

  async extractCurrentConversation(): Promise<ExtractedConversation | null> {
    try {
      const convId = this.getConversationIdFromUrl();
      if (!convId) return null;

      const contact = this.extractContact();
      if (!contact) return null;

      const messages = this.extractMessages();

      return {
        platform_conversation_id: convId,
        contact,
        messages,
      };
    } catch {
      return null;
    }
  }

  private getConversationIdFromUrl(): string | null {
    const match = window.location.pathname.match(/\/inbox\/([^/?]+)/);
    return match ? match[1] : null;
  }

  private extractContact(): ExtractedContact | null {
    // Try to get the contact name from the chat header
    const header = document.querySelector<HTMLElement>(
      '[data-testid="chat-header-name"], [class*="ChatHeader"] [class*="name"], [class*="chatHeader"] a'
    );

    const displayName = header?.textContent?.trim() || null;

    // Try to extract profile URL from the header link
    const profileLink = header?.closest('a') || header?.querySelector('a');
    const profileUrl = profileLink?.getAttribute('href')
      ? `https://www.carousell.sg${profileLink.getAttribute('href')}`
      : null;

    // Extract username from profile URL
    const username = profileUrl?.match(/carousell\.sg\/u\/([^/?]+)/)?.[1] || null;

    // Use conversation ID as fallback for platform_user_id
    const platformUserId = username || this.getConversationIdFromUrl() || '';

    // Check for active listing indicator
    const hasActiveListing = !!document.querySelector(
      '[data-testid="listing-card"], [class*="ListingCard"], [class*="productCard"]'
    );

    return {
      platform_user_id: platformUserId,
      username,
      display_name: displayName,
      profile_url: profileUrl,
      has_active_listing: hasActiveListing,
    };
  }

  private extractMessages(): ExtractedMessage[] {
    const messageElements = document.querySelectorAll<HTMLElement>(
      '[data-testid="message-bubble"], [class*="MessageBubble"], [class*="messageBubble"], [class*="chatMessage"]'
    );

    const messages: ExtractedMessage[] = [];

    messageElements.forEach((el, index) => {
      const body = el.textContent?.trim();
      if (!body) return;

      // Determine sender: Carousell typically right-aligns the logged-in user's messages
      const isUser = this.isUserMessage(el);

      // Try to get timestamp
      const timeEl = el.closest('[data-testid="message-row"]')?.querySelector('time') ||
        el.parentElement?.querySelector('time') ||
        el.querySelector('time');
      const sentAt = timeEl?.getAttribute('datetime') || new Date().toISOString();

      messages.push({
        platform_message_id: `msg_${index}`,
        sender: isUser ? 'user' : 'contact',
        body,
        sent_at: sentAt,
      });
    });

    return messages;
  }

  private isUserMessage(el: HTMLElement): boolean {
    // Common patterns: user messages are right-aligned or have specific classes
    const classes = el.className + (el.parentElement?.className || '');
    if (/right|self|sent|outgoing|mine/i.test(classes)) return true;
    if (/left|other|received|incoming/i.test(classes)) return false;

    // Fallback: check computed style for alignment
    const style = window.getComputedStyle(el.parentElement || el);
    if (style.justifyContent === 'flex-end' || style.alignSelf === 'flex-end') return true;
    if (style.marginLeft === 'auto' || style.textAlign === 'right') return true;

    return false;
  }
}
