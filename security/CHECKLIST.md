# 可追溯安全檢查表

日期：2026-10-21（Asia/Taipei）。受測套件：1.0.1。基準 commit：`0e7059bbe38faede3305fac82f58d2b282c749c5`。

這些 SC／SEC／BR 編號是本專案的追蹤 ID，不是外部標準的控制編號。依據與適用範圍見 [SECURITY.md](../SECURITY.md)。每次新版本必須重新記錄結果，不沿用舊版的通過狀態。

| ID | 檢查項目與判準 | 依據 | 方法／證據 | 本次結果 |
|---|---|---|---|---|
| SC-01 | 限定 YouTube origin；無多餘 API 權限 | Chrome：最小權限 | SEC-01、BR-01、BR-03 | 通過；無 permissions、background、web-accessible resources 等額外能力 |
| SC-02 | 一般影片與非匹配網站不套用播放器行為 | Chrome：縮限存取範圍 | BR-03；報告含兩個頁面的 loop／按鈕觀察 | 通過；非匹配網站不注入，一般 watch 頁不干預播放 |
| SC-03 | 不以網頁字串執行程式碼或建立不安全 HTML | Chrome：DOM 與內容腳本安全 | 人工審查 content.js；SEC-02 | 通過本次檢查；固定文字使用 textContent，無動態程式碼執行路徑 |
| SC-04 | 頁面覆寫方法不能劫持套件的隔離腳本方法 | Chrome：isolated worlds | BR-01、BR-04 | 通過；原生擴充功能 context、頁面方法覆寫未被呼叫 |
| SC-05 | 偽造訊息／導覽資料不能要求外部連線 | Chrome：限制特權操作及訊息 | BR-06、controlled-network.json | 通過受控情境；attacker.invalid 請求為 0 |
| SC-06 | 沒有觀察到套件發起的資料外傳 | Chrome：資料安全 | 人工資料流、SEC-02、BR-06、LIVE-01、網路摘要 | 通過本次觀察窗口；非 OS 層封包擷取，也不保證未來程式碼 |
| SC-07 | 套件不讀取 cookie、頁面儲存或使用者帳號資料 | Chrome：敏感資料最小化 | 人工審查、SEC-02 | 本次無相關讀取路徑；未檢查 Chrome 自身或 YouTube 的資料處理 |
| SC-08 | 已提交檔案與歷史未出現常見憑證樣式 | SSDF：保護程式碼與機密 | SEC-04、static-report.json 的 historySecretPatternScan | 1 個既有提交／9 個檔案版本，0 命中；樣式掃描有漏報可能 |
| SC-09 | 真實媒體自然結束，重播一次後仍停止 | 安全／功能回歸 | BR-02、trusted ended 事件、截圖 | 通過；原生 ended 兩次，未用 dispatchEvent 假裝自然播放結束 |
| SC-10 | 舊重播失敗不改動切換後的狀態 | OWASP：負面情境及再驗證 | 原有回歸測試、BR-05（明示 CDP 故障注入） | 1.0.1 通過；新影片 paused=false、buttons=0 |
| SC-11 | 事件只影響目前可見影片 | Chrome：不可信 DOM／事件 | BR-08 | FUNC-01：受控重現；真實 YouTube 觸發時序尚未證實 |
| SC-12 | 不相關 DOM 變動不造成過多工作 | 可用性／資源評估 | BR-07 | PERF-01：60 批變動觸發 60 次影片查詢；未證實可感知卡頓 |
| SC-13 | CI 使用最小 token 權限，無高權限 PR trigger | GitHub Actions secure use | SEC-03，檢查所有工作流程 | 通過；contents: read，無 pull_request_target／secrets 使用 |
| SC-14 | CI actions 固定不可變提交，避免持久化 checkout 憑證 | GitHub Actions secure use | static-report.json、test.yml 原始設定 | CI-01：原有 test.yml 仍可改善；新增 security.yml 已採固定 SHA 與不持久化憑證 |
| SC-15 | 測試依賴固定且查詢已知漏洞公告 | 供應鏈檢查 | package-lock.json、dependency-audit.json | 本次 npm 公告查詢 total=0；非對未知漏洞或惡意行為的保證 |
| SC-16 | 連上真實 YouTube，套件原生載入且影片結尾停止 | 動態驗證 | LIVE-01、去敏網路摘要、真實網站截圖 | 通過一支未登入公開 Shorts；不是全影片／全帳號相容性驗證 |
| SC-17 | 提交前有可驗證、可重跑的證據 | SSDF／OWASP：驗證與記錄 | report 的來源／工具雜湊、SHA256SUMS.json、verify-evidence.cjs | 已建立；雜湊不是第三方簽章或認證 |
| SC-18 | 後端登入、資料庫、原生程式及遠端更新介面 | 適用性判定 | manifest 與檔案盤點 | 不適用：此套件沒有這些元件；未做 YouTube 服務端滲透測試 |

## 原始證據

- [瀏覽器報告](evidence/2026-10-21-verified/browser-report.json)：每項 BR／LIVE 結果、觀察值、環境及來源雜湊。
- [靜態與功能測試報告](evidence/2026-10-21-verified/static-report.json)／[完整 TAP](evidence/2026-10-21-verified/unit-security.tap)。
- [受控網路紀錄](evidence/2026-10-21-verified/controlled-network.json)／[真實網站網路摘要](evidence/2026-10-21-verified/live-network-summary.json)。
- [測試依賴公告查詢](evidence/2026-10-21-verified/dependency-audit.json)。
- [完整性雜湊](evidence/2026-10-21-verified/SHA256SUMS.json)。
- [每項發現的重現步驟與限制](ASSESSMENT-2026-10-21.md)。
