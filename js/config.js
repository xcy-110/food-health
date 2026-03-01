/**
 * config.js - 配置弹窗逻辑
 */

(function() {
  // 预设配置
  var PRESETS = {
    openai: {
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o'
    },
    deepseek: {
      apiUrl: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat'
    }
  };

  // DOM 引用
  var modal, openBtn, closeBtn, presetSelect, apiUrlInput, modelInput, apiKeyInput;
  var toggleKeyBtn, testBtn, saveBtn, toast;

  function initConfig() {
    modal = document.getElementById('configModal');
    openBtn = document.getElementById('openSettingsBtn');
    closeBtn = document.getElementById('closeModalBtn');
    presetSelect = document.getElementById('presetSelect');
    apiUrlInput = document.getElementById('apiUrlInput');
    modelInput = document.getElementById('modelInput');
    apiKeyInput = document.getElementById('apiKeyInput');
    toggleKeyBtn = document.getElementById('toggleKeyBtn');
    testBtn = document.getElementById('testConnBtn');
    saveBtn = document.getElementById('saveConfigBtn');
    toast = document.getElementById('toast');

    if (!modal || !openBtn) return;

    // 打开弹窗
    openBtn.addEventListener('click', openModal);

    // 关闭弹窗
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeModal();
    });

    // ESC 关闭
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });

    // 预设切换
    presetSelect.addEventListener('change', function() {
      var preset = PRESETS[this.value];
      if (preset) {
        apiUrlInput.value = preset.apiUrl;
        modelInput.value = preset.model;
      }
    });

    // 密码显示切换
    toggleKeyBtn.addEventListener('click', function() {
      var isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      this.innerHTML = isPassword
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    });

    // 测试连接
    testBtn.addEventListener('click', handleTestConnection);

    // 保存配置
    saveBtn.addEventListener('click', handleSaveConfig);
  }

  function openModal() {
    var config = getConfig();
    apiUrlInput.value = config.apiUrl;
    modelInput.value = config.model;
    apiKeyInput.value = config.apiKey;
    presetSelect.value = '';

    // 检查是否匹配预设
    for (var key in PRESETS) {
      if (PRESETS[key].apiUrl === config.apiUrl) {
        presetSelect.value = key;
        break;
      }
    }

    modal.classList.add('active');
  }

  function closeModal() {
    modal.classList.remove('active');
  }

  function handleSaveConfig() {
    var config = {
      apiUrl: apiUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim()
    };

    if (!config.apiUrl) {
      showToast('请填写 API 地址', 'error');
      return;
    }
    if (!config.model) {
      showToast('请填写模型名称', 'error');
      return;
    }

    saveConfig(config);
    showToast('配置已保存', 'success');
    closeModal();
  }

  async function handleTestConnection() {
    // 临时保存当前输入以供测试
    var tempConfig = {
      apiUrl: apiUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim()
    };

    if (!tempConfig.apiKey) {
      showToast('请先填写 API Key', 'error');
      return;
    }

    // 临时保存
    saveConfig(tempConfig);

    testBtn.textContent = '测试中...';
    testBtn.disabled = true;

    try {
      await testConnection();
      showToast('连接成功', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      testBtn.textContent = '测试连接';
      testBtn.disabled = false;
    }
  }

  // Toast 通知
  var toastTimer = null;
  function showToast(message, type) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    toastTimer = setTimeout(function() {
      toast.classList.remove('show');
    }, 3000);
  }

  // 全局暴露 showToast
  window.showToast = showToast;

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConfig);
  } else {
    initConfig();
  }
})();
