const { TextDecoder, TextEncoder } = require('util');

global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

jest.mock('~/hooks/useStore', () => ({
  __esModule: true,
  default: {
    getState: () => ({ currentSession: {} })
  }
}), { virtual: true });

const { createAuthenticatedPaymasterRpc } = require('./paymaster');

test('adds shared Influence auth headers to paymaster requests', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ result: true })
  });

  const paymaster = createAuthenticatedPaymasterRpc({
    getAuthHeaders: () => ({ Authorization: 'Bearer updated-token' }),
    nodeUrl: 'https://paymaster.example'
  });

  await paymaster.isAvailable();

  expect(global.fetch).toHaveBeenCalledWith('https://paymaster.example', expect.objectContaining({
    headers: expect.objectContaining({
      Authorization: 'Bearer updated-token'
    })
  }));

  global.fetch = originalFetch;
});
