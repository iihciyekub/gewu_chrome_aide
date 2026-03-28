/**
 * 加载 Font Awesome 图标库
 */
(function () {
    window.WOS_AIDE_FONT_FAMILY =
        'Arial, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif';
    function resolveExtensionUrl(relativePath) {
        const currentScript = document.currentScript;
        let baseSrc = currentScript?.src || '';
        if (!baseSrc) {
            const fallback = Array.from(document.scripts || []).find(
                (script) => script.src && script.src.includes('pub-fun.js')
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
    }

    function loadFontAwesome() {
        // 检查是否已加载（页面已有 Font Awesome 时不重复加载）
        if (
            document.getElementById('wosAide-fontawesome') ||
            document.querySelector('link[href*="fontawesome"]') ||
            window.FontAwesome ||
            window.__fortawesome__
        ) {
            console.log("Font Awesome already loaded");
            return;
        }
        // 加载 Font Awesome CSS
        const link = document.createElement('link');
        link.id = 'wosAide-fontawesome';
        link.rel = 'stylesheet';
        const localHref = resolveExtensionUrl('all.min.css');
        link.href = localHref || 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';

        link.onload = () => {
            console.log('%c Font Awesome loaded successfully', 'color: #339AF0; font-weight: bold');
        };

        link.onerror = () => {
            console.error('Failed to load Font Awesome');
        };

        document.head.appendChild(link);
    }

    // 等待 DOM 准备好
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadFontAwesome);
    } else {
        loadFontAwesome();
    }
})();

/**
 * ESC Key Toggle All Panels - REMOVED
 * This feature has been disabled as it interfered with popup control
 */
(function () {
    // ESC toggle feature has been removed
    // All panels are now controlled exclusively through the popup interface
})();




/**
 * window.createFreeDragger 
 * 通用的全屏拖动功能（支持水平和垂直移动）
 * @param {HTMLElement} container - 要拖动的容器元素
 * @param {HTMLElement} dragHandle - 拖动手柄元素（鼠标按住它来拖动）
 * @param {object} options - 配置选项
 * @returns {object} - 返回包含销毁方法的对象
 */
window.createFreeDragger = function (container, dragHandle, options = {}) {
    const {
        topKey = null,      // localStorage key for top position
        leftKey = null,     // localStorage key for left position
        onDragStart = null, // 拖动开始回调
        onDragEnd = null,   // 拖动结束回调
        onDrag = null       // 拖动中回调
    } = options;

    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    // 初始化位置
    if (topKey) {
        const savedTop = localStorage.getItem(topKey);
        if (savedTop) {
            container.style.top = savedTop;
            container.style.bottom = "auto";
        }
    }
    if (leftKey) {
        const savedLeft = localStorage.getItem(leftKey);
        if (savedLeft) {
            container.style.left = savedLeft;
            container.style.right = "auto";
        }
    }

    const onMouseDown = (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = container.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        const pos = getComputedStyle(container).position;
        if (pos === "static") {
            container.style.position = "fixed";
        }
        container.style.left = startLeft + "px";
        container.style.top = startTop + "px";
        container.style.right = "auto";
        container.style.bottom = "auto";
        e.preventDefault();

        if (onDragStart) onDragStart(e);
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const newLeft = Math.max(0, Math.min(window.innerWidth - container.offsetWidth, startLeft + deltaX));
        const newTop = Math.max(0, Math.min(window.innerHeight - container.offsetHeight, startTop + deltaY));
        container.style.left = newLeft + "px";
        container.style.top = newTop + "px";

        if (onDrag) onDrag(e, { left: newLeft, top: newTop });
    };

    const onMouseUp = (e) => {
        if (isDragging) {
            isDragging = false;

            // 保存位置
            if (topKey) localStorage.setItem(topKey, container.style.top);
            if (leftKey) localStorage.setItem(leftKey, container.style.left);

            if (onDragEnd) onDragEnd(e);
        }
    };

    dragHandle.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    // 返回销毁方法
    return {
        destroy: () => {
            dragHandle.removeEventListener("mousedown", onMouseDown);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        }
    };
};

/**
 * Clamp panel position to the viewport.
 * @param {object} options
 * @returns {{top: number, left: number}}
 */
window.clampPanelPosition = function (options = {}) {
    const {
        top = null,
        left = null,
        defaultTop = 120,
        defaultLeft = 120,
        width = 300,
        height = 240,
        margin = 8
    } = options;

    const parsePx = (value) => {
        if (value === null || value === undefined) return null;
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rawTop = parsePx(top);
    const rawLeft = parsePx(left);
    const clampedTop = Math.min(
        Math.max(rawTop ?? defaultTop, margin),
        Math.max(margin, viewportHeight - height - margin)
    );
    const clampedLeft = Math.min(
        Math.max(rawLeft ?? defaultLeft, margin),
        Math.max(margin, viewportWidth - width - margin)
    );

    return { top: clampedTop, left: clampedLeft };
};


/**
 * window.createVerticalDragger 
 * 通用的垂直拖动功能
 * @param {HTMLElement} container - 要拖动的容器元素
 * @param {string} localStorageKey - 保存位置的 localStorage 键名
 * @param {object} options - 配置选项
 * @returns {HTMLElement} - 返回创建的拖动控件按钮
 */
window.createVerticalDragger = function (container, localStorageKey, options = {}) {
    const {
        buttonText = `<i class="fa-solid fa-bars"></i>`,
        buttonColor = "rgba(80,120,200,0.6)",
        buttonColorActive = "rgba(80,120,200,0.9)",
        buttonSize = "18px",
        title = "Drag to move vertically"
    } = options;

    // 创建拖动控件按钮
    const dragHandle = document.createElement("button");
    dragHandle.innerHTML = buttonText;
    dragHandle.style.width = buttonSize;
    dragHandle.style.height = buttonSize;
    dragHandle.style.border = "none";
    dragHandle.style.borderRadius = "9px";
    dragHandle.style.cursor = "move";
    dragHandle.style.background = buttonColor;
    dragHandle.style.color = "#fff";
    dragHandle.style.fontWeight = "bold";
    dragHandle.style.fontSize = "14px";
    dragHandle.style.lineHeight = "1";
    dragHandle.style.padding = "0";
    dragHandle.style.outline = "none";
    dragHandle.title = title;

    // 拖动状态
    let isDragging = false;
    let startY = 0;
    let startTop = 0;

    // 鼠标按下事件
    dragHandle.addEventListener("mousedown", (e) => {
        isDragging = true;
        startY = e.clientY;
        startTop = parseInt(container.style.top) || 0;
        dragHandle.style.background = buttonColorActive;
        e.preventDefault();
    });

    // 鼠标移动事件
    const onMouseMove = (e) => {
        if (!isDragging) return;
        const deltaY = e.clientY - startY;
        const newTop = Math.max(0, Math.min(window.innerHeight - container.offsetHeight, startTop + deltaY));
        container.style.top = newTop + "px";
    };

    // 鼠标释放事件
    const onMouseUp = () => {
        if (isDragging) {
            isDragging = false;
            dragHandle.style.background = buttonColor;
            // 保存位置到 localStorage
            localStorage.setItem(localStorageKey, container.style.top);
        }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return dragHandle;
};



/**
 * 创建通用的折叠/展开按钮
 * @param {HTMLElement|HTMLElement[]} targetElements - 要隐藏/显示的目标元素（单个或数组）
 * @param {object} options - 配置选项
 * @returns {HTMLElement} - 返回创建的折叠按钮
 */
window.createToggleButton = function (targetElements, options = {}) {
    const {
        buttonSize = "18px",
        buttonColor = "rgba(100,100,100,0.6)",
        buttonColorActive = "rgba(100,100,100,0.9)",
        collapsedText = `<i class="fa-solid fa-angles-down fa-rotate-90"></i>`,
        expandedText = `<i class="fa-solid fa-angles-down fa-rotate-270"></i>`,
        collapsedTitle = "Show",
        expandedTitle = "Hide",
        localStorageKey = null,  // 如果提供，会保存折叠状态
        onCollapse = null,       // 折叠时的回调
        onExpand = null,         // 展开时的回调
        enableRightClick = false, // 是否启用右键删除功能
        removeConfirmText = "Remove this element?",
        onRemove = null          // 右键删除时的回调
    } = options;

    // 统一处理为数组
    const elements = Array.isArray(targetElements) ? targetElements : [targetElements];

    // 创建折叠按钮
    const toggleBtn = document.createElement("button");
    toggleBtn.innerHTML = expandedText;
    toggleBtn.style.width = buttonSize;
    toggleBtn.style.height = buttonSize;
    toggleBtn.style.border = "none";
    toggleBtn.style.borderRadius = "9px";
    toggleBtn.style.cursor = "pointer";
    toggleBtn.style.background = buttonColor;
    toggleBtn.style.color = "#fff";
    toggleBtn.style.fontWeight = "bold";
    toggleBtn.style.fontSize = "14px";
    toggleBtn.style.lineHeight = "1";
    toggleBtn.style.padding = "0";
    toggleBtn.style.outline = "none";
    toggleBtn.style.transition = "background 0.2s";

    // 从 localStorage 恢复状态
    let isCollapsed = false;
    if (localStorageKey) {
        const saved = localStorage.getItem(localStorageKey);
        isCollapsed = saved === "true";
    }

    // 更新按钮状态
    function updateButtonState() {
        if (isCollapsed) {
            toggleBtn.innerHTML = collapsedText;
            toggleBtn.title = collapsedTitle + (enableRightClick ? " | Right-click to remove" : "");
            elements.forEach(el => el.style.display = "none");
            if (onCollapse) onCollapse();
        } else {
            toggleBtn.innerHTML = expandedText;
            toggleBtn.title = expandedTitle + (enableRightClick ? " | Right-click to remove" : "");
            elements.forEach(el => el.style.display = "");
            if (onExpand) onExpand();
        }
    }

    // 初始化状态
    updateButtonState();

    // 点击切换
    toggleBtn.addEventListener("click", () => {
        isCollapsed = !isCollapsed;
        updateButtonState();

        // 保存状态
        if (localStorageKey) {
            localStorage.setItem(localStorageKey, isCollapsed.toString());
        }
    });

    // 右键删除功能
    if (enableRightClick) {
        toggleBtn.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            if (confirm(removeConfirmText)) {
                if (onRemove) {
                    onRemove();
                } else {
                    // 默认行为：删除所有目标元素
                    elements.forEach(el => el.remove());
                }
            }
        });
    }

    // 鼠标悬停效果
    toggleBtn.addEventListener("mouseenter", () => {
        toggleBtn.style.background = buttonColorActive;
    });
    toggleBtn.addEventListener("mouseleave", () => {
        toggleBtn.style.background = buttonColor;
    });

    return toggleBtn;
};
