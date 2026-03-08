import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Staff = { name: string; role: 'Mechanic' | 'Certifier'; shift?: string; absence?: string }
type Flight = {
  key: string
  airline: string
  flight: string
  eta?: string
  std?: string
  reg?: string
  status?: 'scheduled' | 'airborne' | 'arrived'
  aircraftType?: string
}

type Assignments = Record<string, { certifier?: string; mechanic?: string }>

const HANDLED_AIRLINES = ['BA', 'EI', 'IB', 'LEVEL', 'AY', 'QF', 'NZ', 'NO', 'Z0', 'NH', 'JL']

const DEFAULT_STAFF = [
  'Alan Larmour','ALLEN BARKER','Andreas Leuschner','Angel Angelov','Anthony D\'Erasmo','Ari Portugal','Brandon Pareja Castanc',
  'Craig Bowles','Fahim Abrar','Gabriel Torres','Garfield Lamont','Hassan Ahmad','Ian Richards','Jordan Iordanov','Jason Davies',
  'Kana Balasingam','Mark Ferrel','Mike Hamarsha','Naresh Dindiall','Nidal Hajouj','Nikolas Dundon','Rahman Arikan','Ray Abes',
  'Rumen Madev','Saleh Al Assaf','Samuel Takyi','Stephen England','Tarindu Amarasekera','William Stiehm'
]

const PLANNED: Omit<Flight, 'key' | 'reg' | 'status'>[] = [
  { airline: 'EI', flight: 'EI105/104', eta: '1455', std: '1800', aircraftType: 'A330' },
  { airline: 'EI', flight: 'EI111/110', eta: '1625', std: '1830', aircraftType: 'A321' },
  { airline: 'EI', flight: 'EI107/106', eta: '2029', std: '2200', aircraftType: 'A321' },
  { airline: 'IB', flight: 'IB211/212', eta: '1625', std: '1755', aircraftType: 'A32X' },
  { airline: 'IB', flight: 'IB325/326', eta: '2015', std: '2150', aircraftType: 'A330' },
  { airline: 'LEVEL', flight: 'IB2627/2628', eta: '2200', std: '2325', aircraftType: 'A330' },
  { airline: 'AY', flight: 'AY15/16', eta: '2005', std: '2345', aircraftType: 'A330' },
  { airline: 'QF', flight: 'QF3/4', eta: '1525', std: '1815', aircraftType: 'B787' },
  { airline: 'NZ', flight: 'NZ2/1', eta: '1700', std: '1920', aircraftType: 'B787' },
  { airline: 'Z0', flight: 'Z0701/702', eta: '1655', std: '1905', aircraftType: 'B787' },
  { airline: 'NH', flight: 'NH110/109', eta: '1130', std: '1405', aircraftType: 'B777' },
  { airline: 'NH', flight: 'NH159/160', eta: '2250', std: '0150', aircraftType: 'B777' },
  { airline: 'JL', flight: 'JL006/005', eta: '1100', std: '1350', aircraftType: 'A350' },
  { airline: 'JL', flight: 'JL004/003', eta: '1940', std: '0140', aircraftType: 'A350' },
  { airline: 'BA', flight: 'BA117/176', eta: '1220', std: '2010' },
  { airline: 'BA', flight: 'BA175/172', eta: '1335', std: '2140' },
  { airline: 'BA', flight: 'BA173/112', eta: '1520', std: '1915' },
  { airline: 'BA', flight: 'BA177/174', eta: '1700', std: '1950', aircraftType: 'B787' },
  { airline: 'BA', flight: 'BA115/116', eta: '1815', std: '2105' },
  { airline: 'BA', flight: 'BA113/114', eta: '2035', std: '2235', aircraftType: 'B787' },
  { airline: 'BA', flight: 'BA179/182', eta: '2205', std: '0020' },
  { airline: 'BA', flight: 'BA183/178', eta: '2305', std: '0905' }
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

function parseDailyActivity(rows: string[][]) {
  const date = rows.find((r) => /\d{2}\/\d{2}\/\d{4}/.test(r[0] || ''))?.[0]?.split(' ')[0]
  const flights: Flight[] = []
  const staff: Staff[] = []

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
  for (let i = ss + 1; ss >= 0 && i < rows.length; i++) {
    const r = rows[i]
    if ((r[0] || '').startsWith('Shift A')) break
    if (r[0]) staff.push({ name: r[0], role: 'Mechanic', shift: r[2] })
    if (r[3]) staff.push({ name: r[3], role: 'Certifier', shift: r[5] })
    if (r[7]) staff.push({ name: r[7], role: 'Mechanic', absence: r[9] || 'Absent' })
  }

  return { date, flights, staff }
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

async function fetchOpenSkyJfk() {
  const url = 'https://opensky-network.org/api/states/all?lamin=40.2&lomin=-74.3&lamax=41.1&lomax=-73.2'
  const res = await fetch(url)
  if (!res.ok) throw new Error('OpenSky fetch failed')
  const json = await res.json()
  const states = (json.states || []) as any[]
  const prefixes = ['BAW', 'EIN', 'IBE', 'QFA', 'ANZ', 'NAX', 'JAL', 'ANA', 'FIN', 'LYX']
  return states
    .filter((s) => prefixes.some((p) => String(s[1] || '').trim().startsWith(p)))
    .map((s) => ({ callsign: String(s[1] || '').trim(), reg: String(s[0] || ''), status: (s[8] ? 'airborne' : 'arrived') as 'airborne' | 'arrived' }))
}

function primaryFlightToken(flight: string) {
  return (flight.split('/')[0] || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
}

export default function App() {
  const [activity, setActivity] = useState<{ date?: string; flights: Flight[]; staff: Staff[] }>({ flights: [], staff: [] })
  const [live, setLive] = useState<Array<{ callsign: string; reg: string; status: 'airborne' | 'arrived' }>>([])
  const [liveError, setLiveError] = useState('')
  const [manualStaff, setManualStaff] = useState('')
  const [assignments, setAssignments] = useState<Assignments>(() => {
    try { return JSON.parse(localStorage.getItem('ops-assignments') || '{}') } catch { return {} }
  })

  useEffect(() => { localStorage.setItem('ops-assignments', JSON.stringify(assignments)) }, [assignments])

  const mergedFlights = useMemo(() => {
    const base = PLANNED.map((f, i) => ({ ...f, key: `${f.airline}-${f.flight}-${i}`, status: 'scheduled' as const }))
    const map = new Map(base.map((f) => [f.key, f as Flight]))

    activity.flights.forEach((f) => map.set(f.key, { ...f, aircraftType: map.get(f.key)?.aircraftType }))

    const byToken = new Map<string, Flight>()
    Array.from(map.values()).forEach((f) => byToken.set(primaryFlightToken(f.flight), f))

    live.forEach((lf) => {
      const match = Array.from(byToken.entries()).find(([token]) => lf.callsign.includes(token.replace(/^[A-Z]+/, '')) || lf.callsign.includes(token))
      if (match) {
        const hit = match[1]
        hit.reg = lf.reg
        hit.status = lf.status
      }
    })

    return Array.from(map.values()).filter((f) => HANDLED_AIRLINES.includes(f.airline)).sort((a, b) => (toMinutes(a.eta) || 9999) - (toMinutes(b.eta) || 9999))
  }, [activity.flights, live])

  const staffRoster = useMemo(() => {
    const uploaded = activity.staff.map((s) => s.name)
    const manual = manualStaff.split('\n').map((x) => x.trim()).filter(Boolean)
    return Array.from(new Set([...DEFAULT_STAFF, ...uploaded, ...manual])).sort()
  }, [activity.staff, manualStaff])

  const setAssign = (flightKey: string, field: 'certifier' | 'mechanic', value: string) => {
    setAssignments((prev) => ({ ...prev, [flightKey]: { ...prev[flightKey], [field]: value } }))
  }

  const loadLive = async () => {
    setLiveError('')
    try { setLive(await fetchOpenSkyJfk()) }
    catch { setLiveError('OpenSky live data limited right now. Schedule still available.') }
  }

  return (
    <div className="page">
      <header>
        <h1>MRO on the GO — BA JFK Operational Dashboard</h1>
        <p>Single-file workflow: upload Daily Activity CSV, assign crews, visualize overlaps.</p>
      </header>

      <section className="panel uploads">
        <label>
          Daily Activity CSV
          <input type="file" accept=".csv" onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const rows = parseCsv(await f.text())
            setActivity(parseDailyActivity(rows))
          }} />
        </label>
        <label>
          Manual Staff Add (one per line)
          <textarea rows={4} value={manualStaff} onChange={(e) => setManualStaff(e.target.value)} placeholder="Add extra certifiers/mechanics..." />
        </label>
        <button onClick={loadLive}>Refresh ADS-B (OpenSky)</button>
      </section>

      <section className="panel stats">
        <span><b>Date:</b> {activity.date || new Date().toLocaleDateString()}</span>
        <span><b>Flights:</b> {mergedFlights.length}</span>
        <span><b>Roster pool:</b> {staffRoster.length}</span>
      </section>

      {liveError && <section className="panel warn">{liveError}</section>}

      <section className="panel tableWrap">
        <h2>Flight Assignment Board</h2>
        <table>
          <thead>
            <tr>
              <th>Airline</th><th>Flight</th><th>A/C Reg (ADSB)</th><th>A/C Type</th><th>ETA</th><th>STD</th><th>Status</th><th>Certifier</th><th>Mechanic</th>
            </tr>
          </thead>
          <tbody>
            {mergedFlights.map((f) => {
              const a = assignments[f.key] || {}
              return (
                <tr key={f.key}>
                  <td>{f.airline}</td>
                  <td>{f.flight}</td>
                  <td>{f.reg || '-'}</td>
                  <td>{f.aircraftType || '-'}</td>
                  <td>{normalizeTime(f.eta) || '-'}</td>
                  <td>{normalizeTime(f.std) || '-'}</td>
                  <td><span className={`status ${f.status || 'scheduled'}`}>{f.status || 'scheduled'}</span></td>
                  <td>
                    <select value={a.certifier || ''} onChange={(e) => setAssign(f.key, 'certifier', e.target.value)}>
                      <option value="">Assign…</option>
                      {staffRoster.map((s) => <option key={`c-${s}`} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={a.mechanic || ''} onChange={(e) => setAssign(f.key, 'mechanic', e.target.value)}>
                      <option value="">Assign…</option>
                      {staffRoster.map((s) => <option key={`m-${s}`} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Station Flight Gantt (24h)</h2>
        <div className="gantt">
          {mergedFlights.map((f) => {
            const start = toMinutes(f.eta) ?? 0
            let end = toMinutes(f.std) ?? start + 60
            if (end < start) end += 24 * 60
            const left = (start / (24 * 60)) * 100
            const width = Math.max(((end - start) / (24 * 60)) * 100, 1.2)
            return <div key={`g-${f.key}`} className="gRow"><span>{f.airline} {f.flight}</span><div className="gTrack"><div className="gBar" style={{ left: `${left}%`, width: `${width}%` }} /></div></div>
          })}
        </div>
      </section>
    </div>
  )
}
