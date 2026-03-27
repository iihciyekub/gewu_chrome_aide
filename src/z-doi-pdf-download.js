/**
 * 批量下载 PDF 工具
 * Dec 26, 2025 at 11:34:53
 */

const SO_temp = {
    "MOSM/MS": "/doi/pdf/{doi}?download=true",
    "POMS/JOM": "/doi/pdfdirect/{doi}?download=true",
    "JMMD": "/doi/epdf/{doi}?needAccess=true"
};


/**
 * PDF 批量下载工具
 - 先用机构登陆对应的期刊网站,可以下载pdf后,再运行此脚本
 * */
(function () {
    // 检查并删除已存在的实例
    const existing = document.getElementById("ref-paper-downloader");
    if (existing) {
        existing.__dragger?.destroy?.();
        existing.remove();
        console.log("[DOI PDF Download] Reloading");
    }

    // ---- localStorage 读取默认模板 ----
    const TEMPLATE_KEY = "pdf_download_template";
    const TIMER_KEY = "pdf_download_timer";
    const BATCH_MIN_KEY = "pdf_download_batch_minutes";
    const POS_TOP_KEY = "pdf_download_panel_top";
    const POS_LEFT_KEY = "pdf_download_panel_left";
    
    const readStorage = (key, fallback) => {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch (error) {
            console.warn("[DOI PDF Download] Failed to read localStorage:", error);
            return fallback;
        }
    };

    const writeStorage = (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn("[DOI PDF Download] Failed to write localStorage:", error);
        }
    };

    // ========== 下载目录选择（与 DOI Query 共用） ==========
    let downloadDirHandle = null;
    let downloadDirName = '';

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
            console.warn("[DOI PDF Download] Failed to load directory handle:", error);
            return null;
        }
    };

    const ensureDirectoryPermission = async (handle) => {
        try {
            const opts = { mode: 'readwrite' };
            if (await handle.queryPermission(opts) === 'granted') return true;
            return (await handle.requestPermission(opts)) === 'granted';
        } catch (error) {
            console.warn("[DOI PDF Download] Directory permission check failed:", error);
            return false;
        }
    };

    const chooseDownloadDirectory = async () => {
        if (!window.showDirectoryPicker) {
            throw new Error('Directory picker is not supported');
        }
        const handle = await window.showDirectoryPicker({ id: 'enlightenkey-project', mode: 'readwrite' });
        const granted = await ensureDirectoryPermission(handle);
        if (!granted) {
            throw new Error('Write permission not granted');
        }
        downloadDirHandle = handle;
        downloadDirName = handle.name || '';
        window.enlightenkeyDirectoryHandle = handle;
        await setStoredProjectHandle(handle);
        return handle;
    };

    window.doiPdfDownload = window.doiPdfDownload || {};
    window.doiPdfDownload.selectDownloadDirectory = chooseDownloadDirectory;

    const defaultTemplate = "/doi/pdf/{doi}?download=true";
    const savedTemplate = readStorage(TEMPLATE_KEY, defaultTemplate);
    const savedTimer = readStorage(TIMER_KEY, "10000");
    const savedBatchMinutes = readStorage(BATCH_MIN_KEY, "35");
    const savedTop = readStorage(POS_TOP_KEY, "120px");
    const savedLeft = readStorage(POS_LEFT_KEY, null);


    // ==============================
    //  UI 创建
    // ==============================
    const box = document.createElement("div");
    box.id = "ref-paper-downloader";
    box.style.position = "fixed";
    const { top, left } = window.clampPanelPosition({
        top: savedTop,
        left: savedLeft,
        defaultTop: 120,
        defaultLeft: window.innerWidth - 470,
        width: 450,
        height: 360,
        margin: 8
    });
    box.style.top = `${Math.round(top)}px`;
    box.style.left = `${Math.round(left)}px`;
    box.style.right = "auto";
    box.style.transform = "none";
    box.style.width = "360px";
    box.style.zIndex = 999999;
    box.style.background = "#ffffff";
    box.style.padding = "0";
    box.style.borderRadius = "4px";
    box.style.boxSizing = "border-box";
    box.style.color = "#243b53";
    box.style.fontSize = "14px";
    box.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    box.style.display = "none"; // 默认隐藏，等待popup开启
    box.style.flexDirection = "column";
    box.style.border = "1px solid #d7dfe8";
    box.style.boxShadow = "0 1px 4px rgba(15, 23, 42, 0.08)";
    box.style.overflow = "hidden";
    document.body.appendChild(box);

    // 标题栏容器
    const titleBar = document.createElement("div");
    titleBar.style.display = "flex";
    titleBar.style.justifyContent = "space-between";
    titleBar.style.alignItems = "center";
    titleBar.style.cursor = "move";
    titleBar.style.flex = "0 0 auto";
    titleBar.style.width = "100%";
    titleBar.style.minHeight = "38px";
    titleBar.style.padding = "6px 10px";
    titleBar.style.background = "#174b78";
    titleBar.style.borderBottom = "1px solid #123a5c";
    titleBar.style.borderRadius = "4px 4px 0 0";
    titleBar.style.boxSizing = "border-box";
    box.appendChild(titleBar);

    // 拖动手柄
    const dragHandle = document.createElement("div");
    dragHandle.textContent = "PDF Batch Downloader";
    dragHandle.style.fontWeight = "600";
    dragHandle.style.fontSize = "12px";
    dragHandle.style.cursor = "inherit";
    dragHandle.style.userSelect = "none";
    dragHandle.style.color = "#fff";
    dragHandle.style.lineHeight = "1";
    titleBar.appendChild(dragHandle);

    // 关闭按钮
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
    closeBtn.style.border = "1px solid rgba(255,255,255,0.20)";
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "#fff";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "11px";
    closeBtn.style.width = "22px";
    closeBtn.style.height = "22px";
    closeBtn.style.padding = "0";
    closeBtn.style.borderRadius = "4px";
    closeBtn.style.display = "inline-flex";
    closeBtn.style.alignItems = "center";
    closeBtn.style.justifyContent = "center";
    closeBtn.style.flexShrink = "0";
    closeBtn.style.lineHeight = "1";
    closeBtn.style.boxSizing = "border-box";
    closeBtn.title = "close";
    titleBar.appendChild(closeBtn);


    // 创建内容容器（提前声明和初始化）
    const contentContainer = document.createElement("div");
    contentContainer.style.display = "flex";
    contentContainer.style.flexDirection = "column";
    contentContainer.style.gap = "8px";
    contentContainer.style.flex = "1";
    contentContainer.style.minHeight = "0";
    contentContainer.style.overflowY = "auto";
    contentContainer.style.alignItems = "stretch";
    contentContainer.style.boxSizing = "border-box";
    contentContainer.style.padding = "8px";
    contentContainer.style.paddingTop = "6px";
    box.appendChild(contentContainer);

    const applyInputBaseStyle = (el) => {
        el.style.boxSizing = "border-box";
        el.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        el.style.color = "#243b53";
        el.style.background = "#ffffff";
        el.style.border = "1px solid #d0d9e3";
        el.style.borderRadius = "8px";
        el.style.outline = "none";
    };

    // ---- SO_temp 下拉菜单 ----
    const templateSelect = document.createElement("select");
    applyInputBaseStyle(templateSelect);
    templateSelect.style.width = "100%";
    templateSelect.style.height = "32px";
    templateSelect.style.fontSize = "12px";
    templateSelect.style.padding = "0 10px";
    templateSelect.style.cursor = "pointer";

    // 添加"Custom"选项
    const customOpt = document.createElement("option");
    customOpt.value = "custom";
    customOpt.textContent = "Custom";
    templateSelect.appendChild(customOpt);

    // 添加 SO_temp 中的选项
    for (const [key, value] of Object.entries(SO_temp)) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = key;
        templateSelect.appendChild(opt);
    }
    contentContainer.appendChild(templateSelect);

    // ---- URL 模板输入框 ----
    const label1 = document.createElement("div");
    label1.style.fontSize = "12px";
    label1.textContent = "PDF path (use {doi} as placeholder):";
    label1.style.width = "100%";
    label1.style.color = "#486581";
    contentContainer.appendChild(label1);

    const templateInput = document.createElement("input");
    templateInput.type = "text";
    templateInput.value = savedTemplate;
    applyInputBaseStyle(templateInput);
    templateInput.style.width = "100%";
    templateInput.style.height = "32px";
    templateInput.style.fontSize = "12px";
    templateInput.style.padding = "0 10px";
    contentContainer.appendChild(templateInput);

    // 下拉菜单变化事件
    templateSelect.addEventListener("change", () => {
        const selectedValue = templateSelect.value;
        if (selectedValue !== "custom") {
            templateInput.value = selectedValue;
            localStorage.setItem(TEMPLATE_KEY, selectedValue);
            console.log("Template updated from dropdown:", selectedValue);
        }
    });

    // 输入框变化事件
    templateInput.addEventListener("change", () => {
        localStorage.setItem(TEMPLATE_KEY, templateInput.value);
        console.log("had saved URL template：", templateInput.value);

        // 检查输入值是否匹配 SO_temp 中的某个模板
        let matchFound = false;
        for (const [key, value] of Object.entries(SO_temp)) {
            if (templateInput.value === value) {
                templateSelect.value = value;
                matchFound = true;
                break;
            }
        }
        if (!matchFound) {
            templateSelect.value = "custom";
        }
    });

    // 初始化下拉菜单选中状态
    let initialMatch = false;
    for (const [key, value] of Object.entries(SO_temp)) {
        if (savedTemplate === value) {
            templateSelect.value = value;
            initialMatch = true;
            break;
        }
    }
    if (!initialMatch) {
        templateSelect.value = "custom";
    }
    // ---- Timer + 批次间隔 输入框（同行） ----
    const timeRow = document.createElement("div");
    timeRow.style.display = "flex";
    timeRow.style.gap = "8px";
    timeRow.style.width = "100%";
    contentContainer.appendChild(timeRow);

    const timerWrap = document.createElement("div");
    timerWrap.style.display = "flex";
    timerWrap.style.flexDirection = "column";
    timerWrap.style.flex = "1";
    timeRow.appendChild(timerWrap);

    const timerlable = document.createElement("div");
    timerlable.style.fontSize = "12px";
    timerlable.textContent = "Download delay (ms):";
    timerlable.style.color = "#486581";
    timerWrap.appendChild(timerlable);

    const timerInput = document.createElement("input");
    timerInput.type = "text";
    timerInput.value = savedTimer;
    applyInputBaseStyle(timerInput);
    timerInput.style.width = "100%";
    timerInput.style.height = "32px";
    timerInput.style.fontSize = "12px";
    timerInput.style.padding = "0 10px";
    timerWrap.appendChild(timerInput);

    timerInput.addEventListener("change", () => {
        localStorage.setItem(TIMER_KEY, timerInput.value);
        console.log("had saved URL template：", timerInput.value);
    });

    const batchWrap = document.createElement("div");
    batchWrap.style.display = "flex";
    batchWrap.style.flexDirection = "column";
    batchWrap.style.flex = "1";
    timeRow.appendChild(batchWrap);

    const batchLabel = document.createElement("div");
    batchLabel.style.fontSize = "12px";
    batchLabel.textContent = "Batch interval (minutes):";
    batchLabel.style.color = "#486581";
    batchWrap.appendChild(batchLabel);

    const batchInput = document.createElement("input");
    batchInput.type = "text";
    batchInput.value = savedBatchMinutes;
    applyInputBaseStyle(batchInput);
    batchInput.style.width = "100%";
    batchInput.style.height = "32px";
    batchInput.style.fontSize = "12px";
    batchInput.style.padding = "0 10px";
    batchWrap.appendChild(batchInput);

    batchInput.addEventListener("change", () => {
        localStorage.setItem(BATCH_MIN_KEY, batchInput.value);
        console.log("had saved batch interval (minutes)：", batchInput.value);
    });


    // ---- 多行 DOI 输入框 ----
    const label2 = document.createElement("div");
    label2.style.fontSize = "12px";
    label2.textContent = "DOI list (one per line):";
    label2.style.width = "100%";
    label2.style.color = "#486581";
    contentContainer.appendChild(label2);

    const textarea = document.createElement("textarea");
    applyInputBaseStyle(textarea);
    textarea.style.width = "100%";
    textarea.style.minHeight = "160px";
    textarea.style.padding = "8px";
    textarea.style.fontSize = "12px";
    textarea.style.resize = "vertical"; // 只允许垂直调整大小，禁止水平调整
    textarea.style.overflowX = "hidden";
    contentContainer.appendChild(textarea);

    // ---- 下载目录选择按钮（独立一行） ----
    const selectDownloadDirBtn = document.createElement("button");
    selectDownloadDirBtn.textContent = downloadDirName ? `Download Folder: ${downloadDirName}` : "Choose Download Folder";
    selectDownloadDirBtn.style.height = "32px";
    selectDownloadDirBtn.style.width = "100%";
    selectDownloadDirBtn.style.border = "1px solid #d0d9e3";
    selectDownloadDirBtn.style.borderRadius = "8px";
    selectDownloadDirBtn.style.cursor = "pointer";
    selectDownloadDirBtn.style.background = "#f7f9fb";
    selectDownloadDirBtn.style.color = "#486581";
    selectDownloadDirBtn.style.fontWeight = "600";
    selectDownloadDirBtn.style.fontSize = "12px";
    selectDownloadDirBtn.style.boxSizing = "border-box";
    selectDownloadDirBtn.style.lineHeight = "1";
    selectDownloadDirBtn.style.padding = "0 10px";
    selectDownloadDirBtn.style.textAlign = "center";
    selectDownloadDirBtn.style.display = "inline-flex";
    selectDownloadDirBtn.style.alignItems = "center";
    selectDownloadDirBtn.style.justifyContent = "center";
    selectDownloadDirBtn.style.fontFamily = "inherit";
    contentContainer.appendChild(selectDownloadDirBtn);

    // ---- 工具按钮行 ----
    const toolsRow = document.createElement("div");
    toolsRow.style.display = "flex";
    toolsRow.style.gap = "8px";
    toolsRow.style.width = "100%";
    toolsRow.style.alignItems = "stretch";
    toolsRow.style.boxSizing = "border-box";
    contentContainer.appendChild(toolsRow);

    // ---- 同步本地已下载 PDF 的 DOI ----
    const syncBtn = document.createElement("button");
    syncBtn.textContent = "Sync PDFs in Folder";
    syncBtn.style.height = "32px";
    syncBtn.style.flex = "1";
    syncBtn.style.border = "1px solid #d0d9e3";
    syncBtn.style.borderRadius = "8px";
    syncBtn.style.cursor = "pointer";
    syncBtn.style.background = "#f7f9fb";
    syncBtn.style.color = "#486581";
    syncBtn.style.fontWeight = "600";
    syncBtn.style.fontSize = "12px";
    syncBtn.style.boxSizing = "border-box";
    syncBtn.style.lineHeight = "1";
    syncBtn.style.padding = "0 10px";
    syncBtn.style.textAlign = "center";
    syncBtn.style.display = "inline-flex";
    syncBtn.style.alignItems = "center";
    syncBtn.style.justifyContent = "center";
    syncBtn.style.fontFamily = "inherit";
    toolsRow.appendChild(syncBtn);

    // ---- 从文本提取 DOI ----
    const extractBtn = document.createElement("button");
    extractBtn.textContent = "Extract from Text";
    extractBtn.style.height = "32px";
    extractBtn.style.flex = "1";
    extractBtn.style.border = "1px solid #d0d9e3";
    extractBtn.style.borderRadius = "8px";
    extractBtn.style.cursor = "pointer";
    extractBtn.style.background = "#f7f9fb";
    extractBtn.style.color = "#486581";
    extractBtn.style.fontWeight = "600";
    extractBtn.style.fontSize = "12px";
    extractBtn.style.boxSizing = "border-box";
    extractBtn.style.lineHeight = "1";
    extractBtn.style.padding = "0 10px";
    extractBtn.style.textAlign = "center";
    extractBtn.style.display = "inline-flex";
    extractBtn.style.alignItems = "center";
    extractBtn.style.justifyContent = "center";
    extractBtn.style.fontFamily = "inherit";
    toolsRow.appendChild(extractBtn);


    // ---- 下载按钮 ----
    const btn = document.createElement("button");
    btn.textContent = "Download";
    btn.style.height = "32px";
    btn.style.width = "100%";
    btn.style.border = "1px solid #123a5c";
    btn.style.borderRadius = "8px";
    btn.style.cursor = "pointer";
    btn.style.background = "#174b78";
    btn.style.color = "#fff";
    btn.style.fontWeight = "600";
    btn.style.fontSize = "12px";
    btn.style.boxSizing = "border-box";
    btn.style.lineHeight = "1";
    btn.style.padding = "0 10px";
    btn.style.textAlign = "center";
    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.fontFamily = "inherit";
    contentContainer.appendChild(btn);

    // ---- 批次倒计时显示 ----
    const cooldownDiv = document.createElement("div");
    cooldownDiv.style.minHeight = "16px";
    cooldownDiv.style.fontSize = "12px";
    cooldownDiv.style.color = "#486581";
    cooldownDiv.style.width = "100%";
    contentContainer.appendChild(cooldownDiv);

    // ---- 显示日志 ----
    const logDiv = document.createElement("div");
    logDiv.style.maxHeight = "150px";
    logDiv.style.overflowY = "auto";
    logDiv.style.fontSize = "12px";
    logDiv.style.borderTop = "1px solid #dde4ec";
    logDiv.style.paddingTop = "6px";
    logDiv.style.width = "100%";
    logDiv.style.boxSizing = "border-box";
    contentContainer.appendChild(logDiv);

    function log(msg) {
        console.log(msg);
        const div = document.createElement("div");
        div.textContent = msg;
        div.style.color = "#243b53";
        logDiv.innerHTML = div.outerHTML;
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    function parseDoiList(value) {
        return (value || "")
            .trim()
            .split(/\r?\n/)
            .map(x => x.trim())
            .filter(Boolean);
    }

    // 提取函数：从文本中提取 DOI（按出现顺序）
    function extractFromText(text) {
        const dois = [];
        let remainingText = text || "";
        let match;

        const doiRegex = /\b(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*|urn:doi:\s*|urn:\s*doi:\s*)?(10\.\d{4,9}\/[^\s"'<>()\[\],;]+)/gi;
        while ((match = doiRegex.exec(remainingText)) !== null) {
            let doi = match[1] || match[0];
            doi = doi.replace(/[\.,;:\)\]\}]+$/g, "");
            try {
                doi = decodeURIComponent(doi);
            } catch (e) { /* ignore decode errors */ }
            doi = doi.trim().toLowerCase();
            if (doi) dois.push(doi);
        }

        return dois;
    }

    let downloadedDois = [];

    function formatCountdown(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const pad = (num) => num.toString().padStart(2, "0");
        return `${pad(minutes)}:${pad(seconds)}`;
    }

    async function runBatchCooldown(totalMs) {
        let remaining = totalMs;
        const tick = 1000;
        const update = () => {
            cooldownDiv.textContent = remaining > 0
                ? `Next batch starts in ${formatCountdown(remaining)}`
                : "";
        };
        update();
        while (remaining > 0) {
            await new Promise(res => setTimeout(res, tick));
            remaining -= tick;
            if (remaining < 0) remaining = 0;
            update();
        }
    }

    // ==============================
    //  读取本地 PDF 文件名并计算未下载 DOI
    // ==============================
    async function syncFromFolder() {
        try {
            let dirHandle = downloadDirHandle;
            if (!dirHandle) {
                dirHandle = await loadStoredProjectHandle();
                if (dirHandle) {
                    downloadDirHandle = dirHandle;
                    downloadDirName = dirHandle.name || '';
                    selectDownloadDirBtn.textContent = downloadDirName ? `Download Folder: ${downloadDirName}` : "Choose Download Folder";
                    window.enlightenkeyDirectoryHandle = dirHandle;
                }
            }
            if (dirHandle) {
                const granted = await ensureDirectoryPermission(dirHandle);
                if (!granted) {
                    dirHandle = null;
                }
            }
            if (!dirHandle) {
                try {
                    dirHandle = await chooseDownloadDirectory();
                } catch (error) {
                    if (error && (error.name === 'AbortError' || error.message === 'The user aborted a request.')) {
                        return;
                    }
                    log('Folder selection failed: ' + (error && error.message ? error.message : error));
                    return;
                }
            }
            const dois = [];
            for await (const entry of dirHandle.values()) {
                if (entry.kind !== "file") continue;
                if (!entry.name.toLowerCase().endsWith(".pdf")) continue;
                const nameWithoutExt = entry.name.replace(/\.pdf$/i, "");
                dois.push(nameWithoutExt.replace(/_/g, "/"));
            }
            downloadedDois = Array.from(new Set(dois));
            if (downloadedDois.length === 0) {
                log("No PDF files found in the selected folder");
                return;
            }
            const inputDois = parseDoiList(textarea.value);
            const downloadedSet = new Set(downloadedDois);
            const remaining = inputDois.filter(doi => !downloadedSet.has(doi));
            textarea.value = remaining.join("\n");
            log(`Loaded ${downloadedDois.length} downloaded DOIs, remaining ${remaining.length} in the list`);
        } catch (err) {
            if (err && (err.name === 'AbortError' || err.message === 'The user aborted a request.')) {
                return;
            }
            log("Folder not selected or could not be read");
            console.error(err);
        }
    }

    // ==============================
    //  从文本中提取 DOI 并按出现顺序列出
    // ==============================
    function extractDois() {
        const text = textarea.value || "";
        const dois = extractFromText(text);
        if (dois.length === 0) {
            log("No DOI found in the text");
            return;
        }
        textarea.value = dois.join("\n");
        log(`Extracted ${dois.length} DOIs and updated the list`);
    }

    // ==============================
    //  下载函数
    // ==============================
    async function getWritableDirectoryHandle() {
        let dirHandle = downloadDirHandle;
        if (!dirHandle) {
            dirHandle = await loadStoredProjectHandle();
            if (dirHandle) {
                downloadDirHandle = dirHandle;
                downloadDirName = dirHandle.name || '';
                selectDownloadDirBtn.textContent = downloadDirName ? `Download Folder: ${downloadDirName}` : "Choose Download Folder";
                window.enlightenkeyDirectoryHandle = dirHandle;
            }
        }
        if (dirHandle) {
            const granted = await ensureDirectoryPermission(dirHandle);
            if (granted) return dirHandle;
        }
        return null;
    }

    async function writeBlobToDirectory(dirHandle, fileName, blob) {
        try {
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        } catch (error) {
            console.warn("[DOI PDF Download] Failed to write file:", error);
            return false;
        }
    }

    async function download_pdf(doi, template) {
        const url = template.replace("{doi}", doi);
        const res = await fetch(url);
        const blob = await res.blob();

        const fileName = doi.replace("/", "_") + ".pdf";
        const dirHandle = await getWritableDirectoryHandle();
        if (dirHandle) {
            const saved = await writeBlobToDirectory(dirHandle, fileName, blob);
            if (saved) {
                return;
            }
        }

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    // ==============================
    //  批量下载方法
    // ==============================
    async function download_batch() {
        const template = templateInput.value.trim();
        const lines = parseDoiList(textarea.value);

        if (!lines.length) {
            log("DOI list is empty");
            return;
        }

        const perDownloadDelay = parseInt(timerInput.value, 10) || 1000; // 1s between downloads inside a batch
        const batchMinutes = parseInt(batchInput.value, 10) || 11;
        const batchCooldown = batchMinutes * 60 * 1000; // minutes between batches
        log(`Total ${lines.length} DOIs, start download...`);

        for (let i = 0; i < lines.length; i++) {
            const doi = lines[i];
            try {
                await download_pdf(doi, template);
                log(` ${doi}  (${i + 1}/${lines.length})`);
            } catch (err) {
                log(`Failed: ${doi}`);
            }
            const isLast = i === lines.length - 1;
            const completedBatch = (i + 1) % 50 === 0;
            if (isLast) {
                continue;
            }
            if (completedBatch) {
                log(`50 done. Next batch starts in ${batchMinutes} minutes...`);
                await runBatchCooldown(batchCooldown);
            } else {
                await new Promise(res => setTimeout(res, perDownloadDelay));
            }
        }
        log("All done!");
    }

    syncBtn.onclick = syncFromFolder;
    extractBtn.onclick = extractDois;
    btn.onclick = download_batch;

    selectDownloadDirBtn.onclick = async () => {
        try {
            await chooseDownloadDirectory();
            selectDownloadDirBtn.textContent = downloadDirName ? `Download Folder: ${downloadDirName}` : "Choose Download Folder";
        } catch (error) {
            if (error && (error.name === 'AbortError' || error.message === 'The user aborted a request.')) {
                return;
            }
            log('Folder selection failed: ' + (error && error.message ? error.message : error));
        }
    };

    loadStoredProjectHandle().then((handle) => {
        if (!handle) return;
        downloadDirHandle = handle;
        downloadDirName = handle.name || '';
        selectDownloadDirBtn.textContent = downloadDirName ? `Download Folder: ${downloadDirName}` : "Choose Download Folder";
        window.enlightenkeyDirectoryHandle = handle;
    });

    // 拖动和销毁
    let dragger = null;
    const ensurePanelInView = () => {
        const width = box.offsetWidth || 450;
        const height = box.offsetHeight || 360;
        const clamped = window.clampPanelPosition({
            top: box.style.top || savedTop,
            left: box.style.left || savedLeft || `${window.innerWidth - 470}px`,
            defaultTop: 120,
            defaultLeft: window.innerWidth - 470,
            width,
            height,
            margin: 8
        });
        box.style.top = `${Math.round(clamped.top)}px`;
        box.style.left = `${Math.round(clamped.left)}px`;
        box.style.right = "auto";
        writeStorage(POS_TOP_KEY, box.style.top);
        writeStorage(POS_LEFT_KEY, box.style.left);
    };

    if (typeof window.createFreeDragger === "function") {
        dragger = window.createFreeDragger(box, titleBar, {
            topKey: POS_TOP_KEY,
            leftKey: POS_LEFT_KEY
        });
        box.__dragger = dragger;
    }
    ensurePanelInView();

    // 清理函数
    const cleanup = () => {
        console.log("[DOI PDF Download] Cleaning up resources...");
        dragger?.destroy();
        document.removeEventListener("keydown", keydownHandler);
        document.removeEventListener("__DOI_PDF_DOWNLOAD_VISIBILITY__", visibilityHandler);
        box.remove();
        console.log("[DOI PDF Download] Resources cleaned up");
    };

    closeBtn.addEventListener("click", () => {
        cleanup();
    });

    // 快捷键切换显示/隐藏 (Ctrl+4)
    const keydownHandler = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "4") {
            e.preventDefault();
            const isVisible = box.style.display !== "none";
            box.style.display = isVisible ? "none" : "flex";
            console.log(`[DOI PDF Download] Toggle visibility: ${!isVisible}`);
        }
    };
    document.addEventListener("keydown", keydownHandler);

    // 监听来自 content script 的可见性控制事件
    const visibilityHandler = (e) => {
        console.log("[DOI PDF Download] Visibility event received:", e.detail);
        if (e.detail && typeof e.detail.visible === 'boolean') {
            const visible = e.detail.visible;
            const beforeDisplay = box.style.display;
            box.style.display = visible ? "flex" : "none";
            const afterDisplay = box.style.display;
            console.log(`[DOI PDF Download] Display changed: ${beforeDisplay} -> ${afterDisplay}, box exists: ${!!box}, box in DOM: ${document.contains(box)}`);
            if (visible) {
                ensurePanelInView();
            }
        }
    };
    document.addEventListener("__DOI_PDF_DOWNLOAD_VISIBILITY__", visibilityHandler);
    
    console.log("[DOI PDF Download] Panel initialized and event listeners attached");

    console.log("[DOI PDF Download] Panel initialized successfully");
})();
