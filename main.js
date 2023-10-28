const playerArea = document.getElementById("player");
if (playerArea) {
  document.addEventListener("DOMContentLoaded", () => {
    createPlayer()
      .then(() => {
        initialize();
      });
  });
}
displayVersion();

async function createPlayer() {
  const response = await fetch("/ototori/assets/player.html");
  const html = await response.text();
  playerArea.innerHTML = html;
}

function initialize() {
  // UI 要素を取得
  const cursor = document.getElementById("cursor");
  const controllerArea = document.getElementById("controller");
  const playPauseButton = document.getElementById("playPauseButton");
  const currentTime = document.getElementById("currentTime");
  const maxTime = document.getElementById("maxTime");
  const seekBar = document.getElementById("seekBar");
  const settingsMenu = document.getElementById("settingsMenu");
  const settingsButton = document.getElementById("settingsButton");
  const mixerButton = document.getElementById("mixerButton");
  const loopButton = document.getElementById("loopButton");
  const loopCheckIcon = document.getElementById("loopCheckIcon");
  const fullscreenButton = document.getElementById("fullscreenButton");
  const mixerDialog = document.getElementById("mixerDialog");

  // スコア画像のプリロードと、表示要素の属性設定
  const hasImage = typeof imageCount != "undefined" && imageCount > 0;
  if (hasImage) {
    // 画像URLの配列を生成
    var imageUrls = [];
    for (let i = 1; i <= imageCount; i++) {
      imageUrls.push(`./score/score-${i}.svg`);
    }

    // 画像表示領域を作成
    const imageArea = document.getElementById("imageArea");
    var img = document.createElement("img");
    img.src = imageUrls[0];
    img.oncontextmenu = () => { return false; };
    img.onselectstart = () => { return false; };
    img.onmousedown = () => { return false; };
    imageArea.appendChild(img);

    // 画像を非同期にプリロードする関数
    async function preloadImages(urls) {
      const promises = urls.map(url => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      }));
      return Promise.all(promises);
    }

    // 画像を非同期にプリロード
    preloadImages(imageUrls);

    // spos データを読み込み
    var spos = {};
    fetch("./score/spos.xml")
      .then(response => response.text())
      .then(xmlText => {
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(xmlText, "application/xml");

        spos.elements = Array.from(xmlDoc.querySelectorAll("score > elements > element"), (element) => ({
          x: parseInt(element.getAttribute("x")),
          y: parseInt(element.getAttribute("y")),
          sy: parseFloat(element.getAttribute("sy")),
          page: parseInt(element.getAttribute("page"))
        }));

        spos.events = Array.from(xmlDoc.querySelectorAll("score > events > event"), (event) => ({
          position: parseInt(event.getAttribute("position"))
        }));
      })
      .catch(error => {
        console.error("Error fetching XML:", error);
      });
  }

  // コントローラーを表示・非表示
  let controllerTimeout;

  document.addEventListener("mousemove", handleUserActivity);
  document.addEventListener("keydown", handleUserActivity);
  document.addEventListener("click", handleUserActivity);

  function handleUserActivity() {
    showController();
    clearTimeout(controllerTimeout);
    controllerTimeout = setTimeout(() => {
      if (isPlaying && !settingsMenu.open && !mixerDialog.open) {
        hideController();
      }
    }, 3000);
  }

  function showController() {
    controllerArea.classList.remove("hide");
  }

  function hideController() {
    controllerArea.classList.add("hide");
  }

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
  let updateDisplayLoop;

  // 読み込み済みの音声ファイルの数
  var loadedAudioCount = 0;

  // 読み込み中メッセージの生成とDOMへの追加
  const loadingMessage = document.createElement("p");
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
    playSwitch.selected = audios[index].initialPlay ?? true;
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
    volumeSlider.disabled = !playSwitch.selected;
    volumeSlider.labeled = true;
    volumeSlider.max = 127;
    volumeSlider.value = audios[index].initialVolume ?? 80;
    gainNode.gain.value = playSwitch.selected ? volumeSlider.value / 100 : 0;
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
      seekBar.disabled = false;
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

      updateDisplayLoop = createAnimationFrameLoop(updateDisplay);
    }
  }

  function stopAudio() {
    isPlaying = false;

    audioSources.forEach(source => {
      source.stop();
    });

    audioSources = [];

    if (updateDisplayLoop) {
      cancelAnimationFrame(updateDisplayLoop.id);
      updateDisplayLoop = null;
    }
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

  // 画面の更新関連
  function createAnimationFrameLoop(func) {
    let handler = {};
    function loop() {
      handler.id = requestAnimationFrame(loop);
      func();
    }
    handler.id = requestAnimationFrame(loop);
    return handler;
  }

  function updateDisplay() {
    time = audioContext.currentTime + 0.1 - startTime + playPos;
    seekBar.value = time;
    currentTime.innerText = formatTime(time);
    if (time > seekBar.max) {
      stopAudio();
      playPos = 0;
      if (isLoopEnabled) {
        playAudio();
      } else {
        if (wakeLock) {
          wakeLock.release();
        }
        playPauseButton.selected = false;
      }
    }
    if (hasImage) {
      updateImage(time);
    }
  }

  function updateImage(time) {
    let currentTime = (time - (typeof timeOffset == "undefined" ? 0 : timeOffset)) * 1000; // ミリ秒単位に変換
    if (currentTime < 0) {
      currentTime = 0;
    }
    const maxTime = (seekBar.max - (typeof timeOffset == "undefined" ? 0 : timeOffset)) * 1000;

    const currentElid = spos.events.findIndex(event => event.position > currentTime) - 1;
    const currentEvent = spos.events[currentElid] || spos.events[spos.events.length - 1];
    const currentPosition = currentEvent.position;
    const nextEvent = spos.events[currentElid + 1];
    const nextPosition = nextEvent ? nextEvent.position : maxTime;
    
    const currentElement = spos.elements[currentElid] || spos.elements[spos.elements.length - 1];
    const nextElement = spos.elements[currentElid + 1];

    const currentX = currentElement.x;
    const currentY = currentElement.y;
    const sy = currentElement.sy;
    const currentPage = currentElement.page;

    const nextY = nextElement ? nextElement.y : currentY;
    const nextPage = nextElement ? nextElement.page : currentPage;
    const nextX = nextElement && nextY == currentY && nextPage == currentPage ? nextElement.x : 30954;

    const x = currentX + (nextX - currentX) * (currentTime - currentPosition) / (nextPosition - currentPosition);
    const y = currentY;

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
    
    if (img.src != imageUrls[currentPage]) {
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
    if (updateDisplayLoop) {
      cancelAnimationFrame(updateDisplayLoop.id);
      updateDisplayLoop = null;
    }
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
      
  settingsButton.addEventListener("click", () => {
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
    toggleFullScreen(playerArea);
  });

  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.selected = document.fullscreenElement == playerArea;
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
}

// バージョン表示
function displayVersion() {
  const version = "3.0.1";
  const versionElement = document.createElement("a");
  versionElement.id = "version";
  versionElement.href = "/ototori/changelog";
  versionElement.innerText = "v" + version;
  document.body.appendChild(versionElement);
}