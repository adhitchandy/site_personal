/* The site is static files (dist/); this script only answers the letter on About me, the form behind "write to me".
   A message is checked (the spam check, Turnstile; a field only robots fill in; sensible lengths) and sent through Resend
   to the site's address, with the writer as Reply-To, so that answering it is just replying. Everything else is the files. */
import site from './content/site.json';

const FROM = 'adhitchandy.com <contact@adhitchandy.com>';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const field = (f, k, max) => String(f.get(k) || '').trim().slice(0, max);

async function letter(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  /* only the site's own pages may send */
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ ok: false, error: 'origin' }, 403);
  let f; try { f = await request.formData(); } catch { return json({ ok: false, error: 'form' }, 400); }
  /* a robot fills in every field it finds, the hidden one too; it is told all went well and nothing is sent */
  if (field(f, 'company', 200)) return json({ ok: true });
  const name = field(f, 'name', 120).replace(/[\r\n]+/g, ' '), email = field(f, 'email', 200), message = field(f, 'message', 5000);
  if (!name || !message || !/^[^\s@<>"(),;:\\]+@[^\s@<>"(),;:\\]+\.[^\s@<>"(),;:\\]+$/.test(email)) return json({ ok: false, error: 'fields' }, 400);

  /* either service may be unreachable for a moment; the page is then told so in words, never left with a bare error */
  let seen = {};
  try { seen = await (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET || '', response: field(f, 'cf-turnstile-response', 4096), remoteip: request.headers.get('cf-connecting-ip') || '' }) })).json(); }
  catch (e) { console.log('turnstile', String(e)); return json({ ok: false, error: 'send' }, 502); }
  if (!seen.success) { console.log('turnstile refused', JSON.stringify(seen['error-codes'] || []), seen.hostname || ''); return json({ ok: false, error: 'check' }, 400); }

  const mail = { from: FROM, to: [site.email], reply_to: `"${name.replace(/["<>\\]/g, '')}" <${email}>`, subject: `${name} wrote to you through adhitchandy.com`, text: `${message}\n\n— ${name} <${email}>, through the form on adhitchandy.com/about/` };
  let sent;
  try { sent = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + (env.RESEND_API_KEY || ''), 'content-type': 'application/json' }, body: JSON.stringify(mail) }); }
  catch (e) { console.log('resend', String(e)); return json({ ok: false, error: 'send' }, 502); }
  if (!sent.ok) { console.log('resend', sent.status, await sent.text().catch(() => '')); return json({ ok: false, error: 'send' }, 502); }
  return json({ ok: true });
}

export default {
  fetch(request, env) {
    return new URL(request.url).pathname === '/api/contact' ? letter(request, env) : env.ASSETS.fetch(request);
  }
};
