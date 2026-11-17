# Shorts 播完就停

[English](README.md) | 繁體中文

Chrome 擴充功能。YouTube Shorts 播完後停止自動重播；點影片畫面，或按影片正中央的「↻ 重新播放」，都可以從頭再看一次。往下滑切換另一支 Shorts，仍可正常播放。一般 YouTube 影片不套用此功能。

## 安裝

1. 在 Chrome 網址列輸入 `chrome://extensions`。
2. 開啟右上角「開發人員模式」。
3. 按「載入未封裝項目」。
4. 選擇解壓縮或下載後的套件資料夾（裡面有 `manifest.json`）。
5. 重新整理已開啟的 YouTube 分頁，開一支 Shorts 試用。

不需要 npm、編譯或付費服務。點 Chrome 工具列的本套件圖示，可切換「播完自動停止」。

## 開關

- 預設開啟：Shorts 播完後停止，可點影片或中央按鈕重新播放。
- 關閉：恢復 YouTube 原本的自動重播；已被本套件停住的影片會立即從頭播放。自己手動暫停的影片仍維持暫停。
- 開關即時套用至同一瀏覽器設定檔中的 YouTube 分頁，不用重新整理，並在下次開啟瀏覽器時保留。
- 若工具列沒有圖示，可從 Chrome 的拼圖圖示找到「Shorts 播完就停」，也可以將它固定在工具列。
- 僅使用 `storage` 權限在本機保存 `enabled` 開關值，不同步到雲端，也不保存影片、帳號或瀏覽紀錄。一般 YouTube 影片不受開關影響。

從 GitHub 下載：儲存庫頁面按 **Code → Download ZIP**，解壓縮後依上面的步驟載入資料夾。

## 更新已安裝的版本

更新同一資料夾內的檔案後，到 `chrome://extensions` 找到「Shorts 播完就停」，按重新載入，再重新整理 YouTube 分頁。

## 行為與限制

- 使用 Chrome Manifest V3；只在桌面版 YouTube 網站載入。
- 注入範圍包含 YouTube 首頁，以支援從首頁點進 Shorts 的站內導覽。程式只處理 `/shorts/…` 頁面中的 Shorts 播放器。
- 移除影片的原生循環播放，並在 `ended` 事件後阻擋播放器自動重啟。播完後可點影片畫面，或使用套件的「重新播放」按鈕。播放中的點擊仍使用 YouTube 原本的暫停／繼續操作。
- 不蒐集瀏覽紀錄、不傳送資料；僅使用 Chrome `storage` 權限保存本機開關設定。
- 1.0.0 已由使用者回報在真實 YouTube 頁面運作正常。1.0.1 已完成真實瀏覽器與一支公開 YouTube Shorts 的未登入測試，範圍與證據見下方安全檢查報告。YouTube 播放器結構改變時可能需要調整。

## 驗證

安裝 Node.js 22 或更新版本，在此資料夾執行：

```sh
npm test
node --check content.js
```

測試涵蓋播放結束、手動重播、一般影片、切換 Shorts，以及舊播放請求延遲失敗的競態。這是模擬 DOM 的回歸測試，不能取代真實網站測試。

Chrome 手動驗收：

1. 直接開 Shorts，完整播完，確認不自動重播。
2. 等待數秒，再點影片畫面，確認從頭播放，且再次播完後仍會停止；另測試「重新播放」按鈕。
3. 向下、向上切換影片，確認新影片可以正常播放。
4. 從首頁點進 Shorts，再用上一頁離開；確認一般影片仍正常。
5. 播放中暫停、恢復、拖曳進度，確認不會提早停止。
6. 播完後按「重新播放」並立刻切換下一支或離開 Shorts，確認新影片正常播放，且舊按鈕不會重新出現。
7. 在擴充功能圖示內關閉「播完自動停止」，確認恢復自動重播；重新整理分頁後仍保持關閉，再開啟後恢復播完停止。
8. 手動暫停播放中的影片後關閉開關，確認不會自行播放；在其他 YouTube 分頁確認開關同步生效。

參考：[Chrome content scripts 官方文件](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)。

## 安全檢查與證據

- [檢查流程與重跑方式](SECURITY.md)
- [可追溯檢查表](security/CHECKLIST.md)
- [2026-11-17 開關功能驗證與限制](security/ASSESSMENT-2026-11-17.md)
- [2026-10-21 檢查報告與發現重現步驟](security/ASSESSMENT-2026-10-21.md)
- [原始瀏覽器結果、截圖及 SHA-256](security/evidence/2026-10-21-verified/)

一般安裝不需要 Node.js 或 Playwright。`package.json` 與 `package-lock.json` 僅供開發及測試使用；擴充功能執行時沒有第三方套件依賴。
