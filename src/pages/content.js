/*
 * Copy for the service pages (/services/<slug>). Loaded only with those pages, never on the home page.
 * *starred* words in `belief` are highlighted in brand red.
 *
 * PLACEHOLDER PROJECTS — every `projects` entry below is a stand-in until the client sends real work. For each real one
 * add `url` (the live page, store or post; the card links to it) and optionally `image` (a screenshot in /public).
 */

// the same on every page
export const WHY = [
  { t: 'Local, in person', d: 'Based in Gohana — meet the people doing your work.' },
  { t: 'One in-house team', d: 'Design, ads, video and web in one room. No freelancers.' },
  { t: 'Checked twice', d: 'A second pair of eyes on everything before it goes live.' },
  { t: 'Your money, our care', d: 'Daily checks, fast WhatsApp replies, honest reports.' },
]

export const CONTENT = {
  ads: {
    lede: 'Your Instagram and Facebook, run end to end — planned content, posts and Reels made in-house, daily replies and Meta ads that bring enquiries.',
    belief: 'Posting is easy. *Building a page people trust* — where every post has a job — is the work we love.',
    projects: [
      { title: 'Festive Sale Blitz', client: 'Apparel label', year: '2025', did: ['12 Reels + ad creatives', 'Retargeting'] },
      { title: 'Site-Visit Machine', client: 'Housing project', year: '2024', did: ['Lead-gen campaign', 'Weekly lead reports'] },
    ],
    steps: [
      { t: 'Know the business', d: 'Your buyers, best-sellers and what a lead is worth — before any content.', p: ['Goals set: enquiries, sales, real followers', 'Competitors and their ads studied'] },
      { t: 'Plan the month', d: 'A content calendar agreed a month ahead, with the ads planned alongside it.', p: ['Posts, Reels and Stories scheduled', 'Ad budget split by stage'] },
      { t: 'Made to stop thumbs', d: 'Hook-first posts and ads, made for phones with the sound off.', p: ['Several hooks tested per idea', 'Sized for Feed, Stories and Reels'] },
      { t: 'Show up, track, report', d: 'Daily replies, daily ad checks and a report you can read in two minutes.', p: ['Comments and DMs answered the same day', 'Pixel and Conversions API tested'] },
    ],
    details: ['The hook is written before the design', 'Every post previewed on a real phone', 'Ad frequency watched, never overdone', 'Copy in English, Hindi or Hinglish'],
    deliver: ['Monthly content calendar', 'Posts, Reels and Stories', 'Captions, hashtags and covers', 'Comment and DM handling', 'Meta ads, managed daily', 'Monthly report and review call'],
    faq: [
      { q: 'How many posts a month?', a: 'We agree a monthly plan of posts, Reels and Stories on the first call — and stick to it.' },
      { q: 'Do you make the content too?', a: 'Yes. Scripts, design, Reels and copy are all made in-house.' },
      { q: 'Will I own my pages and ad account?', a: 'Always. Everything stays in your name; we work as partners inside it.' },
    ],
  },

  ecom: {
    lede: 'Your Amazon, Flipkart and Meesho stores, run end to end — listings that rank, images that convert and ads that pay their way.',
    belief: 'On a marketplace, *your listing is your salesman*. We make it the best-dressed one on the page.',
    projects: [
      { title: 'Marketplace Launch', client: 'Home-décor seller', year: '2025', did: ['Amazon & Flipkart setup', 'Sponsored ads'] },
      { title: 'Catalogue Glow-Up', client: 'Ethnic-wear seller', year: '2024', did: ['Meesho catalogue refresh', 'Listing images'] },
    ],
    steps: [
      { t: 'Audit store and category', d: 'Who ranks, what they charge and what buyers complain about.', p: ['Competitor listings benchmarked', 'Account health and returns checked'] },
      { t: 'Keywords, then copy', d: 'Titles and bullets built from what buyers actually type.', p: ['Keyword research per marketplace', 'Backend search terms filled in'] },
      { t: 'Images that sell', d: 'Every image answers a question before the buyer asks it.', p: ['Infographics for size, material and use', 'A+ content wherever allowed'] },
      { t: 'Ads and daily care', d: 'Tight ads, weekly cuts and daily price, stock and review checks.', p: ['Wasted search terms cut weekly', 'Monthly sales and ACoS report'] },
    ],
    details: ['Every title character earns its place', 'Image text readable on a phone', 'Weights and HSN codes filled correctly', 'Sale seasons planned in advance'],
    deliver: ['Store setup or takeover', 'Keyword-researched listings', 'Listing images and A+ content', 'Sponsored ads, optimised weekly', 'Price, stock and health checks', 'Monthly sales and ads report'],
    faq: [
      { q: 'Can you take over my existing store?', a: 'Yes. We audit listings, ads and account health, fix the leaks, then grow.' },
      { q: 'Which marketplaces do you handle?', a: 'Amazon, Flipkart and Meesho — one or all three, from the same catalogue.' },
      { q: 'How will I know what’s happening?', a: 'One monthly report across every marketplace, plus a review call.' },
    ],
  },

  pack: {
    lede: 'Boxes, labels and pouches that win the shelf and the thumbnail — premium on the outside, print-ready on the inside.',
    belief: 'Packaging is the *only ad your customer holds*. We design it to be picked up and remembered.',
    projects: [
      { title: 'Masala Box Series', client: 'Spice brand', year: '2025', did: ['6-SKU packaging system', 'Print-ready dielines'] },
      { title: 'Pickle Jar Labels', client: 'Home-food brand', year: '2024', did: ['Label range', '3D mockups'] },
    ],
    steps: [
      { t: 'Study shelf and screen', d: 'Where your product is seen decides what must read in three seconds.', p: ['Competitor packs compared side by side', 'Buyer and price point defined first'] },
      { t: 'Structure first', d: 'The right box, pouch or material decides cost, protection and feel.', p: ['Dieline built on real dimensions', 'Finishes matched to your budget'] },
      { t: 'Design the family', d: 'One look, with every variant easy to tell apart.', p: ['Colour coding across the range', 'Space for legal text from day one'] },
      { t: 'Print-ready, seen in 3D', d: 'Files presses accept first time, and photo-real renders before printing.', p: ['CMYK, bleed and barcodes checked', '3D mockups for listings and ads'] },
    ],
    details: ['Barcodes contrast-checked before print', 'No text too small to read', 'Colours judged in CMYK, not on screen', 'Every pack tested at thumbnail size'],
    deliver: ['Concept and design directions', 'Boxes, labels, pouches and sleeves', 'Dielines and print-ready files', 'A system for all your variants', 'Photo-real 3D mockups', 'Support with your printer'],
    faq: [
      { q: 'Can you work with my printer?', a: 'Yes. We prepare files to their specs and can talk to them directly.' },
      { q: 'What do you need to start?', a: 'The product or its exact size, any current packaging, and the text it must carry.' },
      { q: 'Will regular customers still recognise it?', a: 'Yes. We keep what people know — colour, logo, shape — and upgrade the rest.' },
    ],
  },

  web: {
    lede: 'Fast, mobile-first websites and landing pages that look expensive and turn visitors into calls — designed and built in-house.',
    belief: 'A website isn’t a brochure. It’s *your best salesperson, working 24 hours*.',
    projects: [
      { title: 'Builder Showcase', client: 'Real-estate developer', year: '2024', did: ['Project website', 'Lead-capture pages'] },
      { title: 'Factory Catalogue Site', client: 'Manufacturer', year: '2025', did: ['Product catalogue', 'WhatsApp enquiries'] },
    ],
    steps: [
      { t: 'Goals and visitors first', d: 'Who visits, from where — and the one thing each page should get them to do.', p: ['One main action per page', 'Competitor sites reviewed for gaps'] },
      { t: 'Structure and words', d: 'Page flow and key copy planned before any design.', p: ['Sitemap and wireframes agreed', 'Headlines written for your customers'] },
      { t: 'Premium, phone-first design', d: 'Custom design in your brand — no stretched templates.', p: ['Mobile layouts designed first', 'Real content, no lorem ipsum'] },
      { t: 'Built fast, then improved', d: 'Quick on mobile data, found on Google, tracked from day one.', p: ['SEO basics and clean URLs', 'Call and WhatsApp taps tracked as leads'] },
    ],
    details: ['Buttons big enough for thumbs', 'Phone fields open the number keypad', 'Tested on Android and iPhone', 'Readable in bright sunlight'],
    deliver: ['Business websites and landing pages', 'Structure, copy direction and design', 'Mobile-first build', 'SEO setup and Google indexing', 'Analytics and lead tracking', 'Launch support and fixes'],
    faq: [
      { q: 'How long does a website take?', a: 'It depends on the pages and your content. You get a clear timeline after the first call.' },
      { q: 'Can I update it myself?', a: 'If you’ll change things often, we build it that way.' },
      { q: 'Do you handle domain and hosting?', a: 'Yes — domain, hosting and business email, or we work with yours.' },
    ],
  },

  video: {
    lede: 'Reels, ad films and product videos cut for the first three seconds — hooks, captions, motion graphics and sound.',
    belief: 'People decide in *three seconds* whether to keep watching. We edit every frame like it matters.',
    projects: [
      { title: 'Inside the Factory', client: 'Manufacturer', year: '2024', did: ['Brand film edit', 'Reels cut-downs'] },
      { title: 'Product Reels Pack', client: 'Skincare brand', year: '2025', did: ['20 product Reels', 'Captions & audio'] },
    ],
    steps: [
      { t: 'Purpose first', d: 'Stop the scroll, explain or sell — the goal sets the length and pace.', p: ['Platform and placement decided', 'Reference videos agreed'] },
      { t: 'Hook-first structure', d: 'The strongest moment in your footage opens the video.', p: ['Several hooks cut and compared', 'Dead air cut ruthlessly'] },
      { t: 'Made for sound-off', d: 'Captions and on-screen text carry the story on mute.', p: ['Brand-styled, timed captions', 'Text inside platform safe zones'] },
      { t: 'Polish and deliver', d: 'Colour, sound and exports for every place it runs.', p: ['Audio cleaned and mixed', '9:16, 1:1 and 16:9 versions'] },
    ],
    details: ['The hook lands in the first three seconds', 'Captions clear of the like buttons', 'Cuts timed to the beat', 'Every export watched before it’s sent'],
    deliver: ['Reels and Shorts', 'Ad films and brand videos', 'Product and explainer videos', 'Captions and motion graphics', 'Sound design and colour', 'Exports for every platform'],
    faq: [
      { q: 'Can I send phone footage?', a: 'Yes. Good phone footage edits beautifully — we’ll tell you what to shoot next.' },
      { q: 'How do revisions work?', a: 'The style is agreed up front with references, so revisions polish rather than restart.' },
      { q: 'Can we get a monthly batch?', a: 'Yes. A monthly pack keeps your page and your ads fresh.' },
    ],
  },

  shoot: {
    lede: 'Video ads and Reels planned on paper, lit well, framed for the phone and directed on the day — at your shop, factory or site.',
    belief: 'Great edits start with great footage. *A shoot planned on paper* is a shoot that works on the day.',
    projects: [
      { title: 'Showroom Reel Day', client: 'Furniture store', year: '2025', did: ['On-location shoot', '8 Reels from one day'] },
      { title: 'Factory Ad Shoot', client: 'Manufacturer', year: '2024', did: ['Scripted ad film', 'Staff on camera'] },
    ],
    steps: [
      { t: 'Idea before camera', d: 'The goal and the hook are agreed before anyone presses record.', p: ['Scripts written for the first three seconds', 'Reference videos agreed'] },
      { t: 'Plan the day', d: 'Shot list, schedule and checklist — nothing forgotten.', p: ['A storyboard for every video', 'Several videos from one shoot day'] },
      { t: 'Shoot for the phone', d: 'Vertical first, well lit, clean sound, people who look natural.', p: ['Framed clear of the Reels buttons', 'Owners and staff directed on camera'] },
      { t: 'Straight into the edit', d: 'Footage backed up and with our editors the same day.', p: ['Backed up twice before we leave', 'Cut into ads and Reels in-house'] },
    ],
    details: ['The hook is shot first, while energy is high', 'Background noise checked every take', 'Products cleaned, labels to camera', 'Kit packed from a checklist'],
    deliver: ['Concepts, hooks and scripts', 'Shot list and shoot-day plan', 'On-location shoot', 'Lighting, sound and direction', 'Sorted, backed-up footage', 'Edited ads and Reels'],
    faq: [
      { q: 'Do you shoot at our place?', a: 'Yes — shop, factory, site or office, planned around your team.' },
      { q: 'How many videos from one shoot?', a: 'Several ads and Reels from one day. The number is agreed up front.' },
      { q: 'Do we have to be on camera?', a: 'Only if you want to. We direct you so it feels easy.' },
    ],
  },
}
