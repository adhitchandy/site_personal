(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  /* one pace for everything that comes forward, one for everything that steps back */
  const T_OPEN = 800, T_CLOSE = 600, E_OPEN = 'cubic-bezier(.2,.7,.2,1)', E_CLOSE = 'cubic-bezier(.5,0,.2,1)';
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  /* A cover that comes forward is not magnified. Magnified, it is a small picture stretched, soft until it can be drawn again a second later,
     and its smallest type, which has a fixed least size, sits elsewhere once it is. Instead grow() sets the cover at its full size at once
     and shows it reduced to the size it had, so that it is sharp from the first moment to the last and nothing on it shifts (--k tells the
     small type how much larger the cover now is). lay() sends a grown cover somewhere at the size it had; shrink() puts it back as it was. */
  let grown = null;
  const shrink = el => { if (!el || !el._big) return; const b = el._big, tr = el.style.transition; el.style.transition = 'none'; el.style.width = b.w; el.style.removeProperty('--k'); el._big = null; if (grown === el) grown = null;
    if (b.still) el.style.removeProperty('--sc'); else if (el._T != null) el.style.transform = el._T; el.offsetWidth; el.style.transition = tr; };
  const grow = (el, w0, h0, k, o = {}) => { if (grown && grown !== el) shrink(grown); if (el._big) shrink(el); grown = el; const tr = el.style.transition; el.style.transition = 'none';
    el._big = { w: el.style.width, still: !!o.still, pre: o.mid ? 'translate3d(' + (-(w0 * k - w0) / 2).toFixed(2) + 'px,' + (-(h0 * k - h0) / 2).toFixed(2) + 'px,0) ' : '', post: ' scale(' + (1 / k).toFixed(5) + ')' };
    el.style.width = (w0 * k).toFixed(1) + 'px'; el.style.setProperty('--k', k.toFixed(4));
    if (o.still) el.style.setProperty('--sc', (1 / k).toFixed(5)); else { el._T = el.style.transform || ''; el.style.transform = el._big.pre + el._T + el._big.post; }
    el.offsetWidth; el.style.transition = tr; };
  const lay = (el, T) => { el._T = T; el.style.transform = el._big && !el._big.still ? el._big.pre + T + el._big.post : T; };
  let opening = false;   /* true while the ACG blocks of the first page are still on their way down: until they have landed they answer to nothing */
  /* A finger holds what it touches. The row, the table or the wall goes exactly as far as the finger goes, and a flick carries it on at the
     finger's own speed, slowing as a thrown page does. (Followed a fixed part of the way each frame, as the wheel is, it lagged behind the
     finger, ran ahead of it by a quarter, and lurched forward when it was let go.) Positions are given so that a larger one means further on. */
  const hand = () => { let s = [], v = 0, coast = false;
    return {
      down(p) { const was = coast && Math.abs(v) > .05; s = [[performance.now(), p]]; v = 0; coast = false; return was; },   /* true: it was still running, so the touch only stops it */
      move(p) { const t = performance.now(); s.push([t, p]); while (s.length > 2 && t - s[0][0] > 90) s.shift(); const a = s[0], b = s[s.length - 1]; v = Math.max(-6, Math.min(6, (b[1] - a[1]) / Math.max(8, b[0] - a[0]))); },
      up() { const b = s[s.length - 1]; if (!b || performance.now() - b[0] > 70) v = 0; coast = Math.abs(v) > .02; },   /* a finger that stood still before it let go throws nothing */
      step(dt) { if (!coast) return 0; const d = v * dt; v *= Math.pow(.997, dt); if (Math.abs(v) < .015) { coast = false; v = 0; } return d; },
      get v() { return v; }, get coast() { return coast; }
    }; };
  const when = (q, fn) => { if (q.decode) q.decode().then(fn, () => {}); else q.onload = fn; };   /* call after q.src is set */

  /* Stopping the page while something lies open over it. Where scroll bars take up room of their own (a mouse plugged in, Windows), a
     stopped page loses its bar and would be laid out that much wider, so everything on it would shift, and shift back afterwards:
     the room for the bar is kept meanwhile. */
  const hush = on => { const de = document.documentElement;
    if (on) { if (innerWidth - de.clientWidth > 0) de.style.scrollbarGutter = 'stable'; document.body.style.overflow = 'hidden'; }
    else { document.body.style.overflow = ''; de.style.scrollbarGutter = ''; } };

  /* The pointer. A small ring trails the cursor. Over something that opens it swells into a disc that says Open, Read or Visit, with
     an arrow; over a small control (a word in the menu, a button) it settles round that control instead; and while the row of covers,
     the table or a wall is being dragged it shows which way they go. */
  const cur = $('#cur');
  if (cur && fine) {
    const GL = { Open: '→', Read: '→', Visit: '↗', Next: '→', Previous: '←', Close: '✕' };
    cur.innerHTML = '<span class="cw"></span><span class="cg"></span>'; const cw = cur.firstChild, cg = cur.lastChild, pre = cur.nextElementSibling, dot = pre && pre.classList.contains('cdot') ? pre : document.createElement('i');
    /* The page itself hides the system pointer and sets the dot down the moment it begins, before this script has arrived: a page that is still
       loading would otherwise show the system pointer until then. This script takes the dot over from there. */
    if (!dot.isConnected) { dot.className = 'cdot'; dot.setAttribute('aria-hidden', 'true'); cur.after(dot); } document.documentElement.classList.add('curon');
    let x = -200, y = -200, tx = -200, ty = -200, w = 14, h = 14, tw = 14, th = 14, r = 60, tr = 60, hug = null, shown = '|', press = 1, drag = null, dragging = false, out = false, tick = 0;
    try { const p = (sessionStorage.getItem('cur') || '').split(','); if (p.length === 2 && +p[0] > 0) { x = tx = +p[0]; y = ty = +p[1]; } } catch (e) {}
    dot.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';   /* the dot stands where the pointer was left on the page before */
    const paint = (word, glyph) => { const k = word + '|' + glyph; if (k === shown) return; shown = k; if (word || glyph) { cw.textContent = word; cg.textContent = glyph; } cur.classList.toggle('full', !!(word || glyph)); };
    /* what the ring settles round: a control with a ground or a border of its own is taken whole; a bare word (in the menu, in a list)
       is taken by its letters, however tall the area that answers to the pointer is; and a link that runs on from one line of a
       paragraph into the next is taken one line at a time, the line the pointer is on */
    const around = (el, px, py) => {
      if (el._bare === undefined) { const cs = getComputedStyle(el); el._inl = cs.display === 'inline'; el._bare = /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) && cs.backgroundImage === 'none' && !(parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)); }
      let rs = null;
      if (el._bare) { const r = document.createRange(); r.selectNodeContents(el); if (el._inl) rs = r.getClientRects(); else { const c = r.getBoundingClientRect(); if (c.width > 0 && c.height > 0) return c; } }
      else if (el._inl) rs = el.getClientRects();
      if (rs && rs.length) {
        const ls = [];   /* the pieces of the link, gathered line by line */
        for (const q of rs) { if (q.width < .5 || q.height < .5) continue; const m = (q.top + q.bottom) / 2, l = ls.find(o => m > o.top && m < o.bottom); if (l) { l.left = Math.min(l.left, q.left); l.right = Math.max(l.right, q.right); l.top = Math.min(l.top, q.top); l.bottom = Math.max(l.bottom, q.bottom); } else ls.push({ left: q.left, right: q.right, top: q.top, bottom: q.bottom }); }
        if (ls.length) {
          const inside = ls.filter(o => px >= o.left - 2 && px <= o.right + 2 && py >= o.top - 2 && py <= o.bottom + 2), l = (inside.length ? inside : ls).reduce((a, b) => Math.abs(py - (b.top + b.bottom) / 2) < Math.abs(py - (a.top + a.bottom) / 2) ? b : a);
          return { left: l.left, top: l.top, width: l.right - l.left, height: l.bottom - l.top };
        }
      }
      return el.getBoundingClientRect();
    };
    const mark = el => {
      if (dragging) return;
      const t = el && el.closest ? el.closest('[data-cur],a,button,[role=link]') : null, word = t && !t.classList.contains('sel') ? (t.dataset.cur || '') : '';   /* a cover already brought forward has nothing more to open */
      hug = null; tr = 60;
      if (word) { paint(word === 'Close' ? '' : word, GL[word] || ''); tw = th = word === 'Close' ? 54 : 78; return; }
      paint('', '');
      if (t && !t.hasAttribute('data-cur')) { const l = around(t, tx, ty), b = t._inl ? l : t.getBoundingClientRect();   /* a link in running text is judged by the line the pointer is on, anything else by its own box */
        if (b.width > 0 && b.width <= 340 && b.height <= 84) hug = t; else tw = th = 34; } else tw = th = 14;
    };
    addEventListener('pointermove', e => {
      tx = e.clientX; ty = e.clientY; out = false; cur.classList.remove('gone'); dot.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
      if (drag && !dragging && Math.hypot(tx - drag.x, ty - drag.y) > 8 && !drag.s.classList.contains('open')) { dragging = true; hug = null; tr = 60; paint('', drag.s.dataset.drag === 'x' ? '↔' : '↕'); tw = th = 54; }
      mark(e.target);
    });
    addEventListener('pointerdown', e => { press = .86; const d = e.target.closest ? e.target.closest('[data-drag]') : null; drag = d ? { s: d, x: e.clientX, y: e.clientY } : null; });
    const up = () => { press = 1; drag = null; if (dragging) { dragging = false; shown = '?'; mark(document.elementFromPoint(tx, ty)); } };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    document.documentElement.addEventListener('mouseleave', () => { out = true; cur.classList.add('gone'); });
    /* the ring is where the pointer is when the next page opens */
    addEventListener('pagehide', () => { try { sessionStorage.setItem('cur', out ? '' : Math.round(tx) + ',' + Math.round(ty)); } catch (e) {} });
    (function loop() {
      /* the table, the walls and the row move under a pointer that is standing still, so every so often it looks again at what it is over */
      if (++tick % 9 === 0 && !dragging && !out && tx > -100) mark(document.elementFromPoint(tx, ty));
      let gx = tx, gy = ty;
      if (hug) { const b = around(hug, tx, ty); if (!b.width || !hug.isConnected) { hug = null; tw = th = 14; tr = 60; } else {
        /* a word in running text is held closely, so that the ring does not lie over the lines above and below it */
        const tall = b.height > 36, fw = b.width + (hug._inl ? 10 : tall ? 12 : 18), fh = b.height + (hug._inl ? 6 : 12), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        /* the ring never reaches past the edge of the window: at the top of the page it would be cut off by the browser */
        tw = Math.min(fw, 2 * Math.max(8, Math.min(cx, innerWidth - cx) - 3)); th = Math.min(fh, 2 * Math.max(8, Math.min(cy, innerHeight - cy) - 3)); tr = Math.min(12, th / 2);
        gx = cx + (tx - cx) * .14 * (tw < fw - 6 ? 0 : 1); gy = cy + (ty - cy) * .14 * (th < fh ? 0 : 1); } }
      x += (gx - x) * .22; y += (gy - y) * .22; w += (tw * press - w) * .2; h += (th * press - h) * .2; r += (tr - r) * .24;
      cur.style.width = w.toFixed(1) + 'px'; cur.style.height = h.toFixed(1) + 'px'; cur.style.borderRadius = Math.min(r, h / 2 + 1).toFixed(1) + 'px';
      cur.style.transform = 'translate(' + (x - w / 2).toFixed(1) + 'px,' + (y - h / 2).toFixed(1) + 'px)';
      requestAnimationFrame(loop);
    })();
  }

  /* "write to me" at the end of About me: every few seconds a wave runs through it from the first letter to the last, each letter passing quickly through three
     of the site's faces and back to the plain one. Under the pointer or keyboard focus the wave stops and the word
     settles in the serif italic. Every face is sized to the place of the plain letter or word, so the sentence around it never moves. */
  { const w = $('.wtm'); if (w) {
    const b = $('.wb', w), f = $('.wf', w), FACES = ['f0', 'f1', 'f2', 'f3', 'f4', 'f5'], WAVE = ['f1', 'f2', 'f4', 'f3', 'f5'];
    const STEP = 60, LAG = 36, HOLD = 3, EVERY = 2400;   /* how long a letter keeps a face, how far each letter follows the one before, how many faces it passes, and how often the wave comes */
    const k = {}; let cells = [], t0 = -1, raf = 0, hot = false;
    const show = c => { f.className = 'wf ' + c; f.style.fontSize = (k[c] || 1).toFixed(3) + 'em'; };
    const rest = c => { c._s = -1; const g = c.firstChild; g.className = 'f0'; g.style.fontSize = ''; };
    const quiet = () => { cancelAnimationFrame(raf); raf = 0; cells.forEach(rest); w.classList.toggle('lit', !hot && cells.length > 0); };
    const fit = () => {
      quiet(); const bw = b.getBoundingClientRect().width; f.style.fontSize = '';
      for (const c of FACES) { f.className = 'wf ' + c; k[c] = Math.min(1.08, (bw - 2) / Math.max(1, f.getBoundingClientRect().width)); }
      show(hot ? 'f1' : 'f0'); if (reduce) return;
      cells.forEach(c => c.remove()); cells = [];
      const a = w.getBoundingClientRect(), t = b.firstChild, r = document.createRange();
      for (let i = 0; i < t.length; i++) { if (t.data[i] === ' ') continue;
        r.setStart(t, i); r.setEnd(t, i + 1); const q = r.getBoundingClientRect(), c = document.createElement('span'), g = document.createElement('i');
        c.className = 'wl'; c.setAttribute('aria-hidden', 'true'); c.style.left = (q.left - a.left).toFixed(2) + 'px'; c.style.width = q.width.toFixed(2) + 'px';
        g.textContent = t.data[i]; c.append(g); w.append(c); c._k = {};
        for (const fc of WAVE) { g.className = fc; g.style.fontSize = ''; c._k[fc] = Math.max(.62, Math.min(1, q.width * 1.25 / Math.max(1, g.getBoundingClientRect().width))).toFixed(3) + 'em'; }
        rest(c); cells.push(c); }
      quiet();
    };
    const tick = now => { if (t0 < 0) t0 = now; const e = now - t0;
      cells.forEach((c, j) => { const s = Math.floor((e - j * LAG) / STEP);
        if (s >= 0 && s < HOLD) { if (c._s !== s) { c._s = s; const fc = WAVE[(j + s) % WAVE.length], g = c.firstChild; g.className = fc; g.style.fontSize = c._k[fc]; } }
        else if (c._s !== -1) rest(c); });
      raf = e < (cells.length - 1) * LAG + HOLD * STEP ? requestAnimationFrame(tick) : 0; };
    const wave = () => { if (raf || hot || document.hidden || !cells.length) return; t0 = -1; raf = requestAnimationFrame(tick); };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { fit(); if (!reduce) { wave(); setInterval(wave, EVERY); } });
    addEventListener('resize', fit);
    const still = on => { hot = on; quiet(); show(on ? 'f1' : 'f0'); };
    const kb = () => w.matches(':focus-visible');   /* a click also gives the link focus; only focus from the keyboard holds the word still */
    w.addEventListener('pointerenter', () => still(true)); w.addEventListener('pointerleave', () => { if (!kb()) still(false); });
    w.addEventListener('focus', () => { if (kb()) still(true); }); w.addEventListener('blur', () => still(false));
    const cp = $('.rcopy'); if (cp && navigator.clipboard) cp.addEventListener('click', () => navigator.clipboard.writeText(cp.dataset.mail).then(() => { cp.textContent = 'Copied'; setTimeout(() => { cp.textContent = 'Copy'; }, 1800); }));
    else if (cp) cp.hidden = true;
  } }

  /* photographs appear when they have arrived, each out of its own average colour */
  { const ok = im => im.classList.add('ok'), mine = t => t && t.tagName === 'IMG' && t.classList.contains('fi');
    $$('img.fi').forEach(im => { if (im.complete) ok(im); });
    document.addEventListener('load', e => { if (mine(e.target)) ok(e.target); }, true);
    document.addEventListener('error', e => { if (mine(e.target)) ok(e.target); }, true); }
  /* links that leave the site open beside it, wherever they stand */
  $$('a[href^="http"]').forEach(a => { if (a.host !== location.host) { a.target = '_blank'; a.rel = 'noopener'; } });
  /* things that wipe in as they come into view: the photographs of a story, posters stacked on a phone */
  const reveal = els => { if (!els.length || reduce || !('IntersectionObserver' in window)) return; els.forEach(f => f.classList.add('rv')); const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' }); els.forEach(f => io.observe(f)); };
  /* what the button beside an opened cover says, and where it leads */
  const fillGo = (pzv, d, ext) => {
    pzv.href = d.href; pzv.textContent = ext ? 'Visit the site ↗' : d.go || 'View project →'; pzv.removeAttribute('data-cur');      /* the button says what it does; the ring only settles round it */
    if (ext) { pzv.target = '_blank'; pzv.rel = 'noopener'; } else { pzv.removeAttribute('target'); pzv.removeAttribute('rel'); }
    pzv.dataset.in = d.in || d.sum || '';   /* the short line typed while the page opens, else the summary */ pzv.dataset.im = d.im || ''; pzv.dataset.big = d.big || '';
  };
  /* On a phone an opened piece of work is a sheet. The poster that was tapped travels to the head of the sheet, and back again. */
  const flight = (a, b) => 'translate(' + (a.left + a.width / 2 - b.left - b.width / 2).toFixed(1) + 'px,' + (a.top + a.height / 2 - b.top - b.height / 2).toFixed(1) + 'px) scale(' + (a.width / Math.max(1, b.width)).toFixed(4) + ')';
  const sheet = {
    open(pzd, el) {
      const pp = $('.pzp', pzd); if (!pp) return; pp.textContent = ''; pzd.scrollTop = 0;
      const k = el.cloneNode(true); k.removeAttribute('id'); k.removeAttribute('href'); k.className = 'pz ' + (el.className.match(/\bpz-[a-f]\b|\blg\b/g) || []).join(' '); k.setAttribute('aria-hidden', 'true'); k.tabIndex = -1;
      k.style.cssText = '--tone:' + el.style.getPropertyValue('--tone') + ';--tx:' + el.style.getPropertyValue('--tx'); pp.append(k); pp.inert = true;
      if (reduce || !k.animate) return;
      const a = el.getBoundingClientRect(), b = k.getBoundingClientRect(); if (b.width < 8 || a.width < 8) return;
      el.style.visibility = 'hidden'; el._fly = k.animate([{ transform: flight(a, b) }, { transform: 'none' }], { duration: T_OPEN, easing: E_OPEN });
    },
    close(pzd, el) {
      const k = $('.pzp .pz', pzd), done = () => { el.style.visibility = ''; };
      if (!k || reduce || !k.animate || el.style.visibility !== 'hidden') return done();
      const b = k.getBoundingClientRect(); if (b.bottom < 20 || b.top > innerHeight - 20) return void setTimeout(done, 220);
      if (el._fly) el._fly.cancel(); el.style.visibility = ''; const a = el.getBoundingClientRect(); el.style.visibility = 'hidden';
      k.animate([{ transform: 'none' }, { transform: flight(a, k.getBoundingClientRect()) }], { duration: T_CLOSE, easing: E_CLOSE, fill: 'forwards' }).onfinish = done;
    }
  };

  /* A heading set letter by letter loses the type's own kerning: the T and the o of "To" stand apart. Once the type has loaded,
     each letter is moved to where it stands in the plain word. */
  /* the measuring itself: in the heading h, the letters (sel) of each word are moved to where they stand when the word is set plainly */
  const tight = (h, words, sel) => {
    const fs = parseFloat(getComputedStyle(h).fontSize), probe = document.createElement('span'), r = document.createRange(), adv = {}; if (!fs) return;
    probe.setAttribute('aria-hidden', 'true'); probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;pointer-events:none'; h.append(probe);
    const wide = ch => { if (!(ch in adv)) { probe.textContent = ch; adv[ch] = probe.getBoundingClientRect().width; } return adv[ch]; };
    words.forEach(w => {
      const ls = $$(sel, w), t = ls.map(l => l.textContent); if (ls.length < 2 || t.some(c => c.length !== 1)) return;
      const alone = t.map(wide); probe.textContent = t.join(''); const tn = probe.firstChild, at = t.map((_, i) => { r.setStart(tn, i); r.setEnd(tn, i + 1); return r.getBoundingClientRect().left; });
      ls.forEach((l, i) => { const k = i ? at[i] - at[i - 1] - alone[i - 1] : 0; l.style.marginLeft = Math.abs(k) > .01 ? (k / fs).toFixed(4) + 'em' : ''; });
    });
    probe.remove();
  };
  { const kern = () => $$('.hr:not(.w)').forEach(hr => tight(hr.parentNode, $$('.hw', hr), '.hi'));
    /* measured again whenever type arrives or the window changes size: the type is drawn a little differently at each size */
    if ($('.hr:not(.w)')) { let kt = 0; const soon = () => { clearTimeout(kt); kt = setTimeout(kern, 180); };
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(kern); document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', soon); }
      addEventListener('load', kern); addEventListener('resize', soon);
      /* The type must not be waited for by those signs alone. Safari says the type is ready before it has it and may not say when it comes,
         and the measuring was then put right only when the whole page had loaded, pictures and all: seconds later, in full view, the
         letters of a title such as "To Meet the Ends" closed up and the title moved to the left. So each heading's own type is asked
         for by name, and a copy of the heading that nobody sees is watched: the moment its width changes, because the type has come
         or changed, the letters are measured again, at once. */
      let kr = 0; const now = () => { if (!kr) kr = requestAnimationFrame(() => { kr = 0; kern(); }); };
      $$('.hr:not(.w)').forEach(hr => { const h = hr.parentNode, cs = getComputedStyle(h), text = hr.textContent;
        if (document.fonts && document.fonts.load) document.fonts.load(cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily, text).then(now, () => {});
        if ('ResizeObserver' in window) { const box = document.createElement('span'), w = document.createElement('span'); box.setAttribute('aria-hidden', 'true'); box.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none'; w.style.cssText = 'display:inline-block;white-space:nowrap'; w.textContent = text; box.append(w); h.append(box); new ResizeObserver(now).observe(w); } });
      kern(); } }

  /* Arriving from a cover on the first page. The picture that filled the window is already there with its title (put there by the page head).
     A line about the page is typed under the title. Then, if this page shows that same picture somewhere near its top, the picture
     shrinks and settles exactly into that place while the page fades in around it; otherwise it is drawn up like a blind. */
  { const en = document.getElementById('enter'), root = document.documentElement;
    if (en) {
      const sub = $('.ed', en), bg = $('.eb', en), text = (t => {   /* the line has room for three rows: a longer one is typed only as far as its last whole sentence that fits */
        if (!sub || !t) return t; sub.textContent = t; if (sub.scrollHeight <= sub.clientHeight + 1) { sub.textContent = ''; return t; }
        const ss = t.match(/[^.!?]+[.!?]+(\s+|$)/g) || [t]; let out = ss[0];
        for (let i = 1; i < ss.length; i++) { sub.textContent = out + ss[i]; if (sub.scrollHeight > sub.clientHeight + 1) break; out += ss[i]; }
        sub.textContent = ''; return out.trim(); })(en.dataset.sub || ''), per = reduce ? 0 : Math.min(15, 1000 / Math.max(1, text.length)), id = ((en.dataset.img || '').match(/[a-f0-9]{12}/) || [''])[0]; let q = 0, gone = false;
      /* Scroll bars that take up room of their own (a mouse plugged in, Windows) must not move anything here. The picture arrives as wide
         as it left the page before: if that page had no bar, this one has none either while the picture fills the window (the page head
         marks that with "nobar"). The bar comes back at the instant the picture starts to shrink or lift, while the page is still unseen,
         and the picture is held at the size it had, so neither it nor the page is seen to shift. Until the picture has gone, the page
         is not to be scrolled. */
      const bar = () => { if (!root.classList.contains('nobar')) return; bg.style.width = bg.offsetWidth + 'px'; bg.style.height = bg.offsetHeight + 'px'; root.classList.remove('nobar'); en.offsetWidth; };
      const stay = e => e.preventDefault(), keys = e => { if (/^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/.test(e.key)) e.preventDefault(); };
      addEventListener('wheel', stay, { passive: false }); addEventListener('touchmove', stay, { passive: false }); addEventListener('keydown', keys);
      let settle = null;
      const done = () => { if (settle) settle(); en.remove(); root.classList.remove('entering', 'entered', 'morph', 'nobar'); removeEventListener('wheel', stay); removeEventListener('touchmove', stay); removeEventListener('keydown', keys); };
      const lift = () => { bar(); root.classList.add('entered'); if (en.animate && !reduce) en.animate([{ transform: 'none' }, { transform: 'translate3d(0,-100%,0)' }], { duration: 1000, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' }).onfinish = done; else done(); };
      const morph = host => {
        /* the page is first set where it will stand, still unseen, so that the picture is sent to the place it will really have */
        root.classList.add('morph'); bar();
        const im = host.tagName === 'IMG' ? host : $('img', host) || host, r = host.getBoundingClientRect(), cs = getComputedStyle(im);
        if (reduce || !en.animate || r.width < 40 || r.height < 40 || r.top > innerHeight * .9 || r.bottom < 40) { root.classList.remove('morph'); return lift(); }
        root.classList.add('entered'); im.style.visibility = 'hidden';
        const D = 950, E = 'cubic-bezier(.65,0,.2,1)';
        /* The title goes along. Where the page's own title says the same and is set alike, the title on the picture is not faded out while
           the page's fades in: it moves to where the page's title stands and grows to its size, and once the page is fully there the
           page's own title takes its place, unseen, letter on letter. */
        const et = $('.et', en), ph = $('main h1'), his = ph ? $$('.hr:not(.w) .hi', ph) : [];
        if (et && his.length && et.firstChild && et.firstChild.nodeType === 3 && et.textContent.trim() === (ph.getAttribute('aria-label') || '').trim()) {
          const tn = et.firstChild, ix = [...tn.data].map((ch, i) => /\s/.test(ch) ? -1 : i).filter(i => i >= 0), rg = document.createRange();
          const at = i => { rg.setStart(tn, i); rg.setEnd(tn, i + 1); return rg.getBoundingClientRect(); }, of = l => { rg.selectNodeContents(l); return rg.getBoundingClientRect(); };
          if (ix.length === his.length) {
            const a0 = at(ix[0]), aN = at(ix[ix.length - 1]), b0 = of(his[0]), bN = of(his[his.length - 1]), sc = parseFloat(getComputedStyle(ph).fontSize) / parseFloat(getComputedStyle(et).fontSize) || 0, mid = q => q.top + q.height / 2;   /* letters are matched by their middles: their tops and feet are rounded to whole points at each size */
            /* only if the last letter lands where the page has it: then the two are set alike, line for line */
            if (sc && Math.abs(b0.left + (aN.left - a0.left) * sc - bN.left) < 1.5 && Math.abs(mid(b0) + (mid(aN) - mid(a0)) * sc - mid(bN)) < 1.5) {
              const er = et.getBoundingClientRect(), ts = getComputedStyle(ph).textShadow, no = '0px 0px 30px rgba(0,0,0,0)';
              et.style.transformOrigin = (a0.left - er.left).toFixed(2) + 'px ' + (mid(a0) - er.top).toFixed(2) + 'px';
              et.animate([{ transform: 'none', textShadow: no }, { transform: 'translate(' + (b0.left - a0.left).toFixed(2) + 'px,' + (mid(b0) - mid(a0)).toFixed(2) + 'px) scale(' + sc.toFixed(5) + ')', textShadow: ts && ts !== 'none' ? ts : no }], { duration: D, easing: E, fill: 'forwards' });
              ph.style.visibility = 'hidden'; let did = false;
              settle = () => { if (did) return; did = true; ph.style.visibility = ''; et.style.visibility = 'hidden'; };
              setTimeout(settle, 1180);   /* the page takes .25s + .9s to be fully there */
            }
          }
        }
        $$(settle ? '.es,.ed' : '.es,.et,.ed', en).forEach(e => e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: 'forwards' }));
        /* the ground the picture shrinks on is the page's own, light or dark */
        const g = getComputedStyle(root).getPropertyValue('--bg').trim(), rgb = /^#[0-9a-f]{6}$/i.test(g) ? [1, 3, 5].map(q => parseInt(g.slice(q, q + 2), 16)).join(',') : '11,11,10';
        en.animate([{ backgroundColor: 'rgba(' + rgb + ',1)' }, { backgroundColor: 'rgba(' + rgb + ',0)' }], { duration: D * .8, easing: 'ease', fill: 'forwards' });
        /* A story's cover shows only part of its picture, which is taller than its frame. The picture is then sent to where the whole of it
           lies, and the frame closes in on it as it goes, so that what is seen at the end is exactly what the page shows: nothing jumps
           when the page's own picture takes over. */
        const b = im.getBoundingClientRect(), framed = im !== host && b.width > 40 && b.height > 40, to = framed ? b : r;
        const cut = framed ? 'inset(' + [r.top - b.top, b.right - r.right, b.bottom - r.bottom, r.left - b.left].map(v => Math.max(0, v).toFixed(1) + 'px').join(' ') + ')' : '';
        bg.animate([{ left: '0px', top: '0px', width: bg.offsetWidth + 'px', height: bg.offsetHeight + 'px', backgroundPosition: getComputedStyle(bg).backgroundPosition, filter: 'grayscale(0)', ...(framed ? { clipPath: 'inset(0px 0px 0px 0px)' } : {}) }, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px', backgroundPosition: cs.objectPosition || '50% 50%', filter: /grayscale/.test(cs.filter) ? cs.filter : 'grayscale(0)', ...(framed ? { clipPath: cut } : {}) }], { duration: D, easing: E, fill: 'forwards' }).onfinish = () => {
          im.style.visibility = ''; bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).onfinish = done;
        };
      };
      const go2 = () => { if (gone) return; gone = true; const host = id && $$('[data-hero]').find(h => (h.dataset.hero || '').includes(id)); host ? morph(host) : lift(); };
      const type = () => { if (gone) return; if (q >= text.length) { setTimeout(go2, reduce ? 0 : 480); return; } q = Math.min(text.length, q + (per < 6 ? 3 : 1)); sub.textContent = text.slice(0, q); setTimeout(type, per); };
      const start = () => setTimeout(type, reduce ? 0 : 140);
      if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
      setTimeout(() => { if (!gone) { sub.textContent = text; go2(); } }, 5000);
    } }

  /* light or dark: the system decides; the switch overrides it until the system setting next changes */
  { const root = document.documentElement, sw = $('#theme'), mq = matchMedia('(prefers-color-scheme: light)'), meta = $('meta[name=theme-color]');
    const now = () => root.dataset.theme || (mq.matches ? 'light' : 'dark');
    const paint = () => { const t = now(); if (meta) meta.content = t === 'light' ? '#f4f2ec' : '#0b0b0a'; if (sw) sw.setAttribute('aria-label', 'Switch to the ' + (t === 'light' ? 'dark' : 'light') + ' theme'); };
    /* a choice made with the switch holds only while the system setting stays as it was when the choice was made */
    const sys = () => mq.matches ? 'light' : 'dark', clear = () => { delete root.dataset.theme; try { localStorage.removeItem('theme2'); } catch (e) {} };
    if (sw) sw.addEventListener('click', () => { const t = now() === 'light' ? 'dark' : 'light'; if (t === sys()) clear(); else { root.dataset.theme = t; try { localStorage.setItem('theme2', t + '|' + sys()); } catch (e) {} } paint(); });
    mq.addEventListener && mq.addEventListener('change', () => { clear(); paint(); }); paint(); }

  /* on a phone the top bar slides away while reading down and returns on the way back up */
  { let ly = scrollY, tkk = false; const small = matchMedia('(max-width:820px)');
    addEventListener('scroll', () => { if (tkk) return; tkk = true; requestAnimationFrame(() => { tkk = false; const y = scrollY, d = y - ly; if (Math.abs(d) < 6) return; document.body.classList.toggle('navhide', small.matches && d > 0 && y > 90 && !document.body.style.overflow); ly = y; }); }, { passive: true }); }

  /* click: the picture grows from where it stands until it fills the window and its title is struck in, letter by letter;
     the page that opens begins with that same picture (see "arriving" below) */
  let leaving = false;
  function leave(t, box, e) {
    if (leaving || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button || !t.animate) return;
    e.preventDefault(); leaving = true;
    /* a cover marked plain (About) crosses without its picture: what grows is a dark card that carries only the title */
    const plain = t.dataset.plain !== undefined, r = box.getBoundingClientRect(), big = plain ? '' : t.dataset.big || t.dataset.im, title = t.dataset.sec, url = t.href, pp = t.dataset.pos || '50% 50%';
    const z = document.createElement('div'); z.className = 'zoomer';
    const b = document.createElement('div'); b.className = 'zb';
    if (!plain) { b.style.backgroundImage = 'url("' + t.dataset.im + '")'; b.style.backgroundPosition = pp; const pre = new Image(); pre.src = big; when(pre, () => { b.style.backgroundImage = 'url("' + big + '")'; }); }
    const sc = document.createElement('div'); sc.className = 'zs';
    const h = document.createElement('div'); h.className = 'zt'; h.innerHTML = title.split(' ').map(w => '<span class="zw">' + [...w].map(ch => '<span class="zl">' + ch.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>').join('') + '</span>').join(' ');
    z.append(b, sc, h); document.body.append(z);
    /* the title is written here letter by letter and stands on the next page as plain words: its letters are set where the plain words
       have them, or the title would be seen to close up, and so move to the left, at the moment the pages change */
    tight(h, $$('.zw', h), '.zl');
    const dur = reduce ? 1 : 780;
    /* it grows to the width the page really has, beside its scroll bar if it has one: the next page begins with the picture just so wide */
    const fw = document.documentElement.clientWidth || innerWidth;
    z.animate([{ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', opacity: 0 }, { left: (r.left * .9) + 'px', top: (r.top * .9) + 'px', width: (r.width + (fw - r.width) * .1) + 'px', height: (r.height + (innerHeight - r.height) * .1) + 'px', opacity: 1, offset: .16 }, { left: '0px', top: '0px', width: fw + 'px', height: innerHeight + 'px', opacity: 1 }], { duration: dur, easing: 'cubic-bezier(.65,0,.2,1)', fill: 'both' });
    sc.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur, fill: 'both' });
    $$('.zl', h).forEach((s, q) => s.animate([{ opacity: 0, color: '#e0492c' }, { opacity: 1, color: '#e0492c', offset: .12 }, { opacity: 1, color: '#e0492c', offset: .55 }, { opacity: 1, color: '#efece6' }], { duration: reduce ? 1 : 400, delay: reduce ? 0 : 320 + q * 30, easing: 'linear', fill: 'both' }));
    try { sessionStorage.setItem('enter', JSON.stringify({ img: big, pos: pp, title, sub: t.dataset.in || '', t: Date.now(), bar: innerWidth - document.documentElement.clientWidth }));   /* bar: the room this page's scroll bar takes, so that the next page can begin just as wide */ } catch (err) {}
    setTimeout(() => { location.href = url; }, reduce ? 1 : Math.max(dur + 60, 320 + title.length * 30 + 260));
  }
  addEventListener('pageshow', e => { if (e.persisted) { leaving = false; $$('.zoomer').forEach(z => z.remove()); } });
  /* a picture that carries the visitor across is its own change of page */
  addEventListener('pageswap', e => { if (leaving && e.viewTransition) e.viewTransition.skipTransition(); });
  /* the pictures that stand for the kinds of photograph on the Photography page grow into their galleries the same way */
  $$('.door[data-im],.rfeat[data-im],.next[data-im]').forEach(a => { a.addEventListener('click', e => leave(a, $('.dw,.rw,.zp', a) || a, e)); a.addEventListener('pointerenter', () => { if (!a._pre) { a._pre = new Image(); a._pre.src = a.dataset.big; } }, { once: true }); });

  /* The covers that lead somewhere (a story, a gallery, a project, a paper) answer the pointer as the covers on the first page do:
     it leaves ripples on them, crescents that lead in the direction of travel, widen and fade, with the picture seen slightly
     enlarged inside. Photographs shown for their own sake, in the galleries and the stories, are left alone, and so is a cover that is a drawing or a chart (a PNG). The ripples are drawn on
     a clear canvas laid over the picture, so the picture itself is never touched. */
  if (!reduce && matchMedia('(hover:hover) and (pointer:fine)').matches) $$('.door .dw,.rfeat .rw,.card .cv:not(.flat)').forEach(host => {
    const img = $('img', host); if (!img) return;
    let cv = null, g = null, W = 0, H = 0, k = 1, rip = [], lx = -99, ly = -99, raf = 0;
    const size = () => { const d = Math.min(2, devicePixelRatio || 1), w = host.clientWidth, h = host.clientHeight; W = Math.round(w * d); H = Math.round(h * d); cv.width = W; cv.height = H; k = d * Math.max(.7, Math.min(1.5, Math.min(w, h) / 360)); };
    const frame = now => {
      g.clearRect(0, 0, W, H);
      const sc = Math.max(W / img.naturalWidth, H / img.naturalHeight), iw = img.naturalWidth * sc, ih = img.naturalHeight * sc, ox = (W - iw) / 2, oy = (H - ih) / 2;
      for (let q = rip.length - 1; q >= 0; q--) {
        const p = rip[q], a = (now - p.t) / 900; if (a >= 1) { rip.splice(q, 1); continue; }
        const e = 1 - Math.pow(1 - a, 3), R = (8 + 58 * e) * k, st = (1 - a) * (1 - a), ix = p.x - p.dx * R * .34, iy = p.y - p.dy * R * .34, Ri = R * .8, zoom = 1 + .3 * st;
        g.save(); g.beginPath(); g.arc(p.x, p.y, R, 0, 6.2832); g.moveTo(ix + Ri, iy); g.arc(ix, iy, Ri, 0, 6.2832); g.clip('evenodd');
        g.translate(p.x, p.y); g.scale(zoom, zoom); g.translate(-p.x, -p.y); g.globalAlpha = Math.min(1, st * 2.2); g.drawImage(img, ox, oy, iw, ih); g.restore();
        const ang = Math.atan2(p.dy, p.dx); g.beginPath(); g.arc(p.x, p.y, R, ang - 1.15, ang + 1.15); g.strokeStyle = 'rgba(239,236,230,' + (.34 * st).toFixed(3) + ')'; g.lineWidth = 1.3 * k; g.lineCap = 'round'; g.stroke();
      }
      /* the picture may be easing to a new size under the pointer; the canvas follows it */
      cv.style.transform = getComputedStyle(img).transform;
      if (rip.length) raf = requestAnimationFrame(frame); else { raf = 0; g.clearRect(0, 0, W, H); }
    };
    host.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch' || !img.complete || !img.naturalWidth) return;
      if (!cv) { cv = document.createElement('canvas'); cv.className = 'rp'; cv.setAttribute('aria-hidden', 'true'); host.append(cv); g = cv.getContext('2d'); size(); }
      const r = host.getBoundingClientRect(), x = (e.clientX - r.left) / Math.max(1, r.width) * W, y = (e.clientY - r.top) / Math.max(1, r.height) * H, dx = x - lx, dy = y - ly, dd = Math.hypot(dx, dy);
      if (dd > 16 * k) { if (dd < 400 * k) { rip.push({ x, y, dx: dx / dd, dy: dy / dd, t: performance.now() }); if (rip.length > 9) rip.shift(); } lx = x; ly = y; }
      if (!raf && rip.length) raf = requestAnimationFrame(frame);
    });
    host.addEventListener('pointerenter', () => { if (cv && (Math.abs(host.clientWidth * Math.min(2, devicePixelRatio || 1) - W) > 2)) size(); lx = ly = -99; });
  });

  /* ---------- home ---------- */
  const say = $('#say');
  if (say) {
    const seen = (() => { try { return sessionStorage.getItem('acg') === '1'; } catch (e) { return false; } })();
    const base = seen ? .1 : 1.35;
    const chars = w => [...w].map(ch => '<span class="c">' + ch.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>').join('');
    say.innerHTML = say.textContent.trim().split(/\s+/).map((w, i) => '<span class="w" style="animation-delay:' + (base + i * 0.025).toFixed(3) + 's">' + chars(w) + '</span>').join(' ');
    const born0 = performance.now();
    const strip = $('#strip'), tiles = $$('.hz', strip), nws = $$('.now .nw'), go = $('#nGo'), cnt = $('#cnt');
    let cur = 0;
    const n = tiles.length, wide = matchMedia('(min-width:821px)');
    const info = i => { cur = i; const t = tiles[i]; nws.forEach((w, q) => { w.classList.toggle('on', q === i); w.setAttribute('aria-hidden', q !== i); }); if (go) go.href = t.getAttribute('href'); cnt.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0'); };
    /* The sections, and the pieces of work pinned beside them, are covers standing in a row that has no end, each a small poster of
       its own shape and size: some tall, some wide, some hung high and some low, with room between them. The wheel, anywhere on the
       page, or a drag slides the row sideways, and while it moves it turns a little, as the table of projects does. The cover the
       pointer is on, or else the first one in view, is the one named in the panel at the left. */
    const SHAPE = { d: [.72, 1.6, 1], c: [.94, .8, .5], e: [.82, 1, 1], a: [.92, .75, .2], b: [.66, 1.5, .5], f: [.7, 1.6, .7], g: [.96, .8, .15], gw: [.72, 1.5, .8] };   /* height as a share of the row, width to height, how low it hangs */
    let its = [], W = 0, T = 1, x = -10, target = -10, kk = 0, drag = null, moved = 0, touch = false, hov = -1, hq = -1, hpx = 0, opened = 0, live = false, raf = 0, lt = 0; const fh = hand();
    /* each cover is seen in its own perspective, so one at the edge of a wide screen is turned no more than one in the middle */
    const TILT = 15, PV = 'perspective(1100px) ', all = () => $$('.hz', strip);
    function layout() {
      const cs = getComputedStyle(strip), pt = parseFloat(cs.paddingTop), Hr = strip.clientHeight - pt - parseFloat(cs.paddingBottom), gap = Math.max(26, Hr * .12); W = strip.clientWidth;
      let px = 0, mw = 0; const base = tiles.map(el => { const v = SHAPE[el.dataset.v + (el.dataset.bigW ? 'w' : '')] || SHAPE[el.dataset.v] || SHAPE.e, h = Hr * v[0], w = h * v[1], o = { w, h, x: px, y: pt + (Hr - h) * v[2] }; px += w + gap; mw = Math.max(mw, w); return o; });
      const copies = Math.max(1, Math.ceil((W + mw + 140) / px));
      while (all().length < n * copies) tiles.forEach(t => { const c = t.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.tabIndex = -1; c.style.animation = 'none'; strip.append(c); });
      its = all().map((el, q) => { const b = base[q % n], on = q < n * copies; el.style.width = b.w.toFixed(1) + 'px'; el.style.display = on ? '' : 'none'; return on ? { el, i: q % n, x: b.x + Math.floor(q / n) * px, y: b.y, w: b.w, h: b.h, px: 0, t: 1, q, a: reduce ? 1 : 0 } : null; }).filter(Boolean);
      T = px * copies;
    }
    const t0 = performance.now() + (seen ? 250 : 1750);
    let hold = false;
    const frame = now => { raf = requestAnimationFrame(frame); if (!hold) step(now || performance.now()); };
    const step = now => {
      const dt = Math.min(50, now - (lt || now)); lt = now;
      if (touch && (drag !== null || fh.coast)) { target += fh.step(dt); x = target; } else x += (target - x) * (touch ? .12 : .085);
      kk += (Math.max(-1, Math.min(1, (target - x) / 700 + (touch ? fh.v * .35 : 0))) - kk) * .1;
      /* at rest every cover stands turned a little away; the one under the pointer turns to face you and its neighbours give it room */
      const hi = hq >= 0 ? its.find(o => o.q === hq) : null; if (hi) hpx = hi.px + hi.w / 2;
      opened += ((hi && drag === null ? 1 : 0) - opened) * .1;
      let first = -1, fx = 1e9;
      for (const it of its) {
        let px = ((it.x - x) % T + T) % T; if (px > W + 70) px -= T; it.px = px;
        const me = it === hi && drag === null; it.t += ((me ? 0 : 1) - it.t) * .12;
        /* arriving: the covers are dealt in from the right, one after another, each landing into its tilt */
        if (it.a < 1) { const due = t0 + Math.max(0, px) / W * 520; if (now > due) it.a = Math.min(1, it.a + (1 - it.a) * .075 + .004); const e = 1 - Math.pow(1 - it.a, 2); it.dx = (1 - e) * W * .3; it.dr = (1 - e) * 34; if (it.op !== e) { it.op = e; it.el.style.opacity = e >= .995 ? '' : e.toFixed(3); } } else if (it.dx) { it.dx = 0; it.dr = 0; it.el.style.opacity = ''; }
        if (px + it.w < -90 || px > W + 90) { if (!it.off) { it.el.style.visibility = 'hidden'; it.off = true; } continue; }
        if (it.off) { it.el.style.visibility = ''; it.off = false; }
        if (px > -it.w * .4 && px < fx) { fx = px; first = it.i; }
        const mid = px + it.w / 2, cx = mid / W * 2 - 1; let away = me ? 0 : (mid > hpx ? 1 : -1) * 26 * opened;
        if (away < 0 && px + away < 6) away = Math.min(0, 6 - px);   /* a cover at the left edge stays inside the row */
        lay(it.el, 'translate3d(' + (px + away + (it.dx || 0)).toFixed(1) + 'px,' + it.y.toFixed(1) + 'px,0) ' + PV + 'translate3d(0,0,' + ((1 - it.t) * 36 - Math.abs(kk) * cx * cx * 90).toFixed(1) + 'px) rotateY(' + (TILT * it.t + kk * 9 + (it.dr || 0)).toFixed(2) + 'deg)');
        const z = me ? 3 : 1; if (it.z !== z) { it.z = z; it.el.style.zIndex = z; }
      }
      const show = hov >= 0 ? hov : first; if (show >= 0 && show !== cur) info(show);
    };
    /* a cover with a second, wide picture (Photography) shows it on wide screens, and that is the picture that grows when it is opened */
    const pick = () => all().forEach(el => { const d = el.dataset; if (!d.bigW) return; if (!d.bigT) { d.bigT = d.big; d.imT = d.im; d.lumT = d.lum; d.posT = d.pos || '50% 50%'; }
      const w = wide.matches; d.big = w ? d.bigW : d.bigT; d.im = w ? d.imW : d.imT; d.lum = w ? d.lumW : d.lumT; d.pos = w ? d.posW : d.posT; });
    const setLive = () => {
      pick(); live = wide.matches && !reduce; strip.classList.toggle('live', live); cancelAnimationFrame(raf); raf = 0;
      if (live) { strip.setAttribute('data-drag', 'x'); layout(); raf = requestAnimationFrame(frame); }
      else { strip.removeAttribute('data-drag'); if (!flowOn) all().forEach(el => { el.style.transform = ''; el.style.width = ''; el.style.visibility = ''; el.style.zIndex = ''; }); info(0); if (!wide.matches && !flowOn && !strip._rv) { strip._rv = 1; reveal(tiles); } }
    };
    let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (live) layout(); }, 120); });
    wide.addEventListener && wide.addEventListener('change', setLive);
    addEventListener('wheel', e => { if (!live) return; e.preventDefault(); if (hold) return; target += (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1); }, { passive: false });
    addEventListener('keydown', e => { if (!live) return; const s = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (!s || hold) return; e.preventDefault(); target += s * 320; });
    strip.addEventListener('pointerdown', e => { if (!live || hold) return; drag = e.clientX; moved = 0; touch = e.pointerType !== 'mouse'; if (touch && fh.down(-e.clientX)) moved = 99; });
    addEventListener('pointermove', e => { if (drag === null) return; const d = drag - e.clientX; drag = e.clientX; moved += Math.abs(d); if (touch) { target += d; fh.move(-e.clientX); } else target += d * 1.5; });
    const drop = () => { if (drag !== null && touch) fh.up(); drag = null; };
    addEventListener('pointerup', drop); addEventListener('pointercancel', drop);
    strip.addEventListener('dragstart', e => e.preventDefault());
    strip.addEventListener('pointerover', e => { const a = e.target.closest('.hz'); hq = a && e.pointerType !== 'touch' ? all().indexOf(a) : -1; hov = hq < 0 ? -1 : hq % n; if (a && a.dataset.big && !a._pre) { a._pre = new Image(); a._pre.src = a.dataset.big; } });
    strip.addEventListener('pointerleave', () => { hov = -1; hq = -1; });
    /* a soft light follows the pointer across the cover it is on */
    strip.addEventListener('pointermove', e => { const a = e.target.closest ? e.target.closest('.hz') : null; if (!a || e.pointerType === 'touch') return; const r = a.getBoundingClientRect(); a.style.setProperty('--lx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%'); a.style.setProperty('--ly', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%'); });
    /* The opening sentence answers the pointer in three ways. Its letters grow a little heavier near the pointer, as if a hand were
       passing over them. The words that name a part of the site fill with a photograph, bring that part's cover round, and open it
       on a click. And its last phrase is rewritten every few seconds, each version naming something else being worked on. */
    try {
      let lastTouch = 0; ['wheel', 'pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { lastTouch = performance.now(); }, { passive: true }));
      const bring = ti => { if (!live || ti < 0) return; const it = its.find(o => o.i === ti && o.px > -o.w * .4 && o.px + o.w * .6 < W) || its.find(o => o.i === ti); if (!it) return; if (it.px < 0 || it.px + it.w > W) target = it.x - 60 + Math.round((x - it.x) / T) * T; return it; };
      const find = label => label ? tiles.findIndex(t => t.dataset.sec === label) : -1;
      const wire = (els, get) => {
        const on = () => { const g = get(), ti = g.ti, lite = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')) === 'light';
          /* the picture for this theme, lightened on a dark ground or darkened on a light one until it stands clear of it */
          const im = lite && g.im2 ? g.im2 : g.im, lum = Math.max(.05, (lite && g.im2 ? g.lum2 : g.lum) || .5), f = lite ? Math.max(.35, Math.min(1, .3 / lum)) : Math.max(1, Math.min(2.4, .6 / lum));
          els.forEach(w => { if (im) { w.style.backgroundImage = 'url("' + im + '")'; w.style.setProperty('--pf', f.toFixed(2)); w.classList.add('pic'); } else if (g.hollow) w.classList.add('hol'); }); const it = bring(ti); if (it) { hq = it.q; hov = ti; } };
        const off = () => { els.forEach(w => w.classList.remove('pic', 'hol')); hq = -1; hov = -1; };
        const go = () => { const { ti } = get(); if (ti >= 0) tiles[ti].click(); };
        els.forEach(w => { w.classList.add('kw'); if (get().ti >= 0 || els.length === 1 && w.classList.contains('rot')) { w.tabIndex = 0; w.setAttribute('role', 'link'); w.classList.add('go'); } w.addEventListener('pointerenter', on); w.addEventListener('pointerleave', off); w.addEventListener('focus', on); w.addEventListener('blur', off); w.addEventListener('click', go); w.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); });
      };
      const words = () => $$('.w', say), plain = () => words().map(w => w.textContent.replace(/[.,;:!?]+$/, '').toLowerCase());
      const span = phrase => { const ws = words(), pl = plain(), want = phrase.toLowerCase().split(/\s+/), at = pl.findIndex((_, q) => want.every((v, j) => pl[q + j] === v)); return at < 0 ? [] : ws.slice(at, at + want.length); };
      /* the phrase that is rewritten */
      const rc = JSON.parse(say.dataset.rot || 'null');
      if (rc && rc.phrases && rc.phrases.length > 1) {
        const grp = span(rc.find);
        if (grp.length) {
          const at0 = words().indexOf(grp[0]);
          const tail = (grp[grp.length - 1].textContent.match(/[.,;:!?]+$/) || [''])[0], rot = document.createElement('span'); rot.className = 'rot'; grp[0].before(rot); grp.forEach((g, j) => { if (j && g.previousSibling && g.previousSibling.nodeType === 3) g.previousSibling.remove(); g.remove(); });
          let ri = 0, shown = rc.phrases[0][0], busy = false, over = false;
/* The whole phrase is always set, so its line breaks are settled before a letter appears; typing only uncovers the letters
             one by one (and the full stop last), and deleting covers them again. A word therefore never starts on one line and jumps to the next. */
          let full = shown, vis = [...shown].length + 1;
          const show = () => { const cs = $$('.c', rot); cs.forEach((c, q) => { c.classList.toggle('h', q >= vis); c.classList.toggle('cur', q === vis - 1); }); };
          /* while the sentence is arriving, the words of the phrase come up in their turn with the rest (and carry on from where they were if the phrase is set again meanwhile) */
          const enter = j => { const d = base + (at0 + j) * .025 - (performance.now() - born0) / 1000; return d > -1.2 ? ' style="animation:rise 1.2s var(--ease) both ' + d.toFixed(3) + 's"' : ''; };
          const put = (t, n) => { full = t; const ws = t.split(' '); rot.innerHTML = ws.map((w, j) => '<span class="w"' + enter(j) + '>' + chars(w) + (j === ws.length - 1 ? '<span class="c tl">' + tail + '</span>' : '') + '</span>').join(' '); vis = n === undefined ? [...t].filter(ch => ch !== ' ').length + 1 : n; show(); };
/* on a phone the sentence keeps room for its longest version, so nothing below it moves while the phrase is rewritten */
          const reserve = () => { say.style.minHeight = ''; if (wide.matches) return; const keep = full, kv = vis; let m = 0; rc.phrases.forEach(ph => { put(ph[0]); m = Math.max(m, say.offsetHeight); }); put(keep, kv); say.style.minHeight = m + 'px'; };
          put(shown); reserve(); let rv = 0; addEventListener('resize', () => { clearTimeout(rv); rv = setTimeout(reserve, 150); }); document.fonts && document.fonts.ready && document.fonts.ready.then(reserve);
          wire([rot], () => { const ti = find(rc.phrases[ri][1]); return { ti, im: '', hollow: true }; });
          rot.addEventListener('pointerenter', () => { over = true; }); rot.addEventListener('pointerleave', () => { over = false; });
          const retype = to => new Promise(done => {
            let fresh = false; const total = () => $$('.c', rot).length;
            const tick = () => {
              if (!fresh) { if (vis > 0) { vis--; show(); return setTimeout(tick, 14); } fresh = true; put(to, 0); shown = to; return setTimeout(tick, 120); }
              if (vis < total()) { vis++; show(); return setTimeout(tick, 34); }
              done();
            }; tick();
          });
          /* one phrase after another without a rest, only long enough to be read */
          const wait = ms => new Promise(r => setTimeout(r, ms));
          if (!reduce) (async () => { await wait(seen ? 2600 : 4200); for (;;) { if (over || hold || document.hidden || leaving) { await wait(300); continue; } ri = (ri + 1) % rc.phrases.length; rot.classList.add('typing'); await retype(rc.phrases[ri][0]); await wait(1100); } })();
        }
      }
      JSON.parse(say.dataset.keys || '[]').forEach(([phrase, label, im, lum, im2, lum2]) => { const grp = span(phrase), ti = find(label); if (grp.length && (ti >= 0 || im)) wire(grp, () => ({ ti, im: im || (ti >= 0 ? tiles[ti].dataset.im : ''), lum: im ? lum : (ti >= 0 ? +tiles[ti].dataset.lum : 0), im2, lum2 })); });
      /* weight: each letter is as heavy as the pointer is near */
      if (!reduce && matchMedia('(hover:hover) and (pointer:fine)').matches) {
        let wx = -1, wy = -1, wt = false, lit = [];
        const run = () => {
          wt = false; const R = Math.max(90, parseFloat(getComputedStyle(say).fontSize) * 2.2), next = [];
          const sr = say.getBoundingClientRect(), near = wx > sr.left - R && wx < sr.right + R && wy > sr.top - R && wy < sr.bottom + R;
          if (near) for (const c of $$('.c', say)) { const r = c.getBoundingClientRect(), d = Math.hypot(wx - (r.left + r.width / 2), wy - (r.top + r.height / 2)); if (d < R) { const f = 1 - d / R; c.style.fontWeight = Math.round(600 + 200 * f * f * (3 - 2 * f)); next.push(c); } }
          for (const c of lit) if (!next.includes(c)) c.style.fontWeight = '';
          lit = next;
        };
        addEventListener('pointermove', e => { wx = e.clientX; wy = e.clientY; if (!wt) { wt = true; requestAnimationFrame(run); } }, { passive: true });
      }
    } catch (e) { console.warn(e); }
    strip.addEventListener('focusin', e => { const it = its.find(o => o.el === e.target); if (live && it && e.target.matches(':focus-visible')) target = it.x - 40 + Math.round((x - it.x) / T) * T; });
    strip.addEventListener('click', e => { const a = e.target.closest('.hz'); if (!a) return; if (live && moved > 8 || flowOn && fmoved > 8) { e.preventDefault(); return; } if (a.dataset.title && pzd && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); if (!selH) showH(a); return; } leave(a, $('.zp', a) || a, e); });
    /* The pinned pieces of work are not self-explanatory, so their covers open first to say what they are: the rest of the row moves
       back and out of focus, the cover comes forward, and its details stand beside it with a button into the work itself. */
    const pzd = $('#pzd'), pzc = $('#pzc'), pzv = $('#pzv'), pzr = $('#pzr'), grid = $('main.grid'); let selH = null, th1 = 0, th2 = 0;
    const showH = a => {
      if (leaving) return; selH = a; clearTimeout(th1); clearTimeout(th2); const d = a.dataset, ext = !!d.ext;
      $('.pzm', pzd).textContent = d.meta; const h = $('.pzt', pzd); h.textContent = d.title; h.classList.toggle('lg', d.title.length > 34); $('.pzs', pzd).textContent = d.sum;
      fillGo(pzv, d, ext); pzv.dataset.sec = d.sec; pzv._go = !ext && !d.flat;
      pzr.hidden = !d.repo; if (d.repo) pzr.href = d.repo;
      pzd.hidden = false; pzc.hidden = false; grid.classList.add('open'); strip.classList.remove('shut');
      if (live) {
        hold = true; hq = -1; hov = -1; strip.classList.add('anim', 'open', 'lift'); strip.offsetWidth;
        const it = its.find(o => o.el === a), sr = strip.getBoundingClientRect(), st = $('.stage').getBoundingClientRect(), top = ($('.top') || {}).offsetHeight || 48, sw = innerWidth - st.left;
        const k2 = Math.min(sw * .44 / it.w, (innerHeight - top - 90) / it.h), w = it.w * k2, hh = it.h * k2, cx = st.left + sw * .26, cy = top + (innerHeight - top) / 2;
        /* the cover is turned about its middle, so it is placed by its middle; it goes there at its full size, drawn sharp all the way */
        grow(a, it.w, it.h, k2, { mid: true });
        a.style.transform = 'translate3d(' + (cx - sr.left - w / 2).toFixed(1) + 'px,' + (cy - sr.top - hh / 2).toFixed(1) + 'px,0)'; a.style.zIndex = 6; a.classList.add('sel');
        /* the others step back; one that reaches past the left end of the row is put out of sight, so that it does not lie over the panel beside it */
        for (const o of its) if (o.el !== a && !o.off) { o.el.style.transform = 'translate3d(' + o.px.toFixed(1) + 'px,' + o.y.toFixed(1) + 'px,0) ' + PV + 'translate3d(0,0,-460px) rotateY(' + TILT + 'deg)'; o.el.classList.toggle('out', o.px < 0); }
        pzd.style.left = (st.left + sw * .52).toFixed(0) + 'px';
      } else { pzd.style.left = ''; hush(1); sheet.open(pzd, a); }
      requestAnimationFrame(() => requestAnimationFrame(() => { pzd.classList.add('in'); pzc.classList.add('in'); }));
      setTimeout(() => { if (selH === a) pzv.focus({ preventScroll: true }); }, 60);
    };
    const closeH = () => {
      if (!selH) return; const a = selH; clearTimeout(th1); clearTimeout(th2);
      pzd.classList.remove('in'); pzc.classList.remove('in'); grid.classList.remove('open'); a.classList.remove('sel'); strip.classList.remove('open');
      if (live) { strip.classList.add('shut'); for (const o of its) { o.t = 1; o.el.classList.remove('out'); } step(performance.now()); th2 = setTimeout(() => { strip.classList.remove('anim', 'lift', 'shut'); shrink(a); a.style.zIndex = ''; hold = false; selH = null; }, T_CLOSE + 40); }
      else { hush(0); selH = null; sheet.close(pzd, a); }
      th1 = setTimeout(() => { pzd.hidden = true; pzc.hidden = true; }, live ? 500 : T_CLOSE);
    };
    if (pzd) {
      pzc.addEventListener('click', e => { e.stopPropagation(); closeH(); });
      document.addEventListener('click', e => { if (selH && grid.classList.contains('open') && !e.target.closest('.hz.sel,.pzi,.pzc')) closeH(); });
      addEventListener('keydown', e => { if (e.key === 'Escape') closeH(); });
      pzv.addEventListener('click', e => { if (pzv._go && selH) { hush(0); leave(pzv, $('.zp', selH) || selH, e); } });
      addEventListener('pageshow', e => { if (e.persisted) closeH(); });
    }
    /* On a phone, when it may move, the first page is one screen, as the row is on a wide one: the covers flow up it in a column that has no
       end, a little at a time on their own, and a finger takes them exactly as far as it goes and throws them. A line across the middle names
       the cover passing it, with the way into it, and the covers pass under that line. The page itself does not scroll. Without motion, or
       without this script, the covers are simply stacked. */
    const band = strip.parentNode, fq = matchMedia('(max-width:820px)'), gh = hand(), FW = [.66, .54, .7, .58, .62, .52], FX = [.08, .9, .3, 1, .02, .62];
    let flowOn = false, fits = [], FT = 1, fy = null, fdrag = null, fmoved = 0, fk = 0, flt = 0, fidle = 0, fborn = 0, fa = 0, fcur = -1, fat = null, fraf = 0, fW = 0, fH = 0;
    const cap = document.createElement('div'); cap.className = 'fcap'; cap.innerHTML = '<span class="fl"><span class="fk"></span><span class="fn"></span></span><a href="/">Open →</a>';
    const fkn = $('.fk', cap), fnm = $('.fn', cap), fgo = $('a', cap);
    const flowLay = () => {
      const W = band.clientWidth, VH = band.clientHeight, g = parseFloat(getComputedStyle(band).paddingLeft) || 16, gap = Math.max(26, VH * .055); if (!W || !VH) return; fW = W; fH = VH;
      let py = 0, mh = 0; const base = tiles.map((el, i) => { let w = W * FW[i % FW.length]; el.style.width = w.toFixed(1) + 'px'; let h = el.offsetHeight;
        if (h > VH * .58) { w *= VH * .58 / h; el.style.width = w.toFixed(1) + 'px'; h = el.offsetHeight; }
        const o = { w, h, x: g + (W - 2 * g - w) * FX[i % FX.length], y: py }; py += h + gap; mh = Math.max(mh, h); return o; });
      const copies = Math.max(2, Math.ceil((VH * 2 + mh) / py));
      while (all().length < n * copies) tiles.forEach(t => { const c = t.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.tabIndex = -1; c.style.animation = 'none'; strip.append(c); });
      const old = fits; fits = all().map((el, q) => { const b = base[q % n], on = q < n * copies; el.style.width = b.w.toFixed(1) + 'px'; el.style.display = on ? '' : 'none'; const was = old.find(o => o.el === el);
        return on ? { el, i: q % n, x: b.x, y: b.y + Math.floor(q / n) * py, w: b.w, h: b.h, a: was ? was.a : 0, off: was ? was.off : false } : null; }).filter(Boolean);
      FT = py * copies; if (fy === null) fy = base[0].y - VH * .14;   /* the first cover begins across the middle line, so that the line names it at once */
    };
    const name = it => { fat = it.el; if (it.i === fcur) return; fcur = it.i; const t = tiles[it.i]; fkn.textContent = String(it.i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0'); fnm.textContent = t.dataset.in || t.dataset.sec; fgo.href = t.getAttribute('href'); };
    const flowStep = now => {
      fraf = requestAnimationFrame(flowStep); const dt = Math.min(50, now - (flt || now)); flt = now;
      if (selH || leaving || !fits.length) return;
      /* held or thrown it goes as the finger sends it; left alone a while, it takes up its own slow drift again, gently */
      if (fdrag !== null || gh.coast) { fy += gh.step(dt); fidle = now; fa = 0; }
      else if (now > fidle + 1600 && !document.hidden) { fa = Math.min(1, fa + dt / 1200); fy += dt * .022 * fa; }
      fk += (Math.max(-1, Math.min(1, fdrag !== null || gh.coast ? gh.v * .3 : 0)) - fk) * .1;
      const VH = fH, mid = VH / 2; let at = null;
      for (const it of fits) {
        let py = ((it.y - fy) % FT + FT) % FT; if (py > VH + 60) py -= FT;
        if (py + it.h < -60 || py > VH + 60) { if (!it.off) { it.el.style.visibility = 'hidden'; it.off = true; } continue; }
        if (it.off) { it.el.style.visibility = ''; it.off = false; }
        if (py <= mid && py + it.h >= mid) at = it;
        /* arriving: the covers come up into the column one after another, from the top */
        let up = 0; if (it.a < 1) { if (now > fborn + Math.max(0, py) / VH * 520) it.a = Math.min(1, it.a + (1 - it.a) * .075 + .004); const e = 1 - Math.pow(1 - it.a, 2); up = (1 - e) * VH * .22; it.el.style.opacity = it.a >= 1 ? '' : e.toFixed(3); }
        const cy = (py + it.h / 2) / VH * 2 - 1;
        it.el.style.transform = 'translate3d(' + it.x.toFixed(1) + 'px,' + (py + up).toFixed(1) + 'px,' + (-Math.abs(fk) * cy * cy * 80).toFixed(1) + 'px) rotateX(' + (-fk * cy * 8).toFixed(2) + 'deg)';
      }
      if (at) name(at);   /* between two covers the line keeps the name it had */
    };
    band.addEventListener('pointerdown', e => { if (!flowOn || selH || e.target.closest('.fcap a')) return; fdrag = e.clientY; fmoved = 0; if (gh.down(-e.clientY)) fmoved = 99; });
    addEventListener('pointermove', e => { if (fdrag === null) return; const d = fdrag - e.clientY; fdrag = e.clientY; fmoved += Math.abs(d); fy += d; gh.move(-e.clientY); });
    const fdrop = () => { if (fdrag === null) return; gh.up(); fdrag = null; fidle = performance.now(); };
    addEventListener('pointerup', fdrop); addEventListener('pointercancel', fdrop);
    band.addEventListener('wheel', e => { if (!flowOn) return; e.preventDefault(); fy += e.deltaY * (e.deltaMode === 1 ? 32 : 1); fidle = performance.now(); fa = 0; }, { passive: false });
    fgo.addEventListener('click', e => { e.preventDefault(); fmoved = 0; if (fat && fat.isConnected) fat.click(); });
    const setFlow = () => {
      const on = fq.matches && !reduce; if (on === flowOn) return; flowOn = on; document.body.classList.toggle('flow', on); strip.classList.toggle('flow', on); cancelAnimationFrame(fraf); fraf = 0;
      if (on) { band.append(cap); flowLay(); fborn = performance.now() + (seen ? 250 : 1750); fidle = fborn + 1400; fraf = requestAnimationFrame(flowStep); }
      else { cap.remove(); fits = []; if (!live) all().forEach(el => { el.style.transform = ''; el.style.width = ''; el.style.visibility = ''; el.style.opacity = ''; }); }
    };
    /* laid out again whenever the room changes: the sentence above settles its height as its type arrives */
    const refit = () => { if (flowOn && (band.clientWidth !== fW || band.clientHeight !== fH)) flowLay(); };
    if ('ResizeObserver' in window) new ResizeObserver(refit).observe(band); else addEventListener('resize', refit);
    fq.addEventListener && fq.addEventListener('change', setFlow);
    setFlow();
    setLive();
    /* ACG: the blocks start large in the middle, then fall, bounce and settle in the corner (first visit of a session only) */
    const veil = $('#veil'), ps = $$('#acg .p');
    if (reduce || seen || !veil.animate) veil.style.visibility = 'hidden';
    else {
      try { sessionStorage.setItem('acg', '1'); } catch (e) {}
      const vw = innerWidth, vh = innerHeight, D = 1500, hold = 1000, spin = [0, -384, 360];
      opening = true; setTimeout(() => { opening = false; }, hold + 2 * 130 + D + 500);   /* and in any case once the fall must be long over */
      const w0 = ps[0].getBoundingClientRect().width, S = Math.min(vh * .3, vw * .24) / w0;
      if (w0) ps.forEach((p, i) => {
        const r = p.getBoundingClientRect(), dx = vw / 2 + (i - 1) * w0 * S * 1.08 - (r.left + r.width / 2), dy = vh * .44 - (r.top + r.height / 2);
        const delay = hold + i * 130, up = Math.abs(dy), In = 'cubic-bezier(.5,0,1,.6)', Out = 'cubic-bezier(0,.4,.5,1)';
        p.animate([{ transform: 'translateY(' + dy + 'px)', easing: In }, { transform: 'translateY(0)', offset: .46, easing: Out }, { transform: 'translateY(' + (-up * .13) + 'px)', offset: .62, easing: In }, { transform: 'translateY(0)', offset: .78, easing: Out }, { transform: 'translateY(' + (-up * .03) + 'px)', offset: .88, easing: In }, { transform: 'translateY(0)' }], { duration: D, delay, fill: 'backwards' }).onfinish = () => { if (i === ps.length - 1) opening = false; };   /* the last block to land frees all three */
        p.firstElementChild.animate([{ transform: 'translateX(' + dx + 'px) scale(' + S + ')' }, { transform: 'translateX(0) scale(1)' }], { duration: D * .8, delay, easing: 'cubic-bezier(.3,.2,.3,1)', fill: 'backwards' });
        p.firstElementChild.firstElementChild.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(' + spin[i] + 'deg)' }], { duration: D * .95, delay, easing: 'cubic-bezier(.2,.5,.3,1)', fill: 'both' });
      });
      veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, delay: hold + 150, fill: 'forwards', easing: 'ease' });
    }
  }

  /* the small portrait (in the corner of the first page, at the top of About): when the page opens its pictures flash by once, quickly,
     and it comes to rest on the last one and stays there */
  {
    const slot = $('#face'), ims = slot ? $$('img', slot) : [];
    if (ims.length > 1 && !reduce) {
      const rest = ims.length - 1; let fi = rest;
      const show = j => { if (j === fi) return; ims[fi].classList.remove('on'); fi = j; ims[fi].classList.add('on'); };
      let first = false; try { first = document.body.classList.contains('home') && sessionStorage.getItem('acg') !== '1'; } catch (e) {}
      const order = []; for (let r = 0; r < 2; r++) for (let q = 0; q < rest; q++) order.push(q);
      /* every change is a cut, the last one too: nothing fades. The pictures are made ready first, so that no cut lands on an empty frame. */
      const ready = Promise.all(ims.map(i => i.decode ? i.decode().catch(() => {}) : 0));
      setTimeout(() => ready.then(() => { let n = 0; (function step() { if (n >= order.length) { show(rest); return; } show(order[n++]); setTimeout(step, 95 + n * 9); })(); }), first ? 3000 : document.documentElement.classList.contains('came') ? 2600 : 700);
    }
  }

  /* the ACG blocks hop and spin when the pointer touches them, on every page */
  $$('.acg .p').forEach(p => {
    const i = [...p.parentNode.children].indexOf(p);
      const svg = $('svg', p); let busy = false, turn = 0;
      const hop = h => {
        if (busy || reduce || opening) return; busy = true; turn += (i === 0 ? 0 : (Math.random() < .5 ? -1 : 1) * (i === 1 ? 200 : 90));
        p.animate([{ transform: 'translateY(0)', easing: 'cubic-bezier(0,.5,.5,1)' }, { transform: 'translateY(' + -h + 'px)', offset: .4, easing: 'cubic-bezier(.5,0,1,.6)' }, { transform: 'translateY(0)', offset: .8, easing: 'cubic-bezier(0,.5,.5,1)' }, { transform: 'translateY(' + -h * .12 + 'px)', offset: .9, easing: 'cubic-bezier(.5,0,1,.6)' }, { transform: 'translateY(0)' }], { duration: 700 + h * 2 }).onfinish = () => { busy = false; };
        svg.animate([{ transform: 'rotate(' + turn + 'deg)' }], { duration: 600 + h * 2, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' });
        if (i === 0) svg.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-9deg)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(0)' }], { duration: 700 });
      };
      p.addEventListener('pointerenter', () => hop(46));
      if (!p.closest('a')) p.addEventListener('click', () => { if (opening) return; busy = false; hop(150); });
    });

  /* slow drift: rows and covers move a little against the scroll */
  const pars = $$('[data-sp]');
  if (pars.length && !reduce && matchMedia('(min-width: 821px)').matches) {
    let tk = false;
    const run = () => { tk = false; const vh = innerHeight; pars.forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom < -300 || r.top > vh + 300) return; const c = r.top - (el._ty || 0) + r.height / 2 - vh / 2; el._ty = c * parseFloat(el.dataset.sp); el.style.transform = 'translate3d(0,' + el._ty.toFixed(1) + 'px,0)'; }); };
    addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(run); } }, { passive: true }); run();
  }
  /* chapter strip: marks the chapter in view */
  const cn = $$('.chapnav a');
  if (cn.length && 'IntersectionObserver' in window) {
    const io2 = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) cn.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-30% 0px -60% 0px' });
    $$('.chap').forEach(c => io2.observe(c));
  }

  /* strips that scroll sideways take the mouse wheel */
  $$('[data-strip]').forEach(s => s.addEventListener('wheel', e => {
    if (s.scrollWidth <= s.clientWidth + 2 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const end = e.deltaY > 0 ? s.scrollLeft + s.clientWidth >= s.scrollWidth - 2 : s.scrollLeft <= 0;
    if (!end) { s.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false }));

  /* photographs wipe in as they come into view */
  reveal($$('.ph .open').filter(f => !f.closest('[data-field]')));

  /* endless wall of photographs */
  const field = $('[data-field]');
  if (field && !reduce) {
    document.body.classList.add('fieldlive'); field.classList.add('live'); field.setAttribute('data-drag', 'y');
    const rnd = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
    const base = $$('.ph', field), root = document.documentElement, fh = hand(); let its = [], W = 0, VH = 0, H = 1, y = 0, target = 0, k = 0, maxH = 0, intro = !root.classList.contains('came'), born = 0, lt = 0;
    function layout() {
      W = field.clientWidth; VH = field.clientHeight;
      const want = +field.dataset.cols || 3, cols = W < 620 ? 2 : W < 1000 ? Math.min(3, want) : want, pad = W * .035, cw = (W - pad * 2) / cols;
      const build = n => {           /* n copies of the set, hung column by column */
        while ($$('.ph', field).length < base.length * n) base.forEach(b => { const c = b.cloneNode(true); c.setAttribute('aria-hidden', 'true'); $('.open', c).tabIndex = -1; field.append(c); });
        const hs = Array.from({ length: cols }, (_, c) => rnd(c, 9) * cw * .5); its = []; maxH = 0;
        $$('.ph', field).slice(0, base.length * n).forEach((el, i) => {
          const ar = parseFloat(el.style.getPropertyValue('--ar')) || 1.5, c = hs.indexOf(Math.min(...hs));
          const w = cw * (ar > 1.2 ? .74 + rnd(i, 1) * .2 : .54 + rnd(i, 1) * .2), h = w / ar, x = pad + c * cw + (cw - w) * rnd(i, 2), top = hs[c] + cw * (.1 + rnd(i, 3) * .22);
          el.style.width = w.toFixed(1) + 'px'; hs[c] = top + h; maxH = Math.max(maxH, h); its.push({ el, x, y: top, w, h, a: intro ? 0 : 1 });
        });
        H = Math.max(...hs) + cw * .14;
      };
      let n = 1; build(n); while (H < VH * 1.5 + maxH + 80 && n < 8) build(++n);
    }
    layout(); intro = false; addEventListener('resize', layout);
    /* every photograph of the wall is fetched once the page stands, so that none is still arriving while the wall is thrown past it */
    addEventListener('load', () => setTimeout(() => $$('img[loading=lazy]', field).forEach(im => { im.loading = 'eager'; }), 400), { once: true });
    /* the wall opens on its first frame, close under the heading */
    y = target = Math.min(...its.map(o => o.y)) - 26;
    const push = d => { target += d; };
    field.addEventListener('wheel', e => { e.preventDefault(); push(e.deltaY * (e.deltaMode === 1 ? 32 : 1)); }, { passive: false });
    let drag = null, moved = 0, touch = false;
    field.addEventListener('pointerdown', e => { drag = e.clientY; moved = 0; touch = e.pointerType !== 'mouse'; if (touch && fh.down(-e.clientY)) moved = 99; });
    field.addEventListener('dragstart', e => e.preventDefault());      /* a press on a picture moves the wall; it does not pick the picture up */
    addEventListener('pointermove', e => { if (drag === null) return; const d = drag - e.clientY; drag = e.clientY; moved += Math.abs(d); if (touch) { push(d); fh.move(-e.clientY); } else push(d * 1.6); });
    /* a finger moves the wall directly, and a flick keeps it going */
    const drop = () => { if (drag !== null && touch) fh.up(); drag = null; };
    addEventListener('pointerup', drop); addEventListener('pointercancel', drop);
    field.addEventListener('click', e => { if (moved > 8) { e.stopPropagation(); e.preventDefault(); } }, true);
    addEventListener('keydown', e => { if ($('#lbx.open')) return; const s = { ArrowDown: 160, ArrowUp: -160, PageDown: VH * .8, PageUp: -VH * .8, ' ': VH * .8 }[e.key]; if (s && (document.activeElement === field || document.activeElement === document.body || field.contains(document.activeElement))) { push(s); e.preventDefault(); } });
    field.addEventListener('focusin', e => { const it = its.find(o => o.el.contains(e.target)); if (it) target = it.y + it.h / 2 - VH / 2 + Math.round((y - it.y) / H) * H; });
    (function frame(now) {
      now = now || performance.now(); if (!born) born = now + 140;
      const dt = Math.min(50, now - (lt || now)); lt = now;
      if (touch && (drag !== null || fh.coast)) { target += fh.step(dt); y = target; } else y += (target - y) * (touch ? .12 : .085);
      k += (Math.max(-1, Math.min(1, (target - y) / 700 + (touch ? fh.v * .35 : 0))) - k) * .1;      /* + scrolling down: the wall bows away; − scrolling up: it bows towards you */
      for (const it of its) {
        let py = ((it.y - y) % H + H) % H; if (py > VH + 40) py -= H;
        if (py + it.h < -60 || py > VH + 60) { if (!it.off) { it.el.style.visibility = 'hidden'; it.off = true; } if (it.a < 1) { it.a = 1; it.el.style.opacity = ''; } continue; }
        if (it.off) { it.el.style.visibility = ''; it.off = false; }
        /* arriving: the frames come up onto the wall one after another, from the top */
        let up = 0; if (it.a < 1) { if (now > born + Math.max(0, py) / VH * 460 + it.x / W * 200) it.a = Math.min(1, it.a + (1 - it.a) * .07 + .004); const e = 1 - Math.pow(1 - it.a, 2); up = (1 - e) * 64; it.el.style.opacity = it.a >= 1 ? '' : e.toFixed(3); }
        const cx = (it.x + it.w / 2) / W * 2 - 1, cy = (py + it.h / 2) / VH * 2 - 1, r2 = cx * cx + cy * cy;
        it.el.style.transform = 'translate3d(' + it.x.toFixed(1) + 'px,' + (py + up).toFixed(1) + 'px,' + (-k * r2 * 300).toFixed(1) + 'px) rotateX(' + (k * cy * 34).toFixed(2) + 'deg) rotateY(' + (-k * cx * 30).toFixed(2) + 'deg)';
      }
      requestAnimationFrame(frame);
    })();
  }

  /* Projects: the covers lie loosely on a table that has no end; the wheel or a drag moves it along, and while it moves it bows a
     little, as the wall of photographs does but more gently. The covers also drift slightly against the pointer. Choosing one sends
     the rest back and out of focus, brings the chosen cover forward to the left and sets its details beside it, with a button into
     the project itself. On a phone the covers are simply stacked and the details open as a sheet. */
  const lab = $('#lab');
  if (lab) {
    const pzd = $('#pzd'), pzc = $('#pzc'), main = lab.closest('main'), pzv = $('#pzv'), pzr = $('#pzr'), big = matchMedia('(min-width:821px)');
    /* the stories on the Photography page, once there are more than are seen at once, lie on such a table too: it fills the left half
       and moves, while the genres beside it stay. That needs the two halves side by side and a window tall enough to hold them. */
    const loose = lab.hasAttribute('data-loose');
    const live = (loose ? matchMedia('(min-width:960px) and (min-height:560px)').matches : big.matches) && !reduce && !lab.hasAttribute('data-still'), base = $$('.pz', lab);
    let sel = null, t1 = 0, t2 = 0, its = [], W = 0, VH = 0, H = 1, y = 0, target = 0, k = 0, mx = 0, my = 0, pmx = 0, pmy = 0, drag = null, moved = 0, touch = false, intro = true, born = 0, hvEl = null, lt = 0; const fh = hand();
    const all = () => $$('.pz', lab), root = document.documentElement;
    const settle = o => { o.a = 1; o.el.style.opacity = ''; o.el.style.transition = ''; };   /* a cover that has arrived answers to the page's own rules again */
    const filters = $$('.filters button');
    filters.forEach(b => b.addEventListener('click', () => {
      filters.forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      all().forEach(c => c.classList.toggle('off', !!b.dataset.f && !c.dataset.types.split(' ').includes(b.dataset.f)));
    }));
    const tf = (it, z, extra) => 'translate3d(' + (it.x + pmx * it.dp).toFixed(1) + 'px,' + (it.py + pmy * it.dp).toFixed(1) + 'px,' + z.toFixed(1) + 'px)' + (extra || '');
    function layout() {
      W = lab.clientWidth; VH = lab.clientHeight;
      /* each cover keeps the place it was given when the page was made (Projects: rows of three and two; stories: two loose columns),
         in hundredths of the width; the whole arrangement repeats below itself */
      const u = W / 100, n0 = base.length, per = (parseFloat(lab.style.getPropertyValue('--h')) + 7) * u;
      let n = 1; while (per * n < VH * 1.5 + W * .5 && n < 8) n++;
      while (all().length < n0 * n) base.forEach(b => { const c = b.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.tabIndex = -1; lab.append(c); });
      its = all().slice(0, n0 * n).map((el, i) => { const b = base[i % n0].style, g = v => parseFloat(b.getPropertyValue(v)) || 0, w = g('--w') * u; el.style.width = w.toFixed(1) + 'px';
        return { el, x: g('--l') * u, y: Math.floor(i / n0) * per + (g('--t') + 1.5) * u, w, h: w * (el.offsetHeight / Math.max(1, el.offsetWidth) || 1), dp: g('--dp') || 12, py: 0, a: intro ? 0 : 1 }; });
      H = per * n;
    }
    const place = () => {
      if (!sel) return; const c = sel;
      if (live) {
        /* the left half of the table, as large as fits */
        const it = its.find(o => o.el === c); let k2, w, h, pos;
        if (loose) {
          /* the table is only half the window here: the cover goes to the left of the window, as a story's cover always has */
          const lr = lab.getBoundingClientRect(), top = ($('.top') || {}).offsetHeight || 60, availH = innerHeight - top - 60;
          /* a cover chosen while it hung over the table's edge is first counted as lying wholly on it, so that it has a whole place to go back to;
             and those left hanging over an edge are put out of sight while the edges are open, or the hidden part of them would show */
          const m = 14, d = it.h > VH - 2 * m ? 0 : it.py < m ? it.py - m : it.py + it.h > VH - m ? it.py + it.h - (VH - m) : 0;
          if (d) { y += d; target = y; for (const o of its) { o.py -= d; if (o.off && o.py + o.h > 0 && o.py < VH) o.a = 0; } }
          for (const o of its) o.el.classList.toggle('edge', o !== it && !o.off && (o.py < -1 || o.py + o.h > VH + 1));
          k2 = Math.min((innerWidth * .5 - 80) / it.w, availH / it.h); w = it.w * k2; h = it.h * k2;
          pos = 'translate3d(' + (innerWidth * .27 - w / 2 - lr.left).toFixed(1) + 'px,' + (top + 30 + (availH - h) / 2 - lr.top).toFixed(1) + 'px,0)';
          lab.style.perspectiveOrigin = (innerWidth / 2 - lr.left).toFixed(0) + 'px ' + (innerHeight / 2 - lr.top).toFixed(0) + 'px';
        } else { k2 = Math.min((W * .5 - 80) / it.w, (VH - 56) / it.h); w = it.w * k2; h = it.h * k2; pos = 'translate3d(' + (W * .27 - w / 2).toFixed(1) + 'px,' + ((VH - h) / 2).toFixed(1) + 'px,0)'; }
        /* it goes there at its full size, drawn sharp all the way, not magnified */
        if (c._big) { c._big = null; c.style.width = it.w.toFixed(1) + 'px'; }   /* the window has changed size while it stood forward: it is measured afresh */
        grow(c, it.w, it.h, k2); c.style.transform = pos;
        for (const o of its) if (o.el !== c && !o.off) o.el.style.transform = tf(o, -460);
        return;
      }
      if (!big.matches) return;
      /* posters that lie still (the stories on the Photography page): the chosen one is sent from where it lies to the left of the window */
      shrink(c);
      const was = c.style.transition; c.style.transition = 'none'; c.style.transform = 'none';
      const r = c.getBoundingClientRect(), top = ($('.top') || {}).offsetHeight || 60, availH = innerHeight - top - 60, availW = innerWidth * .5 - 80;
      const k2 = Math.min(availW / r.width, availH / r.height), w = r.width * k2, h = r.height * k2, x = innerWidth * .27 - w / 2, yy = top + 30 + (availH - h) / 2;
      const move = 'translate3d(' + (x - r.left).toFixed(1) + 'px,' + (yy - r.top).toFixed(1) + 'px,0)';
      c.style.setProperty('--to', move);
      const lr = lab.getBoundingClientRect(); lab.style.perspectiveOrigin = (innerWidth / 2 - lr.left).toFixed(0) + 'px ' + (innerHeight / 2 - lr.top).toFixed(0) + 'px';
      /* set at its full size and shown as small as it lay (the page's rules reduce it by --sc), then sent on its way: sharp from the start */
      c.style.transform = ''; grow(c, r.width, r.height, k2, { still: true }); c.offsetWidth; c.style.transition = was;
    };
    const close = () => {
      if (!sel) return; const c = sel; clearTimeout(t1); clearTimeout(t2);
      lab.classList.add('shut'); lab.classList.remove('open'); main.classList.remove('open'); document.body.classList.remove('labopen'); c.classList.remove('sel'); pzd.classList.remove('in'); pzc.classList.remove('in');
      if (live) { for (const o of its) if (!o.off) lay(o.el, tf(o, 0)); target = y; t2 = setTimeout(() => { lab.classList.remove('anim', 'shut'); shrink(c); sel = null; if (loose) { lab.style.perspectiveOrigin = ''; for (const o of its) o.el.classList.remove('edge'); } }, T_CLOSE + 40); }
      else { sel = null; hush(0); if (!big.matches) sheet.close(pzd, c);
        /* the cover is put back as it was only once it has really arrived: should anything have set it off again on the way, that is waited for */
        const fin = () => { lab.classList.remove('shut'); shrink(c); };
        t2 = setTimeout(() => { const run = c.getAnimations ? c.getAnimations().filter(a => a.transitionProperty === 'transform' && a.playState === 'running') : []; if (run.length) Promise.all(run.map(a => a.finished)).then(fin, fin); else fin(); }, T_CLOSE + 40); }
      t1 = setTimeout(() => { pzd.hidden = true; pzc.hidden = true; }, big.matches ? 500 : T_CLOSE); if (!c.hasAttribute('aria-hidden')) c.focus({ preventScroll: true });
    };
    const show = c => {
      if (sel || leaving) return; sel = c; clearTimeout(t1); clearTimeout(t2); lab.classList.remove('shut');
      const d = c.dataset, ext = !!d.ext;
      $('.pzm', pzd).textContent = d.meta; const h = $('.pzt', pzd); h.textContent = d.title; h.classList.toggle('lg', d.title.length > 34); $('.pzs', pzd).textContent = d.sum;
      fillGo(pzv, d, ext); pzv.dataset.sec = d.title; pzv._go = !ext && !!d.im && !d.flat;
      pzr.hidden = !d.repo; if (d.repo) pzr.href = d.repo;
      pzd.hidden = false; pzc.hidden = false;
      if (live) { its.forEach(o => { if (o.a < 1) settle(o); }); lab.classList.add('anim'); lab.offsetWidth; } else hush(1);
      if (!live) place(); c.classList.add('sel'); lab.classList.add('open'); main.classList.add('open'); document.body.classList.add('labopen'); if (live) place();
      if (!big.matches) sheet.open(pzd, c);
      requestAnimationFrame(() => requestAnimationFrame(() => { pzd.classList.add('in'); pzc.classList.add('in'); }));
      setTimeout(() => { if (sel === c) pzv.focus({ preventScroll: true }); }, 60);
    };
    lab.addEventListener('click', e => { const c = e.target.closest('.pz'); if (!c || sel === c || moved > 8) return; e.stopPropagation(); show(c); });
    pzc.addEventListener('click', e => { e.stopPropagation(); close(); });
    document.addEventListener('click', e => { if (sel && lab.classList.contains('open') && !e.target.closest('.pz.sel,.pzi,.pzc')) close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && sel) close(); });
    /* into the project: its picture grows to fill the window, as everywhere else */
    pzv.addEventListener('click', e => { if (pzv._go && sel) { hush(0); leave(pzv, $('.zp', sel) || sel, e); } });
    addEventListener('pageshow', e => { if (e.persisted && sel) close(); });
    if (!reduce) addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; if (!live && big.matches && !sel && !lab.classList.contains('shut')) { lab.style.setProperty('--mx', mx.toFixed(3)); lab.style.setProperty('--my', my.toFixed(3)); }   /* not while a cover is on its way back: each new place to drift to would start its journey over */ }, { passive: true });
    /* a poster answers the pointer as the covers on the first page do: it comes a little nearer and a soft light crosses it */
    if (fine) {
      lab.addEventListener('pointerover', e => { hvEl = e.target.closest ? e.target.closest('.pz') : null; });
      lab.addEventListener('pointerleave', () => { hvEl = null; });
      lab.addEventListener('pointermove', e => { const a = e.target.closest ? e.target.closest('.pz') : null; if (!a) return; const r = a.getBoundingClientRect(); a.style.setProperty('--lx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%'); a.style.setProperty('--ly', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%'); });
    }
    if (!live && big.matches) addEventListener('resize', () => { if (sel) place(); });
    if (!big.matches) reveal(base);
    if (live) {
      document.body.classList.add('lablive'); lab.classList.add('live'); lab.setAttribute('data-drag', 'y'); layout(); intro = false;
      if (loose) {
        /* nothing on this page scrolls but the table: should the browser move the page to show a cover the keyboard has reached, the page is put back and the table brings the cover instead */
        addEventListener('scroll', () => { if (scrollY || scrollX) scrollTo(0, 0); }, { passive: true });
        lab.addEventListener('focusin', e => { const it = its.find(o => o.el === e.target); if (it && !sel && e.target.matches(':focus-visible')) target = it.y - Math.max(20, (VH - it.h) / 2) + Math.round((y - it.y) / H) * H; });
      }
      addEventListener('resize', () => { layout(); if (sel) place(); });
      addEventListener('wheel', e => { if (e.target.closest('.pzd')) return; e.preventDefault(); if (!sel) target += e.deltaY * (e.deltaMode === 1 ? 32 : 1); }, { passive: false });
      lab.addEventListener('pointerdown', e => { if (sel) return; drag = e.clientY; moved = 0; touch = e.pointerType !== 'mouse'; if (touch && fh.down(-e.clientY)) moved = 99; });
      lab.addEventListener('dragstart', e => e.preventDefault());
      addEventListener('pointermove', e => { if (drag === null) return; const d = drag - e.clientY; drag = e.clientY; moved += Math.abs(d); if (touch) { target += d; fh.move(-e.clientY); } else target += d * 1.6; });
      const drop = () => { if (drag !== null && touch) fh.up(); drag = null; };
      addEventListener('pointerup', drop); addEventListener('pointercancel', drop);
      addEventListener('keydown', e => { if (sel) return; const s = { ArrowDown: 160, ArrowUp: -160, PageDown: VH * .8, PageUp: -VH * .8 }[e.key]; if (s) { target += s; e.preventDefault(); } });
      (function frame(now) {
        requestAnimationFrame(frame); if (sel) return;
        now = now || performance.now();
        /* the covers are dealt once the page can be seen: at once, or when the picture that brought the visitor here is drawn away */
        if (!born && (!root.classList.contains('entering') || root.classList.contains('entered'))) born = now + (root.classList.contains('came') ? 560 : 160);
        const dt = Math.min(50, now - (lt || now)); lt = now;
        if (touch && (drag !== null || fh.coast)) { target += fh.step(dt); y = target; } else y += (target - y) * (touch ? .12 : .085);
        k += (Math.max(-1, Math.min(1, (target - y) / 700 + (touch ? fh.v * .35 : 0))) - k) * .1;
        pmx += (mx - pmx) * .06; pmy += (my - pmy) * .06;
        for (const it of its) {
          let py = ((it.y - y) % H + H) % H; if (py > VH + 60) py -= H; it.py = py;
          if (py + it.h < -80 || py > VH + 80) { if (!it.off) { it.el.style.visibility = 'hidden'; it.off = true; } if (it.a < 1) settle(it); continue; }
          if (it.a < 1 && py + it.h < 4) settle(it);   /* one that lies above the top edge is not dealt in: it would dip into view on its way */
          if (it.off) { it.el.style.visibility = ''; it.off = false; }
          const cx = (it.x + it.w / 2) / W * 2 - 1, cy = (py + it.h / 2) / VH * 2 - 1;
          it.hv = (it.hv || 0) + ((it.el === hvEl && drag === null ? 1 : 0) - (it.hv || 0)) * .14;
          let z = -k * (cx * cx + cy * cy) * 110 + it.hv * 36, extra = Math.abs(k) > .002 ? ' rotateX(' + (k * cy * 12).toFixed(2) + 'deg) rotateY(' + (-k * cx * 10).toFixed(2) + 'deg)' : '';
          /* arriving: each cover is laid on the table in turn, from the top left, its lower edge coming down last */
          if (it.a < 1) {
            if (born && now > born + (Math.max(0, py) / VH * .7 + it.x / W * .5) * 640) it.a = Math.min(1, it.a + (1 - it.a) * .075 + .004);
            if (it.a >= 1) settle(it); else { const e = 1 - Math.pow(1 - it.a, 2); it.el.style.transition = 'none'; it.el.style.opacity = e.toFixed(3); z -= (1 - e) * 240; extra = ' translateY(' + ((1 - e) * VH * .13).toFixed(1) + 'px) rotateX(' + ((1 - e) * 15).toFixed(2) + 'deg)' + extra; }
          }
          it.el.style.transform = tf(it, z, extra);
        }
      })();
    }
  }

  /* A project shown at work. Its screens follow one another on their own, each uncovered from below. Beside them a large sentence
     tells how the software is used: the words in it that name a step call that step's screen (under the pointer, or when pressed),
     as the words of the first page's sentence call their covers. The step being shown is underlined in the accent: at once when it
     was picked, and growing for as long as its screen stays when the screens follow one another by themselves. The pointer resting
     on the screen or on the sentence holds things where they are. Pressing the screen opens it large, in the viewer the
     photographs use, and the screen left showing there is the one that stands here afterwards. */
  { const st = $('.pstage');
    if (st && $$('.sf', st).length > 1) {
      const scr = $('.pscr', st), figs = $$('.sf', st), caps = $$('.pcl li', st), kws = $$('a.kw', st), pz = $('.ppz', st), zones = [scr, $('.pwalk', st), $('.pcap', st)].filter(Boolean), n = figs.length;
      const STAY = 6500;   /* how long a screen stays, in milliseconds; a step that was picked stays twice as long */
      let cur = 0, tok = 0, el = 0, stay = STAY, full = false, last = 0, raf = 0, over = 0, keyed = false, seen = !('IntersectionObserver' in window), stopped = reduce;
      const mine = i => kws.filter(k => +k.dataset.step === i + 1);
      const shown = f => $$('img', f).find(im => getComputedStyle(im).display !== 'none');
      const load = i => $$('img[data-src]', figs[i]).forEach(im => { if (im.dataset.srcset) im.srcset = im.dataset.srcset; im.src = im.dataset.src; im.removeAttribute('data-src'); im.removeAttribute('data-srcset'); });
      const ready = f => new Promise(res => { const im = shown(f); if (!im || (im.complete && im.naturalWidth)) return res(); const ok = () => res(); im.addEventListener('load', ok, { once: true }); im.addEventListener('error', ok, { once: true }); setTimeout(ok, 1400); });
      const running = () => seen && !over && !keyed && !stopped && !document.hidden && !document.body.style.overflow;
      const paint = () => { const v = full ? '1' : Math.max(0, Math.min(1, el / stay)).toFixed(4); mine(cur).forEach(k => k.style.setProperty('--p', v)); };
      const tick = now => { raf = 0; if (!running()) return; el += Math.min(120, now - last); last = now; if (el >= stay) return void show(cur + 1); paint(); raf = requestAnimationFrame(tick); };
      const sync = () => { st.classList.toggle('still', stopped); if (running() && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
      const swap = (j, at_once) => {
        const b = figs[j], a = figs.find(f => f !== b && f.classList.contains('on'));
        figs.forEach(f => { (f._an || []).forEach(x => x.cancel()); f._an = null; f.classList.remove('on', 'under'); });
        b.classList.add('on');
        if (a && !at_once && !reduce && b.animate) {
          /* the frame of the software is the same from screen to screen, so the new screen is not moved at all: only uncovered */
          a.classList.add('under'); b._an = [b.animate([{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1000, easing: 'cubic-bezier(.7,0,.2,1)' })];
          b._an[0].onfinish = () => a.classList.remove('under');
        }
        load((j + 1) % n);
      };
      const show = (j, picked, at_once) => {
        j = ((j % n) + n) % n; const my = ++tok, same = j === cur; cur = j; el = 0; full = !!picked; stay = picked ? STAY * 2 : STAY; scr.dataset.i = j;
        caps.forEach((c, q) => c.classList.toggle('on', q === j));
        kws.forEach(k => { const on = +k.dataset.step === j + 1; if (!on) k.style.removeProperty('--p'); k.classList.toggle('on', on); if (on) k.setAttribute('aria-current', 'true'); else k.removeAttribute('aria-current'); });
        paint(); sync(); load(j); if (same) return;
        if (at_once) return swap(j, true);
        ready(figs[j]).then(() => { if (my === tok) swap(j); });
      };
      kws.forEach(k => { let hv = 0; const i = +k.dataset.step - 1;
        k.addEventListener('click', e => { e.preventDefault(); clearTimeout(hv); show(i, true); });
        k.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; clearTimeout(hv); hv = setTimeout(() => show(i, true), 140); });
        k.addEventListener('pointerleave', () => clearTimeout(hv)); });
      /* the pointer resting on the screen, on the sentence or on the line under the screen holds the screen where it is */
      const resting = () => { over = fine ? zones.filter(z => z.matches(':hover')).length : 0; sync(); };   /* a finger does not rest: a tap leaves its mark on some phones, and would hold the screens for good */
      zones.forEach(z => { z.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') over++; }); z.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') resting(); }); });
      st.addEventListener('focusin', () => { keyed = !!(document.activeElement && document.activeElement.matches(':focus-visible')); }); st.addEventListener('focusout', () => { keyed = false; sync(); });
      st.addEventListener('keydown', e => { if (e.key === 'ArrowRight') show(cur + 1, true); else if (e.key === 'ArrowLeft') show(cur - 1, true); });
      /* the screen in three parts: its left third goes back, its right third goes on, and the middle opens it large; the pointer says which */
      const part = e => { if (!e || typeof e.clientX !== 'number' || (!e.clientX && !e.clientY)) return 0; const r = scr.getBoundingClientRect(), f = (e.clientX - r.left) / r.width; return f < 1 / 3 ? -1 : f > 2 / 3 ? 1 : 0; };
      scr.addEventListener('pointermove', e => { const d = part(e); scr.dataset.cur = d < 0 ? 'Previous' : d > 0 ? 'Next' : 'Open'; });
      scr.addEventListener('click', e => { const d = part(e); if (d) { e.stopPropagation(); show(cur + d, true); } });
      $$('.pstep', st).forEach(b => b.addEventListener('click', () => show(cur + (+b.dataset.d), true)));
      /* the viewer takes the picture that is showing, and tells which screen it has gone on to */
      scr._pic = () => shown(figs[cur]) || null;
      document.addEventListener('lb:show', e => { if (document.body.style.overflow && e.detail !== cur) show(e.detail, true, true); });
      document.addEventListener('lb:close', () => setTimeout(resting, 700));
      if (pz) { const label = () => { pz.textContent = stopped ? 'Play' : 'Pause'; pz.setAttribute('aria-pressed', String(stopped)); }; label(); pz.addEventListener('click', () => { stopped = !stopped; label(); sync(); }); }
      if (!seen) new IntersectionObserver(es => { seen = es[0].isIntersecting; sync(); }, { threshold: .3 }).observe(scr);
      document.addEventListener('visibilitychange', sync);
      kws.forEach(k => { const on = +k.dataset.step === 1; k.classList.toggle('on', on); if (on) k.setAttribute('aria-current', 'true'); });
      { const m = location.hash.match(/^#step-(\d+)$/); if (m && +m[1] >= 1 && +m[1] <= n) show(+m[1] - 1, true, true); }
      load(0); load(1 % n); paint(); sync();
    } }

  /* a title row that stays under the bar tells the page how tall it is, so that what stays beneath it can make room */
  { const lr = $('.lead.row'); if (lr) { const m = () => document.documentElement.style.setProperty('--leadh', (getComputedStyle(lr).position === 'sticky' ? lr.offsetHeight : 0) + 'px'); m(); addEventListener('resize', m); addEventListener('load', m); } }

  /* A link may carry a note. It stands by the link while the pointer or the focus is there, kept inside the window whichever line
     of a broken link is meant. (Without this script the browser shows the same note in its own way.) */
  { const nts = $$('a.nt');
    if (nts.length) {
      const box = document.createElement('div'); box.className = 'ntb'; box.setAttribute('role', 'tooltip'); document.body.append(box);
      const show = (a, e) => {
        box.textContent = a.dataset.note || ''; box.classList.add('on');
        const rs = [...a.getClientRects()], y = e && typeof e.clientY === 'number' ? e.clientY : -1, r = rs.find(q => y >= q.top - 2 && y <= q.bottom + 2) || rs[0]; if (!r) return;
        const w = box.offsetWidth, h = box.offsetHeight, top = ($('.top') || {}).offsetHeight || 0;
        const x = Math.max(12, Math.min(r.left, innerWidth - w - 12)), t = r.top - h - 9 < top + 6 ? r.bottom + 9 : r.top - h - 9;
        box.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(t) + 'px)';
      };
      const hide = () => box.classList.remove('on');
      let tapped = null;
      const hide2 = () => { hide(); tapped = null; box.classList.remove('tap'); };
      nts.forEach(a => {
        a.setAttribute('aria-description', a.dataset.note || ''); a.removeAttribute('title');
        if (fine) { a.addEventListener('pointerenter', e => show(a, e)); a.addEventListener('pointermove', e => show(a, e)); a.addEventListener('pointerleave', hide); }
        else a.addEventListener('click', e => { if (tapped !== a) { e.preventDefault(); tapped = a; box.classList.add('tap'); show(a, e); } });      /* a finger cannot hover: the first tap reads the note, the second follows the link */
        a.addEventListener('focus', () => { if (fine && a.matches(':focus-visible')) show(a); }); a.addEventListener('blur', () => { if (fine) hide(); });
      });
      addEventListener('scroll', hide2, { passive: true });
      if (!fine) document.addEventListener('click', e => { if (tapped && !(e.target.closest && e.target.closest('a.nt'))) hide2(); }, true);
    } }

  /* About: a life told in pieces. Each piece arrives when it is reached; the contents at the top mark the one being read;
     and a few things inside the text happen once, when the reader gets to them: an aside types itself, figures count up, things
     are crossed off, an underline wanders over a list of choices and comes to rest. */
  { const frags = $('.frags');
    if (frags) {
      const about = frags.closest('.about') || document, fr = $$('.frag', frags), idx = $$('.acon a', about), quote = $('.aq', about);
      const born = performance.now(), io = 'IntersectionObserver' in window;
      /* an aside: its room is kept from the start (the letters are there, unseen), and typing only uncovers them */
      const asides = $$('.as', about);
      const typeOut = el => {
        const t = [...el._t], a = el.firstChild, b = el.lastChild; let i = 0; el.classList.add('typing');
        (function tick() {
          if (i >= t.length) return void setTimeout(() => el.classList.remove('typing'), 1100);
          i++; a.textContent = t.slice(0, i).join(''); b.textContent = t.slice(i).join('');
          const ch = t[i - 1], nx = t[i];
          setTimeout(tick, /[.!?]/.test(ch) && nx === ' ' ? 560 : ch === ',' ? 170 : 22 + Math.random() * 24);      /* a breath after a sentence */
        })();
      };
      /* a figure counts up to itself, keeping its own way of writing a number */
      const figure = el => {
        const s = el._s, m = s.match(/\d[\d.,]*\d|\d/); if (!m) return;
        const raw = m[0], dec = raw.includes('.') ? raw.split('.').pop().length : 0, grp = raw.includes(','), to = parseFloat(raw.replace(/,/g, '')), pre = s.slice(0, m.index), post = s.slice(m.index + raw.length);
        const fmt = v => { const [a, b] = v.toFixed(dec).split('.'); return pre + (grp ? a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : a) + (b ? '.' + b : '') + post; };
        return { zero: () => { el.style.minWidth = el.offsetWidth + 'px'; el.style.display = 'inline-block'; el.textContent = fmt(0); }, run: () => { el.classList.add('go'); const t0 = performance.now(), D = 1500; (function f(now) { const k = Math.min(1, (now - t0) / D); el.textContent = k < 1 ? fmt(to * (1 - Math.pow(1 - k, 4))) : s; if (k < 1) requestAnimationFrame(f); })(t0); } };
      };
      /* choices: the underline goes over them twice and stays on the one that was taken, if one is marked */
      const hop = p => {
        const ops = $$('.op', p); if (ops.length < 2) return; let i = -1, n = 0, busy = false;
        const step = () => { ops.forEach(o => o.classList.remove('on')); if (n++ >= ops.length * 2) { const f = ops.find(o => o.classList.contains('fin')); if (f) f.classList.add('on'); busy = false; return; } i = (i + 1) % ops.length; ops[i].classList.add('on'); setTimeout(step, 560); };
        const go = () => { if (busy) return; busy = true; n = 0; i = -1; step(); };
        go(); p.addEventListener('pointerenter', go);
      };
      if (!reduce && io) {
        frags.classList.add('live');
        asides.forEach(el => { el._t = el.textContent; el.textContent = ''; const a = document.createElement('span'), b = document.createElement('span'); a.className = 't1'; b.className = 't2'; b.textContent = el._t; el.append(a, b); });
        const figs = $$('.figs .num', about).map(el => { el._s = el.textContent; const f = figure(el); if (f) f.zero(); return f; });
        /* the pieces already in the window when the page opens wait for the heading and the opening sentence */
        const seen = new IntersectionObserver(es => es.forEach(e => {
          if (!e.isIntersecting) return; seen.unobserve(e.target); const f = e.target, q = fr.indexOf(f), wait = Math.max(0, 1150 - (performance.now() - born)) + (performance.now() - born < 1150 ? q * 140 : 0);
          setTimeout(() => { f.classList.add('in'); setTimeout(() => f.classList.add('done'), 1800); }, wait);
        }), { rootMargin: '0px 0px -8% 0px' });
        fr.forEach(f => seen.observe(f));
        /* what happens inside the text waits until it is itself well inside the window, and until its piece has arrived */
        const when = (els, fn, lag, edge) => { const o = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; o.unobserve(e.target); const f = e.target.closest('.frag'), t0 = performance.now(); (function wait() { if (f && !f.classList.contains('in') && performance.now() - t0 < 4000) return void setTimeout(wait, 120); setTimeout(() => fn(e.target), lag); })(); }), { rootMargin: '0px 0px -' + (edge === undefined ? 14 : edge) + '% 0px' }); els.forEach(el => o.observe(el)); };
        when(asides, typeOut, 1000);
        $$('.figs .num', about).forEach((el, q) => { el._f = figs[q]; });
        when($$('.figs', about), el => $$('.num', el).forEach((n, q) => setTimeout(() => n._f && n._f.run(), q * 180)), 350, 2);
        when($$('.frag p', frags).filter(p => $('.op', p)), hop, 1300);
        when($$('.frag p', frags).filter(p => $('s.x', p)), p => p.classList.add('xgo'), 900);
        if (quote) { quote.classList.add('live'); const o = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { o.disconnect(); quote.classList.add('in'); } }), { rootMargin: '0px 0px -16% 0px' }); o.observe(quote); }
      }
      /* which piece is being read: the one that lies across a line a third of the way down the window */
      let cur = -9, raf = 0;
      const where = () => {
        raf = 0; const line = innerHeight * .32; let c = -1;
        for (let i = 0; i < fr.length; i++) { const r = fr[i].getBoundingClientRect(); if (r.top <= line && r.bottom > line) { c = i; break; } }
        if (c === cur) return; cur = c;
        const id = c >= 0 ? '#' + fr[c].id : '';
        fr.forEach((f, i) => f.classList.toggle('cur', i === c)); idx.forEach(a => a.classList.toggle('on', a.getAttribute('href') === id));
      };
      addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(where); }, { passive: true }); addEventListener('resize', where); where();
      /* an underlined word of the opening, or a button of the index, goes to its piece */
      $$('a[href^="#"]', about).forEach(a => a.addEventListener('click', e => {
        const t = document.getElementById(a.getAttribute('href').slice(1)); if (!t) return; e.preventDefault();
        t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });      /* the address is left as it is: a reload starts at the top again */
        t.classList.add('hit'); setTimeout(() => t.classList.remove('hit'), 1700);
      }));
    } }

  /* About: the CV is a sheet lying in the text. Pressed, it comes forward and stands at the left, as a project's cover does, with the
     CV set out beside it to be read and the file beneath it to be taken away; closing sends it back to where it lay. */
  const ab = $('main.about');
  if (ab) {
    const cvc = $('#cvc'), cvr = $('#cvr'), cvk = $('#cvk'); let tc = 0, fl = null;
    if (cvc && cvr) {
      const mid = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      /* where the sheet lies on the page when nothing touches it, whatever is being done to it or to the page just now */
      const lies = () => { let x = 0, y = 0, e = cvc; while (e) { x += e.offsetLeft + (e === cvc ? 0 : e.clientLeft); y += e.offsetTop + (e === cvc ? 0 : e.clientTop); e = e.offsetParent; } return { x: x + cvc.offsetWidth / 2 - scrollX, y: y + cvc.offsetHeight / 2 - scrollY }; };
      const at = (p, rot) => { const b = cvk.getBoundingClientRect(), c = mid(b); return 'translate(' + (p.x - c.x).toFixed(1) + 'px,' + (p.y - c.y).toFixed(1) + 'px) rotate(' + rot.toFixed(2) + 'deg) scale(' + (cvc.offsetWidth / b.width).toFixed(4) + ')'; };
      const fly = () => cvk && cvk.animate && !reduce;
      const open = flight => {
        if (!cvr.hidden && cvr.classList.contains('in')) return;
        clearTimeout(tc); if (fl) { fl.cancel(); fl = null; }
        /* as it is seen at this moment: straightened and lifted if the pointer is on it */
        const m = new DOMMatrixReadOnly(getComputedStyle(cvc).transform), seen = mid(cvc.getBoundingClientRect()), rot = Math.atan2(m.b, m.a) * 180 / Math.PI;
        cvr.hidden = false; cvr.scrollTop = 0; hush(1); ab.classList.add('open');
        if (fly()) { cvc.style.visibility = 'hidden'; if (flight !== false) fl = cvk.animate([{ transform: at(seen, rot) }, { transform: 'none' }], { duration: T_OPEN, easing: E_OPEN }); }
        requestAnimationFrame(() => requestAnimationFrame(() => cvr.classList.add('in')));
        setTimeout(() => { const f = $('.pzv', cvr) || $('#cvx'); f && f.focus({ preventScroll: true }); }, 80);
      };
      const shut = () => {
        if (cvr.hidden || !cvr.classList.contains('in')) return;
        const r = cvk ? cvk.getBoundingClientRect() : null, inView = r && r.bottom > 40 && r.top < innerHeight - 40;
        cvr.classList.remove('in'); ab.classList.remove('open'); hush(0);
        const end = () => { cvr.hidden = true; cvc.style.visibility = ''; if (fl) { fl.cancel(); fl = null; } cvc.focus({ preventScroll: true }); };
        if (fl) { fl.cancel(); fl = null; }
        if (inView && fly() && cvc.style.visibility === 'hidden') { fl = cvk.animate([{ transform: 'none' }, { transform: at(lies(), parseFloat(getComputedStyle(cvc).getPropertyValue('--tilt')) || 0) }], { duration: T_CLOSE, easing: E_CLOSE, fill: 'forwards' }); fl.onfinish = end; }
        else { cvc.style.visibility = ''; tc = setTimeout(end, 420); }
      };
      cvc.addEventListener('click', () => open());
      /* the same sheet can be asked for by name at the top of the page; from there it does not fly, it is simply there */
      $$('[data-cvopen],a[href="#cv"]', ab).forEach(b => b.addEventListener('click', e => { e.preventDefault(); const r = cvc.getBoundingClientRect(); open(r.bottom < 0 || r.top > innerHeight ? false : undefined); }));
      $('#cvx').addEventListener('click', shut);
      cvr.addEventListener('click', e => { if (e.target === cvr || e.target.classList.contains('cvb')) shut(); });
      addEventListener('keydown', e => { if (e.key === 'Escape') shut(); });
      if (location.hash === '#cv') open(false);
    }
  }

  /* papers: a reading-progress line, and the contents rail follows the section being read */
  const prog = $('#prog'), tocA = $$('.toc a');
  if (prog) {
    const th = () => document.documentElement.style.setProperty('--toph', $('.top').offsetHeight + 'px'); th(); addEventListener('resize', th);
    const art = $('.thesis'); let tick = false;
    const upd = () => { tick = false; const r = art.getBoundingClientRect(); prog.style.transform = 'scaleX(' + Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight))).toFixed(4) + ')'; };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true }); upd();
  }
  if (tocA.length && 'IntersectionObserver' in window) {
    const byId = new Map(tocA.map(a => [decodeURIComponent(a.getAttribute('href').slice(1)), a]));
    const marks = [...byId.keys()].map(id => document.getElementById(id)).filter(Boolean).map(el => el.tagName === 'SECTION' ? el.querySelector('h2') || el : el);
    const setOn = a => {
      tocA.forEach(x => x.classList.remove('on', 'in')); a.classList.add('on');
      const top = a.closest('.toc .stick > ol > li'); if (top) { top.firstElementChild.classList.add('in'); $$('.toc .stick > ol > li').forEach(li => li.classList.toggle('open', li === top)); }
      const rail = $('.toc .stick'); if (rail && rail.scrollHeight > rail.clientHeight + 2) { const ar = a.getBoundingClientRect(), rr = rail.getBoundingClientRect(); if (ar.top < rr.top + 40 || ar.bottom > rr.bottom - 40) rail.scrollTop += ar.top - rr.top - rr.height / 2; }
      const bar = $('.toc ol'); if (bar && bar.scrollWidth > bar.clientWidth + 2 && top) bar.scrollLeft = top.offsetLeft - 16;
    };
    let tk = false;
    const find = () => { tk = false; let cur = null; for (const m of marks) { if (m.getBoundingClientRect().top < innerHeight * .3) cur = m; else break; } if (cur) { const id = cur.id || cur.parentElement.id; const a = byId.get(id); if (a && !a.classList.contains('on')) setOn(a); } };
    addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(find); } }, { passive: true }); find();
  }

  /* Lightbox. The photograph that was pressed grows from where it hangs until it stands alone in the window, on the page's own
     ground; closing sends it back to its frame. Stepping to the next or the one before slides the picture a little the way it goes. */
  const data = $('#lb');
  if (data) {
    const L = JSON.parse(data.textContent), E = E_OPEN; let i = 0, src = null, fly = null, ct = 0;
    const box = document.createElement('div'); box.id = 'lbx'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Photograph'); box.hidden = true;
    box.innerHTML = '<button type="button" class="pzc mono" id="lbC">Close ✕</button><div class="im" data-cur="Close"><img alt="" data-cur=""></div><div class="bar2 sm"><span id="lbT"></span><span class="mono k" id="lbE"></span><div><span class="mono" id="lbN"></span><button type="button" id="lbP" aria-label="Previous">←</button><button type="button" id="lbX2" aria-label="Next">→</button></div></div>';
    document.body.append(box);
    const im = $('img', box), imw = $('.im', box);
    /* the picture is given its size outright, so that its box is the picture and nothing more */
    const fit = (el = im, p = L[i]) => {
      if (!p.w || !p.h) { el.style.width = el.style.height = ''; return; }
      const r = imw.getBoundingClientRect(), cs = getComputedStyle(imw), px = parseFloat(cs.paddingLeft) || 0, py = parseFloat(cs.paddingTop) || 0, k = Math.min((r.width - 2 * px) / p.w, (r.height - 2 * py) / p.h, 1);
      el.style.width = (p.w * k).toFixed(1) + 'px'; el.style.height = (p.h * k).toFixed(1) + 'px';
    };
    /* a picture may come in two versions, one for each theme of the site (the screens of a piece of software do) */
    const dark = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')) !== 'light';
    const lg = p => dark() && p.ld ? p.ld : p.l, sm = p => dark() && p.sd ? p.sd : p.s;
    const tell = (what, detail) => { try { document.dispatchEvent(new CustomEvent(what, { detail })); } catch (x) {} };
    const put = (j, keep) => {   /* keep: the picture already showing is this one (a swipe brought it), so it is not put back to the small copy first */
      i = (j + L.length) % L.length; const p = L[i], big = lg(p);
      if (src) { src.style.visibility = ''; src = null; }
      tell('lb:show', i);
      im.dataset.want = big; if (!keep) im.src = sm(p); im.alt = p.t || ''; fit();
      const pre = new Image(); pre.src = big; when(pre, () => { if (im.dataset.want !== big) return; im.src = big; if (!p.w) { p.w = pre.naturalWidth; p.h = pre.naturalHeight; fit(); } });
      const nx = L[(i + 1) % L.length]; if (nx && L.length > 1) { const n = new Image(); n.src = lg(nx); }
      $('#lbT').textContent = p.t || ''; $('#lbE').textContent = p.e || ''; $('#lbN').textContent = String(i + 1).padStart(2, '0') + ' / ' + String(L.length).padStart(2, '0');
    };
    const show = (j, dir) => {
      if (!dir || reduce || !im.animate || !box.classList.contains('open')) return put(j);
      im.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-dir * 46) + 'px)' }], { duration: 130, easing: 'ease-in' }).onfinish = () => { put(j); im.animate([{ opacity: 0, transform: 'translateX(' + (dir * 46) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: E }); };
    };
    const seen = el => { const f = el.closest('.ph,.zoom') || el.parentNode, r = el.getBoundingClientRect(); return getComputedStyle(f).visibility !== 'hidden' && r.width > 8 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
    const from = (a, b) => 'translate(' + (a.left + a.width / 2 - b.left - b.width / 2).toFixed(1) + 'px,' + (a.top + a.height / 2 - b.top - b.height / 2).toFixed(1) + 'px) scale(' + Math.max(a.width / b.width, a.height / b.height).toFixed(4) + ')';
    const open = (j, btn) => {
      if (box.classList.contains('open')) return;
      clearTimeout(ct); if (fly) { fly.cancel(); fly = null; } box.hidden = false; hush(1);
      const t = btn ? ((btn._pic && btn._pic()) || $('img', btn) || btn) : null, p = L[(j + L.length) % L.length];
      if (t && !p.w && t.naturalWidth) { p.w = t.naturalWidth; p.h = t.naturalHeight; }
      put(j); box.offsetWidth; box.classList.add('open');
      if (t && !reduce && im.animate && seen(t)) { const a = t.getBoundingClientRect(), b = im.getBoundingClientRect(); if (b.width > 8) { src = t; t.style.visibility = 'hidden'; fly = im.animate([{ transform: from(a, b) }, { transform: 'none' }], { duration: T_OPEN, easing: E }); } }
      $('#lbC').focus({ preventScroll: true });
    };
    const close = was => {   /* was: where a finger left the picture, if it was pulled down; it goes on from there */
      if (!box.classList.contains('open')) return; was = typeof was === 'string' ? was : ''; if (was) im.style.transform = ''; box.classList.remove('open', 'drag'); box.style.removeProperty('--lbo'); hush(0);
      /* back into its frame if that frame is in view, otherwise it steps back and fades */
      const z = $$('.zoom[data-i="' + i + '"]').find(b => b._pic), zp = z ? z._pic() : null;
      let t = (zp && seen(zp) ? zp : null) || (src && src.isConnected && seen(src) ? src : null);
      if (!t) t = $$('.ph .open[data-i="' + i + '"] img,.zoom[data-i="' + i + '"] img').find(seen) || null;
      const end = () => { if (src) src.style.visibility = ''; if (t) t.style.visibility = ''; src = null; ct = setTimeout(() => { if (!box.classList.contains('open')) { box.hidden = true; if (fly) { fly.cancel(); fly = null; } } }, 60); };
      tell('lb:close', i);
      if (reduce || !im.animate) return end();
      if (fly) fly.cancel();
      if (t) { if (src && src !== t) src.style.visibility = ''; src = t; t.style.visibility = 'hidden'; fly = im.animate([{ transform: was || 'none' }, { transform: from(t.getBoundingClientRect(), im.getBoundingClientRect()) }], { duration: T_CLOSE, easing: was ? E_OPEN : E_CLOSE, fill: 'forwards' }); }
      else fly = im.animate([{ opacity: 1, transform: was || 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 300, easing: 'ease', fill: 'forwards' });
      fly.onfinish = end;
    };
    document.addEventListener('click', e => { const b = e.target.closest('.ph .open,.zoom[data-i]'); if (b) open(+b.dataset.i, b); });
    $('#lbP').onclick = () => show(i - 1, -1); $('#lbX2').onclick = () => show(i + 1, 1); $('#lbC').onclick = close;
    addEventListener('resize', () => { if (!box.hidden) fit(); });
    /* Swiping, as the photographs on a phone are swiped. The picture follows the finger and the next one (or the one before) comes in beside
       it; let go past a fifth of the window, or with a flick, and the two carry on at the finger's own speed until the new one stands where
       the old one stood, otherwise they go back. Pulled down, the picture shrinks a little and the ground thins; let go far enough down and it
       goes back into its frame from where the finger left it. (Before, a swipe sent the picture back to the middle first and then faded it.) */
    const pk = document.createElement('img'); pk.className = 'pk'; pk.alt = ''; pk.setAttribute('aria-hidden', 'true'); pk.draggable = false; imw.append(pk);
    let sx = null, sy = 0, dx = 0, dy = 0, swiped = false, axis = '', side = 0, trail = [], busy = false;
    const span = () => imw.clientWidth + 28, at = x => 'translate(-50%,-50%) translateX(' + x.toFixed(1) + 'px)';
    const peek = d => { if (side === d) return; side = d; const p = L[(i + d + L.length) % L.length], big = lg(p); pk.dataset.want = big; pk.src = sm(p); fit(pk, p); pk.style.visibility = 'visible';
      const q = new Image(); q.src = big; when(q, () => { if (pk.dataset.want === big) pk.src = big; }); };
    const speed = () => { const a = trail[0], b = trail[trail.length - 1]; return !a || performance.now() - b[0] > 70 ? 0 : (b[1] - a[1]) / Math.max(8, b[0] - a[0]); };
    const unpeek = () => { pk.getAnimations().forEach(a => a.cancel()); pk.style.visibility = ''; pk.style.transform = ''; side = 0; };
    imw.addEventListener('pointerdown', e => { if (busy || sx !== null || !e.isPrimary) return; sx = e.clientX; sy = e.clientY; dx = dy = 0; swiped = false; axis = ''; trail = []; });
    imw.addEventListener('pointermove', e => {
      if (sx === null || !e.isPrimary) return; dx = e.clientX - sx; dy = e.clientY - sy;
      if (!axis && Math.hypot(dx, dy) > 8) { axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : dy > 0 ? 'y' : 'n'; swiped = true; if (fly) { fly.cancel(); fly = null; } }
      const t = performance.now(); trail.push([t, axis === 'y' ? dy : dx]); while (trail.length > 2 && t - trail[0][0] > 90) trail.shift();
      if (axis === 'x') { im.style.transform = 'translateX(' + dx.toFixed(1) + 'px)'; if (L.length > 1) { const d = dx < 0 ? 1 : -1; peek(d); pk.style.transform = at(dx + d * span()); } }
      else if (axis === 'y') { const yy = Math.max(0, dy); box.classList.add('drag'); box.style.setProperty('--lbo', Math.max(.25, 1 - yy / 520).toFixed(3)); im.style.transform = 'translateY(' + yy.toFixed(1) + 'px) scale(' + Math.max(.8, 1 - yy / 900).toFixed(4) + ')'; }
    });
    const fin = () => {
      if (sx === null) return; sx = null; const v = speed(), was = im.style.transform;
      if (axis === 'x' && !reduce && im.animate) {
        const W = span(), d = dx < 0 ? 1 : -1, go = L.length > 1 && (Math.abs(dx) > W * .2 || Math.abs(v) > .35 && Math.sign(v) === Math.sign(dx));
        const ms = go ? Math.max(170, Math.min(380, (W - Math.abs(dx)) / Math.max(Math.abs(v), 1.4))) : 300, how = { duration: ms, easing: 'cubic-bezier(.22,.7,.3,1)', fill: 'forwards' };
        busy = true; im.style.transform = ''; const a = im.animate([{ transform: was }, { transform: 'translateX(' + (go ? -d * W : 0) + 'px)' }], how);
        if (L.length > 1 && side) pk.animate([{ transform: pk.style.transform }, { transform: at(go ? 0 : side * W) }], how);
        a.onfinish = () => {
          if (!go) { a.cancel(); unpeek(); busy = false; return; }
          /* the picture that came in takes the place of the one that left, already drawn: the viewer's own picture is given its file, and the
             one beside it is put away only once that is ready to be seen */
          const keep = pk.currentSrc || pk.src; im.src = keep; put(i + d, true);
          const swap = () => { a.cancel(); unpeek(); busy = false; };
          (im.decode ? im.decode() : Promise.resolve()).then(swap, swap);
        };
      } else if (axis === 'y' && (dy > 110 || v > .5 && dy > 40)) { im.style.transform = was; close(was); }
      else if (axis === 'y' && im.animate && !reduce) { box.classList.remove('drag'); box.style.removeProperty('--lbo'); im.style.transform = ''; im.animate([{ transform: was }, { transform: 'none' }], { duration: 300, easing: E_OPEN }); }
      else { box.classList.remove('drag'); box.style.removeProperty('--lbo'); im.style.transform = ''; unpeek(); if (axis === 'x' && L.length > 1 && Math.abs(dx) > 50) put(i + (dx < 0 ? 1 : -1)); }
    };
    imw.addEventListener('pointerup', fin); imw.addEventListener('pointercancel', fin);
    imw.addEventListener('click', e => { if (e.target !== im && !swiped) close(); });
    addEventListener('keydown', e => { if (!box.classList.contains('open')) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') show(i - 1, -1); else if (e.key === 'ArrowRight') show(i + 1, 1); });
  }
})();
