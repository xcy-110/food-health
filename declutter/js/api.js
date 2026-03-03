/**
 * api.js — AI API 调用模块（文本 + 视觉识别）
 */
var APIModule = (function () {
  var REQUEST_TIMEOUT = 30000; // 30s

  function getConfig() {
    return window.DECLUTTER_CONFIG || {};
  }

  function isConfigured() {
    var cfg = getConfig();
    return !!(cfg.apiEndpoint && cfg.apiKey);
  }

  /**
   * 发送 chat completion 请求
   */
  function sendRequest(messages) {
    var cfg = getConfig();

    if (!isConfigured()) {
      return Promise.reject(new Error('未配置 AI API，请在 config.js 中填写 apiEndpoint 和 apiKey'));
    }

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT);

    return fetch(cfg.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.model || 'gpt-4o',
        messages: messages,
        temperature: 0.7,
        stream: false
      })
    }).then(function (res) {
      clearTimeout(timeoutId);

      if (res.status === 401 || res.status === 403) {
        throw new Error('API Key 无效，请检查 config.js 中的配置');
      }
      if (res.status === 429) {
        throw new Error('请求过于频繁，请稍后再试');
      }
      if (!res.ok) {
        throw new Error('API 请求失败 (' + res.status + ')');
      }
      return res.json();
    }).then(function (data) {
      if (data.choices && data.choices[0] && data.choices[0].message) {
        var content = data.choices[0].message.content;
        // Clean up thinking tags from models like Doubao
        content = content.replace(/<\/think[^>]*>/g, '').replace(/<think[^>]*>/g, '');
        return content.trim();
      }
      throw new Error('API 返回格式异常');
    }).catch(function (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('请求超时，请检查网络后重试');
      }
      throw err;
    });
  }

  /**
   * 视觉识别物品名称
   */
  function identifyItem(imageBase64) {
    var messages = [
      {
        role: 'system',
        content: '你是一个物品识别助手。用户会发给你一张图片，你需要识别图中最主要的物品，用简短的中文名称回复，不超过10个字，只回复物品名称本身，不要有任何其他解释。'
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/jpeg;base64,' + imageBase64,
              detail: 'low'
            }
          },
          {
            type: 'text',
            text: '这是什么物品？'
          }
        ]
      }
    ];

    return sendRequest(messages).then(function (content) {
      return content.trim().replace(/["""]/g, '');
    });
  }

  /**
   * 获取断舍离评分和建议
   */
  function getAdvice(itemName, answers, imageBase64) {
    var systemPrompt = '你是一位擅长断舍离理念的整理咨询师，基于近藤麻理惠（KonMari）和山下英子（断舍离）的理念提供建议。\n\n' +
      '用户会告诉你一件他们犹豫是否丢弃的物品，以及他们对三个关键问题的回答。\n\n' +
      '请根据以下信息，返回一个 JSON 对象（不要有任何 markdown 代码块包裹，直接返回纯 JSON），格式如下：\n' +
      '{\n' +
      '  "score": <0到100之间的整数，越高越应该舍去>,\n' +
      '  "verdict": <"discard"|"keep"|"consider"|"user">,\n' +
      '  "title": <10字以内的一句话结论>,\n' +
      '  "advice": <2-3句话的具体建议，温和而有洞察力>,\n' +
      '  "scenarios": <仅当verdict为consider时，列出2-3个该物品可能用到的具体使用场景，数组格式；其他情况为null>\n' +
      '}\n\n' +
      '评分参考标准：\n' +
      '- 三个问题都回答"是"（用过/需要/会用）：15分以下\n' +
      '- 三个问题都回答"否"：85分以上\n' +
      '- 根据实际组合情况合理判断中间分数\n' +
      '- 同时结合物品本身的特性（情感价值、实用性、可替代性）综合评估\n\n' +
      'verdict 映射规则（需与score匹配）：\n' +
      '- score > 80 → "discard"\n' +
      '- score < 20 → "keep"\n' +
      '- score 40-60 → "consider"\n' +
      '- score 20-40 或 60-80 → "user"\n\n' +
      '建议语气：温暖、不评判、尊重用户的情感连接，但保持务实。只返回 JSON，不要有其他内容。';

    var userText = '物品：' + itemName + '\n\n' +
      '问题回答：\n' +
      '- 过去一年内有使用过吗？' + (answers[0] ? '是' : '否') + '\n' +
      '- 现在有实际需要吗？' + (answers[1] ? '是' : '否') + '\n' +
      '- 未来三个月有使用计划吗？' + (answers[2] ? '是' : '否') + '\n\n' +
      '请给出断舍离建议。';

    var userContent;

    // If we have an image and vision is enabled, include it
    var cfg = getConfig();
    if (imageBase64 && cfg.visionEnabled !== false) {
      userContent = [
        {
          type: 'image_url',
          image_url: {
            url: 'data:image/jpeg;base64,' + imageBase64,
            detail: 'low'
          }
        },
        { type: 'text', text: userText }
      ];
    } else {
      userContent = userText;
    }

    var messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];

    return sendRequest(messages).then(function (content) {
      return parseAdviceJSON(content);
    });
  }

  /**
   * JSON 解析（四层容错）
   */
  function parseAdviceJSON(raw) {
    var parsed = null;

    // Layer 1: Direct parse
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Layer 2: Extract from ```json code block
      var codeBlockMatch = raw.match(/```json?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        try {
          parsed = JSON.parse(codeBlockMatch[1].trim());
        } catch (e2) { /* continue */ }
      }

      // Layer 3: Extract first {} object
      if (!parsed) {
        var objMatch = raw.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try {
            parsed = JSON.parse(objMatch[0]);
          } catch (e3) { /* continue */ }
        }
      }
    }

    if (parsed && typeof parsed.score === 'number') {
      // Ensure verdict matches score
      parsed.verdict = getVerdictByScore(parsed.score);
      return parsed;
    }

    // Layer 4: failed, return null (caller should use fallback)
    return null;
  }

  function getVerdictByScore(score) {
    if (score > 80) return 'discard';
    if (score < 20) return 'keep';
    if (score >= 40 && score <= 60) return 'consider';
    return 'user';
  }

  /**
   * 兜底规则引擎（无 AI 时使用）
   */
  function fallbackAdvice(itemName, answers) {
    var yesCount = answers.filter(function (a) { return a === true; }).length;
    var score, title, advice;

    if (yesCount === 3) {
      score = 10;
      title = '建议保留';
      advice = '你最近在用，现在也需要，未来还会用——这件物品对你来说很有价值，好好珍惜它吧。';
    } else if (yesCount === 0) {
      score = 95;
      title = '建议舍去';
      advice = '过去一年没用过，现在不需要，未来也没计划用，也许是时候和它说再见了。放手之后，你会拥有更轻松的空间。';
    } else if (yesCount === 1) {
      score = 70;
      title = '倾向舍去';
      advice = '这件物品的使用率不高，可以考虑放手。如果担心以后需要，想想是否有替代品或能轻松重新获得。';
    } else {
      // yesCount === 2
      score = 30;
      title = '倾向保留';
      advice = '这件物品还有一定的使用价值，建议暂时保留，但可以定期审视是否还需要它。';
    }

    return {
      score: score,
      verdict: getVerdictByScore(score),
      title: title,
      advice: advice + '\n（仅基于规则判断，配置 AI 可获取更精准的个性化建议）',
      scenarios: null
    };
  }

  return {
    isConfigured: isConfigured,
    identifyItem: identifyItem,
    getAdvice: getAdvice,
    fallbackAdvice: fallbackAdvice,
    getVerdictByScore: getVerdictByScore
  };
})();
