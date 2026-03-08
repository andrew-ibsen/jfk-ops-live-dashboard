import { useMemo, useState } from 'react'
import './App.css'

type Staff = { name: string; shift: string; role: 'Mechanic' | 'Maint Rep'; absence?: string }
type Flight = { airline: string; arr?: string; dep?: string; eta?: string; std?: string; reg?: string; notes?: string }

type DashboardData = { date?: string; staff: Staff[]; flights: Flight[] }

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
      row.push(cur.trim())
      cur = ''
    } else if ((c === '\n' || c === '\r') && !q) {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur.trim())
      if (row.some((x) => x.length > 0)) rows.push(row)
      row = []
      cur = ''
    } else cur += c
  }
  if (cur.length || row.length) {
    row.push(cur.trim())
    if (row.some((x) => x.length > 0)) rows.push(row)
  }
  return rows
}

function parseActivity(rows: string[][]): DashboardData {
  const data: DashboardData = { staff: [], flights: [] }
  const dateRow = rows.find((r) => /\d{2}\/\d{2}\/\d{4}/.test(r[0] || ''))
  if (dateRow) data.date = (dateRow[0] || '').split(' ')[0]

  let flightStart = rows.findIndex((r) => r.includes('A/C REG'))
  if (flightStart >= 0) {
    for (let i = flightStart + 1; i < rows.length; i++) {
      const r = rows[i]
      if ((r[0] || '').toLowerCase().includes('mechanics')) break
      const arr = r[2] || ''
      const dep = r[5] || ''
      if (!arr && !dep) continue
      data.flights.push({
        airline: (arr || dep).slice(0, 2).toUpperCase(),
        reg: r[1],
        arr,
        eta: r[3],
        dep,
        std: r[6],
        notes: r[9]
      })
    }
  }

  const staffStart = rows.findIndex((r) => (r[0] || '').toLowerCase() === 'mechanics')
  if (staffStart >= 0) {
    for (let i = staffStart + 1; i < rows.length; i++) {
      const r = rows[i]
      if ((r[0] || '').startsWith('Shift A')) break
      const mech = r[0]
      const mShift = r[2]
      const rep = r[3]
      const rShift = r[5]
      if (mech) data.staff.push({ name: mech, shift: mShift, role: 'Mechanic' })
      if (rep) data.staff.push({ name: rep, shift: rShift, role: 'Maint Rep' })
    }
  }
  return data
}

function parseShift(rows: string[][]): DashboardData {
  const data: DashboardData = { staff: [], flights: [] }
  const dateRow = rows.find((r) => /Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday/i.test(r.join(' ')))
  if (dateRow) data.date = dateRow.join(' ').replace(/,+/g, ' ').trim()

  const start = rows.findIndex((r) => (r[1] || '').toLowerCase() === 'mechanics')
  if (start >= 0) {
    for (let i = start + 1; i < rows.length; i++) {
      const r = rows[i]
      if ((r[1] || '').toLowerCase().includes('aer lingus')) break
      const mech = r[1]
      const mechShift = r[2]
      const rep = r[3]
      const repShift = r[4]
      const absenceName = r[7]
      const absenceType = r[9]

      if (mech) data.staff.push({ name: mech, shift: mechShift, role: 'Mechanic' })
      if (rep) data.staff.push({ name: rep, shift: repShift, role: 'Maint Rep' })
      if (absenceName) data.staff.push({ name: absenceName, shift: '-', role: 'Mechanic', absence: absenceType || 'Absent' })

      const op = r[5]
      if (op && /\d/.test(op)) {
        data.flights.push({ airline: 'BA', notes: op })
      }
    }
  }
  return data
}

export default function App() {
  const [activity, setActivity] = useState<DashboardData>({ staff: [], flights: [] })
  const [shift, setShift] = useState<DashboardData>({ staff: [], flights: [] })

  const merged = useMemo(() => {
    const staffMap = new Map<string, Staff>()
    ;[...activity.staff, ...shift.staff].forEach((s) => {
      const key = s.name.toLowerCase()
      const prev = staffMap.get(key)
      staffMap.set(key, { ...prev, ...s, name: s.name } as Staff)
    })

    const flights = [...activity.flights, ...shift.flights]
    return {
      date: activity.date || shift.date,
      staff: Array.from(staffMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      flights
    }
  }, [activity, shift])

  const handleFile = async (file: File, kind: 'activity' | 'shift') => {
    const text = await file.text()
    const rows = parseCsv(text)
    const parsed = kind === 'activity' ? parseActivity(rows) : parseShift(rows)
    if (kind === 'activity') setActivity(parsed)
    else setShift(parsed)
  }

  return (
    <div className="page">
      <h1>JFK Ops Live Dashboard (MVP)</h1>
      <p>Upload both daily sheets to create one live consolidated view.</p>

      <div className="uploadGrid">
        <label className="card">
          <strong>1) Daily Activity Sheet CSV</strong>
          <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], 'activity')} />
        </label>
        <label className="card">
          <strong>2) Shift Assignment CSV</strong>
          <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], 'shift')} />
        </label>
      </div>

      <div className="card">
        <h2>Today</h2>
        <p><b>Date:</b> {merged.date || '—'}</p>
        <p><b>People loaded:</b> {merged.staff.length} | <b>Flight/ops rows:</b> {merged.flights.length}</p>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Roster & Absences</h3>
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Shift</th><th>Status</th></tr></thead>
            <tbody>
              {merged.staff.map((s) => (
                <tr key={s.name + s.role}>
                  <td>{s.name}</td><td>{s.role}</td><td>{s.shift || '-'}</td><td>{s.absence || 'On duty'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Flight / Ops Activity</h3>
          <table>
            <thead><tr><th>Airline</th><th>Arr</th><th>ETA</th><th>Dep</th><th>STD</th><th>Reg/Notes</th></tr></thead>
            <tbody>
              {merged.flights.map((f, i) => (
                <tr key={i}>
                  <td>{f.airline}</td><td>{f.arr || '-'}</td><td>{f.eta || '-'}</td><td>{f.dep || '-'}</td><td>{f.std || '-'}</td><td>{f.reg || f.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
