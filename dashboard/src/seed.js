// Sample studio for the demo. Every person, client, number and link here is made up — replace them from inside the
// app (Settings › Team / Clients) or wipe them with Settings › Reset demo data. Dates are relative to today so the
// demo always looks live.
import { addDays, startOfWeek, today, weekday } from './util.js'

export function seed() {
  const T = today()
  const day = (n) => addDays(T, n)
  const ago = (mins) => new Date(Date.now() - mins * 60000).toISOString()
  const H = 60
  const D = 24 * H
  const month = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date())

  let n = 0
  const person = (id, name, role, title, color, extra = {}) => ({
    dept: '',
    owner: false,
    id,
    name,
    email: `${id}@ygdigitals.com`,
    role,
    clientId: null,
    title,
    phone: `+91 90000 ${String(++n).padStart(5, '0')}`,
    color,
    active: true,
    ...extra,
  })
  const client = (id, name, clientId, title, email, color) => ({ ...person(id, name, 'client', title, color), email, clientId, phone: '' })

  const users = [
    person('aman', 'Aman Verma', 'admin', 'Founder · strategy & client servicing', '#9f1239', { owner: true }),
    person('priya', 'Priya Kadian', 'member', 'Social media & content', '#e04c5c', { dept: 'social' }),
    person('vikas', 'Vikas Rathee', 'member', 'Shoots & video editing', '#d97706', { dept: 'video' }),
    person('ritika', 'Ritika Arora', 'member', 'Design — packaging & creatives', '#7c3aed', { dept: 'design' }),
    person('arjun', 'Arjun Mehta', 'member', 'Websites & e-commerce', '#0d9488', { dept: 'website' }),
    client('rahul', 'Rahul Gupta', 'desi', 'Founder, Desi Crunch Snacks', 'rahul@desicrunch.in', '#b45309'),
    client('sunita', 'Sunita Malhotra', 'greenvalley', 'Marketing Head, Green Valley Realty', 'sunita@greenvalleyrealty.in', '#15803d'),
    client('vikram', 'Vikram Jindal', 'steel', 'Director, Haryana Steel Works', 'vikram@haryanasteel.in', '#334155'),
    client('ishita', 'Ishita Kapoor', 'glow', 'Co-founder, Glow Herbals', 'ishita@glowherbals.in', '#be185d'),
  ]
  const staffIds = users.filter((u) => u.role !== 'client').map((u) => u.id)

  const clients = [
    { id: 'desi', name: 'Desi Crunch Snacks', industry: 'FMCG / D2C snacks', city: 'Sonipat', contact: 'Rahul Gupta', email: 'rahul@desicrunch.in', phone: '', notes: 'Family-run namkeen & mithai brand. Rahul approves everything himself — send work before 6 pm so he sees it the same day.' },
    { id: 'greenvalley', name: 'Green Valley Realty', industry: 'Real estate', city: 'Gohana & Rohtak', contact: 'Sunita Malhotra', email: 'sunita@greenvalleyrealty.in', phone: '', notes: 'Plotted colonies and villas. Leads come from Meta lead forms — share the lead sheet every Monday.' },
    { id: 'steel', name: 'Haryana Steel Works', industry: 'Manufacturing', city: 'Panipat', contact: 'Vikram Jindal', email: 'vikram@haryanasteel.in', phone: '', notes: 'Steel fabrication for export buyers. Website must lead with the machines and have a WhatsApp enquiry button.' },
    { id: 'glow', name: 'Glow Herbals', industry: 'D2C skincare', city: 'New Delhi', contact: 'Ishita Kapoor', email: 'ishita@glowherbals.in', phone: '', notes: 'Launching on Amazon and Flipkart first, Meesho later. Strict about ingredient claims — check every listing line.' },
    { id: 'shreeram', name: 'Shree Ram Furniture', industry: 'Local retail', city: 'Gohana', contact: 'Mahesh Garg', email: 'contact@shreeramfurniture.in', phone: '', notes: 'Showroom on the main market road. No client login yet — add one from Settings › Clients.' },
  ]

  // managerId = the project lead: the client's point of contact, and the one who hears when the client writes
  const projects = [
    { id: 'p-diwali', name: 'Diwali Festive Campaign', clientId: 'desi', status: 'active', priority: 'high', start: day(-10), due: day(12), managerId: 'priya', memberIds: ['vikas', 'ritika', 'arjun'], brief: 'Three festive Reels, a gift-box launch and ₹40,000 of Meta ads across Sonipat, Panipat and Delhi. Tone: warm, family, “ghar ki mithaas”. Everything live 10 days before Diwali; gift box listed on Amazon with A+ content.' },
    { id: 'p-gv-month', name: `Social Media Retainer — ${month}`, clientId: 'greenvalley', status: 'active', priority: 'normal', start: day(-12), due: day(18), managerId: 'priya', memberIds: ['vikas', 'ritika'], brief: '12 posts + 4 Reels this month, daily comment & DM replies within 2 hours, lead-form ads with a weekly lead sheet to Sunita every Monday.' },
    { id: 'p-steel-web', name: 'Corporate Website Revamp', clientId: 'steel', status: 'active', priority: 'high', start: day(-20), due: day(24), managerId: 'arjun', memberIds: ['vikas', 'priya'], brief: 'Export-ready website: machines and capacity first, 8 product categories, catalogue PDF, WhatsApp enquiry button, fast on mobile. Factory shoot for all photos and a 60-second plant video.' },
    { id: 'p-glow-mkt', name: 'Amazon & Flipkart Store Launch', clientId: 'glow', status: 'active', priority: 'urgent', start: day(-15), due: day(9), managerId: 'arjun', memberIds: ['ritika'], brief: '14 SKUs live on Amazon and Flipkart with Brand Registry, keyword-rich listings, white-background images + 4 infographics each, and launch-week Sponsored Products.' },
    { id: 'p-desi-pack', name: 'Masala Range Pouch Packaging', clientId: 'desi', status: 'review', priority: 'normal', start: day(-25), due: day(3), managerId: 'ritika', memberIds: [], brief: 'Stand-up pouches for 4 masala SKUs (100 g / 200 g). Shelf impact from 2 metres, FSSAI and veg mark, print-ready dielines for the Sonipat printer.' },
    { id: 'p-gv-reels', name: 'Sector 7 Plot Launch Reels', clientId: 'greenvalley', status: 'planning', priority: 'normal', start: day(4), due: day(20), managerId: 'vikas', memberIds: ['priya'], brief: '4 launch Reels for the new Sector 7 plots: drone opener, road & park walkthrough, family testimonial, price reveal. Runs as ads after the launch event.' },
    { id: 'p-sr-web', name: 'Showroom Website', clientId: 'shreeram', status: 'done', priority: 'normal', start: day(-60), due: day(-18), managerId: 'arjun', memberIds: [], brief: '5-page site with the full catalogue, Google Maps, WhatsApp button and Google Business Profile link.' },
  ].map((p) => ({ ...p, createdAt: p.start < T ? p.start : T }))

  let k = 0
  const task = (projectId, assigneeId, status, priority, due, title, extra = {}) => {
    const id = `t${++k}`
    return {
      id,
      projectId,
      assigneeId,
      dept: users.find((u) => u.id === assigneeId)?.dept ?? 'video', // the department doing it (unowned work: video)
      status,
      priority,
      due: day(due),
      title,
      repeat: 'none',
      desc: '',
      checklist: [],
      comments: [],
      createdBy: projects.find((p) => p.id === projectId).managerId,
      createdAt: ago(12 * D),
      completedAt: status === 'done' ? day(Math.min(due, -1)) : null,
      ...extra,
      ...(extra.checklist && { checklist: extra.checklist.map(([text, done], i) => ({ id: `${id}c${i}`, text, done })) }),
    }
  }
  const c = (userId, minsAgo, text, more = {}) => ({ id: `${userId}${minsAgo}`, userId, text, at: ago(minsAgo), ...more })

  const tasks = [
    task('p-diwali', 'priya', 'done', 'high', -6, 'Festive content calendar — 12 posts', { checklist: [['Theme & hooks', true], ['12 post slots with formats', true], ['Client sign-off', true]] }),
    task('p-diwali', 'priya', 'done', 'normal', -4, 'Scripts for 3 Diwali Reels', { desc: 'Hinglish, 30 seconds each, hook in the first 2 seconds. Reel 1: grandma reveal. Reel 2: office Diwali. Reel 3: gift box unboxing.' }),
    task('p-diwali', 'vikas', 'doing', 'high', 2, 'Shoot day: family Reels + product macros at the Sonipat unit', {
      desc: 'Full day at the Desi Crunch unit. Packing area free 10–1 (confirmed by Rahul). Talent: Rahul’s family + 2 staff.',
      checklist: [['Shot list', true], ['Book lights & gimbal', true], ['Props: diyas, gift boxes, rangoli', false], ['Talent release forms', false]],
      comments: [c('priya', 20 * H, 'Hook for Reel 1 is the grandma reveal — get at least 3 takes of it.'), c('vikas', 19 * H, 'Noted. Will also grab slow-mo of the bhujia pour for the end cards @Ritika.')],
    }),
    task('p-diwali', 'vikas', 'todo', 'high', 5, 'Edit Reel 1 — Ghar ki Mithaas (30s)', { desc: 'Footage lands after the shoot. Hook in the first 2 seconds, Hinglish captions, end card from Ritika.' }),
    task('p-diwali', 'ritika', 'doing', 'normal', 4, 'Offer end cards for the Reels (3 variants)'),
    task('p-diwali', 'ritika', 'review', 'high', 1, 'Festive gift box — front, back and dieline', { checklist: [['Front & back artwork', true], ['Dieline from printer', true], ['Mockup for Amazon', false]] }),
    task('p-diwali', 'priya', 'todo', 'high', 6, 'Diwali Meta ads — ₹40,000 across 3 ad sets', { checklist: [['Audiences: Sonipat, Panipat, Delhi · 25–45', true], ['Creatives from Vikas & Ritika', false], ['Pixel & lead form check', false]] }),
    task('p-diwali', 'arjun', 'todo', 'normal', 8, 'Amazon A+ content for the gift box listing'),
    task('p-diwali', 'vikas', 'todo', 'normal', 7, 'Edit Reel 2 — Office wala Diwali', {
      createdBy: 'priya',
      comments: [c('priya', 6 * H, 'Script is final (it’s in the brief). Footage comes from the Sonipat shoot — needs to open on the gift box.', { handoff: 'Priya → Vikas' })],
    }),
    task('p-gv-month', 'priya', 'done', 'normal', -8, 'Monthly content calendar approved by client'),
    task('p-gv-month', 'ritika', 'doing', 'normal', 1, 'Carousel: 5 reasons to buy in Sector 7'),
    task('p-gv-month', 'priya', 'doing', 'normal', 0, 'Reply to comments & DMs (within 2 hours)', { desc: 'Daily. Hot leads go to Sunita on WhatsApp the same hour.' }),
    task('p-gv-month', 'vikas', 'review', 'high', 0, 'Edit walkthrough Reel — Villa 12'),
    task('p-gv-month', 'priya', 'doing', 'high', 3, 'Lead form ads — refresh creatives'),
    task('p-gv-month', 'priya', 'todo', 'normal', -2, 'Send last week’s lead sheet to Sunita', { repeat: 'weekly' }),
    task('p-steel-web', 'arjun', 'done', 'high', -12, 'Sitemap & wireframes'),
    task('p-steel-web', 'arjun', 'doing', 'high', 2, 'Homepage design v2 — machines first, WhatsApp button', { comments: [c('aman', 2 * D, 'Vikram wants the CNC machines above the fold. Keep the hero video slot for the plant film.')] }),
    task('p-steel-web', 'vikas', 'todo', 'high', -1, 'Factory shoot — machines, welding, team portraits', { checklist: [['Shot list from Arjun', true], ['Safety gear for crew', false], ['Drone permission', false]] }),
    task('p-steel-web', 'arjun', 'todo', 'normal', 14, 'Build product catalogue pages (8 categories)'),
    task('p-steel-web', 'priya', 'doing', 'normal', 3, 'Write copy: About, Capabilities, Export'),
    task('p-steel-web', 'arjun', 'todo', 'normal', 20, 'SEO, Search Console and speed check before launch'),
    task('p-glow-mkt', 'arjun', 'done', 'high', -9, 'Brand Registry & seller accounts (Amazon, Flipkart)'),
    task('p-glow-mkt', 'arjun', 'doing', 'urgent', -1, 'List 14 SKUs with keywords & bullet points', { checklist: [['Keyword research', true], ['Titles & bullets (14/14)', true], ['Backend search terms', false], ['Ishita’s claims check', false]] }),
    task('p-glow-mkt', 'ritika', 'doing', 'high', 2, 'Listing images — white background + 4 infographics per SKU'),
    task('p-glow-mkt', 'arjun', 'todo', 'normal', 7, 'Sponsored Products campaigns for launch week'),
    task('p-desi-pack', 'ritika', 'done', 'high', -8, 'Dielines for 4 masala pouch SKUs'),
    task('p-desi-pack', 'ritika', 'done', 'normal', -4, '3D mockups for client review'),
    task('p-desi-pack', 'ritika', 'todo', 'normal', 4, 'Print-ready files & printer handover (after approval)'),
    task('p-gv-reels', 'vikas', 'todo', 'normal', 3, 'Location recce & shot list — Sector 7'),
    task('p-gv-reels', 'vikas', 'todo', 'low', 3, 'Check drone permission (green zone?)'),
    task('p-gv-reels', null, 'todo', 'normal', 18, 'Pick music & edit style for the 4 launch Reels'),
    task('p-sr-web', 'arjun', 'done', 'normal', -20, 'Build 5-page showroom site'),
    task('p-sr-web', 'arjun', 'done', 'normal', -18, 'Launch, Google Business Profile link, handover'),
  ]

  const deliverables = [
    { id: 'd1', projectId: 'p-desi-pack', title: 'Masala pouch designs — 4 SKUs', type: 'Design', link: 'https://drive.google.com/drive/folders/masala-pouch-v2', version: 2, status: 'client', sent: true, submittedBy: 'ritika', history: [
      { userId: 'ritika', at: ago(9 * D), action: 'submitted v1 for a check', note: '' },
      { userId: 'aman', at: ago(8 * D), action: 'sent v1 to the client', note: '' },
      { userId: 'rahul', at: ago(6 * D), action: 'requested changes', note: 'Make the chilli red brighter and the brand name bigger on the front.' },
      { userId: 'ritika', at: ago(3 * D), action: 'uploaded v2', note: 'Brighter red, logo 20% bigger, added the veg mark.' },
      { userId: 'aman', at: ago(2 * D), action: 'sent v2 to the client', note: '' },
    ] },
    { id: 'd2', projectId: 'p-gv-month', title: 'Villa 12 walkthrough Reel', type: 'Video', link: 'https://drive.google.com/file/d/villa12-reel-v1', version: 1, status: 'internal', sent: false, submittedBy: 'vikas', history: [{ userId: 'vikas', at: ago(3 * H), action: 'submitted v1 for a check', note: 'Trending audio, Hinglish captions, price on the last frame.' }] },
    { id: 'd3', projectId: 'p-steel-web', title: 'Homepage design', type: 'Website', link: 'https://www.figma.com/file/steel-homepage', version: 1, status: 'changes', sent: true, submittedBy: 'arjun', history: [
      { userId: 'arjun', at: ago(5 * D), action: 'submitted v1 for a check', note: '' },
      { userId: 'aman', at: ago(4 * D), action: 'sent v1 to the client', note: '' },
      { userId: 'vikram', at: ago(2 * D), action: 'requested changes', note: 'Show the CNC machines higher up. Add a WhatsApp button for export enquiries.' },
    ] },
    { id: 'd4', projectId: 'p-diwali', title: 'Festive content calendar', type: 'Copy', link: 'https://docs.google.com/spreadsheets/d/diwali-calendar', version: 1, status: 'approved', sent: true, submittedBy: 'priya', history: [
      { userId: 'priya', at: ago(8 * D), action: 'submitted v1 for a check', note: '' },
      { userId: 'aman', at: ago(8 * D), action: 'sent v1 to the client', note: '' },
      { userId: 'rahul', at: ago(7 * D), action: 'approved v1', note: 'Love the grandma idea.' },
    ] },
    { id: 'd5', projectId: 'p-diwali', title: 'Festive gift box design', type: 'Design', link: 'https://www.figma.com/file/desi-gift-box', version: 1, status: 'internal', sent: false, submittedBy: 'ritika', history: [{ userId: 'ritika', at: ago(5 * H), action: 'submitted v1 for a check', note: 'Front, back and dieline in one file.' }] },
    { id: 'd6', projectId: 'p-sr-web', title: 'Showroom website — live site & handover', type: 'Website', link: 'https://drive.google.com/file/d/showroom-handover', version: 1, status: 'approved', sent: true, submittedBy: 'arjun', history: [
      { userId: 'arjun', at: ago(19 * D), action: 'submitted v1 for a check', note: '' },
      { userId: 'aman', at: ago(19 * D), action: 'sent v1 to the client', note: '' },
      { userId: 'aman', at: ago(18 * D), action: 'approved v1 on the client’s behalf', note: 'Approved by Mahesh ji on a call.' },
    ] },
  ]

  const lastFriday = addDays(T, -((weekday(T) + 2) % 7))
  const ev = (id, title, type, date, start, end, attendeeIds, extra = {}) => ({ id, title, type, date, start, end, attendeeIds, repeat: 'none', location: '', agenda: '', projectId: '', createdBy: 'aman', rsvp: {}, ...extra })
  const yes = (...ids) => Object.fromEntries(ids.map((id) => [id, 'yes']))
  const events = [
    ev('e1', 'Daily stand-up', 'meeting', addDays(startOfWeek(T), -14), '10:00', '10:15', staffIds, { repeat: 'weekdays', location: 'Studio, Gohana', agenda: 'Yesterday, today, anything stuck. 15 minutes, standing.' }),
    ev('e2', 'Weekly planning', 'meeting', lastFriday, '17:00', '17:45', staffIds, { repeat: 'weekly', location: 'Studio, Gohana', agenda: 'What’s due next week, who’s overloaded, what’s stuck between people.' }),
    ev('e3', 'Desi Crunch — Diwali campaign check-in', 'client', day(0), '15:00', '15:45', ['aman', 'priya', 'rahul'], { projectId: 'p-diwali', location: 'https://meet.google.com/', agenda: '1. Gift box design\n2. Shoot day plan\n3. Ad budget split', rsvp: yes('aman', 'priya', 'rahul') }),
    ev('e4', 'Homepage feedback call', 'client', day(1), '12:00', '12:30', ['aman', 'arjun', 'vikram'], { projectId: 'p-steel-web', createdBy: 'arjun', location: 'https://meet.google.com/', agenda: 'Walk through homepage v2 with the machines-first layout.', rsvp: yes('arjun', 'vikram') }),
    ev('e5', 'Shoot day — Desi Crunch, Sonipat unit', 'shoot', day(2), '09:00', '17:00', ['vikas', 'priya'], { projectId: 'p-diwali', createdBy: 'vikas', location: 'Desi Crunch unit, Sonipat', agenda: 'Leave studio 7:30 am. Packing area 10–1. Family Reels after lunch.', rsvp: yes('vikas', 'priya') }),
    ev('e6', 'Creative review — this week’s posts', 'review', day(3), '11:30', '12:30', ['aman', 'priya', 'ritika', 'vikas'], { createdBy: 'priya', location: 'Studio, Gohana', agenda: 'Every post going out next week, on the big screen.' }),
    ev('e7', 'Location recce — Sector 7', 'shoot', day(3), '15:00', '17:00', ['vikas', 'sunita'], { projectId: 'p-gv-reels', createdBy: 'vikas', location: 'Green Valley Sector 7 site office' }),
    ev('e8', 'Factory shoot — Haryana Steel Works', 'shoot', day(6), '10:00', '16:00', ['vikas', 'arjun'], { projectId: 'p-steel-web', createdBy: 'arjun', location: 'Haryana Steel Works, Panipat' }),
    ev('e9', 'Monthly review', 'meeting', day(8), '17:30', '18:30', staffIds, { location: 'Studio, Gohana', agenda: 'Wins, client feedback, what we fix next month.' }),
    ev('e10', 'Glow Herbals — marketplace launch plan', 'client', day(-2), '16:00', '16:45', ['aman', 'arjun', 'ishita'], { projectId: 'p-glow-mkt', location: 'https://meet.google.com/', rsvp: yes('aman', 'arjun', 'ishita') }),
  ]

  const channels = [
    { id: 'ch-general', type: 'public', name: 'general' },
    { id: 'ch-announce', type: 'public', name: 'announcements', readOnly: true },
    ...projects.map((p) => ({ id: `ch-${p.id}`, type: 'project', projectId: p.id, clientVisible: true })),
    { id: 'dm-aman-priya', type: 'dm', memberIds: ['aman', 'priya'] },
  ]
  let m = 0
  const msg = (channelId, userId, minsAgo, text) => ({ id: `m${++m}`, channelId, userId, at: ago(minsAgo), text })
  const messages = [
    msg('ch-announce', 'aman', 3 * D, 'From today every piece of work goes through YG Hub: submit the link on the project, I check it, the client approves it right here. No more final_final_v3 on WhatsApp.'),
    msg('ch-announce', 'aman', 1 * D, 'Client calls are on the calendar with the Meet link inside. Please reply Yes / No so we know who is joining.'),
    msg('ch-general', 'priya', 3 * H, 'Anyone free to help with comment replies after 4? The Green Valley ad is getting a lot of DMs.'),
    msg('ch-general', 'arjun', 2.8 * H, 'I can take 30 minutes at 4:30.'),
    msg('ch-general', 'priya', 1 * H, '@Vikas lights and gimbal batteries charged for the Sonipat shoot? We leave at 7:30 am.'),
    msg('ch-general', 'vikas', 50, 'Charged and packed. Carrying the big reflector too.'),
    msg('ch-p-diwali', 'priya', 1 * D, `Hi Rahul ji, shoot day is ${addDays(T, 2)}. We need the packing area free from 10 to 1, and the family Reels after lunch.`),
    msg('ch-p-diwali', 'rahul', 20 * H, 'Done. Please show the new gift box in at least one Reel.'),
    msg('ch-p-diwali', 'priya', 18 * H, 'Noted — Reel 2 opens on the gift box.'),
    msg('ch-p-steel-web', 'vikram', 2 * D, 'Changes are on the homepage design. Main thing: export buyers must see the machines first.'),
    msg('ch-p-steel-web', 'arjun', 2 * D - 30, 'Got it, Vikram ji. v2 on the call tomorrow.'),
    msg('ch-p-desi-pack', 'ritika', 2 * D, 'v2 is up — brighter red and a bigger logo. Please approve it in the Deliverables tab so we can send files to the printer.'),
    msg('ch-p-glow-mkt', 'arjun', 6 * H, 'Ishita, 14 of 14 listings are written. Backend keywords go in today; could you check the ingredient claims by tomorrow?'),
    msg('dm-aman-priya', 'aman', 4 * H, 'Can you join the Desi Crunch call at 3? Rahul wants to talk about the ad budget.'),
    msg('dm-aman-priya', 'priya', 3.9 * H, 'Yes, I will bring the ad set plan.'),
  ]
  // everyone has read everything older than six hours
  const seen = ago(6 * H)
  const reads = Object.fromEntries(users.map((u) => [u.id, Object.fromEntries(channels.map((ch) => [ch.id, seen]))]))

  const post = (id, clientId, date, platform, format, title, status, assigneeId, caption = '') => ({ id, clientId, date, time: '19:00', platform, format, title, status, assigneeId, caption, notes: [], dept: ['Reel', 'Short'].includes(format) ? 'video' : 'design' })
  const posts = [
    post('s1', 'desi', day(-6), 'Instagram', 'Reel', 'Behind the scenes: how our bhujia is made', 'posted', 'vikas'),
    post('s2', 'desi', day(-3), 'Instagram', 'Post', 'Festive offer teaser', 'posted', 'ritika'),
    post('s3', 'desi', day(1), 'Instagram', 'Carousel', 'Gift box: what’s inside', 'ready', 'ritika', 'Ek dabba, saat swaad. Swipe to see what’s inside this year’s Desi Crunch Diwali box →'),
    post('s4', 'desi', day(4), 'Instagram', 'Reel', 'Ghar ki Mithaas', 'production', 'vikas'),
    post('s5', 'desi', day(7), 'Instagram', 'Reel', 'Office wala Diwali', 'idea', 'priya'),
    post('s6', 'desi', day(9), 'Instagram', 'Story', 'Countdown: 3 days to the Diwali sale', 'scheduled', 'priya'),
    post('s7', 'greenvalley', day(-2), 'Instagram', 'Carousel', 'Sector 7: location advantages', 'posted', 'ritika'),
    post('s8', 'greenvalley', day(1), 'Instagram', 'Reel', 'Villa 12 walkthrough', 'production', 'vikas'),
    post('s9', 'greenvalley', day(2), 'Facebook', 'Ad', 'Lead form — plots in Sector 7', 'ready', 'priya', 'Plots in Green Valley Sector 7, Gohana. 30-ft roads, park-facing options. Tap to get the price list on WhatsApp.'),
    post('s10', 'greenvalley', day(5), 'Instagram', 'Post', 'Handover day: the Sharma family', 'idea', 'priya'),
    post('s11', 'glow', day(4), 'Instagram', 'Reel', 'Now on Amazon: 3 hero products', 'idea', 'priya'),
    post('s12', 'glow', day(8), 'Instagram', 'Carousel', 'Ingredients we never use', 'production', 'ritika'),
  ]

  // a Navratri Reel that never went out: the studio owes Desi Crunch one extra, and has told Rahul
  const compensations = [
    { id: 'k-navratri', clientId: 'desi', postId: null, missed: 'Reel — Navratri wishes (1 Oct)', offer: '1 extra Reel this week', due: day(2), ownerId: 'vikas', status: 'open', shared: true, createdBy: 'aman', createdAt: ago(3 * D), givenAt: null },
  ]

  // Ritika's days off are approved; Arjun's request waits for the admin
  const leaves = [
    { id: 'l-ritika', userId: 'ritika', start: day(10), end: day(11), status: 'approved', decidedBy: 'aman', note: 'Cousin’s wedding in Jaipur', reply: 'Enjoy!', createdAt: ago(2 * D) },
    { id: 'l-arjun', userId: 'arjun', start: day(15), end: day(15), status: 'pending', decidedBy: null, note: 'Bank and passport work', reply: '', createdAt: ago(5 * H) },
  ]

  let a = 0
  const act = (userId, minsAgo, text, link) => ({ id: `a${++a}`, userId, at: ago(minsAgo), text, link })
  const activity = [
    act('vikas', 3 * H, 'submitted “Villa 12 walkthrough Reel” v1 for a check', '#/projects/p-gv-month/deliverables'),
    act('ritika', 5 * H, 'submitted “Festive gift box design” v1 for a check', '#/projects/p-diwali/deliverables'),
    act('priya', 6 * H, 'handed “Edit Reel 2 — Office wala Diwali” to Vikas', '#/tasks/t9'),
    act('ritika', 1 * D, 'moved “Festive gift box — front, back and dieline” to Review', '#/tasks/t6'),
    act('vikram', 2 * D, 'requested changes on “Homepage design”', '#/projects/p-steel-web/deliverables'),
    act('aman', 2 * D, 'sent “Masala pouch designs — 4 SKUs” v2 to Desi Crunch Snacks', '#/projects/p-desi-pack/deliverables'),
    act('aman', 2 * D, 'scheduled “Desi Crunch — Diwali campaign check-in”', '#/calendar'),
    act('arjun', 9 * D, 'moved “Brand Registry & seller accounts (Amazon, Flipkart)” to Done', '#/tasks/t22'),
  ]

  let q = 0
  const note = (userId, fromId, minsAgo, text, link, read = false) => ({ id: `n${++q}`, userId, fromId, at: ago(minsAgo), text, link, read })
  const notifications = [
    note('aman', 'vikas', 3 * H, 'submitted “Villa 12 walkthrough Reel” v1 for a check', '#/projects/p-gv-month/deliverables'),
    note('aman', 'ritika', 5 * H, 'submitted “Festive gift box design” v1 for a check', '#/projects/p-diwali/deliverables'),
    note('aman', 'vikram', 2 * D, 'requested changes on “Homepage design”', '#/projects/p-steel-web/deliverables', true),
    note('vikas', 'priya', 6 * H, 'handed you “Edit Reel 2 — Office wala Diwali”: needs to open on the gift box', '#/tasks/t9'),
    note('priya', 'aman', 4 * H, 'messaged you: Can you join the Desi Crunch call at 3?', '#/chat/dm-aman-priya', true),
    note('arjun', 'vikram', 2 * D, 'requested changes on “Homepage design”', '#/projects/p-steel-web/deliverables'),
    note('rahul', 'aman', 2 * D, 'sent “Masala pouch designs — 4 SKUs” v2 for your approval', '#/projects/p-desi-pack/deliverables'),
    note('rahul', 'ritika', 1 * D, 'has a Carousel ready for your approval: “Gift box: what’s inside”', '#/content'),
    note('sunita', 'priya', 10 * H, 'has an Ad ready for your approval: “Lead form — plots in Sector 7”', '#/content'),
    note('vikram', 'arjun', 1 * D, 'invited you to “Homepage feedback call”', '#/calendar'),
  ]

  return { version: 2, users, clients, projects, tasks, deliverables, events, channels, messages, reads, posts, leaves, compensations, activity, notifications }
}
