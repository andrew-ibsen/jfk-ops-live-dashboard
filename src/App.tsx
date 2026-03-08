import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { STAFF_BY_STATION } from './stationStaff'
import { STATION_AIRLINES } from './stationAirlines'

type Staff = { name: string; role: 'Mechanic' | 'Certifier'; shift?: string; absence?: string }
type LiveStage = 'scheduled' | 'airborne' | 'arrived' | 'landing' | 'departed' | 'taxi' | 'cancelled'

type Flight = {
  key: string
  airline: string
  flight: string
  eta?: string
  std?: string
  reg?: string
  terminal?: string
  gate?: string
  status?: LiveStage
  aircraftType?: string
}

type Assignments = Record<string, { certifier?: string; mechanic?: string; station?: string }>
type EnrichmentCache = Record<string, { reg?: string; type?: string; updatedAt: number }>
type HexRegCache = Record<string, { reg: string; updatedAt: number }>
type ManualRegOverrides = Record<string, string>
type ManualTypeOverrides = Record<string, string>
type ManualGateOverrides = Record<string, string>
type ManualNotes = Record<string, string>

type WeatherSnapshot = {
  tempC: string
  precipMm: string
  nowDesc: string
  morning: string
  afternoon: string
  evening: string
}

type Station = { code: string; name: string; bbox: { lamin: number; lomin: number; lamax: number; lomax: number } }

const DEFAULT_BBOX = { lamin: 40.2, lomin: -74.3, lamax: 41.1, lomax: -73.2 } // fallback until per-station bbox map is added

const STATIONS: Station[] = [
  { code: 'ABV', name: 'ABV', bbox: DEFAULT_BBOX },
  { code: 'ATL', name: 'ATL', bbox: DEFAULT_BBOX },
  { code: 'AUS', name: 'AUS', bbox: DEFAULT_BBOX },
  { code: 'BAH', name: 'BAH', bbox: DEFAULT_BBOX },
  { code: 'BCN', name: 'BCN', bbox: DEFAULT_BBOX },
  { code: 'BLR', name: 'BLR', bbox: DEFAULT_BBOX },
  { code: 'BNA', name: 'BNA', bbox: DEFAULT_BBOX },
  { code: 'BOM', name: 'BOM', bbox: DEFAULT_BBOX },
  { code: 'BOS', name: 'BOS', bbox: DEFAULT_BBOX },
  { code: 'BWI', name: 'BWI', bbox: DEFAULT_BBOX },
  { code: 'CAI', name: 'CAI', bbox: DEFAULT_BBOX },
  { code: 'DEL', name: 'DEL', bbox: DEFAULT_BBOX },
  { code: 'DEN', name: 'DEN', bbox: DEFAULT_BBOX },
  { code: 'DFW', name: 'DFW', bbox: DEFAULT_BBOX },
  { code: 'EDI', name: 'EDI', bbox: DEFAULT_BBOX },
  { code: 'EWR', name: 'EWR', bbox: DEFAULT_BBOX },
  { code: 'GLA', name: 'GLA', bbox: DEFAULT_BBOX },
  { code: 'HYD', name: 'HYD', bbox: DEFAULT_BBOX },
  { code: 'IAD', name: 'IAD', bbox: DEFAULT_BBOX },
  { code: 'IAH', name: 'IAH', bbox: DEFAULT_BBOX },
  { code: 'JFK', name: 'JFK', bbox: { lamin: 39.7, lomin: -75.2, lamax: 41.8, lomax: -72.5 } },
  { code: 'LAS', name: 'LAS', bbox: DEFAULT_BBOX },
  { code: 'LAX', name: 'LAX', bbox: DEFAULT_BBOX },
  { code: 'LGW', name: 'LGW', bbox: { lamin: 51.0, lomin: -0.4, lamax: 51.3, lomax: 0.1 } },
  { code: 'LOS', name: 'LOS', bbox: DEFAULT_BBOX },
  { code: 'MAD', name: 'MAD', bbox: DEFAULT_BBOX },
  { code: 'MAN', name: 'MAN', bbox: DEFAULT_BBOX },
  { code: 'MCO', name: 'MCO', bbox: DEFAULT_BBOX },
  { code: 'MIA', name: 'MIA', bbox: DEFAULT_BBOX },
  { code: 'NCL', name: 'NCL', bbox: DEFAULT_BBOX },
  { code: 'ORD', name: 'ORD', bbox: DEFAULT_BBOX },
  { code: 'PDX', name: 'PDX', bbox: DEFAULT_BBOX },
  { code: 'PHL', name: 'PHL', bbox: DEFAULT_BBOX },
  { code: 'PHX', name: 'PHX', bbox: DEFAULT_BBOX },
  { code: 'SAN', name: 'SAN', bbox: DEFAULT_BBOX },
  { code: 'SEA', name: 'SEA', bbox: DEFAULT_BBOX },
  { code: 'SFO', name: 'SFO', bbox: DEFAULT_BBOX },
  { code: 'STL', name: 'STL', bbox: DEFAULT_BBOX },
  { code: 'SYD', name: 'SYD', bbox: DEFAULT_BBOX },
  { code: 'TBC', name: 'TBC', bbox: DEFAULT_BBOX },
  { code: 'TPA', name: 'TPA', bbox: DEFAULT_BBOX },
  { code: 'YUL', name: 'YUL', bbox: DEFAULT_BBOX },
  { code: 'YYC', name: 'YYC', bbox: DEFAULT_BBOX },
  { code: 'YYZ', name: 'YYZ', bbox: DEFAULT_BBOX }
]

const HANDLED_AIRLINES = ['BA', 'EI', 'IB', 'LL', 'AY', 'QF', 'NZ', 'NO', 'Z0', 'NH', 'JL']

const JFK_BA_DAY_OVERRIDES: Record<string, { eta?: string; std?: string; gate?: string; note?: string }> = {
  'BA117/176': { eta: '1217', std: '2110', gate: '18C' },
  'BA175/172': { eta: '1334', std: '2140', gate: '18D' },
  'BA173/112': { eta: '1521', std: '1915', gate: '20' },
  'BA177/174': { eta: '1658', std: '1950', gate: '16' },
  'BA115/116': { eta: '1810', std: '2105', gate: '14' },
  'BA113/114': { eta: '2035', std: '2235', gate: '18', note: 'cancelled' },
  'BA179/182': { eta: '2205', std: '0020', gate: '14' },
  'BA183/178': { eta: '2305', std: '0905', gate: '20' }
}

const PLANNED: Omit<Flight, 'key' | 'reg' | 'status'>[] = [
  { airline: 'EI', flight: 'EI105/104', eta: '1455', std: '1800', aircraftType: 'A330' },
  { airline: 'EI', flight: 'EI111/110', eta: '1625', std: '1830', aircraftType: 'A321' },
  { airline: 'EI', flight: 'EI107/106', eta: '2029', std: '2200', aircraftType: 'A321' },
  { airline: 'IB', flight: 'IB211/212', eta: '1625', std: '1755', aircraftType: 'A32X' },
  { airline: 'IB', flight: 'IB325/326', eta: '2015', std: '2150', aircraftType: 'A330' },
  { airline: 'LL', flight: 'IB2627/2628', eta: '2200', std: '2325', aircraftType: 'A330' },
  { airline: 'AY', flight: 'AY15/16', eta: '2005', std: '2345', aircraftType: 'A330' },
  { airline: 'QF', flight: 'QF3/4', eta: '1525', std: '1815', aircraftType: 'B787' },
  { airline: 'NZ', flight: 'NZ2/1', eta: '1700', std: '1920', aircraftType: 'B787' },
  { airline: 'Z0', flight: 'Z0701/702', eta: '1655', std: '1905', aircraftType: 'B787' },
  { airline: 'NH', flight: 'NH110/109', eta: '1130', std: '1405', aircraftType: 'B777' },
  { airline: 'NH', flight: 'NH159/160', eta: '2250', std: '0150', aircraftType: 'B777' },
  { airline: 'JL', flight: 'JL006/005', eta: '1100', std: '1350', aircraftType: 'A350' },
  { airline: 'JL', flight: 'JL004/003', eta: '1940', std: '0140', aircraftType: 'A350' },
  { airline: 'BA', flight: 'BA117/176', eta: '1217', std: '2110', gate: '18C' },
  { airline: 'BA', flight: 'BA175/172', eta: '1334', std: '2140', gate: '18D' },
  { airline: 'BA', flight: 'BA173/112', eta: '1521', std: '1915', gate: '20' },
  { airline: 'BA', flight: 'BA177/174', eta: '1658', std: '1950', gate: '16', aircraftType: 'B787' },
  { airline: 'BA', flight: 'BA115/116', eta: '1810', std: '2105', gate: '14' },
  { airline: 'BA', flight: 'BA113/114', eta: '2035', std: '2235', gate: '18', aircraftType: 'B787' },
  { airline: 'BA', flight: 'BA179/182', eta: '2205', std: '0020', gate: '14' },
  { airline: 'BA', flight: 'BA183/178', eta: '2305', std: '0905', gate: '20' }
]

function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []; let cur = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') { if (q && text[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (c === ',' && !q) { row.push(cur.trim()); cur = '' }
    else if ((c === '\n' || c === '\r') && !q) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur.trim()); if (row.some(Boolean)) out.push(row); row = []; cur = '' }
    else cur += c
  }
  if (cur.length || row.length) { row.push(cur.trim()); if (row.some(Boolean)) out.push(row) }
  return out
}

function flightPairToken(text: string) {
  const m = (text || '').match(/(\d{3,4})\s*\/\s*(\d{3,4})/)
  return m ? `${m[1]}/${m[2]}` : ''
}

function parseDailyActivity(rows: string[][]) {
  const date = rows.find((r) => /\d{2}\/\d{2}\/\d{4}/.test(r[0] || ''))?.[0]?.split(' ')[0]
  const flights: Flight[] = []
  const staff: Staff[] = []
  const suggestedAssignments: Assignments = {}

  const fs = rows.findIndex((r) => r.includes('A/C REG'))
  for (let i = fs + 1; fs >= 0 && i < rows.length; i++) {
    const r = rows[i]
    if ((r[0] || '').toLowerCase().includes('mechanics')) break
    const arr = r[2] || ''
    const dep = r[5] || ''
    if (!arr && !dep) continue
    const code = (arr || dep).replace(/\s+/g, '')
    const airline = code.slice(0, 2).toUpperCase()
    flights.push({ key: `${airline}-${code}-${i}`, airline, flight: code, eta: r[3], std: r[6], reg: r[1], status: 'scheduled' })
  }

  const ss = rows.findIndex((r) => (r[0] || '').toLowerCase() === 'mechanics')
  let currentMech = ''
  let currentCert = ''
  for (let i = ss + 1; ss >= 0 && i < rows.length; i++) {
    const r = rows[i]
    if ((r[0] || '').startsWith('Shift A')) break

    const mech = (r[0] || '').trim()
    const cert = (r[3] || '').trim()
    const op = (r[5] || '').trim()

    if (mech) {
      currentMech = mech
      staff.push({ name: mech, role: 'Mechanic', shift: r[2] })
    }
    if (cert) {
      currentCert = cert
      staff.push({ name: cert, role: 'Certifier', shift: r[4] || r[5] })
    }
    if (r[7]) staff.push({ name: r[7], role: 'Mechanic', absence: r[9] || 'Absent' })

    const pair = flightPairToken(op)
    if (pair) {
      const key = `BA${pair}`
      suggestedAssignments[key] = {
        certifier: currentCert || undefined,
        mechanic: currentMech || undefined
      }
    }
  }

  return { date, flights, staff, suggestedAssignments }
}

function normalizeTime(v?: string) {
  if (!v) return undefined
  const d = String(v).replace(/[^0-9]/g, '')
  if (d.length === 3) return `0${d}`
  if (d.length >= 4) return d.slice(0, 4)
  return undefined
}
function toMinutes(v?: string) {
  const t = normalizeTime(v)
  if (!t) return undefined
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(2, 4))
}

function ganttSegments(startMin: number, endMin: number) {
  // returns 1 or 2 clipped segments in [0..100]% timeline
  const day = 24 * 60
  if (endMin >= startMin) {
    return [{ left: (startMin / day) * 100, width: Math.max(((endMin - startMin) / day) * 100, 1.2) }]
  }
  // overnight split
  return [
    { left: (startMin / day) * 100, width: Math.max(((day - startMin) / day) * 100, 1.2) },
    { left: 0, width: Math.max((endMin / day) * 100, 1.2) }
  ]
}

function authHeaders(password?: string): Record<string, string> {
  if (!password) return {}
  return { 'x-ops-password': password }
}

async function fetchOpenSky(station: Station, allowedPrefixes: string[], password?: string) {
  const url = `/api/opensky?lamin=${station.bbox.lamin}&lomin=${station.bbox.lomin}&lamax=${station.bbox.lamax}&lomax=${station.bbox.lomax}`
  const res = await fetch(url, { headers: authHeaders(password) })
  const json = await res.json().catch(() => ({}))
  const states = (json.states || []) as any[]
  const prefixes = allowedPrefixes.length ? allowedPrefixes : ['BAW', 'EIN', 'IBE', 'QFA', 'ANZ', 'NAX', 'JAL', 'ANA', 'FIN', 'LYX']
  const rows = states
    .filter((s) => prefixes.some((p) => String(s[1] || '').trim().startsWith(p)))
    .map((s) => {
      const onGround = Boolean(s[8])
      const velocity = Number(s[9] || 0)
      const verticalRate = Number(s[11] || 0)
      const geoAlt = Number(s[13] || s[7] || 0)

      let status: LiveStage = 'scheduled'
      if (onGround && velocity > 7) status = 'taxi'
      else if (onGround) status = 'arrived'
      else if (!onGround && geoAlt < 1200 && verticalRate < -1.5) status = 'landing'
      else if (!onGround && geoAlt < 1500 && verticalRate > 1.5) status = 'departed'
      else status = 'airborne'

      return { callsign: String(s[1] || '').trim(), hex: String(s[0] || '').toUpperCase(), status }
    })

  return { rows, meta: json?.meta || { ok: res.ok, rows: states.length, reason: res.ok ? 'ok' : `http_${res.status}` } }
}

function primaryFlightToken(flight: string) {
  return (flight.split('/')[0] || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
}

function flightTokens(flight: string) {
  // BA117/176 => [BA117, BA176]
  const m = flight.toUpperCase().match(/^([A-Z]{1,3})(\d{1,4})\/(\d{1,4})$/)
  if (!m) return [primaryFlightToken(flight)]
  const p = m[1]
  return [`${p}${Number(m[2])}`, `${p}${Number(m[3])}`]
}

function terminalNumber(v?: string) {
  const s = String(v || '').toUpperCase().trim()
  const m = s.match(/\d+/)
  return m ? m[0] : ''
}

function defaultTerminalForAirline(airline: string) {
  const a = airline.toUpperCase()
  // Business rules provided by ops (subject to annual airport changes).
  if (a === 'NZ') return '1'
  if (a === 'NH' || a === 'EI' || a === 'NO' || a === 'Z0') return '7'
  if (['BA', 'IB', 'LL', 'AY', 'QF', 'JL'].includes(a)) return '8'
  return ''
}

function defaultAircraftTypeForFlight(stationCode: string, airline: string) {
  const a = airline.toUpperCase()
  if (a !== 'BA') return ''
  if (stationCode === 'JFK') return 'B787/B772/B773'
  return 'B787/B772/B773/A350'
}

function normalizeRegByAirline(airline: string, reg?: string) {
  const a = airline.toUpperCase()
  const prefixMap: Record<string, string> = {
    BA: 'G',
    NO: 'G',
    Z0: 'G',
    JL: 'JA',
    NH: 'JA',
    EI: 'EI',
    IB: 'EC',
    LL: 'EC',
    QF: 'VH',
    NZ: 'ZK',
    AY: 'AY'
  }

  const p = prefixMap[a]
  if (!p) return reg || ''

  const r = String(reg || '').toUpperCase().replace(/\s+/g, '')
  if (!r) return `${p}-`
  if (r.startsWith(`${p}-`)) return r
  if (r.startsWith(p) && r.length > p.length) return `${p}-${r.slice(p.length).replace(/^-+/, '')}`

  const suffixFromHyphen = r.includes('-') ? r.split('-').slice(1).join('') : ''
  const suffix = suffixFromHyphen || r.replace(/^[A-Z]+/, '')
  return suffix ? `${p}-${suffix}` : `${p}-`
}

function normalizeLiveToken(callsign: string) {
  const raw = String(callsign || '').toUpperCase().replace(/\s+/g, '')
  const m = raw.match(/^([A-Z]{2,3})(0*\d{1,4})/)
  if (!m) return ''
  const prefix = m[1]
  const num = Number(m[2])
  const map: Record<string, string> = {
    BAW: 'BA', BA: 'BA',
    EIN: 'EI', EI: 'EI',
    IBE: 'IB', IB: 'IB',
    QFA: 'QF', QF: 'QF',
    ANZ: 'NZ', NZ: 'NZ',
    NAX: 'NO', NO: 'NO',
    JAL: 'JL', JL: 'JL',
    ANA: 'NH', NH: 'NH',
    FIN: 'AY', AY: 'AY',
    LYX: 'LL', LL: 'LL'
  }
  const p = map[prefix] || prefix.slice(0, 2)
  return `${p}${num}`
}

function mapEnrichmentStatus(s?: string): LiveStage | undefined {
  const v = String(s || '').toLowerCase()
  if (!v) return undefined
  if (v.includes('cancel')) return 'cancelled'
  if (v.includes('land') || v.includes('arriv')) return 'arrived'
  if (v.includes('depart') || v.includes('takeoff')) return 'departed'
  if (v.includes('active') || v.includes('en-route') || v.includes('enroute') || v.includes('air')) return 'airborne'
  if (v.includes('sched')) return 'scheduled'
  return undefined
}

async function fetchWeather(stationCode: string, password?: string): Promise<WeatherSnapshot | null> {
  const res = await fetch(`/api/weather?station=${encodeURIComponent(stationCode)}`, { headers: authHeaders(password) })
  if (!res.ok) return null
  const j = await res.json().catch(() => null as any)
  if (!j?.current_condition?.[0] || !j?.weather?.[0]?.hourly) return null

  const cc = j.current_condition[0]
  const hourly = j.weather[0].hourly as any[]
  const pick = (target: number) => {
    let best = hourly[0]
    let bestDiff = Infinity
    for (const h of hourly) {
      const t = Number(h.time || 0)
      const diff = Math.abs(t - target)
      if (diff < bestDiff) { best = h; bestDiff = diff }
    }
    return `${best.weatherDesc?.[0]?.value || ''} ${best.tempC ? `${best.tempC}°C` : ''}`.trim()
  }

  return {
    tempC: String(cc.temp_C || '-'),
    precipMm: String(cc.precipMM || '0'),
    nowDesc: String(cc.weatherDesc?.[0]?.value || ''),
    morning: pick(900),
    afternoon: pick(1500),
    evening: pick(2100)
  }
}

function weatherEmoji(desc?: string) {
  const d = String(desc || '').toLowerCase()
  if (d.includes('thunder')) return '⛈️'
  if (d.includes('snow') || d.includes('sleet') || d.includes('blizzard')) return '❄️'
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower')) return '🌧️'
  if (d.includes('fog') || d.includes('mist') || d.includes('haze') || d.includes('low vis')) return '🌫️'
  if (d.includes('cloud') || d.includes('overcast')) return '☁️'
  if (d.includes('clear night')) return '🌙'
  if (d.includes('sun') || d.includes('clear')) return '☀️'
  return '🌤️'
}

async function fetchRegByHex(hex: string, password?: string) {
  const res = await fetch(`/api/reglookup?hex=${encodeURIComponent(hex)}`, { headers: authHeaders(password) })
  if (!res.ok) return ''
  const j = await res.json().catch(() => ({} as any))
  return String(j?.registration || '')
}

async function fetchEnrichment(stationCode: string, password?: string) {
  const res = await fetch(`/api/enrichment?station=${encodeURIComponent(stationCode)}`, { headers: authHeaders(password) })
  const json = await res.json().catch(() => ({}))
  const rows = ((json.data || []) as any[]).map((r) => ({
    flight: String(r?.flight?.iata || '').toUpperCase(),
    reg: String(r?.aircraft?.registration || ''),
    type: String(r?.aircraft?.iata || r?.aircraft?.icao || ''),
    status: String(r?.flight_status || ''),
    terminal: String(r?.arrival?.terminal || r?.departure?.terminal || ''),
    gate: String(r?.arrival?.gate || r?.departure?.gate || '')
  }))
  return { rows, meta: json?.meta || { ok: res.ok, rows: rows.length, reason: res.ok ? 'ok' : `http_${res.status}` } }
}

export default function App() {
  const [activity, setActivity] = useState<{ date?: string; flights: Flight[]; staff: Staff[]; suggestedAssignments?: Assignments }>({ flights: [], staff: [] })
  const [stationCode, setStationCode] = useState('JFK')
  const [live, setLive] = useState<Array<{ callsign: string; hex: string; status: LiveStage }>>([])
  const liveCacheRef = useRef<Map<string, { callsign: string; hex: string; status: LiveStage; seenAt: number }>>(new Map())
  const [enrichment, setEnrichment] = useState<Array<{ flight: string; reg: string; type: string; status?: string; terminal?: string; gate?: string }>>([])
  const [enrichmentCache, setEnrichmentCache] = useState<EnrichmentCache>(() => {
    try { return JSON.parse(localStorage.getItem('ops-enrichment-cache') || '{}') } catch { return {} }
  })
  const [hexRegCache, setHexRegCache] = useState<HexRegCache>(() => {
    try { return JSON.parse(localStorage.getItem('ops-hex-reg-cache') || '{}') } catch { return {} }
  })
  const [manualRegOverrides, setManualRegOverrides] = useState<ManualRegOverrides>(() => {
    try { return JSON.parse(localStorage.getItem('ops-manual-reg-overrides') || '{}') } catch { return {} }
  })
  const [manualTypeOverrides, setManualTypeOverrides] = useState<ManualTypeOverrides>(() => {
    try { return JSON.parse(localStorage.getItem('ops-manual-type-overrides') || '{}') } catch { return {} }
  })
  const [manualGateOverrides, setManualGateOverrides] = useState<ManualGateOverrides>(() => {
    try { return JSON.parse(localStorage.getItem('ops-manual-gate-overrides') || '{}') } catch { return {} }
  })
  const [manualNotes, setManualNotes] = useState<ManualNotes>(() => {
    try { return JSON.parse(localStorage.getItem('ops-manual-notes') || '{}') } catch { return {} }
  })
  const [liveError, setLiveError] = useState('')
  const [feedHealth, setFeedHealth] = useState<any>(null)
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null)
  const [lastLiveUpdate, setLastLiveUpdate] = useState<Date | null>(null)
  const [clock, setClock] = useState(new Date())
  const [manualStaff, setManualStaff] = useState('')
  const [dailyFileName, setDailyFileName] = useState('No file selected')
  const [accessPassword, setAccessPassword] = useState(() => sessionStorage.getItem('ops-access-password') || '')
  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [assignments, setAssignments] = useState<Assignments>(() => {
    try { return JSON.parse(localStorage.getItem('ops-assignments') || '{}') } catch { return {} }
  })
  const [ganttUserFilter, setGanttUserFilter] = useState('')
  const enrichmentNextAtRef = useRef<number>(0)

  useEffect(() => { localStorage.setItem('ops-assignments', JSON.stringify(assignments)) }, [assignments])
  useEffect(() => { localStorage.setItem('ops-enrichment-cache', JSON.stringify(enrichmentCache)) }, [enrichmentCache])
  useEffect(() => { localStorage.setItem('ops-hex-reg-cache', JSON.stringify(hexRegCache)) }, [hexRegCache])
  useEffect(() => { localStorage.setItem('ops-manual-reg-overrides', JSON.stringify(manualRegOverrides)) }, [manualRegOverrides])
  useEffect(() => { localStorage.setItem('ops-manual-type-overrides', JSON.stringify(manualTypeOverrides)) }, [manualTypeOverrides])
  useEffect(() => { localStorage.setItem('ops-manual-gate-overrides', JSON.stringify(manualGateOverrides)) }, [manualGateOverrides])
  useEffect(() => { localStorage.setItem('ops-manual-notes', JSON.stringify(manualNotes)) }, [manualNotes])
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const station = STATIONS.find((s) => s.code === stationCode) || STATIONS[0]
  const stationAirlinePrefixes = STATION_AIRLINES[stationCode] || ['BAW']

  const mergedFlights = useMemo(() => {
    const stationPlanned = stationCode === 'JFK' ? PLANNED : []
    const base = stationPlanned.map((f, i) => ({ ...f, key: `${f.airline}-${f.flight}-${i}`, status: 'scheduled' as const }))
    const map = new Map(base.map((f) => [f.key, f as Flight]))

    activity.flights.forEach((f) => map.set(f.key, { ...f, aircraftType: map.get(f.key)?.aircraftType }))

    const byToken = new Map<string, Flight>()
    Array.from(map.values()).forEach((f) => {
      flightTokens(f.flight).forEach((t) => byToken.set(t, f))
    })

    live.forEach((lf) => {
      const token = normalizeLiveToken(lf.callsign)
      let hit = byToken.get(token)

      // Fallback: fuzzy airline+number matching for odd callsign formats (e.g. zero-padding/variant suffixes)
      if (!hit) {
        const m = token.match(/^([A-Z]{2})(\d{1,4})$/)
        if (m) {
          const airline = m[1]
          const num = Number(m[2])
          hit = Array.from(map.values()).find((f) => {
            const legs = flightTokens(f.flight)
            if (!legs.length) return false
            return legs.some((l) => l.startsWith(airline) && Number(l.replace(/^[A-Z]+/, '')) === num)
          })
        }
      }

      if (hit) {
        hit.status = lf.status
        const hexReg = hexRegCache[lf.hex]?.reg
        if (!hit.reg && hexReg) hit.reg = hexReg
      }
    })

    enrichment.forEach((e) => {
      const token = normalizeLiveToken(e.flight) || primaryFlightToken(e.flight)
      const hit = byToken.get(token)
      if (hit) {
        if (e.reg) hit.reg = e.reg
        if (e.type) hit.aircraftType = e.type
        if (e.terminal) hit.terminal = terminalNumber(e.terminal) || e.terminal
        if (e.gate) hit.gate = e.gate
        if (!hit.status || hit.status === 'scheduled') {
          const es = mapEnrichmentStatus(e.status)
          if (es) hit.status = es
        }
      }
    })

    // Free-source resilience: apply cached reg/type when live enrichment misses.
    Array.from(map.values()).forEach((f) => {
      const c = enrichmentCache[f.flight]
      if (c) {
        if (!f.reg && c.reg) f.reg = c.reg
        if (!f.aircraftType && c.type) f.aircraftType = c.type
      }
      const manualKey = `${stationCode}|${f.flight}`
      if (manualRegOverrides[manualKey]) f.reg = manualRegOverrides[manualKey]
      if (manualTypeOverrides[manualKey]) f.aircraftType = manualTypeOverrides[manualKey]
      if (manualGateOverrides[manualKey]) f.gate = manualGateOverrides[manualKey]

      if (stationCode === 'JFK' && f.airline === 'BA') {
        const o = JFK_BA_DAY_OVERRIDES[f.flight]
        if (o) {
          if (o.eta) f.eta = o.eta
          if (o.std) f.std = o.std
          if (o.gate) f.gate = o.gate
          if ((o.note || '').toLowerCase().includes('cancel')) f.status = 'cancelled'
        }
      }

      const noteKey = `${stationCode}|${f.flight}`
      const noteTxt = (manualNotes[noteKey] || '').toLowerCase()
      if (noteTxt.includes('cancel')) f.status = 'cancelled'

      // Terminal defaults from ops rules (can be overwritten by data feed/manual updates).
      if (!f.terminal) {
        const t = defaultTerminalForAirline(f.airline)
        if (t) f.terminal = t
      }

      // BA fleet mix default by station when type missing.
      if (!f.aircraftType) {
        const ty = defaultAircraftTypeForFlight(stationCode, f.airline)
        if (ty) f.aircraftType = ty
      }

      // Airline registration prefix normalization rules from ops guidance.
      f.reg = normalizeRegByAirline(f.airline, f.reg)
    })

    return Array.from(map.values()).filter((f) => HANDLED_AIRLINES.includes(f.airline)).sort((a, b) => (toMinutes(a.eta) || 9999) - (toMinutes(b.eta) || 9999))
  }, [activity.flights, live, enrichment, enrichmentCache, hexRegCache, manualRegOverrides, manualTypeOverrides, manualGateOverrides, manualNotes, stationCode])

  const stationStaffBase = STAFF_BY_STATION[stationCode] || { mechanics: [], certifiers: [] }
  const stationStaff = useMemo(() => {
    const mechanics = [...stationStaffBase.mechanics]
    const certifiers = [...stationStaffBase.certifiers]
    if (stationCode === 'JFK') {
      ;[
        'Anthony Derasmo',
        "Anthony D'Erasmo",
        'Devran Turegun',
        'William Stiehm',
        'Gabriel Torres',
        'Brandon Pareja'
      ].forEach((n) => {
        if (!mechanics.includes(n)) mechanics.push(n)
        if (!certifiers.includes(n)) certifiers.push(n)
      })
    }
    return { mechanics, certifiers }
  }, [stationCode, stationStaffBase])

  const staffRoster = useMemo(() => {
    const uploaded = activity.staff.map((s) => s.name)
    const manual = manualStaff.split('\n').map((x) => x.trim()).filter(Boolean)
    return Array.from(new Set([...stationStaff.mechanics, ...stationStaff.certifiers, ...uploaded, ...manual])).sort()
  }, [activity.staff, manualStaff, stationCode])

  const certifierOptions = useMemo(() => {
    const uploaded = activity.staff.filter((s) => s.role === 'Certifier').map((s) => s.name)
    const manual = manualStaff.split('\n').map((x) => x.trim()).filter(Boolean)
    return Array.from(new Set([...stationStaff.certifiers, ...uploaded, ...manual])).sort()
  }, [activity.staff, stationCode, manualStaff, stationStaff])

  const mechanicOptions = useMemo(() => {
    const uploaded = activity.staff.filter((s) => s.role === 'Mechanic').map((s) => s.name)
    const manual = manualStaff.split('\n').map((x) => x.trim()).filter(Boolean)
    return Array.from(new Set([...stationStaff.mechanics, ...uploaded, ...manual])).sort()
  }, [activity.staff, stationCode, manualStaff, stationStaff])

  const setAssign = (flightKey: string, field: 'certifier' | 'mechanic', value: string) => {
    setAssignments((prev) => ({ ...prev, [flightKey]: { ...prev[flightKey], [field]: value, station: stationCode } }))
  }

  const editReg = (flight: string, current?: string) => {
    const val = window.prompt(`Set registration for ${flight}`, current || '')
    if (val === null) return
    const key = `${stationCode}|${flight}`
    const cleaned = val.trim().toUpperCase()
    setManualRegOverrides((prev) => {
      const next = { ...prev }
      if (!cleaned) delete next[key]
      else next[key] = cleaned
      return next
    })
  }

  const editNote = (flight: string) => {
    const key = `${stationCode}|${flight}`
    const val = window.prompt(`Add note for ${flight}`, manualNotes[key] || '')
    if (val === null) return
    setManualNotes((prev) => {
      const next = { ...prev }
      const cleaned = val.trim()
      if (!cleaned) delete next[key]
      else next[key] = cleaned
      return next
    })
  }

  const editGate = (flight: string, current?: string) => {
    const key = `${stationCode}|${flight}`
    const val = window.prompt(`Set gate for ${flight}`, current || '')
    if (val === null) return
    const cleaned = val.trim().toUpperCase()
    setManualGateOverrides((prev) => {
      const next = { ...prev }
      if (!cleaned) delete next[key]
      else next[key] = cleaned
      return next
    })
  }

  const editType = (flight: string, current?: string) => {
    const key = `${stationCode}|${flight}`
    const val = window.prompt(`Set aircraft type for ${flight}`, current || '')
    if (val === null) return
    const cleaned = val.trim().toUpperCase()
    setManualTypeOverrides((prev) => {
      const next = { ...prev }
      if (!cleaned) delete next[key]
      else next[key] = cleaned
      return next
    })
  }

  const assignedUsers = useMemo(() => {
    // Filter-by-user should only list users relevant to current station board context.
    return Array.from(new Set([...certifierOptions, ...mechanicOptions])).sort()
  }, [certifierOptions, mechanicOptions])

  const ganttFlights = useMemo(() => {
    if (!ganttUserFilter) return mergedFlights
    return mergedFlights.filter((f) => {
      const a = assignments[f.key] || {}
      return a.certifier === ganttUserFilter || a.mechanic === ganttUserFilter
    })
  }, [mergedFlights, assignments, ganttUserFilter])

  const nowMinutes = clock.getHours() * 60 + clock.getMinutes()
  const nowPct = (nowMinutes / (24 * 60)) * 100

  const loadLive = async () => {
    if (!accessPassword) return
    setLiveError('')
    try {
      const now = Date.now()
      const shouldEnrich = now >= enrichmentNextAtRef.current

      const [os, en] = await Promise.all([
        fetchOpenSky(station, stationAirlinePrefixes, accessPassword),
        shouldEnrich
          ? fetchEnrichment(station.code, accessPassword)
          : Promise.resolve({ rows: [], meta: { ok: true, rows: enrichment.length, reason: 'cached' } })
      ])

      if (os.rows.length) {
        const nowTs = Date.now()
        os.rows.forEach((r) => liveCacheRef.current.set(r.callsign, { ...r, seenAt: nowTs }))
        // keep last known OpenSky rows for 6 hours to avoid sudden blanks
        for (const [k, v] of liveCacheRef.current.entries()) {
          if (nowTs - v.seenAt > 6 * 60 * 60_000) liveCacheRef.current.delete(k)
        }
        const liveRows = Array.from(liveCacheRef.current.values()).map(({ seenAt, ...rest }) => rest)
        setLive(liveRows)

        // Prioritize lookup attempts for flights currently blank on registration.
        const blankFlightTokens = new Set(
          mergedFlights
            .filter((f) => !f.reg)
            .flatMap((f) => flightTokens(f.flight))
        )

        const prioritizedHex = liveRows
          .filter((r: any) => {
            const t = normalizeLiveToken(r.callsign)
            return t && blankFlightTokens.has(t)
          })
          .map((r: any) => r.hex)

        const fallbackHex = liveRows.map((r: any) => r.hex)
        const unknownHex = Array.from(new Set([...prioritizedHex, ...fallbackHex].filter(Boolean)))
          .filter((hex) => !hexRegCache[hex])
          .slice(0, 4)

        if (unknownHex.length) {
          const resolved = await Promise.all(unknownHex.map(async (hex) => ({ hex, reg: await fetchRegByHex(hex, accessPassword) })))
          const hits = resolved.filter((x) => x.reg)
          if (hits.length) {
            setHexRegCache((prev) => {
              const next = { ...prev }
              const ts = Date.now()
              hits.forEach((h) => { next[h.hex] = { reg: h.reg, updatedAt: ts } })
              return next
            })
          }
        }
      }
      if (en.rows.length) {
        setEnrichment(en.rows)
        const ts = Date.now()
        setEnrichmentCache((prev) => {
          const next = { ...prev }
          en.rows.forEach((r: any) => {
            if (!r?.flight) return
            const cur = next[r.flight] || { updatedAt: ts }
            next[r.flight] = { reg: r.reg || cur.reg, type: r.type || cur.type, updatedAt: ts }
          })
          return next
        })
      }

      if (shouldEnrich) {
        const reason = String(en.meta?.reason || '')
        const rateLimited = reason.includes('429')
        // User requested max ~3 calls/day on free tier.
        enrichmentNextAtRef.current = now + (rateLimited ? 12 * 60 * 60_000 : 8 * 60 * 60_000)
      }

      setFeedHealth({ opensky: os.meta, enrichment: en.meta })
      setLastLiveUpdate(new Date())
      const unauthorized = String(os.meta?.reason || '').includes('401') || String(en.meta?.reason || '').includes('401')
      if (unauthorized) {
        setAuthError('Password expired or invalid. Enter today\'s password.')
        sessionStorage.removeItem('ops-access-password')
        setAccessPassword('')
        return
      }
      if (!os.rows.length) setLiveError('OpenSky returned 0 matching rows this cycle. Using last known snapshot + schedule.')
      if (String(en.meta?.reason || '').includes('429')) {
        setLiveError('Enrichment API is rate-limited (429). Using cached reg/type and retrying later.')
      }
    }
    catch {
      setLiveError('Live data limited right now (CORS/rate limits). Using last known snapshot + schedule.')
    }
  }

  useEffect(() => {
    // Station switch should present station-specific board/gantt context.
    setActivity({ flights: [], staff: [] })
    setDailyFileName('No file selected')
    setGanttUserFilter('')

    loadLive()
    const id = setInterval(loadLive, 30000)
    return () => clearInterval(id)
  }, [stationCode, accessPassword])

  useEffect(() => {
    let active = true
    const loadWx = async () => {
      if (!accessPassword) return
      const w = await fetchWeather(stationCode, accessPassword)
      if (active) setWeather(w)
    }
    loadWx()
    const id = setInterval(loadWx, 30 * 60_000)
    return () => { active = false; clearInterval(id) }
  }, [stationCode, accessPassword])

  if (!accessPassword) {
    return (
      <div className="page" style={{ maxWidth: 560 }}>
        <section className="panel">
          <h2>Protected Dashboard Access</h2>
          <p>Enter today’s password to unlock this dashboard.</p>
          <label>
            Daily Password
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter current password"
            />
          </label>
          {authError && <p style={{ color: '#ff9aa5' }}>{authError}</p>}
          <button onClick={() => {
            const v = passwordInput.trim()
            if (!v) return
            sessionStorage.setItem('ops-access-password', v)
            setAccessPassword(v)
            setAuthError('')
          }}>Unlock</button>
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="topHeader">
        <div>
          <h1>British Airways Line Maintenance Operational Dashboard — {stationCode}</h1>
          <p>Single-file workflow: upload Daily Activity CSV, assign crews, visualize overlaps.</p>
        </div>
      </header>

      <section className="panel uploads">
        <label>
          Station
          <select value={stationCode} onChange={(e) => setStationCode(e.target.value)}>
            {STATIONS.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
          </select>
        </label>
        <label>
          Daily Roster
          <div className="fileRow">
            <label className="fileBtn" htmlFor="daily-csv">Choose CSV</label>
            <span className="fileName">{dailyFileName}</span>
            <input id="daily-csv" className="hiddenFile" type="file" accept=".csv" onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setDailyFileName(f.name)
              const rows = parseCsv(await f.text())
              const parsed = parseDailyActivity(rows)
              setActivity(parsed)
              const suggestions = parsed.suggestedAssignments || {}
              if (Object.keys(suggestions).length) {
                setAssignments((prev) => {
                  const next = { ...prev }
                  mergedFlights.forEach((fl) => {
                    const flPair = flightPairToken(fl.flight)
                    const key = fl.airline === 'BA' && flPair ? `BA${flPair}` : ''
                    if (key && suggestions[key]) next[fl.key] = { ...next[fl.key], ...suggestions[key] }
                  })
                  return next
                })
              }
            }} />
          </div>
        </label>
        <label>
          Manual Staff Add (one per line)
          <textarea rows={4} value={manualStaff} onChange={(e) => setManualStaff(e.target.value)} placeholder="Add extra certifiers/mechanics..." />
        </label>
        <div className="weatherBox inlineWeather">
          <h3>{stationCode} Weather</h3>
          <div className="wxCompact">
            <span className="wxIcon" title={weather?.nowDesc || 'Weather'}>{weatherEmoji(weather?.nowDesc)}</span>
            <span><b>Now:</b> {weather ? `${weather.tempC}°C` : '—'} {weather?.nowDesc || ''}</span>
            <span><b>Precip:</b> {weather ? `${weather.precipMm} mm` : '—'}</span>
            <span><b>AM</b> {weather?.morning || '—'}</span>
            <span><b>PM</b> {weather?.afternoon || '—'}</span>
            <span><b>EVE</b> {weather?.evening || '—'}</span>
          </div>
        </div>
      </section>

      <section className="panel stats">
        <span><b>Date:</b> {activity.date || new Date().toLocaleDateString()}</span>
        <span><b>Local:</b> {clock.toLocaleTimeString()}</span>
        <span><b>UTC:</b> {clock.toUTCString().split(' ')[4]}Z</span>
        <span><b>Flights:</b> {mergedFlights.length}</span>
        <span><b>Roster pool:</b> {staffRoster.length}</span>
        <span><b>ADS-B:</b> auto refresh every 30s{lastLiveUpdate ? ` (last ${lastLiveUpdate.toLocaleTimeString()})` : ''}</span>
        <span><b>OpenSky:</b> <span className={`feed ${feedHealth?.opensky?.ok ? 'ok' : 'bad'}`}>{feedHealth?.opensky?.ok ? `OK (${feedHealth?.opensky?.rows})` : `Issue (${feedHealth?.opensky?.reason || 'n/a'})`}</span></span>
        <span><b>Enrichment (≤3/day):</b> <span className={`feed ${feedHealth?.enrichment?.ok ? 'ok' : 'bad'}`}>{feedHealth?.enrichment?.ok ? `OK (${feedHealth?.enrichment?.rows})` : `Issue (${feedHealth?.enrichment?.reason || 'n/a'})`}</span></span>
        <span><b>Cache:</b> {Object.keys(enrichmentCache).length} flight mappings</span>
      </section>

      {liveError && <section className="panel warn">{liveError}</section>}

      <section className="panel tableWrap">
        <h2>Daily Roster</h2>
        <table>
          <thead>
            <tr>
              <th>Airline</th><th>Flight</th><th>A/C Reg</th><th>A/C Type</th><th>Terminal</th><th>Gate</th><th>ETA</th><th>STD</th><th>Status</th><th>Certifier</th><th>Mechanic</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {mergedFlights.map((f) => {
              const a = assignments[f.key] || {}
              return (
                <tr key={f.key} className={f.status === 'cancelled' ? 'rowCancelled' : ''}>
                  <td>{f.airline}</td>
                  <td>{f.flight}</td>
                  <td><span>{f.reg || '-'}</span> <button className="miniBtn" onClick={() => editReg(f.flight, f.reg)} title="Set manual registration">✎</button></td>
                  <td><span>{f.aircraftType || '-'}</span> <button className="miniBtn" onClick={() => editType(f.flight, f.aircraftType)} title="Set aircraft type">✎</button></td>
                  <td>{terminalNumber(f.terminal) || f.terminal || '-'}</td>
                  <td><span>{f.gate || '-'}</span> <button className="miniBtn" onClick={() => editGate(f.flight, f.gate)} title="Set gate">✎</button></td>
                  <td>{normalizeTime(f.eta) || '-'}</td>
                  <td>{normalizeTime(f.std) || '-'}</td>
                  <td><span className={`status ${f.status || 'scheduled'}`}>{f.status || 'scheduled'}</span></td>
                  <td>
                    <select value={a.certifier || ''} onChange={(e) => setAssign(f.key, 'certifier', e.target.value)}>
                      <option value="">Assign…</option>
                      {certifierOptions.map((s) => <option key={`c-${s}`} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={a.mechanic || ''} onChange={(e) => setAssign(f.key, 'mechanic', e.target.value)}>
                      <option value="">Assign…</option>
                      {mechanicOptions.map((s) => <option key={`m-${s}`} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <span>{manualNotes[`${stationCode}|${f.flight}`] || '-'}</span>
                    <button className="miniBtn" onClick={() => editNote(f.flight)} title="Add/edit note">✎</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="ganttHeader">
          <h2>Station Flight Gantt (24h)</h2>
          <div className="ganttControls">
            <label>
              Filter by user:{' '}
              <select value={ganttUserFilter} onChange={(e) => setGanttUserFilter(e.target.value)}>
                <option value="">All assigned flights</option>
                {assignedUsers.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <div className="ganttClocks">
              <span>Local: {clock.toLocaleTimeString()}</span>
              <span>UTC: {clock.toUTCString().split(' ')[4]}Z</span>
            </div>
          </div>
        </div>
        <div className="scaleWrap">
          <span className="scaleLabelPad" />
          <div className="scale">
            {Array.from({ length: 25 }).map((_, i) => <span key={i}>{String(i % 24).padStart(2, '0')}:00</span>)}
          </div>
        </div>
        <div className="overlayWrap">
          <span className="scaleLabelPad" />
          <div className="busyOverlay">
            {Array.from({ length: 24 }).map((_, h) => {
              const c = ganttFlights.filter((f) => {
                const s = toMinutes(f.eta) ?? 0
                const eRaw = toMinutes(f.std) ?? ((s + 60) % (24 * 60))
                const inRange = eRaw >= s
                  ? (h * 60 >= s && h * 60 < eRaw)
                  : (h * 60 >= s || h * 60 < eRaw)
                return inRange
              }).length
              return <div key={h} style={{ opacity: Math.min(c / 6, 0.65) }} title={`${c} flights around ${String(h).padStart(2, '0')}:00`} />
            })}
            <div className="nowLine" style={{ left: `${nowPct}%` }} title={`Now ${clock.toLocaleTimeString()}`} />
          </div>
        </div>
        <div className="gantt">
          {ganttFlights.map((f) => {
            const start = toMinutes(f.eta) ?? 0
            const end = toMinutes(f.std) ?? ((start + 60) % (24 * 60))
            const segs = ganttSegments(start, end)
            const tooltip = `${f.airline} ${f.flight} | ARR ${normalizeTime(f.eta) || '--:--'} | DEP ${normalizeTime(f.std) || '--:--'} | TYPE ${f.aircraftType || 'TBD'} | REG ${f.reg || '-'}`
            return (
              <div key={`g-${f.key}`} className="gRow">
                <span>{f.airline} {f.flight} <small className="gType">{f.aircraftType || 'TBD'}</small></span>
                <div className="gTrack">
                  {segs.map((s, i) => (
                    <div key={i} className="gBar" title={tooltip} style={{ left: `${s.left}%`, width: `${s.width}%` }}>
                      {i === 0 && <span className="gBarLabel">{f.aircraftType || 'TBD'}</span>}
                    </div>
                  ))}
                  <div className="nowLine" style={{ left: `${nowPct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

