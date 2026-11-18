/* Farm grid, v4.0.
 *
 * Each strain is a real Uniswap pool on Robinhood Chain, not a pool we run.
 * Three things that follow, and the UI has to be straight about all three:
 *
 *   1. The APR belongs to the pool, not to us. It is Uniswap's trailing fee
 *      yield, it moves hourly, and we do not pay it. Every figure is labelled
 *      "Uniswap pool APR" and shows an em-dash until real data arrives. We do
 *      not print a number from data.js and let it read as live — the AMC pool
 *      was quoting 519% while our stored figure said 114%.
 *
 *   2. Only Uniswap v3 positions can be staked. v4 pools live in a singleton
 *      with no position NFT of this shape, and Metric is another protocol
 *      entirely. Those cards say so and link out, rather than offering a
 *      button that cannot work.
 *
 *   3. Staking is two steps, not one. Liquidity is added on Uniswap; what we
 *      custody is the position NFT that comes back. The sheet says so.
 */

(function () {
  'use strict';
  var S = window.Shrooms;
  var grid = document.getElementById('grid');
  if (!grid) return;

  var CFG = window.SHROOMS_CONFIG || {};
  var TOTAL_WEIGHT = window.STRAINS.reduce(function (a, f) { return a + f.weight; }, 0);
  var active = null;

  // pid -> { apr, tvl, stale } once something real has been fetched.
  var live = {};

  function pct(f) { return (f.weight / TOTAL_WEIGHT) * 100; }

  function aprCell(f) {
    var d = live[f.pid];
    if (d && typeof d.apr === 'number') {
      return '<b>' + d.apr.toFixed(2) + '%</b><span>Uniswap pool APR</span>';
    }
    return '<b class="muted">&mdash;</b><span>Uniswap pool APR &middot; live</span>';
  }

  function venueBadge(f) {
    var label = window.VENUE_LABEL[f.venue] || f.venue;
    return '<span class="venue">' + label + '</span>';
  }

  function cardHTML(f, i) {
    var blocked = !f.stakeable;

    // A strain that cannot be staked earns no SPORES, so saying what would
    // fund it reads as a promise. Show the venue instead and leave the reward
    // rows to strains that actually pay.
    var streamRow = blocked
      ? '<div class="meta"><span>Venue</span><b>' + (window.VENUE_LABEL[f.venue] || f.venue) + '</b></div>'
      : '<div class="meta"><span>Rewards from</span><b>' +
        (f.stream === window.STREAM.SHROOMS ? 'SHROOMS fees' : 'swap fees') +
        '</b></div>';

    var statusRow = blocked
      ? '<div class="meta"><span>SPORES</span><b class="warn">none yet</b></div>'
      : '<div class="meta"><span>Share of stream</span><b>' + pct(f).toFixed(1) + '%</b></div>';

    var button = blocked
      ? '<a class="btn btn-ghost" href="' + window.uniswapAddUrl(f) + '" target="_blank" rel="noopener">' +
        'View on ' + (window.VENUE_LABEL[f.venue] || 'the venue') + '</a>'
      : '<button class="btn" data-cultivate="' + f.pid + '">Provide &amp; stake</button>';

    return '' +
      '<article class="card' + (blocked ? ' is-display-only' : '') + '"' +
        ' style="--tier:' + window.TIER_VAR[f.tier] + '" data-pid="' + f.pid + '">' +
        '<span class="tier"><i></i>' + f.tier + '</span>' +
        '<div class="stage" aria-label="Poke ' + f.name + '">' +
          '<span class="glow"></span>' +
          '<img class="shroom" src="assets/strains/' + f.slug + '.png" alt="' + f.name + '"' +
               ' style="--phase:' + (i * -0.42).toFixed(2) + 's" width="132" height="132" draggable="false">' +
        '</div>' +
        '<h3 class="name">' + f.name + '</h3>' +
        '<p class="pair">' + f.pair + '<br>' + venueBadge(f) + '</p>' +
        '<div class="apy">' + aprCell(f) + '</div>' +
        streamRow +
        statusRow +
        (blocked
          ? '<p class="note">' + f.blockedBy + '</p>'
          : '<div class="bar-track"><div class="bar-fill" style="width:' +
            (f.weight / 3700 * 100) + '%"></div></div>') +
        button +
      '</article>';
  }

  function render(filter) {
    var list = window.STRAINS.filter(function (f) {
      if (filter === 'all') return true;
      if (filter === 'stakeable') return f.stakeable;
      if (filter === 'shrooms') return f.stream === window.STREAM.SHROOMS;
      return f.tier === filter;
    });
    grid.innerHTML = list.map(cardHTML).join('');

    Array.prototype.forEach.call(grid.querySelectorAll('.card'), function (card) {
      var f = byPid(card.getAttribute('data-pid'));
      // Poking is play: it sparkles and pops, nothing else.
      S.bindMascot(card, { colors: window.TIER_SPARK[f.tier] });
    });

    Array.prototype.forEach.call(grid.querySelectorAll('[data-cultivate]'), function (b) {
      b.addEventListener('click', function () { open(byPid(b.getAttribute('data-cultivate'))); });
    });
  }

  function byPid(pid) {
    pid = Number(pid);
    return window.STRAINS.filter(function (f) { return f.pid === pid; })[0];
  }

  /* --------------------------------------------------------- live stats */

  /* Pool APR is trailing fee income over TVL, which needs historical volume —
     there is no single RPC call for it. It has to come from an indexer, and
     whether one covers Robinhood Chain is a deployment-time question. So the
     endpoint is configuration, and when it is absent or fails the cards keep
     showing an em-dash and a link to Uniswap.

     Showing the stored figure instead would be the easy thing and the wrong
     one: those numbers were copied down once and are already wrong. */
  function loadPoolStats() {
    if (!CFG.poolDataUrl) return;

    fetch(CFG.poolDataUrl, { headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(r.status)); })
      .then(function (rows) {
        // Expected shape: [{ pool: '0x..', apr: 123.4, tvlUsd: 1000 }, ...]
        var byPool = {};
        (rows || []).forEach(function (r) {
          if (r && r.pool) byPool[String(r.pool).toLowerCase()] = r;
        });
        window.STRAINS.forEach(function (f) {
          var key = String(f.poolAddress || f.poolId || '').toLowerCase();
          var row = byPool[key];
          if (row) live[f.pid] = { apr: Number(row.apr), tvl: Number(row.tvlUsd) };
        });
        render(currentFilter());
      })
      .catch(function () {
        /* Leave the dashes. A missing feed is not a reason to invent numbers. */
      });
  }

  function currentFilter() {
    var on = document.querySelector('#filters [aria-pressed="true"]');
    return on ? on.getAttribute('data-f') : 'all';
  }

  /* ------------------------------------------------------------- sheet */
  var veil = document.getElementById('veil');

  function open(f) {
    active = f;
    document.getElementById('sheet-img').src = 'assets/strains/' + f.slug + '.png';
    document.getElementById('sheet-img').alt = f.name;
    document.getElementById('sheet-name').textContent = f.name;
    document.getElementById('sheet-sub').innerHTML =
      '<span style="color:' + window.TIER_VAR[f.tier] + '">' + f.tier + '</span> &middot; ' +
      f.pair + ' &middot; ' + (window.VENUE_LABEL[f.venue] || f.venue);
    document.getElementById('sheet-blurb').textContent = f.blurb;

    var link = document.getElementById('getlink');
    link.href = window.uniswapAddUrl(f);
    document.getElementById('getlink-label').textContent =
      'Add liquidity to ' + f.pair + ' on Uniswap';

    var streamNote = document.getElementById('stream-note');
    if (streamNote) streamNote.textContent = window.STREAM_LABEL[f.stream];

    veil.hidden = false;
  }

  function shut() { veil.hidden = true; active = null; }

  document.getElementById('close').addEventListener('click', shut);
  veil.addEventListener('click', function (e) { if (e.target === veil) shut(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });

  /* Staking takes a position NFT the wallet already owns, so there is no
     amount to type. The real implementation lists the caller's positions in
     this pool and calls safeTransferFrom(owner, farm, tokenId, abi(pid)).
     Until the wagmi layer is wired in, this is a stand-in. */
  document.getElementById('plant').addEventListener('click', function () {
    if (!S.isConnected()) { document.querySelector('[data-connect]').click(); return; }
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Staking position…';
    setTimeout(function () {
      btn.textContent = 'Staked';
      setTimeout(function () { btn.disabled = false; paintPlant(); shut(); }, 900);
    }, 1100);
  });

  function paintPlant() {
    var b = document.getElementById('plant');
    b.textContent = S.isConnected() ? 'Stake my position' : 'Connect wallet to stake';
  }
  document.addEventListener('wallet', paintPlant);

  /* ------------------------------------------------------------ filters */
  var filters = document.getElementById('filters');
  if (filters) {
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      Array.prototype.forEach.call(filters.children, function (c) {
        c.setAttribute('aria-pressed', String(c === b));
      });
      render(b.getAttribute('data-f'));
    });
  }

  render('all');
  paintPlant();
  loadPoolStats();
})();
