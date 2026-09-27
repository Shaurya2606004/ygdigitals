export const CONTACT = {
  phone: '+91 98174 58931',
  tel: 'tel:+919817458931',
  email: 'ygdigitalsacc@gmail.com',
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
    slug: 'social-media-management',
    no: '01',
    title: 'Social Media Management',
    lines: ['Social', 'Media', 'Management'],
    desc: 'Your Instagram & Facebook, run for you — planned posts, Reels, replies and Meta ads that turn scrollers into enquiries, not just likes.',
    tags: ['Content calendar', 'Posts & Reels', 'Comments & DMs', 'Meta ads'],
    theme: 'white',
    buddy: 'black',
    meta: {
      title: 'Social Media Management in Gohana — Instagram & Facebook | YG Digitals',
      description:
        'How YG Digitals runs Instagram & Facebook for brands in Gohana and across India — a planned content calendar, posts and Reels made in-house, comments and DMs handled daily, and Meta ads that bring enquiries.',
    },
  },
  {
    id: 'ecom',
    slug: 'ecommerce-handling',
    no: '02',
    title: 'E-commerce',
    lines: ['E-commerce', 'Handling'],
    desc: 'We run your marketplace stores end to end — listings, catalogue and sponsored ads on Amazon, Flipkart & Meesho.',
    tags: ['Amazon', 'Flipkart', 'Meesho', 'Listings', 'Marketplace ads'],
    theme: 'black',
    buddy: 'white',
    meta: {
      title: 'E-commerce Handling in Gohana — Amazon, Flipkart & Meesho | YG Digitals',
      description:
        'Marketplace store management by YG Digitals: keyword-researched listings, images that sell, sponsored ads and daily store care on Amazon, Flipkart and Meesho.',
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
  {
    id: 'shoot',
    slug: 'video-ad-reel-shoot',
    no: '06',
    title: 'Video Ad & Reel Shoot',
    lines: ['Video Ad &', 'Reel Shoot'],
    desc: 'We script, plan and shoot your video ads and Reels — at your shop, factory or site — lit, framed for the phone and directed on the day.',
    tags: ['Ad shoots', 'Reel shoots', 'Scripts & shot lists', 'On location'],
    theme: 'black',
    buddy: 'white',
    meta: {
      title: 'Video Ad & Reel Shoot in Gohana — Shot On Location | YG Digitals',
      description:
        'Video ad and Reel shoots by YG Digitals: scripted, planned and shot at your shop, factory or site — lit well, framed for the phone screen and directed so your team looks natural on camera.',
    },
  },
]

// every service has its own page at /services/<slug>
export const pagePath = (p) => `/services/${p.slug}`

export const PLATFORMS = ['Instagram', 'Facebook', 'Amazon', 'Flipkart', 'Meesho', 'YouTube', 'Google']

export const INDUSTRIES = ['Factory owners', 'Real estate', 'E-commerce sellers', 'D2C brands', 'Local businesses']

// Keep only numbers you can prove. `placeholder: true` ones MUST be confirmed with the client before launch.
export const STATS = [
  { value: SERVICES.length, suffix: '', label: 'services under one roof' },
  { value: 5, suffix: '', label: 'platforms we run every day' },
  { value: 100, suffix: '+', label: 'projects delivered', placeholder: true },
  { value: 1, suffix: '', label: 'call to get started' },
]
