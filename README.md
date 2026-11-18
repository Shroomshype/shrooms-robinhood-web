# Shrooms — front end

Six static pages for [Shrooms v4.0](https://github.com/Shroomshype/shrooms-robinhood-contracts)
on Robinhood Chain. No build step, no bundler, no framework.

```bash
npm start     # serve at :3000
npm test      # 25 animation and interaction checks
```

| Page | What it does |
|---|---|
| `index.html` | The pitch, and the whole cast bobbing out of phase |
| `farms.html` | The eight strains, live pool data, the stake sheet |
| `swap.html` | Swaps routed through Uniswap — the fee here funds the partner strains |
| `vault.html` | The treasury: reserve, backing, the redemption floor |
| `tokenomics.html` | The model, the charts, the live burn tracker |
| `grimoire.html` | How the whole thing works, in words |

## Pointing it at a deployment

Everything configurable is in `js/config.js` — chain, RPC, explorer, contract
addresses, the Uniswap addresses and the interface fee. Copy the addresses out
of `deployments/<network>.v4.json` in the contracts repo after deploying.

ABIs in `abis/` are generated, never hand-edited. Refresh them from a sibling
checkout of the contracts repo:

```bash
cd ../shrooms-robinhood-contracts && npm run compile && npm run abis
```

## Two things the pages deliberately will not do

**Pool APRs show an em-dash** until `poolDataUrl` in `js/config.js` points at
an indexer covering Robinhood Chain. APR is trailing fee yield over TVL and
needs historical volume, so there is no single RPC call for it — and the
figures stored in `js/data.js` are layout placeholders that are already wrong.
One pool was quoting 519% while the saved number said 114%. An em-dash is
honest; a stale number is not.

Every APR shown is **the Uniswap pool's own**. Shrooms does not pay it and does
not control it. The pages say so where the numbers appear.

**The swap tab does not execute.** It prices the interface fee openly and
stops. The real path is a quote through Uniswap's Trading API with
`integratorFees` set, then permit2 → UniversalRouter.

## Tests

`npm test` drives a real browser via Playwright. It checks that the idle bob
runs, loops and is staggered; that the transform actually changes between
frames; that touching a card switches it to happy-hop and it calms down; that
clicking injects sparkles, pops the mushroom and **cleans up** afterwards; that
Enter does the same as a tap; that poking never opens the stake sheet; that
`prefers-reduced-motion` genuinely stops the motion; that the charts draw; and
that nothing overflows at 390px.

If it cannot start a browser: `npx playwright install chromium`, or
`CHROME_PATH=/path/to/chrome npm test`.

## Related

[contracts](https://github.com/Shroomshype/shrooms-robinhood-contracts) ·
[keeper](https://github.com/Shroomshype/shrooms-robinhood-keeper) ·
[X](https://x.com/Shroomshype) · [Telegram](https://t.me/shroomshype)

MIT licensed.
