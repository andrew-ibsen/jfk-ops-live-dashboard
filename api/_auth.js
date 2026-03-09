function headerValue(req, key) {
  const k = String(key || '').toLowerCase()
  const h = req?.headers
  if (!h) return ''
  if (typeof h.get === 'function') return String(h.get(k) || '')
  return String(h[k] || h[key] || '')
}

function checkAuth(req, res) {
  const provided = headerValue(req, 'x-ops-password')
  const masterPassword = process.env.DASHBOARD_MASTER_PASSWORD || 'BAENGJFK'
  const dailyPassword = process.env.DASHBOARD_DAILY_PASSWORD || ''

  const valid = [masterPassword, dailyPassword].filter(Boolean)
  if (!provided || !valid.includes(provided)) {
    res.status(401).json({ ok: false, reason: 'http_401' })
    return false
  }
  return true
}

function queryParam(req, key, fallback = '') {
  if (req?.query && key in req.query) return String(req.query[key] ?? fallback)
  try {
    const u = new URL(req?.url || '', 'http://localhost')
    return String(u.searchParams.get(key) ?? fallback)
  } catch {
    return String(fallback)
  }
}

export { checkAuth, queryParam, headerValue }
