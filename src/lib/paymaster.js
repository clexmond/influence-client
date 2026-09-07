import { PaymasterRpc } from 'starknet';

import { getApiAuthHeaders } from './apiAuth';

export const createAuthenticatedPaymasterRpc = ({ getAuthHeaders = getApiAuthHeaders, nodeUrl }) => new PaymasterRpc({
  nodeUrl,
  baseFetch: (url, options = {}) => {
    const headers = {
      ...(options.headers || {}),
      ...getAuthHeaders()
    };

    return fetch(url, {
      ...options,
      headers
    });
  }
});
