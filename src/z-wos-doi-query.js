// 导出 WOS Plain Text 到控制台（不下载文件）
async function exportWosPlainTextToConsole() {
    try {
        let plainText = '';
        // 兼容 window.wos.getPlaintext 或 window.wos.data.plaintext
        if (window.wos && typeof window.wos.getPlaintext === 'function') {
            plainText = await window.wos.getPlaintext();
        } else if (window.wos && window.wos.data && window.wos.data.plaintext) {
            plainText = window.wos.data.plaintext;
        }
        if (plainText) {
            console.log('[WOS Plain Text] Export: success');
        } else {
            console.log('[WOS Plain Text] Export: no data found');
        }
    } catch (err) {
        console.log('[WOS Plain Text] Export: failed', err);
    }
}
/**
 * Web of Science 
 * 批量输入 doi 在 WoS 批量查询的工具栏
 */

// 全局变量存储剪贴板数据
window.wosids = [];

// 剪贴板读取功能
(function () {
    // ========== 导出目录选择（与 popup 共用） ==========
    let exportDirHandle = null;
    let exportDirName = '';

    const openProjectHandleStore = async () => new Promise((resolve, reject) => {
        const request = indexedDB.open('gewuaide-toolkit', 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('projectHandles');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    const setStoredProjectHandle = async (handle) => {
        if (!handle) return;
        const db = await openProjectHandleStore();
        await new Promise((resolve) => {
            const tx = db.transaction('projectHandles', 'readwrite');
            const store = tx.objectStore('projectHandles');
            store.put(handle, 'default');
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    };

    const loadStoredProjectHandle = async () => {
        try {
            const db = await openProjectHandleStore();
            return await new Promise((resolve) => {
                const tx = db.transaction('projectHandles', 'readonly');
                const store = tx.objectStore('projectHandles');
                const req = store.get('default');
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (error) {
            console.warn("[WOS DOI Query] Failed to load directory handle:", error);
            return null;
        }
    };

    const ensureDirectoryPermission = async (handle) => {
        try {
            const opts = { mode: 'readwrite' };
            if (await handle.queryPermission(opts) === 'granted') return true;
            return (await handle.requestPermission(opts)) === 'granted';
        } catch (error) {
            console.warn("[WOS DOI Query] Directory permission check failed:", error);
            return false;
        }
    };

    const chooseExportDirectory = async () => {
        if (!window.showDirectoryPicker) {
            throw new Error('当前浏览器不支持目录选择');
        }
        const handle = await window.showDirectoryPicker({ id: 'enlightenkey-project', mode: 'readwrite' });
        const granted = await ensureDirectoryPermission(handle);
        if (!granted) {
            throw new Error('无写入权限');
        }
        exportDirHandle = handle;
        exportDirName = handle.name || '';
        window.enlightenkeyDirectoryHandle = handle;
        await setStoredProjectHandle(handle);
        return handle;
    };

    window.wosDoiQuery = window.wosDoiQuery || {};
    window.wosDoiQuery.selectExportDirectory = chooseExportDirectory;
    const readStorage = (key, fallback) => {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch (error) {
            console.warn("Failed to read localStorage:", error);
            return fallback;
        }
    };

    const writeStorage = (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn("Failed to write localStorage:", error);
        }
    };

    // 检查并删除已存在的实例
    const existing = document.getElementById("clipboard-reader-box");
    if (existing) {
        existing.remove();
        console.log("clipboard reader, reloading");
    }

    // 从 localStorage 读取保存的位置和显示状态
    const POSITION_TOP_KEY = "clipboard-reader-box-top";
    const POSITION_LEFT_KEY = "clipboard-reader-box-left";
    const HISTORY_KEY = "clipboard-reader-box-history";
    const MAX_HISTORY = 20;
    const savedTop = readStorage(POSITION_TOP_KEY, "80px");
    const savedLeft = readStorage(POSITION_LEFT_KEY, null);

    // 历史记录管理
    let queryHistory = [];
    let historyIndex = -1;

    function loadHistory() {
        try {
            const saved = readStorage(HISTORY_KEY, null);
            queryHistory = saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("Failed to load query history:", e);
            queryHistory = [];
        }
    }

    function saveHistory(queryText) {
        if (!queryText.trim()) return;

        // 移除重复项
        queryHistory = queryHistory.filter(item => item !== queryText);

        // 添加到历史开头
        queryHistory.unshift(queryText);

        // 限制历史记录数量
        if (queryHistory.length > MAX_HISTORY) {
            queryHistory = queryHistory.slice(0, MAX_HISTORY);
        }

        // 保存到 localStorage
        writeStorage(HISTORY_KEY, JSON.stringify(queryHistory));

        // 重置历史索引
        historyIndex = -1;
    }

    function navigateHistory(direction) {
        if (queryHistory.length === 0) return;

        // direction: 1 = down (newer), -1 = up (older)
        if (direction === -1) {
            // 按上 - 查看更旧的历史
            if (historyIndex < queryHistory.length - 1) {
                historyIndex++;
                textarea.value = queryHistory[historyIndex];
            }
        } else if (direction === 1) {
            // 按下 - 查看更新的历史
            if (historyIndex > 0) {
                historyIndex--;
                textarea.value = queryHistory[historyIndex];
            } else if (historyIndex === 0) {
                historyIndex = -1;
                textarea.value = "";
            }
        }
    }

    // 加载历史记录
    loadHistory();

    // 创建主容器
    const box = document.createElement("div");
    box.id = "clipboard-reader-box";
    box.style.position = "fixed";
    const { top, left } = window.clampPanelPosition({
        top: savedTop,
        left: savedLeft,
        defaultTop: 80,
        defaultLeft: window.innerWidth - 360,
        width: 250,
        height: 320,
        margin: 8
    });
    box.style.top = `${Math.round(top)}px`;
    box.style.left = `${Math.round(left)}px`;
    box.style.right = "auto";
    box.style.zIndex = "999999";
    box.style.fontFamily = window.ENLIGHTENKEY_FONT_FAMILY || 'Arial, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif';
    box.style.background = "rgba(0,0,0,0.85)";
    box.style.padding = "8px";
    box.style.borderRadius = "8px";
    box.style.display = "none"; // 默认隐藏，等待popup开启
    box.style.flexDirection = "column";
    box.style.gap = "8px";
    box.style.backdropFilter = "blur(5px)";
    box.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
    box.style.width = "250px";
    box.style.minWidth = "250px";

    // 控制栏（标题和拖动按钮）
    const controlRow = document.createElement("div");
    controlRow.style.display = "flex";
    controlRow.style.alignItems = "center";
    controlRow.style.justifyContent = "space-between";
    controlRow.style.gap = "6px";
    controlRow.style.cursor = "move";
    controlRow.style.userSelect = "none";

    const title = document.createElement("span");
    title.textContent = "Batch Query";
    title.style.color = "#fff";
    title.style.fontSize = "14px";
    title.style.fontWeight = "bold";
    title.style.cursor = "move";


    // 关闭按钮
    const closeBtn = document.createElement("span");
    closeBtn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
    closeBtn.style.color = "#fff";
    closeBtn.style.fontSize = "16px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.opacity = "0.7";
    closeBtn.style.transition = "opacity 0.2s";
    closeBtn.title = "Close panel";
    closeBtn.onmouseover = () => closeBtn.style.opacity = "1";
    closeBtn.onmouseout = () => closeBtn.style.opacity = "0.7";
    // onclick 将在后面定义

    controlRow.appendChild(title);
    controlRow.appendChild(closeBtn);
    box.appendChild(controlRow);

    // Tab 容器
    const tabRow = document.createElement('div');
    tabRow.style.display = 'flex';
    tabRow.style.gap = '4px';
    tabRow.style.padding = '3px';
    tabRow.style.borderRadius = '8px';
    tabRow.style.background = 'rgba(255,255,255,0.14)';
    tabRow.style.border = '1px solid rgba(255,255,255,0.2)';

    const queryTabBtn = document.createElement('button');
    queryTabBtn.textContent = 'DOI Query';
    queryTabBtn.style.flex = '1';
    queryTabBtn.style.padding = '7px 8px';
    queryTabBtn.style.border = 'none';
    queryTabBtn.style.borderRadius = '6px';
    queryTabBtn.style.fontSize = '12px';
    queryTabBtn.style.cursor = 'pointer';
    queryTabBtn.style.transition = 'all 0.2s ease';
    queryTabBtn.style.outline = 'none';
    queryTabBtn.style.fontWeight = 'bold';

    const exportTabBtn = document.createElement('button');
    exportTabBtn.textContent = 'DOI TXT Export';
    exportTabBtn.style.flex = '1';
    exportTabBtn.style.padding = '7px 8px';
    exportTabBtn.style.border = 'none';
    exportTabBtn.style.borderRadius = '6px';
    exportTabBtn.style.fontSize = '12px';
    exportTabBtn.style.cursor = 'pointer';
    exportTabBtn.style.transition = 'all 0.2s ease';
    exportTabBtn.style.outline = 'none';
    exportTabBtn.style.fontWeight = 'bold';

    tabRow.appendChild(queryTabBtn);
    tabRow.appendChild(exportTabBtn);
    box.appendChild(tabRow);

    const tabContentWrap = document.createElement('div');
    tabContentWrap.style.display = 'flex';
    tabContentWrap.style.flexDirection = 'column';
    tabContentWrap.style.gap = '0';
    tabContentWrap.style.marginTop = '2px';

    const queryTabPanel = document.createElement('div');
    queryTabPanel.style.display = 'flex';
    queryTabPanel.style.flexDirection = 'column';
    queryTabPanel.style.gap = '8px';
    queryTabPanel.style.background = 'rgba(255,255,255,0.08)';
    queryTabPanel.style.border = '1px solid rgba(255,255,255,0.16)';
    queryTabPanel.style.borderRadius = '8px';
    queryTabPanel.style.padding = '8px';
    queryTabPanel.style.boxSizing = 'border-box';

    const exportTabPanel = document.createElement('div');
    exportTabPanel.style.display = 'none';
    exportTabPanel.style.flexDirection = 'column';
    exportTabPanel.style.gap = '8px';
    exportTabPanel.style.background = 'rgba(255,255,255,0.08)';
    exportTabPanel.style.border = '1px solid rgba(255,255,255,0.16)';
    exportTabPanel.style.borderRadius = '8px';
    exportTabPanel.style.padding = '8px';
    exportTabPanel.style.boxSizing = 'border-box';

    tabContentWrap.appendChild(queryTabPanel);
    tabContentWrap.appendChild(exportTabPanel);
    box.appendChild(tabContentWrap);

    const setActiveTab = (tabName) => {
        const isQuery = tabName === 'query';
        queryTabPanel.style.display = isQuery ? 'flex' : 'none';
        exportTabPanel.style.display = isQuery ? 'none' : 'flex';

        queryTabBtn.style.background = isQuery ? 'rgba(255,255,255,0.92)' : 'transparent';
        queryTabBtn.style.color = isQuery ? '#1f2937' : 'rgba(255,255,255,0.88)';
        queryTabBtn.style.fontWeight = isQuery ? 'bold' : 'normal';
        queryTabBtn.style.boxShadow = isQuery ? '0 1px 3px rgba(0,0,0,0.2)' : 'none';

        exportTabBtn.style.background = isQuery ? 'transparent' : 'rgba(255,255,255,0.92)';
        exportTabBtn.style.color = isQuery ? 'rgba(255,255,255,0.88)' : '#1f2937';
        exportTabBtn.style.fontWeight = isQuery ? 'normal' : 'bold';
        exportTabBtn.style.boxShadow = isQuery ? 'none' : '0 1px 3px rgba(0,0,0,0.2)';
    };

    queryTabBtn.onclick = () => setActiveTab('query');
    exportTabBtn.onclick = () => setActiveTab('export');
    setActiveTab('query');

    // 内容容器
    const contentBox = document.createElement("div");
    contentBox.style.display = "flex";
    contentBox.style.flexDirection = "column";
    contentBox.style.gap = "8px";


    const textarea = document.createElement("textarea");
    textarea.placeholder = "Enter WOS IDs or DOIs here...\nOne per line\nHistory supported (ctrl(control) + ↑/↓ to navigate)";
    textarea.style.width = "100%";
    textarea.style.minHeight = "200px";
    textarea.style.maxHeight = "600px";
    textarea.style.border = "none";
    textarea.style.padding = "8px";
    textarea.style.borderRadius = "5px";
    textarea.style.outline = "none";
    textarea.style.fontSize = "12px";
    textarea.style.resize = "vertical";
    textarea.style.fontFamily = "Consolas, 'Courier New', monospace";
    textarea.style.boxSizing = "border-box";
    textarea.style.background = "rgba(255,255,255,0.9)";

    // 自动提取开关状态
    const AUTO_EXTRACT_KEY = "clipboard-reader-auto-extract";
    let autoExtractEnabled = readStorage(AUTO_EXTRACT_KEY, "false") === "true";

    // 添加键盘事件监听
    textarea.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "ArrowUp") {
            e.preventDefault();
            navigateHistory(-1);
        } else if ((e.ctrlKey || e.metaKey) && e.key === "ArrowDown") {
            e.preventDefault();
            navigateHistory(1);
        }
    });

    // 提取函数：从文本中提取 WOS ID 和 DOI
    function extractFromText(text) {
        const wosids = [];
        const dois = [];

        // 提取 WOS ID：冒号左侧连续字母，右侧连续数字字母的组合
        // 例如：WOS:000123456789012, MEDLINE:12345678901234, etc.
        const wosidPattern = /\b([WOSwos]+):([A-Z0-9]{10,})\b/gi;
        const wosMatches = [];
        let remainingText = text;
        let match;

        // 先提取所有 WOS ID，并从文本中移除，防止被误识别为 DOI
        while ((match = wosidPattern.exec(text)) !== null) {
            const fullMatch = match[0];
            const normalized = fullMatch.toUpperCase();
            wosids.push(normalized);
            wosMatches.push(fullMatch);
        }

        // 从原文本中移除已匹配的 WOS ID
        wosMatches.forEach(wosid => {
            remainingText = remainingText.replace(wosid, '');
        });

        // 在剩余文本中提取 DOI
        const doiRegex = /\b(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*|urn:doi:\s*|urn:\s*doi:\s*)?(10\.\d{4,9}\/[^\s"'<>()\[\],;]+)/gi;
        while ((match = doiRegex.exec(remainingText)) !== null) {
            let doi = match[1] || match[0];
            doi = doi.replace(/[\.,;:\)\]\}]+$/g, '');
            try { doi = decodeURIComponent(doi); } catch (e) { }
            doi = doi.trim().toLowerCase();
            if (doi) dois.push(doi);
        }

        return { wosids, dois };
    };

    // 添加粘贴事件监听，自动提取、去重和排序
    textarea.addEventListener("paste", (e) => {
        // 如果自动提取未开启，使用默认粘贴行为
        if (!autoExtractEnabled) {
            return;
        }

        e.preventDefault();

        // 获取粘贴的文本
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');



        // 1. 从原有文本中提取
        const currentContent = textarea.value.trim();
        const currentExtracted = extractFromText(currentContent);

        // 2. 从粘贴的文本中提取
        const pastedExtracted = extractFromText(pastedText);

        // 3. 合并
        const allWosids = [...currentExtracted.wosids, ...pastedExtracted.wosids];
        const allDois = [...currentExtracted.dois, ...pastedExtracted.dois];

        // 4. 去重
        const uniqueWosids = [...new Set(allWosids)];
        const uniqueDois = [...new Set(allDois)];

        // 5. 排序后显示：WOS ID 在上，DOI 在下
        const finalContent = [...uniqueWosids, ...uniqueDois].join('\n');
        textarea.value = finalContent;

    });

    // contentBox.appendChild(textareaLabel);
    contentBox.appendChild(textarea);

    // 按钮行
    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.gap = "6px";

    // Query 按钮
    const queryBtn = document.createElement("button");
    queryBtn.textContent = "Query";
    queryBtn.style.flex = "1";
    queryBtn.style.padding = "6px 12px";
    queryBtn.style.background = "rgba(76,175,80,0.8)";
    queryBtn.style.color = "#fff";
    queryBtn.style.border = "none";
    queryBtn.style.borderRadius = "5px";
    queryBtn.style.cursor = "pointer";
    queryBtn.style.fontSize = "12px";
    queryBtn.style.fontWeight = "bold";
    queryBtn.style.outline = "none";
    queryBtn.title = "Query WOS IDs or DOIs from textarea";

    queryBtn.onclick = async () => {
        const text = textarea.value.trim();
        if (!text) {
            console.warn("Please enter WOS IDs or DOIs");
            return;
        }

        // 保存到历史记录
        saveHistory(text);

        const res = extractFromText(text);
        await wos.query_wosid_or_doi(res.wosids, res.dois);
    };

    // 创建自动提取切换按钮
    const autoExtractBtn = document.createElement("button");
    autoExtractBtn.textContent = autoExtractEnabled ? "Auto: ON" : "Auto: OFF";
    autoExtractBtn.style.flex = "1";
    autoExtractBtn.style.padding = "6px 12px";
    autoExtractBtn.style.background = autoExtractEnabled ? "rgba(76,175,80,0.8)" : "rgba(158,158,158,0.8)";
    autoExtractBtn.style.color = "#fff";
    autoExtractBtn.style.border = "none";
    autoExtractBtn.style.borderRadius = "5px";
    autoExtractBtn.style.cursor = "pointer";
    autoExtractBtn.style.fontSize = "12px";
    autoExtractBtn.style.fontWeight = "bold";
    autoExtractBtn.style.outline = "none";
    autoExtractBtn.style.whiteSpace = "nowrap";
    autoExtractBtn.title = "Toggle auto-extract WOS IDs and DOIs on paste";

    autoExtractBtn.onclick = () => {
        autoExtractEnabled = !autoExtractEnabled;
        writeStorage(AUTO_EXTRACT_KEY, autoExtractEnabled.toString());

        autoExtractBtn.textContent = autoExtractEnabled ? "Auto: ON" : "Auto: OFF";
        autoExtractBtn.style.background = autoExtractEnabled ? "rgba(76,175,80,0.8)" : "rgba(158,158,158,0.8)";

    };

    buttonRow.appendChild(queryBtn);
    buttonRow.appendChild(autoExtractBtn);

    contentBox.appendChild(buttonRow);
    queryTabPanel.appendChild(contentBox);

    // === 底部添加 DOI/WOS Data Export 按钮 ===
    const exportFlowGroup = document.createElement('div');
    exportFlowGroup.style.display = 'flex';
    exportFlowGroup.style.flexDirection = 'column';
    exportFlowGroup.style.gap = '8px';
    exportFlowGroup.style.marginTop = '0';
    exportFlowGroup.style.padding = '0';
    exportFlowGroup.style.background = 'transparent';
    exportFlowGroup.style.border = 'none';
    exportFlowGroup.style.borderRadius = '0';

    const exportFlowTitle = document.createElement('div');
    exportFlowTitle.textContent = 'Export Flow';
    exportFlowTitle.style.color = '#fff';
    exportFlowTitle.style.fontSize = '12px';
    exportFlowTitle.style.fontWeight = 'bold';

    const exportFlowHint = document.createElement('div');
    exportFlowHint.textContent = 'Step 1: Select directory -> Step 2: Export -> Step 3: Check progress';
    exportFlowHint.style.color = 'rgba(255,255,255,0.78)';
    exportFlowHint.style.fontSize = '10px';
    exportFlowHint.style.lineHeight = '1.4';
    exportFlowHint.style.marginBottom = '2px';

    exportFlowGroup.appendChild(exportFlowTitle);
    exportFlowGroup.appendChild(exportFlowHint);

    const selectExportDirBtn = document.createElement('button');
    selectExportDirBtn.textContent = 'Step 1: Select Export Directory';
    selectExportDirBtn.style.display = 'block';
    selectExportDirBtn.style.width = '100%';
    selectExportDirBtn.style.padding = '8px 0';
    selectExportDirBtn.style.background = '#546e7a';
    selectExportDirBtn.style.color = '#fff';
    selectExportDirBtn.style.border = 'none';
    selectExportDirBtn.style.borderRadius = '4px';
    selectExportDirBtn.style.fontSize = '12px';
    selectExportDirBtn.style.cursor = 'pointer';
    selectExportDirBtn.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';

    const setButtonIconAndText = (button, iconClass, text) => {
        button.replaceChildren();
        const icon = document.createElement('i');
        icon.className = iconClass;
        icon.style.marginRight = '6px';
        button.appendChild(icon);
        button.appendChild(document.createTextNode(text));
    };

    const exportBtn = document.createElement('button');
    const exportBtnDefaultText = 'Step 2: Export all (500 per txt file)';
    exportBtn.textContent = exportBtnDefaultText;
    exportBtn.style.display = 'block';
    exportBtn.style.width = '100%';
    exportBtn.style.padding = '10px 0';
    exportBtn.style.background = '#1976d2';
    exportBtn.style.color = '#fff';
    exportBtn.style.border = 'none';
    exportBtn.style.borderRadius = '4px';
    exportBtn.style.fontSize = '12px';
    exportBtn.style.cursor = 'pointer';
    exportBtn.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
    exportBtn.disabled = true;

    let exportInProgress = false;
    const syncExportFlowState = () => {
        const hasDir = !!exportDirHandle;
        const dirLabel = exportDirName || (hasDir && exportDirHandle && exportDirHandle.name ? exportDirHandle.name : '');
        if (hasDir) {
            setButtonIconAndText(selectExportDirBtn, 'fa-solid fa-circle-check', `Step 1: Directory Selected (${dirLabel})`);
            selectExportDirBtn.style.background = '#2e7d32';
        } else {
            setButtonIconAndText(selectExportDirBtn, 'fa-solid fa-folder-open', 'Step 1: Select Export Directory');
            selectExportDirBtn.style.background = '#546e7a';
        }

        const canExport = hasDir && !exportInProgress;
        exportBtn.disabled = !canExport;
        exportBtn.style.opacity = canExport ? '1' : '0.6';
        exportBtn.style.cursor = canExport ? 'pointer' : 'not-allowed';
        exportBtn.title = hasDir ? 'Step 2: Export all records in 500-per-file batches' : 'Select export directory first';
    };

    selectExportDirBtn.onclick = async () => {
        try {
            await chooseExportDirectory();
            syncExportFlowState();
        } catch (error) {
            if (error && (error.name === 'AbortError' || error.message === 'The user aborted a request.')) {
                return;
            }
            alert('Failed to select directory: ' + (error && error.message ? error.message : error));
        }
    };

    // 尝试从 popup 写入的 handle 恢复目录
    loadStoredProjectHandle().then((handle) => {
        if (!handle) return;
        exportDirHandle = handle;
        exportDirName = handle.name || '';
        window.enlightenkeyDirectoryHandle = handle;
        syncExportFlowState();
    });

    const exportProgressWrap = document.createElement('div');
    exportProgressWrap.style.display = 'none';
    exportProgressWrap.style.padding = '6px 8px';
    exportProgressWrap.style.background = 'rgba(255,255,255,0.1)';
    exportProgressWrap.style.borderRadius = '4px';

    const exportProgressStepTitle = document.createElement('div');
    exportProgressStepTitle.textContent = 'Step 3: Export Progress';
    exportProgressStepTitle.style.color = 'rgba(255,255,255,0.88)';
    exportProgressStepTitle.style.fontSize = '10px';
    exportProgressStepTitle.style.marginBottom = '4px';

    const exportProgressText = document.createElement('div');
    exportProgressText.style.color = '#fff';
    exportProgressText.style.fontSize = '11px';
    exportProgressText.style.marginBottom = '4px';
    exportProgressText.textContent = 'Waiting...';

    const exportProgressBar = document.createElement('div');
    exportProgressBar.style.width = '100%';
    exportProgressBar.style.height = '6px';
    exportProgressBar.style.background = 'rgba(255,255,255,0.2)';
    exportProgressBar.style.borderRadius = '999px';
    exportProgressBar.style.overflow = 'hidden';

    const exportProgressFill = document.createElement('div');
    exportProgressFill.style.width = '0%';
    exportProgressFill.style.height = '100%';
    exportProgressFill.style.background = '#4caf50';
    exportProgressFill.style.transition = 'width 0.2s ease';
    exportProgressBar.appendChild(exportProgressFill);

    const exportProgressDetail = document.createElement('div');
    exportProgressDetail.style.color = 'rgba(255,255,255,0.85)';
    exportProgressDetail.style.fontSize = '10px';
    exportProgressDetail.style.marginTop = '4px';
    exportProgressDetail.textContent = '';

    exportProgressWrap.appendChild(exportProgressStepTitle);
    exportProgressWrap.appendChild(exportProgressText);
    exportProgressWrap.appendChild(exportProgressBar);
    exportProgressWrap.appendChild(exportProgressDetail);

    const renderExportProgress = ({
        visible = true,
        statusText = 'Exporting...',
        detailText = '',
        completed = 0,
        total = 0,
        isError = false
    } = {}) => {
        exportProgressWrap.style.display = visible ? 'block' : 'none';
        exportProgressText.textContent = statusText;
        exportProgressText.style.color = isError ? '#ff8a80' : '#fff';
        exportProgressDetail.textContent = detailText;
        const ratio = total > 0 ? Math.max(0, Math.min(completed / total, 1)) : 0;
        exportProgressFill.style.width = `${Math.round(ratio * 100)}%`;
        exportProgressFill.style.background = isError ? '#f44336' : '#4caf50';
    };

    exportBtn.onclick = async () => {
        if (!exportDirHandle) {
            renderExportProgress({
                visible: true,
                statusText: 'Please select export directory first',
                detailText: 'Step 1 is required before export',
                completed: 0,
                total: 0,
                isError: true
            });
            return;
        }
        exportInProgress = true;
        syncExportFlowState();
        const oldText = exportBtn.textContent;
        exportBtn.textContent = 'Step 2: Exporting...';
        let finalCompleted = 0;
        let finalTotal = 0;
        renderExportProgress({
            visible: true,
            statusText: 'Preparing export...',
            detailText: 'Initializing batch export',
            completed: 0,
            total: 0
        });
        try {
            if (window.wos && window.wos.uuid && typeof window.wos.uuid.export_batchSize_toTxt === 'function') {
                await window.wos.uuid.export_batchSize_toTxt(1, 0, 200, (progress = {}) => {
                    const {
                        phase = '',
                        completedBatches = 0,
                        totalBatches = 0,
                        current = 0,
                        batchEnd = 0,
                        message = ''
                    } = progress;
                    finalCompleted = completedBatches;
                    finalTotal = totalBatches;

                    if (phase === 'start') {
                        renderExportProgress({
                            visible: true,
                            statusText: `Exporting... 0/${totalBatches}`,
                            detailText: `Records ${progress.markFrom || 0}-${progress.markTo || 0}`,
                            completed: 0,
                            total: totalBatches
                        });
                        return;
                    }

                    if (phase === 'batch') {
                        renderExportProgress({
                            visible: true,
                            statusText: `Exporting... ${completedBatches}/${totalBatches}`,
                            detailText: `Saved records ${current}-${batchEnd}`,
                            completed: completedBatches,
                            total: totalBatches
                        });
                        return;
                    }

                    if (phase === 'error') {
                        renderExportProgress({
                            visible: true,
                            statusText: 'Export failed',
                            detailText: message || 'Batch export failed',
                            completed: completedBatches,
                            total: totalBatches,
                            isError: true
                        });
                        return;
                    }

                    if (phase === 'complete') {
                        renderExportProgress({
                            visible: true,
                            statusText: `Export completed ${completedBatches}/${totalBatches}`,
                            detailText: 'All batch files are saved',
                            completed: completedBatches,
                            total: totalBatches
                        });
                    }
                });
                exportBtn.textContent = 'Step 2: Export completed!';
                renderExportProgress({
                    visible: true,
                    statusText: `Export completed ${finalCompleted}/${finalTotal}`,
                    detailText: 'All batch files are saved',
                    completed: finalCompleted,
                    total: finalTotal
                });
            } else {
                exportBtn.textContent = 'Step 2: Export function not found';
                renderExportProgress({
                    visible: true,
                    statusText: 'Export function not found',
                    detailText: 'window.wos.uuid.export_batchSize_toTxt is unavailable',
                    completed: 0,
                    total: 0,
                    isError: true
                });
            }
        } catch (err) {
            exportBtn.textContent = 'Step 2: Export failed';
            renderExportProgress({
                visible: true,
                statusText: 'Export failed',
                detailText: err && err.message ? err.message : 'Unexpected export error',
                completed: finalCompleted,
                total: finalTotal,
                isError: true
            });
        } finally {
            setTimeout(() => {
                exportBtn.textContent = oldText || exportBtnDefaultText;
                exportInProgress = false;
                syncExportFlowState();
            }, 2000);
        }
    };

    syncExportFlowState();


    // 添加 Async Enlightenkey DOIList 按钮
    const asyncDoiBtn = document.createElement('button');
    // 初始化按钮文本，显示 DOI 数量
    async function updateAsyncDoiBtnText() {
        const doiList = await new Promise(resolve => {
            function handleDoiListMsg(event) {
                if (event.data && event.data.type === 'ENLIGHTENKEY_DOI_LIST_RESPONSE') {
                    window.removeEventListener('message', handleDoiListMsg);
                    resolve(event.data.doiList || []);
                }
            }
            window.addEventListener('message', handleDoiListMsg);
            window.postMessage({ type: 'ENLIGHTENKEY_DOI_LIST_REQUEST' }, '*');
            setTimeout(() => {
                window.removeEventListener('message', handleDoiListMsg);
                resolve([]);
            }, 1500);
        });
        if (!doiList || doiList.length === 0) {
            asyncDoiBtn.style.display = 'none';
            return;
        }
        asyncDoiBtn.style.display = 'block';
        asyncDoiBtn.textContent = `Open GEWU DOIList (${doiList.length})`;
    }

    asyncDoiBtn.style.display = 'none';
    asyncDoiBtn.style.width = '100%';
    asyncDoiBtn.style.padding = '10px 0';
    asyncDoiBtn.style.background = '#ff9800';
    asyncDoiBtn.style.color = '#fff';
    asyncDoiBtn.style.border = 'none';
    asyncDoiBtn.style.borderRadius = '4px';
    asyncDoiBtn.style.fontSize = '12px';
    asyncDoiBtn.style.cursor = 'pointer';
    asyncDoiBtn.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
    asyncDoiBtn.disabled = false;
    updateAsyncDoiBtnText();

    asyncDoiBtn.onclick = async () => {
        asyncDoiBtn.disabled = true;
        const oldText = asyncDoiBtn.textContent;
        asyncDoiBtn.textContent = 'Fetching...';
        try {
            // 每次点击前刷新数量
            await updateAsyncDoiBtnText();
            // 1. 通过 window.postMessage 请求 contentScript 代为获取 DOI 列表
            const doiList = await new Promise(resolve => {
                function handleDoiListMsg(event) {
                    if (event.data && event.data.type === 'ENLIGHTENKEY_DOI_LIST_RESPONSE') {
                        window.removeEventListener('message', handleDoiListMsg);
                        resolve(event.data.doiList || []);
                    }
                }
                window.addEventListener('message', handleDoiListMsg);
                window.postMessage({ type: 'ENLIGHTENKEY_DOI_LIST_REQUEST' }, '*');
                // 超时兜底
                setTimeout(() => {
                    window.removeEventListener('message', handleDoiListMsg);
                    resolve([]);
                }, 3000);
            });
            if (!doiList || doiList.length === 0) {
                asyncDoiBtn.style.display = 'none';
                asyncDoiBtn.disabled = false;
                return;
            }
            // 2. 执行一次 wos query
            if (window.wos && typeof window.wos.query_wosid_or_doi === 'function') {
                await window.wos.query_wosid_or_doi([], doiList);
            }
            // 3. 输出 DOI 数量
            console.log('[Async GEWU DOIList] DOI数量:', doiList.length);

            asyncDoiBtn.textContent = 'opened GEWU DOIs!';
        } catch (err) {
            asyncDoiBtn.textContent = 'failed to open DOIs';
        } finally {
            setTimeout(() => {
                asyncDoiBtn.textContent = oldText;
                asyncDoiBtn.disabled = false;
            }, 2000);
        }
    };

    queryTabPanel.appendChild(asyncDoiBtn);
    exportFlowGroup.appendChild(selectExportDirBtn);
    exportFlowGroup.appendChild(exportBtn);
    exportFlowGroup.appendChild(exportProgressWrap);
    exportTabPanel.appendChild(exportFlowGroup);

    // === WOS Query Builder Section ===
    // 分隔线
    const separator = document.createElement('div');
    separator.style.width = '100%';
    separator.style.height = '1px';
    separator.style.background = 'rgba(255,255,255,0.2)';
    separator.style.margin = '12px 0 8px 0';
    queryTabPanel.appendChild(separator);

    // WOS Query 标题
    const queryTitle = document.createElement('div');
    queryTitle.textContent = 'WOS Query Builder';
    queryTitle.style.color = '#fff';
    queryTitle.style.fontSize = '13px';
    queryTitle.style.fontWeight = 'bold';
    queryTitle.style.marginBottom = '6px';
    queryTabPanel.appendChild(queryTitle);

    // WOS Query 输入和按钮行
    const wosQueryRow = document.createElement('div');
    wosQueryRow.style.display = 'flex';
    wosQueryRow.style.gap = '6px';
    wosQueryRow.style.alignItems = 'stretch';

    // WOS Query 输入框
    const wosQueryInput = document.createElement('input');
    wosQueryInput.type = 'text';
    wosQueryInput.placeholder = 'Enter natural language query...';
    wosQueryInput.style.flex = '1';
    wosQueryInput.style.padding = '8px';
    wosQueryInput.style.border = 'none';
    wosQueryInput.style.borderRadius = '4px';
    wosQueryInput.style.outline = 'none';
    wosQueryInput.style.fontSize = '12px';
    wosQueryInput.style.background = 'rgba(255,255,255,0.9)';

    // WOS Query 提交按钮
    const wosQueryBtn = document.createElement('button');
    wosQueryBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    wosQueryBtn.style.padding = '8px 16px';
    wosQueryBtn.style.background = 'rgba(33, 150, 243, 0.9)';
    wosQueryBtn.style.color = '#fff';
    wosQueryBtn.style.border = 'none';
    wosQueryBtn.style.borderRadius = '4px';
    wosQueryBtn.style.cursor = 'pointer';
    wosQueryBtn.style.fontSize = '14px';
    wosQueryBtn.style.outline = 'none';
    wosQueryBtn.style.whiteSpace = 'nowrap';
    wosQueryBtn.style.display = 'flex';
    wosQueryBtn.style.alignItems = 'center';
    wosQueryBtn.style.justifyContent = 'center';
    wosQueryBtn.title = 'Build and execute WOS query';

    const CHAT_API_KEY_REQUEST_EVENT = "__ENLIGHTENKEY_CHAT_API_KEY_REQUEST__";
    const CHAT_API_KEY_RESPONSE_EVENT = "__ENLIGHTENKEY_CHAT_API_KEY_RESPONSE__";
    const PROMPT_CACHE = new Map();

    const requestApiKeyFromChromeStorage = () => new Promise((resolve) => {
        const requestId = `wos-api-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        let settled = false;

        const handler = (event) => {
            if (!event?.detail || event.detail.requestId !== requestId) {
                return;
            }
            settled = true;
            document.removeEventListener(CHAT_API_KEY_RESPONSE_EVENT, handler);
            resolve(event.detail.apiKey || "");
        };

        document.addEventListener(CHAT_API_KEY_RESPONSE_EVENT, handler);
        document.dispatchEvent(new CustomEvent(CHAT_API_KEY_REQUEST_EVENT, {
            detail: { requestId }
        }));

        setTimeout(() => {
            if (!settled) {
                document.removeEventListener(CHAT_API_KEY_RESPONSE_EVENT, handler);
                resolve("");
            }
        }, 1200);
    });

    const resolveExtensionBaseUrl = () => {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
                return chrome.runtime.getURL('');
            }
        } catch (e) {}
        const scriptUrl = (document.currentScript && document.currentScript.src) || '';
        if (scriptUrl) {
            return new URL('.', scriptUrl).toString();
        }
        const fallback = Array.from(document.scripts || []).find(
            (script) => script.src && script.src.includes('z-wos-doi-query.js')
        );
        if (fallback?.src) {
            return new URL('.', fallback.src).toString();
        }
        return '';
    };

    const EXTENSION_BASE_URL = resolveExtensionBaseUrl();
    const getPromptUrl = (relativePath) => {
        if (EXTENSION_BASE_URL) {
            return new URL(relativePath, EXTENSION_BASE_URL).toString();
        }
        return relativePath;
    };

    const loadPrompt = async () => {
        if (PROMPT_CACHE.has('wosQuery')) {
            return PROMPT_CACHE.get('wosQuery');
        }
        const url = getPromptUrl('prompts/wos-query.md');
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load prompt: wosQuery (${response.status})`);
        }
        const text = (await response.text()).trim();
        PROMPT_CACHE.set('wosQuery', text);
        return text;
    };

    const buildWosQueryPayload = async (text) => {
        const systemPrompt = await loadPrompt();
        return {
            'model': 'gpt-4.1-mini',
            'input': [
                {
                    'role': 'system',
                    'content': [
                        {
                            'type': 'input_text',
                            'text': systemPrompt
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
                }
            ],
            'text': {
                'format': {
                    'type': 'text'
                }
            },
            'tools': [],
            'temperature': 0,
            'max_output_tokens': 1024,
            'top_p': 1,
            'store': false
        };
    };

    const callOpenAI = async (apiKey, jsonData) => {
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(jsonData)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        return response.json();
    };

    const runWosQueryFallback = async (text) => {
        let apiKey = window.openai_api_key || '';
        if (!apiKey) {
            apiKey = await requestApiKeyFromChromeStorage();
        }
        if (!apiKey) {
            throw new Error('OpenAI API key missing. Please set it in popup.');
        }
        window.openai_api_key = apiKey;

        const jsonData = await buildWosQueryPayload(text);
        const result = await callOpenAI(apiKey, jsonData);
        const rawText = result?.output?.[0]?.content?.[0]?.text || '';
        const codeBlockMatch = rawText.match(/```(?:wosquery|json)?\s*([\s\S]*?)```/i);
        const jsonText = (codeBlockMatch ? codeBlockMatch[1] : rawText).trim();
        const parsedResult = JSON.parse(jsonText);
        const rowText = parsedResult?.wos_query?.[0]?.rowText || parsedResult?.[0]?.rowText;
        if (rowText && window.wos && typeof window.wos.query === 'function') {
            await window.wos.query(rowText);
        } else if (!rowText) {
            console.warn('[WOS Query Builder] missing rowText from response:', parsedResult);
        }
        return rowText || null;
    };

    // 处理提交
    const handleWosQuery = async () => {
        const queryText = wosQueryInput.value.trim();
        if (!queryText) {
            console.warn('[WOS Query Builder] Please enter a query');
            return;
        }

        console.log('[WOS Query Builder] Query text:', queryText);
        wosQueryBtn.disabled = true;
        const originalContent = wosQueryBtn.innerHTML;
        wosQueryBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            // 使用与 Chat 面板完全相同的实现
            if (typeof window.openai_api_chat_query === 'function') {
                await window.openai_api_chat_query(queryText);
                console.log('[WOS Query Builder] Query executed successfully');
                // 清空输入框
                wosQueryInput.value = '';
            } else {
                await runWosQueryFallback(queryText);
                console.log('[WOS Query Builder] Query executed successfully (fallback)');
                wosQueryInput.value = '';
            }
        } catch (error) {
            console.error('[WOS Query Builder] Query execution failed:', error);
            alert('Query failed: ' + (error.message || 'Unknown error'));
        } finally {
            wosQueryBtn.disabled = false;
            wosQueryBtn.innerHTML = originalContent;
        }
    };

    wosQueryBtn.onclick = handleWosQuery;

    // 支持回车键提交
    wosQueryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleWosQuery();
        }
    });

    wosQueryRow.appendChild(wosQueryInput);
    wosQueryRow.appendChild(wosQueryBtn);
    queryTabPanel.appendChild(wosQueryRow);

    document.body.appendChild(box);

    // 预先声明事件处理器和清理函数
    let dragger = null;
    let visibilityHandler, showHandler, hideHandler;

    // 清理函数
    const cleanup = () => {
        console.log("[WOS DOI Query] Cleaning up resources...");
        // 销毁拖动功能
        dragger?.destroy();
        // 移除所有事件监听器
        if (visibilityHandler) document.removeEventListener("__WOS_DOI_QUERY_VISIBILITY__", visibilityHandler);
        if (showHandler) document.removeEventListener("__SHOW_WOS_DOI_QUERY__", showHandler);
        if (hideHandler) document.removeEventListener("__HIDE_WOS_DOI_QUERY__", hideHandler);
        // 移除DOM元素
        box.remove();
        console.log("[WOS DOI Query] Resources cleaned up");
    };

    // 设置关闭按钮的点击事件
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        cleanup();
    };

    // 使用全局自由拖动功能
    dragger = window.createFreeDragger(box, controlRow, {
        topKey: POSITION_TOP_KEY,
        leftKey: POSITION_LEFT_KEY
    });

    const ensurePanelInView = () => {
        const width = box.offsetWidth || 350;
        const height = box.offsetHeight || 320;
        const currentTop = box.style.top || savedTop;
        const currentLeft = box.style.left || savedLeft || `${window.innerWidth - 360}px`;
        const clamped = window.clampPanelPosition({
            top: currentTop,
            left: currentLeft,
            defaultTop: 80,
            defaultLeft: window.innerWidth - 360,
            width,
            height,
            margin: 8
        });
        box.style.top = `${Math.round(clamped.top)}px`;
        box.style.left = `${Math.round(clamped.left)}px`;
        box.style.right = "auto";
        writeStorage(POSITION_TOP_KEY, box.style.top);
        writeStorage(POSITION_LEFT_KEY, box.style.left);
    };

    ensurePanelInView();

    // 监听来自 content script 的可见性控制事件
    visibilityHandler = (e) => {
        console.log("[WOS DOI Query] Visibility event received:", e.detail);
        if (e.detail && typeof e.detail.visible === 'boolean') {
            const visible = e.detail.visible;
            const beforeDisplay = box.style.display;
            box.style.display = visible ? "flex" : "none";
            const afterDisplay = box.style.display;
            console.log(`[WOS DOI Query] Display changed: ${beforeDisplay} -> ${afterDisplay}, box exists: ${!!box}, box in DOM: ${document.contains(box)}`);
            if (visible) {
                ensurePanelInView();
            }
        }
    };
    document.addEventListener("__WOS_DOI_QUERY_VISIBILITY__", visibilityHandler);

    // 监听显示面板事件
    showHandler = () => {
        box.style.display = "flex";
        console.log("[WOS DOI Query] Panel shown");
    };
    document.addEventListener("__SHOW_WOS_DOI_QUERY__", showHandler);

    // 监听隐藏面板事件
    hideHandler = () => {
        box.style.display = "none";
        console.log("[WOS DOI Query] Panel hidden");
    };
    document.addEventListener("__HIDE_WOS_DOI_QUERY__", hideHandler);

    console.log("[WOS DOI Query] Panel initialized and event listeners attached");

})();
