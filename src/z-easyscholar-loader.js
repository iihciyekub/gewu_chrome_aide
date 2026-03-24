/**
 * z-easyscholar-loader.js
 * 注入 pub-fun.js 和 z-easyscholar.js 到页面上下文
 */

(function() {
  'use strict';

  // 首先加载 pub-fun.js（提供公共函数）
  const pubFunScript = document.createElement('script');
  pubFunScript.src = chrome.runtime.getURL('pub-fun.js');
  pubFunScript.onload = function() {
    console.log('pub-fun.js loaded into page context');
    
    // pub-fun.js 加载完成后，再加载 z-easyscholar.js
    const easyscholarScript = document.createElement('script');
    easyscholarScript.src = chrome.runtime.getURL('z-easyscholar.js');
    easyscholarScript.onload = function() {
      console.log('z-easyscholar.js loaded into page context');
      this.remove();
    };
    easyscholarScript.onerror = function() {
      console.error('Failed to load z-easyscholar.js');
    };
    (document.head || document.documentElement).appendChild(easyscholarScript);
    
    this.remove();
  };
  pubFunScript.onerror = function() {
    console.error('Failed to load pub-fun.js');
  };
  
  (document.head || document.documentElement).appendChild(pubFunScript);
})();
