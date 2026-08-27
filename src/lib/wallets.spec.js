jest.mock('@cartridge/controller', () => ({
  __esModule: true,
  default: jest.fn()
}), { virtual: true });

import { isUnsupportedWalletDisconnectError } from './walletErrors';
import { createWalletConnectors, WALLET_IDS } from './wallets';
import ControllerProvider from '@cartridge/controller';

beforeEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

test('identifies injected wallets that do not support wallet_disconnect', () => {
  expect(isUnsupportedWalletDisconnectError(
    new Error('Unknown request type: wallet_disconnect')
  )).toBe(true);

  expect(isUnsupportedWalletDisconnectError(
    'Unknown request type: wallet_disconnect'
  )).toBe(true);
});

test('does not hide unrelated disconnect errors', () => {
  expect(isUnsupportedWalletDisconnectError(
    new Error('Wallet transport failed')
  )).toBe(false);
});

test('cleans stale Cartridge controller state on disconnect', async () => {
  document.body.innerHTML = '<div id="controller"></div>';
  document.head.innerHTML = '<meta id="controller-viewport" />';

  const disconnect = jest.fn().mockRejectedValue(
    new TypeError("Cannot read properties of undefined (reading 'toLowerCase')")
  );

  ControllerProvider.mockImplementation(function mockControllerProvider() {
    this.account = { address: '0x1' };
    this.disconnect = disconnect;
    this.subscriptions = [
      { type: 'accountsChanged', handler: jest.fn() },
      { type: 'networkChanged', handler: jest.fn() }
    ];
  });

  const connectors = createWalletConnectors({
    [WALLET_IDS.CONTROLLER]: true,
    [WALLET_IDS.ARGENT_X]: false,
    [WALLET_IDS.BRAAVOS]: false
  });
  const controller = ControllerProvider.mock.instances[0];

  expect(document.getElementById('controller')).toBeNull();
  expect(document.getElementById('controller-viewport')).toBeNull();

  document.body.innerHTML = '<div id="controller"></div>';
  document.head.innerHTML = '<meta id="controller-viewport" />';

  await expect(connectors[WALLET_IDS.CONTROLLER].disconnect()).resolves.toBeUndefined();

  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(controller.account).toBeUndefined();
  expect(controller.subscriptions).toHaveLength(1);
  expect(controller.subscriptions[0].type).toBe('networkChanged');
  expect(document.getElementById('controller')).toBeNull();
  expect(document.getElementById('controller-viewport')).toBeNull();
});
