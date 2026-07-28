const API_BASE = import.meta.env.VITE_API_BASE || ''

/**
 * Fetch JSON from the GeoPipe API.
 * @param {string} path
 * @param {RequestInit & { apiKey?: string }} [options]
 */
export async function api(path, options = {}) {
  const { apiKey, headers, ...rest } = options
  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      ...headers,
    },
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw new Error(detail.detail || `Request failed (${response.status})`)
  }
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response
}
