import { StoredAuth, ExtractedConversation } from '../types';

async function getAuth(): Promise<StoredAuth | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('auth', (result) => {
      resolve(result.auth || null);
    });
  });
}

export async function syncConversations(
  platform: string,
  conversations: ExtractedConversation[]
): Promise<{ results: { platform_conversation_id: string; status: string }[] }> {
  const auth = await getAuth();
  if (!auth) throw new Error('Not authenticated');

  const response = await fetch(`${auth.apiUrl}/api/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify({ platform, conversations }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Sync failed' }));
    throw new Error(err.error || 'Sync failed');
  }

  return response.json();
}

export async function checkConversationExists(
  platform: string,
  platformConversationId: string
): Promise<boolean> {
  const auth = await getAuth();
  if (!auth) return false;

  const response = await fetch(
    `${auth.apiUrl}/api/conversations?platform=${platform}&platform_conversation_id=${platformConversationId}`,
    {
      headers: { Authorization: `Bearer ${auth.token}` },
    }
  );

  if (!response.ok) return false;
  const data = await response.json();
  return Array.isArray(data) && data.length > 0;
}
