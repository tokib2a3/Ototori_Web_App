class Player {
  constructor(playerAreaId) {
    this.playerArea = document.getElementById(playerAreaId);
    this.audioContext = new AudioContext();
    this.isPlaying = false;
    this.isLoopEnabled = false;
    this.gainNodes = [];
    this.audioElems = [];
    this.currentTime = 0;
    this.duration = 0;
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
    this.currentTimeElem = document.getElementById("currentTime");
    this.maxTimeElem = document.getElementById("maxTime");
    this.seekBar = document.getElementById("seekBar");
    this.settingsMenu = document.getElementById("settingsMenu");
    this.settingsButton = document.getElementById("settingsButton");
    this.mixerButton = document.getElementById("mixerButton");
    this.playbackSpeedButton = document.getElementById("playbackSpeedButton");
    this.loopButton = document.getElementById("loopButton");
    this.loopCheckIcon = document.getElementById("loopCheckIcon");
    this.fullscreenButton = document.getElementById("fullscreenButton");
    this.mixerDialog = document.getElementById("mixerDialog");
    this.playbackSpeedDialog = document.getElementById("playbackSpeedDialog");
    this.playbackSpeedSlider = document.getElementById("playbackSpeedSlider");
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
      this.currentTimeElem.innerText = this.formatTime(this.seekBar.value);
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

    this.playbackSpeedButton.addEventListener("click", () => {
      this.playbackSpeedDialog.show();
    });

    this.playbackSpeedSlider.addEventListener("input", () => {
      this.audioElems.forEach((audio) => {
        audio.playbackRate = this.playbackSpeedSlider.value;
      });
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
        this.updateImage(this.currentTime);
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

    // 音ファイルを読み込む
    try {
      for (let i = 0; i < audios.length; i++) {
        const audio = new Audio(audios[i].url);
        audio.load();
        audio.addEventListener("canplaythrough", () => {
          loadedAudioCount++;
          loadingMessage.textContent = `音ファイルを読み込み中 (${loadedAudioCount} / ${audios.length})`;
          if (loadedAudioCount == audios.length) {
            // 全ての音声ファイルの読み込みが完了したら、loadingMessageを削除してUIを有効化
            document.body.removeChild(loadingMessage);
            this.playPauseButton.disabled = false;
            this.seekBar.disabled = false;
          }
        });
        this.audioElems.push(audio);
        
        const gainNode = this.audioContext.createGain();
        gainNode.connect(this.audioContext.destination);
        this.gainNodes.push(gainNode);

        const tableBody = document.getElementById("volumeControls");
        tableBody.appendChild(this.createVolumeControls(gainNode, i));
        
        audio.addEventListener("loadedmetadata", () => {
          const source = this.audioContext.createMediaElementSource(audio);
          source.connect(gainNode);
          
          if (i == 0) {
            // 最初の音データの長さを基準の長さとする
            this.duration = audio.duration;
            // seekBar の最大値を設定
            this.seekBar.max = this.duration;
            // maxTime を更新
            this.maxTimeElem.innerText = this.formatTime(this.duration);

            // 再生終了時にループ
            audio.addEventListener("ended", () => this.handlePlaybackEnd());
          }
        }, {once: true});
      }
    } catch (error) {
      // エラーが発生した場合にエラーメッセージを表示する
      const errorMessage = document.createElement("p");
      errorMessage.textContent = "ファイルの読み込みに失敗しました: " + error.toString();
      document.body.insertBefore(errorMessage, loadingMessage);
    }
  }

  createVolumeControls(gainNode, index) {
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
    }
  }

  playAudio() {
    if (this.audioElems[0].ended) {
      this.currentTime = 0;
    }
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.audioContext.resume();

      let playPromises = this.audioElems.map((audio) => {
        return new Promise((resolve) => {
          audio.currentTime = this.currentTime;
          audio.oncanplaythrough = () => {
            resolve();
          };
        });
      });

      Promise.all(playPromises).then(() => {
        this.audioElems.forEach((audio) => {
          audio.play();
        });

        this.updateDisplayLoop = this.createAnimationFrameLoop(() => this.updateDisplay());
      });
    }
  }

  stopAudio() {
    this.isPlaying = false;

    this.audioElems.forEach((audio) => {
      audio.pause();
    });

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
    this.currentTime = time;
    if (shouldPlay) {
      this.playAudio();
    }
  }

  handlePlaybackEnd() {
    this.stopAudio();
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
    this.currentTime = this.audioElems[0].currentTime;
    this.seekBar.value = this.currentTime;
    this.currentTimeElem.innerText = this.formatTime(this.currentTime);
    if (this.hasImage) {
      this.updateImage(this.currentTime);
    }
  }

  updateImage(time) {
    let playbackTime = (time - (typeof timeOffset == "undefined" ? 0 : timeOffset)) * 1000; // ミリ秒単位に変換
    if (playbackTime < 0) {
      playbackTime = 0;
    }
    const maxTime = (this.duration - (typeof timeOffset == "undefined" ? 0 : timeOffset)) * 1000;

    const currentElid = this.spos.events.findIndex(event => event.position > playbackTime) - 1;
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

    const x = currentX + (nextX - currentX) * (playbackTime - currentPosition) / (nextPosition - currentPosition);
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
    this.updateDisplay();
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
  const version = "3.1.0";
  const versionElement = document.createElement("a");
  versionElement.id = "version";
  versionElement.href = "/ototori/changelog";
  versionElement.innerText = "v" + version;
  document.body.appendChild(versionElement);
}
