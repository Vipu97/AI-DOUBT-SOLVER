window.addEventListener('load', () => {
  document.getElementById('showOverlayButton').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'ShowOverlay' });
  })
})
