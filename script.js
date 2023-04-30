playing = false;

timebar = document.querySelector("input[name=time]");
curtime = document.querySelector(".current-time");
tottime = document.querySelector(".total-time");
firstaudio = document.querySelector("audio");

setInterval(() => {
  timebar.max = firstaudio.duration;
  tottime.innerText = formatTime(firstaudio.duration);
  if (document.activeElement != timebar) {
    timebar.value = firstaudio.currentTime;
    curtime.innerText = formatTime(firstaudio.currentTime);
  }
}, 200);

function formatTime(sec) {
  return Math.floor(sec / 60) + ":" + String(Math.floor(sec % 60)).padStart(2, "0")
}

timebar.oninput = () => {
  curtime.innerText = formatTime(timebar.value);
}

timebar.onchange = () => {
  if (playing) {
    pause();
    playing = true;
  }
  document.querySelectorAll("audio").forEach((e) => {
    e.currentTime = timebar.value;
  });
  timebar.blur();
  if (playing) {
    play();
  }
}

function waitForLoad() {
  return new Promise(resolve => {
    const checkIfReady = () => {
      readyStateSum = 0;
      document.querySelectorAll("audio").forEach((e) => {
        readyStateSum += e.readyState;
      });
      if (readyStateSum == document.querySelectorAll("audio").length * 4) {
        resolve();
      } else {
        setTimeout(checkIfReady, 200);
      }
    };
    checkIfReady();
  });
}

// 音声データのロード
document.querySelectorAll("audio").forEach((e) => {
  e.load();
});

function play() {
  waitForLoad().then(() => {
    playing = true;
    document.querySelectorAll("audio").forEach((e) => {
      e.currentTime = timebar.value;
      e.play();
    });
  });
}

function pause() {
  playing = false;
  document.querySelectorAll("audio").forEach((e) => {
    e.pause();
  });
}