import { PlatformExtractor, ExtractedConversation, ExtractedMessage, ExtractedContact } from '../../types';
import { scrollAndWait, sleep } from '../../utils/dom';

/**
 * Carousell DM extractor.
 *
 * Carousell's chat UI is a SPA with obfuscated CSS class names that change
 * on each deploy. This extractor uses structural selectors (role attributes,
 * tag hierarchy, computed styles) rather than class names wherever possible.
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

  /**
   * Find all conversation items in the left sidebar.
   * Carousell renders them as div[role="button"] inside a scrollable list
   * that appears after a "Chats" label.
   */
  getConversationList(): HTMLElement[] {
    const chatListContainer = this.findChatListContainer();
    if (!chatListContainer) return [];

    // Each conversation is a direct child div with role="button"
    const items = chatListContainer.querySelectorAll<HTMLElement>(':scope > div[role="button"]');
    return Array.from(items);
  }

  /**
   * Carousell chat items don't have hrefs — they're div[role="button"] that
   * trigger SPA navigation via JS. We can't extract the ID from the element
   * alone, so we return the index as a placeholder. The real conversation ID
   * is extracted from the URL after clicking.
   */
  extractConversationId(element: HTMLElement): string | null {
    // We'll get the real ID from the URL after opening the conversation.
    // Return a placeholder so full-sync doesn't skip this element.
    return 'pending';
  }

  async openConversation(element: HTMLElement): Promise<void> {
    element.click();
    await sleep(2000); // Wait for conversation to load
  }

  /**
   * Find the scrollable container for the inbox conversation list.
   */
  getInboxScrollContainer(): HTMLElement | null {
    const container = this.findChatListContainer();
    if (!container) return null;
    // The scrollable container might be the list itself or its parent
    if (container.scrollHeight > container.clientHeight) {
      return container;
    }
    // Check parent
    const parent = container.parentElement;
    if (parent && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    return container;
  }

  /**
   * Find the scrollable container for the message area.
   */
  getMessageScrollContainer(): HTMLElement | null {
    const msgContainer = this.findMessageContainer();
    if (!msgContainer) return null;
    // Walk up to find the scrollable parent
    let el: HTMLElement | null = msgContainer;
    for (let i = 0; i < 5; i++) {
      if (!el) break;
      if (el.scrollHeight > el.clientHeight + 10) {
        return el;
      }
      el = el.parentElement;
    }
    return msgContainer;
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
    } catch (err) {
      console.error('[DM Tracker] Error extracting conversation:', err);
      return null;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private getConversationIdFromUrl(): string | null {
    const match = window.location.pathname.match(/\/inbox\/([^/?]+)/);
    return match ? match[1] : null;
  }

  /**
   * Find the chat list container by locating the "Chats" label and then
   * finding its sibling container that holds conversation items.
   */
  private findChatListContainer(): HTMLElement | null {
    // Strategy 1: Find "Chats" text label, then sibling container
    const allPs = document.querySelectorAll('p');
    for (const p of allPs) {
      if (p.textContent?.trim() === 'Chats') {
        const parent = p.parentElement?.parentElement;
        if (parent) {
          // The chat list is a sibling div that contains div[role="button"] items
          const siblings = parent.children;
          for (const sibling of siblings) {
            const buttons = sibling.querySelectorAll('div[role="button"]');
            if (buttons.length > 0) {
              return sibling as HTMLElement;
            }
          }
        }
      }
    }

    // Strategy 2: Find the container with multiple div[role="button"] that look like chat items
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      const roleButtons = div.querySelectorAll(':scope > div[role="button"]');
      if (roleButtons.length >= 3) {
        // Check if these look like chat items (have avatar images and text)
        const firstBtn = roleButtons[0];
        const hasAvatar = firstBtn.querySelector('img[alt="Avatar"]');
        const hasText = firstBtn.querySelectorAll('p').length >= 1;
        if (hasAvatar && hasText) {
          return div as HTMLElement;
        }
      }
    }

    return null;
  }

  /**
   * Find the message container in the right panel.
   * This is the area that contains the contact profile card and messages.
   */
  private findMessageContainer(): HTMLElement | null {
    // Look for the container that has the contact profile card
    // (with review stars, "X years on Carousell" text)
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      const text = div.textContent || '';
      if (text.includes('on Carousell') && div.children.length >= 2) {
        // Check if it also contains message-like children
        const hasMessages = div.querySelectorAll('p').length >= 3;
        if (hasMessages) {
          return div as HTMLElement;
        }
      }
    }
    return null;
  }

  /**
   * Extract contact info from the currently open conversation header.
   */
  private extractContact(): ExtractedContact | null {
    // The contact name appears in the header as a button or <p> element
    // It's the first prominent text after the avatar in the right panel header

    // Strategy 1: Find the header area with "Online X ago" text
    let displayName: string | null = null;
    let username: string | null = null;

    const allPs = document.querySelectorAll('p');
    for (let i = 0; i < allPs.length; i++) {
      const p = allPs[i];
      const text = p.textContent?.trim() || '';
      if (text.startsWith('Online ') || text === 'Online now') {
        // The username is typically in the preceding <p> or button
        const prev = allPs[i - 1];
        if (prev) {
          displayName = prev.textContent?.trim() || null;
          username = displayName;
        }
        break;
      }
    }

    // Strategy 2: If no "Online" found, check the header button with username
    if (!displayName) {
      // Look for a button in the header that has just a username text
      const headerButtons = document.querySelectorAll('button');
      for (const btn of headerButtons) {
        const ps = btn.querySelectorAll('p');
        if (ps.length === 1) {
          const text = ps[0].textContent?.trim() || '';
          // Username-like: no spaces, not too long, not a UI label
          if (text.length > 2 && text.length < 50 && !text.includes(' ') &&
              !['Sell', 'Search', 'Chats', 'Inbox'].includes(text)) {
            // Check if this button is in the right panel area (not in nav)
            const rect = btn.getBoundingClientRect();
            if (rect.left > 500) { // Right panel starts after sidebar
              displayName = text;
              username = text;
              break;
            }
          }
        }
      }
    }

    // Strategy 3: Get from URL path and look for matching text
    if (!displayName) {
      const convId = this.getConversationIdFromUrl();
      if (convId) {
        displayName = convId;
      }
    }

    // Construct profile URL from username
    const profileUrl = username
      ? `https://www.carousell.sg/u/${username}`
      : null;

    // Check for active listing: look for a product link in the header
    const listingLinks = document.querySelectorAll('a[href^="/p/"]');
    const hasActiveListing = listingLinks.length > 0;

    return {
      platform_user_id: username || this.getConversationIdFromUrl() || '',
      username: username || null,
      display_name: displayName || null,
      profile_url: profileUrl,
      has_active_listing: hasActiveListing,
    };
  }

  /**
   * Extract all messages from the currently open conversation.
   */
  private extractMessages(): ExtractedMessage[] {
    const messages: ExtractedMessage[] = [];
    const msgContainer = this.findMessageContainer();
    if (!msgContainer) return messages;

    // Messages are in groups. Each group has:
    // - A date/time header (spans with date and time text)
    // - One or more message bubbles

    // Find all message groups - they are direct children of the message container
    const groups = msgContainer.children;
    let currentDate = '';
    let currentTime = '';
    let msgIndex = 0;

    for (const group of groups) {
      const groupEl = group as HTMLElement;

      // Skip the profile card section (has review stars, "on Carousell" text)
      if (groupEl.textContent?.includes('on Carousell') &&
          groupEl.textContent?.includes('review')) {
        continue;
      }

      // Skip system messages (warnings about scams, etc.)
      if (groupEl.textContent?.includes('interested buyer') ||
          groupEl.textContent?.includes('keep deals safe')) {
        continue;
      }

      // Check for date/time spans
      const spans = groupEl.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent?.trim() || '';
        // Date pattern: DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
          currentDate = text;
        }
        // Time pattern: H:MM AM/PM
        if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(text)) {
          currentTime = text;
        }
      }

      // Find message text within this group
      // Messages are in <p> tags inside bubble containers
      const paragraphs = groupEl.querySelectorAll('p');
      for (const p of paragraphs) {
        const body = p.textContent?.trim();
        if (!body || body.length < 2) continue;

        // Skip if this is a date, time, or UI label
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(body)) continue;
        if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(body)) continue;
        if (body.includes('on Carousell')) continue;
        if (body.includes('interested buyer')) continue;
        if (body.includes('keep deals safe')) continue;

        // Determine sender based on message alignment
        const sender = this.detectSender(p);

        // Parse timestamp
        const sentAt = this.parseTimestamp(currentDate, currentTime);

        messages.push({
          platform_message_id: `msg_${msgIndex++}`,
          sender,
          body,
          sent_at: sentAt,
        });
      }
    }

    return messages;
  }

  /**
   * Detect if a message was sent by the user or the contact.
   * Contact messages have an avatar (flex-start aligned).
   * User messages are right-aligned (flex-end).
   */
  private detectSender(messageEl: HTMLElement): 'user' | 'contact' {
    // Walk up to find the message row container
    let el: HTMLElement | null = messageEl;
    for (let i = 0; i < 6; i++) {
      if (!el) break;

      // Check for avatar in this container - indicates contact message
      const avatar = el.querySelector('img[alt="Avatar"]');
      if (avatar) return 'contact';

      // Check computed style for flex alignment
      const style = window.getComputedStyle(el);
      if (style.justifyContent === 'flex-end') return 'user';
      if (style.justifyContent === 'flex-start' && el.children.length > 1) return 'contact';

      // Check for align-items or margin patterns
      if (style.alignSelf === 'flex-end' || style.marginLeft === 'auto') return 'user';
      if (style.alignSelf === 'flex-start' || style.marginRight === 'auto') return 'contact';

      el = el.parentElement;
    }

    // Default: assume contact message
    return 'contact';
  }

  /**
   * Parse DD/MM/YYYY date and H:MM AM/PM time into ISO string.
   */
  private parseTimestamp(date: string, time: string): string {
    if (!date) return new Date().toISOString();

    try {
      const [day, month, year] = date.split('/').map(Number);

      let hours = 0;
      let minutes = 0;
      if (time) {
        const timeMatch = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeMatch) {
          hours = parseInt(timeMatch[1]);
          minutes = parseInt(timeMatch[2]);
          const ampm = timeMatch[3].toUpperCase();
          if (ampm === 'PM' && hours !== 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        }
      }

      const d = new Date(year, month - 1, day, hours, minutes);
      return d.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}
