/* Strain metadata, v4.0. Mirrors scripts/lineup-v4.js — change one, change both.
   The contracts only know pool ids, streams and prices; names, tiers and artwork
   live here, so renaming a mushroom is never a transaction.

   WHAT CHANGED FROM V3
   --------------------
   Strains are no longer pools we run. Each one is a real Uniswap pool on
   Robinhood Chain, and users provide liquidity through Uniswap itself. Shrooms
   custodies the resulting position NFT and pays SPORES on top.

   Two things follow, and the UI has to be honest about both:

   1. ONLY UNISWAP V3 POSITIONS CAN BE STAKED. Uniswap v4 keeps every pool in
      one singleton contract with no position NFT of the familiar shape, and
      Metric is a different protocol entirely. Those strains are display-only
      until each gets its own integration. `stakeable:false` says so, and the
      card says so to the user rather than offering a button that cannot work.

   2. THE APR SHOWN IS UNISWAP'S, NOT OURS. It is trailing fee yield on the
      underlying pool and it moves hourly — the AMC pool was quoting 519% at
      $91k TVL while the figure below said 114%. `quotedApr` is a placeholder
      for layout only. Render live values, and label them as the pool's APR. */

const STREAM = { SHROOMS: 0, PARTNER: 1 };

window.STRAINS = [
  { pid:0, slug:'puffball', name:'Puffball Patch', pair:'AI / ETH',
    venue:'uniswap-v3', stream:STREAM.PARTNER, stakeable:true,
    poolAddress:'0xD78480CAFEf722D75519e13B9f516e5704D0D659',
    tier:'Common', weight:600, quotedApr:237.11,
    blurb:'The open bed. No entry cost, no ceremony — add liquidity on Uniswap, stake the position, start earning.' },

  { pid:1, slug:'inky', name:'Inky Cap', pair:'AMC / USDG',
    venue:'uniswap-v4', stream:STREAM.PARTNER, stakeable:true,
    poolId:'0x7499938c352d5b5b8f0c648722aca5ee964ef9b85c3a3041f1ec379726291d9d',
    tier:'Common', weight:850, quotedApr:114.31,
    blurb:'Volatile, loud, and liquid. Browse the pool here; provide through Uniswap.' },

  { pid:2, slug:'morel', name:'Morel Deep', pair:'MU / SPY',
    venue:'uniswap-v4', stream:STREAM.PARTNER, stakeable:true,
    poolId:'0xcc2a903a8744a65258bb07fbeea553a25410f731c9fef306321d0c176a09542c',
    tier:'Rare', weight:1150, quotedApr:68.64,
    blurb:'All surface area, no shortcuts. Honeycombed, stubborn, and worth the climb.' },

  { pid:3, slug:'chanterelle', name:'Chanterelle Grove', pair:'CASHCAT / ETH',
    venue:'uniswap-v3', stream:STREAM.PARTNER, stakeable:true,
    poolAddress:'0xd42A491087a15E5afd51FEb3606066Cc152d2b09',
    tier:'Rare', weight:1500, quotedApr:157.07,
    blurb:'Wide fluted caps that catch more than their share of what falls.' },

  { pid:4, slug:'mycena', name:'Blue Mycena', pair:'META / USDG',
    venue:'metric', stream:STREAM.PARTNER, stakeable:false,
    poolAddress:'0x90CABdA18279BBB3D935989aF807b08B0e8CeC61',
    externalUrl:'https://app.metric.xyz/pool/4663/0x90CABdA18279BBB3D935989aF807b08B0e8CeC61',
    blockedBy:'Metric positions are a different format — display only',
    tier:'Epic', weight:1900, quotedApr:39.09,
    blurb:'Bioluminescent and off the beaten path. A second venue, so yield does not all come from one place.' },

  { pid:5, slug:'enoki', name:'Enoki Cluster', pair:'SHROOMS / USDG',
    venue:'uniswap-v3', stream:STREAM.SHROOMS, stakeable:true,
    poolAddress:'',
    tier:'Epic', weight:2300,
    blurb:'Pair SHROOMS with USDG. One of only two strains whose trading actually funds the treasury.' },

  { pid:6, slug:'golden', name:'Golden Cap', pair:'NVDA / USDG',
    venue:'uniswap-v3', stream:STREAM.PARTNER, stakeable:true,
    poolAddress:'',
    tier:'Legendary', weight:3000, quotedApr:183.21,
    blurb:'Liquidity with commitment behind it. Deep pockets, deeper roots.' },

  { pid:7, slug:'amanita', name:'Amanita Prime', pair:'SHROOMS / ETH',
    venue:'uniswap-v3', stream:STREAM.SHROOMS, stakeable:true,
    poolAddress:'',
    tier:'Legendary', weight:3700,
    blurb:'The mother colony — the Pons launch pool. Its fees are what the whole treasury is built on.' },
];

window.STREAM = STREAM;

window.STREAM_LABEL = {
  0: 'Funded by SHROOMS trading fees',
  1: 'Funded by swap fees earned here',
};

window.VENUE_LABEL = {
  'uniswap-v3': 'Uniswap v3',
  'uniswap-v4': 'Uniswap v4',
  'metric':     'Metric',
};

window.TIER_VAR = {
  Legendary:'var(--r-legendary)',
  Epic:'var(--r-epic)',
  Rare:'var(--r-rare)',
  Common:'var(--r-common)',
};

/* Sparkle colours per tier, so a Legendary pop reads gold and an Epic violet. */
window.TIER_SPARK = {
  Legendary:['#FFC53D','#FFE9A8','#FFFFFF'],
  Epic:     ['#6B4BFF','#B9A6FF','#FFFFFF'],
  Rare:     ['#4FC8F0','#B3EBFF','#FFFFFF'],
  Common:   ['#8FB573','#D6EAC4','#FFFFFF'],
};

/* Deep-link straight into Uniswap's add-liquidity flow for a given pool. */
window.uniswapAddUrl = function (strain) {
  if (strain.externalUrl) return strain.externalUrl;
  const base = 'https://app.uniswap.org/explore/pools/robinhood/';
  return base + (strain.poolAddress || strain.poolId || '');
};

/* Where SHROOMS itself lives. Pons is the launch venue: 1% pool fee, 70% of it
   to the creator, fixed supply, liquidity locked at launch. */
window.GET_SHROOMS_URL = 'https://ponsfamily.com/';
