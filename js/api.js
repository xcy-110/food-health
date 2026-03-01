/**
 * api.js - OpenAI 兼容 API 调用核心模块
 * 支持 SSE 流式响应
 */

// 系统提示词
const SYSTEM_PROMPT = `你是一位专业的食品营养师和健康顾问，名叫"食光机AI助手"。你的职责是帮助用户了解食物营养、制定健康饮食计划。

当用户上传食物图片时，请详细分析：
1. **食物识别**：识别图片中的食物种类和名称
2. **营养成分**：估算主要营养指标（热量、蛋白质、脂肪、碳水化合物、膳食纤维等）
3. **健康评估**：给出健康评分（1-10分）并说明理由
4. **适合人群**：指出该食物适合与不适合的人群
5. **饮食建议**：提供搭配建议和注意事项

当用户提出文字问题时：
- 提供专业、准确、实用的营养健康建议
- 回答要有条理，使用清晰的结构化格式
- 语气温暖友好，鼓励健康饮食习惯
- 如涉及医疗问题，提醒用户咨询专业医生

请始终使用中文回复。`;

// 当前活跃的 AbortController
let currentAbortController = null;

/**
 * 发送消息到 AI API（流式响应）
 * @param {Array} messages - 消息历史数组
 * @param {Object} callbacks - 回调函数 { onToken, onComplete, onError }
 */
async function sendMessage(messages, callbacks) {
  const config = getConfig();

  if (!config.apiKey) {
    callbacks.onError('请先配置 API Key。点击右上角设置按钮进行配置。');
    return;
  }

  // 创建 AbortController
  currentAbortController = new AbortController();

  // 构建请求体
  const requestBody = {
    model: config.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ],
    stream: true
  };

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.apiKey
      },
      body: JSON.stringify(requestBody),
      signal: currentAbortController.signal
    });

    if (!response.ok) {
      let errorMsg = 'API 请求失败: ' + response.status;
      if (response.status === 401) {
        errorMsg = 'API Key 无效，请检查配置';
      } else if (response.status === 429) {
        errorMsg = '请求频率超限，请稍后再试';
      } else if (response.status === 400) {
        errorMsg = '请求参数错误，请检查模型名称是否正确';
      }
      try {
        const errData = await response.json();
        if (errData.error && errData.error.message) {
          errorMsg = errData.error.message;
        }
      } catch (e) { /* ignore parse error */ }
      callbacks.onError(errorMsg);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按行分割 SSE 数据
      const lines = buffer.split('\n');
      // 保留最后一个可能不完整的行
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices && data.choices[0] && data.choices[0].delta;
            if (delta && delta.content) {
              fullText += delta.content;
              callbacks.onToken(delta.content);
            }
          } catch (e) {
            // 忽略解析错误（可能是不完整的 JSON）
          }
        }
      }
    }

    callbacks.onComplete(fullText);

  } catch (error) {
    if (error.name === 'AbortError') {
      callbacks.onComplete(callbacks._currentText || '');
      return;
    }
    callbacks.onError('网络错误: ' + error.message);
  } finally {
    currentAbortController = null;
  }
}

/**
 * 停止当前流式响应
 */
function stopGeneration() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

/**
 * 测试 API 连接
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  const config = getConfig();

  if (!config.apiKey) {
    throw new Error('请先填写 API Key');
  }

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.apiKey
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: '你好' }],
      max_tokens: 10
    })
  });

  if (!response.ok) {
    let msg = '连接失败: HTTP ' + response.status;
    if (response.status === 401) msg = 'API Key 无效';
    else if (response.status === 404) msg = 'API 地址或模型名称不正确';
    throw new Error(msg);
  }

  return true;
}

/**
 * 构建带图片的消息内容
 * @param {string} text - 文字内容
 * @param {string|null} imageBase64 - 图片 base64（含 data:image/... 前缀）
 * @returns {string|Array} content 字段值
 */
function buildMessageContent(text, imageBase64) {
  if (!imageBase64) {
    return text || '请分析这张图片';
  }

  var content = [];
  if (text) {
    content.push({ type: 'text', text: text });
  } else {
    content.push({ type: 'text', text: '请分析这张食物图片，包括食物种类、营养成分和健康建议。' });
  }
  content.push({
    type: 'image_url',
    image_url: { url: imageBase64 }
  });

  return content;
}
