export const CONTACT = {
  phone: '+91 98174 58931',
  tel: 'tel:+919817458931',
  email: 'yashgarg6564@gmail.com',
  whatsapp: 'https://wa.me/919817458931',
  instagram: 'https://www.instagram.com/ygdigitals.marketing',
  city: 'Gohana, Haryana',
  reach: 'Working with brands across India',
}

// the live address; canonical links, link previews and sitemap.xml are built from it — switch to the custom domain once it's attached
export const SITE = 'https://ygdigitals.vercel.app'

export const waLink = (text = "Hi YG Digitals! I'd like to book a call.") =>
  `${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`

// theme = section background while this service is on screen; buddy = the mascot's outfit colour on that background
export const SERVICES = [
  {
    id: 'ads',
    slug: 'social-media-ads',
    no: '01',
    title: 'Social Media Ads',
    lines: ['Social', 'Media Ads'],
    desc: 'Thumb-stopping creatives and Meta campaigns on Instagram & Facebook, built to turn scrollers into enquiries — not just likes.',
    tags: ['Reels & static creatives', 'Audience targeting', 'Retargeting', 'Monthly reports'],
    theme: 'white',
    buddy: 'black',
    meta: {
      title: 'Social Media Ads Agency in Gohana — Meta Ads for Instagram & Facebook | YG Digitals',
      description:
        'How YG Digitals plans, designs and runs Meta ads on Instagram & Facebook for brands in Gohana and across India — research, hook-first creatives, proper tracking and daily optimisation.',
    },
  },
  {
    id: 'ecom',
    slug: 'ecommerce-handling',
    no: '02',
    title: 'E-commerce',
    lines: ['E-commerce', 'Handling'],
    desc: 'We run your marketplace stores end to end — listings, catalogue and sponsored ads on Amazon, Flipkart, Meesho & Myntra.',
    tags: ['Amazon', 'Flipkart', 'Meesho', 'Myntra', 'Listings', 'Marketplace ads'],
    theme: 'black',
    buddy: 'white',
    meta: {
      title: 'E-commerce Handling in Gohana — Amazon, Flipkart, Meesho & Myntra | YG Digitals',
      description:
        'Marketplace store management by YG Digitals: keyword-researched listings, images that sell, sponsored ads and daily store care on Amazon, Flipkart, Meesho and Myntra.',
    },
  },
  {
    id: 'pack',
    slug: 'packaging-design',
    no: '03',
    title: 'Packaging Design',
    lines: ['Packaging', 'Design'],
    desc: 'Boxes, labels and pouches that win the shelf and the thumbnail — premium on the outside, print-ready on the inside.',
    tags: ['Boxes & labels', 'Pouches', 'Print-ready files', '3D mockups'],
    theme: 'white',
    buddy: 'black',
    meta: {
      title: 'Packaging Design in Gohana — Boxes, Labels & Pouches | YG Digitals',
      description:
        'Packaging design by YG Digitals: boxes, labels and pouches designed for the shelf and the thumbnail, with print-ready dielines, correct legal text and photo-real 3D mockups.',
    },
  },
  {
    id: 'web',
    slug: 'website-design',
    no: '04',
    title: 'Website Design',
    lines: ['Website', 'Design'],
    desc: 'Fast, mobile-first websites and landing pages that look expensive and are built to turn visitors into calls.',
    tags: ['Business websites', 'Landing pages', 'Mobile-first', 'SEO-ready'],
    theme: 'black',
    buddy: 'white',
    meta: {
      title: 'Website Design in Gohana — Fast, Mobile-First Websites | YG Digitals',
      description:
        'Website design by YG Digitals: fast, mobile-first business websites and landing pages built to turn visitors into calls and WhatsApp enquiries — SEO-ready and tracked.',
    },
  },
  {
    id: 'video',
    slug: 'video-editing',
    no: '05',
    title: 'Video Editing',
    lines: ['Video', 'Editing'],
    desc: 'Reels, ad films and product videos cut for the first three seconds — hooks, captions, motion graphics and sound.',
    tags: ['Reels & shorts', 'Ad films', 'Product videos', 'Motion graphics'],
    theme: 'white',
    buddy: 'black',
    meta: {
      title: 'Video Editing in Gohana — Reels, Ad Films & Product Videos | YG Digitals',
      description:
        'Video editing by YG Digitals: Reels, ad films and product videos cut hook-first for the first three seconds, with captions, motion graphics, sound and colour.',
    },
  },
]

// the sixth page: all five services run as one system, for bigger companies
export const ECOSYSTEM = {
  id: 'eco',
  slug: 'online-presence-ecosystem',
  title: 'Online Presence Ecosystem',
  meta: {
    title: 'Online Presence Ecosystem for Enterprises — One Digital Team | YG Digitals',
    description:
      'YG Digitals designs, builds and runs the entire online presence of factories, developers and growing brands as one connected system: website, ads, marketplaces, packaging and video.',
  },
}

// every page besides the home page lives at /services/<slug>
export const PAGES = [...SERVICES, ECOSYSTEM]
export const pagePath = (p) => `/services/${p.slug}`

export const PLATFORMS = ['Instagram', 'Facebook', 'Amazon', 'Flipkart', 'Meesho', 'Myntra', 'YouTube', 'Google']

export const INDUSTRIES = ['Factory owners', 'Real estate', 'E-commerce sellers', 'D2C brands', 'Local businesses']

// PLACEHOLDER WORK — swap in real client projects. Set `image` to a path in /public to replace the illustrated mock.
export const WORK = [
  { id: 'w1', cat: 'ads', title: 'Festive Sale Blitz', client: 'Apparel label', year: '2025', tone: 'mist', image: null,
    did: ['12 Reels + carousel ad creatives', 'Instagram & Facebook campaign setup', 'Retargeting for cart abandoners'] },
  { id: 'w2', cat: 'ecom', title: 'Marketplace Launch', client: 'Home-décor seller', year: '2025', tone: 'black', image: null,
    did: ['Amazon & Flipkart store setup', 'Keyword-rich product listings', 'Sponsored product ads'] },
  { id: 'w3', cat: 'pack', title: 'Masala Box Series', client: 'Spice brand', year: '2025', tone: 'white', image: null,
    did: ['Packaging system for 6 SKUs', 'Print-ready dielines', '3D product mockups'] },
  { id: 'w4', cat: 'web', title: 'Builder Showcase', client: 'Real-estate developer', year: '2024', tone: 'mist', image: null,
    did: ['Project showcase website', 'Lead-capture landing pages', 'WhatsApp enquiry flow'] },
  { id: 'w5', cat: 'video', title: 'Inside the Factory', client: 'Manufacturer', year: '2024', tone: 'black', image: null,
    did: ['Brand film edit', 'Reels cut-downs', 'Captions & motion graphics'] },
  { id: 'w6', cat: 'ads', title: 'Site-Visit Machine', client: 'Housing project', year: '2024', tone: 'white', image: null,
    did: ['Lead-generation campaign', 'Walkthrough video ads', 'Weekly lead reports'] },
  { id: 'w7', cat: 'ecom', title: 'Catalogue Glow-Up', client: 'Ethnic-wear seller', year: '2024', tone: 'mist', image: null,
    did: ['Meesho & Myntra catalogue refresh', 'Listing images & copy', 'Pricing & ads review'] },
  { id: 'w8', cat: 'video', title: 'Product Reels Pack', client: 'Skincare brand', year: '2025', tone: 'white', image: null,
    did: ['20 product Reels', 'Hook-first scripting', 'Trending audio & captions'] },
]

export const PROCESS = [
  { no: '01', title: 'Discovery call', text: 'A free call where we learn your business, your buyers and what growth actually means for you.' },
  { no: '02', title: 'Plan & design', text: 'We map platforms, creatives, listings and budgets — then design everything in-house.' },
  { no: '03', title: 'Launch', text: 'Ads go live, listings get published, sites ship. Fast, and checked twice.' },
  { no: '04', title: 'Report & scale', text: "Plain-language monthly reports. What works gets more budget; what doesn't gets cut." },
]

// Keep only numbers you can prove. `placeholder: true` ones MUST be confirmed with the client before launch.
export const STATS = [
  { value: 5, suffix: '', label: 'services under one roof' },
  { value: 6, suffix: '', label: 'platforms we run every day' },
  { value: 100, suffix: '+', label: 'projects delivered', placeholder: true },
  { value: 1, suffix: '', label: 'call to get started' },
]
