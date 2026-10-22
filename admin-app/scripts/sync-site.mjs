// Copies the static public site into the app:
//   ../*.html  → site-pages/   (served by app/[page]/route.ts with the SEO <head> injected)
//   ../assets  → public/assets (served as static files)
// The originals at the repo root stay the source of truth — edit those, never the
// copies (both are gitignored).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '..');
const pub = path.resolve(process.cwd(), 'public');
const pages = path.resolve(process.cwd(), 'site-pages');
fs.mkdirSync(pub, { recursive: true });

// Pages used to be copied into public/; remove any left there so they can't bypass the SEO renderer.
for (const f of fs.readdirSync(pub)) if (f.endsWith('.html')) fs.rmSync(path.join(pub, f));
fs.rmSync(pages, { recursive: true, force: true });
fs.mkdirSync(pages, { recursive: true });
fs.rmSync(path.join(pub, 'assets'), { recursive: true, force: true });

const html = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
for (const f of html) fs.copyFileSync(path.join(root, f), path.join(pages, f));
fs.cpSync(path.join(root, 'assets'), path.join(pub, 'assets'), { recursive: true });

console.log(`sync-site: copied ${html.length} pages into site-pages/ and assets/ into public/`);
