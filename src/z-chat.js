/**
 * OpenAI Chat Panel
 * Dec 4, 2025
 */

function normalizeOgAndOperators(rowText) {
    return String(rowText || '').replace(/OG=\(([^)]*)\)/gi, (_match, inner) => {
        const normalizedInner = inner
            .replace(/\band\b/gi, '&')
            .replace(/\s*&\s*/g, ' & ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        return `OG=(${normalizedInner})`;
    });
}

function extractJsonText(rawText) {
    const text = String(rawText || '').trim();
    if (!text) {
        return '';
    }
    const codeBlockMatch = text.match(/```(?:wosquery|json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch?.[1]) {
        return codeBlockMatch[1].trim();
    }
    const objectMatch = text.match(/\{[\s\S]*\}/);
    return objectMatch ? objectMatch[0].trim() : text;
}

function extractNormalizedRowText(rawText) {
    const jsonText = extractJsonText(rawText);
    if (!jsonText) {
        return null;
    }
    const parsedResult = JSON.parse(jsonText);
    const rowText = parsedResult?.wos_query?.[0]?.rowText || parsedResult?.[0]?.rowText || parsedResult?.rowText;
    return rowText ? normalizeOgAndOperators(rowText) : null;
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

// 使用示例
async function openai_api_chat_query(text = '') {
    const requestId = `wosaide-openai-chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const response = await new Promise((resolve) => {
        const handler = (event) => {
            if (event?.detail?.requestId !== requestId) {
                return;
            }
            document.removeEventListener("__WOS_AIDE_GENERATE_WOS_QUERY_RESPONSE__", handler);
            resolve(event.detail);
        };
        document.addEventListener("__WOS_AIDE_GENERATE_WOS_QUERY_RESPONSE__", handler);
        document.dispatchEvent(new CustomEvent("__WOS_AIDE_GENERATE_WOS_QUERY_REQUEST__", {
            detail: {
                requestId,
                text,
                provider: "openai"
            }
        }));
        setTimeout(() => {
            document.removeEventListener("__WOS_AIDE_GENERATE_WOS_QUERY_RESPONSE__", handler);
            resolve({ success: false, error: 'Request timed out.' });
        }, 15000);
    });

    if (!response?.success || !response?.rowText) {
        throw new Error(response?.error || 'Failed to get valid response');
    }

    const rowText = normalizeOgAndOperators(response.rowText);
    console.log('[OpenAI Chat] query result:', rowText);
    await wos.query(rowText);
    return null;
}

// 导出函数到全局作用域，供其他模块使用
window.openai_api_chat_query = openai_api_chat_query;


































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
    const VISIBILITY_EVENT = "__OPENAI_CHAT_VISIBILITY__";
    const FONT_AWESOME_ID = "wosAide-fontawesome";
    const FONT_AWESOME_FALLBACK = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";

    const savedTop = localStorage.getItem(POSITION_TOP_KEY) || "100px";
    const savedLeft = localStorage.getItem(POSITION_LEFT_KEY) || null;
    const savedWidth = localStorage.getItem(WIDTH_KEY) || "500px";
    const savedVisible = localStorage.getItem(VISIBILITY_KEY);

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
    let inputHistory = [];
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
    box.style.fontFamily = window.WOS_AIDE_FONT_FAMILY || 'Arial, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif';
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
    title.textContent = "WOS Query";
    title.style.color = "#fff";
    title.style.fontSize = "14px";
    title.style.fontWeight = "bold";

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
    controlRow.appendChild(document.createElement("div")).style.marginLeft = "auto";
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
    chatLabel.textContent = "Query:";
    chatLabel.style.color = "#fff";
    chatLabel.style.fontSize = "13px";
    chatLabel.style.fontWeight = "bold";

    const chatInputRow = document.createElement("div");
    chatInputRow.style.display = "flex";
    chatInputRow.style.gap = "6px";
    chatInputRow.style.alignItems = "stretch";

    const chatInput = document.createElement("textarea");
    chatInput.placeholder = "Describe the WOS query you want... (↑↓ for history)";
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
        inputHistory = inputHistory.filter(item => item !== message);
        inputHistory.push(message);
        if (inputHistory.length > 20) {
            inputHistory.shift();
        }
        historyIndex = -1;
        currentInput = "";

        // Update status bar
        statusBar.textContent = "Generating WOS query...";
        statusBar.style.background = "#FFA500";

        isSending = true;
        chatInput.disabled = true;
        sendBtn.disabled = true;
        sendBtn.style.opacity = "0.7";

        try {
            await openai_api_chat_query(message);
            statusBar.textContent = "WOS query executed";
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

    document.body.appendChild(box);

    const visibilityHandler = (event) => {
        const shouldShow = Boolean(event?.detail?.visible);
        box.style.display = shouldShow ? "flex" : "none";
        localStorage.setItem(VISIBILITY_KEY, String(shouldShow));
    };

    document.addEventListener(VISIBILITY_EVENT, visibilityHandler);

})();
