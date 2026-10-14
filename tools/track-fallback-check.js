/* track-fallback-check.js — proves the page still plays the song when the
   1 MB mp3 is *not* sitting next to it (the GitHub Pages copy, which cannot
   carry the binary). Loads the page from a directory that has no audio file
   and waits for <audio> to walk TRACK_SOURCES on its own.

   usage: node tools/track-fallback-check.js <url> [expect]
          expect = 'fallback' (default) the song must come from the hosted URL
                   'local'            it must come from ./tu-jaane-na.mp3
*/
'use strict';

const { chromium } = require('playwright-core');

const URL_ = process.argv[2];
const EXPECT = process.argv[3] || 'fallback';
if (!URL_) {
  console.error('usage: node tools/track-fallback-check.js <url>');
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

  await page.goto(URL_, { waitUntil: 'load', timeout: 45000 });

  const read = () => page.evaluate(() => {
    const a = document.getElementById('bgAudio');
    return {
      currentSrc: a.currentSrc || a.src || '',
      readyState: a.readyState,
      networkState: a.networkState,
      err: a.error ? a.error.code : null,
      duration: isFinite(a.duration) ? +a.duration.toFixed(3) : null,
    };
  });

  /* the picture at load time, before anything is clicked */
  await page.waitForTimeout(2500);
  const atLoad = await read();

  /* then click the pill the way a visitor does, in case the local 404 resolved
     before the error listener existed */
  await page.click('#soundBtn');

  const deadline = Date.now() + 20000;
  let state = atLoad;
  while (Date.now() < deadline) {
    state = await read();
    if (state.readyState >= 1) break;          /* HAVE_METADATA */
    await page.waitForTimeout(500);
  }

  /* the local file is the one beside the page; anything else is the fallback.
     Comparing against the page's own origin is what makes this correct when the
     page itself is served from freebuff.page. */
  const pageOrigin = new URL(URL_).origin;
  const localURL = pageOrigin + '/tu-jaane-na.mp3';
  const usedFallback = state.currentSrc !== localURL;
  const loaded = state.readyState >= 1 && state.duration > 60;
  const ok = loaded && (EXPECT === 'fallback' ? usedFallback : !usedFallback);

  console.log('page          ' + URL_);
  console.log('expect        ' + EXPECT);
  console.log('at load       ' + atLoad.currentSrc + '  readyState ' + atLoad.readyState);
  console.log('after pill    ' + state.currentSrc);
  console.log('readyState    ' + state.readyState + '  networkState ' + state.networkState);
  console.log('duration      ' + state.duration + 's');
  console.log('served by     ' + (usedFallback ? 'hosted fallback' : 'local file') + '  (local would be ' + localURL + ')');
  console.log('4xx/failed    ' + (failed.length ? failed.join(', ') : 'none'));
  console.log(ok
    ? 'RESULT        ✓ song loads (' + EXPECT + ')'
    : 'RESULT        ✗ song did not load as expected (' + EXPECT + ')');

  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
