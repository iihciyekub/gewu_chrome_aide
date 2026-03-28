(function () {
  'use strict';

  const BUTTON_COUNT = 10;
  const STORAGE_KEY = 'wosaide-chatgpt-quickload-prompts';
  const TITLE_KEY = 'wosaide-chatgpt-quickload-titles';
  const CONTAINER_SELECTOR = '#thread-bottom > div > div > div.pointer-events-auto.relative.z-1.flex.h-\\(--composer-container-height\\,100\\%\\).max-w-full.flex-\\(--composer-container-flex\\,1\\).flex-col > form > div:nth-child(2) > div > div.-m-1.max-w-full.overflow-x-auto.p-1.\\[grid-area\\:footer\\].\\[scrollbar-width\\:none\\] > div.flex.min-w-fit.items-center.cant-hover\\:px-1\\.5.cant-hover\\:gap-1\\.5';
  const HOST_DATA_ATTR = 'data-wosaide-quickload-host';
  const TEXTAREA_SELECTOR = '#prompt-textarea, textarea[data-testid="prompt-textarea"], textarea[name="prompt"]';
  const CONTENTEDITABLE_SELECTOR = '[contenteditable="true"][data-testid="prompt-textarea"], [contenteditable="true"][aria-label="Message"], [contenteditable="true"][role="textbox"]';
  const WRAP_DATA_ATTR = 'data-wosaide-quickload';
  const POPOVER_ID = 'wosaide-quickload-popover';
  let popoverEscHandler = null;
  let cachedPromptTarget = null;
  let cachedPromptType = null;
  let lastDeepSearchAt = 0;

  const isLocalStorageAvailable = (() => {
    try {
      const probeKey = '__wosaide_storage_probe__';
      localStorage.setItem(probeKey, '1');
      localStorage.removeItem(probeKey);
      return true;
    } catch (e) {
      return false;
    }
  })();

  const requestStorage = (action, key, value) => new Promise((resolve) => {
    const requestId = `wosaide-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const handler = (event) => {
      if (!event?.data || event.data.type !== 'WOS_AIDE_QUICKLOAD_STORAGE_RESPONSE') {
        return;
      }
      if (event.data.requestId !== requestId) {
        return;
      }
      window.removeEventListener('message', handler);
      resolve(event.data.value);
    };
    window.addEventListener('message', handler);
    window.postMessage({
      type: 'WOS_AIDE_QUICKLOAD_STORAGE',
      action,
      key,
      value,
      requestId,
    }, '*');
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, 1200);
  });

  const loadList = async (key, fallbackFactory) => {
    let raw = null;
    if (isLocalStorageAvailable) {
      try {
        raw = localStorage.getItem(key);
      } catch (e) {
        raw = null;
      }
    }
    if (raw == null) {
      raw = await requestStorage('get', key);
    }
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        const filled = fallbackFactory();
        parsed.slice(0, BUTTON_COUNT).forEach((value, index) => {
          filled[index] = typeof value === 'string' ? value : '';
        });
        return filled;
      }
    } catch (e) {
      // Ignore parse errors and fall back to defaults.
    }
    return fallbackFactory();
  };

  const saveList = (key, list) => {
    const payload = JSON.stringify(list);
    if (isLocalStorageAvailable) {
      try {
        localStorage.setItem(key, payload);
        return;
      } catch (e) {
        // Fall through to storage bridge.
      }
    }
    requestStorage('set', key, payload);
  };

  const loadPrompts = () => loadList(STORAGE_KEY, () => new Array(BUTTON_COUNT).fill(''));

  const loadTitles = () => loadList(
    TITLE_KEY,
    () => Array.from({ length: BUTTON_COUNT }, (_, i) => `Set prompt for P${i + 1}`)
  );

  const savePrompts = (prompts) => saveList(STORAGE_KEY, prompts);

  const saveTitles = (titles) => saveList(TITLE_KEY, titles);
  const setNativeValue = (element, value) => {
    const proto = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const clearProseMirror = (element) => {
    element.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    try {
      document.execCommand('delete');
    } catch (e) {
      // Ignore execCommand failures.
    }
    element.textContent = '';
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
  };

  const setProseMirrorByPaste = (element, text) => {
    element.focus();

    element.dispatchEvent(new InputEvent('beforeinput', {
      inputType: 'insertFromPaste',
      data: text,
      bubbles: true,
      cancelable: true,
    }));

    const dt = new DataTransfer();
    dt.setData('text/plain', text);

    element.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    }));

    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
  };

  const normalizeNewlines = (value) => (value || '').replace(/\r\n?/g, '\n');

  const setProseMirrorValue = (element, text) => {
    const content = normalizeNewlines(text);
    element.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    let inserted = false;
    if (content.includes('\n')) {
      inserted = false;
    } else {
      try {
        inserted = document.execCommand('insertText', false, content);
      } catch (e) {
        inserted = false;
      }
    }
    const hasText = () => normalizeNewlines(element.textContent || '').includes(content);
    if (!inserted || !hasText()) {
      clearProseMirror(element);
      setProseMirrorByPaste(element, content);
    }
    if (!hasText()) {
      setContentEditableValue(element, content);
    }
  };

  const setContentEditableValue = (element, value) => {
    const text = normalizeNewlines(value);
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      element.appendChild(document.createTextNode(line));
      if (index < lines.length - 1) {
        element.appendChild(document.createElement('br'));
      }
    });
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const deepQuerySelector = (selector, root = document) => {
    const direct = root.querySelector(selector);
    if (direct) return direct;
    const treeWalker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
      null
    );
    let node = treeWalker.currentNode;
    while (node) {
      if (node.shadowRoot) {
        const found = node.shadowRoot.querySelector(selector)
          || deepQuerySelector(selector, node.shadowRoot);
        if (found) return found;
      }
      node = treeWalker.nextNode();
    }
    return null;
  };

  const warmupPromptTarget = () => {
    if (cachedPromptTarget && cachedPromptTarget.isConnected) {
      return;
    }
    const now = Date.now();
    if (now - lastDeepSearchAt < 800) {
      return;
    }
    lastDeepSearchAt = now;
    let deep = deepQuerySelector('#prompt-textarea.ProseMirror');
    if (deep) {
      cachedPromptTarget = deep;
      cachedPromptType = 'prosemirror';
      return;
    }
    deep = deepQuerySelector(TEXTAREA_SELECTOR);
    if (deep) {
      cachedPromptTarget = deep;
      cachedPromptType = 'textarea';
      return;
    }
    deep = deepQuerySelector(CONTENTEDITABLE_SELECTOR);
    if (deep) {
      cachedPromptTarget = deep;
      cachedPromptType = 'contenteditable';
    }
  };

  const updateCacheFromElement = (element) => {
    if (!element) return;
    if (element.matches('#prompt-textarea.ProseMirror')) {
      cachedPromptTarget = element;
      cachedPromptType = 'prosemirror';
      return;
    }
    if (element.matches(TEXTAREA_SELECTOR)) {
      cachedPromptTarget = element;
      cachedPromptType = 'textarea';
      return;
    }
    if (element.matches(CONTENTEDITABLE_SELECTOR)) {
      cachedPromptTarget = element;
      cachedPromptType = 'contenteditable';
    }
  };

  document.addEventListener('focusin', (event) => {
    updateCacheFromElement(event.target);
  }, true);

  const getPromptTarget = () => {
    if (cachedPromptTarget && cachedPromptTarget.isConnected) {
      return { element: cachedPromptTarget, type: cachedPromptType };
    }

    const active = document.activeElement;
    if (active) {
      if (active.matches('#prompt-textarea.ProseMirror')) {
        cachedPromptTarget = active;
        cachedPromptType = 'prosemirror';
        return { element: active, type: 'prosemirror' };
      }
      if (active.matches(TEXTAREA_SELECTOR)) {
        cachedPromptTarget = active;
        cachedPromptType = 'textarea';
        return { element: active, type: 'textarea' };
      }
      if (active.matches(CONTENTEDITABLE_SELECTOR)) {
        cachedPromptTarget = active;
        cachedPromptType = 'contenteditable';
        return { element: active, type: 'contenteditable' };
      }
    }

    let el = document.querySelector('#prompt-textarea.ProseMirror');
    if (el) {
      cachedPromptTarget = el;
      cachedPromptType = 'prosemirror';
      return { element: el, type: 'prosemirror' };
    }
    el = document.querySelector(TEXTAREA_SELECTOR);
    if (el) {
      cachedPromptTarget = el;
      cachedPromptType = 'textarea';
      return { element: el, type: 'textarea' };
    }
    el = document.querySelector(CONTENTEDITABLE_SELECTOR);
    if (el) {
      cachedPromptTarget = el;
      cachedPromptType = 'contenteditable';
      return { element: el, type: 'contenteditable' };
    }

    // Avoid deep-searching on click for performance, but allow a fallback
    // when the input is rendered inside a shadow root.
    warmupPromptTarget();
    if (cachedPromptTarget && cachedPromptTarget.isConnected) {
      return { element: cachedPromptTarget, type: cachedPromptType };
    }

    return { element: null, type: null };
  };

  const applyPrompt = (promptText, attempt = 0) => {
    const normalizedPrompt = normalizeNewlines(promptText);
    const { element, type } = getPromptTarget();
    if (element && type === 'prosemirror') {
      setProseMirrorValue(element, normalizedPrompt);
      return;
    }
    if (element && type === 'textarea') {
      setNativeValue(element, '');
      setNativeValue(element, normalizedPrompt);
      element.focus();
      const length = element.value ? element.value.length : 0;
      if (typeof element.setSelectionRange === 'function') {
        element.setSelectionRange(length, length);
      }
      return;
    }
    if (element && type === 'contenteditable') {
      element.focus();
      setContentEditableValue(element, '');
      setContentEditableValue(element, normalizedPrompt);
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    if (attempt < 6) {
      setTimeout(() => applyPrompt(promptText, attempt + 1), 50);
      return;
    }
    console.warn('[Quickload] prompt input not found');
  };

  const updateButtonState = (button, promptText, titleText) => {
    const hasPrompt = Boolean(promptText && promptText.trim());
    const title = titleText && titleText.trim()
      ? titleText.trim()
      : 'Prompt';
    button.dataset.hasPrompt = hasPrompt ? '1' : '0';
    button.title = hasPrompt ? title : 'Right click to set prompt';
    button.style.opacity = hasPrompt ? '1' : '0.6';
  };

  const removePopover = () => {
    const existing = document.getElementById(POPOVER_ID);
    if (existing) {
      existing.remove();
    }
    if (popoverEscHandler) {
      document.removeEventListener('keydown', popoverEscHandler);
      popoverEscHandler = null;
    }
  };

  const showPopover = (button, index, prompts, titles, onSave) => {
    removePopover();

    const rect = button.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.id = POPOVER_ID;
    pop.style.position = 'fixed';
    pop.style.left = `${Math.max(8, rect.left)}px`;
    pop.style.top = `${Math.max(8, rect.top - 140)}px`;
    pop.style.zIndex = '999999';
    pop.style.background = '#fff';
    pop.style.color = '#111';
    pop.style.border = '1px solid rgba(0,0,0,0.15)';
    pop.style.borderRadius = '10px';
    pop.style.padding = '8px';
    pop.style.boxShadow = '0 10px 30px rgba(0,0,0,0.18)';
    pop.style.width = '450px';
    pop.style.fontFamily = 'inherit';

    const arrow = document.createElement('div');
    arrow.style.position = 'absolute';
    arrow.style.left = '14px';
    arrow.style.bottom = '-8px';
    arrow.style.width = '0';
    arrow.style.height = '0';
    arrow.style.borderLeft = '8px solid transparent';
    arrow.style.borderRight = '8px solid transparent';
    arrow.style.borderTop = '8px solid #fff';
    arrow.style.filter = 'drop-shadow(0 -1px 0 rgba(0,0,0,0.08))';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = titles[index] || `Set prompt for P${index + 1}`;
    titleInput.placeholder = 'Prompt title';
    titleInput.style.width = '100%';
    titleInput.style.border = '1px solid rgba(0,0,0,0.2)';
    titleInput.style.borderRadius = '6px';
    titleInput.style.padding = '6px';
    titleInput.style.fontSize = '12px';
    titleInput.style.fontWeight = '600';
    titleInput.style.marginBottom = '6px';
    titleInput.style.boxSizing = 'border-box';

    const textarea = document.createElement('textarea');
    textarea.value = prompts[index] || '';
    textarea.placeholder = 'Enter prompt...';
    textarea.rows = 8;
    textarea.style.width = '100%';
    textarea.style.minHeight = '80px';
    textarea.style.resize = 'vertical';
    textarea.style.border = '1px solid rgba(0,0,0,0.2)';
    textarea.style.borderRadius = '6px';
    textarea.style.padding = '6px';
    textarea.style.fontSize = '12px';
    textarea.style.boxSizing = 'border-box';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '6px';
    actions.style.marginTop = '6px';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.border = '1px solid rgba(0,0,0,0.2)';
    cancel.style.background = '#fff';
    cancel.style.borderRadius = '6px';
    cancel.style.padding = '4px 8px';
    cancel.style.cursor = 'pointer';
    cancel.style.fontSize = '12px';

    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save';
    save.style.border = '1px solid rgba(0,0,0,0.2)';
    save.style.background = '#111';
    save.style.color = '#fff';
    save.style.borderRadius = '6px';
    save.style.padding = '4px 8px';
    save.style.cursor = 'pointer';
    save.style.fontSize = '12px';

    cancel.addEventListener('click', () => {
      removePopover();
    });

    save.addEventListener('click', () => {
      const value = textarea.value || '';
      const titleValue = titleInput.value || `Set prompt for P${index + 1}`;
      prompts[index] = value;
      savePrompts(prompts);
      titles[index] = titleValue;
      saveTitles(titles);
      onSave(value, titleValue);
      removePopover();
    });

    pop.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    actions.appendChild(cancel);
    actions.appendChild(save);
    pop.appendChild(titleInput);
    pop.appendChild(textarea);
    pop.appendChild(actions);
    pop.appendChild(arrow);

    document.body.appendChild(pop);

    const arrowHeight = 8;
    const popRect = pop.getBoundingClientRect();
    const popLeft = Math.max(8, rect.left);
    const popTop = Math.max(8, rect.top - popRect.height - arrowHeight);
    pop.style.left = `${popLeft}px`;
    pop.style.top = `${popTop}px`;
    const desiredArrowLeft = rect.left + rect.width / 2 - popLeft - 8;
    const clampedArrowLeft = Math.min(
      popRect.width - 16,
      Math.max(8, desiredArrowLeft)
    );
    arrow.style.left = `${clampedArrowLeft}px`;

    textarea.focus();

    const onDocClick = () => {
      removePopover();
      document.removeEventListener('click', onDocClick);
    };
    popoverEscHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        removePopover();
      }
    };
    setTimeout(() => {
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', popoverEscHandler);
    }, 0);
  };

  let promptsState = null;
  let titlesState = null;
  let initPromise = null;

  const ensureState = () => {
    if (initPromise) {
      return initPromise;
    }
    initPromise = Promise.all([loadPrompts(), loadTitles()])
      .then(([prompts, titles]) => {
        promptsState = prompts;
        titlesState = titles;
      });
    return initPromise;
  };

  const buildButtons = (container) => {
    if (container.querySelector(`[${WRAP_DATA_ATTR}="true"]`)) {
      return;
    }

    const prompts = promptsState || new Array(BUTTON_COUNT).fill('');
    const titles = titlesState
      || Array.from({ length: BUTTON_COUNT }, (_, i) => `Set prompt for P${i + 1}`);

    const wrap = document.createElement('div');
    wrap.setAttribute(WRAP_DATA_ATTR, 'true');
    wrap.style.display = 'inline-flex';
    wrap.style.flexWrap = 'nowrap';
    wrap.style.gap = '6px';
    wrap.style.alignItems = 'center';
    wrap.style.marginRight = '8px';
    wrap.style.whiteSpace = 'nowrap';

    for (let i = 0; i < BUTTON_COUNT; i += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `P${i + 1}`;
      button.style.padding = '4px 8px';
      button.style.borderRadius = '6px';
      button.style.border = '1px solid rgba(0,0,0,0.2)';
      button.style.background = 'rgba(255,255,255,0.9)';
      button.style.cursor = 'pointer';
      button.style.fontSize = '12px';
      button.style.lineHeight = '1';
      button.style.color = '#111';

      updateButtonState(button, prompts[i], titles[i]);

      let hoverTimer = null;
      let suppressHoverPopover = false;
      const defaultBorder = button.style.border;
      const defaultBackground = button.style.background;
      const defaultColor = button.style.color;

      button.addEventListener('mouseenter', () => {
        button.style.border = '1px solid rgba(0,0,0,0.45)';
        button.style.background = 'rgba(17,17,17,0.08)';
        button.style.color = '#111';
        suppressHoverPopover = false;
        if (hoverTimer) {
          clearTimeout(hoverTimer);
        }
        hoverTimer = setTimeout(() => {
          if (suppressHoverPopover) {
            hoverTimer = null;
            return;
          }
          showPopover(button, i, prompts, titles, (value, titleValue) => {
            updateButtonState(button, value, titleValue);
          });
          hoverTimer = null;
        }, 500);
      });

      button.addEventListener('mouseleave', () => {
        button.style.border = defaultBorder;
        button.style.background = defaultBackground;
        button.style.color = defaultColor;
        suppressHoverPopover = false;
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
      });

      button.addEventListener('click', () => {
        suppressHoverPopover = true;
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        button.dataset.pending = '1';
        applyPrompt(prompts[i] || '');
        setTimeout(() => {
          delete button.dataset.pending;
        }, 400);
      });

      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        showPopover(button, i, prompts, titles, (value, titleValue) => {
          updateButtonState(button, value, titleValue);
        });
      });

      wrap.appendChild(button);
    }

    container.prepend(wrap);
  };

  let cachedContainer = null;
  let ensureScheduled = false;
  const findContainer = () => {
    if (cachedContainer && cachedContainer.isConnected) {
      return cachedContainer;
    }
    const existing = document.querySelector(`[${HOST_DATA_ATTR}="true"]`);
    if (existing && existing.isConnected) {
      cachedContainer = existing;
      return existing;
    }
    let container = deepQuerySelector(CONTAINER_SELECTOR);
    if (container) {
      cachedContainer = container;
      return container;
    }
    warmupPromptTarget();
    const prompt = cachedPromptTarget;
    const form = prompt ? prompt.closest('form') : deepQuerySelector('#thread-bottom form');
    if (form) {
      const host = document.createElement('div');
      host.setAttribute(HOST_DATA_ATTR, 'true');
      host.style.display = 'flex';
      host.style.flexWrap = 'nowrap';
      host.style.gap = '6px';
      host.style.alignItems = 'center';
      host.style.margin = '6px 0 4px';
      host.style.overflowX = 'auto';
      host.style.scrollbarWidth = 'none';
      if (form.firstChild) {
        form.insertBefore(host, form.firstChild);
      } else {
        form.appendChild(host);
      }
      cachedContainer = host;
      return host;
    }
    return null;
  };

  const ensureButtons = () => {
    if (ensureScheduled) return;
    ensureScheduled = true;
    requestAnimationFrame(() => {
      ensureScheduled = false;
      ensureState().then(() => {
        const container = findContainer();
        if (container) {
          buildButtons(container);
        }
      });
    });
  };

  ensureButtons();

  const observer = new MutationObserver(() => {
    warmupPromptTarget();
    ensureButtons();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
