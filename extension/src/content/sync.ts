import { PlatformExtractor, ExtractedConversation, SyncProgress } from '../types';
import { syncConversations } from '../utils/api';
import { scrollAndWait, sleep } from '../utils/dom';

/**
 * Full historical sync — scrolls through the entire inbox,
 * opens each conversation, scrolls to load all messages, and syncs.
 */
export async function fullSync(
  extractor: PlatformExtractor,
  onProgress: (progress: SyncProgress) => void
): Promise<void> {
  onProgress({ total: 0, current: 0, status: 'syncing', message: 'Loading conversation list...' });

  // Step 1: Scroll the inbox to load all conversations
  const inboxContainer = extractor.getInboxScrollContainer();
  if (inboxContainer) {
    let hasMore = true;
    while (hasMore) {
      hasMore = await scrollAndWait(inboxContainer, 'down', 2000);
    }
  }

  // Step 2: Get all conversation elements
  const convElements = extractor.getConversationList();
  const total = convElements.length;

  onProgress({ total, current: 0, status: 'syncing', message: `Found ${total} conversations` });

  // Step 3: Process each conversation
  const batchSize = 5;
  let batch: ExtractedConversation[] = [];

  for (let i = 0; i < convElements.length; i++) {
    const el = convElements[i];
    const convId = extractor.extractConversationId(el);

    onProgress({
      total,
      current: i + 1,
      status: 'syncing',
      message: `Syncing ${i + 1} of ${total} conversations...`,
    });

    if (!convId) continue;

    // Open the conversation
    await extractor.openConversation(el);

    // Scroll up to load full message history
    const msgContainer = extractor.getMessageScrollContainer();
    if (msgContainer) {
      let hasMore = true;
      while (hasMore) {
        hasMore = await scrollAndWait(msgContainer, 'up', 1500);
      }
    }

    // Extract conversation data
    const conversation = await extractor.extractCurrentConversation();
    if (conversation) {
      batch.push(conversation);
    }

    // Send batch to backend
    if (batch.length >= batchSize || i === convElements.length - 1) {
      if (batch.length > 0) {
        try {
          await syncConversations(extractor.platform, batch);
        } catch (err) {
          console.error('Sync batch failed:', err);
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
    return { success: false, message: 'Could not extract conversation data' };
  }

  try {
    const result = await syncConversations(extractor.platform, [conversation]);
    const status = result.results[0]?.status || 'unknown';
    return { success: true, message: `Conversation ${status}` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Sync failed' };
  }
}
