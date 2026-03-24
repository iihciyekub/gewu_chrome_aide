'use strict';

import './popup.css';

(function() {
  const CHAT_API_KEY_STORAGE_KEY = 'wosOpenaiApiKey';
  const CHAT_MODEL_STORAGE_KEY = 'wosOpenaiChatModel';
  const OPENAI_SETTINGS_COLLAPSED_KEY = 'wosOpenaiSettingsCollapsed';

  // ========== Status Management ==========
  const statusClasses = ['status--success', 'status--error', 'status--info', 'status--muted'];

  const setStatus = (element, message, variant) => {
    element.textContent = message;
    element.classList.remove(...statusClasses);
    if (variant) {
      element.classList.add(variant);
    }
  };

  const setEasyScholarToggle = (button, enabled) => {
    const icon = button.querySelector('i');
    const label = button.querySelector('.button-label');
    if (enabled) {
      icon.className = 'fa-solid fa-toggle-on';
      label.textContent = 'Disable EasyScholar';
    } else {
      icon.className = 'fa-solid fa-toggle-off';
      label.textContent = 'Enable EasyScholar';
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

  const setOpenAIChatToggle = (button, enabled) => {
    const icon = button.querySelector('i');
    const label = button.querySelector('.button-label');
    if (enabled) {
      icon.className = 'fa-solid fa-toggle-on';
      label.textContent = 'Disable OpenAI Chat';
    } else {
      icon.className = 'fa-solid fa-toggle-off';
      label.textContent = 'Enable OpenAI Chat';
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

    const apiKeyInput = document.getElementById('openaiApiKeyInput');
    const apiKeyToggleBtn = document.getElementById('openaiApiKeyToggle');
    const apiKeySaveBtn = document.getElementById('openaiApiKeySaveBtn');
    const apiKeyClearBtn = document.getElementById('openaiApiKeyClearBtn');
    const apiKeyHint = document.getElementById('openaiApiKeyHint');
    const chatModelSelect = document.getElementById('openaiChatModelSelect');
    const chatModelHint = document.getElementById('openaiChatModelHint');
    const chatModelCustomRow = document.getElementById('openaiChatModelCustomRow');
    const chatModelCustomInput = document.getElementById('openaiChatModelCustomInput');
    const chatModelTestBtn = document.getElementById('openaiChatModelTestBtn');

    const openEasyScholarBtn = document.getElementById('openEasyScholarBtn');
    const openWosDoiQueryBtn = document.getElementById('openWosDoiQueryBtn');
    const openDoiPdfDownloadBtn = document.getElementById('openDoiPdfDownloadBtn');
    const openOpenAIChatBtn = document.getElementById('openOpenAIChatBtn');
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
        doiListDisplay.textContent = 'No DOI received';
        clearDoiBtn.disabled = true;
        clearDoiBtn.classList.add('button--disabled');
      } else {
        doiListDisplay.innerHTML = `<b>Received DOI list: ${list.length} DOIs</b>`;
        clearDoiBtn.disabled = false;
        clearDoiBtn.classList.remove('button--disabled');
      }
    }

    // 初始状态
    doiListDisplay.textContent = 'DOI列表更新中...';
    clearDoiBtn.disabled = true;
    clearDoiBtn.classList.add('button--disabled');

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
    let isEasyScholarEnabled = false;
    let isWosDoiQueryEnabled = false;
    let isDoiPdfDownloadEnabled = false;
    let isOpenAIChatEnabled = false;

    // 初始化按钮状态为 Enable（未开启）
    setEasyScholarToggle(openEasyScholarBtn, false);
    setWosDoiQueryToggle(openWosDoiQueryBtn, false);
    setDoiPdfDownloadToggle(openDoiPdfDownloadBtn, false);
    setOpenAIChatToggle(openOpenAIChatBtn, false);

    const updateApiKeyHint = (message, variant) => {
      if (!apiKeyHint) return;
      apiKeyHint.textContent = message;
      apiKeyHint.classList.remove(...statusClasses);
      if (variant) {
        apiKeyHint.classList.add(variant);
      }
    };

    const saveApiKey = (apiKey) => {
      chrome.storage.local.set({ [CHAT_API_KEY_STORAGE_KEY]: apiKey }, () => {
        if (chrome.runtime.lastError) {
          updateApiKeyHint('Failed to save API key.', 'status--error');
          setStatus(sidDisplay, 'Failed to save API key', 'status--error');
          return;
        }
        updateApiKeyHint('API key saved for all pages.', 'status--success');
        setStatus(sidDisplay, 'API key saved', 'status--success');
      });
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

    const updateChatModelHint = (message, variant) => {
      if (!chatModelHint) return;
      chatModelHint.textContent = message;
      chatModelHint.classList.remove(...statusClasses);
      if (variant) {
        chatModelHint.classList.add(variant);
      }
    };

    const saveChatModel = (model) => {
      chrome.storage.local.set({ [CHAT_MODEL_STORAGE_KEY]: model }, () => {
        if (chrome.runtime.lastError) {
          updateChatModelHint('Failed to save model.', 'status--error');
          setStatus(sidDisplay, 'Failed to save model', 'status--error');
          return;
        }
        updateChatModelHint('Model saved for all pages.', 'status--success');
        setStatus(sidDisplay, 'Chat model saved', 'status--success');
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
              updateChatModelHint('Test failed. Check model or key.', 'status--error');
              setStatus(sidDisplay, `Test failed: ${response.status}`, 'status--error');
              console.error('Model test failed:', errorText);
              return;
            }

            updateChatModelHint('Test succeeded.', 'status--success');
            setStatus(sidDisplay, 'Model test succeeded', 'status--success');
          } catch (error) {
            clearTimeout(timeoutId);
            const message = error.name === 'AbortError' ? 'Test timed out.' : 'Test failed.';
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


    openEasyScholarBtn.addEventListener('click', () => {
      isEasyScholarEnabled = !isEasyScholarEnabled;
      setEasyScholarToggle(openEasyScholarBtn, isEasyScholarEnabled);

      withActiveTab((tab) => {
        if (!tab) {
          setStatus(sidDisplay, 'No active tab detected', 'status--error');
          return;
        }
        chrome.tabs.sendMessage(
          tab.id,
          { type: isEasyScholarEnabled ? 'OPEN_EASYSCHOLAR' : 'CLOSE_EASYSCHOLAR' },
          response => {
            if (chrome.runtime.lastError) {
              setStatus(sidDisplay, 'Error: ' + chrome.runtime.lastError.message, 'status--error');
              return;
            }
            if (response && response.success) {
              setStatus(
                sidDisplay,
                isEasyScholarEnabled ? 'EasyScholar enabled' : 'EasyScholar disabled',
                'status--success'
              );
            } else {
              setStatus(sidDisplay, 'Failed to toggle EasyScholar', 'status--error');
            }
          }
        );
      });
    });

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

    openOpenAIChatBtn.addEventListener('click', () => {
      isOpenAIChatEnabled = !isOpenAIChatEnabled;
      setOpenAIChatToggle(openOpenAIChatBtn, isOpenAIChatEnabled);

      withActiveTab((tab) => {
        if (!tab) {
          setStatus(sidDisplay, 'No active tab detected', 'status--error');
          return;
        }
        chrome.tabs.sendMessage(
          tab.id,
          { type: isOpenAIChatEnabled ? 'OPEN_OPENAI_CHAT' : 'CLOSE_OPENAI_CHAT' },
          response => {
            if (chrome.runtime.lastError) {
              setStatus(sidDisplay, 'Error: ' + chrome.runtime.lastError.message, 'status--error');
              return;
            }
            if (response && response.success) {
              setStatus(
                sidDisplay,
                isOpenAIChatEnabled ? 'OpenAI chat enabled' : 'OpenAI chat disabled',
                'status--success'
              );
            } else {
              setStatus(sidDisplay, 'Failed to toggle OpenAI chat', 'status--error');
            }
          }
        );
      });
    });

    const setOpenaiPanelCollapsed = (collapsed) => {
      if (!openaiSettingsBody || !openaiSettingsToggle) return;
      openaiSettingsBody.classList.toggle('is-collapsed', collapsed);
      openaiSettingsToggle.classList.toggle('is-collapsed', collapsed);
      openaiSettingsToggle.setAttribute('aria-expanded', String(!collapsed));
      localStorage.setItem(OPENAI_SETTINGS_COLLAPSED_KEY, String(collapsed));
    };

    if (openaiSettingsToggle) {
      const isCollapsed = localStorage.getItem(OPENAI_SETTINGS_COLLAPSED_KEY) === 'true';
      setOpenaiPanelCollapsed(isCollapsed);
      openaiSettingsToggle.addEventListener('click', () => {
        const nowCollapsed = !openaiSettingsBody || !openaiSettingsBody.classList.contains('is-collapsed');
        setOpenaiPanelCollapsed(nowCollapsed);
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
