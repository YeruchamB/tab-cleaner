# Tab Cleaner

A Chrome extension that cleans up browser clutter in one click — closes leftover Zoom tabs, duplicate tabs, and empty tabs, then reorders everything by domain.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## What It Does

After a day of meetings, your browser is a mess — stale Zoom tabs, duplicates you forgot about, empty new-tab pages piling up. Tab Cleaner scans for all of it and fixes it with a single click:

| Category | What gets closed |
|---|---|
| **Zoom tabs** | Any tab matching `zoom.us`, `zoom.com`, or `zoomgov.com` |
| **Duplicate tabs** | When multiple tabs point to the same URL, keeps the newest and closes the rest |
| **Empty tabs** | `chrome://newtab`, `about:blank`, and other blank pages (always keeps at least one) |

After closing, it **reorders** your remaining unpinned tabs alphabetically by domain, grouping related sites together. Pinned tabs are never touched.

## Screenshot

When you click the extension icon, a popup shows a summary of what it found:

```
┌──────────────────────────────────┐
│  🎥  Tab Cleaner                 │
│  Zoom · duplicates · empties     │
│                                  │
│  🔴 Zoom tabs              3    │
│  🟡 Duplicate tabs         5    │
│  ⚫ Empty tabs              2    │
│  ─────────────────────────       │
│  Tabs to close            10    │
│  🔵 Reorder by domain      ✓    │
│                                  │
│  ┌──────────────────────────┐    │
│  │  Clean 10 tabs & reorder │    │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

## Installation

> **Quick download:** [📦 Download tab-cleaner.zip](https://github.com/<your-username>/tab-cleaner/archive/refs/heads/main.zip) — then skip to the [From a zip file](#from-a-zip-file) instructions below.

### From source (developer mode)

1. **Clone the repo**

   ```bash
   git clone https://github.com/<your-username>/tab-cleaner.git
   ```

2. **Open Chrome Extensions page**

   Navigate to `chrome://extensions/` in your browser.

3. **Enable Developer Mode**

   Toggle the **Developer mode** switch in the top-right corner.

4. **Load the extension**

   Click **Load unpacked** and select the `tab-cleaner/` directory (the folder containing `manifest.json`).

5. **Pin it** (optional)

   Click the puzzle-piece icon in the Chrome toolbar and pin **Tab Cleaner** for quick access.

### From a zip file

1. Download or obtain the `tab-cleaner.zip` file.
2. Extract it to a folder on your machine.
3. Follow steps 2–5 above, pointing **Load unpacked** at the extracted folder.

## Usage

1. Click the **Tab Cleaner** icon in your toolbar.
2. The popup scans your tabs and shows a summary of Zoom, duplicate, and empty tabs found.
3. Click **Clean N tabs & reorder** to close them all and sort the rest by domain.
4. If nothing needs closing, the button reads **Reorder tabs by domain** — it still sorts your tabs.

## Permissions

| Permission | Why |
|---|---|
| `tabs` | Required to query, close, and reorder tabs |
| Host access to `*.zoom.us`, `*.zoom.com`, `*.zoomgov.com` | Required for Chrome to expose Zoom tab URLs to the extension |

No data is collected, stored, or transmitted. Everything runs locally in your browser.

## Project Structure

```
tab-cleaner/
├── manifest.json      # Extension manifest (Manifest V3)
├── popup.html         # Popup UI with embedded styles
├── popup.js           # Tab scanning, cleaning, and reordering logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## How It Works

- **Zoom detection** uses both Chrome's `tabs.query` URL pattern matching and a regex fallback to catch edge cases.
- **Duplicate detection** groups all tabs by URL; for each group with 2+ tabs, it keeps the last (by tab index) and marks the rest for closure.
- **Empty detection** matches against known blank-page URLs (`chrome://newtab/`, `about:blank`, etc.) and ensures at least one tab always remains.
- **Deduplication across categories** — if a tab is both a Zoom tab and a duplicate, it only appears once (Zoom takes priority).
- **Reordering** sorts unpinned tabs by hostname (stripping `www.`), with title as a tiebreaker, then uses `chrome.tabs.move` to rearrange them.

## Contributing

PRs welcome. The extension is intentionally minimal — a single HTML file and a single JS file with no build step or dependencies.

## License

MIT
