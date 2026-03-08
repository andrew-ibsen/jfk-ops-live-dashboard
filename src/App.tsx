import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Staff = { name: string; shift: string; role: 'Mechanic' | 'Certifier'; absence?: string }
type Flight = {
  key: string
  airline: string
  arr?: string
  dep?: string
  eta?: string
  std?: string
  reg?: string
  live?: 'scheduled' | 'airborne' | 'arrived'
}

type Assignments = Record<string, { certifier?: string; mechanic?: string }>

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (q && text[i + 1] === '"') {
        cur += '"'
        i++
      } else q = !q
    } else if (c === ',' && !q) {
      row.push(cur.trim()); cur = ''
    } else if ((c === '\n' || c === '\r') && !q) {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur.trim())
      if (row.some((x) => x.length > 0)) rows.push(row)
      row = []; cur = ''
    } else cur += c
  }
  if (cur.length || row.length) {
    row.push(cur.trim())
    if (row.some((x) => x.length > 0)) rows.push(row)
  }
  return rows
}

function fromActivity(rows: string[][]): { staff: Staff[]; flights: Flight[]; date?: string } {
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
    const airline = (arr || dep).slice(0, 2).toUpperCase()
    const key = `${airline}-${arr || dep}-${r[1] || i}`
    flights.push({ key, airline, reg: r[1], arr, eta: r[3], dep, std: r[6], live: 'scheduled' })
  }
  const ss = rows.findIndex((r) => (r[0] || '').toLowerCase() === 'mechanics')
  for (let i = ss + 1; ss >= 0 && i < rows.length; i++) {
    const r = rows[i]
    if ((r[0] || '').startsWith('Shift A')) break
    if (r[0]) staff.push({ name: r[0], shift: r[2], role: 'Mechanic' })
    if (r[3]) staff.push({ name: r[3], shift: r[5], role: 'Certifier' })
  }
  return { staff, flights, date }
}

function fromShift(rows: string[][]): { staff: Staff[]; flights: Flight[]; date?: string } {
  const date = rows.find((r) => /March|April|May|June|July|August|September|October|November|December|January|February/i.test(r.join(' ')))?.join(' ')
  const staff: Staff[] = []
  const flights: Flight[] = []
  const start = rows.findIndex((r) => (r[1] || '').toLowerCase() === 'mechanics')
  for (let i = start + 1; start >= 0 && i < rows.length; i++) {
    const r = rows[i]
    if ((r[1] || '').toLowerCase().includes('aer lingus')) break
    if (r[1]) staff.push({ name: r[1], shift: r[2], role: 'Mechanic' })
    if (r[3]) staff.push({ name: r[3], shift: r[4], role: 'Certifier' })
    if (r[7]) staff.push({ name: r[7], shift: '-', role: 'Mechanic', absence: r[9] || 'Absent' })
    if (r[5] && /\d/.test(r[5])) {
      const key = `BA-${r[5].replace(/\s+/g, '')}-${i}`
      flights.push({ key, airline: 'BA', arr: r[5], live: 'scheduled' })
    }
  }
  return { staff, flights, date }
}

async function fetchOpenSkyJfk() {
  const url = 'https://opensky-network.org/api/states/all?lamin=40.2&lomin=-74.3&lamax=41.1&lomax=-73.2'
  const res = await fetch(url)
  if (!res.ok) throw new Error('OpenSky fetch failed')
  const json = await res.json()
  const states = (json.states || []) as any[]
  const prefixes = ['BAW', 'EIN', 'IBE', 'QFA', 'ANA', 'NAX']
  return states
    .filter((s) => prefixes.some((p) => String(s[1] || '').trim().startsWith(p)))
    .map((s, idx) => ({
      key: `live-${idx}-${s[1]}`,
      airline: String(s[1] || '').trim().slice(0, 3),
      dep: String(s[1] || '').trim(),
      reg: s[0],
      eta: '-',
      std: '-',
      live: s[8] ? 'airborne' : 'arrived'
    } as Flight))
}

export default function App() {
  const [activity, setActivity] = useState<{ staff: Staff[]; flights: Flight[]; date?: string }>({ staff: [], flights: [] })
  const [shift, setShift] = useState<{ staff: Staff[]; flights: Flight[]; date?: string }>({ staff: [], flights: [] })
  const [liveFlights, setLiveFlights] = useState<Flight[]>([])
  const [liveError, setLiveError] = useState('')
  const [assignments, setAssignments] = useState<Assignments>(() => {
    try { return JSON.parse(localStorage.getItem('ops-assignments') || '{}') } catch { return {} }
  })

  useEffect(() => { localStorage.setItem('ops-assignments', JSON.stringify(assignments)) }, [assignments])

  const merged = useMemo(() => {
    const staffMap = new Map<string, Staff>()
    ;[...activity.staff, ...shift.staff].forEach((s) => {
      const k = `${s.name.toLowerCase()}-${s.role}`
      const prev = staffMap.get(k)
      staffMap.set(k, { ...prev, ...s, name: s.name })
    })
    const fMap = new Map<string, Flight>()
    ;[...activity.flights, ...shift.flights, ...liveFlights].forEach((f) => fMap.set(f.key, f))
    return {
      date: activity.date || shift.date || new Date().toLocaleDateString(),
      staff: Array.from(staffMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      flights: Array.from(fMap.values())
    }
  }, [activity, shift, liveFlights])

  const certifiers = merged.staff.filter((s) => s.role === 'Certifier' && !s.absence)
  const mechanics = merged.staff.filter((s) => s.role === 'Mechanic' && !s.absence)

  const setAssign = (flightKey: string, field: 'certifier' | 'mechanic', value: string) => {
    setAssignments((prev) => ({ ...prev, [flightKey]: { ...prev[flightKey], [field]: value } }))
  }

  const handleUpload = async (file: File, kind: 'activity' | 'shift') => {
    const rows = parseCsv(await file.text())
    if (kind === 'activity') setActivity(fromActivity(rows))
    else setShift(fromShift(rows))
  }

  const loadLive = async () => {
    setLiveError('')
    try { setLiveFlights(await fetchOpenSkyJfk()) }
    catch { setLiveError('Live ADS-B fetch limited or blocked right now. Using uploaded schedule only.') }
  }

  return (
    <div className="page">
      <header>
        <h1>MRO on the GO — BA JFK Ops Board</h1>
        <p>Live operational overview: flights + certifier/mechanic assignment</p>
      </header>

      <section className="panel uploads">
        <label>
          Daily Activity CSV
          <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'activity')} />
        </label>
        <label>
          Shift Assignment CSV
          <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'shift')} />
        </label>
        <button onClick={loadLive}>Load Live ADS-B (OpenSky)</button>
      </section>

      <section className="panel stats">
        <span><b>Date:</b> {merged.date}</span>
        <span><b>Flights:</b> {merged.flights.length}</span>
        <span><b>Staff on duty:</b> {merged.staff.filter((s) => !s.absence).length}</span>
        <span><b>Absences:</b> {merged.staff.filter((s) => s.absence).length}</span>
      </section>

      {liveError && <section className="panel warn">{liveError}</section>}

      <section className="panel tableWrap">
        <h2>Flight Assignment Board</h2>
        <table>
          <thead>
            <tr>
              <th>Airline</th><th>Flight</th><th>Reg</th><th>ETA/STD</th><th>Status</th><th>Certifier</th><th>Mechanic</th>
            </tr>
          </thead>
          <tbody>
            {merged.flights.map((f) => {
              const a = assignments[f.key] || {}
              return (
                <tr key={f.key}>
                  <td>{f.airline}</td>
                  <td>{f.arr || f.dep || '-'}</td>
                  <td>{f.reg || '-'}</td>
                  <td>{f.eta || f.std || '-'}</td>
                  <td><span className={`status ${f.live || 'scheduled'}`}>{f.live || 'scheduled'}</span></td>
                  <td>
                    <select value={a.certifier || ''} onChange={(e) => setAssign(f.key, 'certifier', e.target.value)}>
                      <option value="">Assign…</option>
                      {certifiers.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={a.mechanic || ''} onChange={(e) => setAssign(f.key, 'mechanic', e.target.value)}>
                      <option value="">Assign…</option>
                      {mechanics.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
