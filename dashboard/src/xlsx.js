// A content calendar made in Excel → posts. No library: an .xlsx is a zip of XML files, which the browser can unzip
// (DecompressionStream) and a few patterns can read.
// ponytail: reads the first sheet's saved values with regexes — fine for the plain sheets people make; a formula shows
// its last saved result. Swap in a real parser if sheets with odd structure ever show up.
import { FORMATS } from './store.js'

async function unzip(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let end = buf.length - 22
  while (end >= 0 && v.getUint32(end, true) !== 0x06054b50) end--
  if (end < 0) throw new Error('That isn’t an Excel file — save it as .xlsx and try again.')
  const files = {}
  for (let i = 0, p = v.getUint32(end + 16, true); i < v.getUint16(end + 10, true); i++) {
    const nameLen = v.getUint16(p + 28, true)
    const at = v.getUint32(p + 42, true)
    const start = at + 30 + v.getUint16(at + 26, true) + v.getUint16(at + 28, true)
    files[new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen))] = { deflated: v.getUint16(p + 10, true) === 8, bytes: buf.subarray(start, start + v.getUint32(p + 20, true)) }
    p += 46 + nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true)
  }
  return (name) => {
    const f = files[name]
    if (!f) return Promise.resolve('')
    if (!f.deflated) return Promise.resolve(new TextDecoder().decode(f.bytes))
    return new Response(new Blob([f.bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()
  }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const unescape = (s) => s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(\w+));/gi, (m, hex, dec, name) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(+dec) : (ENTITIES[name] ?? m)))
const texts = (xml) => unescape([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''))

// the first sheet as rows of cells: text, numbers (dates are day numbers), true/false; '' for an empty or #ERROR cell
export async function readSheet(bytes) {
  const read = await unzip(bytes)
  const rid = (await read('xl/workbook.xml')).match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1]
  const rel = (await read('xl/_rels/workbook.xml.rels')).match(new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*>`))?.[0]
  const target = rel?.match(/\bTarget="([^"]+)"/)?.[1] ?? 'worksheets/sheet1.xml'
  const sheet = await read(target.startsWith('/') ? target.slice(1) : `xl/${target}`)
  if (!sheet) throw new Error('Couldn’t find a sheet in that file.')
  const shared = [...(await read('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]))
  return [...sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(([, cells]) => {
    const row = []
    for (const [, attrs, body = ''] of cells.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const col = [...(attrs.match(/\br="([A-Z]+)/)?.[1] ?? '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
      const type = attrs.match(/\bt="(\w+)"/)?.[1]
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      row[col < 0 ? row.length : col] =
        type === 'inlineStr' ? texts(body) : raw == null || type === 'e' ? '' : type === 's' ? shared[+raw] : type === 'str' ? unescape(raw) : type === 'b' ? raw === '1' : +raw
    }
    return row
  })
}

const iso = (y, m, d) => {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCMonth() === m - 1 ? t.toISOString().slice(0, 10) : ''
}
// a date cell: Excel's day number, or text like 2026-10-05, 05/10/2026 (day first, as in India) or 5 Oct 2026
export function toDay(x) {
  if (typeof x === 'number') return x > 20000 && x < 80000 ? new Date(Date.UTC(1899, 11, 30) + Math.floor(x) * 864e5).toISOString().slice(0, 10) : ''
  const s = String(x ?? '').trim()
  let m
  if ((m = s.match(/^(\d{4})-(\d\d?)-(\d\d?)/))) return iso(+m[1], +m[2], +m[3])
  if ((m = s.match(/^(\d\d?)[/.-](\d\d?)[/.-](\d{2}|\d{4})$/))) return iso(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1])
  if (!/\d{4}/.test(s)) return ''
  const t = new Date(`${s} 12:00 UTC`)
  return isNaN(t) ? '' : t.toISOString().slice(0, 10)
}

const FORMAT_WORDS = [[/reel/i, 'Reel'], [/carou?sel/i, 'Carousel'], [/stor(y|ies)/i, 'Story'], [/short/i, 'Short'], [/\bads?\b/i, 'Ad']]
const STATUS_WORDS = [[/\bposted\b|published|\blive\b|^done$/i, 'posted'], [/schedul|approved/i, 'scheduled'], [/ready|approval/i, 'ready'], [/produc|shoot|edit|design|progress|making/i, 'production']]
const HEADS = { date: /^date$/i, format: /content type|post type|^type$|format/i, title: /topic|title|hook|idea|concept/i, brief: /script|reference|brief|description|details/i, festival: /festival|occasion/i, platform: /platform/i, status: /status/i }
const blank = (x) => x == null || /^\s*-?\s*$/.test(String(x))

// the rows under the sheet's header row (the one with a "Date" column) that have a date and something planned.
// Rows with no type and no topic are days with no post; rows without a real date (totals, notes) are left out.
export function postsFromSheet(rows) {
  const h = rows.findIndex((r) => r.some((c) => HEADS.date.test(String(c ?? '').trim())))
  if (h < 0) throw new Error('Couldn’t find a “Date” column. The sheet needs a header row with Date, and a Topic or Content Type.')
  const col = Object.fromEntries(Object.entries(HEADS).map(([k, re]) => [k, rows[h].findIndex((c) => re.test(String(c ?? '').trim()))]))
  if (col.title < 0 && col.format < 0) throw new Error('Couldn’t find a Topic or Content Type column next to Date.')
  const cell = (r, k) => (col[k] < 0 || blank(r[col[k]]) ? '' : String(r[col[k]]).trim())
  return rows.slice(h + 1).flatMap((r) => {
    const date = toDay(r[col.date])
    const kind = cell(r, 'format')
    const topic = cell(r, 'title')
    if (!date || (!kind && !topic)) return []
    const format = FORMAT_WORDS.find(([re]) => re.test(kind))?.[1] ?? 'Post'
    const platform = cell(r, 'platform')
    return [{
      date,
      format: FORMATS.includes(format) ? format : 'Post',
      title: (topic || kind).slice(0, 300),
      brief: [cell(r, 'festival') && `Festival: ${cell(r, 'festival')}`, cell(r, 'brief')].filter(Boolean).join('\n').slice(0, 5000),
      status: STATUS_WORDS.find(([re]) => re.test(cell(r, 'status')))?.[1] ?? 'idea',
      ...(platform && { platform }),
    }]
  })
}
