// DOM要素の取得
const playButton = document.getElementById("playButton");
const stopButton = document.getElementById("stopButton");
const currentTime = document.getElementById("currentTime");
const maxTime = document.getElementById("maxTime");
const seekBar = document.getElementById("seekBar");

// 動画要素の生成と属性設定
var video = document.querySelector("video") || document.createElement("video"); // const だとなぜか Safari でうまく動かない
video.preload = "auto";
video.oncontextmenu = () => { return false; }
// iOS Safari 対策ここから
video.setAttribute("muted", "");
video.setAttribute("playsinline", "");
video.load();
// iOS Safari 対策ここまで

// オーディオコンテキストの生成
var audioContext = new AudioContext();

// 各音声データに対応するgainNode, audioBuffer, audioSourceの配列
var gainNodes = [];
var audioBuffers = [];
var audioSources = [];

// 再生状態の初期化
let isPlaying = false;

// 再生位置の初期化
let startTime = 0;
var playPos = 0;

// currentTimeの更新用関数
let setCurrentTime;

// 読み込み済みの音声ファイルの数
var loadedAudioCount = 0;

// 読み込み中メッセージの生成とDOMへの追加
var loadingMessage = document.createElement("p");
loadingMessage.textContent = `音ファイルを読み込み中 (0 / ${audioUrls.length})`;
document.body.appendChild(loadingMessage);

// 音声ファイルのfetchとデコードを行う関数
async function fetchAudio(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  loadingMessage.innerText = `音ファイルを読み込み中 (${++loadedAudioCount} / ${audioUrls.length})`;
  return audioBuffer;
}

// 音量調整用のUIを生成する関数
function createVolumeControls(gainNode, index) {
  const fileNameCell = document.createElement("td");
  fileNameCell.textContent = audioUrls[index].split("/").pop().split(".")[0];;

  const volumeCell = document.createElement("td");
  const volumeControl = document.createElement("input");
  volumeControl.type = "range";
  volumeControl.min = "0";
  volumeControl.max = "1.28";
  volumeControl.step = "any";
  volumeControl.value = "0.8";
  volumeControl.addEventListener("input", event => {
    gainNode.gain.value = event.target.value;
  });
  volumeCell.appendChild(volumeControl);

  const row = document.createElement("tr");
  row.appendChild(fileNameCell);
  row.appendChild(volumeCell);
  return row;
}

// 全ての音声ファイルのfetchとデコードを行い、AudioBufferを配列で取得
Promise.all(audioUrls.map(fetchAudio))
  .then(buffers => {
    // seekBarの最大値を最初の音声データの長さに設定
    seekBar.max = buffers[0].duration;
    // maxTime の更新
    maxTime.innerText = formatTime(buffers[0].duration);

    const tableBody = document.getElementById("volumeControls");
    // 各音声データに対応するgainNodeを生成し、音声ファイルのAudioBufferとセットで配列に追加
    buffers.forEach((buffer, index) => {
      const gainNode = audioContext.createGain();
      gainNodes.push(gainNode);
      audioBuffers.push(buffer);

      tableBody.appendChild(createVolumeControls(gainNode, index))
    });
  })
  .then(() => {
    // 音声ファイルの読み込みが完了したら、loadingMessageを削除
    document.body.removeChild(loadingMessage);
  })
  .catch(error => {
    // エラーが発生した場合にエラーメッセージを表示する
    const errorMessage = document.createElement("p");
    errorMessage.textContent = "ファイルの読み込みに失敗しました: " + error.toString();
    document.body.insertBefore(errorMessage, loadingMessage);
  });

function playAudio() {
  isPlaying = true;
  startTime = audioContext.currentTime + 0.1;

  audioSources = audioBuffers.map((buffer, index) => {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNodes[index]);
    gainNodes[index].connect(audioContext.destination);
    source.start(startTime, playPos);
    return source;
  });

  setCurrentTime = setInterval(() => {
    time = audioContext.currentTime + 0.1 - startTime + playPos;
    if (document.activeElement != seekBar) {
      seekBar.value = time;
      currentTime.innerText = formatTime(time);
    }
    if (time > seekBar.max) {
      stopAudio();
      playPos = 0;
    }
  }, 200);
}

function stopAudio() {
  isPlaying = false;

  audioSources.forEach(source => {
    source.stop();
  });

  audioSources = [];

  clearInterval(setCurrentTime);
}

function seekAudio(time) {
  if (isPlaying) {
    stopAudio();
    video.pause();
    isPlaying = true;
  }

  playPos = time;
  video.currentTime = time;

  if (isPlaying) {
    waitForVideo().then(() => {
      playAudio();
      video.play();
    });
  }
}

playButton.addEventListener("click", () => {
  if (!isPlaying) {
    waitForVideo().then(() => {
      playAudio();
      video.play();
    });
  } else {
    stopAudio();
    video.pause();
  }
});

stopButton.addEventListener("click", () => {
  stopAudio();
  video.pause();
  playPos += audioContext.currentTime + 0.1 - startTime;
});

seekBar.addEventListener("input", () => {
  currentTime.innerText = formatTime(seekBar.value);
  video.currentTime = seekBar.value;
});

seekBar.addEventListener("change", () => {
  seekAudio(Number(seekBar.value));
  seekBar.blur();
});

// 時間の表示をフォーマットする関数
function formatTime(sec) {
  return Math.floor(sec / 60) + ":" + String(Math.floor(sec % 60)).padStart(2, "0")
}

// 動画の再生準備が整うまで待機するための関数
function waitForVideo() {
  return new Promise(resolve => {
    const checkIfReady = () => {
      if (video.src == "" || video.readyState == 4) {
        resolve();
      } else {
        setTimeout(checkIfReady, 200);
      }
    };
    checkIfReady();
  });
}

// 動画の再生開始時に再生位置を修正 (ページから離れて戻ったときのズレを修正)
video.addEventListener("play", (e) => {
  if (Math.abs(video.currentTime - seekBar.value) > 0.1) {
    video.currentTime = seekBar.value;
  }
});

// ダブルクリック/タップで動画を全画面表示
video.addEventListener("dblclick", function(e) {
  // 現在全画面表示かチェック
  if (document.fullscreenElement == video || document.webkitFullscreenElement == video || document.mozFullScreenElement == video) {
    // そうなら、全画面表示を終了
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    }
  } else {
    // そうでないなら、全画面表示を開始
    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if (video.webkitRequestFullscreen) {
      video.webkitRequestFullscreen();
    } else if (video.mozRequestFullScreen) {
      video.mozRequestFullScreen();
    }
  }
});

// バージョン表示
var version = "1.0.2";
var versionElement = document.createElement("a");
versionElement.style.display = "block";
versionElement.style.position = "fixed";
versionElement.style.bottom = "0";
versionElement.style.right = "0";
versionElement.style.background = "#ccc";
versionElement.style.color = "#333";
versionElement.style.padding = "5px";
versionElement.href = "/ototori/changelog";
versionElement.innerHTML = "v" + version;
document.body.appendChild(versionElement);