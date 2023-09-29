// アプリ表示領域
const appArea = document.getElementById("app");

// スコア画像のプリロードと、表示要素の属性設定
const hasImage = typeof imageCount != "undefined" && imageCount > 0;
if (hasImage) {
  // 画像URLの配列を生成
  var imageUrls = [];
  for (let i = 1; i <= imageCount; i++) {
    imageUrls.push(`./media/score-${i}.svg`);
  }
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
  appArea.appendChild(imageArea);
}

// コントローラーの UI を生成
const controllerArea = document.createElement("div");
controllerArea.id = "controller";

// 再生・停止ボタン
const playPauseButton = document.createElement("md-icon-button");
playPauseButton.toggle = true;
playPauseButton.disabled = true;
const playIcon = document.createElement("md-icon");
playIcon.textContent = "play_arrow";
playPauseButton.appendChild(playIcon);
const pauseIcon = document.createElement("md-icon");
pauseIcon.slot = "selected";
pauseIcon.textContent = "pause";
playPauseButton.appendChild(pauseIcon);
controllerArea.appendChild(playPauseButton);

// 時間表示
const timeArea = document.createElement("div");
timeArea.id = "time";
const currentTime = document.createElement("span");
currentTime.textContent = "0:00";
const slashText = document.createTextNode(" / ");
const maxTime = document.createElement("span");
maxTime.textContent = "0:00";
timeArea.appendChild(currentTime);
timeArea.appendChild(slashText);
timeArea.appendChild(maxTime);
controllerArea.appendChild(timeArea);

// シークバー
const seekBar = document.createElement("md-slider");
seekBar.id = "seekBar";
seekBar.value = "0";
seekBar.step = "0.1";
controllerArea.appendChild(seekBar);

// 設定ボタン
const settingsWrapper = document.createElement("div");
settingsWrapper.id = "settingsWrapper";
const settingsAnchor = document.createElement("md-icon-button");
settingsAnchor.id = "settingsAnchor";
const settingsIcon = document.createElement("md-icon");
settingsIcon.textContent = "settings";
settingsAnchor.appendChild(settingsIcon);
settingsWrapper.appendChild(settingsAnchor);

// ミキサー
const settingsMenu = document.createElement("md-menu");
settingsMenu.id = "settingsMenu";
settingsMenu.setAttribute("anchor", "settingsAnchor");
const mixerButton = document.createElement("md-menu-item");
mixerButton.id = "mixerButton";
const mixerHeadline = document.createElement("div");
mixerHeadline.slot = "headline";
mixerHeadline.textContent = "ミキサー";
const mixerIcon = document.createElement("md-icon");
mixerIcon.slot = "start";
mixerIcon.textContent = "tune";
mixerButton.appendChild(mixerHeadline);
mixerButton.appendChild(mixerIcon);
settingsMenu.appendChild(mixerButton);

// ループ
const loopButton = document.createElement("md-menu-item");
const loopHeadline = document.createElement("div");
loopHeadline.slot = "headline";
loopHeadline.textContent = "ループ";
const loopIcon = document.createElement("md-icon");
loopIcon.slot = "start";
loopIcon.textContent = "repeat";
const loopCheckIcon = document.createElement("md-icon");
loopCheckIcon.slot = "null";
loopCheckIcon.textContent = "check";
loopButton.appendChild(loopHeadline);
loopButton.appendChild(loopIcon);
loopButton.appendChild(loopCheckIcon);
settingsMenu.appendChild(loopButton);

settingsWrapper.appendChild(settingsMenu);
controllerArea.appendChild(settingsWrapper);

// 全画面表示ボタン
const fullscreenButton = document.createElement("md-icon-button");
fullscreenButton.toggle = true;
const fullscreenIcon = document.createElement("md-icon");
fullscreenIcon.textContent = "fullscreen";
fullscreenButton.appendChild(fullscreenIcon);
const fullscreenExitIcon = document.createElement("md-icon");
fullscreenExitIcon.slot = "selected";
fullscreenExitIcon.textContent = "fullscreen_exit";
fullscreenButton.appendChild(fullscreenExitIcon);
controllerArea.appendChild(fullscreenButton);

appArea.appendChild(controllerArea);

// コントローラーを表示・非表示
let controllerTimeout;

document.addEventListener("mousemove", () => {
  showController();
  clearTimeout(controllerTimeout);
  controllerTimeout = setTimeout(() => {
    if (playPauseButton.selected && !settingsMenu.open && !mixerDialog.open) {
      hideController();
    }
  }, 3000);
});

document.addEventListener("keydown", () => {
  showController();
  clearTimeout(controllerTimeout);
  controllerTimeout = setTimeout(() => {
    if (playPauseButton.selected && !settingsMenu.open && !mixerDialog.open) {
      hideController();
    }
  }, 3000);
});

document.addEventListener("click", () => {
  showController();
  clearTimeout(controllerTimeout);
  controllerTimeout = setTimeout(() => {
    if (playPauseButton.selected && !settingsMenu.open && !mixerDialog.open) {
      hideController();
    }
  }, 3000);
});

function showController() {
  controllerArea.classList.remove("hide");
}

function hideController() {
  controllerArea.classList.add("hide");
}

// ミキサーダイアログを作成
const mixerDialog = document.createElement("md-dialog");
mixerDialog.id = "mixerDialog";

// headline
const headline = document.createElement("div");
headline.setAttribute("slot", "headline");
headline.textContent = "ミキサー";
mixerDialog.appendChild(headline);

// content
const form = document.createElement("form");
form.setAttribute("slot", "content");
form.id = "mixer";
form.method = "dialog";

// テーブル
const table = document.createElement("table");
const thead = document.createElement("thead");
const trHeader = document.createElement("tr");
const th1 = document.createElement("th");
th1.textContent = "パート";
const th2 = document.createElement("th");
th2.textContent = "再生";
const th3 = document.createElement("th");
th3.textContent = "音量";
trHeader.appendChild(th1);
trHeader.appendChild(th2);
trHeader.appendChild(th3);
thead.appendChild(trHeader);
table.appendChild(thead);
const tbody = document.createElement("tbody");
tbody.id = "volumeControls";
table.appendChild(tbody);
form.appendChild(table);

mixerDialog.appendChild(form);

// actions
const actionsSlot = document.createElement("div");
actionsSlot.setAttribute("slot", "actions");
const textButton = document.createElement("md-text-button");
textButton.setAttribute("form", "mixer");
textButton.textContent = "OK";
actionsSlot.appendChild(textButton);
mixerDialog.appendChild(actionsSlot);

appArea.appendChild(mixerDialog);

// オーディオコンテキストの生成
var audioContext = new AudioContext();

// 各音声データに対応するgainNode, audioBuffer, audioSourceの配列
var gainNodes = [];
var audioBuffers = [];
var audioSources = [];

// 再生状態の初期化
let isPlaying = false;
let isLoopEnabled = false;

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

  const switchCell = document.createElement("td");
  const playSwitch = document.createElement("md-switch");
  playSwitch.selected = true;
  playSwitch.addEventListener("change", (event) => {
    if (event.target.selected) {
      gainNode.gain.value = volumeSlider.value / 100;
      volumeSlider.disabled = false;
    } else {
      gainNode.gain.value = 0;
      volumeSlider.disabled = true;
    }
  });
  switchCell.appendChild(playSwitch);

  const volumeCell = document.createElement("td");
  const volumeSlider = document.createElement("md-slider");
  volumeSlider.labeled = true;
  volumeSlider.max = 127;
  volumeSlider.value = audios[index].initialVolume ?? 80;
  gainNode.gain.value = volumeSlider.value / 100;
  volumeSlider.addEventListener("input", (event) => {
    gainNode.gain.value = event.target.value / 100;
  });
  volumeCell.appendChild(volumeSlider);

  const row = document.createElement("tr");
  row.appendChild(fileNameCell);
  row.appendChild(switchCell);
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
    playPauseButton.disabled = false;
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
        if (wakeLock) {
          wakeLock.release();
        }
        stopAudio();
        playPos = 0;
        if (isLoopEnabled) {
          playAudio();
        } else {
          playPauseButton.selected = false;
        }
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

playPauseButton.addEventListener("click", () => {
  if (playPauseButton.selected) {
    requestWakeLock();
    playAudio();
  } else {
    if (wakeLock) {
      wakeLock.release();
    }
    stopAudio();
    playPos += audioContext.currentTime + 0.1 - startTime;
  }
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
    
settingsAnchor.addEventListener("click", () => {
  settingsMenu.open = !settingsMenu.open;
});

mixerButton.addEventListener("click", () => {
  mixerDialog.show();
});

loopButton.addEventListener("click", () => {
  if (isLoopEnabled) {
    isLoopEnabled = false;
    loopCheckIcon.slot = "null";
  } else {
    isLoopEnabled = true;
    loopCheckIcon.slot = "end";
  }
});

fullscreenButton.addEventListener("click", () => {
  toggleFullScreen(appArea);
});

document.addEventListener("fullscreenchange", () => {
  fullscreenButton.selected = document.fullscreenElement == appArea;
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
  // 画面リサイズ時にカーソルを再配置
  window.addEventListener("resize", () => {
    updateImage(seekBar.value);
  });
}

// PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.log("SW registration FAIL:", err);
    });
  });
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data.type === "ACTIVATED") {
      const data = {
        type: "CACHE_URLS",
        payload: [
          location.href,
          ...performance.getEntriesByType("resource").map((r) => r.name)
        ]
      };
      event.source.postMessage(data);
    }
  });
}

// バージョン表示
var version = "2.0.1";
var versionElement = document.createElement("a");
versionElement.id = "version";
versionElement.href = "/ototori/changelog";
versionElement.innerText = "v" + version;
document.body.appendChild(versionElement);