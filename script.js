const playButton = document.getElementById("playButton");
const stopButton = document.getElementById("stopButton");
const currentTime = document.getElementById("currentTime");
const totalTime = document.getElementById("totalTime");
const seekBar = document.getElementById("seekBar");
var video = document.querySelector("video") || document.createElement("video"); // const だとなぜか Safari でうまく動かない

// iOS Safari 対策
video.setAttribute("muted", "");
video.setAttribute("playsinline", "");
video.load();

var audioContext = new AudioContext(); // const だとなぜか Safari でうまく動かない
var gainNodes = []; // const だとなぜか Safari でうまく動かない
var audioBuffers = []; // const だとなぜか Safari でうまく動かない
var audioSources = []; // let だとなぜか Safari でうまく動かない

let isPlaying = false;
let startTime = 0;
var playPos = 0; // let だとなぜか Safari でうまく動かない

let setCurrentTime;

var loadedAudioCount = 0; // let だとなぜか Safari でうまく動かない

async function fetchAudio(url) {
const response = await fetch(url);
const arrayBuffer = await response.arrayBuffer();
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

loadingMessage.innerText = `音ファイルを読み込み中 (${++loadedAudioCount} / ${audioUrls.length})`;

return audioBuffer;
}

var loadingMessage = document.createElement("p"); // const だとなぜか Safari でうまく動かない
loadingMessage.textContent = `音ファイルを読み込み中 (0 / ${audioUrls.length})`;
document.body.appendChild(loadingMessage);
Promise.all(audioUrls.map(fetchAudio))
.then(buffers => {
  seekBar.max = buffers[0].duration;
  totalTime.innerText = formatTime(buffers[0].duration);
  buffers.forEach((buffer, index) => {
    const gainNode = audioContext.createGain();
    gainNodes.push(gainNode);

    const tableBody = document.getElementById("volumeControls");

    const fileNameCell = document.createElement("td");
    fileNameCell.textContent = audioUrls[index].split("/").pop().split(".")[0];;
    const row = document.createElement("tr");
    row.appendChild(fileNameCell);

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
    row.appendChild(volumeCell);

    tableBody.appendChild(row);

    audioBuffers.push(buffer);
  });
})
.then(() => {
  document.body.removeChild(loadingMessage);
})
.catch(error => {
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

function formatTime(sec) {
return Math.floor(sec / 60) + ":" + String(Math.floor(sec % 60)).padStart(2, "0")
}

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

video.addEventListener("play", (e) => {
if (Math.abs(video.currentTime - seekBar.value) > 0.1) {
  video.currentTime = seekBar.value;
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