'use strict';

// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

// 存储已选择的目录句柄
let directoryHandle = null;
let fileCache = new Map();

/**
 * 递归读取目录中的所有文件
 * @param {FileSystemDirectoryHandle} dirHandle - 目录句柄
 * @param {string} basePath - 基础路径
 * @returns {Promise<Array>} 文件列表
 */
async function readAllFiles(dirHandle, basePath = '') {
  const files = [];
  
  try {
    for await (const entry of dirHandle.values()) {
      const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      
      if (entry.kind === 'file') {
        files.push({
          name: entry.name,
          path: fullPath,
          handle: entry
        });
      } else if (entry.kind === 'directory') {
        // 递归读取子目录
        const subFiles = await readAllFiles(entry, fullPath);
        files.push(...subFiles);
      }
    }
  } catch (error) {
    console.error('读取目录出错:', error);
  }
  
  return files;
}

/**
 * 读取文件内容
 * @param {FileSystemFileHandle} fileHandle - 文件句柄
 * @returns {Promise<string>} 文件内容
 */
async function readFileContent(fileHandle) {
  try {
    const file = await fileHandle.getFile();
    const content = await file.text();
    return content;
  } catch (error) {
    console.error('读取文件内容出错:', error);
    throw error;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ENSURE_FONT_AWESOME') {
    (async () => {
      try {
        if (sender.tab && sender.tab.id) {
          await chrome.scripting.insertCSS({
            target: { tabId: sender.tab.id, allFrames: true },
            files: ['all.min.css'],
          });
          await chrome.scripting.executeScript({
            target: { tabId: sender.tab.id, allFrames: true },
            files: ['all.min.js'],
          });
        }
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
    // 获取当前已选目录名
    if (request.type === 'GET_DIRECTORY_NAME') {
      sendResponse({
        name: directoryHandle && directoryHandle.name ? directoryHandle.name : ''
      });
      return true;
    }
  if (request.type === 'GREETINGS') {
    const message = `Hi ${
      sender.tab ? 'Con' : 'Pop'
    }, my name is Bac. I am from Background. It's great to hear from you.`;

    // Log message coming from the `request` parameter
    // Send a response message
    sendResponse({
      message,
    });
  }
  
  // 选择目录
  if (request.type === 'SELECT_DIRECTORY') {
    (async () => {
      try {
        // 注意：这个API需要用户手势触发，所以需要从popup或content script调用
        directoryHandle = await globalThis.showDirectoryPicker();
        const files = await readAllFiles(directoryHandle);
        
        // 缓存文件信息
        fileCache.clear();
        for (const file of files) {
          fileCache.set(file.path, file.handle);
        }
        
        sendResponse({
          success: true,
          files: files.map(f => ({ name: f.name, path: f.path }))
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    return true; // 保持消息通道开启
  }
  
  // 读取文件内容
  if (request.type === 'READ_FILE') {
    (async () => {
      try {
        const fileHandle = fileCache.get(request.filePath);
        if (!fileHandle) {
          sendResponse({
            success: false,
            error: '文件未找到，请先选择目录'
          });
          return;
        }
        
        const content = await readFileContent(fileHandle);
        sendResponse({
          success: true,
          content: content
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    return true; // 保持消息通道开启
  }
  
  // 获取所有文件列表
  if (request.type === 'GET_FILES') {
    const files = Array.from(fileCache.keys());
    sendResponse({
      success: true,
      files: files
    });
    return true;
  }
});
