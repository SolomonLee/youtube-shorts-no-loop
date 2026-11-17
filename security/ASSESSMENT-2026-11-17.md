# 1.1.0 開關功能驗證

本次版本新增「播完自動停止」開關。新增的 Chrome 權限僅有 `storage`；只在 `chrome.storage.local` 保存 `enabled` 布林值。未加入背景服務、網路傳輸、帳號存取或遠端程式碼。

## 驗證結果

- 33 項功能、開關、彈出視窗及靜態安全回歸測試通過。
- JavaScript 語法及既有 9 份證據檔案的 SHA-256 一致性檢查通過。
- 測試依賴依鎖定檔安裝，停用安裝腳本；安裝時 npm audit 回報 0 項公告漏洞。這不保證沒有尚未公告的問題。
- 使用獨立、未登入的 Chromium 148.0.7778.96 與 Playwright 1.62.1，透過原生擴充功能機制載入當前 1.1.0 工作目錄。這是未提交工作目錄的驗證，瀏覽器報告另記錄執行時檔案雜湊。
- 9 項受控瀏覽器檢查／量測完成：原生載入、自然播完與重播、彈出視窗開關與重新整理後保存、兩個 YouTube 分頁同步、關閉後恢復播放、按鈕隨影片位置置中、點畫面再次播放、一般頁面不受影響，以及既有隔離與競態檢查。測試使用自行產生的影片及受控 HTTPS 回應，不能當作真實 YouTube 測試。
- 真實 YouTube 未登入測試在等待影片就緒時逾時，記錄為受阻，未列為通過。

## 既有限制

- 隱藏影片結束事件取代按鈕目標的條件性功能問題仍可在受控測試重現（FUNC-01）；未證明真實 YouTube 會產生同一時序，也未發現資料外傳或權限提升。
- 位置追蹤與頁面變動觀察的效能仍受頁面結構影響。
- 原 `test.yml` 現已固定 GitHub Actions 提交 SHA，並設定 `persist-credentials: false`；不修改歷史檢查報告對當時設定的描述。

## 重跑

```sh
npm ci --ignore-scripts
npm test
node --check content.js
node --check popup.js
node tests/security/verify-evidence.cjs
npm run test:security:browser
```

新瀏覽器結果預設保存於忽略提交的 `dist/security/latest/`。需另行設定 `LIVE_YOUTUBE=1` 才會嘗試真實網站測試；環境與限制見 [SECURITY.md](../SECURITY.md)。
