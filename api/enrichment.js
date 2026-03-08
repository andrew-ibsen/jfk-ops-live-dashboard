const { checkAuth } = require('./_auth')

async function fetchWithTimeout(url, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try { return await fetch(url, { signal: ctrl.signal }) } finally { clearTimeout(t) }
}

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return
  try {
    const key = process.env.AVIATIONSTACK_KEY || ''
    if (!key) return res.status(200).json({ data: [], meta: { ok: false, rows: 0, reason: 'missing_key' } })
    const station = req.query.station || 'JFK'
    const url = `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(key)}&arr_iata=${encodeURIComponent(station)}&limit=100`
    const resp = await fetchWithTimeout(url)
    const json = resp.ok ? await resp.json() : { data: [] }
    const rows = json.data || []
    res.status(200).json({ data: rows, meta: { ok: resp.ok, rows: rows.length, reason: resp.ok ? 'ok' : `http_${resp.status}` } })
  } catch (e) {
    res.status(500).json({ data: [], meta: { ok: false, rows: 0, reason: e?.name === 'AbortError' ? 'timeout' : 'proxy_error' } })
  }
}
