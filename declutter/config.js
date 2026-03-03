/**
 * ============================================
 *   断舍离建议网站 — 站长配置文件
 * ============================================
 *
 * 部署前请修改以下配置项，填入你的 AI API 信息。
 * 配置完成后，用户即可直接使用，无需额外设置。
 *
 * 【如何获取 API Key】
 *   - OpenAI:    https://platform.openai.com/api-keys
 *   - DeepSeek:  https://platform.deepseek.com/api_keys
 *   - 其他兼容 OpenAI 格式的服务商均可使用
 *
 * 【常见 API Endpoint 格式】
 *   - OpenAI:    https://api.openai.com/v1/chat/completions
 *   - DeepSeek:  https://api.deepseek.com/v1/chat/completions
 *
 * 【支持视觉识别的模型】
 *   - OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo
 *   - 其他支持 vision 的模型
 *   - 若使用不支持视觉的模型，请将 visionEnabled 设为 false
 *
 * 【注意事项】
 *   - 请勿将此文件提交到公开的 Git 仓库，以免泄露 API Key
 *   - 建议将 config.js 加入 .gitignore
 */

window.DECLUTTER_CONFIG = {
  // API 端点地址（必填）
  apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',

  // API 密钥（必填）
  apiKey: '57d90160-0e2a-4ca3-b431-c16137e8bd4b',

  // 模型名称（必填）
  model: 'doubao-seed-2-0-mini-260215',

  // 是否启用拍照识别功能（需要模型支持视觉能力）
  visionEnabled: true,

  // 界面语言（预留，默认中文）
  language: 'zh-CN'
};
