// Background service worker — relays messages between popup and content script

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SYNC_PROGRESS') {
    // Forward progress updates to popup
    chrome.runtime.sendMessage(message).catch(() => {
      // Popup might be closed — ignore
    });
  }
});
