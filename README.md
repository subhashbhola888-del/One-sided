# Tu Jaane Na // The Parallel Paths

A single-page, scroll-driven piece about one-sided love: two glowing threads (one amber, one slate) descend across the screen and cross exactly once, while a 63-second hook of *Tu Jaane Na* (0:46 → 1:49) plays behind a sound pill.

Live: https://site-d0228ea15ede4df3bf8c4f0108aad660.freebuff.page

## This repository

| path | what it is |
| --- | --- |
| `index.html` | the whole page — CSS and JS inline, no build step |
| `tu-jaane-na.mp3` | the clip: 63.033 s, 128 kbps stereo, 1,008,996 bytes |
| `worker.js`, `manifest.json` | the static-asset config used by the live host |
| `.github/workflows/sync-from-live.yml` | pulls the page and the track from the live site and commits them |
| `tools/` | the headless-Chromium QA harness |

`index.html` and `tu-jaane-na.mp3` are written by that workflow. The 1 MB binary cannot go through the REST API, so the workflow fetches both, byte for byte, from the deployment. It runs on every push to `main` and can be run by hand from the **Actions** tab.

## Layout model

The page is a vertical band that scales as one unit.

| token | purpose |
| --- | --- |
| `--stage` | band width. Phones: `460px`, i.e. the full width. From 520px wide: `min(100vw - 64px, 800px)`. Portrait tablets 1000px tall and up: `min(100vw - 48px, 1000px)`. |
| `--band` | the band as actually on screen: `min(100vw, var(--stage))` |
| `--fit` | the single scale reference for type and furniture: `min(var(--band), 74vh)`. The width limits a phone; the height limits a wide-and-short screen (tablet landscape, laptop) so copy can never spill off the bottom. |

Every font size is a ratio of `--fit`, so a tablet reads as a larger phone rather than a narrow strip with dead gutters down the sides. `--band` is capped at 800px because the thread artwork is a `preserveAspectRatio=none` SVG on a 390 × 844 viewBox: past that width the curves visibly flatten.

## Where the song comes from

`TRACK_SOURCES` is a fallback chain. The page tries, in order:

1. `./tu-jaane-na.mp3` — the copy beside the page, used by the live site;
2. the hosted copy at the live URL — used by this repository.

A local 404 on a phone can resolve before the script runs, so the pill also re-checks a dead `audio` element on tap and hands over to the next source. Hold the pill (or right-click it) to load a file from the device instead; that choice is kept in IndexedDB and never uploaded.

## QA

```bash
npm ci
node node_modules/playwright-core/cli.js install chromium    # once
bash tools/qa.sh public qa/shots        # layout at 8 viewports
bash tools/qa-fallback.sh               # audio fallback, both cases
node tools/fit-check.js <url> --shots qa/live
node tools/track-fallback-check.js <url> [local|fallback]
```

Viewports checked: 360×640, 390×844, 430×932, 768×1024, 820×1180, 1024×1366, 1024×768, 1440×900. The deployed page is 8/8 clean and both audio paths pass.

## A real domain

GitHub Pages serves this repository as-is:

1. Buy the name at a registrar (Cloudflare Registrar, Porkbun, Namecheap…).
2. **Settings → Pages → Deploy from branch → `main` / `(root)`**.
3. **Settings → Pages → Custom domain** — enter the domain; GitHub writes a `CNAME` file. At the registrar add the records GitHub shows (`A` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, or `CNAME` → `<user>.github.io`) and tick **Enforce HTTPS**.

The page has no absolute asset paths, so it works unchanged from any origin.
