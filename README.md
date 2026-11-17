# YouTube Shorts No Loop

English | [繁體中文](README.zh-TW.md)

A Chrome extension that stops YouTube Shorts from automatically replaying. When a Short ends, click the video or the replay button at its center to watch it again. Use the extension's switch to restore automatic replay whenever you want.

Scrolling to another Short works normally. Regular YouTube videos are unaffected.

## Install

1. Download the repository using **Code → Download ZIP**, then extract it.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Refresh any open YouTube tabs and open a Short.

No build step, npm installation, or paid service is required to use the extension.

The extension currently uses Traditional Chinese labels. Its name in Chrome is **Shorts 播完就停**.

## Turn auto-stop on or off

Click the extension's icon in the Chrome toolbar and toggle **播完自動停止** (“Stop automatically when playback ends”). If the icon is hidden, find **Shorts 播完就停** in Chrome's puzzle-piece menu and optionally pin it to the toolbar.

| Switch | Behavior |
| --- | --- |
| On — default | Shorts stop when they end. Click the video or **↻ 重新播放** (“Replay”) to restart. |
| Off | Restores YouTube's automatic replay. A video stopped by the extension immediately restarts from the beginning. Videos you paused manually stay paused. |

Changes apply immediately to open YouTube tabs in the same Chrome profile, without refreshing. Your choice is saved locally and retained when you restart the browser.

While a video is playing, clicking it still uses YouTube's normal pause/resume behavior.

## Update an existing installation

Replace the files in the folder you originally loaded. Open `chrome://extensions`, find **Shorts 播完就停**, click **Reload**, and refresh your YouTube tabs.

To fully disable or remove the extension, use its controls on `chrome://extensions`, then refresh YouTube.

## Privacy and permissions

- Uses Chrome Manifest V3.
- Runs on desktop `youtube.com` and `www.youtube.com`. Content scripts also load on the homepage to support YouTube's navigation into Shorts, but playback changes apply only to Shorts players on `/shorts/…` pages.
- Requests only the `storage` API permission to save a single `enabled` setting in `chrome.storage.local`.
- Does not sync settings to the cloud, collect browsing history, save account or video information, or transmit data.
- Has no third-party runtime dependencies. Node.js and Playwright are used only for development and testing.

## Verification and limitations

Version **1.1.0** passed 33 automated regression tests and controlled Chromium checks covering the switch, persistence after reload, changes across two tabs, replay behavior, and button positioning.

The controlled browser checks use a test fixture served through intercepted HTTPS responses, rather than real YouTube content. The latest signed-out YouTube smoke test timed out while waiting for a video to become ready and is recorded as **blocked**, not passed. A previous signed-out test of one public Short passed for version 1.0.1; that result does not validate every behavior in 1.1.0.

Known limitations:

- YouTube player changes may require updates to this extension.
- A synthetic end event from a hidden video can replace the replay button's target in the controlled fixture. This has not been confirmed under normal live YouTube behavior.
- Position tracking and observing page changes add work whose impact depends on the page. Noticeable slowdown has not been established.
- Passing tests and pattern scans do not guarantee the absence of vulnerabilities or secrets.

### Run tests

With Node.js 22 or newer, run from the repository folder:

```sh
npm test
node --check content.js
node --check popup.js
node tests/security/verify-evidence.cjs
```

These checks do not require installing Playwright. For browser test setup and evidence collection, see [SECURITY.md](SECURITY.md).

### Manual Chrome checks

1. Let a Short finish and confirm it does not automatically replay.
2. Click the video to replay it, then confirm it stops again at the end. Repeat using the centered replay button.
3. Scroll between Shorts and confirm the next video plays normally.
4. Enter Shorts from the homepage, then navigate back. Confirm regular videos remain unaffected.
5. Pause, resume, and seek during playback. Confirm the extension does not stop the video early.
6. Start a replay and immediately switch Shorts or leave the page. Confirm an old replay request cannot restore a stale button or stop the new video.
7. Turn auto-stop off and confirm automatic replay returns. Refresh the tab and confirm the switch stays off. Turn it on again and confirm playback stops at the end.
8. Manually pause a video before turning auto-stop off; it should stay paused. Confirm switch changes also apply to another open YouTube tab.

## Security reports and evidence

The detailed reports below are in Traditional Chinese.

- [Security process and reproduction instructions](SECURITY.md)
- [Security checklist](security/CHECKLIST.md)
- [Version 1.1.0 switch verification — November 17, 2026](security/ASSESSMENT-2026-11-17.md)
- [Version 1.0.1 assessment and reproduction steps — October 21, 2026](security/ASSESSMENT-2026-10-21.md)
- [Recorded 1.0.1 browser results, screenshots, and SHA-256 hashes](security/evidence/2026-10-21-verified/)

Reference: [Chrome content scripts documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
