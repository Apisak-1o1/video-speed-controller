const buttons = document.querySelectorAll("[data-speed]");
const currentSpeedElement =
  document.getElementById("currentSpeed");

const websiteElement =
  document.getElementById("website");

const resetButton =
  document.getElementById("reset");

const rescanButton =
  document.getElementById("rescan");

let activeTab = null;

let videoFrames = [];


// ======================================
// Active Tab
// ======================================

async function getActiveTab() {

  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tabs[0];
}


// ======================================
// UI
// ======================================

function enableControls(enabled) {

  buttons.forEach((button) => {
    button.disabled = !enabled;
  });

  resetButton.disabled = !enabled;
}


function showSearching() {

  websiteElement.textContent =
    "🔍 กำลังค้นหา Video ทุก Frame...";

  currentSpeedElement.textContent = "-";

  enableControls(false);
}


function showNoVideo() {

  websiteElement.textContent =
    "❌ ไม่พบ Video Player";

  currentSpeedElement.textContent = "-";

  enableControls(false);
}


function showVideo(hostname, count, speed) {

  websiteElement.textContent =
    `🎬 ${hostname} • ${count} video`;

  currentSpeedElement.textContent =
    `${speed}×`;

  enableControls(true);

  buttons.forEach((button) => {

    const buttonSpeed =
      Number(button.dataset.speed);

    button.classList.toggle(
      "active",
      buttonSpeed === speed
    );
  });
}


// ======================================
// Scan ทุก Frame
// ======================================

async function scanAllFrames() {

  videoFrames = [];

  let frames;

  try {

    frames = await chrome.webNavigation.getAllFrames({
      tabId: activeTab.id
    });

  } catch (error) {

    console.log(
      "getAllFrames failed:",
      error
    );

    // อย่างน้อยลอง main frame
    frames = [
      {
        frameId: 0
      }
    ];
  }


  for (const frame of frames) {

    try {

      const response =
        await chrome.tabs.sendMessage(
          activeTab.id,
          {
            action: "detectVideo"
          },
          {
            frameId: frame.frameId
          }
        );

      if (
        response &&
        response.success &&
        response.found
      ) {

        videoFrames.push({
          frameId: frame.frameId,
          count: response.count,
          hostname: response.hostname,
          speed: response.speed,
          url: response.frameUrl
        });

      }

    } catch (error) {

      // บาง frame อาจไม่มี content script
      // หรือเป็น frame ที่ browser ไม่อนุญาต
      console.log(
        `Frame ${frame.frameId} unavailable`
      );

    }
  }


  return videoFrames;
}


// ======================================
// Detect
// ======================================

async function detectVideo() {

  showSearching();

  const results =
    await scanAllFrames();


  if (results.length === 0) {

    showNoVideo();

    return;
  }


  const totalVideos =
    results.reduce(
      (total, frame) =>
        total + frame.count,
      0
    );


  // ใช้ speed จาก frame แรกที่เจอ
  const speed =
    results[0].speed || 1;

  const hostname =
    new URL(activeTab.url).hostname;


  showVideo(
    hostname,
    totalVideos,
    speed
  );


  console.log(
    "Video Frames:",
    results
  );
}


// ======================================
// เปลี่ยน Speed ทุก Frame ที่มี Video
// ======================================

async function setSpeed(speed) {

  if (videoFrames.length === 0) {
    return;
  }


  let totalVideos = 0;


  for (const frame of videoFrames) {

    try {

      const response =
        await chrome.tabs.sendMessage(
          activeTab.id,
          {
            action: "setSpeed",
            speed: speed
          },
          {
            frameId: frame.frameId
          }
        );


      if (
        response &&
        response.success
      ) {

        totalVideos +=
          response.count || 0;

      }

    } catch (error) {

      console.log(
        `Cannot control frame ${frame.frameId}`,
        error
      );

    }
  }


  const hostname =
    new URL(activeTab.url).hostname;


  showVideo(
    hostname,
    totalVideos,
    speed
  );
}


// ======================================
// Buttons
// ======================================

buttons.forEach((button) => {

  button.addEventListener(
    "click",
    () => {

      const speed =
        Number(button.dataset.speed);

      setSpeed(speed);

    }
  );

});


resetButton.addEventListener(
  "click",
  () => {
    setSpeed(1);
  }
);


rescanButton.addEventListener(
  "click",
  () => {

    setTimeout(() => {
      detectVideo();
    }, 300);

  }
);


// ======================================
// Start
// ======================================

(async () => {

  activeTab =
    await getActiveTab();


  if (!activeTab) {

    showNoVideo();

    return;
  }


  try {

    websiteElement.textContent =
      `🔍 กำลังสแกน ${new URL(activeTab.url).hostname}...`;

  } catch {

    showNoVideo();

    return;
  }


  await detectVideo();

})();