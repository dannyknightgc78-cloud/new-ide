# Queendar App Clip Codes

Browser app that generates Apple App Clip Codes for Queendar:

1. **Queendar** — main camera-style code for `https://queendar.com`
2. **7-day Premium Sticky** — camera-readable sticky for `https://queendar.com/trial/7-day`

Built with Vite, React, and [`appclipcode`](https://github.com/rs/appclipcode).

## Features

- One-click presets for Queendar and the premium trial sticky
- Custom foreground / background / third accent colors
- Camera or NFC logo modes
- Live preview with scale and background controls
- Download SVG or PNG, copy SVG / data URL
- Settings persisted in localStorage

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Output is static files in `dist/`.

## Hostman deploy (this app only)

Create one **Frontend** app on [Hostman App Platform](https://hostman.com/docs/app-platform/frontend-apps/) pointed at this repository:

| Setting | Value |
| --- | --- |
| Type | Frontend |
| Framework / Node | Node.js 20+ |
| Branch | `main` (or this feature branch while testing) |
| Build command | `npm run build` |
| Build directory | `dist` |
| Project directory | *(leave empty — app is at repo root)* |

Enable autodeploy so Hostman rebuilds on each push. No backend or AI runtime is required — generation runs entirely in the browser.

## Notes

App Clip Codes only accept a narrow subset of `https://` URLs and enforce a 128-bit payload limit.

Not affiliated with Apple Inc.
