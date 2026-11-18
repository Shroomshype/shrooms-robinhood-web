/* Front-end checks: the animations, the interactions, and that every page
 * loads without a JavaScript error.
 *
 *   npm test
 *
 * Needs Playwright with Chromium. If it is not installed:
 *   npm i -D playwright && npx playwright install chromium
 *
 * What it is actually checking, and why each one earns its place:
 *   - the idle bob runs, loops, and is staggered so the grid does not pulse
 *     in lockstep; and the transform really changes between frames, because
 *     a named animation that is paused looks identical in the DOM
 *   - touching a card switches it to happy-hop and it calms down afterwards
 *   - clicking injects sparkle nodes, pops the mushroom, and CLEANS UP, so a
 *     user poking the same card fifty times does not leak fifty DOM nodes
 *   - Enter does the same as a tap, since the stages are focusable buttons
 *   - poking never opens the stake sheet; only the button does
 *   - prefers-reduced-motion actually stops the motion, asserted on duration
 *     rather than on the animation name, because the standard idiom collapses
 *     the duration and leaves the name in place
 *   - the tokenomics charts draw and the burn counter fills in
 *   - nothing overflows horizontally at 390px
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const S = 'file://' + path.join(__dirname, '..') + '/';
let pass = 0, fail = 0;
const ok = (l, c, d) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${l}${d ? ' — ' + d : ''}`); };

async function launch() {
  // Playwright installed from npm expects a browser build it downloaded
  // itself. Plenty of machines already have Chrome or Chromium, so try that
  // before telling anyone to fetch another 150MB.
  const tries = [];
  if (process.env.CHROME_PATH) tries.push({ executablePath: process.env.CHROME_PATH });
  tries.push({});
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
    if (fs.existsSync(p)) tries.push({ executablePath: p });
  }

  let last;
  for (const opts of tries) {
    try {
      return await chromium.launch(opts);
    } catch (e) {
      last = e;
    }
  }

  console.error('\nCould not start a browser for the front-end tests.\n');
  console.error('Fix it with one of:');
  console.error('  npx playwright install chromium        # download the matching build');
  console.error('  CHROME_PATH=/path/to/chrome npm test');
  console.error('\nThe contract tests do not need a browser — `npm test` still works.\n');
  console.error(String(last && last.message).split('\n')[0]);
  process.exit(2);
}

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 1100 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type()==='error' && !/ERR_TUNNEL|fonts\.g/.test(m.text())) errs.push(m.text()); });

  await p.goto(S + 'farms.html', { waitUntil: 'load' });
  await p.waitForTimeout(600);

  console.log('\nIdle bob');
  const bob = await p.locator('.card .shroom').first();
  const anim = await bob.evaluate(el => {
    const cs = getComputedStyle(el);
    return { name: cs.animationName, dur: cs.animationDuration, iter: cs.animationIterationCount, state: cs.animationPlayState };
  });
  ok('every mushroom runs idle-bob', anim.name === 'idle-bob', `${anim.name} ${anim.dur}`);
  ok('it loops forever', anim.iter === 'infinite');
  ok('it is actually running', anim.state === 'running');

  // staggered phases so they don't bob in lockstep
  const phases = await p.$$eval('.card .shroom', els => els.map(e => getComputedStyle(e).animationDelay));
  ok('phases are staggered', new Set(phases).size > 3, phases.slice(0,4).join(', '));

  // the transform must actually change over time
  const t1 = await bob.evaluate(e => getComputedStyle(e).transform);
  await p.waitForTimeout(700);
  const t2 = await bob.evaluate(e => getComputedStyle(e).transform);
  ok('the transform moves frame to frame', t1 !== t2);

  console.log('\nHappy hop on touch');
  const stage = p.locator('.card .stage').first();
  await stage.dispatchEvent('pointerdown', { pointerType: 'touch' });
  await p.waitForTimeout(120);
  const touched = await p.locator('.card').first().evaluate(c => c.classList.contains('is-touched'));
  ok('card enters the happy state', touched);
  const hop = await bob.evaluate(e => getComputedStyle(e).animationName);
  ok('mushroom switches to happy-hop', hop === 'happy-hop', hop);

  await stage.dispatchEvent('pointerup', { pointerType: 'touch' });
  await p.waitForTimeout(1100);
  const calm = await p.locator('.card').first().evaluate(c => c.classList.contains('is-touched'));
  ok('it calms down afterwards', !calm);

  console.log('\nSparkles on click');
  const before = await p.locator('.card .stage').first().evaluate(s => s.querySelectorAll('.spark, i, span').length);
  await stage.click({ force: true });
  await p.waitForTimeout(80);
  const sparks = await p.locator('.card').first().evaluate(c => {
    const st = c.querySelector('.stage');
    return st.querySelectorAll('*').length;
  });
  ok('click injects sparkle nodes', sparks > before, `${before} -> ${sparks}`);
  const popping = await bob.evaluate(e => e.classList.contains('is-popping') || getComputedStyle(e).animationName === 'pop-squash');
  ok('mushroom pops', popping);

  await p.waitForTimeout(1200);
  const after = await p.locator('.card').first().evaluate(c => c.querySelector('.stage').querySelectorAll('*').length);
  ok('sparkles clean themselves up', after <= before + 1, `settled at ${after}`);

  console.log('\nKeyboard parity');
  await p.locator('.card .stage').nth(1).focus();
  const tab = await p.locator('.card .stage').nth(1).evaluate(e => e.getAttribute('tabindex') + '/' + e.getAttribute('role'));
  ok('stages are focusable buttons', tab === '0/button', tab);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(80);
  const kSparks = await p.locator('.card').nth(1).evaluate(c => c.querySelector('.stage').querySelectorAll('*').length);
  ok('Enter fires the same effect', kSparks > 2, `${kSparks} nodes`);

  console.log('\nPoking does not open the modal');
  const veilHidden = await p.locator('#veil').evaluate(v => v.hidden);
  ok('veil stays hidden after poking', veilHidden);
  await p.locator('[data-cultivate]').first().click();
  await p.waitForTimeout(250);
  ok('Provide & stake does open it', !(await p.locator('#veil').evaluate(v => v.hidden)));
  await p.locator('#close').click();
  await p.waitForTimeout(200);
  ok('close works', await p.locator('#veil').evaluate(v => v.hidden));

  console.log('\nDisplay-only cards');
  const ghost = await p.locator('.card.is-display-only').count();
  ok('exactly one display-only strain', ghost === 1, `${ghost} found`);
  const ghostAnim = await p.locator('.card.is-display-only .shroom').first().evaluate(e => getComputedStyle(e).animationName);
  ok('it still animates', ghostAnim === 'idle-bob');

  console.log('\nReduced motion');
  const p2 = await b.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  await p2.goto(S + 'farms.html', { waitUntil: 'load' });
  await p2.waitForTimeout(500);
  // The standard idiom collapses the duration rather than removing the
  // animation, so assert on what actually stops the motion.
  const r = await p2.locator('.card .shroom').first().evaluate(e => {
    const cs = getComputedStyle(e);
    return { dur: cs.animationDuration, iter: cs.animationIterationCount };
  });
  ok('idle bob is collapsed to nothing', parseFloat(r.dur) < 0.01 && r.iter === '1',
     `${r.dur} x${r.iter}`);
  const rT1 = await p2.locator('.card .shroom').first().evaluate(e => getComputedStyle(e).transform);
  await p2.waitForTimeout(600);
  const rT2 = await p2.locator('.card .shroom').first().evaluate(e => getComputedStyle(e).transform);
  ok('and nothing actually moves', rT1 === rT2);
  await p2.locator('.card .stage').first().click({ force: true });
  await p2.waitForTimeout(100);
  const rPop = await p2.locator('.card .shroom').first().evaluate(e => e.classList.contains('is-popping'));
  ok('pop is suppressed too', !rPop);
  await p2.close();

  console.log('\nTokenomics charts');
  const p3 = await b.newPage({ viewport: { width: 1280, height: 1200 } });
  p3.on('pageerror', e => errs.push('tokenomics: ' + e.message));
  await p3.goto(S + 'tokenomics.html', { waitUntil: 'load' });
  await p3.waitForTimeout(400);
  await p3.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p3.waitForTimeout(2200);
  const svgs = await p3.locator('svg').count();
  const paths = await p3.locator('svg path').count();
  ok('charts render', svgs > 3 && paths > 3, `${svgs} svg, ${paths} paths`);
  const counted = await p3.locator('#burn-total').textContent();
  ok('burn counter filled in', counted && counted.trim() !== '' && counted.trim() !== '0', counted.trim());
  await p3.close();

  console.log('\nMobile width');
  const p4 = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p4.goto(S + 'farms.html', { waitUntil: 'load' });
  await p4.waitForTimeout(500);
  const overflow = await p4.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('no horizontal scroll at 390px', overflow <= 1, `${overflow}px`);
  const logoVisible = await p4.locator('.brand img').first().isVisible();
  ok('logo visible on mobile', logoVisible);
  await p4.screenshot({ path: path.join(__dirname, '..', 'mobile.png') });
  await p4.close();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (errs.length) console.log('JS ERRORS:\n' + errs.join('\n'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
