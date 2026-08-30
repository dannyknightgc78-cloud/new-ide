// Queen ops bridge → Hostman ops-agent (:8788) for tunnel heal/status.
const OPS_BASE = (
  process.env.OPS_AGENT_URL || 'http://host.docker.internal:8788'
).replace(/\/$/, '')
const OPS_TOKEN = process.env.QUEEN_OPS_TOKEN || process.env.OPS_HEAL_TOKEN || ''

async function opsFetch(path, { method = 'GET', timeoutMs = 45000 } = {}) {
  const headers = { Accept: 'application/json' }
  if (OPS_TOKEN) headers['x-queen-ops-token'] = OPS_TOKEN
  const res = await fetch(`${OPS_BASE}${path}`, {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text.slice(0, 500) }
  }
  if (!res.ok) {
    const err = new Error(body.error || body.message || body.detail || `ops ${res.status}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

export function opsConfigured() {
  return Boolean(OPS_BASE)
}

export async function tunnelStatus() {
  return opsFetch('/api/ops/tunnel/status', { method: 'GET', timeoutMs: 15000 })
}

export async function tunnelHeal() {
  return opsFetch('/api/ops/tunnel/heal', { method: 'POST', timeoutMs: 90000 })
}
