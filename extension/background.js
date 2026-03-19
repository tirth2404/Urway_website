const AI_DOMAINS = [
  'chat.openai.com',
  'gemini.google.com',
  'claude.ai',
  'perplexity.ai',
  'copilot.microsoft.com',
];

let activeTabId = null;
let activeUrl = '';
let activeTitle = '';
let startedAt = Date.now();

function isAiDomain(url = '') {
  return AI_DOMAINS.some((domain) => url.includes(domain));
}

async function getSettings() {
  return chrome.storage.local.get({
    userId: '',
    backendUrl: 'http://127.0.0.1:5000',
  });
}

async function syncEvent(url, title, secondsSpent) {
  const { userId, backendUrl } = await getSettings();
  if (!userId || !url || secondsSpent <= 0) return;

  const endpoint = `${backendUrl}/api/extension/sync/${userId}`;
  const payload = { url, title, secondsSpent };

  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (isAiDomain(url)) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'AI_SITE_DETECTED', url });
        }
      });
    });
  }
}

async function flushActive() {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  if (activeUrl && elapsed > 2) {
    await syncEvent(activeUrl, activeTitle, elapsed);
  }
}

async function setActiveTab(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;

  await flushActive();

  activeTabId = tab.id;
  activeUrl = tab.url || '';
  activeTitle = tab.title || '';
  startedAt = Date.now();
}

chrome.tabs.onActivated.addListener(async (info) => {
  await setActiveTab(info.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId !== activeTabId) return;
  if (changeInfo.url || changeInfo.status === 'complete') {
    await flushActive();
    activeUrl = tab.url || activeUrl;
    activeTitle = tab.title || activeTitle;
    startedAt = Date.now();
  }
});

chrome.alarms.create('urway-heartbeat', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'urway-heartbeat') {
    await flushActive();
    startedAt = Date.now();
  }
});
