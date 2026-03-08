import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

async function fetchWithTimeout(url: string, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// Dev-only backend proxy/middleware to avoid CORS and keep keys out of browser.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const aviationstackKey = env.AVIATIONSTACK_KEY || ''

  return {
    plugins: [
      react(),
      {
        name: 'ops-api-proxy',
        configureServer(server) {
          let lastHealth: any = {
            opensky: { ok: false, rows: 0, reason: 'not_run' },
            enrichment: { ok: false, rows: 0, reason: aviationstackKey ? 'not_run' : 'missing_key' }
          }

          server.middlewares.use('/api/opensky', async (req, res) => {
            try {
              const u = new URL(req.url || '', 'http://localhost')
              const lamin = u.searchParams.get('lamin') || '40.2'
              const lomin = u.searchParams.get('lomin') || '-74.3'
              const lamax = u.searchParams.get('lamax') || '41.1'
              const lomax = u.searchParams.get('lomax') || '-73.2'
              const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`
              const r = await fetchWithTimeout(url)
              const json: any = await r.json().catch(() => ({}))
              const rows = Array.isArray(json?.states) ? json.states.length : 0
              lastHealth.opensky = { ok: r.ok, rows, reason: r.ok ? 'ok' : `http_${r.status}` }

              res.setHeader('Content-Type', 'application/json')
              res.statusCode = r.ok ? 200 : 502
              res.end(JSON.stringify({ states: json?.states || [], meta: lastHealth.opensky }))
            } catch (e: any) {
              lastHealth.opensky = { ok: false, rows: 0, reason: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'proxy_error') }
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ states: [], meta: lastHealth.opensky }))
            }
          })

          server.middlewares.use('/api/enrichment', async (req, res) => {
            try {
              if (!aviationstackKey) {
                lastHealth.enrichment = { ok: false, rows: 0, reason: 'missing_key' }
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ data: [], meta: lastHealth.enrichment }))
                return
              }

              const u = new URL(req.url || '', 'http://localhost')
              const station = u.searchParams.get('station') || 'JFK'
              const url = `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(aviationstackKey)}&arr_iata=${encodeURIComponent(station)}&limit=100`
              const resp = await fetchWithTimeout(url)
              const json: any = resp.ok ? await resp.json() : { data: [] }
              const rows = json.data || []

              lastHealth.enrichment = {
                ok: resp.ok,
                rows: rows.length,
                reason: resp.ok ? 'ok' : `http_${resp.status}`
              }

              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify({ data: rows, meta: lastHealth.enrichment }))
            } catch (e: any) {
              lastHealth.enrichment = { ok: false, rows: 0, reason: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'proxy_error') }
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ data: [], meta: lastHealth.enrichment }))
            }
          })

          server.middlewares.use('/api/health', (_req, res) => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, ...lastHealth }))
          })
        }
      }
    ]
  }
})
