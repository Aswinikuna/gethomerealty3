# Get Home Realty — Admin panel

A separate Next.js app that adds an admin panel (`/admin`), a content API and lead
capture to the existing static website. The public site's HTML/CSS/JS stays at the
repository root and keeps its design. This app serves those files unchanged and fills
in content from the database.

```
/                      → the existing public site (../*.html, ../assets), copied into public/ at build
/admin                 → admin panel (login required)
/api/admin/*           → admin API (login + CSRF token required)
/api/auth/*            → login, logout, forgot / reset password
/api/public/content.js → published content for the public pages (cached 60 s at the CDN)
/api/public/leads      → receives every website enquiry form
```

## Local development

```bash
cd admin-app
npm install
cp .env.example .env.local      # then set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters)
npm run db:seed                  # creates tables, imports today's site content, creates the admin
npm run dev                      # http://localhost:3000 — site at /, admin at /admin
```

- No database install needed: without `DATABASE_URL` the app uses embedded PostgreSQL
  (PGlite) stored in `admin-app/.data/`. Stop `npm run dev` before running `db:seed`,
  `db:migrate` or `admin:create`, because only one process can open that database at a time.
- Without Supabase settings, uploads are saved to `public/uploads/` (development only).
- Without `RESEND_API_KEY`, password-reset links are printed in the terminal instead of emailed.
- `npm run dev` copies the public site in first. After editing a root `*.html` or
  `assets/` file, restart it or run `npm run sync-site`.

## Production (Vercel + Supabase)

1. **Supabase**: create a project.
   - Copy the connection string from **Connect → Transaction pooler**. This is `DATABASE_URL`.
   - In **Storage**, create a **public** bucket named `media`. Optionally limit it to
     `image/*` and `application/pdf` with a 30 MB file-size limit.
   - Copy **Project URL** and the **service_role** key from **Settings → API** (server-only, never in browser code).
2. **Database**: run once from your machine (and again after any schema change):
   ```bash
   DATABASE_URL=postgresql://… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:seed
   ```
3. **Vercel**: import the repository and set **Root Directory = `admin-app`** (Next.js is
   detected automatically). Under **Settings → Environment Variables**, add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Supabase transaction-pooler connection string |
   | `SUPABASE_URL` | `https://<project>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret) |
   | `SUPABASE_BUCKET` | `media` |
   | `SITE_URL` | `https://www.gethomerealty.ca` (used in reset emails) |
   | `RESEND_API_KEY`, `MAIL_FROM` | for password-reset emails |

   Leave "Include files outside the root directory" on (the default). The build copies
   `../*.html` and `../assets` into the app.
4. Point the domain at Vercel. The public URLs (`/index.html`, `/hyderabad.html`, …) stay the same.

> **Never upload `admin-app/` to a static host.** If the site is ever deployed again as
> plain files (cPanel, Netlify drop, etc.), upload only the root `*.html` and `assets/`.
> Those still work alone: they show their built-in content, but forms can't save leads
> without this app.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Copies the site in, starts the dev server |
| `npm run build` / `start` | Production build / server |
| `npm run db:migrate` | Applies `db/schema.sql` (idempotent) |
| `npm run db:seed` | Migrates, then imports the current site content into empty tables and creates the first admin |
| `npm run admin:create` | Creates an admin, or resets an existing admin's password and unlocks it, from `ADMIN_EMAIL` / `ADMIN_PASSWORD` |
| `npm run typecheck` | TypeScript check |

## How the public site gets its content

Every page loads two extra scripts between `data.js` and `main.js`:

```html
<script src="assets/js/data.js"></script>
<script src="/api/public/content.js"></script>   <!-- sets window.GHR_CMS -->
<script src="assets/js/cms.js"></script>         <!-- applies it -->
<script src="assets/js/main.js"></script>
```

`cms.js` overrides the built-in data only where the database has content:

| Admin section | Where it appears |
|---|---|
| Homepage → hero, stats | `index.html` hero and figures band (`data-cms="…"` hooks) |
| Homepage → top bar, navigation | header on every page (`main.js`) |
| Homepage → about | “Who We Are” on `about.html` |
| Properties (active) | `GHR_PROPERTIES` → `property-detail.html` |
| Projects (published, with lat/lng) | `GHR_DEVELOPERS` / `GHR_IMAGES` / `GHR_DETAILS` → city maps and directory |
| Projects (featured) | homepage “Featured Properties” collage |
| Reviews (approved + active) | homepage “Client Stories” (replaces the built-in stories once any exist) |
| Videos (active) | homepage video section (hidden while there are none) |
| Agents (active) | “Meet your advisors” on `about.html` |
| Contact details, social media | header, footer, contact page, WhatsApp widget, map modal |
| Settings | logo, favicon, homepage SEO title/description, Google Analytics, Meta Pixel |

If `content.js` can't load (the site opened as plain files, or the API is down), every page
keeps its built-in content. Forms then show an error with the phone number instead of
pretending the message was sent.

## Security

- Passwords hashed with bcrypt (cost 12). Admin credentials exist only in the database and
  environment variables, never in front-end code.
- Sessions: a random 256-bit token in an `HttpOnly`, `SameSite=Lax` cookie (`__Host-`, `Secure`
  in production). Only its SHA-256 is stored, and sessions expire after 12 hours. Logout and password
  reset revoke them server-side.
- Every `/admin` page and `/api/admin` call checks the session against the database. `proxy.ts`
  also redirects or blocks requests that have no session cookie at all.
- CSRF: state-changing admin requests need the per-session token (`x-csrf-token`) and
  a same-origin `Origin` header.
- Login: generic error messages, constant-time handling of unknown emails, the account locks for
  15 minutes after 5 failed attempts, and a per-IP rate limit. Password reset uses a single-use
  token that expires in 1 hour, with the same response whether or not the email exists.
- Input validation with zod on every endpoint. URLs must be `https://` or site paths
  (`javascript:` and `data:` are rejected). Text from the admin is neutralised before the public pages render it.
- Uploads: file type is checked from the contents (not the extension); images are re-encoded to WebP
  (max 2000 px, metadata stripped). PDFs must be real PDFs. Size limits: 10 MB per image, 30 MB per PDF.
- Public lead form: same-origin, or an address listed in `PUBLIC_FORM_ORIGINS` (plus any localhost
  page in development, so local previews such as VS Code Live Server still save enquiries). Also a
  honeypot field, a per-IP rate limit and size caps. The form tries its own site's `/api` first, then
  `CONFIG.leadsApi` (`main.js`), then `http://localhost:3000` when previewed locally.
- Supabase: row-level security is enabled on every table with no policies, so the public `anon`
  key can't read or write anything. The app connects with the server-side connection string.
- Admin responses send `X-Frame-Options: DENY`, `noindex`, `no-store`.
- Roles: `admin` (everything) and `editor` (content and leads; cannot change Settings or delete leads).

## SEO

Every public page is now delivered by the server, so search metadata is in the **page source**
(not added later by JavaScript).

| URL | What it is |
|---|---|
| `/`, `/about.html` … | Existing pages, unchanged except for a generated `<head>` (title, description, robots, canonical, Open Graph, Twitter/X, JSON-LD). Templates are copied to `site-pages/` by `sync-site`. |
| `/properties/<slug>` | Active properties. `property-detail.html?id=<slug>` 301-redirects here. |
| `/projects/<slug>` | Published projects (also uses the project's facts / amenities / plans from `data.js`). |
| `/agents/<slug>` | Active agents. |
| `/real-estate/<slug>` | Published location pages (admin → **Locations**). |
| `/videos/<slug>` | Active videos. |
| `/projects/<slug>/<config>` | One configuration of a project, e.g. `/projects/hyd-rajapushpa-pristinia/3-bhk`: that BHK's floor plans, sizes, carpet, towers, facing, price-sheet rows, amenities, enquiry form, `FloorPlan` structured data. Exists only when the project has a floor plan or unit-table row for it (logic in `lib/seo/configs.ts`). |
| `/real-estate/<location>/<config>` | Every published project offering a configuration in a location, e.g. `/real-estate/hyderabad/3-bhk`. Exists only when 2+ projects offer it. |
| `/favicon.ico` | Redirects to the site icon (`assets/img/ghr-icon-*.png`, made from the square GHR logo; Settings → Favicon overrides it). |
| `/sitemap.xml` | Published **and** indexable pages only, at their canonical URLs, with `lastmod`. |
| `/robots.txt` | Blocks `/admin`, `/api/admin/`, `/api/auth/`; points to the sitemap. |

- **Fields:** each property, project, agent, video and location has the same SEO column set (`seo_title`,
  `meta_description`, `canonical_url`, `focus_keyword`, `secondary_keywords`, `og_*`, `image_alt_text`,
  `is_indexed`, `is_followed`). They're defined once in `seoFields()` (`lib/resources.ts`). The homepage
  has them under Homepage → SEO, and site-wide defaults are under Settings → SEO.
- **Fallbacks:** an empty SEO field uses the automatic value from `lib/seo/suggest.ts` (shown as the
  placeholder in the editor). "Generate SEO suggestion" only proposes values; nothing is applied until
  you click **Use** and save.
- **Structured data** (`lib/seo/schema.ts`): Organization, WebSite, RealEstateAgent (brokerage), WebPage,
  BreadcrumbList, RealEstateListing (+ Offer only when a public price exists), ApartmentComplex/Residence,
  Person (agents), VideoObject, FAQPage. It's built only from real data. There are no ratings or reviews.
- **Site-wide switch:** Settings → Default robots = `noindex` marks every page noindex and empties the
  sitemap. Use it for a staging copy only.
- Set **Settings → Canonical base URL** to the live address (e.g. `https://www.gethomerealty.ca`).
  Until it's set, `SITE_URL` (or the request host) is used.
- **SEO score** is a plain checklist of things we can actually check (lengths, keyword use, alt text,
  slug, OG image, word count, duplicates). There are no invented metrics.

## Project presentation popup

The project popup on the city maps (`assets/js/maps.js`) is a slide deck with one slide per topic:
Overview · Details · Floor Plans · Amenities · Master Plan · Location · Availability. A slide with
nothing to show (e.g. no floor plans) is skipped. Navigation uses the topic tabs, Previous / Next,
the ← → keys or a swipe, with an "n / N" counter.

- **Data:** the popup opens instantly with the map data. Only then does it fetch
  `/api/public/projects/<slug>` (published projects, public columns only). Where a field is empty
  it falls back to `GHR_DETAILS` in `data.js`, so it also works as plain static files.
- **Performance:** each slide's images (floor plans, master plan, amenity photos) load when that
  slide is reached, plus the next one ahead. The location map starts on the Location slide.
- **Admin:** Projects → edit has tabs 1–8 matching the slides (floor-plan, amenity, detail and
  connectivity editors support add / reorder / delete), plus Gallery & Media, Visibility and SEO.
  "Internal inventory notes" and the builder/brokerage prices are admin-only and never published.
- `npm run db:seed` imported each project's existing `data.js` content (facts, floor plans
  matched to the builder's unit table, site plans, amenities, travel times) into these fields. It
  only fills empty fields, so it never overwrites admin edits. Clubhouse levels, specifications,
  pros/cons and price sheets are still read from `data.js`.
- **Maps:** CARTO basemaps now require an API key (tiles show "API KEY REQUIRED"). The popup's map
  uses Esri's free light-grey canvas instead.

## Price visibility rule

Projects and properties each have three prices:

| Field | Who sees it |
|---|---|
| Builder price | Admin role only (admin API) |
| Brokerage price | Admin role only (admin API). **Confidential** |
| Public display price (+ optional public price text) | Everyone. The only price on the website |

- The edit form shows Builder, Brokerage, **Difference** (= Builder − Brokerage) and **Savings %**,
  plus a preview of exactly what visitors will see (e.g. “Starting from ₹1.75 Cr”).
  “Use brokerage price as public price” copies the value only when you choose to publish it.
- The public content API selects an explicit allow-list of columns (`lib/public-content.ts`). The
  internal prices are never read for the public API, so they can't appear in page source,
  JS variables, HTML attributes or network responses.
- Fields marked `confidential: true` in `lib/resources.ts` are removed from admin API responses for
  the `editor` role, and ignored if an editor sends them.

## Limits to know

- The in-memory rate limiter is per server instance. Login lockout is stored in the database and
  holds across instances.
- Join-page résumé files are not uploaded. The lead records the file name so you can ask for it by email.
- Project fields that aren't in the admin form yet (RERA facts, unit tables, cost sheets) still come
  from `GHR_DETAILS` in `assets/js/data.js`.
