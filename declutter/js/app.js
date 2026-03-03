/**
 * app.js — 主逻辑与 UI 状态机
 */
(function () {
  'use strict';

  // --- Questions ---
  var QUESTIONS = [
    '一年内用过吗？',
    '现在需要吗？',
    '未来三个月会用吗？'
  ];

  var VERDICT_MAP = {
    discard: { emoji: '\uD83D\uDDD1\uFE0F', color: '#E05A4E' },
    keep:    { emoji: '\uD83D\uDC9A', color: '#52A77A' },
    consider:{ emoji: '\uD83E\uDD14', color: '#E8993A' },
    user:    { emoji: '\u2696\uFE0F', color: '#8C867F' }
  };

  // --- App State ---
  var state = {
    currentScreen: 'landing',
    itemName: '',
    capturedImageBase64: null,
    previewURL: null,
    answers: [null, null, null],
    currentQuestionIndex: 0,
    result: null
  };

  // --- DOM Refs ---
  var dom = {};

  function cacheDom() {
    dom.screenLanding = document.getElementById('screen-landing');
    dom.screenIdentifying = document.getElementById('screen-identifying');
    dom.screenQuestions = document.getElementById('screen-questions');
    dom.screenLoading = document.getElementById('screen-loading');
    dom.screenResult = document.getElementById('screen-result');

    dom.itemInput = document.getElementById('itemInput');
    dom.cameraBtn = document.getElementById('cameraBtn');
    dom.fileInput = document.getElementById('fileInput');
    dom.startBtn = document.getElementById('startBtn');
    dom.photoPreview = document.getElementById('photoPreview');
    dom.previewImage = document.getElementById('previewImage');
    dom.removePhotoBtn = document.getElementById('removePhotoBtn');

    dom.itemChip = document.getElementById('itemChip');
    dom.chipImage = document.getElementById('chipImage');
    dom.chipName = document.getElementById('chipName');
    dom.progressDots = document.querySelectorAll('.progress-dots .dot');
    dom.questionCard = document.getElementById('questionCard');
    dom.questionNumber = document.getElementById('questionNumber');
    dom.questionText = document.getElementById('questionText');
    dom.btnYes = document.getElementById('btnYes');
    dom.btnNo = document.getElementById('btnNo');
    dom.answeredSummary = document.getElementById('answeredSummary');

    dom.resultItemChip = document.getElementById('resultItemChip');
    dom.resultChipImage = document.getElementById('resultChipImage');
    dom.resultChipName = document.getElementById('resultChipName');
    dom.scoreProgress = document.getElementById('scoreProgress');
    dom.scoreValue = document.getElementById('scoreValue');
    dom.verdictBanner = document.getElementById('verdictBanner');
    dom.verdictEmoji = document.getElementById('verdictEmoji');
    dom.verdictTitle = document.getElementById('verdictTitle');
    dom.adviceText = document.getElementById('adviceText');
    dom.scenariosCard = document.getElementById('scenariosCard');
    dom.scenariosList = document.getElementById('scenariosList');
    dom.restartBtn = document.getElementById('restartBtn');

    dom.toast = document.getElementById('toast');
    dom.fallbackWarning = document.getElementById('fallbackWarning');
    dom.exampleTags = document.querySelectorAll('.example-tag');
  }

  // --- Screen Management ---
  var screens = {};

  function initScreens() {
    screens = {
      landing: dom.screenLanding,
      identifying: dom.screenIdentifying,
      questions: dom.screenQuestions,
      loading: dom.screenLoading,
      result: dom.screenResult
    };
  }

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.remove('screen--active');
    });
    if (screens[name]) {
      screens[name].classList.add('screen--active');
    }
    state.currentScreen = name;
  }

  // --- Toast ---
  var toastTimer = null;

  function showToast(msg, duration) {
    duration = duration || 3000;
    dom.toast.textContent = msg;
    dom.toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      dom.toast.classList.remove('visible');
    }, duration);
  }

  // --- Photo Handling ---
  function onPhotoReady(base64, previewURL, error) {
    if (error) {
      showToast(error);
      return;
    }
    state.capturedImageBase64 = base64;
    state.previewURL = previewURL;
    dom.previewImage.src = previewURL;
    dom.photoPreview.classList.add('visible');
    dom.itemInput.placeholder = '已拍照，也可手动输入物品名';

    // Hide camera button when vision is disabled
    var cfg = window.DECLUTTER_CONFIG || {};
    if (cfg.visionEnabled === false) {
      showToast('当前模型不支持图片识别，请手动输入物品名');
    }
  }

  function clearPhoto() {
    state.capturedImageBase64 = null;
    state.previewURL = null;
    dom.photoPreview.classList.remove('visible');
    dom.previewImage.src = '';
    dom.itemInput.placeholder = '这件东西叫什么？';
    CameraModule.clearPhoto();
  }

  // --- Start Evaluation ---
  function handleStartEvaluation() {
    var inputName = dom.itemInput.value.trim();
    var hasPhoto = !!state.capturedImageBase64;
    var cfg = window.DECLUTTER_CONFIG || {};

    // If user typed a name, use it directly
    if (inputName) {
      state.itemName = inputName;
      startQuestions();
      return;
    }

    // If has photo and vision enabled, identify via AI
    if (hasPhoto && cfg.visionEnabled !== false && APIModule.isConfigured()) {
      identifyItemFromPhoto();
      return;
    }

    // If has photo but no vision, prompt user to type name
    if (hasPhoto) {
      showToast('请输入物品名称');
      dom.itemInput.focus();
      return;
    }

    // Nothing provided
    dom.itemInput.focus();
    var wrapper = document.querySelector('.item-input-wrapper');
    wrapper.classList.add('shake');
    setTimeout(function () { wrapper.classList.remove('shake'); }, 400);
  }

  function identifyItemFromPhoto() {
    showScreen('identifying');

    APIModule.identifyItem(state.capturedImageBase64).then(function (name) {
      if (name && name.length > 0) {
        state.itemName = name;
        startQuestions();
      } else {
        showScreen('landing');
        showToast('无法识别物品，请手动输入名称');
        dom.itemInput.focus();
      }
    }).catch(function (err) {
      showScreen('landing');
      showToast(err.message || '识别失败，请手动输入名称');
      dom.itemInput.focus();
    });
  }

  // --- Questions Flow ---
  function startQuestions() {
    state.answers = [null, null, null];
    state.currentQuestionIndex = 0;

    // Update item chip
    dom.chipName.textContent = state.itemName;
    dom.resultChipName.textContent = state.itemName;

    if (state.previewURL) {
      dom.chipImage.src = state.previewURL;
      dom.chipImage.classList.add('visible');
      dom.resultChipImage.src = state.previewURL;
      dom.resultChipImage.classList.add('visible');
    } else {
      dom.chipImage.classList.remove('visible');
      dom.resultChipImage.classList.remove('visible');
    }

    renderQuestion(0);
    showScreen('questions');
  }

  function renderQuestion(index) {
    // Update progress dots
    for (var i = 0; i < dom.progressDots.length; i++) {
      dom.progressDots[i].classList.remove('dot--active', 'dot--done');
      if (i < index) dom.progressDots[i].classList.add('dot--done');
      if (i === index) dom.progressDots[i].classList.add('dot--active');
    }

    // Animate card
    dom.questionCard.classList.remove('slide-out');
    // Force reflow
    void dom.questionCard.offsetWidth;
    dom.questionCard.style.animation = 'none';
    void dom.questionCard.offsetWidth;
    dom.questionCard.style.animation = '';

    dom.questionNumber.textContent = '问题 ' + (index + 1) + '/3';
    dom.questionText.textContent = QUESTIONS[index];

    // Update answered summary
    renderAnsweredSummary(index);
  }

  function renderAnsweredSummary(upToIndex) {
    var parts = [];
    for (var i = 0; i < upToIndex; i++) {
      var q = QUESTIONS[i];
      var a = state.answers[i] ? '是' : '否';
      parts.push(q + ' ' + a);
    }
    dom.answeredSummary.textContent = parts.join('  |  ');
  }

  function handleAnswer(isYes) {
    state.answers[state.currentQuestionIndex] = isYes;

    if (state.currentQuestionIndex < 2) {
      state.currentQuestionIndex++;
      renderQuestion(state.currentQuestionIndex);
    } else {
      // All questions answered, get advice
      getAdvice();
    }
  }

  // --- Get AI Advice ---
  function getAdvice() {
    showScreen('loading');

    if (!APIModule.isConfigured()) {
      // Use fallback
      var result = APIModule.fallbackAdvice(state.itemName, state.answers);
      setTimeout(function () {
        renderResult(result);
      }, 800); // Brief delay for UX
      return;
    }

    APIModule.getAdvice(state.itemName, state.answers, state.capturedImageBase64)
      .then(function (result) {
        if (result) {
          renderResult(result);
        } else {
          // AI returned unparseable result, use fallback
          var fb = APIModule.fallbackAdvice(state.itemName, state.answers);
          renderResult(fb);
        }
      })
      .catch(function (err) {
        showToast(err.message || 'AI 请求失败');
        var fb = APIModule.fallbackAdvice(state.itemName, state.answers);
        renderResult(fb);
      });
  }

  // --- Render Result ---
  function renderResult(result) {
    state.result = result;

    var verdictInfo = VERDICT_MAP[result.verdict] || VERDICT_MAP.user;
    var score = result.score;
    var color = verdictInfo.color;

    // Reset score ring animation
    dom.scoreProgress.style.transition = 'none';
    dom.scoreProgress.style.strokeDashoffset = '377';
    dom.scoreProgress.style.stroke = color;
    dom.scoreValue.textContent = '0';
    dom.scoreValue.style.color = color;

    // Verdict banner
    dom.verdictBanner.className = 'verdict-banner verdict-' + result.verdict;
    dom.verdictEmoji.textContent = verdictInfo.emoji;
    dom.verdictTitle.textContent = result.title || '';

    // Advice
    dom.adviceText.textContent = result.advice || '';

    // Scenarios
    if (result.verdict === 'consider' && result.scenarios && result.scenarios.length) {
      dom.scenariosList.innerHTML = '';
      result.scenarios.forEach(function (s) {
        var li = document.createElement('li');
        li.textContent = s;
        dom.scenariosList.appendChild(li);
      });
      dom.scenariosCard.classList.add('visible');
    } else {
      dom.scenariosCard.classList.remove('visible');
    }

    showScreen('result');

    // Animate score ring after screen transition
    requestAnimationFrame(function () {
      setTimeout(function () {
        var targetOffset = 377 * (1 - score / 100);
        dom.scoreProgress.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
        dom.scoreProgress.style.strokeDashoffset = targetOffset;

        // Animate score number
        animateNumber(dom.scoreValue, 0, score, 1000);
      }, 100);
    });
  }

  function animateNumber(el, from, to, duration) {
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var current = Math.round(from + (to - from) * progress);
      el.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  // --- Restart ---
  function handleRestart() {
    state.itemName = '';
    state.capturedImageBase64 = null;
    state.previewURL = null;
    state.answers = [null, null, null];
    state.currentQuestionIndex = 0;
    state.result = null;

    dom.itemInput.value = '';
    clearPhoto();

    // Reset score ring
    dom.scoreProgress.style.transition = 'none';
    dom.scoreProgress.style.strokeDashoffset = '377';

    showScreen('landing');
    dom.itemInput.focus();
  }

  // --- Event Binding ---
  function bindEvents() {
    dom.startBtn.addEventListener('click', handleStartEvaluation);

    dom.itemInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleStartEvaluation();
      }
    });

    dom.removePhotoBtn.addEventListener('click', clearPhoto);

    dom.btnYes.addEventListener('click', function () { handleAnswer(true); });
    dom.btnNo.addEventListener('click', function () { handleAnswer(false); });

    dom.restartBtn.addEventListener('click', handleRestart);

    // Example tags
    dom.exampleTags.forEach(function (tag) {
      tag.addEventListener('click', function () {
        dom.itemInput.value = tag.textContent;
        dom.itemInput.focus();
      });
    });

    // Hide camera button if vision not enabled and no API
    var cfg = window.DECLUTTER_CONFIG || {};
    if (cfg.visionEnabled === false) {
      dom.cameraBtn.classList.add('hidden');
    }
  }

  // --- Init ---
  function init() {
    cacheDom();
    initScreens();

    CameraModule.init(dom.cameraBtn, dom.fileInput, onPhotoReady);

    bindEvents();

    // Show fallback warning if API not configured
    if (!APIModule.isConfigured()) {
      dom.fallbackWarning.classList.add('visible');
    }

    showScreen('landing');
    dom.itemInput.focus();
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
