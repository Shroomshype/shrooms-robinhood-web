/* Deployed addresses. Filled in after scripts/deploy-v4.js runs — copy them out
   of deployments/<network>.v4.json. The site reads from here so you never have
   to edit markup to point at a new deployment. */

window.SHROOMS_CONFIG = {
  version: '4.0',

  // Robinhood Chain testnet. Switch to the mainnet block below for 4663.
  chainId: 46630,
  chainName: 'Robinhood Chain Testnet',
  rpcUrl: 'https://rpc.testnet.chain.robinhood.com',
  explorer: 'https://explorer.testnet.chain.robinhood.com',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },

  // Mainnet, for when it is time:
  //   chainId: 4663,
  //   chainName: 'Robinhood Chain',
  //   rpcUrl:  'https://rpc.mainnet.chain.robinhood.com',
  //   explorer:'https://robinhoodchain.blockscout.com',

  contracts: {
    LiquiditySpores: '0x0000000000000000000000000000000000000000',
    SporesToken:     '0x0000000000000000000000000000000000000000',
    ShroomsFarmV4:   '0x0000000000000000000000000000000000000000',
    ShroomsTimelock: '0x0000000000000000000000000000000000000000',
  },

  // Uniswap v3 on Robinhood Chain. These are the real mainnet addresses; on
  // testnet they are replaced by the mocks that deploy-uniswap-testnet.js
  // writes, because Uniswap is not deployed on 46630 at all.
  uniswap: {
    factory:         '0x1f7d7550b1b028f7571e69a784071f0205fd2efa',
    positionManager: '0x73991a25c818bf1f1128deaab1492d45638de0d3',
    swapRouter02:    '0xcaf681a66d020601342297493863e78c959e5cb2',
    universalRouter: '0x8876789976decbfcbbbe364623c63652db8c0904',
    quoterV2:        '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7',
    permit2:         '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    weth:            '', // required: the treasury unwraps Pons fee income from it
  },

  tokens: {
    SHROOMS: '0x0000000000000000000000000000000000000000',
    USDG:    '0x0000000000000000000000000000000000000000',
  },

  // Pons pool fee, as a decimal. 1%, of which the creator keeps 70%, so every
  // 100 ETH of SHROOMS volume sends 0.70 ETH toward the treasury.
  tradeFeeRate: 0.01,
  ponsCreatorShare: 0.7,

  // Fee this interface takes on swaps routed through it, in basis points.
  // This is the ONLY revenue the partner strains generate, and therefore the
  // only thing funding their SPORES rewards. Set to 0 to charge nothing.
  integratorFeeBps: 25,

  // true once scripts/timelock-accept.js reports the handover complete.
  ownerIsTimelock: false,
};
