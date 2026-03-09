import { checkAuth, queryParam } from './_auth.js'

async function fetchWithTimeout(url, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try { return await fetch(url, { signal: ctrl.signal }) } finally { clearTimeout(t) }
}

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return
  try {
    const station = queryParam(req, 'station', 'JFK')
    const url = `https://wttr.in/${encodeURIComponent(station)}?format=j1`
    const r = await fetchWithTimeout(url)
    const text = await r.text()
    res.status(r.ok ? 200 : 502).setHeader('Content-Type', 'application/json')
    res.send(text)
  } catch (e) {
    res.status(500).json({ error: e?.message || 'weather proxy failed' })
  }
}
