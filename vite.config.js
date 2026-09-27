import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { SERVICES, SITE, pagePath } from './src/data.js'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// swap one attribute/element value in the built index.html, failing the build if the tag has gone missing
function swap(html, re, value) {
  if (!re.test(html)) throw new Error(`pages: ${re} not found in index.html`)
  return html.replace(re, (_, head) => head + value)
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
      fs.writeFileSync(path.join(dir, 'index.html'), withUrl(home, `${SITE}/`))

      fs.mkdirSync(path.join(dir, 'services'), { recursive: true })
      for (const p of SERVICES) {
        let html = withUrl(home, SITE + pagePath(p))
        html = swap(html, /(<title>)[^<]*/, esc(p.meta.title))
        html = swap(html, /(property="og:title" content=")[^"]*/, esc(p.meta.title))
        html = swap(html, /(name="description" content=")[^"]*/, esc(p.meta.description))
        html = swap(html, /(property="og:description" content=")[^"]*/, esc(p.meta.description))
        // no loader on these pages: drop the red boot blob and start on the light backdrop
        html = swap(html, /(<div id="root">)<div class="boot"[^]*?<\/div><\/div>/, '')
        html = swap(html, /(html,\s*body\s*\{\s*background:\s*)#0d0d0d/, '#f2f1ee')
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
