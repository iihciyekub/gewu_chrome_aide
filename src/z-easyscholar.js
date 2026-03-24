/**
 * - easyscholar 查询期刊等级的工具
 * 
 */


const mapping = {
    swufe: "西南财经大学",
    cqu: "重庆大学",
    sciif: "SCI影响因子-JCR",
    cufe: "中央财经大学",
    nju: "南京大学",
    sci: "SCI分区-JCR",
    uibe: "对外经济贸易大学",
    xju: "新疆大学",
    ssci: "SSCI分区-JCR",
    sdufe: "山东财经大学",
    cug: "中国地质大学",
    jci: "JCI指数-JCR",
    xdu: "西安电子科技大学",
    ccf: "中国计算机学会",
    sciif5: "SCI五年影响因子-JCR",
    swjtu: "西南交通大学",
    cju: "长江大学（不是计量大学）",
    sciwarn: "中科院预警",
    ruc: "中国人民大学",
    zju: "浙江大学",
    sciBase: "SCI基础版分区-中科院",
    xmu: "厦门大学",
    zhongguokejihexin: "中国科技核心期刊",
    sciUp: "SCI升级版分区-中科院",
    sjtu: "上海交通大学",
    fms: "FMS",
    ajg: "ABS学术期刊指南",
    fdu: "复旦大学",
    utd24: "UTD24",
    ft50: "FT50",
    hhu: "河海大学",
    eii: "EI检索",
    cscd: "中国科学引文数据库",
    pku: "北大核心",
    cssci: "南大核心",
    ahci: "A&HCI",
    scu: "四川大学",
    sciUpSmall: "中科院升级版小类分区",
    esi: "ESI学科分类",
    sciUpTop: "中科院升级版Top分区",
    cpu: "中国药科大学"
};


// Global variable for EasyScholar API key
window.easyscholar_api_key = "";

// LocalStorage keys for history
const JOURNAL_HISTORY_KEY = "wos-easyscholar-journal-history";
const MAX_HISTORY_ITEMS = 50;

// Save journal query to history
function saveJournalQuery(journalName, result) {
    if (!result || Object.keys(result).length === 0) return;

    let history = JSON.parse(localStorage.getItem(JOURNAL_HISTORY_KEY) || "[]");

    // Remove duplicate if exists
    history = history.filter(item => item.journal !== journalName);

    // Add to beginning
    history.unshift({
        journal: journalName,
        result: result,
        timestamp: new Date().toISOString()
    });

    // Keep only MAX_HISTORY_ITEMS
    if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
    }

    localStorage.setItem(JOURNAL_HISTORY_KEY, JSON.stringify(history));
}

// Get journal history
function getJournalHistory() {
    return JSON.parse(localStorage.getItem(JOURNAL_HISTORY_KEY) || "[]");
}

// Clear journal history
function clearJournalHistory() {
    localStorage.removeItem(JOURNAL_HISTORY_KEY);
}

async function getPublicationRank(SO) {
    const apiKey = (window.easyscholar_api_key || "").trim();
    if (!apiKey) {
        console.error("EasyScholar API key is required before querying");
        return null;
    }
    const encoded = encodeURIComponent(SO);
    const url = `https://www.easyscholar.cc/open/getPublicationRank?secretKey=${apiKey}&publicationName=${encoded}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.code !== 200) {
            console.error("请求失败，返回信息：", data.message);
            return null;
        }

        const rea = data.data.officialRank.all;
        const mappedRea = {};
        for (const key in rea) {
            mappedRea[mapping[key] || key] = rea[key];
        }
        // Save to history
        saveJournalQuery(SO, mappedRea);

        return mappedRea;
    } catch (err) {
        console.error("请求失败：", err);
        return null;
    }
}

/**
 * EasyScholar API Settings Panel
 */
(async function () {
    const requestStorage = (action, key, value) => new Promise((resolve) => {
        const requestId = `gewuaide-easyscholar-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const handler = (event) => {
            if (!event?.data || event.data.type !== "GEWU_QUICKLOAD_STORAGE_RESPONSE") {
                return;
            }
            if (event.data.requestId !== requestId) {
                return;
            }
            window.removeEventListener("message", handler);
            resolve(event.data.value);
        };
        window.addEventListener("message", handler);
        window.postMessage({
            type: "GEWU_QUICKLOAD_STORAGE",
            action,
            key,
            value,
            requestId
        }, "*");
        setTimeout(() => {
            window.removeEventListener("message", handler);
            resolve(null);
        }, 1200);
    });

    const loadApiKey = async (key, fallback) => {
        const value = await requestStorage("get", key);
        if (typeof value === "string" && value.trim()) {
            return value;
        }
        const legacyValue = localStorage.getItem(key);
        if (legacyValue && legacyValue.trim()) {
            requestStorage("set", key, legacyValue);
            return legacyValue;
        }
        return fallback;
    };

    const saveApiKey = (key, value) => {
        requestStorage("set", key, value || "");
    };

    // Check and remove existing instance
    const existing = document.getElementById("wos_easyscholar_panel");
    if (existing) {
        existing.remove();
        console.log("reloading EasyScholar panel");
    }
    const styleId = "wos_easyscholar_panel_style";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
#wos_easyscholar_panel table,
#wos_easyscholar_panel th,
#wos_easyscholar_panel td {
    font-size: 14px !important;
}
`;
        (document.head || document.documentElement).appendChild(style);
    }

    // Load saved position and API key from localStorage
    const POSITION_TOP_KEY = "wos-easyscholar-panel-top";
    const POSITION_LEFT_KEY = "wos-easyscholar-panel-left";
    const SETTINGS_VISIBLE_KEY = "wos-easyscholar-panel-settings-visible";
    const API_KEY_STORAGE = "wos-easyscholar-api-key";
    const savedTop = localStorage.getItem(POSITION_TOP_KEY) || "100px";
    const savedLeft = localStorage.getItem(POSITION_LEFT_KEY) || null;
    const savedSettingsVisible = localStorage.getItem(SETTINGS_VISIBLE_KEY);
    const savedApiKey = await loadApiKey(API_KEY_STORAGE, "");

    // Initialize global variable
    window.easyscholar_api_key = savedApiKey.trim();

    // Main container
    const box = document.createElement("div")
    box.id = "wos_easyscholar_panel";
    box.style.position = "fixed";
    const { top, left } = window.clampPanelPosition({
        top: savedTop,
        left: savedLeft,
        defaultTop: 100,
        defaultLeft: window.innerWidth - 520,
        width: 500,
        height: 360,
        margin: 8
    });
    box.style.top = `${Math.round(top)}px`;
    box.style.left = `${Math.round(left)}px`;
    box.style.right = "auto";
    box.style.zIndex = "999999";
    box.style.fontFamily = window.ENLIGHTENKEY_FONT_FAMILY || 'Arial, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif';
    box.style.background = "rgba(0,0,0,0.85)";
    box.style.padding = "0";
    box.style.borderRadius = "8px";
    box.style.display = "none"; // 默认隐藏，等待popup开启
    box.style.flexDirection = "column";
    box.style.backdropFilter = "blur(5px)";
    box.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
    box.style.width = "500px";
    box.style.minWidth = "400px";

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
    title.textContent = "EasyScholar";
    title.style.color = "#fff";
    title.style.fontSize = "14px";
    title.style.fontWeight = "bold";

    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.gap = "4px";

    const settingsBtn = document.createElement("button");
    settingsBtn.innerHTML = '<i class="fa-solid fa-key"></i>';
    settingsBtn.style.background = "rgba(255,255,255,0.15)";
    settingsBtn.style.border = "none";
    settingsBtn.style.color = "#fff";
    settingsBtn.style.borderRadius = "4px";
    settingsBtn.style.cursor = "pointer";
    settingsBtn.style.display = "inline-flex";
    settingsBtn.style.alignItems = "center";
    settingsBtn.style.justifyContent = "center";
    settingsBtn.style.padding = "4px 8px";
    settingsBtn.style.fontSize = "12px";
    settingsBtn.title = "Set API Key (Hide/Show)";

    const websiteBtn = document.createElement("button");
    websiteBtn.innerHTML = '<i class="fa-solid fa-globe"></i>';
    websiteBtn.style.background = "rgba(255,255,255,0.15)";
    websiteBtn.style.border = "none";
    websiteBtn.style.color = "#fff";
    websiteBtn.style.borderRadius = "4px";
    websiteBtn.style.cursor = "pointer";
    websiteBtn.style.display = "inline-flex";
    websiteBtn.style.alignItems = "center";
    websiteBtn.style.justifyContent = "center";
    websiteBtn.style.padding = "4px 8px";
    websiteBtn.style.fontSize = "12px";
    websiteBtn.title = "Visit easyscholar.cc to apply for API key";
    websiteBtn.onclick = () => {
        window.open("https://www.easyscholar.cc/", "_blank");
    };

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';

    closeBtn.style.background = "rgba(255,255,255,0.15)";
    closeBtn.style.border = "none";
    closeBtn.style.color = "#fff";
    closeBtn.style.borderRadius = "4px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.display = "inline-flex";
    closeBtn.style.alignItems = "center";
    closeBtn.style.justifyContent = "center";
    closeBtn.style.padding = "4px 8px";
    closeBtn.style.fontSize = "12px";
    closeBtn.title = "Close Panel";
    // closeBtn.onclick 将在清理函数定义后设置

    btnGroup.appendChild(settingsBtn);
    btnGroup.appendChild(websiteBtn);
    btnGroup.appendChild(closeBtn);

    controlRow.appendChild(title);
    controlRow.appendChild(btnGroup);

    const ensurePanelInView = () => {
        const width = box.offsetWidth || 500;
        const height = box.offsetHeight || 360;
        const clamped = window.clampPanelPosition({
            top: box.style.top || savedTop,
            left: box.style.left || savedLeft || `${window.innerWidth - 520}px`,
            defaultTop: 100,
            defaultLeft: window.innerWidth - 520,
            width,
            height,
            margin: 8
        });
        box.style.top = `${Math.round(clamped.top)}px`;
        box.style.left = `${Math.round(clamped.left)}px`;
        box.style.right = "auto";
        localStorage.setItem(POSITION_TOP_KEY, box.style.top);
        localStorage.setItem(POSITION_LEFT_KEY, box.style.left);
    };

    // 使用全局拖动方法
    window.createFreeDragger(box, controlRow, {
        topKey: POSITION_TOP_KEY,
        leftKey: POSITION_LEFT_KEY
    });

    ensurePanelInView();

    // Content container
    const contentBox = document.createElement("div");
    contentBox.style.display = "flex";
    contentBox.style.flexDirection = "column";
    contentBox.style.gap = "8px";
    contentBox.style.padding = "8px";

    // Row 1: API Key input
    const row1 = document.createElement("div");
    row1.style.display = "flex";
    row1.style.alignItems = "center";
    row1.style.gap = "6px";

    const apiLabel = document.createElement("span");
    apiLabel.textContent = "API Key:";
    apiLabel.style.color = "#fff";
    apiLabel.style.fontSize = "13px";
    apiLabel.style.fontWeight = "bold";
    apiLabel.style.width = "65px";
    apiLabel.style.textAlign = "right";
    apiLabel.style.whiteSpace = "nowrap";

    const apiInput = document.createElement("input");
    apiInput.type = "text";
    apiInput.placeholder = "Enter EasyScholar API Key";
    apiInput.style.flex = "1";
    apiInput.style.height = "26px";
    apiInput.style.border = "none";
    apiInput.style.padding = "0 8px";
    apiInput.style.borderRadius = "5px";
    apiInput.style.outline = "none";
    apiInput.style.fontSize = "14px";

    // Mask API key display (show first 6 and last 4 chars)
    function maskApiKey(key) {
        if (!key) return "";
        if (key.length <= 10) return key;
        return key.substring(0, 6) + "****" + key.substring(key.length - 4);
    }

    // Initialize display with masked value
    apiInput.value = maskApiKey(savedApiKey);

    // Store actual API key value
    let actualApiKey = savedApiKey.trim();
    let isApiFocused = false;

    // Show full content on focus
    apiInput.addEventListener("focus", () => {
        isApiFocused = true;
        apiInput.value = actualApiKey;
    });

    // Show masked content on blur
    apiInput.addEventListener("blur", () => {
        isApiFocused = false;
        apiInput.value = maskApiKey(actualApiKey);
    });

    // Real-time update
    apiInput.addEventListener("input", (e) => {
        if (isApiFocused) {
            actualApiKey = e.target.value.trim();
            // Update global variable
            window.easyscholar_api_key = actualApiKey;
            // Save to localStorage
            saveApiKey(API_KEY_STORAGE, actualApiKey);
            console.log("EasyScholar API key updated");
        }
    });

    row1.appendChild(apiLabel);
    row1.appendChild(apiInput);
    row1.style.display = savedSettingsVisible === "false" ? "none" : "flex";

    // Settings button toggle
    settingsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isVisible = row1.style.display !== "none";
        row1.style.display = isVisible ? "none" : "flex";
        localStorage.setItem(SETTINGS_VISIBLE_KEY, String(!isVisible));
    });

    // Row 2: Journal name input
    const row2 = document.createElement("div");
    row2.style.display = "flex";
    row2.style.alignItems = "center";
    row2.style.gap = "6px";

    const soLabel = document.createElement("span");
    soLabel.textContent = "Journal:";
    soLabel.style.color = "#fff";
    soLabel.style.fontSize = "13px";
    soLabel.style.fontWeight = "bold";
    soLabel.style.width = "65px";
    soLabel.style.textAlign = "right";
    soLabel.style.whiteSpace = "nowrap";

    const soInput = document.createElement("input");
    soInput.type = "text";
    soInput.placeholder = "Enter journal name (e.g. Nature)";
    soInput.style.flex = "1";
    soInput.style.height = "26px";
    soInput.style.border = "none";
    soInput.style.padding = "0 8px";
    soInput.style.borderRadius = "5px";
    soInput.style.outline = "none";
    soInput.style.fontSize = "13px";

    // History navigation for journal input
    let historyIndex = -1;
    let currentInput = "";
    let statusBarTimer = null; // 用于清除旧的定时器

    function setStatus(message, background) {
        if (!statusBar) {
            return;
        }
        statusBar.textContent = message;
        statusBar.style.background = background;
    }

    function ensureApiKeyConfigured() {
        actualApiKey = (actualApiKey || "").trim();
        window.easyscholar_api_key = actualApiKey;
        if (actualApiKey) {
            return true;
        }
        console.warn("EasyScholar API key is not configured");
        row1.style.display = "flex";
        localStorage.setItem(SETTINGS_VISIBLE_KEY, "true");
        setStatus("Please set EasyScholar API Key first", "#D32F2F");
        apiInput.value = "";
        setTimeout(() => {
            try {
                apiInput.focus({ preventScroll: true });
            } catch (error) {
                apiInput.focus();
            }
        }, 0);
        return false;
    }

    soInput.addEventListener("keydown", async (e) => {
        const history = getJournalHistory();

        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (history.length === 0) return;

            if (historyIndex === -1) {
                currentInput = soInput.value;
                historyIndex = 0;
            } else if (historyIndex < history.length - 1) {
                historyIndex++;
            }

            const historyItem = history[historyIndex];
            soInput.value = historyItem.journal;

            // Display cached result from history
            if (historyItem.result) {
                displayResultTable(historyItem.result);

                // 清除旧的定时器
                if (statusBarTimer) clearTimeout(statusBarTimer);

                // 立即更新 statusBar
                statusBar.textContent = `Loaded from cache: ${historyItem.journal}`;
                statusBar.style.background = "#16825D";

                // 短暂延迟后恢复（减少到 800ms）
                statusBarTimer = setTimeout(() => {
                    statusBar.textContent = "Ready";
                    statusBar.style.background = "#007ACC";
                    statusBarTimer = null;
                }, 800);
            }
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (historyIndex === -1) return;

            if (historyIndex > 0) {
                historyIndex--;
                const historyItem = history[historyIndex];
                soInput.value = historyItem.journal;

                // Display cached result from history
                if (historyItem.result) {
                    displayResultTable(historyItem.result);

                    // 清除旧的定时器
                    if (statusBarTimer) clearTimeout(statusBarTimer);

                    // 立即更新 statusBar
                    statusBar.textContent = `Loaded from cache: ${historyItem.journal}`;
                    statusBar.style.background = "#16825D";

                    // 短暂延迟后恢复（减少到 800ms）
                    statusBarTimer = setTimeout(() => {
                        statusBar.textContent = "Ready";
                        statusBar.style.background = "#007ACC";
                        statusBarTimer = null;
                    }, 800);
                }
            } else {
                historyIndex = -1;
                soInput.value = currentInput;
                // Clear result table when returning to manual input
                resultContainer.style.display = "none";

                // 清除定时器并立即恢复状态
                if (statusBarTimer) {
                    clearTimeout(statusBarTimer);
                    statusBarTimer = null;
                }
                statusBar.textContent = "Ready";
                statusBar.style.background = "#007ACC";
            }
        } else if (e.key === "Enter") {
            const so = soInput.value.trim();
            if (!so) return;
            if (!ensureApiKeyConfigured()) return;

            // Reset history index
            historyIndex = -1;

            // Prevent multiple rapid Enter presses
            if (isQuerying) {
                console.log("Query already in progress, please wait...");
                return;
            }

            isQuerying = true;
            const originalBg = queryBtn.style.background;
            queryBtn.style.background = "rgba(56,142,60,1)";
            queryBtn.style.transform = "scale(0.95)";

            setStatus(`Querying journal: ${so}`, "#FFA500");
            console.log(`Querying journal: ${so}`);
            const result = await getPublicationRank(so);

            // Display result in table
            if (result) {
                displayResultTable(result);
                setStatus("Query completed", "#16825D");
            } else {
                setStatus("Query failed", "#D32F2F");
            }

            setTimeout(() => {
                queryBtn.style.background = originalBg;
                queryBtn.style.transform = "scale(1)";
                isQuerying = false;
                setStatus("Ready", "#007ACC");
            }, 3000);
        } else {
            // Reset history index when typing
            historyIndex = -1;
        }
    });

    row2.appendChild(soLabel);
    row2.appendChild(soInput);

    // Row 3: Capture, Query and Clear buttons
    const row3 = document.createElement("div");
    row3.style.display = "flex";
    row3.style.alignItems = "center";
    row3.style.gap = "6px";

    const captureBtn = document.createElement("button");
    captureBtn.textContent = "Capture";
    captureBtn.style.flex = "1";
    captureBtn.style.padding = "4px 12px";
    captureBtn.style.height = "24px";
    captureBtn.style.background = "rgba(255,152,0,0.8)";
    captureBtn.style.color = "#fff";
    captureBtn.style.border = "none";
    captureBtn.style.borderRadius = "5px";
    captureBtn.style.cursor = "pointer";
    captureBtn.style.fontSize = "12px";
    captureBtn.style.fontWeight = "bold";
    captureBtn.style.outline = "none";
    captureBtn.style.transition = "all 0.2s ease";
    captureBtn.title = "Hover over JCR link to capture journal name";

    const queryBtn = document.createElement("button");
    queryBtn.textContent = "Query";
    queryBtn.style.flex = "1";
    queryBtn.style.padding = "4px 12px";
    queryBtn.style.height = "24px";
    queryBtn.style.background = "rgba(76,175,80,0.8)";
    queryBtn.style.color = "#fff";
    queryBtn.style.border = "none";
    queryBtn.style.borderRadius = "5px";
    queryBtn.style.cursor = "pointer";
    queryBtn.style.fontSize = "12px";
    queryBtn.style.fontWeight = "bold";
    queryBtn.style.outline = "none";
    queryBtn.style.transition = "all 0.2s ease";

    const testBtn = document.createElement("button");
    testBtn.textContent = "Test";
    testBtn.style.flex = "1";
    testBtn.style.padding = "4px 12px";
    testBtn.style.height = "24px";
    testBtn.style.background = "rgba(33,150,243,0.85)";
    testBtn.style.color = "#fff";
    testBtn.style.border = "none";
    testBtn.style.borderRadius = "5px";
    testBtn.style.cursor = "pointer";
    testBtn.style.fontSize = "12px";
    testBtn.style.fontWeight = "bold";
    testBtn.style.outline = "none";
    testBtn.style.transition = "all 0.2s ease";
    testBtn.title = "Run test with journal: Management science";

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.style.flex = "1";
    clearBtn.style.padding = "4px 12px";
    clearBtn.style.height = "24px";
    clearBtn.style.background = "rgba(244,67,54,0.8)";
    clearBtn.style.color = "#fff";
    clearBtn.style.border = "none";
    clearBtn.style.borderRadius = "5px";
    clearBtn.style.cursor = "pointer";
    clearBtn.style.fontSize = "12px";
    clearBtn.style.fontWeight = "bold";
    clearBtn.style.outline = "none";
    clearBtn.style.transition = "all 0.2s ease";
    clearBtn.title = "Clear all saved journal data";

    row3.appendChild(captureBtn);
    row3.appendChild(queryBtn);
    row3.appendChild(testBtn);
    row3.appendChild(clearBtn);

    // Capture state
    let captureEnabled = false;
    let hoverListener = null;
    let hoverOutListener = null;
    let hoverTimer = null;
    let isModifierPressed = false;
    let lastCapturedText = "";

    const getTextFromNode = (node) => {
        if (!node) {
            return "";
        }
        if (node.nodeType === Node.TEXT_NODE) {
            return (node.textContent || "").trim();
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return "";
        }
        const element = node;
        if (element.matches("input, textarea")) {
            return (element.value || "").trim();
        }
        const text = (element.textContent || "").trim();
        if (text) {
            return text;
        }
        return (element.getAttribute("title") || element.getAttribute("aria-label") || "").trim();
    };

    const getCapturedTextFromEvent = (event) => {
        const path = event.composedPath ? event.composedPath() : [];
        for (const node of path) {
            const text = getTextFromNode(node);
            if (text) {
                return text;
            }
        }
        return getTextFromNode(event.target);
    };

    // Global hover listener for capturing
    const globalHoverListener = (e) => {
        const capturedText = getCapturedTextFromEvent(e);
        if (!capturedText) {
            return;
        }

        // Method 1: If Ctrl/Cmd is pressed, just update input box (works globally)
        if (isModifierPressed || e.metaKey || e.ctrlKey) {
            soInput.value = capturedText;
            lastCapturedText = capturedText;
            console.log(`Captured text (Ctrl/Cmd mode): ${capturedText}`);
            return;
        }

        // Method 2: Only works when capture button is clicked - wait 1 second before auto-query
        if (captureEnabled) {
            if (hoverTimer) {
                clearTimeout(hoverTimer);
            }

            hoverTimer = setTimeout(async () => {
                soInput.value = capturedText;
                // Auto-stop capture after successful capture
                stopCapture();
                if (!ensureApiKeyConfigured()) {
                    return;
                }

                // Auto-execute query
                setStatus(`Querying journal: ${capturedText}`, "#FFA500");
                console.log(`Auto-querying after 1s: ${capturedText}`);
                const result = await getPublicationRank(capturedText);

                // Display result in table
                if (result) {
                    displayResultTable(result);
                    setStatus("Query completed", "#16825D");
                } else {
                    setStatus("Query failed", "#D32F2F");
                }
                setTimeout(() => {
                    setStatus("Ready", "#007ACC");
                }, 3000);
            }, 1000); // 1 second delay
        }
    };

    // Global keydown listener - always active
    const keydownModifierHandler = (e) => {
        if (e.metaKey || e.ctrlKey) {
            if (!isModifierPressed) {
                isModifierPressed = true;
                // Visual feedback when Ctrl/Cmd is pressed
                captureBtn.style.background = "rgba(76,175,80,0.8)";
                captureBtn.textContent = "Hold";
                console.log("Modifier key pressed - ready to capture");
            }
        }
    };
    document.addEventListener("keydown", keydownModifierHandler);

    // Global keyup listener - always active
    const keyupModifierHandler = async (e) => {
        // Check if modifier key is released
        if ((e.key === "Meta" || e.key === "Control") && isModifierPressed) {
            isModifierPressed = false;
            // Reset button visual
            if (captureEnabled) {
                captureBtn.style.background = "rgba(244,67,54,0.8)";
                captureBtn.textContent = "Stop";
            } else {
                captureBtn.style.background = "rgba(255,152,0,0.8)";
                captureBtn.textContent = "Capture";
            }
            
            // When modifier key is released, execute query if text was captured
            if (lastCapturedText) {
                if (!ensureApiKeyConfigured()) {
                    lastCapturedText = "";
                    return;
                }
                setStatus(`Querying journal: ${lastCapturedText}`, "#FFA500");
                console.log(`Querying captured text: ${lastCapturedText}`);
                const result = await getPublicationRank(lastCapturedText);

                // Display result in table
                if (result) {
                    displayResultTable(result);
                    setStatus("Query completed", "#16825D");
                } else {
                    setStatus("Query failed", "#D32F2F");
                }
                setTimeout(() => {
                    setStatus("Ready", "#007ACC");
                }, 3000);

                lastCapturedText = "";
            }
        }
    };
    document.addEventListener("keyup", keyupModifierHandler);

    // Global mouseover listener - always active
    document.addEventListener("mouseover", globalHoverListener);

    // Function to stop capture mode
    function stopCapture() {
        captureEnabled = false;
        captureBtn.style.background = "rgba(255,152,0,0.8)";
        captureBtn.textContent = "Capture";

        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }

        if (hoverOutListener) {
            document.removeEventListener("mouseout", hoverOutListener);
            hoverOutListener = null;
        }

        lastCapturedText = "";
    }

    // Capture button click event
    captureBtn.addEventListener("click", () => {
        if (captureEnabled) {
            // If already enabled, stop capture
            stopCapture();
        } else {
            // Enable capture mode (for Method 2 - 1 second delay)
            captureEnabled = true;
            captureBtn.style.background = "rgba(244,67,54,0.8)";
            captureBtn.textContent = "Stop";

            // Add mouseout listener to cancel timer for Method 2
            hoverOutListener = (e) => {
                if (hoverTimer && !isModifierPressed) {
                    clearTimeout(hoverTimer);
                    hoverTimer = null;
                }
            };

            document.addEventListener("mouseout", hoverOutListener);
        }
    });

    // Query button click event with debounce
    let isQuerying = false;
    queryBtn.addEventListener("click", async () => {
        const so = soInput.value.trim();
        if (!so) {
            console.warn("Please enter journal name");
            return;
        }
        if (!ensureApiKeyConfigured()) {
            return;
        }

        // Prevent multiple clicks
        if (isQuerying) {
            console.log("Query already in progress, please wait...");
            return;
        }

        isQuerying = true;
        const originalBg = queryBtn.style.background;
        queryBtn.style.background = "rgba(56,142,60,1)";
        queryBtn.style.transform = "scale(0.95)";

        setStatus(`Querying journal: ${so}`, "#FFA500");
        console.log(`Querying journal: ${so}`);
        const result = await getPublicationRank(so);

        // Display result in table
        if (result) {
            displayResultTable(result);
            setStatus("Query completed", "#16825D");
        } else {
            setStatus("Query failed", "#D32F2F");
        }

        // Reset button state
        setTimeout(() => {
            queryBtn.style.background = originalBg;
            queryBtn.style.transform = "scale(1)";
            isQuerying = false;
            setStatus("Ready", "#007ACC");
        }, 3000);
    });

    // Test button click event
    testBtn.addEventListener("click", () => {
        soInput.value = "Management science";
        queryBtn.click();
    });

    contentBox.appendChild(row1);
    contentBox.appendChild(row2);
    contentBox.appendChild(row3);

    // Result table container
    const resultContainer = document.createElement("div");
    resultContainer.style.display = "none";
    resultContainer.style.maxHeight = "500px";
    resultContainer.style.overflowY = "auto";
    resultContainer.style.background = "rgba(255,255,255,0.05)";
    resultContainer.style.borderRadius = "5px";
    resultContainer.style.marginTop = "4px";

    const resultTable = document.createElement("table");
    resultTable.style.width = "100%";
    resultTable.style.borderCollapse = "collapse";
    resultTable.style.setProperty("font-size", "14px", "important");
    resultTable.style.fontFamily = "Consolas, 'Courier New', monospace";

    resultContainer.appendChild(resultTable);
    contentBox.appendChild(resultContainer);

    // Function to display result in table
    function displayResultTable(result) {
        if (!result || Object.keys(result).length === 0) {
            resultContainer.style.display = "none";
            return;
        }

        resultTable.innerHTML = "";

        // Create table header
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        const th1 = document.createElement("th");
        th1.textContent = "Category";
        th1.style.padding = "6px 8px";
        th1.style.setProperty("font-size", "14px", "important");
        th1.style.textAlign = "left";
        th1.style.background = "rgba(255,255,255,0.1)";
        th1.style.color = "#fff";
        th1.style.fontWeight = "bold";
        th1.style.borderBottom = "1px solid rgba(255,255,255,0.2)";

        const th2 = document.createElement("th");
        th2.textContent = "Rank";
        th2.style.padding = "6px 8px";
        th2.style.setProperty("font-size", "14px", "important");
        th2.style.textAlign = "left";
        th2.style.background = "rgba(255,255,255,0.1)";
        th2.style.color = "#fff";
        th2.style.fontWeight = "bold";
        th2.style.borderBottom = "1px solid rgba(255,255,255,0.2)";

        headerRow.appendChild(th1);
        headerRow.appendChild(th2);
        thead.appendChild(headerRow);
        resultTable.appendChild(thead);

        // Create table body
        const tbody = document.createElement("tbody");

        for (const [key, value] of Object.entries(result)) {
            const row = document.createElement("tr");
            row.style.borderBottom = "1px solid rgba(255,255,255,0.05)";

            const td1 = document.createElement("td");
            td1.textContent = key;
            td1.style.padding = "4px 8px";
            td1.style.setProperty("font-size", "14px", "important");
            td1.style.color = "#ccc";

            const td2 = document.createElement("td");
            td2.textContent = value || "-";
            td2.style.padding = "4px 8px";
            td2.style.setProperty("font-size", "14px", "important");
            td2.style.color = "#fff";

            row.appendChild(td1);
            row.appendChild(td2);
            tbody.appendChild(row);
        }

        resultTable.appendChild(tbody);
        resultContainer.style.display = "block";
    }

    // Clear button click event
    clearBtn.addEventListener("click", () => {
        if (confirm("Clear all saved journal query data?")) {
            clearJournalHistory();
            soInput.value = "";
            currentInput = "";
            historyIndex = -1;
            resultContainer.style.display = "none";
            resultTable.innerHTML = "";
            console.log("Journal history cleared");
            statusBar.textContent = "History cleared";
            statusBar.style.background = "#D32F2F";
            setTimeout(() => {
                statusBar.textContent = "Ready";
                statusBar.style.background = "#007ACC";
            }, 2000);
        }
    });

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

    const focusPanelInput = () => {
        if (!soInput || typeof soInput.focus !== "function") {
            return;
        }
        setTimeout(() => {
            try {
                soInput.focus({ preventScroll: true });
                if (typeof soInput.select === "function") {
                    soInput.select();
                }
            } catch (error) {
                soInput.focus();
            }
        }, 0);
    };



    box.appendChild(controlRow);
    box.appendChild(contentBox);
    box.appendChild(statusBar);

    document.body.appendChild(box);

    // 监听来自 content script 的可见性控制事件
    const visibilityHandler = (e) => {
        console.log("[EasyScholar] Visibility event received:", e.detail);
        if (e.detail && typeof e.detail.visible === 'boolean') {
            const visible = e.detail.visible;
            const beforeDisplay = box.style.display;
            box.style.display = visible ? "flex" : "none";
            const afterDisplay = box.style.display;
            console.log(`[EasyScholar] Display changed: ${beforeDisplay} -> ${afterDisplay}, box exists: ${!!box}, box in DOM: ${document.contains(box)}`);
            if (visible) {
                ensurePanelInView();
                focusPanelInput();
            }
        }
    };
    document.addEventListener("__EASYSCHOLAR_VISIBILITY__", visibilityHandler);
    if (box.style.display !== "none") {
        focusPanelInput();
    }

    // 清理函数
    const cleanup = () => {
        console.log("[EasyScholar] Cleaning up resources...");
        // 移除所有全局事件监听器
        document.removeEventListener("__EASYSCHOLAR_VISIBILITY__", visibilityHandler);
        document.removeEventListener("keydown", keydownModifierHandler);
        document.removeEventListener("keyup", keyupModifierHandler);
        document.removeEventListener("mouseover", globalHoverListener);
        if (hoverOutListener) {
            document.removeEventListener("mouseout", hoverOutListener);
        }
        // 清理定时器
        if (hoverTimer) {
            clearTimeout(hoverTimer);
        }
        // 重置捕获状态
        captureEnabled = false;
        isModifierPressed = false;
        lastCapturedText = "";
        // 移除DOM元素
        box.remove();
        console.log("[EasyScholar] Resources cleaned up");
    };

    // 设置关闭按钮的点击事件
    closeBtn.onclick = () => {
        cleanup();
    };

})();
