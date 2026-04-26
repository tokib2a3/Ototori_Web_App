class Player {
  constructor(playerAreaId) {
    this.playerArea = document.getElementById(playerAreaId);

    this.baseDirPath = typeof baseDirPath != "undefined" ? baseDirPath : "/files/" + location.pathname.split("/").slice(2, -1).join("/");
    this.audioDirPath = this.baseDirPath + (typeof audioDirPath != "undefined" ? audioDirPath : "/audio");
    this.scoreDirPath = this.baseDirPath + (typeof scoreDirPath != "undefined" ? scoreDirPath : "/score");

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
    this.showMixerUnderPlayer = typeof showMixerUnderPlayer != "undefined" ? showMixerUnderPlayer : !this.hasImage;
    this.imageUrls = [];
    this.spos = {};
    this.imgElem = null;
    this.mixerControls = [];

    const urlParams = new URLSearchParams(window.location.search);
    const mixParam = urlParams.get("mix");
    this.initialMix = {};
    if (mixParam) {
      mixParam.split(",").forEach(part => {
        const [name, p, v] = part.split(":");
        if (name) {
          this.initialMix[name] = {
            play: p == "1",
            volume: v != null ? parseInt(v) : null
          };
        }
      });
    }

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
    this.playerScreen = document.getElementById("playerScreen");
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
    if (!this.hasImage) {
    	this.fullscreenButton.remove();
    }
    this.mixerDialog = document.getElementById("mixerDialog");
    this.playbackSpeedDialog = document.getElementById("playbackSpeedDialog");
    this.playbackSpeedSlider = document.getElementById("playbackSpeedSlider");
    this.bottomMixerArea = document.getElementById("bottomMixerArea");

    if (this.showMixerUnderPlayer) {
      this.bottomMixerArea.style.display = "block";
    }
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

      let shouldPlay = false;
      if (this.isPlaying) {
        this.stopAudio();
        shouldPlay = true;
      }
      this.seekAudio(Number(this.seekBar.value));
      if (shouldPlay) {
        this.playAudio();
      }
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
      this.toggleFullScreen(this.playerScreen);
    });

    document.addEventListener("fullscreenchange", () => {
      this.fullscreenButton.selected = document.fullscreenElement == this.playerScreen;
    });

    // カーソル移動でコントローラー表示・非表示
    this.playerScreen.addEventListener("mousemove", () => this.handleUserActivity());
    this.playerScreen.addEventListener("keydown", () => this.handleUserActivity());
    this.playerScreen.addEventListener("click", () => this.handleUserActivity());

    document.addEventListener("visibilitychange", () => this.handleVisibilityChange());

    // 画面リサイズ時にカーソルを再配置
    if (this.hasImage) {
      window.addEventListener("resize", () => {
        this.updateImage(this.currentTime);
      });
    }
  }

// メソッドの前に async を付けるのを忘れないでください
  async setupAudio() {
    let downloadedCount = 0;
    let loadedAudioCount = 0;

    // 読み込み中メッセージの生成とDOMへの追加
    const loadingMessage = document.createElement("p");
    loadingMessage.textContent = `音ファイルを準備中 (0 / ${audios.length})`;
    document.body.appendChild(loadingMessage);

    try {
      // 全ての音声ファイルをダウンロード
      const fetchPromises = audios.map(async (audioData) => {
        const audioSrc = this.audioDirPath + "/" + audioData.fileName;
        const response = await fetch(audioSrc, { priority: "high" });
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const blob = await response.blob();

        // ダウンロード完了ごとにカウントアップしてUI更新
        downloadedCount++;
        if (loadingMessage.parentNode) {
          loadingMessage.textContent = `音ファイルを準備中 (${downloadedCount} / ${audios.length})`;
        }

        // メモリ上のBlobをURL化して返す
        return URL.createObjectURL(blob);
      });

      // 全てのダウンロードが完了するまで待機
      const objectUrls = await Promise.all(fetchPromises);

      // Audio要素とミキサーをセットアップ
      const dialogTableBody = document.getElementById("dialogVolumeControls");
      const bottomTableBody = document.getElementById("bottomVolumeControls");

      for (let i = 0; i < audios.length; i++) {
        // サーバーURLの代わりに、メモリ上のBlob URLを読み込む
        const audio = new Audio(objectUrls[i]);

        audio.addEventListener("error", (e) => {
          const errorMessage = document.createElement("p");
          errorMessage.textContent = "音データの展開に失敗しました";
          document.body.insertBefore(errorMessage, loadingMessage);
        });

        this.audioElems.push(audio);

        const gainNode = this.audioContext.createGain();
        gainNode.connect(this.audioContext.destination);
        this.gainNodes.push(gainNode);

        const controls = this.createVolumeControls(gainNode, i);
        dialogTableBody.appendChild(controls.dialogRow);
        bottomTableBody.appendChild(controls.bottomRow);

        audio.addEventListener("loadedmetadata", () => {
          loadedAudioCount++;
          loadingMessage.textContent = `音ファイルを展開中 (${loadedAudioCount} / ${audios.length})`;
          if (loadedAudioCount == audios.length) {
            // 全ての音声ファイルの読み込みが完了したら、loadingMessageを削除してUIを有効化
            document.body.removeChild(loadingMessage);
            this.playPauseButton.disabled = false;
            this.seekBar.disabled = false;
          }

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

        audio.load();
      }
    } catch (error) {
      // エラーが発生した場合にエラーメッセージを表示する
      const errorMessage = document.createElement("p");
      errorMessage.textContent = "音データの取得に失敗しました: " + error.toString();
      document.body.insertBefore(errorMessage, loadingMessage);
    }
  }

  createVolumeControls(gainNode, index) {
    let rawName = audios[index].fileName;
    let fileNameWithExt = rawName.substring(rawName.lastIndexOf("/") + 1);
    let dotIndex = fileNameWithExt.lastIndexOf(".");
    const fileName = dotIndex != -1 ? fileNameWithExt.substring(0, dotIndex) : fileNameWithExt;
    const mixState = this.initialMix ? this.initialMix[fileName] : null;

    let initialPlay = audios[index].initialPlay ?? true;
    if (mixState && mixState.play != undefined) {
      initialPlay = mixState.play;
    }
    let initialVolume = audios[index].initialVolume ?? 80;
    if (mixState && mixState.volume != undefined && mixState.volume != null) {
      initialVolume = mixState.volume;
    }

    const createRow = () => {
      const fileNameCell = document.createElement("td");
      fileNameCell.textContent = fileName;

      const switchCell = document.createElement("td");
      const playSwitch = document.createElement("md-switch");
      playSwitch.selected = initialPlay;
      switchCell.appendChild(playSwitch);

      const volumeCell = document.createElement("td");
      const volumeSlider = document.createElement("md-slider");
      volumeSlider.disabled = !playSwitch.selected;
      volumeSlider.labeled = true;
      volumeSlider.max = 127;
      volumeSlider.value = initialVolume;
      volumeCell.appendChild(volumeSlider);

      const row = document.createElement("tr");
      row.appendChild(fileNameCell);
      row.appendChild(switchCell);
      row.appendChild(volumeCell);

      return { row, playSwitch, volumeSlider };
    };

    const dialogControls = createRow();
    const bottomControls = createRow();

    gainNode.gain.value = dialogControls.playSwitch.selected ? dialogControls.volumeSlider.value / 100 : 0;

    const setPlayState = (isPlaying) => {
      [dialogControls, bottomControls].forEach((controls) => {
        controls.playSwitch.selected = isPlaying;
        controls.volumeSlider.disabled = !isPlaying;
        // Shadow DOM 内の input 要素のプロパティを直接操作して同期ずれに対処
        if (controls.playSwitch.shadowRoot) {
          const input = controls.playSwitch.shadowRoot.querySelector("input");
          if (input) {
            input.checked = isPlaying;
          }
        }
      });
      gainNode.gain.value = isPlaying ? dialogControls.volumeSlider.value / 100 : 0;
    };

    const setVolume = (volume) => {
      dialogControls.volumeSlider.value = volume;
      bottomControls.volumeSlider.value = volume;
      if (dialogControls.playSwitch.selected) {
        gainNode.gain.value = volume / 100;
      }
    };

    dialogControls.playSwitch.addEventListener("change", (event) => {
      setPlayState(event.target.selected);
      this.updateMixerUrlParams();
    });
    bottomControls.playSwitch.addEventListener("change", (event) => {
      setPlayState(event.target.selected);
      this.updateMixerUrlParams();
    });

    dialogControls.volumeSlider.addEventListener("input", (event) => {
      setVolume(event.target.value);
      this.updateMixerUrlParams();
    });
    bottomControls.volumeSlider.addEventListener("input", (event) => {
      setVolume(event.target.value);
      this.updateMixerUrlParams();
    });

    this.mixerControls.push({
      playSwitch: dialogControls.playSwitch,
      volumeSlider: dialogControls.volumeSlider
    });

    return { dialogRow: dialogControls.row, bottomRow: bottomControls.row };
  }

  updateMixerUrlParams() {
    const changed = [];
    for (let i = 0; i < this.mixerControls.length; i++) {
      const c = this.mixerControls[i];
      const audioDef = audios[i];
      let rawName = audioDef.fileName;
      let fileNameWithExt = rawName.substring(rawName.lastIndexOf("/") + 1);
      let dotIndex = fileNameWithExt.lastIndexOf(".");
      const fileName = dotIndex != -1 ? fileNameWithExt.substring(0, dotIndex) : fileNameWithExt;
      const defaultPlay = audioDef.initialPlay ?? true;
      const defaultVol = audioDef.initialVolume ?? 80;

      const playChanged = c.playSwitch.selected != defaultPlay;
      const volChanged = String(c.volumeSlider.value) != String(defaultVol);

      if (playChanged || volChanged) {
        changed.push(`${fileName}:${c.playSwitch.selected ? "1" : "0"}:${c.volumeSlider.value}`);
      }
    }

    const urlParams = new URLSearchParams(window.location.search);

    if (changed.length > 0) {
      urlParams.set("mix", changed.join(","));
    } else {
      urlParams.delete("mix");
    }

    let newUrl = window.location.pathname;
    const queryString = urlParams.toString().replace(/%3A/g, ':').replace(/%2C/g, ',');
    if (queryString) {
      newUrl += `?${queryString}`;
    }

    window.history.replaceState({}, "", newUrl);
  }

async setupImage() {
    const imageArea = document.getElementById("imageArea");
    this.imgElem = document.createElement("img");
    this.imgElem.oncontextmenu = () => { return false; };
    this.imgElem.onselectstart = () => { return false; };
    this.imgElem.onmousedown = () => { return false; };
    imageArea.appendChild(this.imgElem);

    try {
      // 画像の Blob 化と URL 生成
      const fetchPromises = [];
      this.imageUrls = new Array(imageCount);
      for (let i = 1; i <= imageCount; i++) {
        const url = this.scoreDirPath + `/score-${i}.svg`;

        // 最初の2ページ分は優先度高く設定
        const fetchOptions = i <= 2 ? { priority: "high" } : { priority: "low" };
        const promise = fetch(url, fetchOptions).then(async (response) => {
          if (!response.ok) throw new Error("Image fetch failed");
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          this.imageUrls[i - 1] = objectUrl;
          // 最初の画像が取得できたらすぐに表示する
          if (i === 1) {
            this.imgElem.src = objectUrl;
          }
          return objectUrl;
        });
        fetchPromises.push(promise);
      }

      // spos データの読み込みを非同期で開始
      const sposPromise = (async () => {
        const xmlUrl = this.scoreDirPath + "/spos.xml";
        const xmlResponse = await fetch(xmlUrl, { priority: "high" });
        if (!xmlResponse.ok) {
          throw new Error("XML fetch failed");
        }

        const xmlText = await xmlResponse.text();
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
      })();

      // 全ての画像と spos データの準備が完了するのを待つ
      await Promise.all([...fetchPromises, sposPromise]);

    } catch (error) {
      console.error("楽譜データの準備に失敗しました:", error);
    }
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

      this.seekAudio(this.currentTime).then(() => {
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
    this.currentTime = time;
    let playPromises = this.audioElems.map((audio) => {
      return new Promise((resolve) => {
        audio.onseeked = () => {
          resolve();
        };
        audio.currentTime = this.currentTime;
        setTimeout(resolve, 1000);
      });
    });
    return Promise.all(playPromises);
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

    if (new URL(this.imgElem.src, location.href).href != new URL(this.imageUrls[currentPage], location.href).href) {
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
  const version = "3.2.2";
  const versionElement = document.createElement("a");
  versionElement.id = "version";
  versionElement.href = "/ototori/changelog";
  versionElement.innerText = "v" + version;
  document.body.appendChild(versionElement);
}
