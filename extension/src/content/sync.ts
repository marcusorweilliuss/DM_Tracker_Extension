import { PlatformExtractor, ExtractedConversation, SyncProgress } from '../types';
import { syncConversations } from '../utils/api';
import { scrollAndWait, sleep } from '../utils/dom';

// Skip these automated/spam accounts
const SKIP_USERNAMES = [
  'carousell_assistant',
  'admin',
  'carousell',
  'carousell_support',
  'carousell_team',
];

function shouldSkipConversation(conversation: ExtractedConversation): boolean {
  // Skip known spam/automated accounts
  const contactName = (conversation.contact.username || conversation.contact.displayName || '').toLowerCase();
  if (SKIP_USERNAMES.some(spam => contactName.includes(spam))) {
    return true;
  }

  if (conversation.messages.length > 0) {
    // Skip conversations where the contact messaged first (ads/spam)
    if (conversation.messages[0].sender === 'contact') {
      return true;
    }

    // Skip conversations that don't mention "refit" in any message from the user
    const hasRefit = conversation.messages.some(msg =>
      msg.sender === 'user' && msg.body.toLowerCase().includes('refit')
    );
    if (!hasRefit) {
      return true;
    }
  }

  return false;
}

/**
 * Full historical sync — scrolls through the entire inbox,
 * opens each conversation, scrolls to load all messages, and syncs.
 */
export async function fullSync(
  extractor: PlatformExtractor,
  onProgress: (progress: SyncProgress) => void
): Promise<void> {
  onProgress({ total: 0, current: 0, status: 'syncing', message: 'Loading conversation list...' });

  // Step 1: Navigate to inbox root first
  if (!extractor.isOnInboxPage() && !window.location.pathname.match(/^\/inbox\/?$/)) {
    window.location.href = '/inbox/';
    await sleep(3000);
  }

  // Step 2: Scroll the inbox to load all conversations
  const inboxContainer = extractor.getInboxScrollContainer();
  if (inboxContainer) {
    let hasMore = true;
    let scrollAttempts = 0;
    while (hasMore && scrollAttempts < 50) {
      hasMore = await scrollAndWait(inboxContainer, 'down', 2000);
      scrollAttempts++;
    }
  }

  // Step 3: Get all conversation elements
  const convElements = extractor.getConversationList();
  const total = convElements.length;

  if (total === 0) {
    onProgress({ total: 0, current: 0, status: 'done', message: 'No conversations found. Make sure you are on the Carousell inbox page.' });
    return;
  }

  onProgress({ total, current: 0, status: 'syncing', message: `Found ${total} conversations` });

  // Step 4: Process each conversation
  const batchSize = 5;
  let batch: ExtractedConversation[] = [];

  for (let i = 0; i < total; i++) {
    onProgress({
      total,
      current: i + 1,
      status: 'syncing',
      message: `Syncing ${i + 1} of ${total} conversations...`,
    });

    // Re-query the conversation list each time because the DOM may have changed
    const currentElements = extractor.getConversationList();
    if (i >= currentElements.length) break;

    const el = currentElements[i];

    // Open the conversation (changes URL to /inbox/{convId}/)
    await extractor.openConversation(el);

    // Wait a bit for messages to load
    await sleep(1000);

    // Scroll up to load full message history
    const msgContainer = extractor.getMessageScrollContainer();
    if (msgContainer) {
      let hasMore = true;
      let scrollAttempts = 0;
      while (hasMore && scrollAttempts < 30) {
        hasMore = await scrollAndWait(msgContainer, 'up', 1500);
        scrollAttempts++;
      }
    }

    // Extract conversation data (ID comes from URL now)
    const conversation = await extractor.extractCurrentConversation();
    if (conversation) {
      if (shouldSkipConversation(conversation)) {
        console.log(`[DM Tracker] Skipping "${conversation.contact.username || conversation.contact.displayName}" (spam/no refit mention)`);
      } else {
        batch.push(conversation);
      }
    }

    // Send batch to backend
    if (batch.length >= batchSize || i === total - 1) {
      if (batch.length > 0) {
        try {
          await syncConversations(extractor.platform, batch);
        } catch (err) {
          console.error('[DM Tracker] Sync batch failed:', err);
        }
        batch = [];
      }
    }

    await sleep(500);
  }

  onProgress({ total, current: total, status: 'done', message: 'Sync complete!' });
}

/**
 * Incremental sync — syncs only the currently open conversation.
 */
export async function syncCurrentConversation(
  extractor: PlatformExtractor
): Promise<{ success: boolean; message: string }> {
  const conversation = await extractor.extractCurrentConversation();
  if (!conversation) {
    return { success: false, message: 'Could not extract conversation data. Make sure a conversation is open.' };
  }

  if (conversation.messages.length === 0) {
    // Still sync the contact info even without messages
    console.warn('[DM Tracker] No messages found, syncing contact info only');
  }

  try {
    const result = await syncConversations(extractor.platform, [conversation]);
    const status = result.results[0]?.status || 'unknown';
    return { success: true, message: `Conversation ${status}` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Sync failed' };
  }
}
