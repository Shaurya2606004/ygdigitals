# YG Digitals

Portfolio site for YG Digitals — social media management, e-commerce handling, packaging, websites, video editing and video/Reel shoots. Gohana → all of India.

Vite + React, three.js (@react-three/fiber + drei), GSAP ScrollTrigger, Lenis, Framer Motion.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # static output in dist/
```

- Content (services, stats, contact details, the site address `SITE`): `src/data.js`
- Service pages (`/services/<slug>`, one per service, each with a Live projects section): copy and projects in `src/pages/content.js`, layout in `src/pages/ServicePage.jsx`
- The build writes one HTML file per page (own title, description and link preview) plus `sitemap.xml` and `robots.txt` — see `vite.config.js`. When the custom domain is attached, change `SITE` in `src/data.js`.
- Clay props (incl. Instagram / Amazon / Flipkart / Meesho models): `src/three/clay.jsx`
- Mascots (guy + girl): `src/three/character.jsx`
- Hero scene + glass lens: `src/three/HeroScene.jsx`
- One component per section: `src/components/`

Before launch: the live `projects` in `src/pages/content.js` and the "100+ projects" stat in `src/data.js` are placeholders — swap in real client work (with its live `url`) and numbers. The service-page copy describes how the studio works (daily checks, in-house team, what's delivered); have the client confirm every line matches reality.
