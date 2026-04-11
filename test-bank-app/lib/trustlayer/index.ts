import trustlayerClient from './client'

export { default as TrustLayerClient } from './client'
export default trustlayerClient

type WrappedResponse<T> = {
  request_id?: string
  data?: T
}

function unwrap<T extends Record<string, unknown>>(result: unknown): T & { request_id?: string } {
  if (
    result &&
    typeof result === 'object' &&
    'data' in result &&
    typeof (result as WrappedResponse<T>).data === 'object' &&
    (result as WrappedResponse<T>).data !== null
  ) {
    return {
      ...((result as WrappedResponse<T>).data as T),
      request_id: (result as WrappedResponse<T>).request_id,
    }
  }

  return result as T & { request_id?: string }
}

export function getTrustLayerClient() {
  return {
    transaction: {
      analyze: async (...args: Parameters<typeof trustlayerClient.transaction.analyze>) =>
        unwrap(await trustlayerClient.transaction.analyze(...args)),
    },
    customer: {
      register: async (...args: Parameters<typeof trustlayerClient.customer.register>) =>
        unwrap(await trustlayerClient.customer.register(...args)),
      getProfile: async (...args: Parameters<typeof trustlayerClient.customer.getProfile>) =>
        unwrap(await trustlayerClient.customer.getProfile(...args)),
    },
    credit: {
      analyze: async (...args: Parameters<typeof trustlayerClient.credit.analyze>) =>
        unwrap(await trustlayerClient.credit.analyze(...args)),
    },
    assistant: {
      chat: async (...args: Parameters<typeof trustlayerClient.assistant.chat>) =>
        unwrap(await trustlayerClient.assistant.chat(...args)),
    },
    webhooks: {
      register: async (...args: Parameters<typeof trustlayerClient.webhooks.register>) =>
        unwrap(await trustlayerClient.webhooks.register(...args)),
    },
  }
}
