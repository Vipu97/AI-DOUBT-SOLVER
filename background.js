chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ShowOverlay') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0].id;
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js','lib/tesseract.min.js']
      });
      chrome.tabs.sendMessage(tabId, { action: 'ShowOverlay' })
    });
  } else if (message.action === 'HideOverlay') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0].id;
      chrome.tabs.sendMessage(tabId, { action: 'HideOverlay' })
    })
  } else if (message.action === 'CaptureContent') {
    const { x, y, width, height } = message;
    chrome.tabs.captureVisibleTab({ format: 'png' }, dataUrl => {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tabId = tabs[0].id;
        chrome.tabs.sendMessage(tabId, { action: 'ExecuteScript', dataUrl, x, y, width, height });
      })
    });
  }
});

