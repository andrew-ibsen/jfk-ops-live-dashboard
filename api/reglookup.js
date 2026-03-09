import { checkAuth, queryParam } from './_auth.js'

async function fetchWithTimeout(url, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try { return await fetch(url, { signal: ctrl.signal }) } finally { clearTimeout(t) }
}

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return
  try {
    const hex = String(queryParam(req, 'hex', '')).toLowerCase().trim()
    if (!hex) return res.status(400).json({ ok: false, reason: 'missing_hex' })

    const candidates = [
      `https://opensky-network.org/api/metadata/aircraft/icao/${encodeURIComponent(hex)}`,
      `https://hexdb.io/api/v1/aircraft/${encodeURIComponent(hex)}`
    ]

    for (const url of candidates) {
      try {
        const r = await fetchWithTimeout(url)
        if (!r.ok) continue
        const j = await r.json().catch(() => null)
        const registration = j?.registration || j?.reg || j?.tail || j?.aircraft?.registration || ''
        if (registration) return res.status(200).json({ ok: true, hex, registration })
      } catch {}
    }

    res.status(200).json({ ok: false, hex, reason: 'not_found' })
  } catch (e) {
    res.status(500).json({ ok: false, reason: e?.message || 'reglookup_failed' })
  }
}
