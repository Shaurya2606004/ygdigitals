/*
 * Copy for the service pages (/services/<slug>).
 * *starred* words in `belief` are highlighted in brand red.
 *
 * `projects` are the client's real work. Each card takes `url` (the live page, store or post; the card links to it) and
 * one picture: `image` (square, 800×800 webp in /public/work), `video` (a short square muted loop, `image` is its
 * poster) or `embed` (an Instagram player). `proof` = dashboard screenshots shown under the cards.
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
      // Jindal's numbers are from its Meta Ads Manager, last 30 days to 27 Sep 2026
      { title: 'Jindal Fasteners', client: 'Fastener manufacturer', url: 'https://www.instagram.com/jindal_fasteners/', image: '/work/social-jindal.webp', did: ['601 WhatsApp enquiries in 30 days', '₹16 per enquiry', 'Reels & posts'] },
      { title: 'Eximkrishveda', client: 'Ayurvedic powders', url: 'https://www.instagram.com/eximkrishveda/', image: '/work/social-exim.webp', did: ['Product posts', 'Reels'] },
      { title: 'Sphinx Healing & Wellness', client: 'Tarot & wellness coach', url: 'https://www.instagram.com/sphinxhealingandwellness/', image: '/work/social-sphinx.webp', did: ['11.9K followers', 'Reels & carousels'] },
    ],
    proof: [{ src: '/work/proof-meta-ads.webp', w: 1400, h: 338, caption: 'Jindal Fasteners, Meta Ads: 601 WhatsApp enquiries at ₹16.28 each' }],
    steps: [
      { t: 'Know the business', d: 'Your buyers, best-sellers and what a lead is worth — before any content.', p: ['Goals set: enquiries, sales, real followers', 'Competitors and their ads studied'] },
      { t: 'Plan the month', d: 'A content calendar agreed a month ahead, with the ads planned alongside it.', p: ['Posts, Reels and Stories scheduled', 'Ad budget split by stage'] },
      { t: 'Made to stop thumbs', d: 'Hook-first posts and ads, made for phones with the sound off.', p: ['Several hooks tested per idea', 'Sized for Feed, Stories and Reels'] },
      { t: 'Show up, track, report', d: 'Daily replies, daily ad checks and a report you can read in two minutes.', p: ['Comments and DMs answered the same day', 'Pixel and Conversions API tested'] },
    ],
    details: ['The hook is written before the design', 'Every post previewed on a real phone', 'Ad frequency watched, never overdone', 'Copy in English, Hindi or Hinglish'],
    deliver: ['Monthly content calendar', 'Posts, Reels and Stories', 'Captions, hashtags and covers', 'Comment and DM handling', 'Meta ads, managed daily', 'Monthly report and review call'],
    faq: [
      { q: 'Who is the best social media marketing agency in Gohana?', a: 'We’d like to earn that. YG Digitals is a social media marketing agency in Gohana, Haryana, running Instagram and Facebook for brands across Delhi NCR — Delhi, Gurugram, Noida, Sonipat, Panipat, Rohtak — and all of India.' },
      { q: 'How many posts a month?', a: 'We agree a monthly plan of posts, Reels and Stories on the first call — and stick to it.' },
      { q: 'Do you make the content too?', a: 'Yes. Scripts, design, Reels and copy are all made in-house.' },
      { q: 'Will I own my pages and ad account?', a: 'Always. Everything stays in your name; we work as partners inside it.' },
    ],
  },

  ecom: {
    lede: 'Your Amazon, Flipkart and Meesho stores, run end to end — listings that rank, images that convert and ads that pay their way.',
    belief: 'On a marketplace, *your listing is your salesman*. We make it the best-dressed one on the page.',
    projects: [
      // numbers from the seller dashboards (28 Sep 2026): Flipkart = gross, 29 Aug–27 Sep; Amazon = units ordered, last 6 months.
      // no links: the Amazon listings are rated 2.5–3.8★
      { title: 'Savaria on Flipkart', client: 'Desi ghee brand', image: '/work/ecom-flipkart.webp', did: ['₹5.76L sales in 30 days', '+892 units vs the month before', '60 live listings'] },
      { title: 'Savaria on Amazon', client: 'Desi ghee brand', image: '/work/ecom-amazon.webp', did: ['1,410 units in 6 months', '16.2% conversion', 'New store, 10+ ranges'] },
    ],
    // the whole dashboard screens, only the laptop's menu bar, browser tabs and address bar cropped off
    proof: [
      { src: '/work/proof-flipkart-insights.webp', w: 1600, h: 806, caption: 'Flipkart, last 30 days: 1.2K units and ₹5.76L gross sales, +892 units on the month before' },
      { src: '/work/proof-flipkart-home.webp', w: 1280, h: 644, caption: 'Flipkart, 28 Sep: 133 units and ₹61.6K in a day' },
      { src: '/work/proof-flipkart-listings.webp', w: 1600, h: 802, caption: 'Flipkart, listings: 60 active' },
      { src: '/work/proof-amazon-sales.webp', w: 1600, h: 802, caption: 'Amazon, last 6 months: 1,410 units, 16.2% conversion' },
      { src: '/work/proof-amazon-inventory.webp', w: 1600, h: 802, caption: 'Amazon, inventory: 10+ Savaria ghee ranges listed' },
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
      { q: 'Do you offer Amazon seller account management services across India?', a: 'Yes. From Gohana, Haryana we manage Amazon, Flipkart and Meesho seller accounts for sellers anywhere in India — listings, ads and account health.' },
      { q: 'Can you take over my existing store?', a: 'Yes. We audit listings, ads and account health, fix the leaks, then grow.' },
      { q: 'Which marketplaces do you handle?', a: 'Amazon, Flipkart and Meesho — one or all three, from the same catalogue.' },
      { q: 'How will I know what’s happening?', a: 'One monthly report across every marketplace, plus a review call.' },
    ],
  },

  pack: {
    lede: 'Boxes, labels and pouches that win the shelf and the thumbnail — premium on the outside, print-ready on the inside.',
    belief: 'Packaging is the *only ad your customer holds*. We design it to be picked up and remembered.',
    // real work, from the client's portfolio (2026-09-28); the best 8 of 16
    projects: [
      { title: 'Superfarmers', client: 'Veggie chips', image: '/work/pack-superfarmers.webp', did: ['3-flavour range', 'Colour-coded variants'] },
      { title: 'Roohted', client: 'Vacuum-cooked chips', image: '/work/pack-roohted.webp', did: ['Front & back of pack', 'Nutrition panel'] },
      { title: 'Your Fab', client: 'Indori sev', image: '/work/pack-yourfab.webp', did: ['Namkeen pouch', 'Bold shelf colours'] },
      { title: 'FarmLane', client: 'Flavoured makhana', image: '/work/pack-farmlane.webp', did: ['Hand-drawn illustration', 'Premium pouch'] },
      { title: 'Zaika Nuts', client: 'Dry fruits', image: '/work/pack-zaikanuts.webp', did: ['Anjeer pouch', 'Product-first front'] },
      { title: 'Velvet Bean', client: 'Arabica coffee', image: '/work/pack-velvetbean.webp', did: ['Coffee bag', 'Full-wrap artwork'] },
      { title: 'Chosenn', client: 'Energy bar', image: '/work/pack-chosenn.webp', did: ['Bar wrapper', 'Claim icons'] },
      { title: 'Fermente', client: 'Protein chips', image: '/work/pack-fermente.webp', did: ['Chips pouch', 'Flavour & protein callouts'] },
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
      { q: 'Looking for a packaging design company in Haryana?', a: 'We’re in Gohana. Pouch packaging, food labels and boxes for brands across Delhi NCR and all of India — files ready for your printer.' },
      { q: 'Can you work with my printer?', a: 'Yes. We prepare files to their specs and can talk to them directly.' },
      { q: 'What do you need to start?', a: 'The product or its exact size, any current packaging, and the text it must carry.' },
      { q: 'Will regular customers still recognise it?', a: 'Yes. We keep what people know — colour, logo, shape — and upgrade the rest.' },
    ],
  },

  web: {
    lede: 'Fast, mobile-first websites and landing pages that look expensive and turn visitors into calls — designed and built in-house.',
    belief: 'A website isn’t a brochure. It’s *your best salesperson, working 24 hours*.',
    projects: [
      { title: 'Silk and Sequence', client: "Men's kurta label", url: 'https://silkandsequence.com', image: '/work/web-silk.webp', did: ['Online store', 'Editorial look'] },
      { title: 'Studio Agriya', client: 'Landscape architects', url: 'https://studio-agriya.vercel.app/', image: '/work/web-agriya.webp', did: ['Studio website', 'Project enquiries'] },
      { title: 'Radha Madhav Textiles', client: 'Textile agency, Surat', url: 'https://radha-madhav-textiles.vercel.app/', image: '/work/web-radha.webp', did: ['Company website', 'Enquiry flow'] },
      { title: 'S.R. Timbers', client: 'Timber importer', url: 'https://srtimbers.com', image: '/work/web-srt.webp', did: ['Business website', 'Call & WhatsApp buttons'] },
      // the quiet flex: this very site
      { title: 'YG Digitals', client: 'The site you’re on', url: '/', image: '/work/web-yg.webp', did: ['3D clay hero', 'Designed & built in-house'] },
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
      { q: 'Who is the best website designer in Gohana?', a: 'We’d like to earn that. YG Digitals is a website design and development company in Gohana, Haryana, building sites for businesses across Delhi NCR — Delhi, Gurugram, Noida, Sonipat, Panipat, Rohtak — and all of India.' },
      { q: 'How long does a website take?', a: 'It depends on the pages and your content. You get a clear timeline after the first call.' },
      { q: 'Can I update it myself?', a: 'If you’ll change things often, we build it that way.' },
      { q: 'Do you handle domain and hosting?', a: 'Yes — domain, hosting and business email, or we work with yours.' },
    ],
  },

  video: {
    lede: 'Reels, ad films and product videos cut for the first three seconds — hooks, captions, motion graphics and sound.',
    belief: 'People decide in *three seconds* whether to keep watching. We edit every frame like it matters.',
    projects: [
      { title: 'Consistency over recognition', client: 'Jindal Fasteners · Reel', embed: 'https://www.instagram.com/reel/DdtySsqJorf/embed', did: ['Maruti Suzuki recognition', 'Logo motion graphics'] },
      { title: 'Weak connections? Not on our watch', client: 'Jindal Fasteners · Reel', embed: 'https://www.instagram.com/reel/Ddjf3QDpQEl/embed', did: ['Product close-ups', 'Hook-first cut'] },
      { title: 'Not always about the price', client: 'Jindal Fasteners · Reel', embed: 'https://www.instagram.com/reel/Dcd-M-4p02f/embed', did: ['Talking-head edit', 'Expo footage'] },
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
      { q: 'Do you offer Reels editing services outside Gohana?', a: 'Yes. Send footage from anywhere in India — we edit Instagram Reels, YouTube videos and ad films from our studio in Gohana, Haryana.' },
      { q: 'Can I send phone footage?', a: 'Yes. Good phone footage edits beautifully — we’ll tell you what to shoot next.' },
      { q: 'How do revisions work?', a: 'The style is agreed up front with references, so revisions polish rather than restart.' },
      { q: 'Can we get a monthly batch?', a: 'Yes. A monthly pack keeps your page and your ads fresh.' },
    ],
  },

  shoot: {
    lede: 'Video ads and Reels planned on paper, lit well, framed for the phone and directed on the day — at your shop, factory or site.',
    belief: 'Great edits start with great footage. *A shoot planned on paper* is a shoot that works on the day.',
    projects: [
      // behind-the-scenes clips from a factory shoot day; `video` plays muted in the card, `image` is its poster
      { title: 'Quality lab', client: 'Factory shoot · behind the scenes', video: '/work/shoot-lab.mp4', image: '/work/shoot-lab.webp', did: ['Gimbal moves', 'Staff at work'] },
      { title: 'Coil yard', client: 'Factory shoot · behind the scenes', video: '/work/shoot-yard.mp4', image: '/work/shoot-yard.webp', did: ['Forklift in action', 'Wide factory shots'] },
      { title: 'Floor walk-through', client: 'Factory shoot · behind the scenes', video: '/work/shoot-floor.mp4', image: '/work/shoot-floor.webp', did: ['Team on camera', 'Follow shots'] },
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
      { q: 'Do you do Reel and video ad shoots in Delhi NCR?', a: 'Yes — anywhere in Delhi NCR and nearby: Delhi, Gurugram, Noida, Faridabad, Sonipat, Panipat, Rohtak and beyond. Factory, shop and product shoots are our everyday work.' },
      { q: 'Do you shoot at our place?', a: 'Yes — shop, factory, site or office, planned around your team.' },
      { q: 'How many videos from one shoot?', a: 'Several ads and Reels from one day. The number is agreed up front.' },
      { q: 'Do we have to be on camera?', a: 'Only if you want to. We direct you so it feels easy.' },
    ],
  },
}
