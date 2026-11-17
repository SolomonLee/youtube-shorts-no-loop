(() => {
  "use strict";
  const toggle = document.getElementById("enabled");
  const status = document.getElementById("status");
  let saved = true;
  const describe = () => {
    status.textContent = saved ? "已開啟：Shorts 播完後停止，可手動重播。" :
      "已關閉：恢復 YouTube 自動重播。";
  };

  chrome.storage.local.get({ enabled: true }).then((settings) => {
    saved = settings.enabled !== false;
    toggle.checked = saved;
    toggle.disabled = false;
    describe();
  }).catch(() => {
    status.textContent = "無法讀取設定，請關閉此視窗後重試。";
  });

  toggle.addEventListener("change", async () => {
    toggle.disabled = true;
    const value = toggle.checked;
    try {
      await chrome.storage.local.set({ enabled: value });
      saved = value;
      describe();
    } catch {
      toggle.checked = saved;
      status.textContent = "設定未儲存，請再試一次。";
    } finally {
      toggle.disabled = false;
    }
  });
})();
