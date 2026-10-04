// dates are plain strings: days 'YYYY-MM-DD', clock times 'HH:mm' (local), moments ISO (UTC) — all sort as text
const pad = (n) => String(n).padStart(2, '0')
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => ymd(new Date())
export const parseDay = (s) => new Date(`${s}T00:00`)
export function addDays(s, n) {
  const d = parseDay(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}
export const weekday = (s) => parseDay(s).getDay()
export const startOfWeek = (s) => addDays(s, -((weekday(s) + 6) % 7)) // Monday
export const clockNow = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const nowIso = () => new Date().toISOString()
export const uid = () => crypto.randomUUID()
export const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1
export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5)

const dayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
const longFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })
export const fmtDay = (s) => (s ? dayFmt.format(parseDay(s)) : '')
export const fmtLong = (s) => longFmt.format(parseDay(s))
export const fmtMonth = (s) => monthFmt.format(parseDay(s))

export function relDay(s) {
  const n = daysBetween(today(), s)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  if (n > 1 && n < 7) return `In ${n} days`
  if (n < -1 && n > -7) return `${-n} days ago`
  return fmtDay(s)
}

export function fmtTime(hm) {
  const [h, m] = hm.split(':').map(Number)
  return `${h % 12 || 12}${m ? ':' + pad(m) : ''} ${h < 12 ? 'am' : 'pm'}`
}

export function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return fmtDay(ymd(new Date(iso)))
}

export const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

