/*
 * Long-form copy for the service pages (/services/<slug>). Loaded only with those pages, never on the home page.
 * *starred* words in `belief` are highlighted in brand red.
 */

// the same on every page
export const WHY = [
  { t: 'Local, and in person', d: 'We’re based in Gohana. Sit with us, show us your shop floor or site, meet the people doing the work — then we grow you across India.' },
  { t: 'One in-house team', d: 'Design, ads, video and web sit in the same room. No hand-offs to freelancers, no ideas lost between agencies.' },
  { t: 'Checked twice, always', d: 'Every ad, listing, file and page is reviewed by a second pair of eyes before it goes live.' },
  { t: 'We work like it’s our money', d: 'Daily checks, fast replies on WhatsApp and honest reports — including the months the numbers aren’t pretty.' },
]

export const CONTENT = {
  ads: {
    kicker: 'Service 01 / 05',
    lede: 'Meta ads for Instagram and Facebook that are researched like a business plan, designed like a brand campaign and watched every working day. Built to bring enquiries and sales — not vanity likes.',
    belief: 'Boosting a post is easy. *Building an ad system* — where every rupee has a job and every creative earns its place — is the work we love.',
    steps: [
      {
        t: 'Understand the business before the ad',
        d: 'We start with your numbers, not our ideas: margins, best-sellers, order values and what a lead is actually worth to you.',
        p: ['Cost-per-lead and cost-per-sale targets set before a rupee is spent', 'Competitor ads studied in the Meta Ad Library', 'Real buyer questions collected from your sales team and WhatsApp chats'],
      },
      {
        t: 'Plan the funnel',
        d: 'New audiences, warm audiences and people who almost bought each get a different message, budget and creative.',
        p: ['Awareness, consideration and retargeting planned as separate campaigns', 'Budget split by stage — never spread thin', 'Offer and landing page matched to every stage'],
      },
      {
        t: 'Creatives made for the first three seconds',
        d: 'Every ad is written hook-first and designed for how people really watch on a phone: sound off, thumb moving.',
        p: ['Several hooks per idea, so the data picks the winner', 'Captions burned in, key text kept inside the Reels safe zone', 'Separate sizes for Feed, Stories and Reels — never one stretched file'],
      },
      {
        t: 'Track everything, properly',
        d: 'If it can’t be measured, it can’t be improved. Tracking is set up and tested before launch — not after.',
        p: ['Meta Pixel and Conversions API installed and test-fired', 'UTM links on every ad, so every enquiry traces back to its creative', 'Lead forms and WhatsApp clicks counted as real conversions'],
      },
      {
        t: 'Optimise daily, report plainly',
        d: 'Winners get more budget, losers get cut, and you get a report you can read in two minutes.',
        p: ['Spend, frequency and cost-per-result checked every working day', 'Fresh creatives ready before audiences tire of the old ones', 'Monthly report in plain language: what we spent, what it got, what’s next'],
      },
    ],
    details: [
      'The hook is written before the design starts',
      'Text kept clear of the Reels buttons and captions',
      'Every ad previewed on a real phone before launch',
      'Campaign names that tell you exactly what’s running',
      'Audience overlap checked so your ads don’t bid against each other',
      'Frequency watched so nobody sees the same ad to death',
      'Comments and DMs on ads flagged to you the same day',
      'Copy in the language your buyer speaks — English, Hindi or Hinglish',
    ],
    deliver: ['Campaign strategy and funnel plan', 'Monthly creative set — Reels and static ads', 'Ad copy and hooks', 'Pixel, Conversions API and UTM setup', 'Day-to-day campaign management', 'Monthly report and review call'],
    faq: [
      { q: 'What budget do I need to start?', a: 'It depends on your city, product and goal. On the first call we work out a test budget big enough to learn from and small enough to be safe — then scale what works.' },
      { q: 'Do you make the creatives too?', a: 'Yes. Scripts, design, Reels editing and copy are all done in-house, so the idea never gets lost between the ad maker and the ad runner.' },
      { q: 'How soon will I see results?', a: 'The first weeks are about finding the creatives and audiences that work. We share what the numbers say at every step — honestly, even when it’s early.' },
      { q: 'Will I own my ad account?', a: 'Always. Campaigns run inside your own Meta Business account and we work as partners in it. Your data stays yours.' },
    ],
  },

  ecom: {
    kicker: 'Service 02 / 05',
    lede: 'We run your marketplace stores like they’re our own shop — listings that rank, catalogues that convert and ads that pay their way. Amazon, Flipkart, Meesho and Myntra, handled end to end.',
    belief: 'On a marketplace, *your listing is your salesman*. We make sure it’s the best-dressed, best-spoken one on the page.',
    steps: [
      {
        t: 'Audit the store and the category',
        d: 'Before touching anything we study your category: who ranks, what they charge and what buyers complain about in their reviews.',
        p: ['Top competitor listings and prices benchmarked', 'Review mining: what buyers love and hate in your category', 'Account health, fees and return reasons checked'],
      },
      {
        t: 'Keywords before copy',
        d: 'Titles, bullets and search terms are built from what buyers actually type — then written for humans.',
        p: ['Keyword research for each marketplace — each one searches differently', 'Titles written within every platform’s rules and character limits', 'Backend search terms and attributes filled in completely'],
      },
      {
        t: 'Images that sell on a small screen',
        d: 'Most buyers decide from the image stack on a phone. Every image has one job: answer a question before it’s asked.',
        p: ['Main images made to each platform’s rules', 'Infographics for size, material, use and what’s in the box', 'A+ and enhanced content wherever the marketplace allows it'],
      },
      {
        t: 'Ads that are watched, not left running',
        d: 'Sponsored ads start tight and widen on data. Search terms that waste money are cut every week.',
        p: ['Separate campaigns for brand, generic and competitor keywords', 'Weekly search-term review and negative keywords', 'Bids set against your margin — not against vanity sales'],
      },
      {
        t: 'Run the store, every day',
        d: 'Pricing, stock, reviews, returns and account health — the unglamorous work that decides who wins the sale.',
        p: ['Stock and price checks so listings never go dark', 'Ratings and reviews monitored, problems raised early', 'Monthly report: sales, ad spend, ACoS and next moves'],
      },
    ],
    details: [
      'Every character of the title earns its place',
      'Variations grouped properly, so reviews add up on one page',
      'Image text readable on a six-inch phone',
      'Size charts double-checked against the real product',
      'Weights, dimensions and HSN codes filled correctly — so the fees are too',
      'Negative keywords added every single week',
      'Sale events and festive season planned in advance',
      'Listings re-checked whenever marketplace rules change',
    ],
    deliver: ['Store setup or takeover on Amazon, Flipkart, Meesho & Myntra', 'Keyword-researched titles, bullets and descriptions', 'Listing images, infographics and A+ content', 'Sponsored ads setup and weekly optimisation', 'Price, stock and account-health monitoring', 'Monthly sales and ads report'],
    faq: [
      { q: 'Can you take over a store I already run?', a: 'Yes. We start with a full audit of listings, ads and account health, fix the leaks first, then grow.' },
      { q: 'Which marketplaces do you handle?', a: 'Amazon, Flipkart, Meesho and Myntra — one of them or all four, from the same catalogue.' },
      { q: 'Should I sell on more than one marketplace?', a: 'Often, yes — buyers are split across platforms. We look at your category and margins and tell you honestly where to start.' },
      { q: 'How will I know what’s happening?', a: 'One monthly report across every marketplace — sales, ad spend, returns and what we’ll do next — plus a review call to go through it.' },
    ],
  },

  pack: {
    kicker: 'Service 03 / 05',
    lede: 'Boxes, labels and pouches that win the shelf and the thumbnail. Premium on the outside, print-ready on the inside — because a beautiful design that prints wrong is a bad design.',
    belief: 'Packaging is the *only ad your customer holds in their hands*. We design it to be picked up, photographed and remembered.',
    steps: [
      {
        t: 'Shelf, screen and customer',
        d: 'We study where your product will be seen: a crowded shop shelf, a tiny marketplace thumbnail or an unboxing video.',
        p: ['Competitor packs collected and compared side by side', 'Buyer and price point defined before a single sketch', 'What must be read in three seconds decided up front'],
      },
      {
        t: 'Structure before surface',
        d: 'The right box, pouch or label material comes first — it decides cost, protection and how premium it feels.',
        p: ['Dieline built around the actual product’s dimensions', 'Material and finish options matched to your budget', 'Shipping and stacking considered, not just looks'],
      },
      {
        t: 'Design a family, not one box',
        d: 'Most brands have many products. We design one look with a system that makes every variant easy to tell apart.',
        p: ['Clear order: brand, product, variant, key benefit', 'Colour coding across flavours, sizes or ranges', 'Space for mandatory text planned from day one'],
      },
      {
        t: 'Print-ready means print-ready',
        d: 'Files that fail at the printer cost you money and time. Every file is prepared the way presses need it.',
        p: ['CMYK colour, bleed, safe margins and accurate dielines', 'Barcode, MRP, net quantity and manufacturer details placed correctly', 'Proofs checked and printer questions answered with you'],
      },
      {
        t: 'See it in 3D first',
        d: 'Before anything is printed you see it as photo-real 3D — and the same renders go straight onto your listings and ads.',
        p: ['3D mockups from every angle', 'Renders ready for Amazon, Flipkart and social ads', 'Changes made on screen, not after a print run'],
      },
    ],
    details: [
      'Legal declarations laid out where they’re expected',
      'Barcodes sized and contrast-checked before print',
      'No text smaller than people can actually read',
      'Colours judged in CMYK, not on a bright screen',
      'Bleed and safe zones on every single panel',
      'Folds and glue flaps marked on the dieline',
      'Thumbnail test: the pack still reads at marketplace size',
      'Every product’s text proofread twice',
    ],
    deliver: ['Packaging concept and design directions', 'Boxes, labels, pouches and sleeves', 'Dielines and print-ready files', 'A design system for all your variants', 'Photo-real 3D mockups', 'Support with your printer'],
    faq: [
      { q: 'Can you work with my existing printer?', a: 'Yes. We prepare files to your printer’s specifications and can talk to them directly to avoid surprises.' },
      { q: 'What do you need from me to start?', a: 'The product (or its exact dimensions), your current packaging if you have one, and the text that must appear on it. We take it from there.' },
      { q: 'Can you redesign without losing my regular customers?', a: 'Yes. We keep what people recognise — colour, logo, shape — and upgrade everything around it.' },
      { q: 'Will it work for online sales too?', a: 'Every pack is tested as a small thumbnail, and the 3D renders are prepared for your listings and ads.' },
    ],
  },

  web: {
    kicker: 'Service 04 / 05',
    lede: 'Fast, mobile-first websites and landing pages that look expensive and are built to turn visitors into calls. Designed and built in-house, for how India actually browses — on a phone, on mobile data.',
    belief: 'A website isn’t a brochure. It’s *your best salesperson, working 24 hours* — so every page is designed around the one thing it should get people to do.',
    steps: [
      {
        t: 'Goals and visitors first',
        d: 'Who visits, from where, and what should they do? A factory buyer, a home buyer and an Instagram shopper need very different websites.',
        p: ['One main action per page: call, WhatsApp, enquire or buy', 'Competitor websites reviewed for gaps we can beat', 'Pages and content mapped before any design'],
      },
      {
        t: 'Structure and words',
        d: 'We plan the page flow and the key copy before designing, so the design serves the message — not the other way round.',
        p: ['Sitemap and page wireframes agreed up front', 'Headlines written for your customers, not for your company', 'Proof built in: work, process, reviews, certificates'],
      },
      {
        t: 'Design that feels premium',
        d: 'Custom design in your brand — no stretched templates. Every section is designed for the phone first, then scaled up.',
        p: ['Mobile layouts designed first, desktop second', 'Type, spacing and motion tuned by hand', 'Real content in the designs — no lorem-ipsum surprises'],
      },
      {
        t: 'Built fast, built right',
        d: 'Speed is a feature. Pages are built to load quickly on mobile data and to be found on Google.',
        p: ['Images compressed and served at the right size', 'SEO basics: titles, descriptions, sitemap, clean URLs', 'Tested on real Android phones and iPhones before launch'],
      },
      {
        t: 'Launch, then keep improving',
        d: 'We connect the site to your ads and tracking, launch it, and keep watching what visitors actually do.',
        p: ['Analytics and conversion tracking installed', 'WhatsApp and call taps tracked as leads', 'Fixes and improvements based on real data'],
      },
    ],
    details: [
      'Buttons big enough for thumbs',
      'Phone fields that open the number keypad',
      'Every image compressed and sized for its slot',
      'A title and description written for every page',
      'WhatsApp chat that opens with a ready-made message',
      'Checked on Android and iPhone, not just a laptop',
      'Contrast that stays readable in bright sunlight',
      'Broken links and redirects checked before launch',
    ],
    deliver: ['Business websites and landing pages', 'Page structure, copy direction and design', 'Mobile-first build', 'SEO-ready setup and Google indexing', 'Analytics, WhatsApp and lead tracking', 'Launch support and post-launch fixes'],
    faq: [
      { q: 'How long does a website take?', a: 'It depends on the number of pages and how ready your content is. You get a clear timeline after the first call — and we stick to it.' },
      { q: 'Will it work well on phones?', a: 'It’s designed for phones first. Most of your visitors are on mobile, so that’s where we start.' },
      { q: 'Can I update it myself?', a: 'If you’ll need to change things often, we build it that way. We’ll recommend the right setup on the call.' },
      { q: 'Do you help with the domain and hosting?', a: 'Yes — we can set up your domain, hosting and business email, or work with what you already have.' },
    ],
  },

  video: {
    kicker: 'Service 05 / 05',
    lede: 'Reels, ad films and product videos cut for the first three seconds. Hooks, captions, motion graphics and sound — edited frame by frame for people who scroll fast.',
    belief: 'People decide in *three seconds* whether to keep watching. We edit every frame like the video depends on it — because it does.',
    steps: [
      {
        t: 'Purpose before the timeline',
        d: 'Should this video stop the scroll, explain a product or close a sale? The goal decides the length, pace and structure.',
        p: ['Platform and placement decided first: Reels, Shorts, YouTube or ads', 'Audience and message locked before editing', 'Reference videos agreed, so the style is clear on both sides'],
      },
      {
        t: 'Hook-first structure',
        d: 'We find the strongest moment in your footage and open with it. The first three seconds get more attention than the rest of the edit.',
        p: ['Several opening hooks cut and compared', 'Built as hook → value → proof → call to action', 'Slow starts and dead air cut ruthlessly'],
      },
      {
        t: 'Edit for sound-off viewing',
        d: 'Most people watch on mute. Captions and on-screen text carry the story on their own.',
        p: ['Captions styled in your brand and timed to the speech', 'Key text kept inside each platform’s safe zones', 'Motion graphics that explain, not decorate'],
      },
      {
        t: 'Sound, colour and polish',
        d: 'The finishing work viewers don’t consciously notice — but feel instantly.',
        p: ['Colour corrected for one consistent look', 'Audio cleaned, levelled and mixed with music', 'Trending audio used where it helps the video'],
      },
      {
        t: 'Delivered for every format',
        d: 'One edit, cut properly for every place it will run — not a single file stretched to fit.',
        p: ['9:16, 1:1 and 16:9 versions where needed', 'Cover frames designed for your profile grid', 'Every export watched on a phone before delivery'],
      },
    ],
    details: [
      'The hook lands in the first three seconds, not the last',
      'Captions kept clear of the like and comment buttons',
      'Cuts timed to the beat of the music',
      'Loudness levelled so no clip blasts',
      'Your brand fonts and colours in every caption',
      'Cover frames that make your grid look planned',
      'Colour matched across different phones and cameras',
      'Every export watched start to finish before it’s sent',
    ],
    deliver: ['Reels and Shorts', 'Ad films and brand videos', 'Product and explainer videos', 'Captions, subtitles and motion graphics', 'Sound design and colour correction', 'Exports for every platform and ratio'],
    faq: [
      { q: 'Can I send footage shot on my phone?', a: 'Yes. Good phone footage edits beautifully — and we’ll tell you exactly what to shoot so the next batch is even better.' },
      { q: 'How do revisions work?', a: 'We agree the style up front with reference videos, so revisions are about polishing, not starting again.' },
      { q: 'Can we get a monthly batch of Reels?', a: 'Yes. Many brands take a monthly pack so their page and their ads always have something fresh.' },
      { q: 'Do you edit ads as well as organic content?', a: 'Both. Ad edits are cut tighter and built around a single action; organic edits are built to be watched to the end and shared.' },
    ],
  },

  eco: {
    kicker: 'For enterprises',
    lines: ['Online', 'Presence', 'Ecosystem'],
    lede: 'For factories, developers and growing brands that are big offline but scattered online. We design, build and run your entire online presence as one connected system — one team, one brand, one report.',
    belief: 'Your customer doesn’t see channels. They see *one company* — on Instagram at night, on Amazon at lunch, on your website before the meeting and on the box at their door. We make every one of those moments feel like you.',
    steps: [
      {
        t: 'Audit every touchpoint',
        d: 'We map everywhere your business shows up online today and score each place against your competitors.',
        p: ['Google profile, website, socials, marketplaces and WhatsApp reviewed', 'Brand consistency, speed and trust signals scored', 'A priority list: what’s costing you business right now'],
      },
      {
        t: 'Build the foundation',
        d: 'One brand system and one home base that everything else points back to.',
        p: ['Brand kit: logo use, colours, fonts and tone of voice', 'A fast website as the hub for ads, search and your sales team', 'Tracking set up once, across every channel'],
      },
      {
        t: 'Switch on the channels',
        d: 'Ads, marketplaces, content and packaging go live as one plan, each with a clear job.',
        p: ['Social ads bring new buyers in', 'The website and marketplaces turn them into customers', 'Video and packaging make the brand stick'],
      },
      {
        t: 'Run it like a department',
        d: 'We work as your digital team: planned monthly, checked daily, reported clearly to management.',
        p: ['Monthly plan and content calendar agreed in advance', 'One point of contact for everything digital', 'One report across every channel — not five different ones'],
      },
      {
        t: 'Compound what works',
        d: 'Every month, time and budget move towards what’s performing, so the whole system gets stronger.',
        p: ['Budget shifted between channels on real numbers', 'Winning creatives reused across ads, listings and the site', 'Quarterly review of the whole ecosystem with leadership'],
      },
    ],
    roles: {
      ads: 'The traffic engine — brings the right people in.',
      ecom: 'The storefront — where buyers already shop.',
      pack: 'The handshake — your brand in their hands.',
      web: 'The home base — where trust is built and leads land.',
      video: 'The voice — what makes people stop and remember.',
    },
    details: [
      'One brand kit, used the same way on every channel',
      'Every lead tagged with where it came from',
      'Same name, address and phone across Google, Maps and directories',
      'Content planned a month ahead, approved in one go',
      'One monthly report written for management',
      'One point of contact for everything digital',
      'Accounts, domains and files always in your company’s name',
      'Access handed over cleanly — nothing lost if people change',
    ],
    deliver: ['Full digital audit and roadmap', 'Brand kit and website', 'Social media ads and content', 'Marketplace store management', 'Packaging and product visuals', 'Monthly management reporting'],
    faq: [
      { q: 'Do we have to take all five services?', a: 'No. Most companies start with what hurts most and add the rest as the system grows. The plan is built around your priorities.' },
      { q: 'We already have an agency for one channel. Can you work alongside them?', a: 'Yes. We plug into what’s already working and take over the rest, keeping one brand and one report across all of it.' },
      { q: 'Who owns the accounts and files?', a: 'You do. Ad accounts, marketplace stores, domains and design files stay in your company’s name.' },
      { q: 'Is this only for big companies?', a: 'It’s built for businesses that have outgrown doing digital in bits — whether that’s one factory or ten locations.' },
    ],
  },
}
