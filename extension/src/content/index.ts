import { getExtractorForCurrentSite } from './platforms';
import { syncCurrentConversation, fullSync } from './sync';
import { SyncProgress } from '../types';

const extractor = getExtractorForCurrentSite();

if (extractor) {
  // Inject "Sync this conversation" button when on a DM page
  if (extractor.isOnDMPage()) {
    injectSyncButton();
  }

  // Watch for SPA navigation
  const observer = new MutationObserver(() => {
    if (extractor.isOnDMPage() && !document.getElementById('dm-tracker-sync-btn')) {
      injectSyncButton();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'FULL_SYNC') {
      fullSync(extractor, (progress: SyncProgress) => {
        chrome.runtime.sendMessage({ type: 'SYNC_PROGRESS', progress });
      }).then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // keep channel open for async response
    }

    if (message.type === 'SYNC_CURRENT') {
      syncCurrentConversation(extractor)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, message: err.message }));
      return true;
    }
  });
}

function injectSyncButton(): void {
  if (document.getElementById('dm-tracker-sync-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'dm-tracker-sync-btn';
  btn.textContent = 'Sync this conversation';
  btn.addEventListener('click', async () => {
    if (!extractor) return;
    btn.disabled = true;
    btn.textContent = 'Syncing...';

    const result = await syncCurrentConversation(extractor);
    btn.textContent = result.success ? 'Synced!' : 'Failed';
    btn.disabled = false;

    setTimeout(() => {
      btn.textContent = 'Sync this conversation';
    }, 3000);
  });

  // Insert at top of page
  document.body.appendChild(btn);
}
