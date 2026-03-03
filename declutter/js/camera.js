/**
 * camera.js — 相机/照片捕获与压缩模块
 */
var CameraModule = (function () {
  var MAX_DIMENSION = 1024;
  var JPEG_QUALITY = 0.85;
  var MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  var _cameraBtn = null;
  var _fileInput = null;
  var _onPhotoReady = null;
  var _currentBase64 = null;

  function init(cameraBtn, fileInput, onPhotoReady) {
    _cameraBtn = cameraBtn;
    _fileInput = fileInput;
    _onPhotoReady = onPhotoReady;

    _cameraBtn.addEventListener('click', function () {
      _fileInput.click();
    });

    _fileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) {
        processFile(file);
      }
      // Reset so same file can be selected again
      _fileInput.value = '';
    });
  }

  function processFile(file) {
    if (!file.type.startsWith('image/')) {
      if (_onPhotoReady) _onPhotoReady(null, null, '请选择图片文件');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      if (_onPhotoReady) _onPhotoReady(null, null, '图片过大，请选择10MB以内的图片');
      return;
    }

    var previewURL = URL.createObjectURL(file);
    var reader = new FileReader();

    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var compressed = compressImage(img);
        _currentBase64 = compressed;
        if (_onPhotoReady) _onPhotoReady(compressed, previewURL, null);
      };
      img.onerror = function () {
        if (_onPhotoReady) _onPhotoReady(null, null, '图片加载失败，请重试');
      };
      img.src = e.target.result;
    };

    reader.onerror = function () {
      if (_onPhotoReady) _onPhotoReady(null, null, '图片读取失败');
    };

    reader.readAsDataURL(file);
  }

  function compressImage(img) {
    var w = img.naturalWidth;
    var h = img.naturalHeight;

    // Scale down if exceeds max dimension
    if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
      if (w > h) {
        h = Math.round(h * (MAX_DIMENSION / w));
        w = MAX_DIMENSION;
      } else {
        w = Math.round(w * (MAX_DIMENSION / h));
        h = MAX_DIMENSION;
      }
    }

    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // Return base64 without the data:image/jpeg;base64, prefix
    var dataURL = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return dataURL.split(',')[1];
  }

  function getBase64() {
    return _currentBase64;
  }

  function clearPhoto() {
    _currentBase64 = null;
  }

  return {
    init: init,
    processFile: processFile,
    getBase64: getBase64,
    clearPhoto: clearPhoto
  };
})();
