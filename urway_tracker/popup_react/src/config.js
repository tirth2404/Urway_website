export const BRIDGE_BASE_URL = (import.meta.env.VITE_BRIDGE_URL || 'http://localhost:5002').replace(/\/$/, '')

export function bridgeUrl(path) {
  return `${BRIDGE_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
