const PRESETS = [0.5, 1, 1.25, 1.5, 2];

let currentSpeed = 1;

const hostname = window.location.hostname;

function getSiteKey() {
  return `videoSpeed:${hostname}`;
}

function getVideos() {
  return Array.from(document.querySelectorAll("video"));
}

function setupVideo(video) {
  if (video.dataset.vscReady !== "true") {
    video.dataset.vscReady = "true";

    video.addEventListener("loadedmetadata", () => {
      forceSpeed(video);
    });

    video.addEventListener("play", () => {
      forceSpeed(video);
    });

    video.addEventListener("ratechange", () => {
      // JW Player หรือ Player อื่นอาจพยายามเปลี่ยนกลับ
      if (video.playbackRate !== currentSpeed) {
        setTimeout(() => {
          forceSpeed(video);
        }, 0);
      }
    });
  }

  forceSpeed(video);
}

function forceSpeed(video) {
  try {
    video.playbackRate = currentSpeed;
  } catch (error) {
    console.log("Cannot set playbackRate", error);
  }
}

function scanVideos() {
  const videos = getVideos();

  videos.forEach(setupVideo);

  return videos;
}

function applySpeed(speed) {
  currentSpeed = speed;

  const videos = scanVideos();

  videos.forEach((video) => {
    forceSpeed(video);
  });

  return videos.length;
}

async function loadSavedSpeed() {
  const key = getSiteKey();

  const result = await chrome.storage.local.get(key);

  if (typeof result[key] === "number") {
    currentSpeed = result[key];
  } else {
    currentSpeed = 1;
  }

  applySpeed(currentSpeed);
}

async function saveSpeed(speed) {
  const key = getSiteKey();

  await chrome.storage.local.set({
    [key]: speed
  });

  return applySpeed(speed);
}


// ======================================
// รับคำสั่งจาก Popup
// ======================================

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (message.action === "detectVideo") {

      const videos = scanVideos();

      sendResponse({
        success: true,
        found: videos.length > 0,
        count: videos.length,
        speed: currentSpeed,
        hostname: hostname,
        frameUrl: window.location.href
      });

      return true;
    }


    if (message.action === "getSpeed") {

      const videos = scanVideos();

      sendResponse({
        success: true,
        found: videos.length > 0,
        count: videos.length,
        speed: currentSpeed,
        hostname: hostname
      });

      return true;
    }


    if (message.action === "setSpeed") {

      const count = applySpeed(message.speed);

      // ถ้าต้องการจำค่าจาก frame นี้ด้วย
      saveSpeed(message.speed);

      sendResponse({
        success: true,
        speed: currentSpeed,
        count: count,
        hostname: hostname
      });

      return true;
    }
  }
);


// ======================================
// จับ Video ที่ถูกสร้างขึ้นทีหลัง
// ======================================

const observer = new MutationObserver(() => {
  scanVideos();
});

if (document.documentElement) {
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}


// ======================================
// Keyboard Shortcut
// ======================================

document.addEventListener("keydown", (event) => {

  if (!event.altKey) {
    return;
  }

  let newSpeed = currentSpeed;

  const index = PRESETS.indexOf(currentSpeed);

  if (event.key === "ArrowUp") {

    if (index < PRESETS.length - 1) {
      newSpeed = PRESETS[index + 1];
    }
  }

  if (event.key === "ArrowDown") {

    if (index > 0) {
      newSpeed = PRESETS[index - 1];
    }
  }

  if (event.key === "0") {
    newSpeed = 1;
  }

  if (newSpeed !== currentSpeed) {

    event.preventDefault();

    saveSpeed(newSpeed);
  }
});


// ======================================
// Start
// ======================================

loadSavedSpeed();
scanVideos();