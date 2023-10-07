fetch("./list.json")
  .then(response => response.json())
  .then(data => generateIndex(data))
  .catch(error => console.error("Error fetching JSON:", error));

function generateIndex(data) {
  const listArea = document.getElementById("listArea");

  data.forEach(categoryData => {      
    const categoryElement = document.createElement("h2");
    categoryElement.textContent = categoryData.category;
    listArea.appendChild(categoryElement);

    const listElement = document.createElement("md-list");
    listArea.appendChild(listElement);

    categoryData.songs.forEach(async songData => {
      const listItemElement = document.createElement("md-list-item");
      
      const headlineElement = document.createElement("div");
      headlineElement.slot = "headline";
      headlineElement.textContent = songData.name;
      listItemElement.appendChild(headlineElement);

      const supportingTextElement = document.createElement("div");
      supportingTextElement.slot = "supporting-text";
      supportingTextElement.textContent = songData.type;
      listItemElement.appendChild(supportingTextElement);

      if (songData.url) {
        if (songData.version) {
          const alphabetSongName = songData.url.match(/\.\/(.*?)\//)[1];
          listItemElement.id = alphabetSongName;
          listItemElement.type = "button";
          const downloadStateIcon = document.createElement("md-icon");
          downloadStateIcon.slot = "end";
          
          switch (await checkCacheState(alphabetSongName, songData.version)) {
            case "latest":
              downloadStateIcon.textContent = "download_done";
              break;
            case "needsUpdate":
              downloadStateIcon.textContent = "refresh";
              break;
            case "notCached":
              downloadStateIcon.textContent = "download";
              break;
          }
          
          listItemElement.addEventListener("click", handleListItemClick);

          function handleListItemClick() {
            downloadStateIcon.remove();
            const progressCircle = document.createElement("md-circular-progress");
            progressCircle.indeterminate = true;
            progressCircle.slot = "end";
            listItemElement.appendChild(progressCircle);

            fetch("./files.php", {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded"
              },
              body: "song=" + alphabetSongName
            })
              .then(response => response.json())
              .then(async urls => {
                progressCircle.remove();
                listItemElement.appendChild(downloadStateIcon);

                if (await areUrlsInCache(urls)) {
                  if (await checkCacheState(alphabetSongName, songData.version) == "latest") {
                    location.href = songData.url;
                    return;
                  } else {
                    updateSongName.textContent = songData.name;
                    updateSongData = {
                      name: songData.name,
                      alphabetSongName: alphabetSongName,
                      downloadKey: alphabetSongName + "-v" + songData.version,
                      url: songData.url,
                      cacheUrls: urls
                    };
                    updateDialog.show();
                  }
                } else {
                  const keys = await caches.keys();
                  const cachedKey = keys.find((key) => key.match(alphabetSongName));
                  caches.delete(cachedKey);
                  
                  downloadSongName.textContent = songData.name;
                  downloadSongData = {
                    name: songData.name,
                    alphabetSongName: alphabetSongName,
                    downloadKey: alphabetSongName + "-v" + songData.version,
                    url: songData.url,
                    cacheUrls: urls
                  };
                  downloadStateIcon.textContent = "download";
                  downloadDialog.show();
                }
              })
              .catch(async () => {
                progressCircle.remove();
                listItemElement.appendChild(downloadStateIcon);
                if (await checkCacheState(alphabetSongName, songData.version) == "notCached") {
                  errorDialog.show();
                  return;
                } else {
                  location.href = songData.url;
                  return;
                }
              });
          }

          listItemElement.appendChild(downloadStateIcon);
        } else {
          listItemElement.type = "link";
          listItemElement.href = songData.url;
          
          const icon = document.createElement("md-icon");
          icon.slot = "end";
          icon.textContent = "arrow_forward";
          listItemElement.appendChild(icon);
        }
      }
      listElement.appendChild(listItemElement);
    });
  });
}

async function checkCacheState(alphabetSongName, version) {
  const currentKey = alphabetSongName + "-v" + version;
  const keys = await caches.keys();
  const cachedKey = keys.find((key) => key.match(alphabetSongName));
  if (cachedKey) {
    if (cachedKey == currentKey) {
      return "latest";
    } else {
      return "needsUpdate";
    }
  } else {
    return "notCached";
  }
}

async function areUrlsInCache(urls) {
  return (await Promise.all(urls.map(url => caches.match(url)))).every(response => response);
}

// ダイアログ
const downloadDialog = document.getElementById("downloadDialog");
const updateDialog = document.getElementById("updateDialog");
const errorDialog = document.getElementById("errorDialog");

const downloadButton = document.getElementById("downloadButton");
const updateButton = document.getElementById("updateButton");
const notUpdateButton = document.getElementById("notUpdateButton");

const downloadSongName = document.getElementById("downloadSongName");
const updateSongName = document.getElementById("updateSongName");

let downloadSongData = {};
let updateSongData = {};

downloadButton.addEventListener("click", () => {
  downloadSong(downloadSongData);
});

updateButton.addEventListener("click", () => {
  downloadSong(updateSongData, true);
});

notUpdateButton.addEventListener("click", () => {
  location.href = updateSongData.url;
});

async function downloadSong(downloadSongData, isUpdate = false) {
  if (isUpdate) {
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => {
          return key.split("-")[0] == downloadSongData.alphabetSongName && key != downloadSongData.downloadKey;
        }).map((key) => {
          return caches.delete(key);
        })
      );
    });
  }

  const songListItem = document.getElementById(downloadSongData.alphabetSongName);
  const songListIcon = songListItem.querySelector("md-icon");
  songListIcon.remove();

  const progressCircle = document.createElement("md-circular-progress");
  progressCircle.indeterminate = true;
  progressCircle.slot = "end";
  songListItem.appendChild(progressCircle);

  try {
    const cache = await caches.open(downloadSongData.downloadKey);
    await cache.addAll(downloadSongData.cacheUrls);
    songListIcon.textContent = "download_done";
  } catch {
    caches.delete(downloadSongData.downloadKey);
    errorDialog.show();
  }
  
  progressCircle.remove();
  songListItem.appendChild(songListIcon);
}