/**
 * storage.js - localStorage 读写封装
 */

const STORAGE_KEYS = {
  CONFIG: 'foodhealth_config',
  CHAT_HISTORY: 'foodhealth_chat_history'
};

const DEFAULT_CONFIG = {
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4o'
};

/**
 * 获取 API 配置
 */
function getConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (raw) {
      const config = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (e) {
    console.warn('读取配置失败:', e);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * 保存 API 配置
 */
function saveConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('保存配置失败:', e);
    return false;
  }
}

/**
 * 获取聊天历史
 */
function getChatHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('读取聊天历史失败:', e);
  }
  return [];
}

/**
 * 保存聊天历史
 */
function saveChatHistory(messages) {
  try {
    localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(messages));
    return true;
  } catch (e) {
    console.error('保存聊天历史失败:', e);
    return false;
  }
}

/**
 * 清空聊天历史
 */
function clearChatHistory() {
  localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
}

/**
 * 检查 API 配置是否完整
 */
function isConfigValid() {
  const config = getConfig();
  return config.apiUrl && config.apiKey && config.model;
}
