# 安全檢查流程

本專案採用 Chrome 官方擴充功能安全指南，並參考 NIST SSDF 與 OWASP WSTG 的範圍界定、人工審查、測試、證據記錄及修正再驗證流程。這不是第三方認證，也不宣稱通過完整 ASVS 驗證。

## 每次檢查

1. 固定受測 commit、套件版本、執行時檔案 SHA-256，以及測試工具／瀏覽器版本。
2. 更新 [檢查表](security/CHECKLIST.md)，記錄通過、不適用、未執行、受阻及發現問題；不適用須寫原因。
3. 人工檢查 manifest、資料流、DOM、訊息、遠端程式碼、儲存及 CI 權限。
4. 執行功能測試、靜態安全回歸、憑證樣式掃描及測試依賴公告查詢。
5. 用獨立、未登入的瀏覽器設定檔原生載入套件，執行受控測試。與真實 YouTube 測試分開記錄。
6. 每項發現記錄觸發條件、步驟、實際／預期結果、影響、證據、狀態與限制。修正後重跑相關測試。

## 重跑

需要 Node.js 22 或更新版本。以下是終端機指令，不要貼到瀏覽器開發者工具。

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm test
npm run test:security:browser
npm run test:security:collect
npm run test:security:evidence
```

前五個指令中的瀏覽器／收集器預設把新結果寫到 `dist/security/latest/`，不覆寫已保存證據。最後一個指令驗證本次已保存的 2026-10-21 證據；驗證新結果改用：

```sh
node tests/security/verify-evidence.cjs dist/security/latest
```

PowerShell 若限制執行 `.ps1`，可使用 `npm.cmd`／`npx.cmd`，不需要變更系統執行原則。

若要額外測試真實 YouTube，PowerShell 執行：

```powershell
$env:LIVE_YOUTUBE = '1'
npm.cmd run test:security:browser
```

這只讀取一支公開 Shorts，將進度移到結尾前約 0.8 秒，再等待瀏覽器的原生 `ended` 事件。未登入、不執行網站端點攻擊、不繞過 CAPTCHA 或憑證警告。網站內容、廣告、網路或結構變動可能使結果受阻；不得把受阻記成通過。

可選環境變數：`BROWSER_EXECUTABLE` 指向獨立測試用 Chromium／Chrome for Testing；`PLAYWRIGHT_MODULE` 指向已安裝 Playwright 模組；`SECURITY_EVIDENCE_DIR` 指定新證據輸出目錄。預設使用 Playwright 對應的瀏覽器。本次使用既有 Chromium 148 與 Playwright 1.62.1，已在報告記錄，不宣稱與預設下載組合完全相同。

測試設定檔存於 `dist/security/profile-*`，不讀日常 Chrome 設定檔。不要提交這些設定檔或原始 HAR／trace；可能含網站 cookie 或媒體存取參數。本次只保存去除 query、header、body 的請求摘要。

## 結果分類

- **確認漏洞**：有具體攻擊條件與安全影響的證據。
- **條件性功能風險**：在受控條件可重現，但尚未建立真實網站觸發條件。
- **強化建議**：降低未來攻擊面，不能當作已確認遭利用的漏洞。
- **效能觀察**：必須分開列出量測與推論，不把查詢次數直接當作使用者會卡頓的證據。

雜湊只能驗證檔案一致性，不能證明檢查者身分或保證軟體安全。靜態正規表示式檢查只是回歸保護，無法涵蓋混淆或所有等效語法。

## 參考

- [Chrome Stay secure](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure)
- [Chrome isolated worlds](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#work_in_isolated_worlds)
- [OWASP WSTG v4.2](https://wstg.owasp.org/v4.2/2-Introduction/)
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [Playwright 原生載入 Chrome 擴充功能](https://playwright.dev/docs/chrome-extensions)
