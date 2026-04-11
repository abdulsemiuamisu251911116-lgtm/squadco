import TrustLayer from '@hamduktrustlayerai/sdk'

function normalizeTrustLayerBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '')

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error(
      'TRUSTLAYER_API_URL must be a valid URL. Use http://localhost:3000/api locally or https://trustlayerai.labs.hamduk.com.ng/api in production.'
    )
  }

  if (parsed.port === '8000') {
    throw new Error(
      'TRUSTLAYER_API_URL is pointing to the AI engine. It must point to the TrustLayer control API, for example http://localhost:3000/api or https://trustlayerai.labs.hamduk.com.ng/api.'
    )
  }

  if (parsed.pathname === '/v1') {
    parsed.pathname = '/api'
  } else if (parsed.pathname === '/api/v1') {
    parsed.pathname = '/api'
  } else if (parsed.pathname === '' || parsed.pathname === '/') {
    parsed.pathname = '/api'
  }

  return parsed.toString().replace(/\/+$/, '')
}

if (!process.env.TRUSTLAYER_API_KEY) {
  throw new Error('TRUSTLAYER_API_KEY environment variable is required')
}

if (!process.env.TRUSTLAYER_API_URL) {
  throw new Error('TRUSTLAYER_API_URL environment variable is required')
}

const trustlayerClient = new TrustLayer({
  apiKey: process.env.TRUSTLAYER_API_KEY,
  baseUrl: normalizeTrustLayerBaseUrl(process.env.TRUSTLAYER_API_URL),
})

export default trustlayerClient
