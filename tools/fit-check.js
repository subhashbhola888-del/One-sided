/* fit-check.js — measures how the page fits real phone / tablet / desktop
   viewports in a real headless Chromium (playwright-core).

   usage:  node tools/fit-check.js <url> [--shots <dir>] [--json]

   For each viewport it loads the page, then walks every <section> so the
   scroll-driven reveals have run, and reports:
     · horizontal overflow of the document
     · the thread band (.stage) width as a share of the viewport + gutters
     · live font sizes of the hero / climax / prose / kicker
     · any element whose box pokes outside the viewport, horizontally
     · any text block wider than the band (headline overflow)
     · the sound pill rect and whether it sits fully inside the viewport
*/
'use strict';

const { chromium } = require('playwright-core');
const fs = require('fs');

const URL_ = process.argv[2] || 'http://127.0.0.1:8787/';
const AS_JSON = process.argv.includes('--json');
const SHOT_IDX = process.argv.indexOf('--shots');
const SHOT_DIR = SHOT_IDX > -1 ? process.argv[SHOT_IDX + 1] : null;
if (SHOT_DIR) fs.mkdirSync(SHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'phone-small', width: 360, height: 640 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-large', width: 430, height: 932 },
  { name: 'tab-portrait', width: 768, height: 1024 },
  { name: 'tab-air-portrait', width: 820, height: 1180 },
  { name: 'tab-pro-portrait', width: 1024, height: 1366 },
  { name: 'tab-landscape', width: 1024, height: 768 },
  { name: 'laptop', width: 1440, height: 900 },
];

/* runs inside the page */
const PROBE = () => {
  const vw = window.innerWidth;
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), right: +b.right.toFixed(1) }; };
  const fs_ = (sel) => { const el = document.querySelector(sel); return el ? +parseFloat(getComputedStyle(el).fontSize).toFixed(1) : null; };

  const band = document.querySelector('.stage');
  const pill = document.querySelector('#soundBtn');
  const label = document.querySelector('#soundLabel');
  const hero = document.querySelector('#s1 .inner');
  const bandRect = band ? r(band) : null;
  const pillRect = pill ? r(pill) : null;
  const bandW = bandRect ? bandRect.w : vw;

  /* deliberately oversized decorative overlays, not layout spills */
  const IGNORE = /\.grain|\.vignette/;

  const spills = [];
  document.querySelectorAll('body *').forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return;
    const tag = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
    if (IGNORE.test(tag)) return;
    if (b.right > vw + 1 || b.left < -1) spills.push({ tag, left: +b.left.toFixed(1), right: +b.right.toFixed(1) });
  });

  /* vertical fit.
     A section's copy must fit inside the section that holds it (otherwise it
     bleeds into the next one), and the hero must fit inside a single screen. */
  const vh = window.innerHeight;
  const innerTall = [];
  document.querySelectorAll('section').forEach((sec) => {
    const inner = sec.querySelector(':scope > .inner');
    if (!inner) return;
    const b = inner.getBoundingClientRect();
    if (b.width === 0) return;
    /* the hero must fit one screen; the tall scroll sections must fit themselves */
    const box = sec.getBoundingClientRect().height;
    const limit = sec.id === 's1' ? vh : box;
    if (b.height > limit + 1) {
      innerTall.push({ id: sec.id || '?', h: +b.height.toFixed(0), box: +box.toFixed(0), over: +(b.height - limit).toFixed(0) });
    }
  });

  /* does the hero's scroll hint collide with the hero copy? */
  const hintEl = document.querySelector('#s1 .hint');
  const hintRect = hintEl ? r(hintEl) : null;
  const hintCollide = [];
  if (hintRect) {
    document.querySelectorAll('#s1 .prose, #s1 .display, #s1 .kicker, #s1 .ctas').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return;
      if (b.bottom > hintRect.y + 1 && b.top < hintRect.y + hintRect.h - 1) {
        const tag = el.tagName.toLowerCase() + '.' + String(el.className || '').trim().split(/\s+/).join('.');
        hintCollide.push({ tag, gap: +(b.bottom - hintRect.y).toFixed(0) });
      }
    });
  }

  const textOverflow = [];
  document.querySelectorAll('.display, .climax, .lyric, .prose, .signoff, .kicker, .ctas, .close, .beat h2, .beat h3').forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.width === 0) return;
    const over = el.scrollWidth - el.clientWidth;
    const wide = b.width - bandW > 1 ? +(b.width - bandW).toFixed(1) : 0;
    if (over > 1 || wide) {
      const tag = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
      textOverflow.push({ tag, over: over > 1 ? over : 0, wide });
    }
  });

  return {
    vw,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    band: bandRect,
    bandShare: bandRect ? +(bandRect.w / vw).toFixed(3) : null,
    gutterL: bandRect ? bandRect.x : null,
    gutterR: bandRect ? +(vw - bandRect.right).toFixed(1) : null,
    hero: hero ? r(hero) : null,
    vh,
    innerTall,
    hint: hintRect,
    hintCollide,
    fonts: { display: fs_('.display'), climax: fs_('.climax'), prose: fs_('.prose'), kicker: fs_('.kicker'), lyric: fs_('.lyric') },
    pill: pillRect,
    pillLabelClipped: label ? label.scrollWidth > label.clientWidth + 1 : null,
    pillInside: pillRect ? (pillRect.x >= -0.5 && pillRect.right <= vw + 0.5 && pillRect.y >= -0.5) : null,
    spills,
    textOverflow,
  };
};

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: vp.width < 520,
      hasTouch: vp.width < 520,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 140)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });

    await page.goto(URL_, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(1500);

    const sections = await page.$$eval('section', (els) => els.map((e) => e.id));
    const steps = ['top'].concat(sections.length ? sections : ['s1', 's2', 's3', 's4']);

    const merged = { spills: [], textOverflow: [], innerTall: [], hintCollide: [], overflowX: 0, pillInside: true, pillLabelClipped: false };
    let first = null;

    for (const step of steps) {
      if (step !== 'top') {
        await page.evaluate((id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' }); }, step);
        await page.waitForTimeout(1100);
      }
      const res = await page.evaluate(PROBE);
      if (!first) first = res;
      merged.overflowX = Math.max(merged.overflowX, res.overflowX);
      merged.pillInside = merged.pillInside && res.pillInside;
      merged.pillLabelClipped = merged.pillLabelClipped || res.pillLabelClipped;
      res.spills.forEach((s) => { if (!merged.spills.some((m) => m.tag === s.tag)) merged.spills.push(s); });
      res.textOverflow.forEach((s) => { if (!merged.textOverflow.some((m) => m.tag === s.tag)) merged.textOverflow.push(s); });
      res.innerTall.forEach((s) => { if (!merged.innerTall.some((m) => m.id === s.id)) merged.innerTall.push(s); });
      res.hintCollide.forEach((s) => { if (!merged.hintCollide.some((m) => m.tag === s.tag)) merged.hintCollide.push(s); });
      if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${vp.name}--${step}.png` });
    }

    out.push(Object.assign({
      viewport: vp.name,
      target: `${vp.width}x${vp.height}`,
      steps: steps.length,
      errors: errors.slice(0, 3),
    }, first, merged));

    await ctx.close();
  }
  await browser.close();

  if (AS_JSON) { console.log(JSON.stringify(out, null, 2)); return; }

  let fails = 0;
  console.log('URL: ' + URL_);
  for (const r of out) {
    const bad = [];
    if (r.overflowX > 0) bad.push(`H-OVERFLOW ${r.overflowX}px`);
    if (r.textOverflow.length) bad.push(`${r.textOverflow.length} text block(s) wider than the band`);
    if (r.spills.length) bad.push(`${r.spills.length} element(s) outside viewport`);
    if (r.pillInside === false) bad.push('pill outside viewport');
    if (r.pillLabelClipped) bad.push('pill label clipped');
    if (r.innerTall.length) bad.push(`${r.innerTall.length} section(s) taller than the screen`);
    if (r.hintCollide.length) bad.push('scroll hint overlaps hero copy');
    if (bad.length) fails++;
    console.log(`\n${r.viewport}  ${r.target}  ${r.steps} scroll steps  ${bad.length ? '✗ ' + bad.join('; ') : '✓ ok'}`);
    console.log(`   band ${r.band ? r.band.w : '-'}px = ${(r.bandShare * 100).toFixed(1)}% of width   gutters L/R ${r.gutterL}/${r.gutterR}px`);
    console.log(`   fonts display=${r.fonts.display} climax=${r.fonts.climax} lyric=${r.fonts.lyric} prose=${r.fonts.prose} kicker=${r.fonts.kicker}`);
    console.log(`   pill ${r.pill ? `${r.pill.w}x${r.pill.h} right=${r.pill.right} top=${r.pill.y}` : '-'} inside=${r.pillInside}`);
    if (r.spills.length) console.log('   spills: ' + r.spills.map((s) => `${s.tag}(${s.left}→${s.right})`).join(', '));
    if (r.textOverflow.length) console.log('   text wider than band: ' + r.textOverflow.map((s) => `${s.tag}(+${Math.max(s.over, s.wide)}px)`).join(', '));
    if (r.innerTall.length) console.log('   content outgrows its section: ' + r.innerTall.map((s) => `${s.id} ${s.h}px in ${s.box}px (+${s.over})`).join(', '));
    if (r.hintCollide.length) console.log('   hint collides: ' + R.hintCollide.map((s) => `${s.tag}(overlap ${s.gap}px)`).join(', '));
    if (r.errors.length) console.log('   JS errors: ' + r.errors.join(' | '));
  }
  console.log(`\n${out.length - fails}/${out.length} viewports clean`);
  if (fails) process.exitCode = 1;
})().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
