# DayBook

DayBook is a local-first personal productivity and learning app for one user. It runs in the browser, stores data on the device with IndexedDB, and can be installed as a PWA/icon for quick access.

## Features

- Dashboard with quick capture, current-week review entry point, task overview, and latest activity
- Tasks with status, deadlines, reminders, roadblocks, tags, and project linking
- Projects with overview, linked subtasks, and structured stage rows
- Knowledge notes with a reusable work-learning template, tags, and search
- Weekly logs for learned items, work completed, blockers, contribution, and next-week priorities
- Systems, troubleshooting, questions, quick captures, and global search for local work knowledge
- Appearance themes, compact display mode, JSON export/import, and browser-native auto backup to a user-selected file

## Requirements

- Node.js 22 or newer
- npm
- A modern browser such as Chrome, Edge, Safari, or Firefox

## Get The App From GitHub

```sh
git clone https://github.com/ShuetYing/DayBook.git
cd DayBook
npm install
```

## Run Locally

```sh
npm run dev
```

Open the local URL printed by Vite, usually:

```txt
http://127.0.0.1:5173/
```

Keep the terminal running while using the app in development mode.

## Test And Build

```sh
npm test
npm run build
```

To preview the production build locally:

```sh
npm run preview
```

Then open the URL printed by Vite.

## Make Custom Changes

Most app changes live in these places:

- `src/App.tsx` for page layout, forms, and feature behavior
- `src/styles.css` for visual styling
- `src/types.ts` for data shapes
- `src/storage.ts` for local IndexedDB persistence
- `src/summary.ts` for weekly log date handling and local review draft logic

Typical workflow:

```sh
npm run dev
```

1. Edit the files you want to change.
2. Check the app in the browser.
3. Run `npm test`.
4. Run `npm run build`.

If you change the app name, icon, install behavior, or offline behavior, also review:

- `public/manifest.webmanifest`
- `public/icon.svg`
- `public/sw.js`

## Install As A PWA / Icon

First run the app locally:

```sh
npm run dev
```

Then open the local app URL in your browser.

### Chrome Or Edge On Laptop

1. Open `http://127.0.0.1:5173/`.
2. Click the install icon in the address bar, or open the browser menu.
3. Choose `Install DayBook` or `Install app`.
4. Launch DayBook later from your applications folder, start menu, dock, or desktop launcher.

### Safari On macOS

1. Open `http://127.0.0.1:5173/`.
2. Choose `File > Add to Dock`.
3. Confirm the name `DayBook`.
4. Launch DayBook from the Dock or Applications.

### iPhone Or iPad

The app is designed primarily for laptop browsers, but can be added to the home screen if the device can reach the running local server.

1. Start the app on the laptop with `npm run dev -- --host 0.0.0.0`.
2. Open the shown network URL from Safari on the iPhone or iPad.
3. Tap Share.
4. Tap `Add to Home Screen`.

Both devices must be on the same network.

## Update The Installed PWA After Changes

After making changes:

```sh
npm run build
npm run dev
```

Then refresh the app in the browser or installed window.

If the installed PWA still shows an older version:

1. Close the installed DayBook window.
2. Re-open DayBook from the browser URL.
3. Hard refresh the page.
   On macOS browsers this is usually `Cmd + Shift + R`.
   On Windows browsers this is usually `Ctrl + Shift + R`.
4. Open the installed app again.

If you changed the manifest, service worker, or icon and the old version still sticks:

1. Remove the installed DayBook app from the device.
2. Clear the site data for the local DayBook URL in the browser.
3. Start DayBook again with `npm run dev`.
4. Install the PWA again.

For another device on the same network, restart the dev server after changes so the latest local version is served.

## Data And Backups

DayBook stores data locally in the browser with IndexedDB. There is no hosted backend, account, or cloud sync.

Use `Settings > Export JSON` to download a backup. Use `Settings > Import` to merge another DayBook export into the current local data.

Use `Settings > Choose backup file` to auto-save the full DayBook JSON backup after data changes and at 00:00 daily while DayBook is open. Pick a file inside a Google Drive, iCloud Drive, OneDrive, or similar synced folder if you want that backup copied to cloud storage by your desktop sync app.

Auto backup depends on browser file picker support and cannot run while the browser/app is closed. If your browser does not support it, use manual JSON export.

## Commercial Readiness Notes

DayBook is mature for local-first, single-user browser use: it works offline after first load, stores data locally, supports JSON backup/import, and avoids recurring infrastructure cost.

For company-wide deployment, add central identity, admin policy, managed backups, audit/compliance controls, and support processes before selling it as an enterprise multi-user product.

## Reminders

Reminders use the browser Notifications API. They work only when:

- notification permission is allowed
- DayBook is open in the browser or installed app
- the device/browser supports notifications

If notifications are denied or the browser is closed, deadlines still appear inside DayBook.
