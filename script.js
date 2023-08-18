// DOM要素の取得
const playButton = document.getElementById("playButton");
const stopButton = document.getElementById("stopButton");
const currentTime = document.getElementById("currentTime");
const maxTime = document.getElementById("maxTime");
const seekBar = document.getElementById("seekBar");
playButton.disabled = true;
stopButton.style.display = "none";

// スコア画像のプリロードと、表示要素の属性設定
const hasImage = typeof imageCount != "undefined" && imageCount > 0;
if (hasImage) {
  // 画像URLの配列を生成
  var imageUrls = [];
  for (let i = 1; i <= imageCount; i++) {
    imageUrls.push(`./media/score-${i}.svg`);
  }
  var imageContainer = document.createElement("div");
  imageContainer.id = "imageContainer";
  var imageArea = document.createElement("div");
  imageArea.id = "imageArea";
  var img = document.createElement("img");
  img.src = imageUrls[0];
  img.oncontextmenu = () => { return false; };
  img.onselectstart = () => { return false; };
  img.onmousedown = () => { return false; };
  imageArea.appendChild(img);
  // 画像をプリロード
  for (let i = 0; i < imageUrls.length; i++) {  
    var image = document.createElement("img");
    image.src = imageUrls[i];
  }
  // カーソル要素を作成
  var cursor = document.createElement("div");
  cursor.id = "cursor";
  imageArea.appendChild(cursor);
  // spos データを取得
  var spos;
  fetch("./media/spos.xml")
    .then(response => response.text())
    .then(xmlText => {
      const parser = new DOMParser();
      spos = parser.parseFromString(xmlText, "application/xml");
    })
    .catch(error => {
      console.error("Error fetching XML:", error);
    });
  imageContainer.appendChild(imageArea);
  document.body.insertBefore(imageContainer, playButton);
}

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
loadingMessage.textContent = `音ファイルを読み込み中 (0 / ${audios.length})`;
document.body.appendChild(loadingMessage);

// 音声ファイルのfetchとデコードを行う関数
async function fetchAudio(audio) {
  const response = await fetch(audio.url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  loadingMessage.innerText = `音ファイルを読み込み中 (${++loadedAudioCount} / ${audios.length})`;
  return audioBuffer;
}

// 音量調整用のUIを生成する関数
function createVolumeControls(gainNode, index) {
  const fileNameCell = document.createElement("td");
  fileNameCell.textContent = audios[index].url.split("/").pop().split(".")[0];

  const volumeCell = document.createElement("td");
  const volumeControl = document.createElement("input");
  volumeControl.type = "range";
  volumeControl.min = 0;
  volumeControl.max = 1.28;
  volumeControl.step = "any";
  volumeControl.value = gainNode.gain.value = audios[index].initialVolume ?? 0.8;
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
Promise.all(audios.map(fetchAudio))
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
    playButton.disabled = false;
  })
  .catch(error => {
    // エラーが発生した場合にエラーメッセージを表示する
    const errorMessage = document.createElement("p");
    errorMessage.textContent = "ファイルの読み込みに失敗しました: " + error.toString();
    document.body.insertBefore(errorMessage, loadingMessage);
  });

function playAudio() {
  if (!isPlaying) {
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
      seekBar.value = time;
      currentTime.innerText = formatTime(time);
      if (time > seekBar.max) {
        wakeLock.release();
        stopAudio();
        playPos = 0;
        playButton.style.display = "";
        stopButton.style.display = "none";
      }
      if (hasImage) {
        updateImage(time);
      }
    }, 10);
  }
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
  var shouldPlay = false;
  if (isPlaying) {
    stopAudio();
    shouldPlay = true;
  }
  playPos = time;
  if (shouldPlay) {
    playAudio();
  }
}

function updateImage(time) {
  var currentTime = (time - (typeof timeOffset == "undefined" ? 0 : timeOffset)) * 1000; // ミリ秒単位に変換
  if (currentTime < 0) {
    currentTime = 0;
  }

  const events = spos.querySelectorAll("event");
  for (const event of events) {
    const position = parseFloat(event.getAttribute("position"));
    if (currentTime >= position) {
      var elid = parseInt(event.getAttribute("elid"));
      var currentPosition = position;
    } else {
      var nextPosition = position;
      break;
    }
  }
  
  const currentElement = spos.querySelector(`element[id="${elid}"]`) || spos.querySelector(`element[id="${elid - 1}"]`);
  const nextElement = spos.querySelector(`element[id="${elid + 1}"]`);

  if (currentElement) {
    const currentX = parseFloat(currentElement.getAttribute("x"));
    const currentY = parseFloat(currentElement.getAttribute("y"));
    const sy = parseFloat(currentElement.getAttribute("sy"));
    const currentPage = parseInt(currentElement.getAttribute("page"));
    var x = currentX + (30954 - currentX) * (currentTime - currentPosition) / ((seekBar.max - (typeof timeOffset == "undefined" ? 0 : timeOffset)) * 1000 - currentPosition);
    var y = currentY;
    if (nextElement) {
      const nextX = parseFloat(nextElement.getAttribute("x"));
      const nextY = parseFloat(nextElement.getAttribute("y"));
      const nextPage = parseInt(nextElement.getAttribute("page"));
      if (nextY == currentY && nextPage == currentPage) {
        x = currentX + (nextX - currentX) * (currentTime - currentPosition) / (nextPosition - currentPosition);
      } else {
        x = currentX + (30954 - currentX) * (currentTime - currentPosition) / (nextPosition - currentPosition);
      }
    }

    // Safari は SVG 画像の naturalWidth, naturalHeight を正しく取得できないらしい
    // const scaleX = img.clientWidth / (12 * img.naturalWidth);
    // const scaleY = img.clientHeight / (12 * img.naturalHeight);
    const scaleX = img.width / (12 * 2721.26);
    const scaleY = img.height / (12 * 1530.71);
    const scale = Math.min(scaleX, scaleY);

    cursor.style.left = `${x * scale}px`;
    cursor.style.top = `${y * scale}px`;
    cursor.style.width = `${64 * scale}px`;
    cursor.style.height = `${sy * scale}px`;
    
    img.src = imageUrls[currentPage];
  }
}

playButton.addEventListener("click", () => {
  requestWakeLock();
  playAudio();
  playButton.style.display = "none";
  stopButton.style.display = "";
});

stopButton.addEventListener("click", () => {
  wakeLock.release();
  stopAudio();
  playPos += audioContext.currentTime + 0.1 - startTime;
  playButton.style.display = "";
  stopButton.style.display = "none";
});

seekBar.addEventListener("input", () => {
  clearInterval(setCurrentTime);
  currentTime.innerText = formatTime(seekBar.value);
  if (hasImage) {
    updateImage(seekBar.value);
  }
});

seekBar.addEventListener("change", () => {
  if (hasImage) {
    updateImage(seekBar.value);
  }
  seekAudio(Number(seekBar.value));
});

// 時間の表示をフォーマットする関数
function formatTime(sec) {
  return Math.floor(sec / 60) + ":" + String(Math.floor(sec % 60)).padStart(2, "0")
}

// 全画面表示をトグルする関数
function toggleFullScreen(element) {
  // 現在全画面表示かチェック
  if ((document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) == element) {
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
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    }
  }
}

// スリープ防止
let wakeLock = null;

const requestWakeLock = async () => {
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch (err) {
    console.log(`${err.name}, ${err.message}`);
  }
}

const handleVisibilityChange = async () => {
  if (wakeLock != null && document.visibilityState == "visible" && isPlaying) {
    await requestWakeLock();
  }
};

document.addEventListener("visibilitychange", handleVisibilityChange);

if (hasImage) {
  // ダブルクリック/タップで画像を全画面表示
  imageContainer.addEventListener("dblclick", () => {
    toggleFullScreen(imageContainer);
  });

  // 画面リサイズ時にカーソルを再配置
  window.addEventListener("resize", () => {
    updateImage(seekBar.value);
  });
}

// PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      const sw = reg.installing || reg.waiting || reg.active;
      if (sw) {
        const data = {
          type: "CACHE_URLS",
          payload: [
            location.href,
            ...performance.getEntriesByType("resource").map((r) => r.name)
          ]
        };
        sw.postMessage(data);
      }
    })
    .catch((err) => console.log("SW registration FAIL:", err));
  });
}

// バージョン表示
var version = "1.2.1";
var versionElement = document.createElement("a");
versionElement.classList.add("version");
versionElement.href = "/ototori/changelog";
versionElement.innerText = "v" + version;
document.body.appendChild(versionElement);