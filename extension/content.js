chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'AI_SITE_DETECTED') {
    window.postMessage({ type: 'AI_SITE_DETECTED', url: message.url }, '*');
  }
});
