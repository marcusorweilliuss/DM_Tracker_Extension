// DM Tracker Extension — Content Script (bundled)
// Contains: utils/dom, utils/api, platforms/carousell, sync, content/index

(function () {
  'use strict';

  // ── DOM Utilities ──────────────────────────────────────────────────

  function scrollAndWait(container, direction, waitMs) {
    if (waitMs === undefined) waitMs = 1500;
    return new Promise(function (resolve) {
      var childCountBefore = container.children.length;
      var scrollHeightBefore = container.scrollHeight;
      if (direction === 'up') {
        container.scrollTop = 0;
      } else {
        container.scrollTop = container.scrollHeight;
      }
      setTimeout(function () {
        resolve(
          container.children.length !== childCountBefore ||
          container.scrollHeight !== scrollHeightBefore
        );
      }, waitMs);
    });
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // ── API Utilities ──────────────────────────────────────────────────

  function getAuth() {
    return new Promise(function (resolve) {
      chrome.storage.local.get('auth', function (result) {
        resolve(result.auth || null);
      });
    });
  }

  async function syncConversationsApi(platform, conversations) {
    var auth = await getAuth();
    if (!auth) throw new Error('Not authenticated');

    var response = await fetch(auth.apiUrl + '/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + auth.token,
      },
      body: JSON.stringify({ platform: platform, conversations: conversations }),
    });

    if (!response.ok) {
      var err = await response.json().catch(function () { return { error: 'Sync failed' }; });
      throw new Error(err.error || 'Sync failed');
    }
    return response.json();
  }

  // ── Carousell Extractor ────────────────────────────────────────────

  var CarousellExtractor = {
    platform: 'carousell',

    isOnDMPage: function () {
      return window.location.pathname.startsWith('/inbox/');
    },

    isOnInboxPage: function () {
      return (
        window.location.pathname === '/inbox' ||
        window.location.pathname === '/inbox/'
      );
    },

    getConversationList: function () {
      var container = this._findChatListContainer();
      if (!container) return [];
      var items = container.querySelectorAll(':scope > div[role="button"]');
      return Array.from(items);
    },

    extractConversationId: function () {
      return 'pending';
    },

    openConversation: async function (element) {
      element.click();
      await sleep(2000);
    },

    getInboxScrollContainer: function () {
      var container = this._findChatListContainer();
      if (!container) return null;
      if (container.scrollHeight > container.clientHeight) return container;
      var parent = container.parentElement;
      if (parent && parent.scrollHeight > parent.clientHeight) return parent;
      return container;
    },

    getMessageScrollContainer: function () {
      var msgContainer = this._findMessageContainer();
      if (!msgContainer) return null;
      var el = msgContainer;
      for (var i = 0; i < 5; i++) {
        if (!el) break;
        if (el.scrollHeight > el.clientHeight + 10) return el;
        el = el.parentElement;
      }
      return msgContainer;
    },

    extractCurrentConversation: async function () {
      try {
        var convId = this._getConversationIdFromUrl();
        if (!convId) return null;
        var contact = this._extractContact();
        if (!contact) return null;
        var messages = this._extractMessages();
        return {
          platform_conversation_id: convId,
          contact: contact,
          messages: messages,
        };
      } catch (err) {
        console.error('[DM Tracker] Error extracting conversation:', err);
        return null;
      }
    },

    _getConversationIdFromUrl: function () {
      var match = window.location.pathname.match(/\/inbox\/([^/?]+)/);
      return match ? match[1] : null;
    },

    _findChatListContainer: function () {
      // Strategy 1: Find "Chats" text label, then sibling container with role="button" items
      var allPs = document.querySelectorAll('p');
      for (var i = 0; i < allPs.length; i++) {
        var p = allPs[i];
        if (p.textContent && p.textContent.trim() === 'Chats') {
          var parent = p.parentElement && p.parentElement.parentElement;
          if (parent) {
            var siblings = parent.children;
            for (var j = 0; j < siblings.length; j++) {
              var buttons = siblings[j].querySelectorAll('div[role="button"]');
              if (buttons.length > 0) return siblings[j];
            }
          }
        }
      }

      // Strategy 2: Find container with multiple div[role="button"] that have avatars
      var allDivs = document.querySelectorAll('div');
      for (var k = 0; k < allDivs.length; k++) {
        var div = allDivs[k];
        var roleButtons = div.querySelectorAll(':scope > div[role="button"]');
        if (roleButtons.length >= 3) {
          var firstBtn = roleButtons[0];
          var hasAvatar = firstBtn.querySelector('img[alt="Avatar"]');
          var hasText = firstBtn.querySelectorAll('p').length >= 1;
          if (hasAvatar && hasText) return div;
        }
      }
      return null;
    },

    _findMessageContainer: function () {
      // Find the container that has the profile card as one child and
      // message groups as other children. The correct container has:
      // - One child with "on Carousell" + "review" text (profile card)
      // - Multiple other children with message <p> elements
      var allDivs = document.querySelectorAll('div');
      var bestMatch = null;
      var bestDepth = -1;
      for (var i = 0; i < allDivs.length; i++) {
        var div = allDivs[i];
        if (div.children.length < 3) continue; // Need profile card + at least 2 messages

        var hasProfileCard = false;
        var messageChildCount = 0;

        for (var c = 0; c < div.children.length; c++) {
          var childText = div.children[c].textContent || '';
          if (childText.includes('on Carousell') && childText.includes('review')) {
            hasProfileCard = true;
          } else if (div.children[c].querySelectorAll('p').length > 0) {
            messageChildCount++;
          }
        }

        if (hasProfileCard && messageChildCount >= 2) {
          var depth = 0;
          var parent = div.parentElement;
          while (parent) { depth++; parent = parent.parentElement; }
          if (depth > bestDepth) {
            bestDepth = depth;
            bestMatch = div;
          }
        }
      }
      return bestMatch;
    },

    _extractContact: function () {
      var displayName = null;
      var username = null;

      // Strategy 1: Find "Online X ago" text — username is in the preceding <p>
      var allPs = document.querySelectorAll('p');
      for (var i = 0; i < allPs.length; i++) {
        var p = allPs[i];
        var text = p.textContent ? p.textContent.trim() : '';
        if (text.startsWith('Online ') || text === 'Online now') {
          if (i > 0) {
            var prev = allPs[i - 1];
            if (prev) {
              displayName = prev.textContent ? prev.textContent.trim() : null;
              username = displayName;
            }
          }
          break;
        }
      }

      // Strategy 2: Find header button with a username-like text in the right panel
      if (!displayName) {
        var headerButtons = document.querySelectorAll('button');
        for (var j = 0; j < headerButtons.length; j++) {
          var btn = headerButtons[j];
          var ps = btn.querySelectorAll('p');
          if (ps.length === 1) {
            var btnText = ps[0].textContent ? ps[0].textContent.trim() : '';
            if (btnText.length > 2 && btnText.length < 50 && btnText.indexOf(' ') === -1 &&
                ['Sell', 'Search', 'Chats', 'Inbox'].indexOf(btnText) === -1) {
              var rect = btn.getBoundingClientRect();
              if (rect.left > 500) {
                displayName = btnText;
                username = btnText;
                break;
              }
            }
          }
        }
      }

      // Strategy 3: Fallback to conversation ID
      if (!displayName) {
        var convId = this._getConversationIdFromUrl();
        if (convId) displayName = convId;
      }

      var profileUrl = username ? 'https://www.carousell.sg/u/' + username : null;
      var listingLinks = document.querySelectorAll('a[href^="/p/"]');
      var hasActiveListing = listingLinks.length > 0;

      return {
        platform_user_id: username || this._getConversationIdFromUrl() || '',
        username: username || null,
        display_name: displayName || null,
        profile_url: profileUrl,
        has_active_listing: hasActiveListing,
      };
    },

    _extractMessages: function () {
      var messages = [];
      var msgContainer = this._findMessageContainer();
      if (!msgContainer) return messages;

      var groups = msgContainer.children;
      var currentDate = '';
      var currentTime = '';
      var msgIndex = 0;

      for (var g = 0; g < groups.length; g++) {
        var groupEl = groups[g];
        var groupText = groupEl.textContent || '';

        // Skip profile card and system messages
        if (groupText.includes('on Carousell') && groupText.includes('review')) continue;
        if (groupText.includes('interested buyer') || groupText.includes('keep deals safe')) continue;

        // Extract date/time from spans
        var spans = groupEl.querySelectorAll('span');
        for (var s = 0; s < spans.length; s++) {
          var spanText = spans[s].textContent ? spans[s].textContent.trim() : '';
          if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(spanText)) currentDate = spanText;
          if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(spanText)) currentTime = spanText;
        }
        // Also check for date/time in direct text nodes
        var groupDirectText = '';
        for (var tn = 0; tn < groupEl.childNodes.length; tn++) {
          if (groupEl.childNodes[tn].nodeType === 3) {
            groupDirectText += groupEl.childNodes[tn].textContent;
          }
        }

        // Extract message text from <p> tags
        var paragraphs = groupEl.querySelectorAll('p');
        for (var pi = 0; pi < paragraphs.length; pi++) {
          var body = paragraphs[pi].textContent ? paragraphs[pi].textContent.trim() : '';
          if (!body || body.length < 2) continue;
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(body)) continue;
          if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(body)) continue;
          if (body.includes('on Carousell')) continue;
          if (body.includes('interested buyer')) continue;
          if (body.includes('keep deals safe')) continue;

          var sender = this._detectSender(paragraphs[pi]);
          var sentAt = this._parseTimestamp(currentDate, currentTime);

          messages.push({
            platform_message_id: 'msg_' + msgIndex++,
            sender: sender,
            body: body,
            sent_at: sentAt,
          });
        }
      }

      return messages;
    },

    _detectSender: function (messageEl) {
      // Strategy 1: Find the bubble container and check its position
      // User messages are right-aligned, contact messages are left-aligned
      var el = messageEl;
      for (var i = 0; i < 4; i++) {
        if (!el) break;
        // Check if this is a bubble container (has background color = gray for user)
        var bg = window.getComputedStyle(el).backgroundColor;
        if (bg === 'rgb(240, 241, 241)') return 'user'; // User bubble is gray
        el = el.parentElement;
      }

      // Strategy 2: Check bubble position relative to container center
      var bubble = messageEl;
      for (var j = 0; j < 4; j++) {
        if (!bubble) break;
        if (bubble.className && bubble.className.indexOf('cGZ') !== -1) break;
        bubble = bubble.parentElement;
      }
      if (bubble) {
        var rect = bubble.getBoundingClientRect();
        // User messages are positioned more to the right (left edge > 900px typically)
        if (rect.left > 900) return 'user';
        if (rect.left < 850) return 'contact';
      }

      return 'contact';
    },

    _parseTimestamp: function (date, time) {
      try {
        var hours = 0;
        var minutes = 0;
        if (time) {
          var timeMatch = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (timeMatch) {
            hours = parseInt(timeMatch[1]);
            minutes = parseInt(timeMatch[2]);
            var ampm = timeMatch[3].toUpperCase();
            if (ampm === 'PM' && hours !== 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
          }
        }

        if (date) {
          var parts = date.split('/');
          var day = parseInt(parts[0]);
          var month = parseInt(parts[1]);
          var year = parseInt(parts[2]);
          var d = new Date(year, month - 1, day, hours, minutes);
          return d.toISOString();
        }

        // If no date but we have time, use today's date
        if (time) {
          var today = new Date();
          today.setHours(hours, minutes, 0, 0);
          return today.toISOString();
        }

        return new Date().toISOString();
      } catch (e) {
        return new Date().toISOString();
      }
    },
  };

  // ── Sync Functions ─────────────────────────────────────────────────

  async function fullSync(extractor, onProgress) {
    onProgress({ total: 0, current: 0, status: 'syncing', message: 'Loading conversation list...' });

    // Navigate to inbox root if not there
    if (!window.location.pathname.match(/^\/inbox\/?$/)) {
      window.location.href = '/inbox/';
      await sleep(3000);
    }

    // Scroll inbox to load all conversations
    var inboxContainer = extractor.getInboxScrollContainer();
    if (inboxContainer) {
      var previousCount = 0;
      var noChangeStreak = 0;
      for (var scrollAttempt = 0; scrollAttempt < 200; scrollAttempt++) {
        // Check if we've reached the end ("That's all for your chats")
        var endMarker = document.body.textContent || '';
        if (endMarker.includes("That's all for your chats") || endMarker.includes("Older messages may have been deleted")) {
          console.log('[DM Tracker] Reached end of conversation list');
          break;
        }

        // Scroll down
        inboxContainer.scrollTop = inboxContainer.scrollHeight;
        await sleep(2500);

        // Check how many conversations we have now
        var currentCount = extractor.getConversationList().length;
        onProgress({ total: currentCount, current: 0, status: 'syncing', message: 'Loading conversations... found ' + currentCount + ' so far' });

        if (currentCount === previousCount) {
          noChangeStreak++;
          if (noChangeStreak >= 3) break; // 3 scrolls with no new conversations = done
        } else {
          noChangeStreak = 0;
        }
        previousCount = currentCount;
      }
    }

    var convElements = extractor.getConversationList();
    var total = convElements.length;

    if (total === 0) {
      onProgress({ total: 0, current: 0, status: 'done', message: 'No conversations found. Make sure you are on the Carousell inbox page.' });
      return;
    }

    onProgress({ total: total, current: 0, status: 'syncing', message: 'Found ' + total + ' conversations' });

    var batchSize = 5;
    var batch = [];

    for (var i = 0; i < total; i++) {
      onProgress({
        total: total,
        current: i + 1,
        status: 'syncing',
        message: 'Syncing ' + (i + 1) + ' of ' + total + ' conversations...',
      });

      var currentElements = extractor.getConversationList();
      if (i >= currentElements.length) break;

      var el = currentElements[i];
      await extractor.openConversation(el);
      await sleep(1000);

      var msgContainer = extractor.getMessageScrollContainer();
      if (msgContainer) {
        var msgHasMore = true;
        var msgScrollAttempts = 0;
        while (msgHasMore && msgScrollAttempts < 30) {
          msgHasMore = await scrollAndWait(msgContainer, 'up', 1500);
          msgScrollAttempts++;
        }
      }

      var conversation = await extractor.extractCurrentConversation();
      if (conversation) batch.push(conversation);

      if (batch.length >= batchSize || i === total - 1) {
        if (batch.length > 0) {
          try {
            await syncConversationsApi(extractor.platform, batch);
          } catch (err) {
            console.error('[DM Tracker] Sync batch failed:', err);
          }
          batch = [];
        }
      }

      await sleep(500);
    }

    onProgress({ total: total, current: total, status: 'done', message: 'Sync complete!' });
  }

  async function syncCurrentConversation(extractor) {
    var conversation = await extractor.extractCurrentConversation();
    if (!conversation) {
      return { success: false, message: 'Could not extract conversation data. Make sure a conversation is open.' };
    }

    try {
      var result = await syncConversationsApi(extractor.platform, [conversation]);
      var status = result.results[0] ? result.results[0].status : 'unknown';
      return { success: true, message: 'Conversation ' + status };
    } catch (err) {
      return { success: false, message: (err && err.message) || 'Sync failed' };
    }
  }

  // ── Content Script Init ────────────────────────────────────────────

  var extractor = null;

  if (window.location.hostname.includes('carousell')) {
    extractor = CarousellExtractor;
  }

  if (extractor) {
    if (extractor.isOnDMPage()) {
      injectSyncButton();
    }

    var observer = new MutationObserver(function () {
      if (extractor.isOnDMPage() && !document.getElementById('dm-tracker-sync-btn')) {
        injectSyncButton();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
      if (message.type === 'FULL_SYNC') {
        fullSync(extractor, function (progress) {
          chrome.runtime.sendMessage({ type: 'SYNC_PROGRESS', progress: progress });
        }).then(function () {
          sendResponse({ success: true });
        }).catch(function (err) {
          sendResponse({ success: false, error: err.message });
        });
        return true;
      }

      if (message.type === 'SYNC_CURRENT') {
        syncCurrentConversation(extractor)
          .then(function (result) { sendResponse(result); })
          .catch(function (err) { sendResponse({ success: false, message: err.message }); });
        return true;
      }
    });
  }

  function injectSyncButton() {
    if (document.getElementById('dm-tracker-sync-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'dm-tracker-sync-btn';
    btn.textContent = 'Sync this conversation';
    btn.addEventListener('click', async function () {
      if (!extractor) return;
      btn.disabled = true;
      btn.textContent = 'Syncing...';

      var result = await syncCurrentConversation(extractor);
      btn.textContent = result.success ? 'Synced!' : 'Failed';
      btn.disabled = false;

      setTimeout(function () {
        btn.textContent = 'Sync this conversation';
      }, 3000);
    });

    document.body.appendChild(btn);
  }

})();
