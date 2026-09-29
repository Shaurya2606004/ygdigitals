import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { CONTACT, SERVICES, SITE, pagePath } from './src/data.js'
import { CONTENT } from './src/pages/content.js'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// swap one attribute/element value in the built index.html, failing the build if the tag has gone missing
function swap(html, re, value) {
  if (!re.test(html)) throw new Error(`pages: ${re} not found in index.html`)
  return html.replace(re, (_, head) => head + value)
}

// where the studio works: its town, the nearby cities people search from, then the whole country
const AREAS = [...['Gohana', 'Sonipat', 'Panipat', 'Rohtak'].map((name) => ({ '@type': 'City', name })), { '@type': 'State', name: 'Haryana' }, { '@type': 'Country', name: 'India' }]

// schema.org JSON-LD: the studio itself on every page; each service page adds the service, its breadcrumb and its FAQ
const ORG = {
  '@type': 'ProfessionalService',
  '@id': `${SITE}/#org`,
  name: 'YG Digitals',
  url: `${SITE}/`,
  logo: `${SITE}/apple-touch-icon.png`,
  image: `${SITE}/og.png`,
  telephone: CONTACT.tel.replace('tel:', ''),
  email: CONTACT.email,
  address: { '@type': 'PostalAddress', addressLocality: 'Gohana', addressRegion: 'Haryana', addressCountry: 'IN' },
  description: 'Digital marketing agency in Gohana, Haryana — social media marketing, e-commerce account management, packaging design, website design, video editing and Reel shoots.',
  areaServed: AREAS,
  sameAs: [CONTACT.instagram],
  knowsAbout: SERVICES.map((s) => s.title),
}
// `<` escaped so nothing in the data can close the script tag
const ldJson = (graph) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`

function serviceLd(p) {
  const url = SITE + pagePath(p)
  const name = p.lines.join(' ')
  return [
    ORG,
    { '@type': 'Service', name, serviceType: p.title, description: p.meta.description, url, provider: { '@id': ORG['@id'] }, areaServed: AREAS },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE}/#services` },
        { '@type': 'ListItem', position: 3, name, item: url },
      ],
    },
    { '@type': 'FAQPage', mainEntity: CONTENT[p.id].faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ]
}

/*
 * The app is one bundle, but every page gets its own HTML file with its own title, description, canonical URL and
 * link-preview tags (WhatsApp and Instagram previews never run JS). Also writes sitemap.xml and robots.txt from the
 * same page list the app routes on. vercel.json's cleanUrls serves services/x.html at /services/x.
 */
function pages() {
  return {
    name: 'yg-pages',
    apply: 'build',
    writeBundle({ dir }, bundle) {
      const home = bundle['index.html'].source
      const withUrl = (html, url) => swap(swap(html, /(rel="canonical" href=")[^"]*/, url), /(property="og:url" content=")[^"]*/, url)
      const withLd = (html, graph) => swap(html, /(\s*)<\/head>/, `${ldJson(graph)}\n  </head>`)
      fs.writeFileSync(path.join(dir, 'index.html'), withLd(withUrl(home, `${SITE}/`), [ORG]))

      fs.mkdirSync(path.join(dir, 'services'), { recursive: true })
      for (const p of SERVICES) {
        let html = withUrl(home, SITE + pagePath(p))
        html = swap(html, /(<title>)[^<]*/, esc(p.meta.title))
        html = swap(html, /(property="og:title" content=")[^"]*/, esc(p.meta.title))
        html = swap(html, /(name="description" content=")[^"]*/, esc(p.meta.description))
        html = swap(html, /(property="og:description" content=")[^"]*/, esc(p.meta.description))
        html = withLd(html, serviceLd(p))
        fs.writeFileSync(path.join(dir, `${pagePath(p).slice(1)}.html`), html)
      }

      const today = new Date().toISOString().slice(0, 10)
      const urls = ['/', ...SERVICES.map(pagePath)].map((u) => `  <url>\n    <loc>${SITE}${u}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
      fs.writeFileSync(path.join(dir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)
      fs.writeFileSync(path.join(dir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pages()],
})
