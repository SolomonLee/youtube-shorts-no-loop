# 1.0.1 安全檢查紀錄

## 公開前隱私清理（2026-11-17）

已將保存的 `browser-report.json` 中瀏覽器執行檔的絕對路徑改為 `chrome.exe`，移除本機使用者目錄，並同步更新 `SHA256SUMS.json`。這是既有證據的隱私編輯，未重新執行當時的瀏覽器測試。後續收集器只記錄執行檔名稱。

## 範圍與結論

受測執行時版本：1.0.1，基準 commit `0e7059bbe38faede3305fac82f58d2b282c749c5`。實際執行時間、原始檔 SHA-256、測試工具 SHA-256 均見 [browser-report.json](evidence/2026-10-21-verified/browser-report.json)。本次補充測試與文件，未修改 `content.js`、`content.css` 或 `manifest.json`。

本次沒有發現可確認的資料外傳或權限提升漏洞。已取得：18 項功能／靜態回歸通過、7 項受控瀏覽器檢查／量測完成、1 項條件性功能風險重現，以及 1 支真實 YouTube Shorts 的未登入動態驗證。

「受控瀏覽器」指真實 Chromium 原生載入未修改套件，瀏覽器依 manifest 自動注入內容腳本；測試頁與自行產生的影片由 Playwright 攔截 HTTPS 請求並提供。不把受控頁面當作真實 YouTube，不把手動 dispatchEvent 當作自然影片結束。

## 環境

- Windows，Node.js 22.18.0，Playwright 1.62.1，Chromium／Chrome for Testing 148.0.7778.96，headless。
- 使用獨立設定檔，要求啟用 Chromium sandbox；未使用日常 Chrome 的帳號、cookie 或設定檔。
- 本次覆寫了 Playwright 的瀏覽器路徑，使用現有 148 版；與 Playwright 預設下載的瀏覽器版本不同。重跑結果應記錄實際版本，不把不同環境數據視為完全可比較。
- 受控頁面所有外部請求由路由處理，未知 origin 會中止；即使中止也記錄嘗試。真實 YouTube 測試沒有這個路由攔截。
- 網路只保存 origin、resource type、method 及可觀察的 initiator；不保存 cookie、header、body、帶簽章的媒體 URL 或原始 HAR。
- 原生結束證據：[BR-02 截圖](evidence/2026-10-21-verified/BR-02-native-ended.png)。
- 真實網站證據：[LIVE-01 截圖](evidence/2026-10-21-verified/LIVE-01-signed-out-youtube.png)。

## 發現 CI-01：原有測試工作流程的供應鏈強化

**分類：低風險強化建議；未證實可利用的漏洞。狀態：原有 test.yml 待改善。**

位置：`.github/workflows/test.yml` 的 checkout、setup-node 步驟。

重現／確認：

1. 開啟上述檔案，確認引用為 `actions/checkout@v4`、`actions/setup-node@v4`。
2. 確認 checkout 未明確設定 `persist-credentials: false`。
3. 執行 `npm run test:security:collect`，查看 `static-report.json` 中的 `ci.actions[].pinnedToCommit` 與 `persistCredentialsFalseExplicit`。本次兩個 action 的固定提交判斷均為 false。

實際結果：action 使用可移動標籤，checkout 保留預設憑證處理。建議結果：固定經確認的完整 SHA，且不保留不需要的 git 憑證。

影響前提：上游標籤／action 遭竄改，或測試階段執行了惡意程式。現有 `contents: read` 限制了 token 權限。本次沒有證據顯示上游已遭入侵、憑證已洩漏或儲存庫被修改。

證據：[static-report.json](evidence/2026-10-21-verified/static-report.json) 的 CI 欄位。此為設定重現，不是上游入侵的利用實驗。

新增的 `.github/workflows/security.yml` 已使用官方 action 完整 SHA、`persist-credentials: false` 與唯讀 token；不把它誤稱為已修正原有 test.yml。

參考：[GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)、[checkout v4 說明](https://github.com/actions/checkout/blob/v4/README.md)。

## 發現 PERF-01：不相關頁面變動會觸發全頁影片查詢

**分類：效能觀察；未證實可感知卡頓或拒絕服務。狀態：已量測，待有需要時優化。**

位置：`content.js` 的 `MutationObserver`、`scheduleSync()` 與 `sync()`。

重現：

1. 執行 `npm run test:security:browser`，查看 BR-07。
2. 測試在擴充功能的 isolated world 包裝 `document.querySelectorAll`，只計數 selector 為 `video` 的呼叫。
3. 在頁面的非播放器 `#sidebar` 上，透過 60 次 animation-frame callback 修改文字。
4. 比較查詢次數與 CDP Performance 計數，參見原始報告。

本次結果：60 批不相關 DOM 變動，觸發 **60 次**全頁影片查詢；注入工作負載約 **417.4 ms**；整個頁面 `ScriptDuration` 增量約 **0.002401 秒**。

這些數據包含測試注入及頁面執行，不是套件獨占 CPU 時間；沒有足夠證據宣稱會造成明顯卡頓。潛在影響取決於實際頁面大小、變動頻率與其他程式碼。可考慮過濾無關 mutation、縮小掃描範圍及排程合併，再以同一工作負載比較。

證據：[browser-report.json](evidence/2026-10-21-verified/browser-report.json) 的 BR-07。受控測試只證實工作觸發次數，不當作惡意網站攻擊成功。

## 發現 FUNC-01：隱藏影片的結束事件取代重播按鈕

**分類：條件性功能風險；沒有證實資安影響。狀態：受控瀏覽器可重現，真實 YouTube 時序未驗證。**

位置：`content.js` 的 `isShort()`、`ended` 處理及 `showReplay()`。

重現：

1. 執行 `npm run test:security:browser`，查看 BR-08。
2. 受控頁面同時保留可見影片 `#current` 與隱藏 renderer 內的 `#old`。
3. 對 `#current` 派發測試用 `ended`；從 isolated world 讀取按鈕的 `.video.id`，結果為 `current`。
4. 再對隱藏的 `#old` 派發測試用 `ended`；同一讀取結果變成 `old`。

預期：按鈕仍指向使用者目前看的影片。實際：隱藏影片的事件取代了按鈕目標。

前提與限制：本次事件由測試程式刻意派發，未證明 YouTube 會在切換後自然產生相同時序。沒有證明資料外傳、權限提升或任意程式碼執行。LIVE-01 的正常結尾測試沒有重現這個問題。修正前應先確認實際網站的活躍影片判準，避免新增相容性問題。

證據：[browser-report.json](evidence/2026-10-21-verified/browser-report.json) 的 BR-08、[截圖](evidence/2026-10-21-verified/BR-08-inactive-video.png)。截圖只顯示頁面與按鈕，真正的目標差異由 JSON 中 `buttonBefore`／`buttonAfter` 證明。測試以 `reproduced` 記錄，不計為安全控制通過。

## 已修正問題 REG-01：舊播放請求延遲失敗

1.0.1 的既有修正已由 BR-05 在原生擴充功能 context 中再驗證：刻意令 `play()` 延後 reject，切換路徑，再拒絕舊請求。新影片 `paused=false`、舊按鈕數量為 0。

這項使用 CDP 故障注入；影片與 DOM 為真實瀏覽器元件，但拒絕時序由測試控制。原有 7 項競態回歸亦通過。此項不列為 1.0.1 的未修漏洞。

## 真實 YouTube 測試 LIVE-01

本次在未登入的獨立瀏覽器中開啟 `https://www.youtube.com/shorts`，導向一支公開 Shorts。沒有攔截或替換該網站回應。測試以畫面中唯一可見、已備妥的 Shorts 影片為目標；若有多個候選、廣告、登入、CAPTCHA 或網路限制，應記錄受阻，不猜測或繞過。

影片長 **65.941 秒**。測試把進度移到結尾前約 0.8 秒，再等待原生 `ended`；事件 `isTrusted=true`，到達 **65.941 秒**後 `paused=true`，並出現套件的重新播放按鈕。觀察期間未發現 initiator 為套件腳本的網路請求。

來源網站自身有媒體、字型、廣告及遙測請求，摘要均保留 origin；不能把這些直接歸因於套件。沒有封包擷取，也沒有證明長時間、所有影片及所有 Chrome 版本均無資料外傳。

首次嘗試因測試使用 `[is-active]` 未辨識影片而中止。之後只調整測試的目標辨識，改為確認畫面中唯一可見的影片，再完整重跑；未修改套件程式碼。最終結果、雜湊及截圖以 `2026-10-21-verified` 目錄為準。

## 驗證與後續

重跑方式見 [SECURITY.md](../SECURITY.md)。驗證這批證據：

```sh
node tests/security/verify-evidence.cjs security/evidence/2026-10-21-verified
```

雜湊是可追溯證據的一部分，不能當作外部稽核簽章。每次修改權限、加入網路／儲存功能、變更內容腳本世界或發布新執行時程式，都應重新執行並產生新的版本化報告。
