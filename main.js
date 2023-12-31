class Player {
  constructor(playerAreaId) {
    this.playerArea = document.getElementById(playerAreaId);
    this.audioContext = new AudioContext();
    this.isPlaying = false;
    this.isLoopEnabled = false;
    this.gainNodes = [];
    this.audioBuffers = [];
    this.audioSources = [];
    this.startTime = 0;
    this.playPos = 0;
    this.updateDisplayLoop = null;
    this.wakeLock = null;
    this.hasImage = typeof imageCount != "undefined" && imageCount > 0;
    this.imageUrls = [];
    this.spos = {};
    this.imgElem = null;
    this.loadedAudioCount = 0;

    if (this.playerArea) {
      document.addEventListener("DOMContentLoaded", () => this.initialize());
    }
  }

  // 初期化関連
  async initialize() {
    await this.createPlayer();
    this.setupUI();
    this.setupEventListeners();
    this.setupAudio();
    if (this.hasImage) {
      this.setupImage();
    }
  }

  async createPlayer() {
    const response = await fetch("/ototori/assets/player.html");
    const html = await response.text();
    this.playerArea.innerHTML = html;
  }

  setupUI() {
    this.cursor = document.getElementById("cursor");
    this.controllerArea = document.getElementById("controller");
    this.playPauseButton = document.getElementById("playPauseButton");
    this.currentTime = document.getElementById("currentTime");
    this.maxTime = document.getElementById("maxTime");
    this.seekBar = document.getElementById("seekBar");
    this.settingsMenu = document.getElementById("settingsMenu");
    this.settingsButton = document.getElementById("settingsButton");
    this.mixerButton = document.getElementById("mixerButton");
    this.loopButton = document.getElementById("loopButton");
    this.loopCheckIcon = document.getElementById("loopCheckIcon");
    this.fullscreenButton = document.getElementById("fullscreenButton");
    this.mixerDialog = document.getElementById("mixerDialog");
  }

  setupEventListeners() {
    this.playPauseButton.addEventListener("click", () => {
      this.togglePlayPause();
    });
      
    this.seekBar.addEventListener("input", () => {
      if (this.updateDisplayLoop) {
        cancelAnimationFrame(this.updateDisplayLoop.id);
        this.updateDisplayLoop = null;
      }
      this.currentTime.innerText = this.formatTime(this.seekBar.value);
      if (this.hasImage) {
        this.updateImage(this.seekBar.value);
      }
    });

    this.seekBar.addEventListener("change", () => {
      if (this.hasImage) {
        this.updateImage(this.seekBar.value);
      }
      this.seekAudio(Number(this.seekBar.value));
    });
        
    this.settingsButton.addEventListener("click", () => {
      this.settingsMenu.open = !this.settingsMenu.open;
    });

    this.mixerButton.addEventListener("click", () => {
      this.mixerDialog.show();
    });

    this.loopButton.addEventListener("click", () => {
      this.isLoopEnabled = !this.isLoopEnabled;
      if (this.isLoopEnabled) {
        this.loopCheckIcon.slot = "end";
      } else {
        this.loopCheckIcon.slot = "null";
      }
    });

    this.fullscreenButton.addEventListener("click", () => {
      this.toggleFullScreen(this.playerArea);
    });

    document.addEventListener("fullscreenchange", () => {
      this.fullscreenButton.selected = document.fullscreenElement == this.playerArea;
    });

    // カーソル移動でコントローラー表示・非表示
    this.playerArea.addEventListener("mousemove", () => this.handleUserActivity());
    this.playerArea.addEventListener("keydown", () => this.handleUserActivity());
    this.playerArea.addEventListener("click", () => this.handleUserActivity());

    document.addEventListener("visibilitychange", () => this.handleVisibilityChange());
    
    // 画面リサイズ時にカーソルを再配置
    if (this.hasImage) {
      window.addEventListener("resize", () => {
        this.updateImage(this.seekBar.value);
      });
    }
  }

  setupAudio() {
    // 読み込み済みの音声ファイルの数
    let loadedAudioCount = 0;

    // 読み込み中メッセージの生成とDOMへの追加
    const loadingMessage = document.createElement("p");
    loadingMessage.textContent = `音ファイルを読み込み中 (0 / ${audios.length})`;
    document.body.appendChild(loadingMessage);

    // 音ファイルのfetchとデコードを行う関数
    async function fetchAndDecodeAudio(audio) {
      const response = await fetch(audio.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
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
    Promise.all(audios.map(fetchAndDecodeAudio.bind(this)))
      .then(buffers => {
        // seekBarの最大値を最初の音声データの長さに設定
        this.seekBar.max = buffers[0].duration;
        // maxTime の更新
        this.maxTime.innerText = this.formatTime(buffers[0].duration);

        const tableBody = document.getElementById("volumeControls");
        // 各音声データに対応するgainNodeを生成し、音声ファイルのAudioBufferとセットで配列に追加
        buffers.forEach((buffer, index) => {
          const gainNode = this.audioContext.createGain();
          this.gainNodes.push(gainNode);
          this.audioBuffers.push(buffer);

          tableBody.appendChild(createVolumeControls(gainNode, index))
        });
      })
      .then(() => {
        // 音声ファイルの読み込みが完了したら、loadingMessageを削除
        document.body.removeChild(loadingMessage);
        this.playPauseButton.disabled = false;
        this.seekBar.disabled = false;
      })
      .catch(error => {
        // エラーが発生した場合にエラーメッセージを表示する
        const errorMessage = document.createElement("p");
        errorMessage.textContent = "ファイルの読み込みに失敗しました: " + error.toString();
        document.body.insertBefore(errorMessage, loadingMessage);
      });
  }

  setupImage() {
    // 画像URLの配列を生成
    for (let i = 1; i <= imageCount; i++) {
      this.imageUrls.push(`./score/score-${i}.svg`);
    }

    // 画像表示領域を作成
    const imageArea = document.getElementById("imageArea");
    this.imgElem = document.createElement("img");
    this.imgElem.src = this.imageUrls[0];
    this.imgElem.oncontextmenu = () => { return false; };
    this.imgElem.onselectstart = () => { return false; };
    this.imgElem.onmousedown = () => { return false; };
    imageArea.appendChild(this.imgElem);

    // 画像を非同期にプリロード
    (async () => {
      const promises = this.imageUrls.map(url => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      }));
      return Promise.all(promises);
    })();    

    // spos データを読み込み
    fetch("./score/spos.xml")
      .then(response => response.text())
      .then(xmlText => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        this.spos.elements = Array.from(xmlDoc.querySelectorAll("score > elements > element"), (element) => ({
          x: parseInt(element.getAttribute("x")),
          y: parseInt(element.getAttribute("y")),
          sy: parseFloat(element.getAttribute("sy")),
          page: parseInt(element.getAttribute("page"))
        }));

        this.spos.events = Array.from(xmlDoc.querySelectorAll("score > events > event"), (event) => ({
          position: parseInt(event.getAttribute("position"))
        }));
      })
      .catch(error => {
        console.error("Error fetching XML:", error);
      });
  }

  // 音の再生関連
  togglePlayPause() {
    if (this.playPauseButton.selected) {
      this.requestWakeLock();
      this.playAudio();
    } else {
      if (this.wakeLock) {
        this.wakeLock.release().then(() => {
          this.wakeLock = null;
        });
      }
      this.stopAudio();
      this.playPos += this.audioContext.currentTime + 0.1 - this.startTime;
    }
  }

  playAudio() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.startTime = this.audioContext.currentTime + 0.1;

      this.audioSources = this.audioBuffers.map((buffer, index) => {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gainNodes[index]);
        this.gainNodes[index].connect(this.audioContext.destination);
        source.start(this.startTime, this.playPos);
        return source;
      });

      this.updateDisplayLoop = this.createAnimationFrameLoop(() => this.updateDisplay());
      setTimeout(() => this.handlePlaybackEnd(), (this.seekBar.max - this.playPos) * 1000);
    }
  }

  stopAudio() {
    this.isPlaying = false;

    this.audioSources.forEach(source => {
      source.stop();
    });

    this.audioSources = [];

    if (this.updateDisplayLoop) {
      cancelAnimationFrame(this.updateDisplayLoop.id);
      this.updateDisplayLoop = null;
    }
  }

  seekAudio(time) {
    let shouldPlay = false;
    if (this.isPlaying) {
      this.stopAudio();
      shouldPlay = true;
    }
    this.playPos = time;
    if (shouldPlay) {
      this.playAudio();
    }
  }

  handlePlaybackEnd() {
    this.stopAudio();
    this.playPos = 0;
    if (this.isLoopEnabled) {
      this.playAudio();
    } else {
      if (this.wakeLock) {
        this.wakeLock.release().then(() => {
          this.wakeLock = null;
        });
      }
      this.playPauseButton.selected = false;
    }
  }

  // 画面の更新関連
  createAnimationFrameLoop(func) {
    let handler = {};
    function loop() {
      handler.id = requestAnimationFrame(loop);
      func();
    }
    handler.id = requestAnimationFrame(loop);
    return handler;
  }

  updateDisplay() {
    const time = this.audioContext.currentTime + 0.1 - this.startTime + this.playPos;
    seekBar.value = time;
    this.currentTime.innerText = this.formatTime(time);
    if (this.hasImage) {
      this.updateImage(time);
    }
  }

  updateImage(time) {
    let currentTime = (time - (typeof timeOffset == "undefined" ? 0 : timeOffset)) * 1000; // ミリ秒単位に変換
    if (currentTime < 0) {
      currentTime = 0;
    }
    const maxTime = (this.seekBar.max - (typeof timeOffset == "undefined" ? 0 : timeOffset)) * 1000;

    const currentElid = this.spos.events.findIndex(event => event.position > currentTime) - 1;
    const currentEvent = this.spos.events[currentElid] || this.spos.events[this.spos.events.length - 1];
    const currentPosition = currentEvent.position;
    const nextEvent = this.spos.events[currentElid + 1];
    const nextPosition = nextEvent ? nextEvent.position : maxTime;
    
    const currentElement = this.spos.elements[currentElid] || this.spos.elements[this.spos.elements.length - 1];
    const nextElement = this.spos.elements[currentElid + 1];

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
    // const scaleX = this.imgElem.clientWidth / (12 * this.imgElem.naturalWidth);
    // const scaleY = this.imgElem.clientHeight / (12 * this.imgElem.naturalHeight);
    const scaleX = this.imgElem.width / (12 * 2721.26);
    const scaleY = this.imgElem.height / (12 * 1530.71);
    const scale = Math.min(scaleX, scaleY);

    this.cursor.style.left = `${x * scale}px`;
    this.cursor.style.top = `${y * scale}px`;
    this.cursor.style.width = `${64 * scale}px`;
    this.cursor.style.height = `${sy * scale}px`;
    
    if (this.imgElem.src != this.imageUrls[currentPage]) {
      this.imgElem.src = this.imageUrls[currentPage];
    }
  }

  showController() {
    this.controllerArea.classList.remove("hide");
  }

  hideController() {
    this.controllerArea.classList.add("hide");
  }

  handleUserActivity() {
    this.showController();
    clearTimeout(this.controllerTimeout);
    this.controllerTimeout = setTimeout(() => {
      if (this.isPlaying && !this.settingsMenu.open && !this.mixerDialog.open) {
        this.hideController();
      }
    }, 3000);
  }

  formatTime(sec) {
    return Math.floor(sec / 60) + ":" + String(Math.floor(sec % 60)).padStart(2, "0")
  }

  toggleFullScreen(element) {
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

  // ウェイクロック
  async requestWakeLock() {
    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
    } catch (err) {
      console.log(`${err.name}, ${err.message}`);
    }
  }

  handleVisibilityChange() {
    if (this.wakeLock == null && document.visibilityState == "visible" && this.isPlaying) {
      this.requestWakeLock();
    }
  };
}

// Player クラスのインスタンスを作成し、初期化する
const player = new Player("player");
displayVersion();

// バージョン表示
function displayVersion() {
  const version = "3.0.4";
  const versionElement = document.createElement("a");
  versionElement.id = "version";
  versionElement.href = "/ototori/changelog";
  versionElement.innerText = "v" + version;
  document.body.appendChild(versionElement);
}