# Get Home Realty — Website

A premium, responsive, SEO-friendly multi-page website for the Get Home Realty real estate brokerage, covering Canada, Hyderabad and Visakhapatnam.

Built as a **static site** (plain HTML/CSS/JS) — no build step, no framework, no API keys. Open `index.html` in any browser or drop the folder onto any static host (Netlify, Vercel, GitHub Pages, S3, cPanel, etc.).

---

## 1. Pages (13)

| File | Purpose |
|---|---|
| `index.html` | Home — animated hero, quick inquiry, services, featured properties, investors highlight, city previews, why-choose, testimonials |
| `about.html` | Who we are, mission, vision, why choose us, team |
| `services.html` | Services overview + city desks |
| `hyderabad.html` | Hyderabad services, listings, **interactive map (hover a pin to preview)** |
| `visakhapatnam.html` | Visakhapatnam services, listings, **interactive map (hover a pin to preview)** |
| `property-detail.html` | Single-listing detail (reads `?id=` from URL; opened from city listing cards/maps) |
| `buyers.html` | Buyer guidance, 6-step process, inquiry |
| `sellers.html` | Seller strategy, 7-step process, free evaluation |
| `investors.html` | Investor guidance, focus areas, process, investor inquiry |
| `join.html` | Agent recruiting, benefits, application + resume upload |
| `contact.html` | Contact info, form, **office map** |

---

## 2. Architecture

Shared chrome (top bar, header, navigation, mobile drawer, footer, WhatsApp button) is **injected by JavaScript** from a single template in `assets/js/main.js` into two placeholders present on every page:

```html
<div data-gh-header></div>
...
<div data-gh-footer></div>
```

Edit the header/footer/nav **once** in `main.js` and it updates across all 13 pages. Each page still keeps its own static `<title>`, meta description and `<h1>` for SEO.

### File tree
```
ghr/
├── *.html                  (13 pages)
├── assets/
│   ├── css/styles.css      (full design system — one file)
│   ├── js/
│   │   ├── data.js         (all property & project data — the "CMS")
│   │   ├── main.js         (header/footer/nav, forms, rendering, config)
│   │   └── maps.js         (interactive city maps)
│   └── img/                (empty — images load from Unsplash CDN)
└── README.md
```

---

## 3. Editing content

### Contact details (phone, email, WhatsApp, address)
One place: the `CONFIG` object at the top of `assets/js/main.js`. Updates the header, footer, contact page and WhatsApp button everywhere.

### Property listings
All listings live in `GHR_PROPERTIES` in `assets/js/data.js`. Each entry:

```js
{ id:'hyd-01', name:'...', city:'Hyderabad', area:'Gachibowli',
  type:'Apartment', deal:'Buy', price:9500000, priceLabel:'₹95 L',
  beds:3, baths:3, parking:2, size:'1,850 sq.ft', status:'available',
  tag:'Featured', lat:17.44, lng:78.34, desc:'...' }
```

Add/edit objects here and the home page, properties page, city pages, maps and detail pages all update automatically. `status:'sold'` greys the card and renders a grey map pin.

### Pre-construction projects
Edit `GHR_PRECON` in `data.js` (name, city, area, price, type, closing, deposit, tag, desc).

### Navigation
Edit the `NAV` array in `main.js`. Hyderabad & Visakhapatnam are intentionally nested under the **Services** dropdown only.

---

## 4. Maps

Uses **Leaflet + OpenStreetMap/CARTO tiles** — free, no Google API key required. Custom red teardrop pins match the brand. Loaded via CDN only on the three map pages (`hyderabad.html`, `visakhapatnam.html`, `contact.html`).

- City maps (`maps.js`): red pins, popups, side list synced to the map, filters for Area / Budget / Type / Available-Sold. **Hovering a pin opens its project preview**; clicking flies to it. Desktop = map beside cards; mobile = map above cards.
- **Project directory + details modal:** the curated project set lives in `GHR_DEVELOPERS` (`data.js`). Clicking a directory card — or **"View Details"** in a map popup — opens a full-screen project modal. The modal pulls rich content from `GHR_DETAILS` in `data.js`, an object keyed by project `id`. Each entry is optional and flexible:
  - `developer` (label override), `tagline`, `facts` (`[[label,value],…]` key facts grid)
  - `unitHead` + `unitRows` (a configurations table), `clubhouse` (text) or `clubLevels` (`[[level,facilities],…]`)
  - `amenities` (chips), `location` (`[[place,time],…]`), `specs` (bullets), `note` (footnote)
  - Projects with no `GHR_DETAILS` entry still open — the modal falls back to the basic fields. The modal also has a **Locate on map** button.
- **Gallery (3-image scroll) in the popup:** the top of the modal is a swipeable image carousel. Images come from `GHR_IMAGES` in `data.js` — an object keyed by project `id` whose value is an array of image URLs (`["url1","url2","url3"]`). With 2+ images the carousel shows prev/next arrows and dot indicators and supports touch-swipe / scroll; with 1 image it shows a single still; with no entry it falls back to a stock photo. To add or change a project's photos, just edit its array in `GHR_IMAGES`. (Tip: for guaranteed loading you can download the images into `assets/img/` and point the URLs there, instead of hot-linking the builders' sites.)
- To swap to Google Maps later, replace the Leaflet init in `maps.js` — the data layer stays the same.

## 4a. WhatsApp chat widget

A floating WhatsApp widget (bottom-right) is built into the shared footer (`main.js`) and appears on every page: dark-green header with logo + "Get Home Realty", a greeting bubble, and a green **Start Chat** button that opens WhatsApp with a pre-filled message. It starts expanded, can be closed with the × (state remembered via `localStorage`), and re-opened from the round launcher. The number and message come from `CONFIG.whatsapp` in `main.js` — update the number there. Styles live under "WhatsApp chat widget" in `styles.css`.

## 4b. Home hero animation

The home hero uses a CSS entrance animation (staggered fade-up of the headline/subhead/CTAs plus a slow background zoom). It's enabled by the `hero--animated` class on the hero section in `index.html` and respects `prefers-reduced-motion`.

---

## 5. Forms

All forms use `class="gh-form"` and are **validated client-side** (required fields, email and phone format) by `main.js`. On success they show an inline confirmation message.

**They do not yet submit anywhere** — there is no backend. To make them live, in `main.js` find the form `submit` handler and POST the form data to your endpoint (e.g. Formspree, a serverless function, or your CRM). The marked success block is where to trigger on a successful response.

---

## 6. SEO & performance

- Proper heading hierarchy (one `<h1>` per page, `<h2>`/`<h3>` below).
- Unique `<title>` and meta description per page.
- Semantic landmarks (`<header>`, `<nav>`, `<section>`, `<footer>`).
- Fonts preconnected; images use `auto=format` + sized CDN requests.
- Analytics-ready: drop your Google Analytics / GTM snippet before `</body>` (or into `main.js`) once.

### Recommended before launch
- Replace Unsplash CDN images with optimized, self-hosted images in `assets/img/` and add descriptive `alt` text.
- Add `sitemap.xml` and `robots.txt`.
- Wire forms to a real endpoint (see §5).
- Replace placeholder phone/email/social URLs with live ones.
- Set real office coordinates in `contact.html` if Jubilee Hills location differs.

---

## 7. Branding

- **Colors:** cherry red `#C8102E` (primary/CTA), white, near-black ink `#14110F`, light grey mist `#F4F5F7`, restrained brass-gold `#B08D57` accent.
- **Fonts:** Fraunces (display headings) + Inter (body), via Google Fonts.
- **Motif:** red location pin used in eyebrows, nav submenu and map markers.

---

*Footer disclaimer (included on every page):* "Information displayed on this website is for general information purposes only and should be verified independently. Property availability, pricing, and details are subject to change without notice."
