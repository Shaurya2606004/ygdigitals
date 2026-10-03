// Sample organisation for the demo. Every person, client, number and link here is made up — replace them from
// inside the app (People, Clients) or wipe them with Settings › Reset demo data. Dates are relative to today so
// the demo always looks live.
import { addDays, startOfWeek, today, weekday } from './util.js'

export function seed() {
  const T = today()
  const day = (n) => addDays(T, n)
  const ago = (mins) => new Date(Date.now() - mins * 60000).toISOString()
  const H = 60
  const D = 24 * H
  const month = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date())

  const org = { name: 'YG Digitals', address: 'Gohana, Haryana, India', email: 'ygdigitalsacc@gmail.com', phone: '+91 98174 58931', gstin: '', bank: '', upi: '' }

  const teams = [
    { id: 'mgmt', name: 'Management', color: '#475569', desc: 'Leadership, client servicing, accounts and billing.' },
    { id: 'social', name: 'Social Media', color: '#e04c5c', desc: 'Instagram & Facebook pages, content calendars, copy, community and Meta ads.' },
    { id: 'shoot', name: 'Production', color: '#d97706', desc: 'Video ad and Reel shoots on location — scripts, shot lists, lighting, direction.' },
    { id: 'edit', name: 'Video Editing', color: '#2563eb', desc: 'Reels, ad films and product videos — hooks, captions, motion graphics, sound.' },
    { id: 'design', name: 'Design', color: '#7c3aed', desc: 'Packaging, labels, social creatives, listing images and print-ready files.' },
    { id: 'web', name: 'Web', color: '#0d9488', desc: 'Websites and landing pages — design, build, SEO and launch.' },
    { id: 'ecom', name: 'E-commerce', color: '#16a34a', desc: 'Amazon, Flipkart and Meesho stores — listings, catalogue and marketplace ads.' },
  ]

  let n = 0
  const person = (id, name, role, teamId, title, color, skills, extra = {}) => ({
    id,
    name,
    email: `${id}@ygdigitals.com`,
    role,
    teamId,
    clientId: null,
    title,
    phone: `+91 90000 ${String(++n).padStart(5, '0')}`,
    about: '',
    skills,
    joined: day(-60 - n * 37),
    color,
    active: true,
    ...extra,
  })
  const client = (id, name, clientId, title, email, color) => ({ ...person(id, name, 'client', null, title, color, []), email, clientId, joined: day(-90) })

  const users = [
    person('aman', 'Aman Verma', 'admin', 'mgmt', 'Founder & Director', '#9f1239', ['Strategy', 'Sales', 'Client relations']),
    person('neha', 'Neha Sharma', 'manager', 'mgmt', 'Operations & Client Servicing', '#475569', ['Account management', 'Planning', 'Hiring']),
    person('rohit', 'Rohit Malik', 'member', 'mgmt', 'Accounts & Billing', '#64748b', ['GST', 'Invoicing', 'Tally']),
    person('priya', 'Priya Kadian', 'lead', 'social', 'Social Media Lead', '#e04c5c', ['Content strategy', 'Instagram', 'Client calls']),
    person('karan', 'Karan Dahiya', 'member', 'social', 'Meta Ads Specialist', '#f43f5e', ['Meta ads', 'Lead forms', 'Reporting']),
    person('simran', 'Simran Kaur', 'member', 'social', 'Copywriter & Community', '#fb7185', ['Hinglish copy', 'Scripts', 'Community']),
    person('vikas', 'Vikas Rathee', 'lead', 'shoot', 'Shoot Director', '#d97706', ['Direction', 'Scripts', 'Lighting']),
    person('sahil', 'Sahil Hooda', 'member', 'shoot', 'Videographer & Lighting', '#f59e0b', ['Camera', 'Gimbal', 'Drone']),
    person('ankit', 'Ankit Saini', 'lead', 'edit', 'Lead Video Editor', '#2563eb', ['Premiere Pro', 'Colour', 'Sound']),
    person('muskan', 'Muskan Jain', 'member', 'edit', 'Video Editor — Reels', '#3b82f6', ['CapCut', 'Premiere Pro', 'Captions']),
    person('deepak', 'Deepak Yadav', 'member', 'edit', 'Motion Designer', '#60a5fa', ['After Effects', 'Motion graphics', '3D titles']),
    person('ritika', 'Ritika Arora', 'lead', 'design', 'Creative Lead — Packaging', '#7c3aed', ['Packaging', 'Dielines', 'Illustrator']),
    person('mohit', 'Mohit Chauhan', 'member', 'design', 'Graphic Designer', '#8b5cf6', ['Social creatives', 'Photoshop', 'Listing images']),
    person('arjun', 'Arjun Mehta', 'lead', 'web', 'Web Lead', '#0d9488', ['Web strategy', 'SEO', 'React']),
    person('tanya', 'Tanya Bansal', 'member', 'web', 'UI Designer & Developer', '#14b8a6', ['Figma', 'UI design', 'Webflow']),
    person('gaurav', 'Gaurav Singla', 'lead', 'ecom', 'E-commerce Manager', '#16a34a', ['Amazon', 'Flipkart', 'Sponsored ads']),
    person('pooja', 'Pooja Rani', 'member', 'ecom', 'Listing & Catalogue Executive', '#22c55e', ['Listings', 'Keywords', 'Meesho']),
    client('rahul', 'Rahul Gupta', 'desi', 'Founder, Desi Crunch Snacks', 'rahul@desicrunch.in', '#b45309'),
    client('sunita', 'Sunita Malhotra', 'greenvalley', 'Marketing Head, Green Valley Realty', 'sunita@greenvalleyrealty.in', '#15803d'),
    client('vikram', 'Vikram Jindal', 'steel', 'Director, Haryana Steel Works', 'vikram@haryanasteel.in', '#334155'),
    client('ishita', 'Ishita Kapoor', 'glow', 'Co-founder, Glow Herbals', 'ishita@glowherbals.in', '#be185d'),
  ]
  const staffIds = users.filter((u) => u.role !== 'client').map((u) => u.id)

  const clients = [
    { id: 'desi', name: 'Desi Crunch Snacks', industry: 'FMCG / D2C snacks', city: 'Sonipat', contact: 'Rahul Gupta', email: 'rahul@desicrunch.in', phone: '', plan: 'retainer', fee: 65000, teamIds: ['social', 'shoot', 'edit', 'design', 'ecom'], managerId: 'neha', since: day(-210), notes: 'Family-run namkeen & mithai brand. Rahul approves everything himself — send work before 6 pm so he sees it the same day.' },
    { id: 'greenvalley', name: 'Green Valley Realty', industry: 'Real estate', city: 'Gohana & Rohtak', contact: 'Sunita Malhotra', email: 'sunita@greenvalleyrealty.in', phone: '', plan: 'retainer', fee: 45000, teamIds: ['social', 'shoot', 'edit', 'web'], managerId: 'neha', since: day(-150), notes: 'Plotted colonies and villas. Leads come from Meta lead forms — share the lead sheet every Monday.' },
    { id: 'steel', name: 'Haryana Steel Works', industry: 'Manufacturing', city: 'Panipat', contact: 'Vikram Jindal', email: 'vikram@haryanasteel.in', phone: '', plan: 'project', fee: 120000, teamIds: ['web', 'shoot', 'social'], managerId: 'aman', since: day(-40), notes: 'Steel fabrication for export buyers. Website must lead with the machines and have a WhatsApp enquiry button.' },
    { id: 'glow', name: 'Glow Herbals', industry: 'D2C skincare', city: 'New Delhi', contact: 'Ishita Kapoor', email: 'ishita@glowherbals.in', phone: '', plan: 'retainer', fee: 38000, teamIds: ['ecom', 'design', 'social'], managerId: 'neha', since: day(-30), notes: 'Launching on Amazon and Flipkart first, Meesho later. Strict about ingredient claims — check every listing line.' },
    { id: 'shreeram', name: 'Shree Ram Furniture', industry: 'Local retail', city: 'Gohana', contact: 'Mahesh Garg', email: 'contact@shreeramfurniture.in', phone: '', plan: 'project', fee: 35000, teamIds: ['web', 'social'], managerId: 'aman', since: day(-75), notes: 'Showroom on the main market road. No client login yet — invite them from here.' },
  ]

  const projects = [
    { id: 'p-diwali', name: 'Diwali Festive Campaign', clientId: 'desi', teamIds: ['social', 'shoot', 'edit', 'design', 'ecom'], status: 'active', priority: 'high', start: day(-10), due: day(12), managerId: 'neha', memberIds: ['priya', 'simran', 'karan', 'vikas', 'sahil', 'ankit', 'muskan', 'deepak', 'ritika', 'pooja'], budget: 140000, brief: 'Three festive Reels, a gift-box launch and ₹40,000 of Meta ads across Sonipat, Panipat and Delhi. Tone: warm, family, “ghar ki mithaas”. Everything live 10 days before Diwali; gift box listed on Amazon with A+ content.' },
    { id: 'p-gv-month', name: `Social Media Retainer — ${month}`, clientId: 'greenvalley', teamIds: ['social', 'edit', 'design'], status: 'active', priority: 'normal', start: day(-12), due: day(18), managerId: 'neha', memberIds: ['priya', 'simran', 'karan', 'muskan', 'mohit'], budget: 45000, brief: '12 posts + 4 Reels this month, daily comment & DM replies within 2 hours, lead-form ads with a weekly lead sheet to Sunita every Monday.' },
    { id: 'p-steel-web', name: 'Corporate Website Revamp', clientId: 'steel', teamIds: ['web', 'shoot', 'social'], status: 'active', priority: 'high', start: day(-20), due: day(24), managerId: 'aman', memberIds: ['arjun', 'tanya', 'sahil', 'vikas', 'simran'], budget: 120000, brief: 'Export-ready website: machines and capacity first, 8 product categories, catalogue PDF, WhatsApp enquiry button, fast on mobile. Factory shoot for all photos and a 60-second plant video.' },
    { id: 'p-glow-mkt', name: 'Amazon & Flipkart Store Launch', clientId: 'glow', teamIds: ['ecom', 'design'], status: 'active', priority: 'urgent', start: day(-15), due: day(9), managerId: 'neha', memberIds: ['gaurav', 'pooja', 'mohit', 'ritika'], budget: 52000, brief: '14 SKUs live on Amazon and Flipkart with Brand Registry, keyword-rich listings, white-background images + 4 infographics each, and launch-week Sponsored Products.' },
    { id: 'p-desi-pack', name: 'Masala Range Pouch Packaging', clientId: 'desi', teamIds: ['design'], status: 'review', priority: 'normal', start: day(-25), due: day(3), managerId: 'neha', memberIds: ['ritika', 'mohit'], budget: 32000, brief: 'Stand-up pouches for 4 masala SKUs (100 g / 200 g). Shelf impact from 2 metres, FSSAI and veg mark, print-ready dielines for the Sonipat printer.' },
    { id: 'p-gv-reels', name: 'Sector 7 Plot Launch Reels', clientId: 'greenvalley', teamIds: ['shoot', 'edit', 'social'], status: 'planning', priority: 'normal', start: day(4), due: day(20), managerId: 'neha', memberIds: ['vikas', 'sahil', 'ankit', 'muskan', 'karan'], budget: 60000, brief: '4 launch Reels for the new Sector 7 plots: drone opener, road & park walkthrough, family testimonial, price reveal. Runs as ads after the launch event.' },
    { id: 'p-sr-web', name: 'Showroom Website', clientId: 'shreeram', teamIds: ['web'], status: 'done', priority: 'normal', start: day(-60), due: day(-18), managerId: 'aman', memberIds: ['arjun', 'tanya'], budget: 35000, brief: '5-page site with the full catalogue, Google Maps, WhatsApp button and Google Business Profile link.' },
  ].map((p) => ({ ...p, createdAt: p.start < T ? p.start : T }))

  // hours logged on the last five working days, so timesheets and reports have something real to show
  const hash = (s) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0)
  const workdays = []
  for (let i = 1; workdays.length < 5; i++) if (![0, 6].includes(weekday(day(-i)))) workdays.push(day(-i))
  let k = 0
  const task = (projectId, teamId, assigneeId, status, priority, due, title, extra = {}) => {
    const id = `t${++k}`
    const time =
      assigneeId && status !== 'todo'
        ? workdays.filter((_, i) => (hash(id) + i) % 4 !== 0).map((d, i) => ({ id: `${id}h${i}`, userId: assigneeId, hours: ((hash(id) + i) % 3) + 1.5, date: d, note: '' }))
        : []
    return {
      id,
      projectId,
      teamId,
      assigneeId,
      status,
      priority,
      due: day(due),
      title,
      desc: '',
      estimate: 0,
      checklist: [],
      comments: [],
      time,
      createdBy: projects.find((p) => p.id === projectId).managerId,
      createdAt: ago(12 * D),
      completedAt: status === 'done' ? day(Math.min(due, -1)) : null,
      ...extra,
      ...(extra.checklist && { checklist: extra.checklist.map(([text, done], i) => ({ id: `${id}c${i}`, text, done })) }),
    }
  }
  const c = (userId, minsAgo, text, more = {}) => ({ id: `${userId}${minsAgo}`, userId, text, at: ago(minsAgo), ...more })

  const tasks = [
    task('p-diwali', 'social', 'priya', 'done', 'high', -6, 'Festive content calendar — 12 posts', { checklist: [['Theme & hooks', true], ['12 post slots with formats', true], ['Client sign-off', true]] }),
    task('p-diwali', 'social', 'simran', 'done', 'normal', -4, 'Scripts for 3 Diwali Reels', { desc: 'Hinglish, 30 seconds each, hook in the first 2 seconds. Reel 1: grandma reveal. Reel 2: office Diwali. Reel 3: gift box unboxing.' }),
    task('p-diwali', 'shoot', 'vikas', 'doing', 'high', 2, 'Shoot day: family Reels + product macros at the Sonipat unit', {
      desc: 'Full day at the Desi Crunch unit. Packing area free 10–1 (confirmed by Rahul). Talent: Rahul’s family + 2 staff.',
      checklist: [['Shot list', true], ['Book lights & gimbal', true], ['Props: diyas, gift boxes, rangoli', false], ['Talent release forms', false]],
      comments: [c('priya', 20 * H, 'Hook for Reel 1 is the grandma reveal — get at least 3 takes of it.'), c('vikas', 19 * H, 'Noted. Will also grab slow-mo of the bhujia pour for the end cards @Deepak.')],
    }),
    task('p-diwali', 'edit', 'muskan', 'todo', 'high', 5, 'Edit Reel 1 — Ghar ki Mithaas (30s)', { desc: 'Footage lands after the shoot. Hook in the first 2 seconds, Hinglish captions, brand end card from Deepak.', estimate: 6 }),
    task('p-diwali', 'edit', 'deepak', 'doing', 'normal', 4, 'Motion graphics: offer end cards (3 variants)', { estimate: 5 }),
    task('p-diwali', 'design', 'ritika', 'review', 'high', 1, 'Festive gift box — front, back and dieline', { checklist: [['Front & back artwork', true], ['Dieline from printer', true], ['Mockup for Amazon', false]] }),
    task('p-diwali', 'social', 'karan', 'todo', 'high', 6, 'Diwali Meta ads — ₹40,000 across 3 ad sets', { checklist: [['Audiences: Sonipat, Panipat, Delhi · 25–45', true], ['Creatives from editing', false], ['Pixel & lead form check', false]] }),
    task('p-diwali', 'ecom', 'pooja', 'todo', 'normal', 8, 'Amazon A+ content for the gift box listing'),
    task('p-diwali', 'edit', null, 'todo', 'normal', 7, 'Edit Reel 2 — Office wala Diwali', {
      createdBy: 'simran',
      comments: [c('simran', 6 * H, 'Script is final (in the project brief). Footage comes from the Sonipat shoot.', { handoff: 'Social Media → Video Editing' })],
    }),
    task('p-gv-month', 'social', 'priya', 'done', 'normal', -8, 'Monthly content calendar approved by client'),
    task('p-gv-month', 'design', 'mohit', 'doing', 'normal', 1, 'Carousel: 5 reasons to buy in Sector 7'),
    task('p-gv-month', 'social', 'simran', 'doing', 'normal', 0, 'Reply to comments & DMs (within 2 hours)', { desc: 'Daily. Hot leads go to Sunita on WhatsApp the same hour.' }),
    task('p-gv-month', 'edit', 'muskan', 'review', 'high', 0, 'Edit walkthrough Reel — Villa 12'),
    task('p-gv-month', 'social', 'karan', 'doing', 'high', 3, 'Lead form ads — refresh creatives'),
    task('p-gv-month', 'social', 'karan', 'todo', 'normal', -2, 'Send last week’s lead sheet to Sunita'),
    task('p-steel-web', 'web', 'arjun', 'done', 'high', -12, 'Sitemap & wireframes'),
    task('p-steel-web', 'web', 'tanya', 'doing', 'high', 2, 'Homepage design v2 — machines first, WhatsApp button', { comments: [c('arjun', 2 * D, 'Client wants the CNC machines above the fold. Keep the hero video slot for the plant film.')] }),
    task('p-steel-web', 'shoot', 'sahil', 'todo', 'high', 6, 'Factory shoot — machines, welding, team portraits', { checklist: [['Shot list from Arjun', true], ['Safety gear for crew', false], ['Drone permission', false]] }),
    task('p-steel-web', 'web', 'tanya', 'todo', 'normal', 14, 'Build product catalogue pages (8 categories)', { estimate: 16 }),
    task('p-steel-web', 'social', 'simran', 'doing', 'normal', 3, 'Write copy: About, Capabilities, Export'),
    task('p-steel-web', 'web', 'arjun', 'todo', 'normal', 20, 'SEO, Search Console and speed check before launch'),
    task('p-glow-mkt', 'ecom', 'gaurav', 'done', 'high', -9, 'Brand Registry & seller accounts (Amazon, Flipkart)'),
    task('p-glow-mkt', 'ecom', 'pooja', 'doing', 'urgent', -1, 'List 14 SKUs with keywords & bullet points', { checklist: [['Keyword research', true], ['Titles & bullets (14/14)', true], ['Backend search terms', false], ['Ishita’s claims check', false]] }),
    task('p-glow-mkt', 'design', 'mohit', 'doing', 'high', 2, 'Listing images — white background + 4 infographics per SKU'),
    task('p-glow-mkt', 'ecom', 'gaurav', 'todo', 'normal', 7, 'Sponsored Products campaigns for launch week'),
    task('p-desi-pack', 'design', 'ritika', 'done', 'high', -8, 'Dielines for 4 masala pouch SKUs'),
    task('p-desi-pack', 'design', 'mohit', 'done', 'normal', -4, '3D mockups for client review'),
    task('p-desi-pack', 'design', 'ritika', 'todo', 'normal', 4, 'Print-ready files & printer handover (after approval)'),
    task('p-gv-reels', 'shoot', 'vikas', 'todo', 'normal', 3, 'Location recce & shot list — Sector 7'),
    task('p-gv-reels', 'shoot', 'sahil', 'todo', 'low', 3, 'Check drone permission (green zone?)'),
    task('p-gv-reels', 'edit', 'ankit', 'todo', 'normal', 18, 'Plan edit style & music for 4 launch Reels'),
    task('p-sr-web', 'web', 'tanya', 'done', 'normal', -20, 'Build 5-page showroom site'),
    task('p-sr-web', 'web', 'arjun', 'done', 'normal', -18, 'Launch, Google Business Profile link, handover'),
  ]

  const deliverables = [
    { id: 'd1', projectId: 'p-desi-pack', title: 'Masala pouch designs — 4 SKUs', type: 'Design', link: 'https://drive.google.com/drive/folders/masala-pouch-v2', version: 2, status: 'client', sent: true, submittedBy: 'ritika', history: [
      { userId: 'ritika', at: ago(9 * D), action: 'submitted v1 for review', note: '' },
      { userId: 'neha', at: ago(8 * D), action: 'sent v1 to the client', note: '' },
      { userId: 'rahul', at: ago(6 * D), action: 'requested changes', note: 'Make the chilli red brighter and the brand name bigger on the front.' },
      { userId: 'ritika', at: ago(3 * D), action: 'uploaded v2', note: 'Brighter red, logo 20% bigger, added the veg mark.' },
      { userId: 'ritika', at: ago(2 * D), action: 'sent v2 to the client', note: '' },
    ] },
    { id: 'd2', projectId: 'p-gv-month', title: 'Villa 12 walkthrough Reel', type: 'Video', link: 'https://drive.google.com/file/d/villa12-reel-v1', version: 1, status: 'internal', sent: false, submittedBy: 'muskan', history: [{ userId: 'muskan', at: ago(3 * H), action: 'submitted v1 for review', note: 'Trending audio, Hinglish captions, price on the last frame.' }] },
    { id: 'd3', projectId: 'p-steel-web', title: 'Homepage design', type: 'Website', link: 'https://www.figma.com/file/steel-homepage', version: 1, status: 'changes', sent: true, submittedBy: 'tanya', history: [
      { userId: 'tanya', at: ago(5 * D), action: 'submitted v1 for review', note: '' },
      { userId: 'arjun', at: ago(4 * D), action: 'sent v1 to the client', note: '' },
      { userId: 'vikram', at: ago(2 * D), action: 'requested changes', note: 'Show the CNC machines higher up. Add a WhatsApp button for export enquiries.' },
    ] },
    { id: 'd4', projectId: 'p-diwali', title: 'Festive content calendar', type: 'Copy', link: 'https://docs.google.com/spreadsheets/d/diwali-calendar', version: 1, status: 'approved', sent: true, submittedBy: 'priya', history: [
      { userId: 'priya', at: ago(8 * D), action: 'submitted v1 for review', note: '' },
      { userId: 'priya', at: ago(8 * D), action: 'sent v1 to the client', note: '' },
      { userId: 'rahul', at: ago(7 * D), action: 'approved v1', note: 'Love the grandma idea.' },
    ] },
    { id: 'd5', projectId: 'p-diwali', title: 'Festive gift box design', type: 'Design', link: 'https://www.figma.com/file/desi-gift-box', version: 1, status: 'internal', sent: false, submittedBy: 'ritika', history: [{ userId: 'ritika', at: ago(5 * H), action: 'submitted v1 for review', note: 'Front, back and dieline in one file.' }] },
    { id: 'd6', projectId: 'p-sr-web', title: 'Showroom website — live site & handover', type: 'Website', link: 'https://drive.google.com/file/d/showroom-handover', version: 1, status: 'approved', sent: true, submittedBy: 'arjun', history: [
      { userId: 'arjun', at: ago(19 * D), action: 'submitted v1 for review', note: '' },
      { userId: 'aman', at: ago(19 * D), action: 'sent v1 to the client', note: '' },
      { userId: 'aman', at: ago(18 * D), action: 'approved v1 on the client’s behalf', note: 'Approved by Mahesh ji on a call.' },
    ] },
  ]

  const leads = ['priya', 'vikas', 'ankit', 'ritika', 'arjun', 'gaurav']
  const lastFriday = addDays(T, -((weekday(T) + 2) % 7))
  const ev = (id, title, type, date, start, end, attendeeIds, extra = {}) => ({ id, title, type, date, start, end, attendeeIds, repeat: 'none', location: '', agenda: '', projectId: '', createdBy: 'neha', rsvp: {}, ...extra })
  const yes = (...ids) => Object.fromEntries(ids.map((id) => [id, 'yes']))
  const events = [
    ev('e1', 'Daily stand-up', 'meeting', addDays(startOfWeek(T), -14), '10:00', '10:15', staffIds, { repeat: 'weekdays', createdBy: 'aman', location: 'Studio, Gohana', agenda: 'Yesterday, today, blockers. 15 minutes, standing.' }),
    ev('e2', 'Weekly leads sync', 'meeting', lastFriday, '17:00', '17:45', ['aman', 'neha', ...leads], { repeat: 'weekly', createdBy: 'aman', location: 'Studio, Gohana', agenda: 'Workload per team, next week’s deadlines, anything stuck between teams.' }),
    ev('e3', 'Desi Crunch — Diwali campaign check-in', 'client', day(0), '15:00', '15:45', ['neha', 'priya', 'ankit', 'rahul'], { projectId: 'p-diwali', location: 'https://meet.google.com/', agenda: '1. Gift box design\n2. Shoot day plan\n3. Ad budget split', rsvp: yes('neha', 'priya', 'rahul') }),
    ev('e4', 'Homepage feedback call', 'client', day(1), '12:00', '12:30', ['aman', 'arjun', 'tanya', 'vikram'], { projectId: 'p-steel-web', createdBy: 'arjun', location: 'https://meet.google.com/', agenda: 'Walk through homepage v2 with the machines-first layout.', rsvp: yes('arjun', 'vikram') }),
    ev('e5', 'Shoot day — Desi Crunch, Sonipat unit', 'shoot', day(2), '09:00', '17:00', ['vikas', 'sahil', 'simran'], { projectId: 'p-diwali', createdBy: 'vikas', location: 'Desi Crunch unit, Sonipat', agenda: 'Leave studio 7:30 am. Packing area 10–1. Family Reels after lunch.', rsvp: yes('vikas', 'sahil') }),
    ev('e6', 'Creative review — this week’s posts', 'review', day(3), '11:30', '12:30', ['priya', 'ritika', 'mohit', 'muskan', 'ankit'], { createdBy: 'priya', location: 'Studio, Gohana', agenda: 'Every post going out next week, on the big screen.' }),
    ev('e7', 'Location recce — Sector 7', 'shoot', day(3), '15:00', '17:00', ['vikas', 'sahil', 'sunita'], { projectId: 'p-gv-reels', createdBy: 'vikas', location: 'Green Valley Sector 7 site office' }),
    ev('e8', 'Factory shoot — Haryana Steel Works', 'shoot', day(6), '10:00', '16:00', ['sahil', 'vikas', 'arjun'], { projectId: 'p-steel-web', createdBy: 'arjun', location: 'Haryana Steel Works, Panipat' }),
    ev('e9', 'Monthly all-hands', 'meeting', day(8), '17:30', '18:30', staffIds, { createdBy: 'aman', location: 'Studio, Gohana', agenda: 'Numbers, wins, client feedback, what we fix next month.' }),
    ev('e10', 'Glow Herbals — marketplace launch plan', 'client', day(-2), '16:00', '16:45', ['neha', 'gaurav', 'ishita'], { projectId: 'p-glow-mkt', location: 'https://meet.google.com/', rsvp: yes('neha', 'gaurav', 'ishita') }),
  ]

  const leaves = [
    { id: 'l1', userId: 'muskan', from: day(9), to: day(10), type: 'casual', reason: 'Family function in Jind.', status: 'approved', decidedBy: 'ankit', at: ago(3 * D) },
    { id: 'l2', userId: 'sahil', from: day(14), to: day(16), type: 'earned', reason: 'Brother’s wedding.', status: 'pending', at: ago(1 * D) },
    { id: 'l3', userId: 'karan', from: day(-3), to: day(-3), type: 'sick', reason: 'Fever.', status: 'approved', decidedBy: 'priya', at: ago(3 * D) },
    { id: 'l4', userId: 'mohit', from: day(0), to: day(0), type: 'wfh', reason: 'Internet technician at home in the morning.', status: 'approved', decidedBy: 'ritika', at: ago(1 * D) },
    { id: 'l5', userId: 'pooja', from: day(5), to: day(5), type: 'casual', reason: 'Exam at college.', status: 'pending', at: ago(5 * H) },
  ]

  const channels = [
    { id: 'ch-general', type: 'public', name: 'general' },
    { id: 'ch-announce', type: 'public', name: 'announcements', readOnly: true },
    ...teams.map((t) => ({ id: `ch-${t.id}`, type: 'team', teamId: t.id })),
    ...projects.map((p) => ({ id: `ch-${p.id}`, type: 'project', projectId: p.id, clientVisible: true })),
    { id: 'dm-neha-priya', type: 'dm', memberIds: ['neha', 'priya'] },
  ]
  let m = 0
  const msg = (channelId, userId, minsAgo, text) => ({ id: `m${++m}`, channelId, userId, at: ago(minsAgo), text })
  const messages = [
    msg('ch-announce', 'aman', 3 * D, 'From today every piece of work goes through YG Hub: submit the link on the project, your lead signs it off, the client approves it right here. No more final_final_v3 on WhatsApp.'),
    msg('ch-announce', 'neha', 1 * D, 'Client calls are on the calendar with the Meet link inside. Please accept or decline so we know who is joining.'),
    msg('ch-general', 'priya', 3 * H, 'Anyone free to help Simran with comment replies after 4? The Green Valley ad is getting a lot of DMs.'),
    msg('ch-general', 'tanya', 2.8 * H, 'I can take 30 minutes at 4:30.'),
    msg('ch-general', 'vikas', 1 * H, '@Sahil lights and gimbal batteries charged for the Sonipat shoot? We leave at 7:30 am.'),
    msg('ch-general', 'sahil', 50, 'Charged and packed. Carrying the big reflector too.'),
    msg('ch-edit', 'ankit', 5 * H, 'Muskan — Villa 12 is yours to finish today. Deepak on the Diwali end cards. Reel 2 is in our queue, I will assign it after the shoot.'),
    msg('ch-edit', 'muskan', 3 * H, 'Villa 12 v1 is submitted on the project for review.'),
    msg('ch-social', 'priya', 4 * H, 'Karan, the lead sheet for Sunita is overdue — please send it before lunch.'),
    msg('ch-p-diwali', 'neha', 1 * D, `Hi Rahul ji, shoot day is ${addDays(T, 2)}. We need the packing area free from 10 to 1, and the family Reels after lunch.`),
    msg('ch-p-diwali', 'rahul', 20 * H, 'Done. Please show the new gift box in at least one Reel.'),
    msg('ch-p-diwali', 'priya', 18 * H, 'Noted — Reel 2 opens on the gift box.'),
    msg('ch-p-steel-web', 'vikram', 2 * D, 'Changes are on the homepage design. Main thing: export buyers must see the machines first.'),
    msg('ch-p-steel-web', 'arjun', 2 * D - 30, 'Got it, Vikram ji. Tanya is on it — v2 on the call tomorrow.'),
    msg('ch-p-desi-pack', 'ritika', 2 * D, 'v2 is up — brighter red and a bigger logo. Please approve it in the Deliverables tab so we can send files to the printer.'),
    msg('ch-p-glow-mkt', 'gaurav', 6 * H, 'Ishita, 14 of 14 listings are written. Pooja is adding backend keywords today; could you check the ingredient claims by tomorrow?'),
    msg('dm-neha-priya', 'neha', 4 * H, 'Can you join the Desi Crunch call at 3? Rahul wants to talk about the ad budget.'),
    msg('dm-neha-priya', 'priya', 3.9 * H, 'Yes, I will bring the ad set plan.'),
  ]
  // everyone has read everything older than six hours
  const seen = ago(6 * H)
  const reads = Object.fromEntries(users.map((u) => [u.id, Object.fromEntries(channels.map((ch) => [ch.id, seen]))]))

  const post = (id, clientId, date, platform, format, title, status, assigneeId, caption = '') => ({ id, clientId, date, time: '19:00', platform, format, title, status, assigneeId, caption, notes: [] })
  const posts = [
    post('s1', 'desi', day(-6), 'Instagram', 'Reel', 'Behind the scenes: how our bhujia is made', 'posted', 'muskan'),
    post('s2', 'desi', day(-3), 'Instagram', 'Post', 'Festive offer teaser', 'posted', 'mohit'),
    post('s3', 'desi', day(1), 'Instagram', 'Carousel', 'Gift box: what’s inside', 'ready', 'mohit', 'Ek dabba, saat swaad. Swipe to see what’s inside this year’s Desi Crunch Diwali box →'),
    post('s4', 'desi', day(4), 'Instagram', 'Reel', 'Ghar ki Mithaas', 'production', 'muskan'),
    post('s5', 'desi', day(7), 'Instagram', 'Reel', 'Office wala Diwali', 'idea', 'simran'),
    post('s6', 'desi', day(9), 'Instagram', 'Story', 'Countdown: 3 days to the Diwali sale', 'scheduled', 'simran'),
    post('s7', 'greenvalley', day(-2), 'Instagram', 'Carousel', 'Sector 7: location advantages', 'posted', 'mohit'),
    post('s8', 'greenvalley', day(1), 'Instagram', 'Reel', 'Villa 12 walkthrough', 'production', 'muskan'),
    post('s9', 'greenvalley', day(2), 'Facebook', 'Ad', 'Lead form — plots in Sector 7', 'ready', 'karan', 'Plots in Green Valley Sector 7, Gohana. 30-ft roads, park-facing options. Tap to get the price list on WhatsApp.'),
    post('s10', 'greenvalley', day(5), 'Instagram', 'Post', 'Handover day: the Sharma family', 'idea', 'simran'),
    post('s11', 'glow', day(4), 'Instagram', 'Reel', 'Now on Amazon: 3 hero products', 'idea', 'simran'),
    post('s12', 'glow', day(8), 'Instagram', 'Carousel', 'Ingredients we never use', 'production', 'mohit'),
  ]

  const fy = (() => {
    const t = new Date()
    const y = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1
    return `${String(y).slice(2)}-${String(y + 1).slice(2)}`
  })()
  const inv = (id, num, clientId, date, due, items, status, extra = {}) => ({ id, no: `YG/${fy}/${num}`, clientId, date: day(date), due: day(due), items, gst: 18, status, notes: 'Payment by bank transfer or UPI within the due date. Thank you!', ...extra })
  const invoices = [
    inv('i1', '038', 'greenvalley', -35, -20, [{ desc: 'Social media retainer — last month', qty: 1, rate: 45000 }], 'paid', { paidOn: day(-22) }),
    inv('i2', '039', 'desi', -33, -26, [{ desc: 'Retainer — social, editing, e-commerce (last month)', qty: 1, rate: 65000 }], 'paid', { paidOn: day(-27) }),
    inv('i3', '040', 'steel', -20, -13, [{ desc: 'Corporate website — 50% advance', qty: 1, rate: 60000 }], 'paid', { paidOn: day(-15) }),
    inv('i4', '041', 'desi', -2, 5, [{ desc: 'Retainer — social, editing, e-commerce (this month)', qty: 1, rate: 65000 }, { desc: 'Diwali shoot day (crew of 3, lights, travel)', qty: 1, rate: 18000 }, { desc: 'Extra Reel edits — festive set', qty: 3, rate: 3500 }], 'sent'),
    inv('i5', '042', 'glow', -18, -3, [{ desc: 'Marketplace management retainer', qty: 1, rate: 38000 }, { desc: 'Listing images (per SKU)', qty: 14, rate: 600 }], 'sent'),
    inv('i6', '043', 'shreeram', 0, 10, [{ desc: 'Showroom website — final 50%', qty: 1, rate: 17500 }, { desc: 'Domain + hosting, 1 year', qty: 1, rate: 4500 }], 'draft'),
  ]

  let a = 0
  const act = (userId, minsAgo, text, link) => ({ id: `a${++a}`, userId, at: ago(minsAgo), text, link })
  const activity = [
    act('muskan', 3 * H, 'submitted “Villa 12 walkthrough Reel” v1 for review', '#/projects/p-gv-month/deliverables'),
    act('ritika', 5 * H, 'submitted “Festive gift box design” v1 for review', '#/projects/p-diwali/deliverables'),
    act('simran', 6 * H, 'handed “Edit Reel 2 — Office wala Diwali” from Social Media to Video Editing', '#/tasks/t9'),
    act('pooja', 5 * H, 'requested casual leave', '#/people/leave'),
    act('ritika', 1 * D, 'moved “Festive gift box — front, back and dieline” to Review', '#/tasks/t6'),
    act('sahil', 1 * D, 'requested earned leave', '#/people/leave'),
    act('vikram', 2 * D, 'requested changes on “Homepage design”', '#/projects/p-steel-web/deliverables'),
    act('ritika', 2 * D, 'sent “Masala pouch designs — 4 SKUs” v2 to Desi Crunch Snacks', '#/projects/p-desi-pack/deliverables'),
    act('neha', 2 * D, 'scheduled “Desi Crunch — Diwali campaign check-in”', '#/calendar'),
    act('gaurav', 9 * D, 'moved “Brand Registry & seller accounts (Amazon, Flipkart)” to Done', '#/tasks/t22'),
  ].sort((x, y) => y.at.localeCompare(x.at))

  let q = 0
  const note = (userId, fromId, minsAgo, text, link, read = false) => ({ id: `n${++q}`, userId, fromId, at: ago(minsAgo), text, link, read })
  const notifications = [
    note('neha', 'muskan', 3 * H, 'submitted “Villa 12 walkthrough Reel” v1 for review', '#/projects/p-gv-month/deliverables'),
    note('neha', 'ritika', 5 * H, 'submitted “Festive gift box design” v1 for review', '#/projects/p-diwali/deliverables'),
    note('neha', 'pooja', 5 * H, 'requested casual leave', '#/people/leave'),
    note('priya', 'muskan', 3 * H, 'submitted “Villa 12 walkthrough Reel” v1 for review', '#/projects/p-gv-month/deliverables'),
    note('priya', 'neha', 4 * H, 'messaged you: Can you join the Desi Crunch call at 3?', '#/chat/dm-neha-priya', true),
    note('ankit', 'simran', 6 * H, 'handed “Edit Reel 2 — Office wala Diwali” to Video Editing — needs an owner', '#/tasks/t9'),
    note('ankit', 'muskan', 3 * H, 'submitted “Villa 12 walkthrough Reel” v1 for review', '#/projects/p-gv-month/deliverables'),
    note('gaurav', 'pooja', 5 * H, 'requested casual leave', '#/people/leave'),
    note('vikas', 'sahil', 1 * D, 'requested earned leave', '#/people/leave'),
    note('aman', 'sahil', 1 * D, 'requested earned leave', '#/people/leave'),
    note('aman', 'vikram', 2 * D, 'requested changes on “Homepage design”', '#/projects/p-steel-web/deliverables', true),
    note('rahul', 'ritika', 2 * D, 'sent “Masala pouch designs — 4 SKUs” v2 for your approval', '#/projects/p-desi-pack/deliverables'),
    note('rahul', 'mohit', 1 * D, 'has a Carousel ready for your approval: “Gift box: what’s inside”', '#/content'),
    note('rahul', 'rohit', 2 * D, 'sent invoice YG/' + fy + '/041, due in a week', '#/invoices/i4'),
    note('sunita', 'karan', 10 * H, 'has an Ad ready for your approval: “Lead form — plots in Sector 7”', '#/content'),
    note('vikram', 'arjun', 1 * D, 'invited you to “Homepage feedback call”', '#/calendar'),
    note('muskan', 'ankit', 5 * H, 'assigned you “Edit walkthrough Reel — Villa 12”', '#/tasks/t13', true),
    note('karan', 'priya', 4 * H, 'mentioned you in #Social Media: the lead sheet for Sunita is overdue', '#/chat/ch-social'),
  ]

  return { version: 1, org, teams, users, clients, projects, tasks, deliverables, events, leaves, channels, messages, reads, posts, invoices, activity, notifications }
}
