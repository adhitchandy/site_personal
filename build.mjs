// Builds adhitchandy.com from the files in content/ into dist/.
// Run:  npm install   (once)   then   npm run build
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import exifReader from 'exif-reader';

const ROOT = process.env.SITE_ROOT || path.dirname(fileURLToPath(import.meta.url));
const C = (...p) => path.join(ROOT, 'content', ...p);
const OUT = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, '.cache');
const site = JSON.parse(fs.readFileSync(C('site.json'), 'utf8'));
/* The photographs live outside the site folder. photoRoot may start with ~ for the home folder, so the site folder can sit anywhere;
   PHOTO_ROOT in the environment overrides it for a one-off build from elsewhere. */
const PHOTOS = path.resolve(ROOT, String(process.env.PHOTO_ROOT || site.photoRoot || '..').replace(/^~(?=$|\/)/, os.homedir()));
const IMG_EXT = /\.(jpe?g|png|tiff?|webp)$/i;
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const warn = m => console.warn('  ! ' + m);
let missing = 0;
const lost = m => { missing++; warn(m); };
/* A heading that rises into place when its page opens. Each word is a small window: a short heading's letters come up through it one
   after another, a long heading's words come up whole. The heading keeps its plain text as its name for screen readers. */
function rise(text) {
  const t = String(text || '').trim(), byLetter = t.length <= 18; let n = 0;
  return `<span class="hr${byLetter ? '' : ' w'}" aria-hidden="true">${t.split(/\s+/).map(w => `<span class="hw">${byLetter ? [...w].map(ch => `<span class="hi" style="--n:${n++}">${esc(ch)}</span>`).join('') : `<span class="hi" style="--n:${n++}">${esc(w)}</span>`}</span>`).join(' ')}</span>`;
}
const h1 = text => `<h1 aria-label="${esc(text)}">${rise(text)}</h1>`;
/* a sentence that carries links, written as [words](address), read without them */
const plainText = s => String(s || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
/* a link shown by its handle, which is short enough not to break across two lines */
const handle = v => { const m = String(v).match(/^https?:\/\/(?:www\.)?([^/]+)\/?(.*?)\/?$/); if (!m) return v; const [, host, rest] = m; return /^(instagram|github|x|twitter|threads)\.[a-z]+$/.test(host) && rest && !rest.includes('/') ? '@' + rest : host === 'linkedin.com' && /^in\/[^/]+$/.test(rest) ? rest.slice(3) : host + (rest ? '/' + rest : ''); };

/* ---------- images ---------- */
function resolveSrc(src) {
  for (const base of [C(), PHOTOS, ROOT]) { const p = path.join(base, src); if (fs.existsSync(p)) return p; }
  return null;
}
function readExif(buf) {
  try {
    const e = exifReader(buf), I = e.Image || e.image || {}, P = e.Photo || e.exif || {};
    const mk = String(I.Make || '').replace(/ CORPORATION/i, '').trim(), md = String(I.Model || '').replace(new RegExp('^' + mk + '\\s*', 'i'), '').trim();
    const cam = mk ? (mk[0] + mk.slice(1).toLowerCase() + ' ' + md).trim() : '';
    const ss = P.ExposureTime, iso = P.ISOSpeedRatings ?? P.ISO ?? P.PhotographicSensitivity;
    const parts = [cam.replace(/^Fujifilm/i, 'Fujifilm').replace(/^Nikon/i, 'Nikon').replace(/^Sony/i, 'Sony')];
    if (P.FocalLength) parts.push(Math.round(P.FocalLength) + ' mm');
    if (P.FNumber) parts.push('f/' + (+P.FNumber).toFixed(1).replace(/\.0$/, ''));
    if (ss) parts.push(ss >= 1 ? Math.round(ss * 10) / 10 + ' s' : '1/' + Math.round(1 / ss) + ' s');
    if (iso) parts.push('ISO ' + (Array.isArray(iso) ? iso[0] : iso));
    return parts.filter(Boolean).join(' · ');
  } catch { return ''; }
}
/* A picture's address is made from its file, so a browser may keep it for good (see _headers at the end). If the sizes or the
   quality below are ever changed, put something in RECIPE, e.g. 'v2': every picture then gets a new address and is made again. */
const RECIPE = '';
async function photo(src, extra = {}) {
  const abs = resolveSrc(src);
  if (!abs) { lost('missing image: ' + src); return null; }
  const st = fs.statSync(abs);
  const id = crypto.createHash('sha1').update(src + st.size + Math.round(st.mtimeMs) + RECIPE).digest('hex').slice(0, 12);
  const metaFile = path.join(CACHE, id + '.json'), big = path.join(OUT, 'img', id + '.jpg'), small = path.join(OUT, 'img', id + '-s.webp');
  if (!(fs.existsSync(metaFile) && fs.existsSync(big) && fs.existsSync(small))) {
    const m = await sharp(abs, { failOn: 'none' }).metadata();
    const base = sharp(abs, { failOn: 'none' }).rotate();
    const info = await base.clone().resize(2200, 2200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(big);
    await base.clone().resize(960, 960, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toFile(small);
    fs.writeFileSync(metaFile, JSON.stringify({ w: info.width, h: info.height, exif: m.exif ? readExif(m.exif) : '' }));
    process.stdout.write('.');
  }
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  if (!meta.sig) {   /* a 16×16 grey thumbnail, used to recognise the same picture arriving twice */
    meta.sig = (await sharp(small).resize(16, 16, { fit: 'fill' }).greyscale().raw().toBuffer()).toString('base64');
    fs.writeFileSync(metaFile, JSON.stringify(meta));
  }
  if (!meta.c) {     /* the picture's average colour: its frame waits in that colour until the picture has arrived */
    const ch = (await sharp(small).stats()).channels, px = q => Math.round((ch[Math.min(q, ch.length - 1)] || { mean: 128 }).mean).toString(16).padStart(2, '0');
    meta.c = '#' + px(0) + px(1) + px(2); fs.writeFileSync(metaFile, JSON.stringify(meta));
  }
  return { id, src, ...meta, s: '/img/' + id + '-s.webp', l: '/img/' + id + '.jpg', title: '', ...extra };
}
/* A screen of a piece of software, shown on its project page. It is read, not only looked at, so it is kept sharper than a
   photograph's small copy, and it is made in two sizes: one for small windows, one for large. */
async function screen(src) {
  const abs = resolveSrc(src); if (!abs) { lost('missing image: ' + src); return null; }
  const st = fs.statSync(abs), id = crypto.createHash('sha1').update('screen' + src + st.size + Math.round(st.mtimeMs) + RECIPE).digest('hex').slice(0, 12);
  const metaFile = path.join(CACHE, id + '.json'), m = path.join(OUT, 'img', id + '-m.webp'), x = path.join(OUT, 'img', id + '-x.webp');
  let meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : null;
  if (!(meta && meta.xw && fs.existsSync(m) && fs.existsSync(x))) {
    const base = sharp(abs, { failOn: 'none' }).rotate();
    const a = await base.clone().resize(1680, 1680, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toFile(m);
    const b = await base.clone().resize(2400, 2400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toFile(x);
    const ch = (await sharp(m).stats()).channels, px = q => Math.round((ch[Math.min(q, ch.length - 1)] || { mean: 128 }).mean).toString(16).padStart(2, '0');
    meta = { w: a.width, h: a.height, xw: b.width, c: '#' + px(0) + px(1) + px(2) };
    fs.writeFileSync(metaFile, JSON.stringify(meta)); process.stdout.write('.');
  }
  return { id, ...meta, m: '/img/' + id + '-m.webp', x: '/img/' + id + '-x.webp' };
}
/* The screens in a folder, in the order of their names. A screen may come twice, as name-light.png and name-dark.png, one for each
   theme of the site; a screen that comes once is used for both. */
async function screensIn(dir) {
  const by = new Map();
  for (const f of expand(dir)) {
    const m = path.basename(f).match(/^(.*?)(?:[-_ ](light|dark))?\.[^.]+$/i); if (!m) continue;
    const e = by.get(m[1]) || {}, sc = await screen(f); if (!sc) continue;
    if (m[2]) e[m[2].toLowerCase()] = sc; else { e.light = e.light || sc; e.dark = e.dark || sc; }
    by.set(m[1], e);
  }
  return [...by.keys()].sort().map(k => { const e = by.get(k), name = k.replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ').trim(); return { name: name ? name[0].toUpperCase() + name.slice(1) : '', light: e.light || e.dark, dark: e.dark || e.light }; });
}
/* A project may show itself at work. In its file a line "@screens: folder" names the folder of its screens. The sentence under that
   line is set large beside the screens, and a word in it written [like this](#3) calls the third screen. The list under the sentence
   gives each screen, in order, its name (in bold) and a line about it. A heading directly above the line, if there is one, is set
   small over the sentence. Everything else in the file is the text that follows further down the page. */
function stageIn(body) {
  const L = body.split('\n'), at = L.findIndex(l => /^@screens:\s*\S/.test(l)); if (at < 0) return null;
  let top = at, label = '';
  { let q = at - 1; while (q >= 0 && !L[q].trim()) q--; if (q >= 0 && /^## /.test(L[q])) { label = L[q].slice(3).trim(); top = q; } }
  let i = at + 1; const walk = [], items = [], item = l => /^[-*] /.test(l || '');
  while (i < L.length && !item(L[i]) && !/^[#@]/.test(L[i])) walk.push(L[i++]);
  while (i < L.length && (item(L[i]) || (!L[i].trim() && item(L[i + 1])))) { if (L[i].trim()) items.push(L[i].replace(/^[-*] /, '')); i++; }
  return { dir: L[at].replace(/^@screens:\s*/, '').trim(), label, walk: walk.join(' ').replace(/\s+/g, ' ').trim(), before: L.slice(0, top).join('\n'), after: L.slice(i).join('\n'),
    items: items.map(t => { const m = t.match(/^\*\*(.+?)\*\*\s*(.*)$/); return m ? { title: m[1].replace(/[.:]\s*$/, ''), text: m[2] } : { title: '', text: t }; }) };
}
/* how alike two pictures are, from −1 to 1; the same frame in two edits scores above 0.96 */
function alike(a, b) {
  if ((a.w >= a.h) !== (b.w >= b.h)) return 0;
  const x = Buffer.from(a.sig, 'base64'), y = Buffer.from(b.sig, 'base64'), n = x.length;
  let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; } mx /= n; my /= n;
  let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { const p = x[i] - mx, q = y[i] - my; sxy += p * q; sx += p * p; sy += q * q; }
  return sxy / (Math.sqrt(sx * sy) || 1);
}
const shown = [];   // every photograph already placed in a set
/* an entry can be a file, or a folder (all images in it, by name; "X 1.jpg" is skipped when "X.jpg" exists) */
function expand(entry) {
  const abs = resolveSrc(entry);
  if (!abs) { lost('missing: ' + entry); return []; }
  if (!fs.statSync(abs).isDirectory()) return [entry];
  const names = fs.readdirSync(abs).filter(f => IMG_EXT.test(f) && !f.startsWith('.')).sort();
  return names.filter(f => { const m = f.match(/^(.*) \d+(\.[^.]+)$/); return !(m && names.includes(m[1] + m[2])); }).map(f => path.join(entry, f));
}

/* ---------- tiny markdown ---------- */
function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/); const data = {};
  if (m) for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return { data, body: m ? text.slice(m[0].length) : text };
}
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\[([^\]]+)\]\((https?:[^)\s]+|\/[^)\s]*|#[\w-]+)(?: &quot;(.+?)&quot;)?\)/g, (m, t, u, n) => n ? `<a class="nt" href="${u}" title="${n}" data-note="${n}">${t}</a>` : `<a href="${u}">${t}</a>`);   /* [words](address "a note that shows on hover") */
/* the sentence that ends the About page: its closing "write to me" is the way to write, set on a moving ground of the site's colours,
   its letters flicking through the site's faces now and then (site.js); without an address, or without those words, it stays a sentence */
const reach = t => { const h = inline(t), m = site.email && h.match(/write to me(?=[.!]?\s*$)/i); if (!m) return h;
  const w = m[0]; return h.slice(0, m.index) + `<a class="wtm" href="mailto:${esc(site.email)}" aria-label="${esc(w)}: ${esc(site.email)}"><span class="wb">${w}</span><span class="wf f0" aria-hidden="true">${w}</span></a>` + h.slice(m.index + w.length); };
/* words wrapped one by one, so that a sentence can arrive in the order it is read */
let lwN = 0; const stagger = html => { lwN = 0; return html.replace(/(<[^>]+>)|([^\s<]+)/g, (m, tag, w) => tag || `<span class="lw" style="--n:${lwN++}">${w}</span>`); };
function md(text) {
  return text.trim().split(/\n\s*\n/).map(b => {
    b = b.trim(); if (!b) return '';
    if (b.startsWith('### ')) return '<h3>' + inline(b.slice(4)) + '</h3>';
    if (b.startsWith('## ')) return '<h2>' + inline(b.slice(3)) + '</h2>';
    if (b.startsWith('> ')) return '<blockquote>' + inline(b.replace(/^> ?/gm, '')) + '</blockquote>';
    if (/^- /.test(b)) return '<ul>' + b.split('\n').map(l => '<li>' + inline(l.replace(/^- /, '')) + '</li>').join('') + '</ul>';
    return '<p>' + inline(b.replace(/\n/g, ' ')) + '</p>';
  }).join('\n');
}

/* ---------- shell ---------- */
const pages = [];
const ACG = `<span class="p"><span class="y"><span class="x"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon class="shape" points="50,3 99,97 1,97"/><text x="50" y="88">A</text></svg></span></span></span><span class="p"><span class="y"><span class="x"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="shape" cx="50" cy="50" r="48.5"/><text x="50" y="64">C</text></svg></span></span></span><span class="p"><span class="y"><span class="x"><svg viewBox="0 0 100 100" aria-hidden="true"><rect class="shape" x="1.5" y="1.5" width="97" height="97"/><text x="50" y="64">G</text></svg></span></span></span>`;
let NAV = [];
/* a link that leaves the site opens in a tab of its own, so the site stays open where it was. It is written into the page itself,
   so it holds before the script has run and without it; what lies inside a script (the data of a page) is left alone. */
const siteHost = (() => { try { return new URL(site.url).host.replace(/^www\./, ''); } catch { return ''; } })();
const outward = html => html.split(/(<script[\s\S]*?<\/script>)/).map((part, i) => i % 2 ? part : part.replace(/<a\b([^>]*?)\shref="(https?:\/\/[^"]+)"([^>]*)>/g, (m, a, href, b) => {
  let host = ''; try { host = new URL(href).host.replace(/^www\./, ''); } catch {}
  return !host || host === siteHost || /\starget=/.test(a + b) ? m : `<a${a} href="${href}"${b} target="_blank" rel="noopener">`; })).join('');
function shell({ url, title, desc, body, cls = '', og, file }) {
  const who = site.fullName || site.name, full = title ? title + ' — ' + who : who + (site.tagline ? ' — ' + site.tagline : '');
  const nav = NAV.map(n => `<a href="${n.url}"${url.startsWith(n.url) && (n.url !== '/' || url === '/') ? ' class="on" aria-current="page"' : ''}>${esc(n.label)}</a>`).join('');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc || site.description)}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(desc || site.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(site.url + url)}">
${og ? `<meta property="og:image" content="${esc(site.url + og)}">\n<meta name="twitter:card" content="summary_large_image">` : ''}
<meta name="theme-color" content="#0b0b0a">
<script>try{localStorage.removeItem("theme");var s=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark",t=(localStorage.getItem("theme2")||"").split("|");if((t[0]==="light"||t[0]==="dark")&&t[1]===s&&t[0]!==s)document.documentElement.dataset.theme=t[0];else localStorage.removeItem("theme2")}catch(e){}</script>
<script>try{var v=performance.getEntriesByType("navigation")[0];if(v?v.type==="reload":performance.navigation&&performance.navigation.type===1){history.scrollRestoration="manual";if(location.hash)history.replaceState(history.state,"",location.pathname+location.search);var w=1,z=function(){w&&(scrollX||scrollY)&&scrollTo(0,0)},q=function(){w=0};["wheel","touchstart","keydown","mousedown"].forEach(function(n){addEventListener(n,q,{capture:true,passive:true})});addEventListener("scroll",z,{passive:true});addEventListener("DOMContentLoaded",z);addEventListener("load",function(){z();setTimeout(function(){z();w=0;try{history.scrollRestoration="auto"}catch(e){}},1200)})}}catch(e){}</script>
<script>addEventListener("pagereveal",function(e){if(e.viewTransition&&(document.documentElement.classList.contains("entering")||/Apple/.test(navigator.vendor||"")))e.viewTransition.skipTransition()});try{var n=JSON.parse(sessionStorage.getItem("enter")||"null");sessionStorage.removeItem("enter");if(n&&Date.now()-n.t<10000&&location.pathname!=="/"){var d=document.documentElement,o=document.createElement("div"),m=function(c,t){var e=document.createElement(t||"div");e.className=c;o.appendChild(e);return e},u=String(n.img).replace(/[^\\w\\/.:-]/g,""),g=m("eb");d.classList.add("came");d.classList.add("entering");if(!(n.bar>0))d.classList.add("nobar");o.id="enter";o.dataset.img=u;o.dataset.sub=String(n.sub||"");if(u)g.style.backgroundImage='url("'+u+'")';g.style.backgroundPosition=String(n.pos).replace(/[^0-9a-z% .]/gi,"");m("es");m("et").textContent=n.title;m("ed","p");d.appendChild(o)}}catch(e){}</script>
${file ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(site.url + url)}">`}
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">${url === '/' || url === '/about/' ? `
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Person', name: site.fullName || site.name, alternateName: [site.name, 'ACG'], url: site.url + '/', image: portrait ? site.url + portrait.l : undefined, jobTitle: plainText(site.currently), affiliation: { '@type': 'CollegeOrUniversity', name: 'Universität Hamburg' }, sameAs: (site.links || []).map(l => l.url) }).replace(/</g, '\\u003c')}</script>` : ''}
${fs.existsSync(path.join(ROOT, 'theme', 'fonts', 'bricolage-grotesque-latin-opsz-normal.woff2')) ? '<link rel="preload" href="/fonts/bricolage-grotesque-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>' : `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Mono:wght@400;500&display=swap">`}
<link rel="stylesheet" href="/site.css?v=${STAMP}">
</head>
<body class="${cls}">
<div id="cur" aria-hidden="true"></div>
<header class="top sm">
  <a class="brand" href="/" aria-label="${esc(site.name)}, home">acg</a>
  <nav aria-label="Sections">${nav}</nav>
  <div class="tr"><button type="button" class="theme" id="theme" aria-label="Switch between light and dark"><i></i></button></div>
</header>
${body}
<script src="/site.js?v=${STAMP}"></script>
</body>
</html>
`;
  if (file) { fs.writeFileSync(path.join(OUT, file), outward(html)); return; }
  const dir = path.join(OUT, url); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'index.html'), outward(html)); pages.push(url);
}
const STAMP = Date.now().toString(36);
const YEAR = new Date().getFullYear();
const COPY = `© ${YEAR} ${esc(site.fullName)}. All rights reserved.`;
const footer = () => `<footer class="foot"><a class="acg" href="/" aria-label="ACG, back to the start">${ACG}</a><div class="fr sm"><span class="k">${site.links.map(l => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join(' · ')}${site.email ? ` · <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>` : ''}</span><span class="k">${COPY}</span></div></footer>`;
const figure = (p, i, opt = {}) => `<figure class="ph" style="--ar:${(p.w / p.h).toFixed(4)};--c:${p.c || 'var(--panel)'}"><button type="button" class="open" data-i="${i}" data-cur="Open" aria-label="Open ${esc(p.title || 'photograph ' + (i + 1))}"><img class="fi" loading="lazy" decoding="async" src="${p.s}" width="${p.w}" height="${p.h}" alt="${esc(p.alt || p.title || (p.set ? p.set + ', photograph ' + (i + 1) : ''))}"></button>${opt.caption === false ? '' : `<figcaption class="sm"><span>${opt.number ? `<span class="k">${String(i + 1).padStart(2, '0')}</span> ` : ''}${esc(p.title)}</span><span class="k mono">${esc(p.exif)}</span></figcaption>`}</figure>`;
const lightData = list => `<script type="application/json" id="lb">${JSON.stringify(list.map(p => ({ l: p.l, s: p.s, t: p.title, e: p.exif, w: p.w, h: p.h }))).replace(/</g, '\\u003c')}</script>`;

/* ---------- content ---------- */
console.log('Reading content…');
// photography types
const types = [];
for (const f of fs.readdirSync(C('photography')).filter(f => f.endsWith('.json')).sort()) {
  const t = JSON.parse(fs.readFileSync(C('photography', f), 'utf8')); if (t.hidden) continue; t.slug = t.slug || slug(t.title);
  t.items = [];
  for (const e of t.photos) { const o = typeof e === 'string' ? { src: e } : e; for (const s of expand(o.src)) { const p = await photo(s, { title: o.title || '', alt: o.alt || '', set: t.title }); if (!p) continue;
      const twin = shown.find(q => q.id === p.id || alike(q, p) > .96);
      if (twin) { warn(`duplicate left out of ${t.title}: ${s} (same picture as ${twin.src})`); continue; }
      shown.push(p); t.items.push(p); } }
  /* the one picture that stands for the set on the Photography page: "cover" in the set's file, or else its first picture */
  t.face = (t.cover && (t.items.find(p => p.src === t.cover) || await photo(t.cover))) || t.items[0];
  if (t.items.length) types.push(t);
}
types.sort((a, b) => (a.order || 9) - (b.order || 9));
// stories: a run of blocks (text, quotations, pictures) kept in the order they are written
const stories = [];
if (fs.existsSync(C('stories'))) for (const d of fs.readdirSync(C('stories')).sort()) {
  const file = C('stories', d, 'story.md'); if (!fs.existsSync(file)) continue;
  const { data, body } = frontMatter(fs.readFileSync(file, 'utf8')); if (data.draft === 'true') continue;
  const st = { ...data, slug: d, sections: [], all: [] };
  for (const chunk of body.split(/^(?=## )/m)) {
    const lines = chunk.split('\n'), head = lines[0].startsWith('## ') ? lines.shift().slice(3).trim() : '';
    const sec = { head, blocks: [], count: 0 }; let buf = [];
    const flush = () => { const t = buf.join('\n').trim(); buf = []; if (t) sec.blocks.push({ type: 'text', html: md(t), quote: t.split(/\n\s*\n/).every(p => p.trim().startsWith('>')) }); };
    for (const l of lines) {
      const m = l.match(/^@images?:\s*(.+)$/);
      if (!m) { buf.push(l); continue; }
      flush(); const items = [];
      for (const src of m[1].split(',').flatMap(x => expand(x.trim()))) { const p = await photo(src); if (p) { p.i = st.all.length; st.all.push(p); items.push(p); } }
      if (items.length) { sec.blocks.push({ type: 'img', items }); sec.count += items.length; }
    }
    flush(); if (sec.head || sec.blocks.length) st.sections.push(sec);
  }
  st.cover = (data.cover && await photo(data.cover)) || st.all[0];
  stories.push(st);
}
// projects
const projects = [];
if (fs.existsSync(C('projects'))) for (const f of fs.readdirSync(C('projects')).filter(f => f.endsWith('.md')).sort()) {
  const { data, body } = frontMatter(fs.readFileSync(C('projects', f), 'utf8')); if (data.draft === 'true') continue;
  const stage = stageIn(body); let steps = [];
  if (stage) { const sc = await screensIn(stage.dir); steps = sc.map((x, i) => ({ ...x, title: (stage.items[i] || {}).title || x.name, text: (stage.items[i] || {}).text || '' })); if (stage.items.length && stage.items.length !== sc.length) warn(`${f}: ${sc.length} screens in ${stage.dir} but ${stage.items.length} lines about them`); }
  const facts = (data.facts || '').split('|').map(x => { const i = x.indexOf(':'); return i > 0 ? [x.slice(0, i).trim(), x.slice(i + 1).trim()] : null; }).filter(Boolean);
  projects.push({ ...data, slug: f.replace(/\.md$/, ''), types: (data.type || '').split(',').map(s => s.trim()).filter(Boolean), html: md(stage ? stage.before + '\n\n' + stage.after : body), cover: data.cover ? await photo(data.cover) : null, flat: /\.(png|gif|svg)$/i.test(data.cover || ''),
    facts, steps, stage: steps.length ? { label: stage.label, walk: stage.walk } : null });
}
// papers: content/research/<name>/ holds paper.json, body.html (the full text, ready-made) and fig/ (its figures)
const papers = [];
if (fs.existsSync(C('research'))) for (const d of fs.readdirSync(C('research'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort()) {
  const jf = C('research', d, 'paper.json'); if (!fs.existsSync(jf) || !fs.existsSync(C('research', d, 'body.html'))) continue;
  const p = JSON.parse(fs.readFileSync(jf, 'utf8')); if (p.draft) continue;
  Object.assign(p, { slug: d, body: fs.readFileSync(C('research', d, 'body.html'), 'utf8'), cover: p.cover ? await photo(resolveSrc(path.join('research', d, p.cover)) ? path.join('research', d, p.cover) : p.cover) : null });
  papers.push(p);
  projects.push({ title: p.title, short: p.short, kind: p.kind, summary: p.summary, year: p.year, slug: d, link: '/research/' + d + '/', types: p.types || ['research'], cover: p.cover, html: '', paper: p, poster: p.poster, tone: p.tone, repo: p.repo });
}
projects.sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')) || (a.order || 9) - (b.order || 9));
// writing
const posts = [];
if (fs.existsSync(C('writing'))) for (const f of fs.readdirSync(C('writing')).filter(f => f.endsWith('.md')).sort().reverse()) {
  const { data, body } = frontMatter(fs.readFileSync(C('writing', f), 'utf8')); if (data.draft === 'true') continue;
  posts.push({ ...data, slug: f.replace(/\.md$/, ''), html: md(body) });
}
const faces = []; for (const s of expand('faces')) { const p = await photo(s); if (p) faces.push(p); }
const portrait = site.portrait ? await photo(site.portrait) : null;
const tileImg = {}, tileOpt = {}; for (const [k, v] of Object.entries(site.tiles || {})) { if (k === 'writing' && !posts.length) continue; const o = typeof v === 'string' ? { src: v } : v; tileOpt[k] = o; tileImg[k] = await photo(o.src); if (o.wide && o.wide.src) o.wideImg = await photo(o.wide.src); }   /* a section that is not shown needs no picture; a tile written { src, pos, focus } also says where its picture is cut and where the eye goes */
console.log('');

NAV = [{ url: '/', label: 'Home' }, { url: '/photography/', label: 'Photography' }, { url: '/research/', label: 'Research' }, { url: '/projects/', label: 'Projects' }, ...(posts.length ? [{ url: '/writing/', label: 'Writing' }] : []), { url: '/about/', label: 'About me' }];

/* words in the opening sentence that answer the pointer: [phrase, section or highlight it leads to, optional picture of its own] */
/* how light a picture is on the whole, 0 to 1: the page uses it to keep a picture set inside letters readable on a dark or a light ground */
async function lumOf(p) { try { const st = await sharp(path.join(OUT, p.s)).stats(), c = st.channels; return +((.2126 * c[0].mean + .7152 * c[1].mean + .0722 * c[2].mean) / 255).toFixed(3); } catch { return .5; } }
/* [phrase, where it leads, picture for the dark theme, picture for the light theme]; the last two are optional */
const sayKeys = []; for (const [ph, label, im, im2] of (site.home && site.home.words) || []) { const p = im ? await photo(im) : null, q = im2 ? await photo(im2) : null; sayKeys.push([ph, label || '', p ? p.s : '', p ? await lumOf(p) : 0, q ? q.s : '', q ? await lumOf(q) : 0]); }
/* poster faces: five layouts shared by the covers on the first page and on the Projects page */
function face(v, { title, kind, year, pic, words, ex, focus, wide }) {
  const w = words || title.split(/\s+/), half = Math.ceil(w.length / 2);
  return {
    a: `<span class="zh mono"><span>ACG</span><span>${esc(year || '')}</span></span>${pic}<span class="zf mono"><span><i>${esc(kind === 'Section' ? 'Section' : 'Project')}</i>${kind === 'Section' ? `<b class="zn">${esc(title)}</b>` : esc(title)}</span><span>${kind === 'Section' ? '<i>Site</i>adhitchandy.com' : `<i>Kind</i>${esc(kind)}`}</span></span>`,
    b: `<span class="qw w1">${esc(w.slice(0, half).join(' '))}</span>${pic}<span class="qw w2">${esc(w.slice(half).join(' ') || year || '')}</span><span class="zh mono"><span>${esc(kind)}</span><span>${esc(year || '')}</span></span>`,
    c: `<span class="zh mono"><span>${esc(kind)}</span><span>${esc(year || '')}</span></span>${pic}<span class="qt">${esc(title)}</span>`,
    d: `${pic}<span class="zh mono"><span>${esc(kind)}</span><span>${esc(year || '')}</span></span><span class="qt">${esc(title)}</span>`,
    e: `<span class="qt">${esc(title)}</span>${pic}<span class="zh mono"><span>${esc(kind)}</span><span>${esc(year || '')}</span></span>`,
    f: `${pic}<span class="zh mono"><span>${esc(kind)}</span><span>${esc(year || '')}</span></span><span class="qt">${esc(title)}</span>`,
    /* a viewfinder: the picture to the edges, the frame lines, a focus point on what the eye goes to, and the exposure under the title
       (written in site.json as "exif" where the file has none; failing both, what the section holds) */
    g: `${pic}<span class="vf" aria-hidden="true"></span>${[[focus, 'gt'], [wide && wide.focus, 'gw']].map(([f, c]) => f ? `<span class="af ${c}" style="--fx:${esc(f.split(/\s+/)[0])};--fy:${esc(f.split(/\s+/)[1] || '50%')}" aria-hidden="true"></span>` : '').join('')}<span class="zh mono"><span>${esc(kind)}</span><span>${esc(year || '')}</span></span><span class="qt">${esc(title)}</span>${ex ? `<span class="vx mono gt">${esc(ex)}</span>` : ''}${wide && wide.ex ? `<span class="vx mono gw">${esc(wide.ex)}</span>` : ''}`
  }[v];
}
/* The poster a piece of work wears is the same wherever it is shown, on the Projects page or pinned to the first page: its layout
   and colour come from its place in the list of projects, unless the project names them ("poster: a" to "f", "tone: blue", "red",
   "yellow" or "green"). Every piece names both, so that adding new work never changes the covers already there. */
const TONES = ['#2b4bd6', '#e0492c', '#e8b73a', '#1c5f4b'], TONE_NAMES = ['blue', 'red', 'yellow', 'green'];
const ident = (p, at = 0) => { const j = projects.indexOf(p), i = j < 0 ? at : j, named = TONE_NAMES.indexOf(String(p.tone || '').trim().toLowerCase()), q = named >= 0 ? named : i % TONES.length; return { v: 'abcdef'.includes(p.poster || '-') ? p.poster : 'abcde'[i % 5], tone: TONES[q], tx: q === 2 ? '#11110f' : '#efece6' }; };
/* the picture inside a poster, waiting in its own average colour */
const zp = (c, flat, pos) => c ? `<span class="zp${flat ? ' flat' : ''}" style="--c:${c.c || '#d9d5cb'}"><img class="fi" src="${c.l}" alt="" loading="lazy"${pos ? ` style="object-position:${pos}"` : ''}></span>` : '<span class="zp none"></span>';
/* the small portrait: a handful of pictures that flash by once, and the one it comes to rest on, which is the picture on the About cover */
const faceRow = portrait ? faces.map(f => `<img src="${f.s}" alt="">`).join('') + `<img class="on rest" src="${portrait.s}" alt="Portrait of ${esc(site.name)}" style="object-position:46% 30%">` : faces.map((f, i) => `<img${i ? '' : ' class="on"'} src="${f.s}" alt="${i ? '' : 'Portrait of ' + esc(site.name)}">`).join('');
/* ---------- home ---------- */
const research = projects.filter(p => p.types.includes('research'));
/* the strip on the first page: each section, followed by the pieces of work named for it in site.json → home.featured */
const feat = list => (list || []).map(sl => {
  const st = stories.find(s => s.slug === sl); if (st) { const own = projects.find(p => p.link === '/photography/' + st.slug + '/'); return { url: '/photography/' + st.slug + '/', label: st.short || st.title, kind: 'Photo story', inside: st.summary || st.subtitle || '', img: st.cover, title: st.title, year: st.year, id: own ? ident(own) : null }; }
  const p = projects.find(p => p.slug === sl); if (p) return { url: p.link || '/projects/' + p.slug + '/', label: p.short || p.title, kind: p.kind || (p.types[0] ? p.types[0][0].toUpperCase() + p.types[0].slice(1) + ' project' : 'Project'), inside: p.summary || '', img: p.cover, title: p.title, year: p.year, repo: p.repo, flat: p.flat, id: ident(p) };
  warn('home.highlights names something that does not exist: ' + sl); return null;
}).filter(Boolean);
const highlights = feat(site.home && site.home.highlights).filter(t => t.img).slice(0, 2);
const tiles = [
  { url: '/photography/', label: 'Photography', inside: `${types.reduce((n, t) => n + t.items.length, 0)} photographs, ${types.length} genres, ${stories.length + projects.filter(p => p.types.includes('photography') && p.link && !stories.some(s => '/photography/' + s.slug + '/' === p.link)).length} photo stories`, img: tileImg.photography || types[0]?.items[0], pos: (tileOpt.photography || {}).pos, focus: (tileOpt.photography || {}).focus, wide: tileOpt.photography && tileOpt.photography.wideImg ? { img: tileOpt.photography.wideImg, pos: tileOpt.photography.wide.pos, focus: tileOpt.photography.wide.focus, exif: tileOpt.photography.wide.exif } : null, exif: (tileOpt.photography || {}).exif },
  { url: '/research/', label: 'Research', inside: site.research.topic, img: tileImg.research },
  { url: '/projects/', label: 'Projects', inside: `${projects.length} projects across ${[...new Set(projects.flatMap(p => p.types))].join(', ')}`, img: tileImg.projects },
  ...(posts.length ? [{ url: '/writing/', label: 'Writing', inside: posts[0].title, img: tileImg.writing }] : []),
  { url: '/about/', label: 'About me', inside: site.about.short, img: portrait, pos: '46% 30%', plain: true }   /* its cover does not grow into a portrait that fills the window: it opens on a plain title card */
].filter(t => t.img);
/* the row on the first page: the sections, then the pieces of work pinned in site.json → home.highlights */
const row = [...tiles, ...highlights.map(t => ({ ...t, hl: true }))];
/* which poster layout and colour each cover on the first page takes, in order */
for (const t of row) { t.lum = await lumOf(t.img); if (t.wide) t.wide.lum = await lumOf(t.wide.img); }
const HOMEV = [['g', '#2b4bd6'], ['c', '#2b4bd6'], ['e', '#11110f'], ['a', '#e0492c'], ['b', '#e8b73a'], ['c', '#1c5f4b']];
/* The eight cover designs. Each is one SVG: flat shapes plus the photograph (a grey copy) seen through a window cut in the drawing.
   Everything is drawn inside the SVG, with no CSS clipping or masking, because Safari flickers when clipped layers are moved. */
async function grey(p) {   /* a small black-and-white copy of a processed picture */
  const id = p.s.match(/([a-f0-9]{12})-s\.webp$/)[1], out = path.join(OUT, 'img', id + '-g.webp');
  if (!fs.existsSync(out)) await sharp(path.join(OUT, 'img', id + '-s.webp')).greyscale().linear(1.1, -8).webp({ quality: 74 }).toFile(out);
  return '/img/' + id + '-g.webp';
}
const WIN = [
  `<circle cx="50" cy="50" r="17"/>`,
  `<polygon points="30,0 62,0 70,100 38,100"/>`,
  `<rect x="11" y="15" width="22" height="22"/><rect x="39" y="15" width="22" height="22"/><rect x="39" y="43" width="22" height="22"/><rect x="67" y="43" width="22" height="22"/>`,
  `<circle cx="0" cy="100" r="62"/>`,
  [8, 19, 30, 41, 52, 63, 74, 85].map(x => `<rect x="${x}" y="16" width="5.5" height="58"/>`).join(''),
  `<path d="M20 58a30 30 0 0 1 60 0z"/>`,
  `<polygon points="0,100 0,72 25,72 25,48 50,48 50,24 75,24 75,0 100,0 100,100"/>`,
  `<circle cx="66" cy="38" r="24"/>`
];
const UNDER = [
  ``, `<polygon points="100,0 100,100 46,100" fill="#0e0e0c"/><polygon points="0,0 22,0 0,40" fill="#efece6"/>`, ``, ``, `<circle cx="74" cy="34" r="17" fill="#2f9a6a"/>`, ``, ``, ``
];
const OVER = [
  `<g fill="none" stroke="#0e0e0c" stroke-width=".7">${[24, 31, 38, 45, 52, 59, 66].map(r => `<circle cx="50" cy="50" r="${r}"/>`).join('')}</g><circle cx="83" cy="20" r="5" fill="#e0492c"/>`,
  `<circle cx="82" cy="24" r="9" fill="#e8b73a"/>`,
  `<rect x="67" y="15" width="22" height="22" fill="#efece6"/><rect x="11" y="43" width="22" height="22" fill="#e8b73a"/>`,
  `<circle cx="100" cy="0" r="46" fill="#0e0e0c"/><circle cx="100" cy="0" r="24" fill="#e0492c"/><circle cx="0" cy="100" r="72" fill="none" stroke="#0e0e0c" stroke-width=".7"/><circle cx="0" cy="100" r="82" fill="none" stroke="#0e0e0c" stroke-width=".7"/>`,
  `<line x1="8" y1="80" x2="92" y2="80" stroke="#efece6" stroke-width=".7"/>`,
  `<g stroke="#efece6" stroke-width="1.6">${[62, 68, 74, 80, 86].map((y, q) => `<line x1="${14 + q * 5}" y1="${y}" x2="${86 - q * 5}" y2="${y}"/>`).join('')}</g><circle cx="50" cy="58" r="38" fill="none" stroke="#0e0e0c" stroke-width=".7"/>`,
  `<circle cx="24" cy="26" r="13" fill="#e0492c"/><path d="M0 72h25v-24h25v-24h25v-24h25" fill="none" stroke="#2b4bd6" stroke-width=".7"/>`,
  `<g fill="none" stroke="#0e0e0c" stroke-width="1.1">${[58, 66, 74, 82, 90].map(y => `<path d="M-5 ${y} q13.75 -12 27.5 0 t27.5 0 t27.5 0 t27.5 0"/>`).join('')}</g><circle cx="66" cy="38" r="31" fill="none" stroke="#efece6" stroke-width=".7"/>`
];
function coverArt(k, n, g, t) {
  let win = WIN[k], img = `<image href="${g}" xlink:href="${g}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice"/>`;
  if (t.pos) {   /* a portrait: its own round frame holding the whole picture, placed so the face stays inside */
    const [px, py] = t.pos.split(' ').map(v => parseFloat(v) / 100), cx = 65, cy = 38, r = 25, B = 2 * r, s = B / Math.min(t.img.w, t.img.h), iw = t.img.w * s, ih = t.img.h * s;
    win = `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
    img = `<image href="${g}" xlink:href="${g}" x="${(cx - r - (iw - B) * px).toFixed(2)}" y="${(cy - r - (ih - B) * py).toFixed(2)}" width="${iw.toFixed(2)}" height="${ih.toFixed(2)}" preserveAspectRatio="none"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><clipPath id="w${n}">${win}</clipPath></defs>${UNDER[k]}<g clip-path="url(#w${n})">${img}</g>${OVER[k]}</svg>`;
}

shell({
  url: '/', cls: 'home', og: tiles[0].img.l, body: `
<div id="veil" aria-hidden="true"><span>${esc(site.fullName)}</span></div>
<main class="grid">
  <aside class="rail sm">
    <div class="who">
      <div class="face" id="face">${faceRow}</div>
      <div class="facts">
        <div><span class="nm">${esc(site.fullName || site.name)}</span>${site.facts.map(([k, v], i) => `<span class="k" style="margin-top:10px">${esc(k)}:</span><span>${esc(v)}</span>`).join('')}</div>
        <div class="r">${site.links.map(l => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join('')}</div>
      </div>
    </div>
    <div class="acgrow"><div class="acg" id="acg" role="img" aria-label="ACG, for ${esc(site.fullName)}">${ACG}</div><span class="k copy">${COPY}</span></div>
  </aside>
  <div class="stage">
    <h1 id="say" data-keys="${esc(JSON.stringify(sayKeys))}" data-rot="${esc(JSON.stringify((site.home && site.home.rotate) || null))}">${esc(site.statement)}</h1>
    <div class="bar sm"><div><span class="k"><i class="dot" aria-hidden="true"></i>Currently</span><span class="cs">${inline(site.currently)}</span></div><div class="scr" style="align-items:flex-end"><span class="k">Scroll ↕</span><span id="cnt">01 / ${String(row.length).padStart(2, '0')}</span></div></div>
    <div class="band"><div class="strip" id="strip">${highlights.length ? '<span class="grp gf mono k">Featured work</span><span class="grp gs mono k">Sections</span>' : ''}${row.map((t, i) => { const v = t.id ? [t.id.v, t.id.tone] : HOMEV[i % HOMEV.length], tx = t.id ? t.id.tx : v[1] === '#e8b73a' ? '#11110f' : '#efece6'; return `<a class="pz hz pz-${v[0]}${t.wide ? ' wd' : ''}${t.hl ? ' feat' : ''}${t.label.length > 20 ? ' lg' : ''}" style="--d:${i};--tone:${v[1]};--tx:${tx}" href="${esc(t.url)}" data-v="${v[0]}" data-tone="${v[0] === 'e' || v[0] === 'b' ? '#e0492c' : v[0] === 'a' ? '#e8b73a' : v[1]}" data-im="${t.img.s}" data-lum="${t.lum}" data-big="${t.img.l}"${t.wide ? ` data-im-w="${t.wide.img.s}" data-big-w="${t.wide.img.l}" data-lum-w="${t.wide.lum}" data-pos-w="${esc(t.wide.pos || '50% 50%')}"` : ''}${t.pos ? ` data-pos="${t.pos}"` : ''}${t.plain ? ' data-plain="1"' : ''} data-sec="${esc(t.label)}" data-in="${esc(t.inside)}"${t.hl ? ` data-title="${esc(t.title || t.label)}" data-meta="${esc(['Highlight', t.kind, t.year].filter(Boolean).join(' · '))}" data-sum="${esc(t.inside)}" data-href="${esc(t.url)}"${/^https?:/.test(t.url) ? ' data-ext="1"' : ''}${t.repo ? ` data-repo="${esc(t.repo)}"` : ''}${t.flat ? ' data-flat="1"' : ''}` : ''} data-cur="Open"><span class="zz">${face(v[0], { title: t.label, kind: t.hl ? t.kind : 'Section', year: String(i + 1).padStart(2, '0'), pic: `<span class="zp" style="--c:${t.img.c || '#d9d5cb'}"><img class="fi${t.wide ? ' gt' : ''}" src="${t.img.l}" alt=""${t.pos ? ` style="object-position:${t.pos}"` : ''}>${t.wide ? `<img class="fi gw" src="${t.wide.img.l}" alt=""${t.wide.pos ? ` style="object-position:${t.wide.pos}"` : ''}>` : ''}</span>`, ex: t.exif || t.img.exif || t.inside, focus: t.focus, wide: t.wide && { ex: t.wide.exif || t.wide.img.exif || t.inside, focus: t.wide.focus } })}</span></a>`; }).join('')}</div></div>
  </div>
  </div>
</main>
${highlights.length ? `<button type="button" class="pzc mono" id="pzc" hidden>Close ✕</button>
<aside class="pzd" id="pzd" hidden aria-live="polite"><div class="pzi"><span class="pzp"></span><span class="pzm mono k"></span><h2 class="pzt"></h2><p class="pzs"></p><div class="pzl"><a class="pzv" id="pzv" href="#"></a><a class="pzr mono" id="pzr" href="#" hidden>View the code ↗</a></div></div></aside>` : ''}` });

/* Every piece of work has a cover set as a small poster. Six layouts: five take turns, the sixth (a book jacket) is asked for by name
   with "poster: f". On the Projects page the posters lie in fixed places on a table; elsewhere each is given its own place. */
function poster(p, i, o = {}) {
  const { v, tone, tx } = ident(p, i), url = p.link || '/projects/' + p.slug + '/', ext = /^https?:/.test(url);
  const kinds = p.types.map(t => t[0].toUpperCase() + t.slice(1)).join(' · '), kind = o.kind || p.kind || kinds, title = (p.short || p.title), words = title.split(/\s+/);
  const at = o.at ? `;--l:${o.at.l.toFixed(2)}%;--t:${o.at.t.toFixed(2)};--w:${o.at.w.toFixed(2)}%;--dp:${o.at.dp}` : '';
  return `<button type="button" class="pz pz-${v}${o.at ? '' : ' s' + (i % 5)}${title.length > 20 ? ' lg' : ''}" style="--i:${i};--row:${o.at ? 0 : Math.floor(i / 5)};--tone:${tone};--tx:${tx}${at}" data-types="${p.types.map(slug).join(' ')}" data-title="${esc(p.title)}" data-meta="${esc(o.meta || [String(i + 1).padStart(2, '0'), kinds, p.year].filter(Boolean).join(' · '))}" data-sum="${esc(o.sum || p.summary || '')}" data-href="${esc(url)}"${ext ? ' data-ext="1"' : ''}${o.go ? ` data-go="${esc(o.go)}"` : ''}${p.repo ? ` data-repo="${esc(p.repo)}"` : ''}${p.cover ? ` data-im="${p.cover.s}" data-big="${p.cover.l}"` : ''}${p.flat ? ' data-flat="1"' : ''} data-cur="Open" aria-label="${esc(p.title)}"><span class="zz">${face(v, { title, kind, year: p.year, pic: zp(p.cover, p.flat), words })}</span></button>`;
}
/* how wide a poster of each layout is for its height */
const AR = { a: 3 / 4, b: 3 / 2, c: 4 / 5, d: 16 / 10, e: 1, f: 16 / 10 };
/* Posters laid loosely in two staggered columns, each given about the same area: where each one goes, in hundredths of the width
   of the space they share, and how tall the whole arrangement comes out. The largest size at which they still sit side by side is used. */
function loose(ars) {
  const gap = 5, hit = (r, q) => r.l < q.l + q.w + gap && q.l < r.l + r.w + gap && r.t < q.t + q.h + gap && q.t < r.t + r.h + gap;
  const lay = A => { const out = []; ars.forEach((ar, i) => { const w = Math.min(64, Math.sqrt(A * ar)), h = w / ar, right = i % 2 === 1; let best = null;
      for (const l of right ? [100 - w, 96 - w] : [i % 4 ? 6 : 0, i % 4 ? 0 : 6]) { const r = { l, t: right && i === 1 ? 8 : 0, w, h }; for (let k = 0; k < 60; k++) { const q = out.find(q => hit(r, q)); if (!q) break; r.t = q.t + q.h + gap; } if (!best || r.t < best.t - .01) best = r; }
      out.push(best); }); return { boxes: out, H: Math.max(0, ...out.map(r => r.t + r.h)) }; };
  /* up to four are all seen at once, as large as still lets them sit side by side */
  if (ars.length <= 4) { let best = lay(500); for (let A = 600; A <= 2600; A += 50) { const t = lay(A); if (t.H <= Math.max(74, 38 * Math.ceil(ars.length / 2))) best = t; } return { ...best, still: true }; }
  /* more than that would have to be made small to be seen together: they keep a good size instead, and the table they lie on moves */
  let best = null, fill = 0; for (let A = 1300; A <= 1600; A += 50) { const t = lay(A), f = t.boxes.reduce((n, b) => n + b.w * b.h, 0) / t.H; if (f > fill) { fill = f; best = t; } }   /* the size at which they lie closest together */
  return { ...best, still: false };
}
/* The Projects table: the covers lie in rows of three and of two in turn, and a row is never left with one cover alone (six make two
   rows of three, four two rows of two), so no cover hangs on its own as the table moves. Each layout keeps one size wherever it lies;
   a row that would be too full is drawn a little smaller. Places are in hundredths of the width, as for the stories. */
function rowsLayout(vs) {
  const AR = { a: 3 / 4, b: 3 / 2, c: 4 / 5, d: 1.6, e: 1, f: 1.6 }, AREA = { a: 590, b: 860, c: 660, d: 900, e: 680, f: 900 };
  const FREE = { 3: [[0, .44, .5], [.18, .5, .26]], 2: [[.22, .31], [.47, .31]], 1: [[.5]] }, TOP = { 3: [[2, 9, 0], [8, 0, 6]], 2: [[1, 0], [0, 3]], 1: [[0]] }, DP = { 3: [14, -9, 20], 2: [-16, 10], 1: [12] };
  const sizes = []; for (let k = 0; k < vs.length;) { const z = Math.min(sizes.length % 2 ? 2 : 3, vs.length - k); sizes.push(z); k += z; }
  if (sizes.length > 1 && sizes[sizes.length - 1] === 1) { sizes.pop(); if (sizes[sizes.length - 1] === 2) sizes[sizes.length - 1] = 3; else { sizes[sizes.length - 1] = 2; sizes.push(2); } }
  const boxes = [], seen = { 1: 0, 2: 0, 3: 0 }; let k = 0, y = 1.5, H = 0;
  for (const z of sizes) {
    const row = vs.slice(k, k + z), alt = seen[z]++ % 2; let ws = row.map(v => Math.sqrt(AREA[v] * AR[v]));
    const sum = ws.reduce((a, b) => a + b, 0); if (sum > 86) ws = ws.map(w => w * 86 / sum);
    const free = 96 - ws.reduce((a, b) => a + b, 0); let x = 2, bottom = 0;
    row.forEach((v, j) => { x += free * FREE[z][alt][j]; const t = y + TOP[z][alt][j], h = ws[j] / AR[v]; boxes.push({ l: x, t, w: ws[j], dp: DP[z][j] }); x += ws[j]; bottom = Math.max(bottom, t + h); });
    H = bottom; y = bottom + 5; k += z;
  }
  return { boxes, H };
}
/* Every finite page ends with the next piece of work, shown as its poster; a click carries its picture into the page, as everywhere. */
function nextBlock(cur) {
  if (projects.length < 2) return '';
  const p = projects[(projects.indexOf(cur) + 1 + projects.length) % projects.length]; if (!p || p === cur) return '';
  const { v, tone, tx } = ident(p), url = p.link || '/projects/' + p.slug + '/', ext = /^https?:/.test(url), story = url.startsWith('/photography/'), title = p.short || p.title;
  const kind = p.kind || (story ? 'Photo story' : p.types.map(t => t[0].toUpperCase() + t.slice(1)).join(' · '));
  const go = ext ? 'Visit the site ↗' : story ? 'Read the story →' : p.paper ? `Read the ${(p.paper.kind || 'paper').toLowerCase().replace(/^.*\s/, '')} →` : 'Open the project →', travel = !ext && p.cover && !p.flat;
  return `<a class="next" href="${esc(url)}"${ext ? ' target="_blank" rel="noopener"' : ''} data-cur="${ext ? 'Visit' : story || p.paper ? 'Read' : 'Open'}"${travel ? ` data-im="${p.cover.s}" data-big="${p.cover.l}" data-sec="${esc(title)}" data-in="${esc(p.summary || '')}"` : ''}><span class="nxt"><span class="mono k up">Next · ${esc([kind, p.year].filter(Boolean).join(' · '))}</span><span class="nxh">${esc(p.title)}</span>${p.summary ? `<span class="nxs">${esc(p.summary)}</span>` : ''}<span class="nxg mono up">${go}</span></span><span class="pz pz-${v}${title.length > 20 ? ' lg' : ''}" style="--tone:${tone};--tx:${tx}"><span class="zz">${face(v, { title, kind, year: p.year, pic: zp(p.cover, p.flat), words: title.split(/\s+/) })}</span></span></a>`;
}

/* ---------- photography ---------- */
/* One window divided down the middle, with nothing drawn between the halves: the photo stories at the left, as posters that open
   the way projects do; the genres at the right, as photographs that grow into their walls. On a phone the two follow each other. */
const photoProjects = projects.filter(p => p.types.includes('photography') && p.link && !stories.some(s => '/photography/' + s.slug + '/' === p.link));
const storyItems = [...stories.map(s => ({ s, p: projects.find(p => p.link === '/photography/' + s.slug + '/') || { title: s.title, short: s.short, summary: s.summary || s.subtitle, year: s.year, types: ['photography'], cover: s.cover, link: '/photography/' + s.slug + '/', slug: s.slug } })), ...photoProjects.map(p => ({ p }))];
const storyLay = loose(storyItems.map((x, i) => AR[ident(x.p, i).v]));
shell({
  url: '/photography/', title: 'Photography', cls: 'photo', desc: 'Photographs by ' + site.name + ': ' + types.map(t => t.title.toLowerCase()).join(', ') + ', and photo stories.', og: types[0]?.items[0]?.l, body: `
<main class="page labpage">
  <div class="lead">${h1('Photography')}<p class="sm k">${esc(site.photography.intro)}</p></div>
  <div class="halves${storyItems.length ? '' : ' one'}">
    ${storyItems.length ? `<section class="half stories" aria-label="Photo stories">
      <p class="hl"><span class="mono k up">Photo stories</span><span class="mono k">${String(storyItems.length).padStart(2, '0')}</span></p>
      <div class="lab" id="lab" ${storyLay.still ? 'data-still' : 'data-loose'} style="--h:${storyLay.H.toFixed(2)}">${storyItems.map((x, i) => { const ext = /^https?:/.test(x.p.link || ''); return poster(x.p, i, { at: { ...storyLay.boxes[i], dp: [12, -10, 16, -14][i % 4] }, kind: x.s ? 'Photo story' : 'Photo project', meta: [String(i + 1).padStart(2, '0'), x.s ? 'Photo story' : 'Photo project', x.s ? x.s.all.length + ' photographs' : '', x.p.year || (x.s && x.s.year)].filter(Boolean).join(' · '), sum: (x.s && (x.s.summary || x.s.subtitle)) || x.p.summary, go: ext ? '' : 'Read the story →' }); }).join('')}</div>
    </section>` : ''}
    <section class="half genres" aria-label="Genres">
      <p class="hl"><span class="mono k up">Genres</span><span class="mono k">${String(types.length).padStart(2, '0')}</span></p>
      <div class="doors">
        ${types.map((t, i) => `<a class="door" style="--d:${i};--c:${t.face.c || 'var(--panel)'}" href="/photography/${t.slug}/" data-cur="Open" data-im="${t.face.s}" data-big="${t.face.l}" data-sec="${esc(t.title)}" data-in="${esc([t.intro, t.items.length + ' photographs.'].filter(Boolean).join(' '))}"><span class="dw"><img class="fi" src="${t.face.s}" alt=""></span><span class="dn mono">${String(i + 1).padStart(2, '0')}</span><span class="dc mono">${t.items.length} photographs</span><span class="dt">${esc(t.title)}</span><span class="de mono">Open the gallery →</span></a>`).join('\n        ')}
      </div>
    </section>
  </div>
  ${storyItems.length ? `<button type="button" class="pzc mono" id="pzc" hidden>Close ✕</button>
  <aside class="pzd" id="pzd" hidden aria-live="polite"><div class="pzi"><span class="pzp"></span><span class="pzm mono k"></span><h2 class="pzt"></h2><p class="pzs"></p><div class="pzl"><a class="pzv" id="pzv" href="#"></a><a class="pzr mono" id="pzr" href="#" hidden>View the code ↗</a></div></div></aside>` : ''}
</main>${footer()}` });
function card({ url, title, sub, year, cover, labels = [], ext, flat }) {
  return `<a class="card" href="${esc(url)}" data-types="${labels.map(slug).join(' ')}" data-cur="Open">${cover ? `<div class="cv${flat ? ' flat' : ''}"><img loading="lazy" src="${cover.s}" alt=""></div>` : '<div class="cv none"></div>'}<div class="ct"><div class="row sm"><span class="k">${labels.map(esc).join(' · ')}</span><span class="k">${esc(year || '')}</span></div><h3>${esc(title)}${ext ? ' ↗' : ''}</h3><p class="sm k">${esc(sub || '')}</p></div></a>`;
}
for (const t of types) shell({
  url: '/photography/' + t.slug + '/', title: t.title, desc: t.intro, og: t.items[0].l, cls: 'set set-' + t.style, body: `
<main class="page">
  <div class="lead"><p class="sm"><a href="/photography/">← Photography</a></p>${h1(t.title)}<p class="sm k">${esc(t.intro || '')} ${t.items.length} photographs.</p>${types.length > 1 ? `<nav class="gnav sm" aria-label="Other kinds of photograph">${types.filter(o => o !== t).map(o => `<a href="/photography/${o.slug}/">${esc(o.title)}</a>`).join('')}</nav>` : ''}</div>
  <section class="gal gal-${t.style}"${t.style === 'tall' ? ' data-strip' : ''}${t.style === 'field' ? ` data-field data-cols="${t.cols || 3}" tabindex="0" aria-label="${esc(t.title)}, an endless wall of photographs"` : ''}>${t.style === 'rows' ? rows(t.items.map((p, i) => Object.assign(p, { i }))).map(rowHtml).join('') : t.items.map((p, i) => figure(p, i, { number: t.style === 'sheet', caption: t.style !== 'field' })).join('')}</section>
</main>${lightData(t.items)}${footer()}` });

/* stories: pictures are set in rows of one to three, each row a different width and side, so the page moves like a book being paged through */
function rows(items) {
  const pat = [{ n: 2, w: 100 }, { n: 1, w: 54, a: 'r' }, { n: 3, w: 100 }, { n: 1, w: 46, a: 'l' }, { n: 2, w: 74, a: 'r' }, { n: 1, w: 62, a: 'c' }, { n: 2, w: 80, a: 'l' }];
  const pano = p => p.w / p.h > 2.2, out = []; let i = 0, k = 0;
  while (i < items.length) {
    if (pano(items[i])) { out.push({ items: [items[i++]], w: 100, a: 'c' }); continue; }
    const spec = pat[k++ % pat.length], take = [];
    while (take.length < spec.n && i < items.length && !pano(items[i])) take.push(items[i++]);
    out.push({ items: take, w: take.length < spec.n ? Math.min(spec.w, 60) : spec.w, a: spec.a || 'c' });
  }
  return out;
}
function rowHtml(r, n) { return `<div class="prow a-${r.a}" data-sp="${n % 2 ? '-0.03' : '0.03'}" style="--w:${r.w};--rar:${r.items.reduce((t, p) => t + p.w / p.h, 0).toFixed(4)}">${r.items.map(p => figure(p, p.i, { caption: false })).join('')}</div>`; }
/* words sit beside pictures wherever a paragraph and one or two pictures follow each other; larger groups run as rows */
function storyBlocks(sec, n) {
  const out = [], B = sec.blocks, pics = (list, cls) => `<div class="pics ${cls}">${list.map(p => figure(p, p.i, { caption: false })).join('')}</div>`; let side = n % 2;
  for (let i = 0; i < B.length; i++) {
    const b = B[i], nx = B[i + 1];
    if (b.type === 'text' && b.quote) { out.push(`<div class="prose pull">${b.html}</div>`); continue; }
    if (b.type === 'text' && nx && nx.type === 'img') {
      const take = nx.items.slice(0, nx.items.length <= 2 ? 2 : 1), rest = nx.items.slice(take.length);
      out.push(`<div class="beside${side ? ' flip' : ''}"><div class="prose">${b.html}</div>${pics(take, 'n' + take.length)}</div>`); side = 1 - side;
      if (rest.length) out.push(rows(rest).map(rowHtml).join('')); i++; continue;
    }
    if (b.type === 'img' && b.items.length <= 2 && nx && nx.type === 'text' && !nx.quote && !(B[i + 2] && B[i + 2].type === 'img')) {
      out.push(`<div class="beside${side ? ' flip' : ''}"><div class="prose">${nx.html}</div>${pics(b.items, 'n' + b.items.length)}</div>`); side = 1 - side; i++; continue;
    }
    out.push(b.type === 'text' ? `<div class="prose">${b.html}</div>` : rows(b.items).map(rowHtml).join(''));
  }
  return out.join('\n');
}
for (const s of stories) { const chapters = s.sections.filter(x => x.head); shell({
  url: '/photography/' + s.slug + '/', title: s.title, desc: s.summary, og: s.cover?.l, cls: 'story', body: `
<main class="page">
  <header class="cover"${s.cover ? ` data-hero="${s.cover.l}"` : ''}>${s.cover ? `<img src="${s.cover.l}" alt="" data-sp="0.12">` : ''}<a class="bk sm" href="/photography/">← Photography</a><div class="ttl">${h1(s.title)}<p class="sub">${esc(s.subtitle || '')}</p><p class="sm">${[s.place, s.year].filter(Boolean).map(esc).join(' · ')}</p></div></header>
  <div class="credits sm"><div><span class="k">${esc(s.creditLabel || 'Photographs')}:</span><span>${esc(s.photographs || site.name)}</span></div>${s.text ? `<div><span class="k">Text:</span><span>${esc(s.text)}</span></div>` : ''}${s.format ? `<div><span class="k">Made as:</span><span>${esc(s.format)}</span></div>` : ''}<div><span class="k">Frames:</span><span>${s.all.length}</span></div></div>
  <nav class="chapnav sm" aria-label="Chapters">${chapters.map((sec, n) => `<a href="#c${n + 1}">${esc(sec.head)}</a>`).join('')}</nav>
  ${s.sections.map((sec, n) => { const c = chapters.indexOf(sec); return `<section class="chap${sec.head ? '' : ' open'}"${c >= 0 ? ` id="c${c + 1}"` : ''}><div class="side"><div class="stick">${sec.head ? `<span class="mono k">${String(c + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}</span><h2>${esc(sec.head)}</h2>${sec.count ? `<span class="sm k">${sec.count} frames</span>` : ''}` : ''}</div></div><div class="flow">${storyBlocks(sec, n)}</div></section>`; }).join('\n')}
  ${nextBlock(projects.find(p => p.link === '/photography/' + s.slug + '/'))}
</main>${lightData(s.all)}${footer()}` }); }

/* ---------- projects ---------- */
const allTypes = [...new Set(projects.flatMap(p => p.types))];
const projCard = p => card({ url: p.link || '/projects/' + p.slug + '/', title: p.title, sub: p.summary, year: p.year, cover: p.cover, labels: p.types.map(t => t[0].toUpperCase() + t.slice(1)), ext: /^https?:/.test(p.link || ''), flat: p.flat });
shell({
  url: '/projects/', title: 'Projects', desc: 'Projects by ' + site.name + ' across ' + allTypes.join(', ') + '.', body: `
<main class="page labpage">
  <div class="lead">${h1('Projects')}<p class="sm k">Everything in one place. Pick a cover to see what it is.</p></div>
  <div class="filters sm" role="group" aria-label="Filter projects"><button type="button" class="on" data-f="" aria-pressed="true">All ${projects.length}</button>${allTypes.map(t => `<button type="button" data-f="${slug(t)}" aria-pressed="false">${esc(t[0].toUpperCase() + t.slice(1))} ${projects.filter(p => p.types.includes(t)).length}</button>`).join('')}</div>
  ${(() => { const L = rowsLayout(projects.map((p, i) => ident(p, i).v)); return `<section class="lab" id="lab" style="--h:${L.H.toFixed(2)}">${projects.map((p, i) => poster(p, i, { at: L.boxes[i] })).join('')}</section>`; })()}
  <button type="button" class="pzc mono" id="pzc" hidden>Close ✕</button>
  <aside class="pzd" id="pzd" hidden aria-live="polite"><div class="pzi"><span class="pzp"></span><span class="pzm mono k"></span><h2 class="pzt"></h2><p class="pzs"></p><div class="pzl"><a class="pzv" id="pzv" href="#"></a><a class="pzr mono" id="pzr" href="#" hidden>View the code ↗</a></div></div></aside>
</main>${footer()}` });
/* A project's own page. Its name stays at the left while the text is read; the first paragraph is set large as a way in, the
   picture follows it whole, then the rest of the text. */
/* A project shown at work (see stageIn above). The page begins as Research does: the title in a row, a band of small facts, and
   then one sentence set large. Here the sentence tells how the software is used and stands beside a screen of it: the words that
   name a step are underlined and call that step's screen, as the underlined words of the first page's sentence call their covers.
   Pressed, a screen opens large in the same viewer as the photographs, which is given the screens of both themes. */
function stagedPage(p, kinds) {
  const st = p.stage, N = p.steps.length, nn = i => String(i + 1).padStart(2, '0');
  const walk = stagger(inline(st.walk || p.steps.map((x, i) => `[${x.title}](#${i + 1})`).join(', ') + '.').replace(/<a href="#(\d+)">/g, (t, d) => +d >= 1 && +d <= N ? `<a class="kw" href="#step-${+d}" data-step="${+d}">` : t));
  const pic = (x, cls, alt, first) => `<img class="${cls}" loading="lazy" decoding="async" ${first ? '' : 'data-'}src="${x.m}" ${first ? '' : 'data-'}srcset="${x.m} ${x.w}w, ${x.x} ${x.xw}w" sizes="(max-width:980px) 100vw, min(62vw,1140px)" width="${x.w}" height="${x.h}" alt="${esc(alt)}">`;
  const line = [p.lead ? p.lead.replace(/[.\s]+$/, '') + '.' : '', [kinds, p.year].filter(Boolean).join(', ') + '.'].filter(Boolean).join(' ');
  return `
<main class="page proj staged">
  <div class="lead row"><p class="sm"><a href="/projects/">← Projects</a></p>${h1(p.title)}<p class="sm k">${esc(line)}</p>${p.repo ? `<a class="pjr mono up" href="${esc(p.repo)}">View the code ↗</a>` : ''}</div>
  <div class="pw">
    ${p.facts.length ? `<div class="rband"><div class="credits sm">${p.facts.map(([k, v]) => `<div><span class="k">${esc(k)}:</span><span>${inline(v)}</span></div>`).join('')}</div></div>` : ''}
    <div class="pstage" id="stage" style="--ar:${p.steps[0].light.w}/${p.steps[0].light.h}">
      <div class="pwalk">${st.label ? `<p class="mono k up">${esc(st.label)}</p>` : ''}<p class="pwt">${walk}</p></div>
      <button type="button" class="pscr zoom" data-i="0" data-cur="Open" aria-label="Open this screen large">${p.steps.map((x, i) => `<span class="sf${i ? '' : ' on'}" style="--cl:${x.light.c};--cd:${x.dark.c}">${pic(x.light, 'lt', p.title + ': ' + x.title, !i)}${pic(x.dark, 'dk', p.title + ': ' + x.title, !i)}</span>`).join('')}</button>
      <div class="pcap"><ol class="pcl">${p.steps.map((x, i) => `<li id="step-${i + 1}"${i ? '' : ' class="on"'}><span class="mono k"><b>${nn(i)}</b> / ${nn(N - 1)}</span><p><b>${esc(x.title)}.</b> ${inline(x.text)}</p></li>`).join('')}</ol><div class="pctl mono up"><button type="button" class="pstep" data-d="-1" aria-label="Previous screen">←</button><button type="button" class="pstep" data-d="1" aria-label="Next screen">→</button><button type="button" class="ppz" aria-pressed="false">Pause</button></div></div>
    </div>
    ${p.html.trim() ? `<div class="pmore"><div class="prose rmore">${p.html}</div></div>` : ''}
  </div>
  ${nextBlock(p)}
</main><script type="application/json" id="lb">${JSON.stringify(p.steps.map(x => ({ l: x.light.x, s: x.light.m, ld: x.dark.x, sd: x.dark.m, t: p.title + ': ' + x.title, e: '', w: x.light.xw, h: Math.round(x.light.h * x.light.xw / x.light.w) }))).replace(/</g, '\\u003c')}</script>${footer()}`;
}
for (const p of projects.filter(p => !p.link)) {
  const m = p.html.match(/^\s*<p>[\s\S]*?<\/p>/), lede = m ? m[0] : '', rest = m ? p.html.slice(m[0].length) : p.html;
  const kinds = p.kind || p.types.map(t => t[0].toUpperCase() + t.slice(1)).join(' · ');
  if (p.stage) { shell({ url: '/projects/' + p.slug + '/', title: p.title, desc: p.summary, og: p.cover?.l, body: stagedPage(p, kinds) }); continue; }
  shell({
    url: '/projects/' + p.slug + '/', title: p.title, desc: p.summary, og: p.cover?.l, body: `
<main class="page proj">
  <aside class="pjs"><div class="stick">
    <p class="sm"><a href="/projects/">← Projects</a></p>
    <p class="mono k up">${esc([kinds, p.year].filter(Boolean).join(' · '))}</p>
    ${h1(p.title)}
    ${p.repo ? `<a class="pjr mono up" href="${esc(p.repo)}">View the code ↗</a>` : ''}
  </div></aside>
  <div class="pjc">
    ${lede ? `<div class="prose big">${lede}</div>` : ''}
    ${p.cover ? `<figure class="pjf${p.flat ? ' flat' : ''}"><img data-hero="${p.cover.l}" src="${p.cover.l}" width="${p.cover.w}" height="${p.cover.h}" alt=""></figure>` : ''}
    ${rest.trim() ? `<div class="prose">${rest}</div>` : ''}
  </div>
  ${nextBlock(p)}
</main>${footer()}` });
}

/* ---------- research ---------- */
/* a paper is announced by its question, its picture and a few of its numbers */
function paperCard(r, n) {
  const p = r.paper, q = p.overview && p.overview.question && p.overview.question.lead;
  return `<a class="rfeat" style="--d:${n || 0}" href="${esc(r.link)}" data-cur="Read"${p.cover ? ` data-im="${p.cover.s}" data-big="${p.cover.l}" data-sec="${esc(p.short || p.title)}" data-in="${esc(p.summary || '')}"` : ''}>${p.cover ? `<span class="rw" style="--c:${p.cover.c || 'var(--panel)'}"><img class="fi" src="${p.cover.l}" alt=""></span>` : ''}<span class="rx"><span class="mono k up">${esc([p.kind, p.date || p.year].filter(Boolean).join(' · '))}</span><span class="rq">${esc(q || p.summary || p.title)}</span><span class="rt sm k">${esc(p.title)}</span>${p.glance ? `<span class="rn">${p.glance.slice(0, 3).map(([n, t]) => `<span><b>${esc(n)}</b><span class="sm k">${esc(t)}</span></span>`).join('')}</span>` : ''}<span class="se mono">${p.overview ? 'Start with the overview →' : 'Read the paper →'}</span></span></a>`;
}
shell({
  url: '/research/', title: 'Research', desc: site.research.topic, body: `
<main class="page rpage">
  <div class="lead row">${h1('Research')}<p class="sm k">${esc(site.research.lead || 'What I study, why, and the work so far.')}</p></div>
  <div class="rhead">
    <div class="rband"><div class="credits sm">${site.research.facts.map(([k, v]) => `<div><span class="k">${esc(k)}:</span><span>${esc(v)}</span></div>`).join('')}</div></div>
    <div class="asay"><p>${stagger(inline(site.research.statement))}</p></div>
    ${(site.research.text || []).length ? `<div class="prose rmore">${site.research.text.map(p => `<p>${inline(p)}</p>`).join('')}</div>` : ''}
  </div>
  <div class="shd"><h2 class="mono k up">Academic work</h2><p class="sm k">${research.some(p => p.paper) && research.filter(p => p.paper).every(p => p.paper.overview) ? 'Each opens with a short overview, then the full text.' : research.length ? 'Theses and papers, in full.' : ''}</p></div>
  ${research.filter(p => p.paper).map(paperCard).join('')}
  ${research.some(p => !p.paper) ? `<section class="cards">${research.filter(p => !p.paper).map(projCard).join('')}</section>` : ''}
  ${research.length ? '' : `<p class="sm k empty">Nothing is listed here yet. The master's thesis and working drafts will appear as they are added.</p>`}
</main>${footer()}` });

/* papers: long-form reading pages with a contents rail, numbered figures, tables and equations */
const plain = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
for (const p of papers) {
  const base = '/research/' + p.slug + '/', figDir = C('research', p.slug, 'fig'), outFig = path.join(OUT, 'research', p.slug, 'fig');
  if (fs.existsSync(figDir)) { fs.mkdirSync(outFig, { recursive: true }); for (const f of fs.readdirSync(figDir)) fs.copyFileSync(path.join(figDir, f), path.join(outFig, f)); }
  const zooms = []; let body = p.body.replaceAll('src="fig/', 'src="' + base + 'fig/');
  body = body.replace(/(<button\b)([^>]*class="zoom"[^>]*>\s*<img\b[^>]*>)/g, (m, a, rest) => { const src = (rest.match(/src="([^"]+)"/) || [])[1], alt = (rest.match(/alt="([^"]*)"/) || [, ''])[1]; zooms.push({ l: src, s: src, title: alt.replace(/&amp;/g, '&').replace(/&quot;/g, '"'), exif: '' }); return `${a} data-i="${zooms.length - 1}" data-cur="Open"${rest.replace(/\sdata-cur="[^"]*"/, '')}`; });
  const toc = []; for (const m of body.matchAll(/<section class="ch[^"]*" id="([^"]+)">\s*<h2[^>]*>([\s\S]*?)<\/h2>|<h3[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h3>/g)) { if (m[1]) toc.push({ id: m[1], t: plain(m[2].replace(/<span class="no[^"]*">([\s\S]*?)<\/span>/, '$1 ')), sub: [] }); else if (toc.length) toc[toc.length - 1].sub.push({ id: m[3], t: plain(m[4].replace(/<span class="no[^"]*">([\s\S]*?)<\/span>/, '$1 ')) }); }
  /* the short version, set before the paper itself: the question, one figure, the finding and what limits it */
  const ov = p.overview, no = (n, t) => `<span class="ovn mono k up"><b>${n}</b>${esc(t)}</span>`, parts = [];
  if (ov) {
    if (ov.question) parts.push(`<div class="ovc q">${no('01', 'The question')}<p class="ovq">${esc(ov.question.lead)}</p>${ov.question.text ? `<p class="ovp">${esc(ov.question.text)}</p>` : ''}</div>`);
    if (ov.figure) { const src = base + ov.figure.src; zooms.push({ l: src, s: src, title: ov.figure.caption || '', exif: '' }); parts.push(`<figure class="ovc f">${no('02', 'The key figure')}<div class="plot"><button class="zoom" type="button" data-i="${zooms.length - 1}" data-cur="Open" aria-label="Enlarge the figure"><img src="${src}" alt="${esc(ov.figure.caption || '')}"></button></div><figcaption>${esc(ov.figure.caption || '')}${ov.figure.ref ? ` <a href="#${esc(ov.figure.ref)}">${esc(ov.figure.refLabel || 'In the text')} →</a>` : ''}</figcaption></figure>`); }
    if (ov.finding) parts.push(`<div class="ovc r">${no('03', 'The finding')}<p class="ovq">${esc(ov.finding.lead)}</p>${ov.finding.points ? `<ul class="ovl nums">${ov.finding.points.map(([n, t]) => `<li><b>${esc(n)}</b><span>${esc(t)}</span></li>`).join('')}</ul>` : ''}</div>`);
    if (ov.limits) parts.push(`<div class="ovc l">${no('04', 'Its limits')}${ov.limits.lead ? `<p class="ovp">${esc(ov.limits.lead)}</p>` : ''}<ul class="ovl">${(ov.limits.points || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`);
  }
  shell({
    url: base, title: p.title, desc: p.summary, og: p.cover?.l, cls: 'paperpage', body: `
<div id="prog" aria-hidden="true"></div>
<main class="page paper">
  <p class="sm ptop"><a href="/research/">← Research</a>${p.repo ? `<a class="pjr mono up" href="${esc(p.repo)}">View the code ↗</a>` : ''}</p>
  <header class="phead">
    <p class="mono k up">${esc([p.kind, p.date || p.year].filter(Boolean).join(' · '))}</p>
    ${h1(p.title)}
    ${p.cover ? `<img class="pcover${p.coverFit === 'contain' ? ' contain' : ''}" data-hero="${p.cover.l}" src="${p.cover.l}" alt="${esc(p.coverAlt || '')}"${p.coverPosition ? ` style="object-position:${esc(p.coverPosition)}"` : ''}>` : ''}
    ${p.cover && p.coverCredit ? `<p class="pcredit sm k">Photo by <a href="${esc(p.coverCredit.authorUrl)}">${esc(p.coverCredit.author)}</a> on <a href="${esc(p.coverCredit.sourceUrl)}">${esc(p.coverCredit.source)}</a></p>` : ''}
    <div class="credits sm">${(p.facts || []).map(([k, v]) => `<div><span class="k">${esc(k)}:</span><span>${esc(v)}</span></div>`).join('')}</div>
    ${parts.length ? `<section class="ov" id="overview" aria-label="Overview"><div class="ovh"><h2 class="mono k up">Overview</h2><span class="mono k up">${esc(ov.note || 'The short version')}</span></div><div class="ovg">${parts.join('')}</div><a class="ovgo mono" href="#${toc[0] ? esc(toc[0].id) : 'paper'}">Read the full ${esc((p.kind || 'paper').toLowerCase().replace(/^.*\s/, ''))} ↓</a></section>` : ''}
    <div class="abs">
      <div class="abst"><h2 class="mono k up">Abstract</h2>${(p.abstract || []).map(t => `<p>${esc(t)}</p>`).join('')}${p.keywords ? `<p class="sm k kw">Keywords: ${esc(p.keywords.join(', '))}</p>` : ''}</div>
      ${p.glance ? `<ul class="glance">${p.glance.map(([n, t]) => `<li><span class="n">${esc(n)}</span><span class="sm k">${esc(t)}</span></li>`).join('')}</ul>` : ''}
    </div>
  </header>
  <div class="pgrid">
    <nav class="toc sm" aria-label="Contents"><div class="stick"><span class="mono k up">Contents</span><ol>${toc.map(c => `<li><a href="#${esc(c.id)}">${c.t}</a>${c.sub.length ? `<ol>${c.sub.map(s => `<li><a href="#${esc(s.id)}">${s.t}</a></li>`).join('')}</ol>` : ''}</li>`).join('')}</ol></div></nav>
    <article class="thesis" id="paper">${body}</article>
  </div>
  ${nextBlock(projects.find(x => x.paper === p))}
</main>${lightData(zooms)}${footer()}` });
}

/* ---------- writing ---------- */
if (posts.length) {
  shell({ url: '/writing/', title: 'Writing', body: `<main class="page text"><div class="lead">${h1('Writing')}</div><ul class="posts">${posts.map(p => `<li><a href="/writing/${p.slug}/"><span>${esc(p.title)}</span><span class="sm k">${esc(p.date || '')}</span></a></li>`).join('')}</ul></main>${footer()}` });
  for (const p of posts) shell({ url: '/writing/' + p.slug + '/', title: p.title, desc: p.summary, body: `<main class="page text"><div class="lead"><p class="sm"><a href="/writing/">← Writing</a></p>${h1(p.title)}<p class="sm k">${esc(p.date || '')}</p></div><div class="prose">${p.html}</div></main>${footer()}` });
}

/* ---------- about ---------- */
/* the CV as a file: site.json → cv.file names a PDF in content/; it is copied out so the page can offer it */
let cvPdf = '';
if (site.cv && site.cv.file && fs.existsSync(C(site.cv.file))) { cvPdf = '/cv/' + slug(site.fullName || site.name) + '-cv.pdf'; fs.mkdirSync(path.join(OUT, 'cv'), { recursive: true }); fs.copyFileSync(C(site.cv.file), path.join(OUT, cvPdf)); }
/* the CV's cover, a poster like those on the first page: it stands at the end of the About page, and beside the CV when that is opened */
const cvFace = site.cv ? `<span class="cvz"><span class="c1 mono"><span>ACG</span><span>${esc(site.cv.asOf)}</span></span><span class="c3" aria-hidden="true"><i>CV</i></span><span class="c4 mono">Read · Download</span><span class="c2">Curriculum vitae</span></span>` : '';
/* The text of the About page knows a few marks of its own, besides links:
     ((an aside))      an aside set in the other typeface, with its brackets; it types itself when the reader reaches it
     {{an aside}}      the same, without brackets
     ~~crossed off~~   struck through, one after another
     {a choice}        one of several choices in a sentence: an underline passes over them and comes to rest on {=this one}
   A piece of the page is a title and its paragraphs; in place of a paragraph there may be a row of figures:
     { "figures": [["92.67 km²", "Total area"], ["43,273", "Population"]], "note": "where they come from" } */
const rich = s => { let k = 0; return inline(s)
  .replace(/\(\((.+?)\)\)/g, '<span class="as">($1)</span>').replace(/\{\{(.+?)\}\}/g, '<span class="as">$1</span>')
  .replace(/~~(.+?)~~/g, (m, t) => `<s class="x" style="--k:${k++}">${t}</s>`)
  .replace(/\{(=?)([^{}]+)\}/g, (m, f, t) => `<span class="op${f ? ' fin' : ''}">${t}</span>`); };
const piece = b => typeof b === 'string' ? `<p>${rich(b)}</p>` : b && b.figures ? `<div class="figs">${b.figures.map(([v, l]) => `<div class="fg"><b class="num">${esc(v)}</b><span>${esc(l || '')}</span></div>`).join('')}</div>${b.note ? `<p class="fnote">${rich(b.note)}</p>` : ''}` : '';
const pieces = (site.about.sections || []).map(sec => ({ ...sec, id: sec.id ? slug(sec.id) : slug(sec.title) }));
/* what stands beside the small portrait: the facts that are not links (and are not already said by the line about now); the links go to the right */
const isLink = v => /^https?:/.test(v) || /^[^@\s]+@[^@\s]+$/.test(v), nowText = plainText(site.currently || '');
const aboutFacts = (site.about.facts || []).filter(([k, v]) => !isLink(v) && !nowText.includes(v)), aboutLinks = (site.about.facts || []).filter(([k, v]) => isLink(v));
for (const p of site.about.text) for (const m of String(p).matchAll(/\]\(#([\w-]+)/g)) if (!pieces.some(q => q.id === m[1])) warn(`About: the opening links to #${m[1]}, but no piece has that title`);
shell({
  url: '/about/', title: 'About me', desc: site.about.short, og: portrait?.l, body: `
<main class="page about">
  <div class="lead row">${h1('About me')}<p class="sm k">${esc(site.about.lead || "Who I am, where I'm from, and what keeps me busy.")}</p></div>
  <div class="awrap">
    <div class="atop g2">
      ${pieces.length ? `<nav class="acon" aria-label="Contents"><p class="mono k up">Contents</p><ol${pieces.length > 6 ? ' class="two"' : ''}>${pieces.map((sec, i) => `<li><a href="#${sec.id}"><span class="mono">${String(i + 1).padStart(2, '0')}</span><span>${esc(sec.title)}</span></a></li>`).join('')}</ol></nav>` : '<span></span>'}
      <div class="aright">
        <div class="aid">
          ${faces.length ? `<div class="face" id="face">${faceRow}</div>` : portrait ? `<div class="face"><img class="on" data-hero="${portrait.l}" src="${portrait.s}" alt="Portrait of ${esc(site.name)}"></div>` : ''}
          <div class="aidt">
            <p class="nm">${esc(site.fullName || site.name)}</p>
            ${aboutFacts.map(([k, v]) => `<p><span class="k">${esc(k)}:</span> ${esc(v)}</p>`).join('')}
          </div>
          ${site.currently ? `<p class="aidc"><span class="k">Currently:</span> ${inline(site.currently)}</p>` : ''}
        </div>
        <div class="alinks">
          ${site.cv ? `<button type="button" data-cvopen aria-haspopup="dialog">Curriculum vitae</button>` : ''}
          ${aboutLinks.map(([k, v]) => /^https?:/.test(v) ? `<a href="${esc(v)}">${esc(k)}</a>` : `<a href="mailto:${esc(v)}">${esc(k)}</a>`).join('')}
        </div>
      </div>
    </div>
    <div class="asay">${site.about.text.map(p => `<p>${stagger(rich(p))}</p>`).join('')}</div>
    ${pieces.length ? `${site.about.hint ? `<div class="g2 ahint"><span></span><p>${inline(site.about.hint)}</p></div>` : ''}
    <div class="frags">${pieces.map((sec, i) => `<section class="frag" id="${sec.id}"><span class="mono fno" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h2 aria-label="${esc(sec.title)}">${rise(sec.title)}</h2><div class="prose">${sec.text.map(piece).join('')}</div></section>`).join('')}</div>` : ''}
    ${site.about.quote ? `<figure class="aq g2"><div class="aql">${site.about.quote.lead ? `<p class="sm k">${esc(site.about.quote.lead)}</p>` : ''}</div><div class="aqr"><blockquote>${stagger(esc(site.about.quote.text))}</blockquote><figcaption class="mono k up">${esc(site.about.quote.by || '')}</figcaption>${site.about.quote.sign ? `<p class="sign">${esc(site.about.quote.sign)}</p>` : ''}</div></figure>` : ''}
    ${site.cv || site.about.contact ? `<div class="endrow g2" id="contact"><div class="endl">${site.cv ? `<button type="button" class="cvc" id="cvc" data-cur="Open" aria-haspopup="dialog" aria-label="Curriculum vitae: read it or download it">${cvFace}</button>` : ''}</div>${site.about.contact ? `<div class="reach"><p>${reach(site.about.contact)}</p></div>` : ''}</div>` : ''}
  </div>
</main>
${site.cv ? `<div class="cvr" id="cvr" hidden role="dialog" aria-modal="true" aria-label="Curriculum vitae"><button type="button" class="pzc mono" id="cvx">Close ✕</button><div class="cvb"><div class="cvl"><span class="cvk" id="cvk" aria-hidden="true">${cvFace}</span>${cvPdf ? `<div class="cvd"><a class="pzv" href="${cvPdf}" download>Download the PDF ↓</a><a class="mono up cvo" href="${cvPdf}" target="_blank" rel="noopener">Open the PDF ↗</a></div>` : ''}</div><div class="cv" tabindex="0">${site.cv.sections.map(s => `<div class="cvs"><h3 class="mono k up">${esc(s.title)}</h3>${s.text ? `<p class="cvt">${esc(s.text)}</p>` : ''}${(s.items || []).map(it => `<div class="cvi"><span class="sm k">${esc(it.when || '')}</span><div><p class="t">${esc(it.title)}</p>${it.org ? `<p class="sm k">${esc(it.org)}</p>` : ''}${it.points ? `<ul>${it.points.map(p => `<li>${inline(p)}</li>`).join('')}</ul>` : ''}</div></div>`).join('')}</div>`).join('')}</div></div></div>` : ''}${footer()}` });

/* ---------- static files ---------- */
/* icons made from theme/favicon.svg, a sitemap and a robots file, so that search engines and phones find what they look for */
{ const svg = path.join(ROOT, 'theme', 'favicon.svg');
  if (fs.existsSync(svg)) { try {
    await sharp(svg, { density: 300 }).resize(180, 180).flatten({ background: '#0b0b0a' }).png().toFile(path.join(OUT, 'apple-touch-icon.png'));
    const png = await sharp(svg, { density: 300 }).resize(32, 32).png().toBuffer(), head = Buffer.alloc(22);
    head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); head[6] = 32; head[7] = 32; head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
    fs.writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([head, png]));
  } catch (e) { warn('icons not made: ' + e.message); } }
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(u => `<url><loc>${site.url + u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`); }
/* the theme goes in file by file (a copy of the whole folder at once is refused on some shared drives); hidden files stay behind */
(function put(from, to) { fs.mkdirSync(to, { recursive: true }); for (const f of fs.readdirSync(from, { withFileTypes: true })) { if (f.name.startsWith('.')) continue; if (f.isDirectory()) put(path.join(from, f.name), path.join(to, f.name)); else fs.copyFileSync(path.join(from, f.name), path.join(to, f.name)); } })(path.join(ROOT, 'theme'), OUT);
/* pictures are named after their content, the style sheet and the script are asked for with the time of the build (?v=…), and fonts
   do not change: a browser may keep all of them instead of asking again on every page */
fs.writeFileSync(path.join(OUT, '_headers'), ['/img/*', '/site.css', '/site.js'].map(u => u + '\n  Cache-Control: public, max-age=31536000, immutable\n').join('') + '/fonts/*\n  Cache-Control: public, max-age=2592000\n');
/* what a Mac leaves behind in folders is not part of the site (wrangler reads this list when it uploads) */
fs.writeFileSync(path.join(OUT, '.assetsignore'), '.DS_Store\n');
shell({ url: '/404/', file: '404.html', title: 'Nothing here', desc: 'This page does not exist.', body: `
<main class="page">
  <div class="lead">${h1('Nothing here')}<p class="sm k">That page does not exist, or it has moved. These do:</p></div>
  <ul class="posts">${NAV.map(n => `<li><a href="${n.url}"><span>${esc(n.label)}</span><span class="sm k">→</span></a></li>`).join('')}</ul>
</main>${footer()}` });
// drop processed images no page uses any more
const used = new Set(); for (const u of pages) for (const m of fs.readFileSync(path.join(OUT, u, 'index.html'), 'utf8').matchAll(/\/img\/([a-f0-9]{12})/g)) used.add(m[1]);
for (const f of fs.readdirSync(path.join(OUT, 'img'))) if (!used.has(f.slice(0, 12)) || /-g\.webp$/.test(f)) { try { fs.rmSync(path.join(OUT, 'img', f), { force: true }); } catch {} }
/* where removing is not allowed, the names of the pictures no longer used are listed in unused-images.txt, to be removed by hand */
{ const left = fs.readdirSync(path.join(OUT, 'img')).filter(f => !used.has(f.slice(0, 12)) || /-g\.webp$/.test(f)); fs.writeFileSync(path.join(ROOT, 'unused-images.txt'), left.join('\n') + (left.length ? '\n' : '')); if (left.length) console.log(`  ${left.length} unused pictures could not be removed; see unused-images.txt`); }
// pages that no longer exist: remove them, or where that is not allowed, turn them into a signpost
(function sweep(dir, url) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!f.isDirectory() || f.name === 'img') continue;
    const sub = path.join(dir, f.name), u = url + f.name + '/'; sweep(sub, u);
    if (fs.existsSync(path.join(sub, 'index.html')) && !pages.includes(u)) {
      try { fs.rmSync(sub, { recursive: true, force: true }); } catch {}
      if (fs.existsSync(path.join(sub, 'index.html'))) fs.writeFileSync(path.join(sub, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Moved</title><meta http-equiv="refresh" content="0;url=${url}"><link rel="canonical" href="${url}"><a href="${url}">This page has moved.</a>`);
    }
  }
})(OUT, '/');
console.log(`Built ${pages.length} pages, ${used.size} images → dist/`);
/* A picture that cannot be found would quietly vanish from the site, so the build fails and `npm run deploy` stops before publishing. */
if (missing && !process.env.ALLOW_MISSING) { console.error(`\n${missing} picture(s) not found in ${PHOTOS}. Do not publish this build. Check photoRoot in content/site.json.`); process.exitCode = 1; }
