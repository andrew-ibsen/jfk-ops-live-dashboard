import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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
        server.middlewares.use('/api/opensky', async (req, res) => {
          try {
            const u = new URL(req.url || '', 'http://localhost')
            const lamin = u.searchParams.get('lamin') || '40.2'
            const lomin = u.searchParams.get('lomin') || '-74.3'
            const lamax = u.searchParams.get('lamax') || '41.1'
            const lomax = u.searchParams.get('lomax') || '-73.2'
            const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`
            const r = await fetch(url)
            const txt = await r.text()
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = r.status
            res.end(txt)
          } catch (e: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e?.message || 'opensky proxy failed' }))
          }
        })

        server.middlewares.use('/api/enrichment', async (req, res) => {
          try {
            if (!aviationstackKey) {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ data: [], meta: { reason: 'missing_key' } }))
              return
            }
            const u = new URL(req.url || '', 'http://localhost')
            const station = u.searchParams.get('station') || 'JFK'
            const mk = (kind: 'arr_iata' | 'dep_iata') =>
              `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(aviationstackKey)}&${kind}=${encodeURIComponent(station)}&limit=100`

            const [arrResp, depResp] = await Promise.all([fetch(mk('arr_iata')), fetch(mk('dep_iata'))])
            const arrJson: any = arrResp.ok ? await arrResp.json() : { data: [] }
            const depJson: any = depResp.ok ? await depResp.json() : { data: [] }
            const merged = [...(arrJson.data || []), ...(depJson.data || [])]

            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 200
            res.end(JSON.stringify({ data: merged, meta: { arrOk: arrResp.ok, depOk: depResp.ok, keyLoaded: true } }))
          } catch (e: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e?.message || 'enrichment proxy failed' }))
          }
        })
      }
    }
  ]
}
})
