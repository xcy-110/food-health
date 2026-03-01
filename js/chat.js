/**
 * chat.js - 聊天页面主逻辑
 */

(function() {
  // 聊天状态
  var chatState = {
    messages: [],          // 发送给API的消息历史
    pendingImage: null,    // { base64, fileName }
    isStreaming: false,
    currentAIBubble: null,
    currentAIText: ''
  };

  // DOM 引用
  var messagesArea, chatInput, sendBtn, uploadBtn, imageInput;
  var imagePreviewBar, previewThumbnail, previewImg, previewRemove, previewFilename;
  var welcomeScreen, lightbox, lightboxImg;

  function initChat() {
    messagesArea = document.getElementById('messagesArea');
    chatInput = document.getElementById('chatInput');
    sendBtn = document.getElementById('sendBtn');
    uploadBtn = document.getElementById('uploadBtn');
    imageInput = document.getElementById('imageInput');
    imagePreviewBar = document.getElementById('imagePreviewBar');
    previewThumbnail = document.getElementById('previewThumbnail');
    previewImg = document.getElementById('previewImg');
    previewRemove = document.getElementById('previewRemove');
    previewFilename = document.getElementById('previewFilename');
    welcomeScreen = document.getElementById('welcomeScreen');
    lightbox = document.getElementById('lightbox');
    lightboxImg = document.getElementById('lightboxImg');

    // 发送按钮
    sendBtn.addEventListener('click', handleSend);

    // 输入框回车发送
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // 输入框自适应高度 + 按钮状态
    chatInput.addEventListener('input', function() {
      autoResizeInput();
      updateSendBtnState();
    });

    // 上传按钮
    uploadBtn.addEventListener('click', function() {
      imageInput.click();
    });

    // 图片选择
    imageInput.addEventListener('change', handleImageSelect);

    // 移除预览图
    previewRemove.addEventListener('click', clearPendingImage);

    // 关闭大图
    lightbox.addEventListener('click', function() {
      lightbox.classList.remove('active');
    });

    // 快捷建议点击
    document.querySelectorAll('.suggestion-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        chatInput.value = this.textContent;
        updateSendBtnState();
        chatInput.focus();
      });
    });

    // 清空对话按钮
    var clearBtn = document.getElementById('clearChatBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', handleClearChat);
    }

    // 恢复历史
    loadHistory();
  }

  // 自适应输入框高度
  function autoResizeInput() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  }

  // 更新发送按钮状态
  function updateSendBtnState() {
    var hasContent = chatInput.value.trim() || chatState.pendingImage;
    if (chatState.isStreaming) {
      sendBtn.classList.add('stop');
      sendBtn.classList.remove('active');
      sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
    } else if (hasContent) {
      sendBtn.classList.add('active');
      sendBtn.classList.remove('stop');
      sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    } else {
      sendBtn.classList.remove('active', 'stop');
      sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    }
  }

  // 处理图片选择
  function handleImageSelect(e) {
    var file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error');
      return;
    }

    // 压缩并转 base64
    compressImage(file, function(base64) {
      chatState.pendingImage = {
        base64: base64,
        fileName: file.name
      };

      // 显示预览
      previewImg.src = base64;
      previewFilename.textContent = file.name;
      imagePreviewBar.classList.add('active');
      updateSendBtnState();
    });

    // 清空 input 以允许重复选择同一文件
    imageInput.value = '';
  }

  // 图片压缩
  function compressImage(file, callback) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var maxSize = 1024;
        var width = img.width;
        var height = img.height;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round(height * maxSize / width);
            width = maxSize;
          } else {
            width = Math.round(width * maxSize / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        var base64 = canvas.toDataURL('image/jpeg', 0.85);
        callback(base64);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // 清除待发送图片
  function clearPendingImage() {
    chatState.pendingImage = null;
    imagePreviewBar.classList.remove('active');
    previewImg.src = '';
    previewFilename.textContent = '';
    updateSendBtnState();
  }

  // 发送消息
  function handleSend() {
    // 如果正在流式输出，点击变为停止
    if (chatState.isStreaming) {
      stopGeneration();
      chatState.isStreaming = false;
      finishAIMessage();
      return;
    }

    var text = chatInput.value.trim();
    var image = chatState.pendingImage;

    if (!text && !image) return;

    // 隐藏欢迎页
    if (welcomeScreen) {
      welcomeScreen.style.display = 'none';
    }

    // 构建用户消息内容
    var content = buildMessageContent(text, image ? image.base64 : null);

    // 添加到消息历史
    chatState.messages.push({ role: 'user', content: content });

    // 渲染用户气泡
    renderUserMessage(text, image);

    // 清空输入
    chatInput.value = '';
    chatInput.style.height = 'auto';
    clearPendingImage();

    // 开始AI响应
    startAIResponse();
  }

  // 渲染用户消息气泡
  function renderUserMessage(text, image) {
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message user';

    var html = '<div class="message-avatar">我</div><div class="message-bubble">';
    if (image) {
      html += '<img class="message-image" src="' + image.base64 + '" alt="上传图片" onclick="openLightbox(this.src)">';
    }
    if (text) {
      html += '<p>' + escapeHtml(text) + '</p>';
    }
    html += '</div>';

    messageDiv.innerHTML = html;
    messagesArea.appendChild(messageDiv);
    scrollToBottom();
  }

  // 开始 AI 响应
  function startAIResponse() {
    chatState.isStreaming = true;
    chatState.currentAIText = '';
    updateSendBtnState();

    // 创建 AI 消息气泡
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.innerHTML =
      '<div class="message-avatar">🥦</div>' +
      '<div class="message-bubble">' +
        '<div class="loading-dots"><span></span><span></span><span></span></div>' +
      '</div>';

    messagesArea.appendChild(messageDiv);
    chatState.currentAIBubble = messageDiv.querySelector('.message-bubble');
    scrollToBottom();

    // 调用 API
    sendMessage(chatState.messages, {
      _currentText: '',
      onToken: function(token) {
        chatState.currentAIText += token;
        this._currentText = chatState.currentAIText;
        // 流式显示纯文本（不渲染 markdown）
        chatState.currentAIBubble.textContent = chatState.currentAIText;
        chatState.currentAIBubble.classList.add('streaming-cursor');
        scrollToBottom();
      },
      onComplete: function(fullText) {
        chatState.isStreaming = false;
        chatState.currentAIText = fullText;
        finishAIMessage();
      },
      onError: function(errMsg) {
        chatState.isStreaming = false;
        chatState.currentAIBubble.innerHTML = '<div class="message-error">' + escapeHtml(errMsg) + '</div>';
        chatState.currentAIBubble.classList.remove('streaming-cursor');
        // 移除失败的消息
        chatState.messages.pop();
        updateSendBtnState();
      }
    });
  }

  // 完成 AI 消息
  function finishAIMessage() {
    if (chatState.currentAIBubble && chatState.currentAIText) {
      // 渲染 Markdown
      chatState.currentAIBubble.innerHTML = renderMarkdown(chatState.currentAIText);
      chatState.currentAIBubble.classList.remove('streaming-cursor');

      // 保存到消息历史
      chatState.messages.push({ role: 'assistant', content: chatState.currentAIText });

      // 持久化
      saveHistory();
    }
    chatState.currentAIBubble = null;
    chatState.currentAIText = '';
    updateSendBtnState();
    scrollToBottom();
  }

  // 清空对话
  function handleClearChat() {
    chatState.messages = [];
    chatState.pendingImage = null;
    chatState.isStreaming = false;
    chatState.currentAIBubble = null;
    chatState.currentAIText = '';

    messagesArea.innerHTML = '';
    if (welcomeScreen) {
      messagesArea.appendChild(welcomeScreen);
      welcomeScreen.style.display = '';
    }

    clearChatHistory();
    clearPendingImage();
    updateSendBtnState();
    showToast('对话已清空', 'success');
  }

  // 保存对话历史（只保存纯文本，不存base64图片）
  function saveHistory() {
    var cleanMessages = chatState.messages.map(function(msg) {
      if (Array.isArray(msg.content)) {
        // 移除图片数据只保留文字
        var texts = msg.content.filter(function(c) { return c.type === 'text'; });
        return {
          role: msg.role,
          content: texts.length > 0 ? texts[0].text : '[图片消息]',
          hadImage: true
        };
      }
      return msg;
    });
    saveChatHistory(cleanMessages);
  }

  // 加载对话历史
  function loadHistory() {
    var history = getChatHistory();
    if (history && history.length > 0) {
      chatState.messages = history;
      if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
      }
      // 渲染历史消息
      history.forEach(function(msg) {
        if (msg.role === 'user') {
          var text = Array.isArray(msg.content)
            ? msg.content.filter(function(c) { return c.type === 'text'; })[0]?.text || ''
            : msg.content;
          renderHistoryUserMessage(text, msg.hadImage);
        } else if (msg.role === 'assistant') {
          renderHistoryAIMessage(msg.content);
        }
      });
      scrollToBottom();
    }
  }

  function renderHistoryUserMessage(text, hadImage) {
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    var html = '<div class="message-avatar">我</div><div class="message-bubble">';
    if (hadImage) {
      html += '<p style="font-size:12px;opacity:0.7;">[图片]</p>';
    }
    if (text) {
      html += '<p>' + escapeHtml(text) + '</p>';
    }
    html += '</div>';
    messageDiv.innerHTML = html;
    messagesArea.appendChild(messageDiv);
  }

  function renderHistoryAIMessage(text) {
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.innerHTML =
      '<div class="message-avatar">🥦</div>' +
      '<div class="message-bubble">' + renderMarkdown(text) + '</div>';
    messagesArea.appendChild(messageDiv);
  }

  // 滚动到底部
  function scrollToBottom() {
    requestAnimationFrame(function() {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    });
  }

  // HTML 转义
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 大图查看
  window.openLightbox = function(src) {
    lightboxImg.src = src;
    lightbox.classList.add('active');
  };

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
  } else {
    initChat();
  }
})();
