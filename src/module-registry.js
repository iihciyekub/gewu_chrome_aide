/**
 * Module Registry - 统一管理所有可开启/关闭的功能模块
 * 
 * 每个模块配置包含：
 * - id: 唯一标识符
 * - name: 显示名称
 * - files: 需要注入的 JS 文件列表（按顺序加载）
 * - elementId: 模块在页面上的主 DOM 元素 ID
 * - visibilityKey: localStorage 中保存可见性状态的 key
 * - enabledKey: chrome.storage.local 中保存启用状态的 key
 * - eventPrefix: 自定义事件前缀
 */

export const MODULE_REGISTRY = {
  easyscholar: {
    id: 'easyscholar',
    name: 'EasyScholar',
    files: ['pub-fun.js', 'z-easyscholar.js'],
    elementId: 'wos_easyscholar_panel',
    visibilityKey: 'wos-easyscholar-panel-visible',
    enabledKey: 'easyscholarEnabled',
    eventPrefix: 'EASYSCHOLAR',
    description: 'Journal ranking query panel for WOS'
  },
  
  wosDoiQuery: {
    id: 'wosDoiQuery',
    name: 'DOI Batch Query',
    files: ['pub-fun.js', 'z-wos-doi-query.js'],
    elementId: 'clipboard-reader-box',
    visibilityKey: 'clipboard-reader-box-visible',
    enabledKey: 'wosDoiQueryEnabled',
    eventPrefix: 'WOS_DOI_QUERY',
    description: 'Batch DOI/WOSID query tool'
  },

  doiPdfDownload: {
    id: 'doiPdfDownload',
    name: 'DOI PDF Download',
    files: ['pub-fun.js', 'z-doi-pdf-download.js'],
    elementId: 'ref-paper-downloader',
    visibilityKey: 'pdf_download_panel_visible',
    enabledKey: 'doiPdfDownloadEnabled',
    eventPrefix: 'DOI_PDF_DOWNLOAD',
    description: 'Batch PDF download tool by DOI'
  },

  openaiChat: {
    id: 'openaiChat',
    name: 'OpenAI Chat',
    files: ['pub-fun.js', 'z-chat.js'],
    elementId: 'wos_openai_panel',
    visibilityKey: 'wos-openai-panel-visible',
    enabledKey: 'openaiChatEnabled',
    eventPrefix: 'OPENAI_CHAT',
    description: 'OpenAI chat panel for WOS queries'
  }
  
  // 添加新模块示例：
  // newModule: {
  //   id: 'newModule',
  //   name: 'New Module',
  //   files: ['pub-fun.js', 'z-new-module.js'],
  //   elementId: 'new-module-panel',
  //   visibilityKey: 'new-module-visible',
  //   enabledKey: 'newModuleEnabled',
  //   eventPrefix: 'NEW_MODULE',
  //   description: 'Description of the new module'
  // }
};

/**
 * 获取所有模块列表
 */
export function getAllModules() {
  return Object.values(MODULE_REGISTRY);
}

/**
 * 根据 ID 获取模块配置
 */
export function getModuleById(id) {
  return MODULE_REGISTRY[id] || null;
}

/**
 * 根据 enabledKey 获取模块配置
 */
export function getModuleByEnabledKey(key) {
  return Object.values(MODULE_REGISTRY).find(m => m.enabledKey === key) || null;
}

/**
 * 根据 elementId 获取模块配置
 */
export function getModuleByElementId(elementId) {
  return Object.values(MODULE_REGISTRY).find(m => m.elementId === elementId) || null;
}
