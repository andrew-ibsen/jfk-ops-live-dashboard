import { checkAuth, queryParam } from './_auth.js'

async function fetchWithTimeout(url, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try { return await fetch(url, { signal: ctrl.signal }) } finally { clearTimeout(t) }
}

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return
  try {
    const global = queryParam(req, 'global', '0') === '1'
    const prefix = String(queryParam(req, 'prefix', '') || '').toUpperCase().trim()

    const lamin = queryParam(req, 'lamin', '40.2')
    const lomin = queryParam(req, 'lomin', '-74.3')
    const lamax = queryParam(req, 'lamax', '41.1')
    const lomax = queryParam(req, 'lomax', '-73.2')
    const url = global
      ? 'https://opensky-network.org/api/states/all'
      : `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`

    const r = await fetchWithTimeout(url, global ? 15000 : 12000)
    const json = await r.json().catch(() => ({}))
    let states = Array.isArray(json?.states) ? json.states : []

    if (global && prefix) {
      states = states.filter((s) => String(s?.[1] || '').trim().toUpperCase().startsWith(prefix)).slice(0, 300)
    }

    const rows = states.length
    const meta = { ok: r.ok, rows, reason: r.ok ? (global ? 'ok_global' : 'ok') : `http_${r.status}` }
    // Graceful fail: keep API contract stable for UI even when OpenSky is blocked/rate-limited upstream.
    res.status(200).json({ states, meta })
  } catch (e) {
    res.status(200).json({ states: [], meta: { ok: false, rows: 0, reason: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'proxy_error') } })
  }
}
