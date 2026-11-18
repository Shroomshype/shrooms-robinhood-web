/* Swap tab.
 *
 * This is an interface over Uniswap, not an exchange. Execution goes through
 * Uniswap's own router against Uniswap's own pools; what this page adds is an
 * integrator fee, declared per request through the Trading API's
 * `integratorFees` field. (Uniswap removed API-key-based fees in May 2026, so
 * the fee travels with the quote request rather than being configured once.)
 *
 * WHY THE FEE IS SHOWN BEFORE THE BUTTON, NOT BEHIND A TOOLTIP
 * ------------------------------------------------------------
 * The whole case for routing a trade here rather than on app.uniswap.org is
 * that the fee funds SPORES on the partner strains. That argument only works
 * if the person can see what they are paying. A fee a user has to go looking
 * for is one they will feel tricked by when they find it.
 */

(function () {
  'use strict';
  var S = window.Shrooms;
  var CFG = window.SHROOMS_CONFIG || {};
  var box = document.getElementById('go');
  if (!box) return;

  var FEE_BPS = Number(CFG.integratorFeeBps || 0);
  var native = (CFG.nativeCurrency && CFG.nativeCurrency.symbol) || 'ETH';

  // Tokens worth offering: whatever appears in the strain lineup, plus the
  // native currency. Kept derived rather than a second hand-written list, so
  // adding a strain cannot leave the swap tab out of date.
  var TOKENS = (function () {
    var seen = {};
    var out = [native];
    (window.STRAINS || []).forEach(function (f) {
      String(f.pair || '').split('/').forEach(function (part) {
        var sym = part.trim();
        if (!sym || sym === native || seen[sym]) return;
        seen[sym] = true;
        out.push(sym);
      });
    });
    return out;
  })();

  var inTok = document.getElementById('in-tok');
  var outTok = document.getElementById('out-tok');

  function fill(sel, chosen) {
    sel.innerHTML = TOKENS.map(function (t) {
      return '<option value="' + t + '"' + (t === chosen ? ' selected' : '') + '>' + t + '</option>';
    }).join('');
  }
  fill(inTok, native);
  fill(outTok, TOKENS[1] || native);

  document.getElementById('flip').addEventListener('click', function () {
    var a = inTok.value;
    inTok.value = outTok.value;
    outTok.value = a;
    quote();
  });

  var inAmt = document.getElementById('in-amt');
  var outAmt = document.getElementById('out-amt');

  function set(id, text) { document.getElementById(id).textContent = text; }

  /* No price feed is wired yet, so this deliberately shows what the trade
     WOULD cost in fees rather than inventing an exchange rate. Fees are the
     part this interface actually determines; the rate is Uniswap's, and
     printing a made-up one would be worse than printing none. */
  function quote() {
    var v = parseFloat(inAmt.value);
    if (!(v > 0)) {
      outAmt.value = '';
      set('r-rate', '—');
      set('r-pool', '—');
      set('r-fee', '—');
      set('r-min', '—');
      return;
    }

    var fee = (v * FEE_BPS) / 10000;
    set('r-rate', 'quoted at execution');
    set('r-pool', 'set by the pool (0.05% – 1%)');
    set('r-fee', FEE_BPS
      ? fee.toLocaleString(undefined, { maximumFractionDigits: 6 }) + ' ' + inTok.value +
        '  (' + (FEE_BPS / 100).toFixed(2) + '%)'
      : 'none');
    set('r-min', 'after slippage, at execution');
    outAmt.value = '';
  }

  inAmt.addEventListener('input', quote);
  inTok.addEventListener('change', quote);
  outTok.addEventListener('change', quote);

  document.getElementById('fee-note').innerHTML = FEE_BPS
    ? 'The ' + (FEE_BPS / 100).toFixed(2) + '% interface fee goes to the treasury and is ' +
      'recorded as partner income, which is what funds SPORES on the partner strains. ' +
      'Uniswap&rsquo;s own pool fee is separate and goes to that pool&rsquo;s liquidity providers.'
    : 'This interface charges no fee. Partner strains therefore have no income funding ' +
      'their SPORES rewards.';

  function paint() {
    box.textContent = S.isConnected() ? 'Swap' : 'Connect wallet to swap';
  }
  document.addEventListener('wallet', paint);

  box.addEventListener('click', function () {
    if (!S.isConnected()) { document.querySelector('[data-connect]').click(); return; }
    // Stand-in for: quote via the Trading API with integratorFees set, then
    // permit2 approve -> UniversalRouter execute.
    box.disabled = true;
    box.textContent = 'Routing through Uniswap…';
    setTimeout(function () {
      box.textContent = 'Not wired yet — testnet build';
      setTimeout(function () { box.disabled = false; paint(); }, 1400);
    }, 900);
  });

  S.markCurrentNav();
  S.initWallet();
  paint();
  quote();
})();
