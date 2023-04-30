var audioElements = document.getElementsByTagName('audio');
var numAudioElements = audioElements.length;
var audioBuffers = [];
var audioContext;
var playingCount = 0;

function playAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  var gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);

  for (var i = 0; i < numAudioElements; i++) {
    (function(i) { // 関数内で変数を定義
      var request = new XMLHttpRequest();
      request.open('GET', audioElements[i].src, true);
      request.responseType = 'arraybuffer';

      request.onload = function() {
        audioContext.decodeAudioData(request.response, function(buffer) {
          audioBuffers.push(buffer);
          if (audioBuffers.length == numAudioElements) {
            playBuffers();
          }
        });
      };
      request.send();
    })(i); // 関数を即時実行
  }
}

function playBuffers() {
  var startTime = audioContext.currentTime + 0.1;
  var sourceNodes = [];

  for (var i = 0; i < numAudioElements; i++) {
    var sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffers[i];
    sourceNode.connect(audioContext.destination);
    sourceNode.start(startTime);
    sourceNodes.push(sourceNode);
  }

  var checkInterval = setInterval(function() {
    var minTime = audioContext.currentTime + 10;
    var maxTime = audioContext.currentTime + 11;
    var allSourcesArePlaying = true;

    for (var i = 0; i < numAudioElements; i++) {
      var sourceNode = sourceNodes[i];
      var sourceNodeStartTime = sourceNode.startTime + audioContext.currentTime;
      var sourceNodeEndTime = sourceNodeStartTime + sourceNode.buffer.duration;

      if (sourceNodeEndTime < minTime) {
        sourceNode.stop();
        sourceNode.start(maxTime);
      }

      if (sourceNode.startTime <= audioContext.currentTime) {
        if (sourceNodeEndTime < audioContext.currentTime) {
          sourceNode.stop();
          sourceNode.start(maxTime);
        }
      } else {
        allSourcesArePlaying = false;
      }
    }

    if (allSourcesArePlaying) {
      clearInterval(checkInterval);
    }
  }, 100);
}