export const WALLET_IDS = {
  ARGENT_X: 'argentX',
  BRAAVOS: 'braavos',
  CONTROLLER: 'controller'
};

const connectorAliases = {
  argentWebWallet: WALLET_IDS.CONTROLLER,
  webWallet: WALLET_IDS.CONTROLLER,
  cartridge: WALLET_IDS.CONTROLLER,
  'controller-keychain': WALLET_IDS.CONTROLLER,
  [WALLET_IDS.ARGENT_X]: WALLET_IDS.ARGENT_X,
  [WALLET_IDS.BRAAVOS]: WALLET_IDS.BRAAVOS,
  [WALLET_IDS.CONTROLLER]: WALLET_IDS.CONTROLLER
};

export const normalizeConnectorId = (id) => connectorAliases[id] || id;
