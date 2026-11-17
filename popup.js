(() => {
  "use strict";
  const toggle = document.getElementById("enabled");
  const status = document.getElementById("status");
  const languageSelect = document.getElementById("language");
  const messages = {
    "zh-TW": {
      title: "Shorts 播完就停", label: "播完自動停止", language: "語言 / Language",
      on: "已開啟：Shorts 播完後停止，可手動重播。",
      off: "已關閉：恢復 YouTube 自動重播。",
      hint: "套用至所有 YouTube 分頁，並記住你的選擇。",
      loading: "讀取設定中…", readError: "無法讀取設定，請關閉此視窗後重試。",
      writeError: "設定未儲存，請再試一次。"
    },
    en: {
      title: "YouTube Shorts No Loop", label: "Stop after playback", language: "Language / 語言",
      on: "On: Shorts stop at the end. Click to replay.",
      off: "Off: YouTube automatically replays Shorts.",
      hint: "Applies to all YouTube tabs. Your preferences are saved.",
      loading: "Loading settings…", readError: "Could not load settings. Close this popup and try again.",
      writeError: "Settings were not saved. Please try again."
    }
  };
  let saved = true;
  let language = "zh-TW";
  let statusKey = "loading";
  const render = () => {
    const text = messages[language];
    document.documentElement.lang = language === "en" ? "en" : "zh-Hant";
    document.title = text.title;
    document.getElementById("heading").textContent = text.title;
    document.getElementById("enabled-label").textContent = text.label;
    document.getElementById("language-label").textContent = text.language;
    document.getElementById("hint").textContent = text.hint;
    toggle.checked = saved;
    languageSelect.value = language;
    status.textContent = text[statusKey];
  };
  const setBusy = (busy) => {
    toggle.disabled = busy;
    languageSelect.disabled = busy;
  };

  chrome.storage.local.get({ enabled: true, language: "zh-TW" }).then((settings) => {
    saved = settings.enabled !== false;
    language = settings.language === "en" ? "en" : "zh-TW";
    statusKey = saved ? "on" : "off";
    render();
    setBusy(false);
  }).catch(() => {
    statusKey = "readError";
    render();
  });

  async function save(key, value) {
    setBusy(true);
    try {
      await chrome.storage.local.set({ [key]: value });
      if (key === "enabled") saved = value;
      else language = value;
      statusKey = saved ? "on" : "off";
    } catch {
      statusKey = "writeError";
    } finally {
      render();
      setBusy(false);
    }
  }
  toggle.addEventListener("change", () => save("enabled", toggle.checked));
  languageSelect.addEventListener("change", () => save("language", languageSelect.value === "en" ? "en" : "zh-TW"));
})();
