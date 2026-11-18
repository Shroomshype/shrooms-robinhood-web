/* Tokenomics page.

   Runs the same model as scripts/simulate-year.js so the charts and the
   simulation can never drift apart. One year, weekly steps.

   The fee curve has two parts, because a traded token's volume does not decay
   to nothing: a launch spike that fades, plus an organic baseline that does not.
   That baseline is what gives the system a steady state — at a 2% weekly drip,
   the reserve settles where inflow equals outflow and rewards become perpetual
   rather than terminal.

   The burn tracker reads Fertilised / PoolUnlocked events from the farm once
   SHROOMS_CONFIG carries a real address. Until then it runs simulated activity
   and the page says so — a fake number presented as live costs you trust in
   every other number on the page. */

(function () {
  'use strict';
  var S = window.Shrooms, G = window.Charts, C = G.colors;

  /* ------------------------------------------------------ the fee model */
  var WEEKS = 52;
  var ORGANIC = 7;        // ETH/wk of fees from steady trading
  var SPIKE = 40;         // launch excitement, decaying
  var DECAY = 0.82;
  var FEE_RATE = 0.01;    // Pons pool fee, 1%.
  // Pons splits creator/protocol 70/30 on current launches, so 0.70 of the
  // pool fee reaches the creator.
  var TREASURY_SHARE = 0.7;
  // ...but Pons settles creator fees in BOTH currencies — buys pay ETH, sells
  // pay the token — so only about half of that arrives as ETH and becomes
  // redeemable backing. The SHROOMS half is held and never counted as backing,
  // because backing SPORES with SHROOMS would be circular.
  //
  // These five numbers must match scripts/simulate-year.js exactly. If they
  // drift, the page quotes figures the model does not produce.
  var ETH_SHARE_OF_FEES = 0.5;
  var BOOT = 10e6, CAP = 1e9, SOLD = 0.55, BURNED = 0.25;

  function run(dripRate) {
    var reserve = 0, backing = 0, supply = 0, burnedTotal = 0;
    var out = [];
    for (var w = 1; w <= WEEKS; w++) {
      var gross = ORGANIC + SPIKE * Math.pow(DECAY, w - 1);
      var fees = gross * TREASURY_SHARE * ETH_SHARE_OF_FEES;
      reserve += fees;
      var move = reserve * dripRate;
      reserve -= move;

      var minted = (supply === 0 || backing === 0) ? move * BOOT : (move * supply) / backing;
      minted = Math.min(minted, Math.max(0, CAP - supply));
      backing += move;
      supply += minted;

      var burn = minted * BURNED;
      supply -= burn;
      burnedTotal += burn;

      var sold = minted * SOLD;
      var outEth = supply > 0 ? (sold * backing) / supply : 0;
      supply -= sold;
      backing -= outEth;

      out.push({
        w: w, fees: fees, gross: gross, volume: gross / FEE_RATE, rewards: minted,
        floor: supply > 0 ? backing / supply : 0,
        supply: supply, reserve: reserve, backing: backing, burned: burnedTotal
      });
    }
    return out;
  }

  var drip = run(0.02);
  var pass = run(1.0);
  var labels = drip.map(function (r) { return 'wk ' + r.w; });

  // every 2nd week keeps the x axis readable across 52 points
  var pick = [];
  for (var i = 0; i < WEEKS; i += 2) pick.push(i);
  pick.push(WEEKS - 1);
  var xl = pick.map(function (i) { return labels[i]; });

  var yr = drip[WEEKS - 1];
  var peakRewards = Math.max.apply(null, drip.map(function (r) { return r.rewards; }));

  /* -------------------------------------------------------- hero stats */
  G.countUp(document.getElementById('s-floor'), yr.floor / drip[0].floor, {
    format: function (v) { return v.toFixed(1) + 'x'; }
  });
  G.countUp(document.getElementById('s-reserve'), yr.reserve, {
    format: function (v) { return Math.round(v) + ' ETH'; }
  });

  /* ------------------------------------- 1. where the money comes from */
  G.onReveal(document.getElementById('c-fees'), function () {
    G.lineChart(document.getElementById('c-fees'), {
      label: 'Weekly ETH fee income to the treasury from SHROOMS trading',
      xLabels: xl,
      yFormat: function (v) { return v.toFixed(0) + ' H'; },
      series: [{
        name: 'fees to treasury', color: C.amber, fill: true,
        points: pick.map(function (i) { return drip[i].fees; })
      }]
    });
  });

  /* ------------------------------------------ 2. rewards, drip vs spend */
  G.onReveal(document.getElementById('c-rewards'), function () {
    G.lineChart(document.getElementById('c-rewards'), {
      label: 'Weekly SPORES rewards, drip versus paying fees out as they arrive',
      logScale: true,
      xLabels: xl,
      yFormat: function (v) { return G.fmt(v); },
      series: [
        { name: 'drip 2%/wk', color: C.mint, fill: true, points: pick.map(function (i) { return Math.max(1, drip[i].rewards); }) },
        { name: 'spend on arrival', color: C.red, points: pick.map(function (i) { return Math.max(1, pass[i].rewards); }) }
      ]
    });
  });

  document.getElementById('t-rewards').innerHTML =
    '<table><thead><tr><th>Week</th><th class="num">Fees in</th><th class="num">Drip</th><th class="num">Spend on arrival</th></tr></thead><tbody>' +
    [1, 4, 8, 13, 26, 39, 52].map(function (w) {
      var r = drip[w - 1];
      return '<tr><td>' + w + '</td><td class="num">' + r.fees.toFixed(1) + ' H</td><td class="num">' +
             G.fmt(r.rewards) + '</td><td class="num">' + G.fmt(pass[w - 1].rewards) + '</td></tr>';
    }).join('') + '</tbody></table>';

  /* ------------------------------------------------- 3. reserve builds */
  G.onReveal(document.getElementById('c-reserve'), function () {
    G.lineChart(document.getElementById('c-reserve'), {
      label: 'Reserve ETH over the first year',
      xLabels: xl,
      yFormat: function (v) { return v.toFixed(0); },
      series: [{ name: 'reserve', color: C.amber, fill: true, points: pick.map(function (i) { return drip[i].reserve; }) }]
    });
  });

  /* --------------------------------------------------- 4. treasury pie */
  G.donut(document.getElementById('c-split'), {
    label: 'Treasury split between reserve and backing at one year',
    centerValue: Math.round(yr.reserve + yr.backing) + '',
    centerLabel: 'ETH held',
    slices: [
      { name: 'Reserve, still to release', value: yr.reserve, color: C.amber },
      { name: 'Backing, redeemable now', value: yr.backing, color: C.mint }
    ]
  });

  /* ------------------------------------------------- 5. SHROOMS supply */
  // Illustrative split of the 1B SHROOMS launch supply at one year.
  G.donut(document.getElementById('c-shrooms'), {
    label: 'Where the SHROOMS supply sits at one year',
    centerValue: '1B',
    centerLabel: 'SHROOMS supply',
    slices: [
      { name: 'Staked in strains', value: 34, color: C.mint },
      { name: 'In the ETH LP', value: 41, color: C.violet },
      { name: 'Freely circulating', value: 25, color: C.amber }
    ]
  });

  /* -------------------------------------------------------- 6. floor */
  G.onReveal(document.getElementById('c-floor'), function () {
    G.lineChart(document.getElementById('c-floor'), {
      label: 'ETH redeemable per SPORES over the first year',
      xLabels: xl,
      yFormat: function (v) { return v.toExponential(1); },
      series: [{ name: 'floor', color: C.mint, fill: true, points: pick.map(function (i) { return drip[i].floor; }) }]
    });
  });

  /* ------------------------------------------------- 7. cumulative burn */
  G.onReveal(document.getElementById('c-burned'), function () {
    G.lineChart(document.getElementById('c-burned'), {
      label: 'Cumulative SPORES burned on boosts over the first year',
      xLabels: xl,
      yFormat: function (v) { return G.fmt(v); },
      series: [{ name: 'burned', color: C.red, fill: true, points: pick.map(function (i) { return drip[i].burned; }) }]
    });
  });

  /* -------------------------------------------------------- 8. supply */
  G.onReveal(document.getElementById('c-supply'), function () {
    G.lineChart(document.getElementById('c-supply'), {
      label: 'Circulating SPORES against the one billion cap, log scale',
      logScale: true,
      xLabels: xl,
      yFormat: function (v) { return G.fmt(v); },
      series: [
        { name: 'cap', color: C.amber, points: pick.map(function () { return CAP; }) },
        { name: 'circulating', color: C.violet, fill: true, points: pick.map(function (i) { return Math.max(1, drip[i].supply); }) }
      ]
    });
  });

  /* --------------------------------------------------- 9. multipliers */
  G.onReveal(document.getElementById('c-mult'), function () {
    G.stackRow(document.getElementById('c-mult'), [
      { name: 'bare stake', parts: [{ name: 'base', value: 1.0, color: C.violet }] },
      { name: 'fertilised', parts: [
        { name: 'base', value: 1.0, color: C.violet },
        { name: 'fertiliser', value: 0.5, color: C.mint }] },
      { name: '+ 30-day lock', parts: [
        { name: 'base', value: 1.0, color: C.violet },
        { name: 'fertiliser', value: 0.5, color: C.mint },
        { name: 'lock', value: 0.25, color: C.amber }] },
      { name: '+ 180-day lock', parts: [
        { name: 'base', value: 1.0, color: C.violet },
        { name: 'fertiliser', value: 0.5, color: C.mint },
        { name: 'lock', value: 1.0, color: C.amber }] },
    ], 3.0);
  });

  /* ---------------------------------------------------- 10. strain mix */
  G.onReveal(document.getElementById('c-strains'), function () {
    var total = window.STRAINS.reduce(function (a, f) { return a + f.weight; }, 0);
    G.stackRow(document.getElementById('c-strains'), window.STRAINS.slice().reverse().map(function (f) {
      return {
        name: f.name,
        parts: [{
          name: f.name,
          value: f.weight / total * 100,
          // Colour by funding stream: SHROOMS-paired strains are paid from
          // Pons creator fees, partner strains from swap fees we earn.
          color: f.stream === 0 ? C.mint : C.violet
        }]
      };
    }), 25);
  });

  /* ========================================================= burn tracker */

  var cfg = window.SHROOMS_CONFIG || {};
  var farmAddr = (cfg.contracts && cfg.contracts.ShroomsFarmV4) || '';
  var deployed = /^0x[0-9a-fA-F]{40}$/.test(farmAddr) && !/^0x0{40}$/.test(farmAddr);

  var burnTotal = yr.burned;
  var totalEl = document.getElementById('burn-total');
  var sparkEl = document.getElementById('burn-spark');
  var feedEl = document.getElementById('burn-feed');

  G.countUp(totalEl, burnTotal, { format: function (v) { return G.fmt(v); } });
  G.countUp(document.getElementById('s-burned'), burnTotal, { format: function (v) { return G.fmt(v); } });

  var buckets = [];
  for (var h = 0; h < 24; h++) buckets.push(0.4 + Math.random() * 0.6);
  function paintSpark() {
    sparkEl.innerHTML = buckets.map(function (v) {
      return '<span style="height:' + (v * 100).toFixed(0) + '%"></span>';
    }).join('');
  }
  paintSpark();

  var SINKS = ['fertiliser', 'fertiliser', 'fertiliser', 'unlock a strain'];
  function addr() {
    var hex = '0123456789abcdef', s = '0x';
    for (var i = 0; i < 4; i++) s += hex[Math.floor(Math.random() * 16)];
    s += '…';
    for (var j = 0; j < 4; j++) s += hex[Math.floor(Math.random() * 16)];
    return s;
  }

  var feed = [];
  function pushBurn(amount, reason, agoLabel) {
    feed.unshift({ amount: amount, reason: reason, who: addr(), ago: agoLabel || 'just now' });
    feed = feed.slice(0, 6);
    feedEl.innerHTML = feed.map(function (f) {
      return '<li><b>' + G.fmt(f.amount) + '</b> SPORES · ' + f.reason +
             ' <span class="who">' + f.who + '</span>' +
             '<span class="ago">' + f.ago + '</span></li>';
    }).join('');
  }
  ['2m ago', '7m ago', '14m ago', '31m ago', '48m ago'].forEach(function (ago) {
    pushBurn(20000 + Math.random() * 400000, SINKS[Math.floor(Math.random() * SINKS.length)], ago);
  });

  if (!deployed) {
    setInterval(function () {
      var amt = 15000 + Math.random() * 600000;
      burnTotal += amt;
      totalEl.textContent = G.fmt(burnTotal);
      buckets.shift(); buckets.push(0.35 + Math.random() * 0.65); paintSpark();
      pushBurn(amt, SINKS[Math.floor(Math.random() * SINKS.length)]);
    }, 4200);
  } else {
    document.getElementById('livechip').innerHTML = '<i></i>live on ' + (cfg.chainName || 'chain');
    var ABI = [
      'event Fertilised(address indexed user, uint256 indexed pid, uint256 amount, uint256 burned, uint256 total)',
      'event PoolUnlocked(address indexed user, uint256 indexed pid, uint256 burned)'
    ];
    var tag = document.createElement('script');
    tag.src = 'https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.umd.min.js';
    tag.onload = function () {
      var provider = new window.ethers.JsonRpcProvider(cfg.rpcUrl);
      var farm = new window.ethers.Contract(farmAddr, ABI, provider);
      function onBurn(label) {
        return function () {
          var burned = Number(window.ethers.formatEther(arguments[arguments.length - 2]));
          burnTotal += burned;
          totalEl.textContent = G.fmt(burnTotal);
          pushBurn(burned, label);
        };
      }
      farm.on('Fertilised', onBurn('fertiliser'));
      farm.on('PoolUnlocked', onBurn('unlock a strain'));
    };
    document.head.appendChild(tag);
  }

  G.donut(document.getElementById('c-sinks'), {
    label: 'Share of burned SPORES by sink',
    centerValue: G.fmt(burnTotal),
    centerLabel: 'burned',
    slices: [
      { name: 'Fertiliser', value: 71, color: C.mint },
      { name: 'Strain unlocks', value: 29, color: C.violet }
    ]
  });

  /* -------------------------------------------------------- fill copy */
  document.getElementById('f-peak').textContent = (yr.rewards / peakRewards * 100).toFixed(0) + '%';
  document.getElementById('f-pass').textContent =
    (pass[WEEKS - 1].rewards / Math.max.apply(null, pass.map(function (r) { return r.rewards; })) * 100).toFixed(1) + '%';
  document.getElementById('f-equilibrium').textContent = Math.round(ORGANIC * TREASURY_SHARE / 0.02) + ' ETH';
  document.getElementById('f-volume').textContent = G.fmt(drip[0].volume) + ' ETH';

  S.markCurrentNav();
  S.initWallet();
})();
