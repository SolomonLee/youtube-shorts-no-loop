# Chrome Web Store 上架可行性

查核日期：2026-11-17。此文件為準備工作與差距評估，尚未註冊開發者帳號、付款、上傳或送審。

## 結論

本專案可以準備申請 Chrome Web Store 上架。依目前程式判斷，功能單一（控制 Shorts 重播）、使用 Manifest V3、程式隨套件封裝、僅在 YouTube 網站執行，且只使用 `storage` API 權限保存本機偏好，沒有明顯的技術架構阻礙。這是程式檢視的判斷，不是 Google 的審查核准。

## 目前還缺什麼

| 項目 | 現況與待辦 |
| --- | --- |
| 開發者帳號 | 尚未檢查使用者的 Google 帳號。需要註冊、支付一次性註冊費、驗證聯絡信箱及開啟兩步驟驗證。 |
| 費用 | Google 於 2026-04-28 官方文章列出的新發布者註冊費為 US$5。實際金額與付款條件以註冊頁顯示為準。 |
| 發布者資料 | 需要設定發布者名稱與聯絡信箱；確認哪些資訊會公開。所有開發者必須申報 Trader / Non-Trader，應依實際身分填寫。Trader 會涉及法定名稱、電話、地址驗證與公開資訊。 |
| 圖示 | 目前 manifest 沒有 `icons`。需準備原創圖示與 128×128 商店圖示；另提供常用的 16、32、48 尺寸。 |
| 商店截圖 | 需要至少一張 1280×800 截圖，最多五張。既有安全測試截圖未依商店格式製作。可另製作中英文版操作示範。 |
| 商店文案 | 需準備簡短摘要、詳細說明、分類、支援方式與審查測試步驟。說明 Shorts 範圍、停止／恢復重播、語言選單及已知限制。 |
| 隱私政策 | 目前只有 README 的隱私說明，建議補獨立、可公開連結的政策頁。清楚說明本機保存 `enabled` 與 `language`、本機處理 Shorts 路徑與播放器狀態、沒有資料上傳或分析服務，以及移除擴充功能會清除本機設定。 |
| 權限與資料聲明 | Dashboard 要填單一用途、權限理由與隱私欄位。`storage` 用於偏好；YouTube 內容腳本範圍用於識別播放器、支援站內導覽及控制重播。不可因沒有上傳資料，就忽略說明本機存取的資料。 |
| 商店中英文資訊 | 彈出視窗的手動語言切換已實作；商店 listing 的原生多語系另需 `_locales/en/`、`_locales/zh_TW/` 及 `default_locale` 等 manifest 設定，目前尚未加入。 |
| 正式 ZIP | 使用明確檔案清單封裝執行所需檔案，讓 `manifest.json` 位於 ZIP 根目錄。不要直接把整個儲存庫 ZIP 當成正式套件；排除 `.git`、測試、證據、瀏覽器設定檔與 `node_modules`。 |
| 真實網站驗收 | 受控 Chromium 驗證通過不等於真實 YouTube 驗收；最近一次真實網站測試受阻。送審前需在日常 Chrome 實際確認播放、切換 Shorts、開關及語言切換。隱藏影片事件的既有條件性功能問題也應改善或確認實際影響。 |

商店圖示、文案與示範素材應使用有權使用的內容，並清楚標示為獨立第三方工具，不暗示由 Google 或 YouTube 官方提供。

## 建議順序

1. 完成真實 YouTube 操作驗收，處理影響正常使用的問題。
2. 補上圖示、獨立隱私政策、商店文案與中英文截圖；若要商店原生多語系，同時補 `_locales`。
3. 以執行時檔案清單建立 ZIP，重新檢查封裝內容與權限。
4. 由使用者完成 Google 登入、帳號驗證、身分聲明、條款確認與付款。
5. 上傳、填寫商店及隱私欄位，先保存可檢查的草稿，再送審。可選擇審查通過後手動發布，避免自動公開尚未確認的 listing。

目前的需求是研究可行性，因此本次不進行帳號註冊或商店送審，也不保證審查時間或核准結果。

## 官方來源

- [開發者帳號註冊](https://developer.chrome.com/docs/webstore/register)
- [2026-04-28 發布者角色與 US$5 註冊費說明](https://developer.chrome.com/blog/cws-role-expansion-developer-dashboard)
- [設定發布者資料與信箱驗證](https://developer.chrome.com/docs/webstore/set-up-account)
- [開發者兩步驟驗證要求](https://developer.chrome.com/blog/policy-update-2sv)
- [Trader / Non-Trader FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq)
- [準備擴充功能與 ZIP](https://developer.chrome.com/docs/webstore/prepare)
- [商店文案、圖示、截圖與多語系](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [隱私與權限欄位](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [開發者政策：隱私、權限、品牌與內容](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [提交審查與延後發布](https://developer.chrome.com/docs/webstore/publish)
