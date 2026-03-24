(() => {
  if (window.__EASYSCHOLAR_BRIDGE__) {
    return;
  }
  window.__EASYSCHOLAR_BRIDGE__ = true;

  document.addEventListener('__EASYSCHOLAR_VISIBILITY__', (event) => {
    const visible = Boolean(event.detail && event.detail.visible);
    try {
      localStorage.setItem('wos-easyscholar-panel-visible', String(visible));
    } catch (error) {
      console.warn('[Enlightenkey Aide] Failed to persist panel visibility:', error);
    }
  });

  document.addEventListener('__WOS_DOI_QUERY_VISIBILITY__', (event) => {
    const visible = Boolean(event.detail && event.detail.visible);
    try {
      localStorage.setItem('clipboard-reader-box-visible', String(visible));
    } catch (error) {
      console.warn('[Enlightenkey Aide] Failed to persist DOI query visibility:', error);
    }
  });
})();
