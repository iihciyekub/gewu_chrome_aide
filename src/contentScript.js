// 监听面板请求DOI列表
window.addEventListener('message', (event) => {
  if (event?.data?.type === 'ENLIGHTENKEY_DOI_LIST_REQUEST') {
    chrome.storage.local.get(['enlightenkeyDoiList'], result => {
      // 用 window.top.postMessage 保证面板能收到
      window.top.postMessage({
        type: 'ENLIGHTENKEY_DOI_LIST_RESPONSE',
        doiList: result.enlightenkeyDoiList || []
      }, '*');
    });
  }
});

// Quickload prompt storage bridge (for pages where localStorage is blocked)
window.addEventListener('message', (event) => {
  if (event?.data?.type !== 'GEWU_QUICKLOAD_STORAGE') {
    return;
  }
  const { action, key, value, requestId } = event.data || {};
  if (!key || !requestId) {
    return;
  }
  if (action === 'get') {
    chrome.storage.local.get([key], result => {
      window.postMessage({
        type: 'GEWU_QUICKLOAD_STORAGE_RESPONSE',
        requestId,
        value: result[key] || null
      }, '*');
    });
    return;
  }
  if (action === 'set') {
    chrome.storage.local.set({ [key]: value }, () => {
      window.postMessage({
        type: 'GEWU_QUICKLOAD_STORAGE_RESPONSE',
        requestId,
        value: true
      }, '*');
    });
  }
});
// 监听网页window.postMessage的DOI列表消息，并转发给插件
window.addEventListener('message', (event) => {
  if (event?.data?.type === 'ENLIGHTENKEY_DOI_LIST' && Array.isArray(event.data.doiList)) {
    // 存储到chrome.storage.local，供popup读取
    chrome.storage.local.set({ enlightenkeyDoiList: event.data.doiList });
  }
});
'use strict';

// Content script file will run in the context of web page.
// With content script you can manipulate the web pages using
// Document Object Model (DOM).
// You can also pass information to the parent extension.

// We execute this script by making an entry in manifest.json file
// under `content_scripts` property

// For more information on Content Scripts,
// See https://developer.chrome.com/extensions/content_scripts

// Log `title` of current active web page
const pageTitle = document.head?.getElementsByTagName('title')[0]?.innerHTML || '';

const hasFontAwesome = () => {
  if (window.FontAwesome || window.__fortawesome__) return true;
  if (document.querySelector('link[href*="fontawesome"], style[data-fa], style[id*="fontawesome"]')) {
    return true;
  }
  const probe = document.createElement('i');
  probe.className = 'fa-solid fa-gear';
  probe.style.position = 'absolute';
  probe.style.opacity = '0';
  probe.style.pointerEvents = 'none';
  document.documentElement.appendChild(probe);
  const fontFamily = getComputedStyle(probe).getPropertyValue('font-family') || '';
  probe.remove();
  return /Font Awesome/i.test(fontFamily);
};

// Ensure Font Awesome CSS/JS is injected via background (avoids CSP issues on strict sites)
if (!hasFontAwesome()) {
  chrome.runtime.sendMessage({ type: 'ENSURE_FONT_AWESOME' }, () => {});
}

// Communicate with background file by sending a message
chrome.runtime.sendMessage(
  {
    type: 'GREETINGS',
    payload: {
      message: 'Hello, my name is Con. I am from ContentScript.',
    },
  },
  response => {
    console.log(response.message);
  }
);

// ========== 模块管理系统 ==========

/**
 * 模块配置 - 与 module-registry.js 保持一致
 */
const MODULES = {
  easyscholar: {
    id: 'easyscholar',
    name: 'EasyScholar',
    files: ['pub-fun.js', 'z-easyscholar.js'],
    elementId: 'wos_easyscholar_panel',
    visibilityKey: 'wos-easyscholar-panel-visible',
    enabledKey: 'easyscholarEnabled',
    eventName: '__EASYSCHOLAR_VISIBILITY__',
    injectMarker: 'easyscholar-inject'
  },
  
  wosDoiQuery: {
    id: 'wosDoiQuery',
    name: 'DOI Batch Query',
    files: ['pub-fun.js', 'z-easyscholar.js', 'z-wos-doi-query.js'],
    elementId: 'clipboard-reader-box',
    visibilityKey: 'clipboard-reader-box-visible',
    enabledKey: 'wosDoiQueryEnabled',
    eventName: '__WOS_DOI_QUERY_VISIBILITY__',
    injectMarker: 'wos-doi-query-inject'
  },

  doiPdfDownload: {
    id: 'doiPdfDownload',
    name: 'DOI PDF Download',
    files: ['pub-fun.js', 'z-doi-pdf-download.js'],
    elementId: 'ref-paper-downloader',
    visibilityKey: 'pdf_download_panel_visible',
    enabledKey: 'doiPdfDownloadEnabled',
    eventName: '__DOI_PDF_DOWNLOAD_VISIBILITY__',
    injectMarker: 'doi-pdf-download-inject'
  },

  openaiChat: {
    id: 'openaiChat',
    name: 'OpenAI Chat',
    files: ['pub-fun.js', 'z-chat.js'],
    elementId: 'wos_openai_panel',
    visibilityKey: 'wos-openai-panel-visible',
    enabledKey: 'openaiChatEnabled',
    eventName: '__OPENAI_CHAT_VISIBILITY__',
    injectMarker: 'openai-chat-inject'
  }
};

let isBridgeReady = false;
let bridgePromise = null;

const CHAT_API_KEY_STORAGE_KEY = 'wosOpenaiApiKey';
const CHAT_MODEL_STORAGE_KEY = 'wosOpenaiChatModel';
const CHAT_API_KEY_REQUEST_EVENT = '__ENLIGHTENKEY_CHAT_API_KEY_REQUEST__';
const CHAT_API_KEY_RESPONSE_EVENT = '__ENLIGHTENKEY_CHAT_API_KEY_RESPONSE__';
const CHAT_API_KEY_UPDATE_EVENT = '__ENLIGHTENKEY_CHAT_API_KEY_UPDATE__';
const CHAT_API_KEY_SYNC_EVENT = '__ENLIGHTENKEY_CHAT_API_KEY_SYNC__';
const CHAT_MODEL_REQUEST_EVENT = '__ENLIGHTENKEY_CHAT_MODEL_REQUEST__';
const CHAT_MODEL_RESPONSE_EVENT = '__ENLIGHTENKEY_CHAT_MODEL_RESPONSE__';
const CHAT_MODEL_UPDATE_EVENT = '__ENLIGHTENKEY_CHAT_MODEL_UPDATE__';
const CHAT_MODEL_SYNC_EVENT = '__ENLIGHTENKEY_CHAT_MODEL_SYNC__';

/**
 * 确保 module-bridge 已加载
 */
const ensureBridge = () => {
  if (isBridgeReady) {
    return Promise.resolve();
  }
  if (bridgePromise) {
    return bridgePromise;
  }

  bridgePromise = new Promise((resolve) => {
    const existingBridge = document.querySelector('script[data-module-bridge="true"]');
    if (existingBridge) {
      existingBridge.addEventListener('load', () => {
        isBridgeReady = true;
        resolve();
      }, { once: true });
      return;
    }

    const bridge = document.createElement('script');
    bridge.src = chrome.runtime.getURL('module-bridge.js');
    bridge.dataset.moduleBridge = 'true';
    bridge.onload = function() {
      isBridgeReady = true;
      resolve();
      this.remove();
    };
    (document.head || document.documentElement).appendChild(bridge);
  });

  return bridgePromise;
};

const sendChatApiKeyResponse = (requestId, apiKey) => {
  document.dispatchEvent(new CustomEvent(CHAT_API_KEY_RESPONSE_EVENT, {
    detail: { requestId, apiKey }
  }));
};

const sendChatModelResponse = (requestId, model) => {
  document.dispatchEvent(new CustomEvent(CHAT_MODEL_RESPONSE_EVENT, {
    detail: { requestId, model }
  }));
};

const notifyChatApiKeyUpdate = (apiKey) => {
  document.dispatchEvent(new CustomEvent(CHAT_API_KEY_SYNC_EVENT, {
    detail: { apiKey }
  }));
};

const notifyChatModelUpdate = (model) => {
  document.dispatchEvent(new CustomEvent(CHAT_MODEL_SYNC_EVENT, {
    detail: { model }
  }));
};

document.addEventListener(CHAT_API_KEY_REQUEST_EVENT, (event) => {
  const requestId = event?.detail?.requestId;
  chrome.storage.local.get([CHAT_API_KEY_STORAGE_KEY], result => {
    sendChatApiKeyResponse(requestId, result[CHAT_API_KEY_STORAGE_KEY] || '');
  });
});

document.addEventListener(CHAT_MODEL_REQUEST_EVENT, (event) => {
  const requestId = event?.detail?.requestId;
  chrome.storage.local.get([CHAT_MODEL_STORAGE_KEY], result => {
    sendChatModelResponse(requestId, result[CHAT_MODEL_STORAGE_KEY] || 'gpt-4o-mini');
  });
});

document.addEventListener(CHAT_API_KEY_UPDATE_EVENT, (event) => {
  const apiKey = event?.detail?.apiKey || '';
  chrome.storage.local.set({ [CHAT_API_KEY_STORAGE_KEY]: apiKey });
});

document.addEventListener(CHAT_MODEL_UPDATE_EVENT, (event) => {
  const model = event?.detail?.model || 'gpt-4o-mini';
  chrome.storage.local.set({ [CHAT_MODEL_STORAGE_KEY]: model });
});
/**
 * 设置模块可见性
 */
const setModuleVisibility = (moduleId, visible) => {
  const module = MODULES[moduleId];
  if (!module) {
    console.error(`[ContentScript] Unknown module: ${moduleId}`);
    return;
  }

  // 发送可见性事件到页面脚本
  ensureBridge().then(() => {
    document.dispatchEvent(new CustomEvent(module.eventName, {
      detail: { visible }
    }));
  });
};

/**
 * 注入模块的 JS 文件
 */
const injectModule = (moduleId) => {
  const module = MODULES[moduleId];
  if (!module) {
    console.error(`[ContentScript] Unknown module: ${moduleId}`);
    return;
  }

  // 检查是否已注入
  if (document.getElementById(module.elementId)) {
    return;
  }
  const existingMarker = document.querySelector(`script[data-inject="${module.injectMarker}"]`);
  if (existingMarker) {
    return;
  }

  // 顺序注入文件
  const injectFiles = (files, index = 0) => {
    if (index >= files.length) {
      return;
    }

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(files[index]);
    script.dataset.inject = module.injectMarker;
    script.onload = function() {
      if (index < files.length - 1) {
        injectFiles(files, index + 1);
      }
      this.remove();
    };
    script.onerror = function() {
      console.error(`[ContentScript] Failed to inject ${files[index]} for ${module.name}`);
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  };

  injectFiles(module.files);
};

/**
 * 获取模块状态
 */
const getModuleState = (moduleId) => {
  const module = MODULES[moduleId];
  if (!module) {
    return { exists: false, visible: false };
  }

  const element = document.getElementById(module.elementId);
  if (!element) {
    return { exists: false, visible: false };
  }
  const isHidden = element.style.display === 'none' || element.hidden;
  return { exists: true, visible: !isHidden };
};

// ========== 消息监听 ==========

// Listen for message
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // EasyScholar 相关消息
  if (request.type === 'GET_EASYSCHOLAR_PANEL_STATE') {
    const state = getModuleState('easyscholar');
    sendResponse({ success: true, visible: state.visible, exists: state.exists });
    return true;
  }

  if (request.type === 'OPEN_EASYSCHOLAR') {
    const element = document.getElementById(MODULES.wosDoiQuery.elementId);
    const switchToJournalTab = () => {
      document.dispatchEvent(new CustomEvent('__WOS_DOI_QUERY_SWITCH_TAB__', {
        detail: { tab: 'journal' }
      }));
    };

    if (element) {
      element.style.display = 'flex';
      setModuleVisibility('wosDoiQuery', true);
      setModuleVisibility('easyscholar', true);
      switchToJournalTab();
      sendResponse({ success: true, action: 'shown' });
      return true;
    }

    injectModule('wosDoiQuery');
    setTimeout(() => {
      setModuleVisibility('wosDoiQuery', true);
      setModuleVisibility('easyscholar', true);
      switchToJournalTab();
    }, 100);
    sendResponse({ success: true, action: 'injected' });
    return true;
  }

  if (request.type === 'CLOSE_EASYSCHOLAR') {
    const element = document.getElementById(MODULES.wosDoiQuery.elementId);
    if (element) {
      element.remove();
      const easyScholarElement = document.getElementById(MODULES.easyscholar.elementId);
      if (easyScholarElement) {
        easyScholarElement.remove();
      }
      setModuleVisibility('wosDoiQuery', false);
      setModuleVisibility('easyscholar', false);
      sendResponse({ success: true, action: 'removed' });
      return true;
    }
    setModuleVisibility('easyscholar', false);
    sendResponse({ success: true, action: 'noop' });
    return true;
  }

  if (request.type === 'TOGGLE_EASYSCHOLAR_PANEL') {
    const element = document.getElementById(MODULES.wosDoiQuery.elementId);
    if (element) {
      const isVisible = element.style.display !== 'none';
      const nextVisible = !isVisible;
      element.style.display = nextVisible ? 'flex' : 'none';
      if (nextVisible) {
        document.dispatchEvent(new CustomEvent('__WOS_DOI_QUERY_SWITCH_TAB__', {
          detail: { tab: 'journal' }
        }));
      }
      setModuleVisibility('wosDoiQuery', nextVisible);
      setModuleVisibility('easyscholar', nextVisible);
      sendResponse({ success: true, visible: nextVisible });
      return true;
    }

    injectModule('wosDoiQuery');
    setTimeout(() => {
      setModuleVisibility('wosDoiQuery', true);
      setModuleVisibility('easyscholar', true);
      document.dispatchEvent(new CustomEvent('__WOS_DOI_QUERY_SWITCH_TAB__', {
        detail: { tab: 'journal' }
      }));
    }, 100);
    sendResponse({ success: true, visible: true, action: 'injected' });
    return true;
  }

  // WOS DOI Query 相关消息
  if (request.type === 'GET_WOS_DOI_QUERY_STATE') {
    const state = getModuleState('wosDoiQuery');
    sendResponse({ success: true, visible: state.visible, exists: state.exists });
    return true;
  }

  if (request.type === 'OPEN_WOS_DOI_QUERY') {
    const switchTab = () => {
      if (!request.preferredTab) {
        return;
      }
      document.dispatchEvent(new CustomEvent('__WOS_DOI_QUERY_SWITCH_TAB__', {
        detail: { tab: request.preferredTab }
      }));
    };

    const element = document.getElementById(MODULES.wosDoiQuery.elementId);
    if (element) {
      element.style.display = 'flex';
      setModuleVisibility('wosDoiQuery', true);
      switchTab();
      sendResponse({ success: true, action: 'shown' });
      return true;
    }

    // 注入模块，然后等待一个短暂的时间再发送可见性事件
    injectModule('wosDoiQuery');
    setTimeout(() => {
      setModuleVisibility('wosDoiQuery', true);
      switchTab();
    }, 100);
    sendResponse({ success: true, action: 'injected' });
    return true;
  }

  if (request.type === 'CLOSE_WOS_DOI_QUERY') {
    const element = document.getElementById(MODULES.wosDoiQuery.elementId);
    if (element) {
      element.remove();
      const easyScholarElement = document.getElementById(MODULES.easyscholar.elementId);
      if (easyScholarElement) {
        easyScholarElement.remove();
      }
      setModuleVisibility('wosDoiQuery', false);
      setModuleVisibility('easyscholar', false);
      sendResponse({ success: true, action: 'removed' });
      return true;
    }
    setModuleVisibility('wosDoiQuery', false);
    setModuleVisibility('easyscholar', false);
    sendResponse({ success: true, action: 'noop' });
    return true;
  }

  // DOI PDF Download 相关消息
  if (request.type === 'GET_DOI_PDF_DOWNLOAD_STATE') {
    const state = getModuleState('doiPdfDownload');
    sendResponse({ success: true, visible: state.visible, exists: state.exists });
    return true;
  }

  if (request.type === 'OPEN_DOI_PDF_DOWNLOAD') {
    const element = document.getElementById(MODULES.doiPdfDownload.elementId);
    if (element) {
      element.style.display = 'flex';
      setModuleVisibility('doiPdfDownload', true);
      sendResponse({ success: true, action: 'shown' });
      return true;
    }

    // 注入模块，然后等待一个短暂的时间再发送可见性事件
    injectModule('doiPdfDownload');
    setTimeout(() => {
      setModuleVisibility('doiPdfDownload', true);
    }, 100);
    sendResponse({ success: true, action: 'injected' });
    return true;
  }

  if (request.type === 'CLOSE_DOI_PDF_DOWNLOAD') {
    const element = document.getElementById(MODULES.doiPdfDownload.elementId);
    if (element) {
      element.style.display = 'none';
      setModuleVisibility('doiPdfDownload', false);
      sendResponse({ success: true, action: 'hidden' });
      return true;
    }
    setModuleVisibility('doiPdfDownload', false);
    sendResponse({ success: true, action: 'noop' });
    return true;
  }

  // OpenAI Chat 相关消息
  if (request.type === 'GET_OPENAI_CHAT_STATE') {
    const state = getModuleState('openaiChat');
    sendResponse({ success: true, visible: state.visible, exists: state.exists });
    return true;
  }

  if (request.type === 'OPEN_OPENAI_CHAT') {
    const element = document.getElementById(MODULES.openaiChat.elementId);
    if (element) {
      element.style.display = 'flex';
      setModuleVisibility('openaiChat', true);
      sendResponse({ success: true, action: 'shown' });
      return true;
    }

    injectModule('openaiChat');
    setTimeout(() => {
      setModuleVisibility('openaiChat', true);
    }, 100);
    sendResponse({ success: true, action: 'injected' });
    return true;
  }

  if (request.type === 'CLOSE_OPENAI_CHAT') {
    const element = document.getElementById(MODULES.openaiChat.elementId);
    if (element) {
      element.style.display = 'none';
      setModuleVisibility('openaiChat', false);
      sendResponse({ success: true, action: 'hidden' });
      return true;
    }
    setModuleVisibility('openaiChat', false);
    sendResponse({ success: true, action: 'noop' });
    return true;
  }

  if (request.type === 'GET_ENLIGHTENKEY_PROJECT') {
    const listener = (event) => {
      document.removeEventListener('__ENLIGHTENKEY_PROJECT_RESPONSE__', listener);
      if (event.detail.success) {
        sendResponse({ success: true, projectName: event.detail.projectName });
      } else {
        sendResponse({ success: false, error: event.detail.error || 'Project not found' });
      }
    };

    document.addEventListener('__ENLIGHTENKEY_PROJECT_RESPONSE__', listener);
    document.dispatchEvent(new CustomEvent('__GET_ENLIGHTENKEY_PROJECT__'));
    return true;
  }

  if (request.type === 'PICK_ENLIGHTENKEY_DIRECTORY') {
    const listener = (event) => {
      document.removeEventListener('__ENLIGHTENKEY_PICK_DIR_RESPONSE__', listener);
      if (event.detail.success) {
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: event.detail.error || 'Directory not selected' });
      }
    };

    document.addEventListener('__ENLIGHTENKEY_PICK_DIR_RESPONSE__', listener);
    document.dispatchEvent(new CustomEvent('__ENLIGHTENKEY_PICK_DIR__'));
    return true;
  }

  // Send an empty response
  // See https://github.com/mozilla/webextension-polyfill/issues/130#issuecomment-531531890
  sendResponse({});
  return true;
});

// ========== 初始化：根据存储的状态自动加载模块 ==========

const isWosPage = () => /(^|\.)webofscience\.com$/i.test(window.location.hostname || '');

if (isWosPage()) {
  injectModule('wosDoiQuery');
  setTimeout(() => {
    setModuleVisibility('wosDoiQuery', true);
  }, 100);
}

chrome.storage.local.get(['easyscholarEnabled'], result => {
  if (result.easyscholarEnabled) {
    setModuleVisibility('easyscholar', true);
    injectModule('easyscholar');
  }
});

chrome.storage.local.get(['wosDoiQueryEnabled'], result => {
  if (result.wosDoiQueryEnabled) {
    setModuleVisibility('wosDoiQuery', true);
    injectModule('wosDoiQuery');
  }
});

chrome.storage.local.get(['doiPdfDownloadEnabled'], result => {
  if (result.doiPdfDownloadEnabled) {
    setModuleVisibility('doiPdfDownload', true);
    injectModule('doiPdfDownload');
  }
});

chrome.storage.local.get(['openaiChatEnabled'], result => {
  if (result.openaiChatEnabled) {
    setModuleVisibility('openaiChat', true);
    injectModule('openaiChat');
  }
});

const notifyEnlightenkeyProject = (projectName) => {
  document.dispatchEvent(new CustomEvent('__ENLIGHTENKEY_PROJECT_UPDATE__', {
    detail: { projectName }
  }));
};

chrome.storage.local.get(['enlightenkeyProjectName'], result => {
  if (result.enlightenkeyProjectName) {
    notifyEnlightenkeyProject(result.enlightenkeyProjectName);
  }
});

chrome.storage.local.get([CHAT_API_KEY_STORAGE_KEY], result => {
  if (result[CHAT_API_KEY_STORAGE_KEY]) {
    notifyChatApiKeyUpdate(result[CHAT_API_KEY_STORAGE_KEY]);
  }
});

chrome.storage.local.get([CHAT_MODEL_STORAGE_KEY], result => {
  if (result[CHAT_MODEL_STORAGE_KEY]) {
    notifyChatModelUpdate(result[CHAT_MODEL_STORAGE_KEY]);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }
  if (changes.enlightenkeyProjectName) {
    notifyEnlightenkeyProject(changes.enlightenkeyProjectName.newValue || null);
  }
  if (changes[CHAT_API_KEY_STORAGE_KEY]) {
    notifyChatApiKeyUpdate(changes[CHAT_API_KEY_STORAGE_KEY].newValue || '');
  }
  if (changes[CHAT_MODEL_STORAGE_KEY]) {
    notifyChatModelUpdate(changes[CHAT_MODEL_STORAGE_KEY].newValue || 'gpt-4o-mini');
  }
});

// Load the external injected script to avoid CSP issues
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Inject ChatGPT prompts quickload helper on chatgpt.com
if (location.hostname === 'chatgpt.com' || location.hostname.endsWith('.chatgpt.com')) {
  const existingQuickload = document.querySelector('script[data-inject="chatgpt-prompts-quickload"]');
  if (!existingQuickload) {
    const quickloadScript = document.createElement('script');
    quickloadScript.src = chrome.runtime.getURL('chatgpt-prompts-quickload.js');
    quickloadScript.dataset.inject = 'chatgpt-prompts-quickload';
    quickloadScript.onload = function() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(quickloadScript);
  }
}
