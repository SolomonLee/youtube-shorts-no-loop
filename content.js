(() => {
  "use strict";

  const states = new Map();
  let route = "";
  let queued = false;
  let replayButton;
  let replayFrame;
  let enabled = false;
  let settingsVersion = 0;
  let languageVersion = 0;
  let language = "zh-TW";
  const shortsPath = () => /^\/shorts\/[^/]+/.exec(location.pathname)?.[0] || "";
  const isShort = (video) => Boolean(shortsPath() && video.closest(
    "ytd-reel-video-renderer, ytd-shorts, #shorts-container"
  ));

  function hideReplay(video) {
    if (replayButton?.video === video) {
      cancelAnimationFrame(replayFrame);
      replayButton.remove();
      replayButton = undefined;
    }
  }

  function positionReplay() {
    if (!replayButton) return;
    const rect = replayButton.video.getBoundingClientRect();
    const left = `${rect.left + rect.width / 2}px`;
    const top = `${rect.top + rect.height / 2}px`;
    if (replayButton.style.left !== left) replayButton.style.left = left;
    if (replayButton.style.top !== top) replayButton.style.top = top;
    replayFrame = requestAnimationFrame(positionReplay);
  }

  function reset(video, state) {
    state.replayVersion++;
    state.stopped = false;
    state.source = video.currentSrc;
    hideReplay(video);
  }

  function disableLoop(video, state) {
    if (video.loop) {
      state.restoreLoop = true;
      video.loop = false;
    }
  }

  function replay(video, state) {
    if (!enabled || states.get(video) !== state || !isShort(video) || !video.isConnected) return;
    state.stopped = false;
    hideReplay(video);
    video.currentTime = 0;
    const replayVersion = ++state.replayVersion;
    const replayRoute = shortsPath();
    const replaySource = video.currentSrc;
    video.play().catch(() => {
      // Ignore failures belonging to a video or navigation that has since changed.
      if (states.get(video) !== state || state.replayVersion !== replayVersion ||
          !video.isConnected || !isShort(video) ||
          shortsPath() !== replayRoute || video.currentSrc !== replaySource) return;
      state.stopped = true;
      showReplay(video, state);
    });
  }

  function showReplay(video, state) {
    cancelAnimationFrame(replayFrame);
    replayButton?.remove();
    const button = document.createElement("button");
    button.className = "shorts-no-loop-replay";
    button.type = "button";
    button.video = video;
    button.addEventListener("click", () => replay(video, state));
    document.documentElement.append(button);
    replayButton = button;
    setLanguage(language);
    positionReplay();
  }

  function setLanguage(value) {
    language = value === "en" ? "en" : "zh-TW";
    if (!replayButton) return;
    replayButton.textContent = language === "en" ? "↻ Replay" : "↻ 重新播放";
    replayButton.title = language === "en" ? "Playback ended. Click to watch again." : "已播完，按一下再看一次";
    replayButton.lang = language === "en" ? "en" : "zh-Hant";
  }

  function attach(video) {
    if (states.has(video)) return;
    const state = { stopped: false, source: video.currentSrc, restoreLoop: video.loop, replayVersion: 0 };
    const handle = (event) => {
      // YouTube reuses video elements while navigating between Shorts.
      syncRoute();
      if (!enabled || !isShort(video)) return;
      if (event.type === "emptied" || state.source !== video.currentSrc) reset(video, state);
      disableLoop(video, state);
      if (event.type === "ended") {
        state.stopped = true;
        video.pause();
        showReplay(video, state);
      } else if (state.stopped && (event.type === "play" || event.type === "playing")) {
        // Also stop a restart requested by YouTube's own player code.
        video.pause();
      }
    };
    state.handle = handle;
    states.set(video, state);
    for (const type of ["ended", "play", "playing", "loadedmetadata", "emptied"]) {
      video.addEventListener(type, handle);
    }
    disableLoop(video, state);
  }

  function detach(video, state) {
    state.replayVersion++;
    for (const type of ["ended", "play", "playing", "loadedmetadata", "emptied"]) {
      video.removeEventListener(type, state.handle);
    }
    hideReplay(video);
    states.delete(video);
    if (state.restoreLoop) video.loop = true;
  }

  function syncRoute() {
    const next = shortsPath();
    if (next === route) return;
    route = next;
    for (const [video, state] of states) reset(video, state);
  }

  function sync() {
    queued = false;
    syncRoute();
    for (const [video, state] of states) {
      if (!enabled || !video.isConnected || !isShort(video)) detach(video, state);
      else disableLoop(video, state);
    }
    if (enabled && route) document.querySelectorAll("video").forEach((video) => {
      if (isShort(video)) attach(video);
    });
  }

  function scheduleSync() {
    if (queued) return;
    queued = true;
    queueMicrotask(sync);
  }

  function setEnabled(value) {
    const candidate = !value ? replayButton?.video : undefined;
    const resume = candidate && route === shortsPath() &&
      states.get(candidate)?.source === candidate.currentSrc ? candidate : undefined;
    enabled = value;
    sync();
    if (resume?.isConnected && isShort(resume)) {
      resume.currentTime = 0;
      resume.play().catch(() => {});
    }
  }

  document.addEventListener("click", (event) => {
    syncRoute();
    const video = replayButton?.video;
    const state = states.get(video);
    if (!state?.stopped || !video.isConnected || !isShort(video) ||
        state.source !== video.currentSrc || event.button !== 0) return;
    const target = event.target;
    // Keep links, menus, seek bars, and other player controls working normally.
    if (target.closest?.("button, a, input, select, textarea, [role='button'], [role='slider'], [contenteditable], .ytp-chrome-bottom")) return;
    const player = target.closest?.("video, .html5-video-player, #player-container, #player, ytd-player");
    if (!player?.contains(video)) return;
    // Consume the click before YouTube can toggle the freshly replayed video off.
    event.preventDefault();
    event.stopImmediatePropagation();
    replay(video, state);
  }, true);

  new MutationObserver(scheduleSync).observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["loop", "src", "is-active"]
  });
  document.addEventListener("yt-navigate-finish", scheduleSync);
  window.addEventListener("popstate", scheduleSync);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.language) {
      languageVersion++;
      setLanguage(changes.language.newValue);
    }
    if (changes.enabled) {
      settingsVersion++;
      setEnabled(changes.enabled.newValue !== false);
    }
  });
  const readVersion = settingsVersion;
  const readLanguageVersion = languageVersion;
  chrome.storage.local.get({ enabled: true, language: "zh-TW" }, (settings) => {
    const failed = chrome.runtime.lastError;
    if (readLanguageVersion === languageVersion) setLanguage(failed ? "zh-TW" : settings.language);
    // A newer toggle takes priority over a delayed initial read.
    if (readVersion === settingsVersion) setEnabled(Boolean(failed) || settings.enabled !== false);
  });
})();
