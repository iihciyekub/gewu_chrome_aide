'use strict';

import './popup.css';

(function() {
  const CHAT_API_KEY_STORAGE_KEY = 'wosOpenaiApiKey';
  const CHAT_MODEL_STORAGE_KEY = 'wosOpenaiChatModel';
  const WOS_QUERY_PROVIDER_STORAGE_KEY = 'wosQueryProvider';
  const WOS_QUERY_ENABLED_STORAGE_KEY = 'wosQueryEnabled';
  const WOS_QUERY_OPENAI_VERIFIED_STORAGE_KEY = 'wosOpenaiVerified';
  const WOS_QUERY_LMSTUDIO_VERIFIED_STORAGE_KEY = 'wosLmStudioVerified';
  const LM_STUDIO_BASE_URL_STORAGE_KEY = 'wosLmStudioBaseUrl';
  const LM_STUDIO_MODEL_STORAGE_KEY = 'wosLmStudioModel';
  const LM_STUDIO_API_KEY_STORAGE_KEY = 'wosLmStudioApiKey';
  const EASYSCHOLAR_API_KEY_STORAGE_KEY = 'wos-easyscholar-api-key';
  const EASYSCHOLAR_API_KEY_VERIFIED_STORAGE_KEY = 'wos-easyscholar-api-key-verified';
  const OPENAI_SETTINGS_COLLAPSED_KEY = 'wosOpenaiSettingsCollapsed';
  const EASYSCHOLAR_SETTINGS_COLLAPSED_KEY = 'wosEasyScholarSettingsCollapsed';
  const EASYSCHOLAR_API_KEY_SYNC_EVENT = '__EASYSCHOLAR_API_KEY_SYNC__';
  const WOS_QUERY_ACCESS_SYNC_EVENT = '__WOS_QUERY_ACCESS_SYNC__';

  // ========== Status Management ==========
  const statusClasses = ['status--success', 'status--error', 'status--info', 'status--muted'];

  const setStatus = (element, message, variant) => {
    element.textContent = message;
    element.classList.remove(...statusClasses);
    if (variant) {
      element.classList.add(variant);
    }
  };

  const setWosDoiQueryToggle = (button, enabled) => {
    const icon = button.querySelector('i');
    const label = button.querySelector('.button-label');
    if (enabled) {
      icon.className = 'fa-solid fa-toggle-on';
      label.textContent = 'Disable DOI Batch Query';
    } else {
      icon.className = 'fa-solid fa-toggle-off';
      label.textContent = 'Enable DOI Batch Query';
    }
  };

  const setDoiPdfDownloadToggle = (button, enabled) => {
    const icon = button.querySelector('i');
    const label = button.querySelector('.button-label');
    if (enabled) {
      icon.className = 'fa-solid fa-toggle-on';
      label.textContent = 'Disable DOI PDF Download';
    } else {
      icon.className = 'fa-solid fa-toggle-off';
      label.textContent = 'Enable DOI PDF Download';
    }
  };

  const withActiveTab = (callback) => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (!tab || !tab.id) {
        callback(null);
        return;
      }
      callback(tab);
    });
  };

  const executeMainWorldScripts = (tabId, files, onComplete) => {
    if (!chrome.scripting || !chrome.scripting.executeScript) {
      onComplete(new Error('chrome.scripting is unavailable'));
      return;
    }
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files,
        world: 'MAIN',
      },
      () => {
        if (chrome.runtime.lastError) {
          onComplete(new Error(chrome.runtime.lastError.message));
          return;
        }
        onComplete(null);
      }
    );
  };

  const executeMainWorldFile = (tabId, file, onComplete) => {
    executeMainWorldScripts(tabId, [file], onComplete);
  };

  const setMainWorldLocalStorage = (tabId, key, value, onComplete) => {
    if (!chrome.scripting || !chrome.scripting.executeScript) {
      onComplete(new Error('chrome.scripting is unavailable'));
      return;
    }
    chrome.scripting.executeScript(
      {
        target: { tabId },
        world: 'MAIN',
        func: (storageKey, storageValue) => {
          try {
            localStorage.setItem(storageKey, storageValue);
          } catch (error) {
            // Ignore storage failures in restricted contexts.
          }
        },
        args: [key, value],
      },
      () => {
        if (chrome.runtime.lastError) {
          onComplete(new Error(chrome.runtime.lastError.message));
          return;
        }
        onComplete(null);
      }
    );
  };

  document.addEventListener('DOMContentLoaded', () => {
    const openaiSettingsToggle = document.getElementById('openaiSettingsToggle');
    const openaiSettingsBody = document.getElementById('openaiSettingsBody');
    const easyScholarSettingsToggle = document.getElementById('easyScholarSettingsToggle');
    const easyScholarSettingsBody = document.getElementById('easyScholarSettingsBody');

    const apiKeyInput = document.getElementById('openaiApiKeyInput');
    const openaiApiSettingsSection = document.getElementById('openaiApiSettingsSection');
    const openaiModelSettingsSection = document.getElementById('openaiModelSettingsSection');
    const apiKeyToggleBtn = document.getElementById('openaiApiKeyToggle');
    const apiKeySaveBtn = document.getElementById('openaiApiKeySaveBtn');
    const apiKeyClearBtn = document.getElementById('openaiApiKeyClearBtn');
    const apiKeyHint = document.getElementById('openaiApiKeyHint');
    const easyScholarApiKeyInput = document.getElementById('easyScholarApiKeyInput');
    const easyScholarApiKeyToggleBtn = document.getElementById('easyScholarApiKeyToggle');
    const easyScholarApiKeySaveBtn = document.getElementById('easyScholarApiKeySaveBtn');
    const easyScholarApiKeyTestBtn = document.getElementById('easyScholarApiKeyTestBtn');
    const easyScholarApiKeyClearBtn = document.getElementById('easyScholarApiKeyClearBtn');
    const easyScholarWebsiteBtn = document.getElementById('easyScholarWebsiteBtn');
    const easyScholarApiKeyHint = document.getElementById('easyScholarApiKeyHint');
    const chatModelSelect = document.getElementById('openaiChatModelSelect');
    const chatModelHint = document.getElementById('openaiChatModelHint');
    const chatModelCustomRow = document.getElementById('openaiChatModelCustomRow');
    const chatModelCustomInput = document.getElementById('openaiChatModelCustomInput');
    const chatModelTestBtn = document.getElementById('openaiChatModelTestBtn');
    const wosQueryProviderSelect = document.getElementById('wosQueryProviderSelect');
    const wosQueryProviderEnabledToggle = document.getElementById('wosQueryProviderEnabledToggle');
    const wosQueryProviderDetails = document.getElementById('wosQueryProviderDetails');
    const wosQueryProviderHint = document.getElementById('wosQueryProviderHint');
    const lmStudioSettingsSection = document.getElementById('lmStudioSettingsSection');
    const lmStudioBaseUrlInput = document.getElementById('lmStudioBaseUrlInput');
    const lmStudioModelInput = document.getElementById('lmStudioModelInput');
    const lmStudioApiKeyInput = document.getElementById('lmStudioApiKeyInput');
    const lmStudioApiKeyToggle = document.getElementById('lmStudioApiKeyToggle');
    const lmStudioSaveBtn = document.getElementById('lmStudioSaveBtn');
    const lmStudioTestBtn = document.getElementById('lmStudioTestBtn');
    const lmStudioHint = document.getElementById('lmStudioHint');

    const openWosDoiQueryBtn = document.getElementById('openWosDoiQueryBtn');
    const openDoiPdfDownloadBtn = document.getElementById('openDoiPdfDownloadBtn');
    const sidDisplay = document.getElementById('sidDisplay');

    // 新增：DOI列表显示区域和清空按钮


    const clearDoiBtn = document.getElementById('clearDoiBtn');
    const doiListDisplay = document.getElementById('doiListDisplay');
    if (clearDoiBtn) {
      clearDoiBtn.title = 'Clear DOI List';
      clearDoiBtn.onclick = () => {
        chrome.storage.local.set({ enlightenkeyDoiList: [] });
      };
    }

    // 显示DOI数量或无DOI
    function updateDoiButton(list) {
      if (!clearDoiBtn || !doiListDisplay) return;
      if (!list || list.length === 0) {
        doiListDisplay.textContent = '';
        clearDoiBtn.disabled = true;
        clearDoiBtn.classList.add('button--disabled');
        clearDoiBtn.style.display = 'none';
      } else {
        doiListDisplay.innerHTML = `<b>Received DOI list: ${list.length} DOIs</b>`;
        clearDoiBtn.disabled = false;
        clearDoiBtn.classList.remove('button--disabled');
        clearDoiBtn.style.display = 'flex';
      }
    }

    // 初始状态
    doiListDisplay.textContent = '';
    clearDoiBtn.disabled = true;
    clearDoiBtn.classList.add('button--disabled');
    clearDoiBtn.style.display = 'none';

    // 读取chrome.storage.local中的DOI列表
    chrome.storage.local.get(['enlightenkeyDoiList'], result => {
      updateDoiButton(result.enlightenkeyDoiList || []);
    });

    // 监听chrome.storage.onChanged，实时更新DOI列表
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.enlightenkeyDoiList) {
        updateDoiButton(changes.enlightenkeyDoiList.newValue || []);
      }
    });

    // 所有面板默认状态为未开启（false），不从本地存储读取
    let isWosDoiQueryEnabled = false;
    let isDoiPdfDownloadEnabled = false;
    let currentEasyScholarApiKey = '';
    let currentEasyScholarVerified = false;
    let currentWosQueryProvider = 'openai';
    let currentWosQueryEnabled = false;
    let currentOpenAIVerified = false;
    let currentLmStudioVerified = false;

    // 初始化按钮状态为 Enable（未开启）
    setWosDoiQueryToggle(openWosDoiQueryBtn, false);
    setDoiPdfDownloadToggle(openDoiPdfDownloadBtn, false);

    const updateApiKeyHint = (message, variant) => {
      if (!apiKeyHint) return;
      apiKeyHint.textContent = message;
      apiKeyHint.classList.remove(...statusClasses);
      if (variant) {
        apiKeyHint.classList.add(variant);
      }
    };

    const updateEasyScholarApiKeyHint = (message, variant) => {
      if (!easyScholarApiKeyHint) return;
      easyScholarApiKeyHint.textContent = message;
      easyScholarApiKeyHint.classList.remove(...statusClasses);
      if (variant) {
        easyScholarApiKeyHint.classList.add(variant);
      }
    };

    const syncEasyScholarStateToTab = (tabId, apiKey, verified, onComplete) => {
      if (!chrome.scripting || !chrome.scripting.executeScript) {
        onComplete(new Error('chrome.scripting is unavailable'));
        return;
      }
      chrome.scripting.executeScript(
        {
          target: { tabId },
          world: 'MAIN',
          func: (storageKey, storageValue, verifiedKey, verifiedValue, eventName) => {
            try {
              localStorage.setItem(storageKey, storageValue);
              localStorage.setItem(verifiedKey, String(Boolean(verifiedValue)));
            } catch (error) {
              // Ignore storage failures in restricted contexts.
            }
            try {
              window.easyscholar_api_key = storageValue;
            } catch (error) {
              // Ignore assignment failures.
            }
            document.dispatchEvent(new CustomEvent(eventName, {
              detail: { apiKey: storageValue, verified: Boolean(verifiedValue) }
            }));
          },
          args: [
            EASYSCHOLAR_API_KEY_STORAGE_KEY,
            apiKey,
            EASYSCHOLAR_API_KEY_VERIFIED_STORAGE_KEY,
            verified,
            EASYSCHOLAR_API_KEY_SYNC_EVENT
          ],
        },
        () => {
          if (chrome.runtime.lastError) {
            onComplete(new Error(chrome.runtime.lastError.message));
            return;
          }
          onComplete(null);
        }
      );
    };

    const syncEasyScholarStateToActiveTab = (apiKey, verified) => {
      withActiveTab((tab) => {
        if (!tab) {
          return;
        }
        syncEasyScholarStateToTab(tab.id, apiKey, verified, (error) => {
          if (error) {
            console.warn('Failed to sync EasyScholar state to page:', error.message);
          }
        });
      });
    };

    const saveApiKey = (apiKey) => {
      chrome.storage.local.set({ [CHAT_API_KEY_STORAGE_KEY]: apiKey }, () => {
        if (chrome.runtime.lastError) {
          updateApiKeyHint('Failed to save API key.', 'status--error');
          setStatus(sidDisplay, 'Failed to save API key', 'status--error');
          return;
        }
        setProviderVerifiedState('openai', false);
        updateApiKeyHint('API key saved for all pages.', 'status--success');
        setStatus(sidDisplay, 'API key saved', 'status--success');
      });
    };

    const setEasyScholarStoredState = (apiKey, verified, hintMessage, hintVariant, statusMessage, statusVariant) => {
      chrome.storage.local.set({
        [EASYSCHOLAR_API_KEY_STORAGE_KEY]: apiKey,
        [EASYSCHOLAR_API_KEY_VERIFIED_STORAGE_KEY]: Boolean(verified)
      }, () => {
        if (chrome.runtime.lastError) {
          updateEasyScholarApiKeyHint('Failed to save EasyScholar state.', 'status--error');
          setStatus(sidDisplay, 'Failed to save EasyScholar state', 'status--error');
          return;
        }
        currentEasyScholarApiKey = apiKey;
        currentEasyScholarVerified = Boolean(verified);
        updateEasyScholarApiKeyHint(hintMessage, hintVariant);
        setStatus(sidDisplay, statusMessage, statusVariant);
        syncEasyScholarStateToActiveTab(apiKey, verified);
      });
    };

    const saveEasyScholarApiKey = (apiKey) => {
      const key = (apiKey || '').trim();
      if (key === currentEasyScholarApiKey && currentEasyScholarVerified) {
        updateEasyScholarApiKeyHint('Verified. Journal Query is available.', 'status--success');
        setStatus(sidDisplay, 'EasyScholar key already verified', 'status--success');
        syncEasyScholarStateToActiveTab(key, true);
        return;
      }
      setEasyScholarStoredState(
        key,
        false,
        key ? 'Key saved. Test must pass before Journal Query is visible.' : 'EasyScholar key cleared.',
        key ? 'status--info' : 'status--muted',
        key ? 'EasyScholar key saved, verification required' : 'EasyScholar key cleared',
        key ? 'status--info' : 'status--muted'
      );
    };

    const testEasyScholarApiKey = async (apiKey) => {
      const key = (apiKey || '').trim();
      if (!key) {
        updateEasyScholarApiKeyHint('Enter an EasyScholar API key first.', 'status--error');
        setStatus(sidDisplay, 'EasyScholar key missing', 'status--error');
        return false;
      }

      updateEasyScholarApiKeyHint('Testing EasyScholar API key...', 'status--info');
      setStatus(sidDisplay, 'Testing EasyScholar key...', 'status--info');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const url = `https://www.easyscholar.cc/open/getPublicationRank?secretKey=${encodeURIComponent(key)}&publicationName=${encodeURIComponent('Nature')}`;
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data?.code === 200) {
          setEasyScholarStoredState(
            key,
            true,
            'Verification passed. Journal Query is now available.',
            'status--success',
            'EasyScholar key verified',
            'status--success'
          );
          return true;
        }

        setEasyScholarStoredState(
          key,
          false,
          data?.message || 'Verification failed.',
          'status--error',
          'EasyScholar verification failed',
          'status--error'
        );
        return false;
      } catch (error) {
        clearTimeout(timeoutId);
        setEasyScholarStoredState(
          key,
          false,
          error?.name === 'AbortError' ? 'EasyScholar test timed out.' : 'Verification failed. Check the key and try again.',
          'status--error',
          'EasyScholar verification failed',
          'status--error'
        );
        return false;
      }
    };

    if (apiKeyInput) {
      chrome.storage.local.get([CHAT_API_KEY_STORAGE_KEY], result => {
        apiKeyInput.value = result[CHAT_API_KEY_STORAGE_KEY] || '';
        updateApiKeyHint('Loaded from extension storage.', 'status--muted');
      });

      apiKeyInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveApiKey(apiKeyInput.value.trim());
        }
      });

      apiKeyInput.addEventListener('blur', () => {
        saveApiKey(apiKeyInput.value.trim());
      });
    }

    if (easyScholarApiKeyInput) {
      chrome.storage.local.get([EASYSCHOLAR_API_KEY_STORAGE_KEY], result => {
        currentEasyScholarApiKey = result[EASYSCHOLAR_API_KEY_STORAGE_KEY] || '';
        easyScholarApiKeyInput.value = currentEasyScholarApiKey;
      });
      chrome.storage.local.get([EASYSCHOLAR_API_KEY_VERIFIED_STORAGE_KEY], result => {
        const verified = Boolean(result[EASYSCHOLAR_API_KEY_VERIFIED_STORAGE_KEY]);
        currentEasyScholarVerified = verified;
        updateEasyScholarApiKeyHint(
          verified ? 'Verified. Journal Query is available.' : 'Only verified keys can enable Journal Query.',
          verified ? 'status--success' : 'status--muted'
        );
      });

      easyScholarApiKeyInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveEasyScholarApiKey(easyScholarApiKeyInput.value.trim());
        }
      });

      easyScholarApiKeyInput.addEventListener('blur', () => {
        saveEasyScholarApiKey(easyScholarApiKeyInput.value.trim());
      });
    }

    const updateChatModelHint = (message, variant) => {
      if (!chatModelHint) return;
      chatModelHint.textContent = message;
      chatModelHint.classList.remove(...statusClasses);
      if (variant) {
        chatModelHint.classList.add(variant);
      }
    };

    const updateWosQueryProviderHint = (message, variant) => {
      if (!wosQueryProviderHint) return;
      wosQueryProviderHint.textContent = message;
      wosQueryProviderHint.classList.remove(...statusClasses);
      if (variant) {
        wosQueryProviderHint.classList.add(variant);
      }
    };

    const updateLmStudioHint = (message, variant) => {
      if (!lmStudioHint) return;
      lmStudioHint.textContent = message;
      lmStudioHint.classList.remove(...statusClasses);
      if (variant) {
        lmStudioHint.classList.add(variant);
      }
    };

    const getCurrentProviderVerified = () => (
      currentWosQueryProvider === 'lmstudio' ? currentLmStudioVerified : currentOpenAIVerified
    );

    const syncWosQueryAccessToTab = (tabId, detail, onComplete) => {
      if (!chrome.scripting || !chrome.scripting.executeScript) {
        onComplete(new Error('chrome.scripting is unavailable'));
        return;
      }
      chrome.scripting.executeScript(
        {
          target: { tabId },
          world: 'MAIN',
          func: (syncDetail, eventName) => {
            document.dispatchEvent(new CustomEvent(eventName, {
              detail: syncDetail
            }));
          },
          args: [detail, WOS_QUERY_ACCESS_SYNC_EVENT],
        },
        () => {
          if (chrome.runtime.lastError) {
            onComplete(new Error(chrome.runtime.lastError.message));
            return;
          }
          onComplete(null);
        }
      );
    };

    const syncWosQueryAccessToActiveTab = () => {
      const detail = {
        provider: currentWosQueryProvider,
        enabled: currentWosQueryEnabled,
        verified: getCurrentProviderVerified()
      };
      withActiveTab((tab) => {
        if (!tab) return;
        syncWosQueryAccessToTab(tab.id, detail, (error) => {
          if (error) {
            console.warn('Failed to sync WOS query access to page:', error.message);
          }
        });
      });
    };

    const updateWosQueryAccessHint = () => {
      const providerLabel = currentWosQueryProvider === 'lmstudio' ? 'LM Studio' : 'OpenAI';
      if (!currentWosQueryEnabled) {
        updateWosQueryProviderHint('WOS Query is disabled. Turn it on to allow the tab to appear.', 'status--muted');
        return;
      }
      if (!getCurrentProviderVerified()) {
        updateWosQueryProviderHint(`${providerLabel} is selected, but it must pass Test before WOS Query appears.`, 'status--info');
        return;
      }
      updateWosQueryProviderHint(`WOS Query is enabled and verified with ${providerLabel}.`, 'status--success');
    };

    const setProviderVerifiedState = (provider, verified) => {
      const storageKey = provider === 'lmstudio'
        ? WOS_QUERY_LMSTUDIO_VERIFIED_STORAGE_KEY
        : WOS_QUERY_OPENAI_VERIFIED_STORAGE_KEY;
      if (provider === 'lmstudio') {
        currentLmStudioVerified = Boolean(verified);
      } else {
        currentOpenAIVerified = Boolean(verified);
      }
      chrome.storage.local.set({ [storageKey]: Boolean(verified) }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to persist provider verified state:', chrome.runtime.lastError.message);
          return;
        }
        updateWosQueryAccessHint();
        syncWosQueryAccessToActiveTab();
      });
    };

    const updateProviderVisibility = () => {
      if (!wosQueryProviderSelect || !lmStudioSettingsSection || !openaiApiSettingsSection || !openaiModelSettingsSection) return;
      const isEnabled = Boolean(currentWosQueryEnabled);
      const isLmStudio = wosQueryProviderSelect.value === 'lmstudio';
      if (wosQueryProviderDetails) {
        wosQueryProviderDetails.style.display = isEnabled ? 'block' : 'none';
      }
      openaiApiSettingsSection.style.display = isLmStudio ? 'none' : 'flex';
      openaiModelSettingsSection.style.display = isLmStudio ? 'none' : 'flex';
      lmStudioSettingsSection.style.display = isLmStudio ? 'flex' : 'none';
      if (!isEnabled) {
        openaiApiSettingsSection.style.display = 'none';
        openaiModelSettingsSection.style.display = 'none';
        lmStudioSettingsSection.style.display = 'none';
      }
      currentWosQueryProvider = wosQueryProviderSelect.value || 'openai';
      updateWosQueryAccessHint();
    };

    const saveWosQueryProvider = (provider) => {
      currentWosQueryProvider = provider || 'openai';
      chrome.storage.local.set({ [WOS_QUERY_PROVIDER_STORAGE_KEY]: currentWosQueryProvider }, () => {
        if (chrome.runtime.lastError) {
          updateWosQueryProviderHint('Failed to save provider.', 'status--error');
          setStatus(sidDisplay, 'Failed to save WOS provider', 'status--error');
          return;
        }
        updateProviderVisibility();
        syncWosQueryAccessToActiveTab();
        setStatus(sidDisplay, `WOS Query provider: ${currentWosQueryProvider === 'lmstudio' ? 'LM Studio' : 'OpenAI'}`, 'status--success');
      });
    };

    const saveWosQueryEnabled = (enabled) => {
      currentWosQueryEnabled = Boolean(enabled);
      chrome.storage.local.set({ [WOS_QUERY_ENABLED_STORAGE_KEY]: currentWosQueryEnabled }, () => {
        if (chrome.runtime.lastError) {
          updateWosQueryProviderHint('Failed to save WOS Query enabled state.', 'status--error');
          setStatus(sidDisplay, 'Failed to save WOS Query state', 'status--error');
          return;
        }
        if (wosQueryProviderEnabledToggle) {
          wosQueryProviderEnabledToggle.checked = currentWosQueryEnabled;
        }
        updateProviderVisibility();
        updateWosQueryAccessHint();
        syncWosQueryAccessToActiveTab();
        setStatus(sidDisplay, currentWosQueryEnabled ? 'WOS Query enabled' : 'WOS Query disabled', currentWosQueryEnabled ? 'status--success' : 'status--muted');
      });
    };

    const saveLmStudioSettings = () => {
      const baseUrl = (lmStudioBaseUrlInput?.value || '').trim() || 'http://127.0.0.1:1234/v1';
      const model = (lmStudioModelInput?.value || '').trim();
      const apiKey = (lmStudioApiKeyInput?.value || '').trim();

      chrome.storage.local.set({
        [LM_STUDIO_BASE_URL_STORAGE_KEY]: baseUrl,
        [LM_STUDIO_MODEL_STORAGE_KEY]: model,
        [LM_STUDIO_API_KEY_STORAGE_KEY]: apiKey
      }, () => {
        if (chrome.runtime.lastError) {
          updateLmStudioHint('Failed to save LM Studio settings.', 'status--error');
          setStatus(sidDisplay, 'Failed to save LM Studio settings', 'status--error');
          return;
        }
        if (lmStudioBaseUrlInput) lmStudioBaseUrlInput.value = baseUrl;
        setProviderVerifiedState('lmstudio', false);
        updateLmStudioHint('LM Studio settings saved. Test again to enable WOS Query.', 'status--info');
        setStatus(sidDisplay, 'LM Studio settings saved, verification reset', 'status--info');
      });
    };

    const testLmStudioSettings = async () => {
      const baseUrl = ((lmStudioBaseUrlInput?.value || '').trim() || 'http://127.0.0.1:1234/v1').replace(/\/$/, '');
      const model = (lmStudioModelInput?.value || '').trim();
      const apiKey = (lmStudioApiKeyInput?.value || '').trim();

      if (!model) {
        updateLmStudioHint('Enter an LM Studio model id first.', 'status--error');
        setStatus(sidDisplay, 'LM Studio model missing', 'status--error');
        return false;
      }

      updateLmStudioHint('Testing LM Studio...', 'status--info');
      setStatus(sidDisplay, 'Testing LM Studio...', 'status--info');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Say OK.' }],
            temperature: 0,
            max_tokens: 16
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          setProviderVerifiedState('lmstudio', false);
          updateLmStudioHint('LM Studio test failed. Check URL or model.', 'status--error');
          setStatus(sidDisplay, `LM Studio test failed: ${response.status}`, 'status--error');
          console.error('LM Studio test failed:', errorText);
          return false;
        }

        setProviderVerifiedState('lmstudio', true);
        updateLmStudioHint('LM Studio connection succeeded.', 'status--success');
        setStatus(sidDisplay, 'LM Studio test succeeded', 'status--success');
        return true;
      } catch (error) {
        clearTimeout(timeoutId);
        const message = error.name === 'AbortError' ? 'LM Studio test timed out.' : 'LM Studio test failed.';
        setProviderVerifiedState('lmstudio', false);
        updateLmStudioHint(message, 'status--error');
        setStatus(sidDisplay, message, 'status--error');
        return false;
      }
    };

    const saveChatModel = (model) => {
      chrome.storage.local.set({ [CHAT_MODEL_STORAGE_KEY]: model }, () => {
        if (chrome.runtime.lastError) {
          updateChatModelHint('Failed to save model.', 'status--error');
          setStatus(sidDisplay, 'Failed to save model', 'status--error');
          return;
        }
        setProviderVerifiedState('openai', false);
        updateChatModelHint('Model saved. Test again to enable WOS Query.', 'status--info');
        setStatus(sidDisplay, 'Chat model saved, verification reset', 'status--info');
      });
    };

    const getSelectedModel = () => {
      if (!chatModelSelect) return 'gpt-4o-mini';
      if (chatModelSelect.value !== '__custom__') {
        return chatModelSelect.value;
      }
      return (chatModelCustomInput?.value || '').trim();
    };

    const updateCustomVisibility = () => {
      if (!chatModelCustomRow || !chatModelSelect) return;
      const show = chatModelSelect.value === '__custom__';
      chatModelCustomRow.style.display = show ? 'flex' : 'none';
      if (!show) {
        updateChatModelHint('Applies to all chat requests.', 'status--muted');
      }
    };

    if (chatModelSelect) {
      chrome.storage.local.get([CHAT_MODEL_STORAGE_KEY], result => {
        const storedModel = result[CHAT_MODEL_STORAGE_KEY] || 'gpt-4o-mini';
        const knownModels = ['gpt-4o-mini', 'gpt-5-nano'];
        if (knownModels.includes(storedModel)) {
          chatModelSelect.value = storedModel;
        } else {
          chatModelSelect.value = '__custom__';
          if (chatModelCustomInput) {
            chatModelCustomInput.value = storedModel;
          }
        }
        updateCustomVisibility();
        updateChatModelHint('Loaded from extension storage.', 'status--muted');
      });

      chatModelSelect.addEventListener('change', () => {
        updateCustomVisibility();
        const model = getSelectedModel();
        if (!model) {
          updateChatModelHint('Enter a custom model id.', 'status--error');
          return;
        }
        saveChatModel(model);
      });
    }

    if (wosQueryProviderSelect) {
      chrome.storage.local.get([
        WOS_QUERY_PROVIDER_STORAGE_KEY,
        WOS_QUERY_ENABLED_STORAGE_KEY,
        WOS_QUERY_OPENAI_VERIFIED_STORAGE_KEY,
        WOS_QUERY_LMSTUDIO_VERIFIED_STORAGE_KEY
      ], result => {
        currentWosQueryProvider = result[WOS_QUERY_PROVIDER_STORAGE_KEY] || 'openai';
        currentWosQueryEnabled = Boolean(result[WOS_QUERY_ENABLED_STORAGE_KEY]);
        currentOpenAIVerified = Boolean(result[WOS_QUERY_OPENAI_VERIFIED_STORAGE_KEY]);
        currentLmStudioVerified = Boolean(result[WOS_QUERY_LMSTUDIO_VERIFIED_STORAGE_KEY]);
        wosQueryProviderSelect.value = currentWosQueryProvider;
        if (wosQueryProviderEnabledToggle) {
          wosQueryProviderEnabledToggle.checked = currentWosQueryEnabled;
        }
        updateProviderVisibility();
      });
      wosQueryProviderSelect.addEventListener('change', () => {
        saveWosQueryProvider(wosQueryProviderSelect.value);
      });
    }

    if (wosQueryProviderEnabledToggle) {
      wosQueryProviderEnabledToggle.addEventListener('change', () => {
        saveWosQueryEnabled(wosQueryProviderEnabledToggle.checked);
      });
    }

    if (lmStudioBaseUrlInput) {
      chrome.storage.local.get([LM_STUDIO_BASE_URL_STORAGE_KEY, LM_STUDIO_MODEL_STORAGE_KEY, LM_STUDIO_API_KEY_STORAGE_KEY], result => {
        lmStudioBaseUrlInput.value = result[LM_STUDIO_BASE_URL_STORAGE_KEY] || 'http://127.0.0.1:1234/v1';
        if (lmStudioModelInput) {
          lmStudioModelInput.value = result[LM_STUDIO_MODEL_STORAGE_KEY] || '';
        }
        if (lmStudioApiKeyInput) {
          lmStudioApiKeyInput.value = result[LM_STUDIO_API_KEY_STORAGE_KEY] || '';
        }
        updateLmStudioHint('Used only when provider is set to LM Studio.', 'status--muted');
      });

      lmStudioBaseUrlInput.addEventListener('blur', saveLmStudioSettings);
      lmStudioBaseUrlInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveLmStudioSettings();
        }
      });
    }

    if (lmStudioModelInput) {
      lmStudioModelInput.addEventListener('blur', saveLmStudioSettings);
      lmStudioModelInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveLmStudioSettings();
        }
      });
    }

    if (lmStudioApiKeyInput) {
      lmStudioApiKeyInput.addEventListener('blur', saveLmStudioSettings);
      lmStudioApiKeyInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveLmStudioSettings();
        }
      });
    }

    if (chatModelCustomInput) {
      chatModelCustomInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const model = getSelectedModel();
          if (!model) {
            updateChatModelHint('Enter a custom model id.', 'status--error');
            return;
          }
          saveChatModel(model);
        }
      });
      chatModelCustomInput.addEventListener('blur', () => {
        if (chatModelSelect?.value !== '__custom__') return;
        const model = getSelectedModel();
        if (!model) return;
        saveChatModel(model);
      });
    }

    if (chatModelTestBtn) {
      chatModelTestBtn.addEventListener('click', () => {
        chrome.storage.local.get([CHAT_API_KEY_STORAGE_KEY, CHAT_MODEL_STORAGE_KEY], async result => {
          const apiKey = result[CHAT_API_KEY_STORAGE_KEY] || '';
          const model = result[CHAT_MODEL_STORAGE_KEY] || getSelectedModel();
          if (!apiKey) {
            updateChatModelHint('API key missing.', 'status--error');
            setStatus(sidDisplay, 'API key missing', 'status--error');
            return;
          }
          if (!model) {
            updateChatModelHint('Model missing.', 'status--error');
            setStatus(sidDisplay, 'Model missing', 'status--error');
            return;
          }

          updateChatModelHint('Testing model...', 'status--info');
          setStatus(sidDisplay, 'Testing model...', 'status--info');

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          try {
            const response = await fetch('https://api.openai.com/v1/responses', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model,
                input: 'Say OK.'
              }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorText = await response.text();
              setProviderVerifiedState('openai', false);
              updateChatModelHint('Test failed. Check model or key.', 'status--error');
              setStatus(sidDisplay, `Test failed: ${response.status}`, 'status--error');
              console.error('Model test failed:', errorText);
              return;
            }

            setProviderVerifiedState('openai', true);
            updateChatModelHint('Test succeeded.', 'status--success');
            setStatus(sidDisplay, 'Model test succeeded', 'status--success');
          } catch (error) {
            clearTimeout(timeoutId);
            const message = error.name === 'AbortError' ? 'Test timed out.' : 'Test failed.';
            setProviderVerifiedState('openai', false);
            updateChatModelHint(message, 'status--error');
            setStatus(sidDisplay, message, 'status--error');
          }
        });
      });
    }

    if (apiKeySaveBtn) {
      apiKeySaveBtn.addEventListener('click', () => {
        saveApiKey((apiKeyInput?.value || '').trim());
      });
    }

    if (apiKeyClearBtn) {
      apiKeyClearBtn.addEventListener('click', () => {
        if (apiKeyInput) {
          apiKeyInput.value = '';
        }
        saveApiKey('');
      });
    }

    if (apiKeyToggleBtn && apiKeyInput) {
      apiKeyToggleBtn.addEventListener('click', () => {
        const isHidden = apiKeyInput.type === 'password';
        apiKeyInput.type = isHidden ? 'text' : 'password';
        const icon = apiKeyToggleBtn.querySelector('i');
        if (icon) {
          icon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        }
      });
    }

    if (easyScholarApiKeySaveBtn) {
      easyScholarApiKeySaveBtn.addEventListener('click', () => {
        saveEasyScholarApiKey((easyScholarApiKeyInput?.value || '').trim());
      });
    }

    if (easyScholarApiKeyTestBtn) {
      easyScholarApiKeyTestBtn.addEventListener('click', async () => {
        await testEasyScholarApiKey((easyScholarApiKeyInput?.value || '').trim());
      });
    }

    if (easyScholarApiKeyClearBtn) {
      easyScholarApiKeyClearBtn.addEventListener('click', () => {
        if (easyScholarApiKeyInput) {
          easyScholarApiKeyInput.value = '';
        }
        saveEasyScholarApiKey('');
      });
    }

    if (easyScholarApiKeyToggleBtn && easyScholarApiKeyInput) {
      easyScholarApiKeyToggleBtn.addEventListener('click', () => {
        const isHidden = easyScholarApiKeyInput.type === 'password';
        easyScholarApiKeyInput.type = isHidden ? 'text' : 'password';
        const icon = easyScholarApiKeyToggleBtn.querySelector('i');
        if (icon) {
          icon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        }
      });
    }

    if (easyScholarWebsiteBtn) {
      easyScholarWebsiteBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://www.easyscholar.cc/' });
      });
    }

    if (lmStudioApiKeyToggle && lmStudioApiKeyInput) {
      lmStudioApiKeyToggle.addEventListener('click', () => {
        const isHidden = lmStudioApiKeyInput.type === 'password';
        lmStudioApiKeyInput.type = isHidden ? 'text' : 'password';
        const icon = lmStudioApiKeyToggle.querySelector('i');
        if (icon) {
          icon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        }
      });
    }

    if (lmStudioSaveBtn) {
      lmStudioSaveBtn.addEventListener('click', () => {
        saveLmStudioSettings();
      });
    }

    if (lmStudioTestBtn) {
      lmStudioTestBtn.addEventListener('click', async () => {
        await testLmStudioSettings();
      });
    }


    openWosDoiQueryBtn.addEventListener('click', () => {
      isWosDoiQueryEnabled = !isWosDoiQueryEnabled;
      setWosDoiQueryToggle(openWosDoiQueryBtn, isWosDoiQueryEnabled);

      withActiveTab((tab) => {
        if (!tab) {
          setStatus(sidDisplay, 'No active tab detected', 'status--error');
          return;
        }
        chrome.tabs.sendMessage(
          tab.id,
          { type: isWosDoiQueryEnabled ? 'OPEN_WOS_DOI_QUERY' : 'CLOSE_WOS_DOI_QUERY' },
          response => {
            if (chrome.runtime.lastError) {
              setStatus(sidDisplay, 'Error: ' + chrome.runtime.lastError.message, 'status--error');
              return;
            }
            if (response && response.success) {
              setStatus(
                sidDisplay,
                isWosDoiQueryEnabled ? 'DOI batch query enabled' : 'DOI batch query disabled',
                'status--success'
              );
            } else {
              setStatus(sidDisplay, 'Failed to toggle DOI batch query', 'status--error');
            }
          }
        );
      });
    });

    openDoiPdfDownloadBtn.addEventListener('click', () => {
      isDoiPdfDownloadEnabled = !isDoiPdfDownloadEnabled;
      setDoiPdfDownloadToggle(openDoiPdfDownloadBtn, isDoiPdfDownloadEnabled);

      withActiveTab((tab) => {
        if (!tab) {
          setStatus(sidDisplay, 'No active tab detected', 'status--error');
          return;
        }
        chrome.tabs.sendMessage(
          tab.id,
          { type: isDoiPdfDownloadEnabled ? 'OPEN_DOI_PDF_DOWNLOAD' : 'CLOSE_DOI_PDF_DOWNLOAD' },
          response => {
            if (chrome.runtime.lastError) {
              setStatus(sidDisplay, 'Error: ' + chrome.runtime.lastError.message, 'status--error');
              return;
            }
            if (response && response.success) {
              setStatus(
                sidDisplay,
                isDoiPdfDownloadEnabled ? 'DOI PDF download enabled' : 'DOI PDF download disabled',
                'status--success'
              );
            } else {
              setStatus(sidDisplay, 'Failed to toggle DOI PDF download', 'status--error');
            }
          }
        );
      });
    });

    const setPanelCollapsed = (bodyElement, toggleElement, storageKey, collapsed) => {
      if (!bodyElement || !toggleElement) return;
      bodyElement.classList.toggle('is-collapsed', collapsed);
      toggleElement.classList.toggle('is-collapsed', collapsed);
      toggleElement.setAttribute('aria-expanded', String(!collapsed));
      localStorage.setItem(storageKey, String(collapsed));
    };

    if (openaiSettingsToggle) {
      const isCollapsed = localStorage.getItem(OPENAI_SETTINGS_COLLAPSED_KEY) === 'true';
      setPanelCollapsed(openaiSettingsBody, openaiSettingsToggle, OPENAI_SETTINGS_COLLAPSED_KEY, isCollapsed);
      openaiSettingsToggle.addEventListener('click', () => {
        const nowCollapsed = !openaiSettingsBody || !openaiSettingsBody.classList.contains('is-collapsed');
        setPanelCollapsed(openaiSettingsBody, openaiSettingsToggle, OPENAI_SETTINGS_COLLAPSED_KEY, nowCollapsed);
      });
    }

    if (easyScholarSettingsToggle) {
      const isCollapsed = localStorage.getItem(EASYSCHOLAR_SETTINGS_COLLAPSED_KEY) === 'true';
      setPanelCollapsed(easyScholarSettingsBody, easyScholarSettingsToggle, EASYSCHOLAR_SETTINGS_COLLAPSED_KEY, isCollapsed);
      easyScholarSettingsToggle.addEventListener('click', () => {
        const nowCollapsed = !easyScholarSettingsBody || !easyScholarSettingsBody.classList.contains('is-collapsed');
        setPanelCollapsed(
          easyScholarSettingsBody,
          easyScholarSettingsToggle,
          EASYSCHOLAR_SETTINGS_COLLAPSED_KEY,
          nowCollapsed
        );
      });
    }

  });

  // Communicate with background file by sending a message
  chrome.runtime.sendMessage(
    {
      type: 'GREETINGS',
      payload: {
        message: 'Hello, my name is Pop. I am from Popup.',
      },
    },
    response => {
      console.log(response.message);
    }
  );
})();
