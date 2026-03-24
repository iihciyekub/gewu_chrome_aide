/**
 * OpenAI Chat Panel
 * Dec 4, 2025
 */

// Global variables
window.openai_api_key = "";
window.openai_chat_model = "gpt-4o-mini";

// Single mode
const MODE_LABEL = "any chat";

const PROMPT_PATHS = {
    wosQuery: 'prompts/wos-query.md',
    anyChat: 'prompts/any-chat.md',
};

const PROMPT_CACHE = new Map();

const EXTENSION_BASE_URL = (() => {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
            return chrome.runtime.getURL('');
        }
    } catch (e) {
        // No-op: fall back to script-based URL resolution below.
    }
    const scriptUrl = (document.currentScript && document.currentScript.src) || '';
    if (scriptUrl) {
        return new URL('.', scriptUrl).toString();
    }
    return '';
})();

function _getPromptUrl(relativePath) {
    if (EXTENSION_BASE_URL) {
        return new URL(relativePath, EXTENSION_BASE_URL).toString();
    }
    return relativePath;
}

async function _loadPrompt(key) {
    if (PROMPT_CACHE.has(key)) {
        return PROMPT_CACHE.get(key);
    }
    const relativePath = PROMPT_PATHS[key];
    if (!relativePath) {
        throw new Error(`Unknown prompt key: ${key}`);
    }
    const url = _getPromptUrl(relativePath);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load prompt: ${key} (${response.status})`);
    }
    const text = (await response.text()).trim();
    PROMPT_CACHE.set(key, text);
    return text;
}



/**
 * 封装的 OpenAI API 调用函数 - 用于生成 WoS 查询语句
 */

async function _wos_query_parse(text) {
    const systemPrompt = await _loadPrompt('wosQuery');
    return {
        "model": window.openai_chat_model || "gpt-4o-mini",
        'input': [
            {
                'role': 'system',
                'content': [
                    {
                        'type': 'input_text',
                        "text": systemPrompt

                    }
                ]
            },
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'input_text',
                        'text': `${text}`
                    }
                ]
            },
        ],
        'text': {
            'format': {
                'type': 'text'
            }
        },
        "tools": [],
        "temperature": 0,
        "max_output_tokens": 1024,
        "top_p": 1,
        "store": false,
    }
}


async function _any_chat(text) {
    const systemPrompt = await _loadPrompt('anyChat');
    const selectedModel = window.openai_chat_model || "gpt-4o-mini";
    const supportsSampling = !/^gpt-5/i.test(selectedModel);
    return {
        "model": selectedModel,
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": systemPrompt
                    }
                ]
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        'text': `${text}`
                    }
                ]
            }
        ],
        "text": {
            "format": {
                "type": "text"
            }
        },
        "tools": [],
        ...(supportsSampling ? { "temperature": 0.2 } : {}),
        "max_output_tokens": 1024,
        ...(supportsSampling ? { "top_p": 0.85 } : {}),
        "store": false,
    }
}



/**
 * 封装的 OpenAI API 调用函数
 * @param {Object} jsonData - 要发送的 JSON 数据
 * @returns {Object} - API 响应数据
 * jsonData 示例:
 * await _wos_query_parse()
 */
async function callOpenAI(jsonData) {
    try {
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.openai_api_key}`
            },
            body: JSON.stringify(jsonData)
        });
        // 检查响应是否成功
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        // 尝试解析 JSON
        const data = await response.json();
        if (data?.error) {
            throw new Error(`API Error: ${data.error.message || 'Unknown error'}`);
        }
        return data;
    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        throw error;
    }
}

function extractResponseText(result) {
    if (!result) return '';
    if (typeof result.output_text === 'string' && result.output_text) {
        return result.output_text;
    }
    if (Array.isArray(result.output_text)) {
        return result.output_text.filter(Boolean).join('');
    }
    const contentText = result.output?.[0]?.content?.[0]?.text;
    if (typeof contentText === 'string') {
        return contentText;
    }
    const contentBlocks = result.output?.[0]?.content;
    if (Array.isArray(contentBlocks)) {
        return contentBlocks
            .map(block => block?.text || block?.output_text || '')
            .filter(Boolean)
            .join('');
    }
    return '';
}

/**
 * 流式调用 OpenAI API
 * @param {Object} jsonData - 要发送的 JSON 数据
 * @param {Function} onChunk - 接收流式数据块的回调函数
 * @returns {Promise<string>} - 完整的响应文本
 */
async function callOpenAIStream(jsonData, onChunk) {
    try {
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.openai_api_key}`
            },
            body: JSON.stringify({...jsonData, stream: true})
        });

        if (!response.ok) {
            console.error(`API request failed with status: ${response.status}`);
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
            const {done, value} = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, {stream: true});
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.delta ||
                            parsed.output_text?.delta ||
                            parsed.output?.[0]?.content?.[0]?.text ||
                            parsed.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullText += content;
                            if (onChunk) onChunk(content);
                        }
                    } catch (e) {
                        // Skip invalid JSON lines
                    }
                }
            }
        }

        return fullText;
    } catch (error) {
        console.error('Error calling OpenAI API (stream):', error);
        throw error;
    }
}






// 使用示例
async function openai_api_chat_query(text = '') {
    let jsonData;
    try {
        jsonData = await _wos_query_parse(text);
    } catch (e) {
        console.error('[OpenAI Chat] Failed to load WoS prompt:', e);
        return null;
    }
    const result = await callOpenAI(jsonData);
    if (result) {
        const res = result.output[0].content[0].text
        try {
            const rawText = result.output[0].content[0].text || "";
            const codeBlockMatch = rawText.match(/```(?:wosquery|json)?\s*([\s\S]*?)```/i);
            const jsonText = (codeBlockMatch ? codeBlockMatch[1] : rawText).trim();
            const parsedResult = JSON.parse(jsonText);
            const rowText = parsedResult?.wos_query?.[0]?.rowText || parsedResult?.[0]?.rowText;
            if (rowText) {
                const queryJson = encodeURIComponent(JSON.stringify([{ rowText }]));
                const queryUrl = `/wos/woscc/general-summary?queryJson=${queryJson}`;
                console.log('[OpenAI Chat] query result:', rowText);
                console.log('[OpenAI Chat] query url:', queryUrl);
                await wos.query(rowText);
            } else {
                console.warn('[OpenAI Chat] missing rowText from response:', parsedResult);
            }
        } catch (e) {
            console.error('Failed to parse JSON:', e);
        }
    } else {
        console.log('Failed to get valid response');
    }
    return null;
}

// 导出函数到全局作用域，供其他模块使用
window.openai_api_chat_query = openai_api_chat_query;






async function chat(text = '') {
    let jsonData;
    try {
        jsonData = await _any_chat(text);
    } catch (e) {
        console.error('[OpenAI Chat] Failed to load chat prompt:', e);
        return null;
    }

    // Get or create chat history container
    const chatHistoryContainer = document.getElementById('chat-history-container');
    if (!chatHistoryContainer) {
        console.error('[OpenAI Chat] Chat history container not found');
        return null;
    }

    // Show chat history container in chat mode
    chatHistoryContainer.style.display = 'flex';
    console.log('[OpenAI Chat] Chat history container displayed');

    // Add user message bubble
    const userBubble = createChatBubble(text, 'user');
    chatHistoryContainer.appendChild(userBubble);
    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
    console.log('[OpenAI Chat] User message added:', text);

    // Create assistant message bubble
    const assistantBubble = createChatBubble('Processing...', 'assistant');
    chatHistoryContainer.appendChild(assistantBubble);
    const assistantText = assistantBubble.querySelector('.chat-bubble-text');
    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;

    try {
        console.log('[OpenAI Chat] Attempting streaming API...');
        let fullResponse = '';
        let hasContent = false;
        let rafId = null;
        const scheduleRender = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                assistantText.textContent = fullResponse;
                chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
                rafId = null;
            });
        };

        await callOpenAIStream(jsonData, (chunk) => {
            if (!hasContent) {
                hasContent = true;
                assistantText.textContent = ''; // Clear "Processing..."
            }
            fullResponse += chunk;
            scheduleRender();
        });

        if (fullResponse) {
            console.log('[OpenAI Chat] Streaming response received:', fullResponse);
            return fullResponse;
        }

        throw new Error('Empty streaming response');
    } catch (error) {
        console.error('[OpenAI Chat] Failed to get chat response:', error);
        assistantText.textContent = `Error: ${error.message || 'Failed to get response'}`;
        assistantText.style.color = '#ff6b6b';
        return null;
    }
};


/**
 * Create a chat bubble element
 * @param {string} text - The message text
 * @param {string} role - 'user' or 'assistant'
 * @returns {HTMLElement} - The chat bubble element
 */
function createChatBubble(text, role) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble-${role}`;
    bubble.style.display = 'flex';
    bubble.style.flexDirection = 'column';
    bubble.style.gap = '4px';
    bubble.style.alignItems = role === 'user' ? 'flex-end' : 'flex-start';

    const header = document.createElement('div');
    header.style.fontSize = '11px';
    header.style.color = 'rgba(255,255,255,0.6)';
    header.style.fontWeight = 'bold';
    header.textContent = role === 'user' ? 'You' : 'AI Assistant';

    const textContainer = document.createElement('div');
    textContainer.className = 'chat-bubble-text';
    textContainer.style.padding = '8px 12px';
    textContainer.style.borderRadius = '8px';
    textContainer.style.maxWidth = '85%';
    textContainer.style.wordWrap = 'break-word';
    textContainer.style.fontSize = '13px';
    textContainer.style.lineHeight = '1.5';
    textContainer.style.whiteSpace = 'pre-wrap';
    
    if (role === 'user') {
        textContainer.style.background = 'rgba(0, 122, 204, 0.8)';
        textContainer.style.color = '#fff';
    } else {
        textContainer.style.background = 'rgba(76, 175, 80, 0.2)';
        textContainer.style.color = '#fff';
        textContainer.style.border = '1px solid rgba(76, 175, 80, 0.3)';
    }
    
    textContainer.textContent = text;

    bubble.appendChild(header);
    bubble.appendChild(textContainer);

    return bubble;
}


































/**
 * OpenAI Chat Panel
 */
(async function () {

    // Check and remove existing instance
    const existing = document.getElementById("wos_openai_panel");
    if (existing) {
        existing.remove();
    }

    // Load from localStorage
    const POSITION_TOP_KEY = "wos-openai-panel-top";
    const POSITION_LEFT_KEY = "wos-openai-panel-left";
    const WIDTH_KEY = "wos-openai-panel-width";
    const VISIBILITY_KEY = "wos-openai-panel-visible";
    const API_KEY_STORAGE = "wos-openai-api-key";
    const API_KEY_REQUEST_EVENT = "__ENLIGHTENKEY_CHAT_API_KEY_REQUEST__";
    const API_KEY_RESPONSE_EVENT = "__ENLIGHTENKEY_CHAT_API_KEY_RESPONSE__";
    const API_KEY_UPDATE_EVENT = "__ENLIGHTENKEY_CHAT_API_KEY_UPDATE__";
    const API_KEY_SYNC_EVENT = "__ENLIGHTENKEY_CHAT_API_KEY_SYNC__";
    const MODEL_REQUEST_EVENT = "__ENLIGHTENKEY_CHAT_MODEL_REQUEST__";
    const MODEL_RESPONSE_EVENT = "__ENLIGHTENKEY_CHAT_MODEL_RESPONSE__";
    const MODEL_UPDATE_EVENT = "__ENLIGHTENKEY_CHAT_MODEL_UPDATE__";
    const MODEL_SYNC_EVENT = "__ENLIGHTENKEY_CHAT_MODEL_SYNC__";
    const VISIBILITY_EVENT = "__OPENAI_CHAT_VISIBILITY__";
    const HISTORY_KEY = "wos-openai-panel-history";
    const FONT_AWESOME_ID = "enlightenkey-fontawesome";
    const FONT_AWESOME_FALLBACK = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";

    const savedTop = localStorage.getItem(POSITION_TOP_KEY) || "100px";
    const savedLeft = localStorage.getItem(POSITION_LEFT_KEY) || null;
    const savedWidth = localStorage.getItem(WIDTH_KEY) || "500px";
    const savedVisible = localStorage.getItem(VISIBILITY_KEY);
    const savedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");

    const requestApiKeyFromChromeStorage = () => new Promise((resolve) => {
        const requestId = `chat-api-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        let settled = false;

        const handler = (event) => {
            if (!event?.detail || event.detail.requestId !== requestId) {
                return;
            }
            settled = true;
            document.removeEventListener(API_KEY_RESPONSE_EVENT, handler);
            resolve(event.detail.apiKey || "");
        };

        document.addEventListener(API_KEY_RESPONSE_EVENT, handler);
        document.dispatchEvent(new CustomEvent(API_KEY_REQUEST_EVENT, {
            detail: { requestId }
        }));

        setTimeout(() => {
            if (!settled) {
                document.removeEventListener(API_KEY_RESPONSE_EVENT, handler);
                resolve("");
            }
        }, 1200);
    });

    const persistApiKeyToChromeStorage = (apiKey) => {
        document.dispatchEvent(new CustomEvent(API_KEY_UPDATE_EVENT, {
            detail: { apiKey: apiKey || "" }
        }));
    };

    const requestModelFromChromeStorage = () => new Promise((resolve) => {
        const requestId = `chat-model-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        let settled = false;

        const handler = (event) => {
            if (!event?.detail || event.detail.requestId !== requestId) {
                return;
            }
            settled = true;
            document.removeEventListener(MODEL_RESPONSE_EVENT, handler);
            resolve(event.detail.model || "gpt-4o-mini");
        };

        document.addEventListener(MODEL_RESPONSE_EVENT, handler);
        document.dispatchEvent(new CustomEvent(MODEL_REQUEST_EVENT, {
            detail: { requestId }
        }));

        setTimeout(() => {
            if (!settled) {
                document.removeEventListener(MODEL_RESPONSE_EVENT, handler);
                resolve("gpt-4o-mini");
            }
        }, 1200);
    });

    const persistModelToChromeStorage = (model) => {
        document.dispatchEvent(new CustomEvent(MODEL_UPDATE_EVENT, {
            detail: { model: model || "gpt-4o-mini" }
        }));
    };

    const loadApiKey = async () => {
        const chromeApiKey = await requestApiKeyFromChromeStorage();
        if (chromeApiKey) {
            return chromeApiKey;
        }

        const legacyApiKey = localStorage.getItem(API_KEY_STORAGE) || "";
        if (legacyApiKey) {
            persistApiKeyToChromeStorage(legacyApiKey);
        }
        return legacyApiKey;
    };

    const savedApiKey = await loadApiKey();
    const savedModel = await requestModelFromChromeStorage();

    // Initialize global variables
    window.openai_api_key = savedApiKey;
    window.openai_chat_model = savedModel || "gpt-4o-mini";

    const resolveExtensionUrl = (relativePath) => {
        const currentScript = document.currentScript;
        let baseSrc = currentScript?.src || '';
        if (!baseSrc) {
            const fallback = Array.from(document.scripts || []).find(
                (script) => script.src && script.src.includes('z-chat.js')
            );
            baseSrc = fallback?.src || '';
        }
        if (!baseSrc) {
            return null;
        }
        try {
            return new URL(relativePath, baseSrc).toString();
        } catch (error) {
            console.warn('Failed to resolve extension URL for Font Awesome:', error);
            return null;
        }
    };

    const ensureFontAwesome = () => {
        if (
            document.getElementById(FONT_AWESOME_ID) ||
            document.querySelector('link[href*="fontawesome"]') ||
            window.FontAwesome ||
            window.__fortawesome__
        ) {
            return;
        }
        const link = document.createElement("link");
        link.id = FONT_AWESOME_ID;
        link.rel = "stylesheet";
        const localHref = resolveExtensionUrl('all.min.css');
        link.href = localHref || FONT_AWESOME_FALLBACK;
        document.head.appendChild(link);
    };

    ensureFontAwesome();

    // History management
    let inputHistory = savedHistory;
    let historyIndex = -1;
    let currentInput = "";

    // Main container
    const box = document.createElement("div");
    box.id = "wos_openai_panel";
    box.style.position = "fixed";
    box.style.top = savedTop;
    if (savedLeft) {
        box.style.left = savedLeft;
    } else {
        box.style.right = "10px";
    }
    box.style.zIndex = "999999";
    box.style.fontFamily = window.ENLIGHTENKEY_FONT_FAMILY || 'Arial, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif';
    box.style.background = "rgba(0,0,0,0.85)";
    box.style.padding = "0";
    box.style.borderRadius = "8px";
    box.style.display = savedVisible === "false" ? "none" : "flex";
    box.style.flexDirection = "column";
    box.style.backdropFilter = "blur(5px)";
    box.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
    box.style.width = savedWidth;
    box.style.minWidth = "400px";
    box.style.maxWidth = "1000px";

    // Control row
    const controlRow = document.createElement("div");
    controlRow.style.display = "flex";
    controlRow.style.alignItems = "center";
    controlRow.style.gap = "6px";
    controlRow.style.justifyContent = "space-between";
    controlRow.style.cursor = "move";
    controlRow.style.padding = "8px";
    controlRow.style.background = "rgba(255,255,255,0.1)";
    controlRow.style.borderRadius = "8px 8px 0 0";

    const title = document.createElement("span");
    title.textContent = "OpenAI Chat";
    title.style.color = "#fff";
    title.style.fontSize = "14px";
    title.style.fontWeight = "bold";

    const modeLabel = document.createElement("span");
    modeLabel.textContent = MODE_LABEL;
    modeLabel.style.color = "#4CAF50";
    modeLabel.style.fontSize = "12px";
    modeLabel.style.fontWeight = "bold";
    modeLabel.style.padding = "2px 8px";
    modeLabel.style.background = "rgba(76, 175, 80, 0.2)";
    modeLabel.style.borderRadius = "4px";
    modeLabel.style.whiteSpace = "nowrap";
    modeLabel.style.marginLeft = "auto";
    modeLabel.style.cursor = "default";

    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.gap = "4px";

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    closeBtn.style.background = "rgba(255,255,255,0.15)";
    closeBtn.style.border = "none";
    closeBtn.style.color = "#fff";
    closeBtn.style.display = "inline-flex";
    closeBtn.style.alignItems = "center";
    closeBtn.style.justifyContent = "center";
    closeBtn.style.padding = "4px 8px";
    closeBtn.style.borderRadius = "4px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "14px";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        box.style.display = "none";
        localStorage.setItem(VISIBILITY_KEY, "false");
    });

    btnGroup.appendChild(closeBtn);

    controlRow.appendChild(title);
    controlRow.appendChild(modeLabel);
    controlRow.appendChild(btnGroup);

    // 使用全局拖动方法
    window.createFreeDragger(box, controlRow, {
        topKey: POSITION_TOP_KEY,
        leftKey: POSITION_LEFT_KEY
    });

    // Content container
    const contentBox = document.createElement("div");
    contentBox.style.display = "flex";
    contentBox.style.flexDirection = "column";
    contentBox.style.gap = "8px";
    contentBox.style.padding = "8px";

    // Row 3: Chat input
    const row3 = document.createElement("div");
    row3.style.display = "flex";
    row3.style.flexDirection = "column";
    row3.style.gap = "6px";

    const chatLabel = document.createElement("span");
    chatLabel.textContent = "Chat:";
    chatLabel.style.color = "#fff";
    chatLabel.style.fontSize = "13px";
    chatLabel.style.fontWeight = "bold";

    const chatInputRow = document.createElement("div");
    chatInputRow.style.display = "flex";
    chatInputRow.style.gap = "6px";
    chatInputRow.style.alignItems = "stretch";

    const chatInput = document.createElement("textarea");
    chatInput.placeholder = "Type your message here... (Enter for new line, ↑↓ for history)";
    chatInput.style.width = "100%";
    chatInput.style.minHeight = "50px";
    chatInput.style.border = "none";
    chatInput.style.padding = "8px";
    chatInput.style.borderRadius = "5px";
    chatInput.style.outline = "none";
    chatInput.style.fontSize = "13px";
    chatInput.style.resize = "vertical";
    chatInput.style.fontFamily = "inherit";
    chatInput.style.boxSizing = "border-box";
    chatInput.rows = 2;

    const sendBtn = document.createElement("button");
    sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    sendBtn.style.padding = "8px 12px";
    sendBtn.style.background = "rgba(33, 150, 243, 0.9)";
    sendBtn.style.color = "#fff";
    sendBtn.style.border = "none";
    sendBtn.style.borderRadius = "5px";
    sendBtn.style.cursor = "pointer";
    sendBtn.style.fontSize = "14px";
    sendBtn.style.outline = "none";
    sendBtn.style.display = "inline-flex";
    sendBtn.style.alignItems = "center";
    sendBtn.style.justifyContent = "center";
    sendBtn.title = "Send";

    let isSending = false;

    const sendMessage = async () => {
        const message = chatInput.value.trim();
        if (!message || isSending) {
            return;
        }

        // Save to history
        inputHistory.push(message);
        if (inputHistory.length > 20) {
            inputHistory.shift();
        }
        localStorage.setItem(HISTORY_KEY, JSON.stringify(inputHistory));
        historyIndex = -1;
        currentInput = "";

        // Update status bar
        statusBar.textContent = "Sending chat request...";
        statusBar.style.background = "#FFA500";

        isSending = true;
        chatInput.disabled = true;
        sendBtn.disabled = true;
        sendBtn.style.opacity = "0.7";

        try {
            await chat(message);
            statusBar.textContent = "Chat response received";
            statusBar.style.background = "#16825D";
        } catch (error) {
            statusBar.textContent = `Error: ${error.message || 'Request failed'}`;
            statusBar.style.background = "#D32F2F";
        } finally {
            isSending = false;
            chatInput.disabled = false;
            sendBtn.disabled = false;
            sendBtn.style.opacity = "1";
        }

        // Reset status after 3 seconds
        setTimeout(() => {
            statusBar.textContent = "Ready";
            statusBar.style.background = "#007ACC";
        }, 3000);

        chatInput.value = "";
    };

    // Handle keyboard events
    chatInput.addEventListener("keydown", async (e) => {
        if (isSending) {
            if (e.key === "Enter") {
                e.preventDefault();
            }
            return;
        }
        // Arrow Up - Navigate to previous history
        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (inputHistory.length === 0) return;

            if (historyIndex === -1) {
                currentInput = chatInput.value;
                historyIndex = inputHistory.length - 1;
            } else if (historyIndex > 0) {
                historyIndex--;
            }
            chatInput.value = inputHistory[historyIndex];
            return;
        }

        // Arrow Down - Navigate to next history
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (historyIndex === -1) return;

            if (historyIndex < inputHistory.length - 1) {
                historyIndex++;
                chatInput.value = inputHistory[historyIndex];
            } else {
                historyIndex = -1;
                chatInput.value = currentInput;
            }
            return;
        }
        // Enter - default newline
    });

    sendBtn.addEventListener("click", () => {
        sendMessage();
    });

    row3.appendChild(chatLabel);
    chatInputRow.appendChild(chatInput);
    chatInputRow.appendChild(sendBtn);
    row3.appendChild(chatInputRow);

    // Chat history display area
    const chatHistoryContainer = document.createElement("div");
    chatHistoryContainer.id = "chat-history-container";
    chatHistoryContainer.style.display = "none"; // Initially hidden, show when in chat mode
    chatHistoryContainer.style.flexDirection = "column";
    chatHistoryContainer.style.gap = "8px";
    chatHistoryContainer.style.maxHeight = "400px";
    chatHistoryContainer.style.overflowY = "auto";
    chatHistoryContainer.style.padding = "8px";
    chatHistoryContainer.style.background = "rgba(255,255,255,0.05)";
    chatHistoryContainer.style.borderRadius = "5px";
    chatHistoryContainer.style.marginTop = "8px";

    contentBox.appendChild(chatHistoryContainer);
    contentBox.appendChild(row3);

    // Status bar (VSCode style)
    const statusBar = document.createElement("div");
    statusBar.style.display = "flex";
    statusBar.style.alignItems = "center";
    statusBar.style.padding = "1px 12px";
    statusBar.style.background = "#007ACC";
    statusBar.style.color = "#fff";
    statusBar.style.fontSize = "11px";
    statusBar.style.borderRadius = "0 0 8px 8px";
    statusBar.style.fontFamily = "Consolas, 'Courier New', monospace";
    statusBar.style.minHeight = "16px";
    statusBar.textContent = "Ready";

    box.appendChild(controlRow);
    box.appendChild(contentBox);
    box.appendChild(statusBar);

    // Always show chat history container in any chat mode
    if (chatHistoryContainer) {
        chatHistoryContainer.style.display = "flex";
    }

    document.body.appendChild(box);

    const visibilityHandler = (event) => {
        const shouldShow = Boolean(event?.detail?.visible);
        box.style.display = shouldShow ? "flex" : "none";
        localStorage.setItem(VISIBILITY_KEY, String(shouldShow));
    };

    document.addEventListener(VISIBILITY_EVENT, visibilityHandler);

    document.addEventListener(API_KEY_SYNC_EVENT, (event) => {
        const apiKey = event?.detail?.apiKey || "";
        window.openai_api_key = apiKey;
    });

    document.addEventListener(MODEL_SYNC_EVENT, (event) => {
        const model = event?.detail?.model || "gpt-4.1-nano";
        window.openai_chat_model = model;
    });

})();
