export const CONTACT = {
  phone: '+91 98174 58931',
  tel: 'tel:+919817458931',
  email: 'ygdigitalsacc@gmail.com',
  whatsapp: 'https://wa.me/919817458931',
  instagram: 'https://www.instagram.com/ygdigitals.marketing',
  city: 'Gohana, Haryana',
  reach: 'Serving Sonipat, Panipat, Rohtak & all of India',
}

// the live address (the custom domain Search Console knows); canonical links, link previews, sitemap.xml and robots.txt are built from it
export const SITE = 'https://www.ygdigitals.com'

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
      title: 'Social Media Marketing Agency in Gohana, Haryana | YG Digitals',
      description:
        'Social media marketing agency in Gohana, Haryana — Instagram & Facebook management, posts and Reels made in-house, and Meta ads that bring enquiries. Serving Sonipat, Panipat, Rohtak & all of India.',
    },
  },
  {
    id: 'shoot',
    slug: 'video-ad-reel-shoot',
    no: '02',
    title: 'Video Ad & Reel Shoot',
    lines: ['Video Ad &', 'Reel Shoot'],
    desc: 'We script, plan and shoot your video ads and Reels — at your shop, factory or site — lit, framed for the phone and directed on the day.',
    tags: ['Ad shoots', 'Reel shoots', 'Scripts & shot lists', 'On location'],
    theme: 'black',
    buddy: 'white',
    meta: {
      title: 'Reel & Video Ad Shoot Services in Gohana, Haryana | YG Digitals',
      description:
        'Reel shooting and video ad shoot services in Gohana, Haryana — factory, shop and product shoots, scripted, lit and directed on location. Serving Sonipat, Panipat, Rohtak & nearby.',
    },
  },
  {
    id: 'ecom',
    slug: 'ecommerce-handling',
    no: '03',
    title: 'E-commerce',
    lines: ['E-commerce', 'Handling'],
    desc: 'We run your marketplace stores end to end — listings, catalogue and sponsored ads on Amazon, Flipkart & Meesho.',
    tags: ['Amazon', 'Flipkart', 'Meesho', 'Listings', 'Marketplace ads'],
    theme: 'white',
    buddy: 'black',
    meta: {
      title: 'Amazon, Flipkart & Meesho Account Management, Gohana | YG Digitals',
      description:
        'Amazon, Flipkart and Meesho seller account management services from Gohana, Haryana — listing services, product images, sponsored ads and daily store care for sellers across India.',
    },
  },
  {
    id: 'pack',
    slug: 'packaging-design',
    no: '04',
    title: 'Packaging Design',
    lines: ['Packaging', 'Design'],
    desc: 'Boxes, labels and pouches that win the shelf and the thumbnail — premium on the outside, print-ready on the inside.',
    tags: ['Boxes & labels', 'Pouches', 'Print-ready files', '3D mockups'],
    theme: 'black',
    buddy: 'white',
    meta: {
      title: 'Packaging Design Company in Gohana, Haryana | YG Digitals',
      description:
        'Product packaging design company in Gohana, Haryana — pouch packaging, food labels and box design with print-ready dielines and 3D mockups, for FMCG and D2C brands across India.',
    },
  },
  {
    id: 'web',
    slug: 'website-design',
    no: '05',
    title: 'Website Design',
    lines: ['Website', 'Design'],
    desc: 'Fast, mobile-first websites and landing pages that look expensive and are built to turn visitors into calls.',
    tags: ['Business websites', 'Landing pages', 'Mobile-first', 'SEO-ready'],
    theme: 'white',
    buddy: 'black',
    meta: {
      title: 'Website Design Company in Gohana, Haryana | YG Digitals',
      description:
        'Website design & development company in Gohana, Haryana — fast, mobile-first business websites that bring calls and WhatsApp enquiries. Serving Sonipat, Panipat, Rohtak & all of India.',
    },
  },
  {
    id: 'video',
    slug: 'video-editing',
    no: '06',
    title: 'Video Editing',
    lines: ['Video', 'Editing'],
    desc: 'Reels, ad films and product videos cut for the first three seconds — hooks, captions, motion graphics and sound.',
    tags: ['Reels & shorts', 'Ad films', 'Product videos', 'Motion graphics'],
    theme: 'black',
    buddy: 'white',
    meta: {
      title: 'Reels & Video Editing Services in Gohana, Haryana | YG Digitals',
      description:
        'Reels editing and video editing services in Gohana, Haryana — Instagram Reels, YouTube videos and ad films cut hook-first, with captions, motion graphics, sound and colour.',
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
