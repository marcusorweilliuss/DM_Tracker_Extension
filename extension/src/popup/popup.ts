import { StoredAuth, SyncProgress } from '../types';

const loginSection = document.getElementById('login-section')!;
const loggedInSection = document.getElementById('logged-in-section')!;
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
const fullSyncBtn = document.getElementById('full-sync-btn') as HTMLButtonElement;
const syncCurrentBtn = document.getElementById('sync-current-btn') as HTMLButtonElement;
const loginError = document.getElementById('login-error')!;
const userName = document.getElementById('user-name')!;
const progressSection = document.getElementById('progress-section')!;
const progressFill = document.getElementById('progress-fill')!;
const progressText = document.getElementById('progress-text')!;
const apiUrlInput = document.getElementById('api-url') as HTMLInputElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;

// Check stored auth on load
chrome.storage.local.get('auth', (result) => {
  if (result.auth) {
    showLoggedIn(result.auth);
  }
});

// Login
loginBtn.addEventListener('click', async () => {
  const apiUrl = apiUrlInput.value.trim().replace(/\/$/, '');
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!apiUrl || !email || !password) {
    loginError.textContent = 'All fields are required';
    return;
  }

  loginBtn.disabled = true;
  loginError.textContent = '';

  try {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    const auth: StoredAuth = {
      token: data.token,
      user: data.user,
      apiUrl,
    };

    chrome.storage.local.set({ auth }, () => {
      showLoggedIn(auth);
    });
  } catch (err: any) {
    loginError.textContent = err.message;
  } finally {
    loginBtn.disabled = false;
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  chrome.storage.local.remove('auth', () => {
    loginSection.style.display = '';
    loggedInSection.style.display = 'none';
    progressSection.style.display = 'none';
  });
});

// Full sync
fullSyncBtn.addEventListener('click', async () => {
  fullSyncBtn.disabled = true;
  progressSection.style.display = '';
  progressFill.style.width = '0%';
  progressText.textContent = 'Starting sync...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    progressText.textContent = 'No active tab found';
    fullSyncBtn.disabled = false;
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: 'FULL_SYNC' }, (response) => {
    if (chrome.runtime.lastError) {
      progressText.textContent = 'Error: Make sure you are on a Carousell DM page';
      fullSyncBtn.disabled = false;
      return;
    }
    if (!response?.success) {
      progressText.textContent = `Error: ${response?.error || 'Sync failed'}`;
    }
    fullSyncBtn.disabled = false;
  });
});

// Sync current conversation
syncCurrentBtn.addEventListener('click', async () => {
  syncCurrentBtn.disabled = true;
  syncCurrentBtn.textContent = 'Syncing...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    syncCurrentBtn.textContent = 'No active tab';
    syncCurrentBtn.disabled = false;
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: 'SYNC_CURRENT' }, (response) => {
    if (chrome.runtime.lastError) {
      syncCurrentBtn.textContent = 'Error — not on DM page';
    } else {
      syncCurrentBtn.textContent = response?.success ? 'Synced!' : response?.message || 'Failed';
    }

    setTimeout(() => {
      syncCurrentBtn.textContent = 'Sync Current Conversation';
      syncCurrentBtn.disabled = false;
    }, 3000);
  });
});

// Listen for progress updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SYNC_PROGRESS') {
    const progress = message.progress as SyncProgress;
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    progressFill.style.width = `${pct}%`;
    progressText.textContent = progress.message;

    if (progress.status === 'done' || progress.status === 'error') {
      fullSyncBtn.disabled = false;
    }
  }
});

function showLoggedIn(auth: StoredAuth): void {
  loginSection.style.display = 'none';
  loggedInSection.style.display = '';
  userName.textContent = auth.user.name;
}
