/* edit.js — in-site copy editor for the San Fermo and Swan House Farm websites.
   Loaded on demand (footer copyright tapped five times, or ?edit in the address).
   Never loaded for ordinary guests.

   Consumes from the page: window.SITE, window.SITE_NAME, window.__siteCopyApp (the
   Firebase app the reader initialised, App Check attached: this file must never call
   initializeApp itself), window.__siteCopy (the loaded doc or null), the
   'sitecopy:loaded' event, every [data-copy] element, and the photo pool manifest.

   Writes: site-copy/<site> {blocks, hiddenPhotos, publishedAt, publishedBy(uid), schema:1}
   and site-copy-history/<site>-<previous publishedAt> (the doc being replaced).
   Rules restrict writes to the family allowlist (email-link sign-in, email_verified).
   Added 2026-10-14. */

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

// ── pure functions (tested by tools/test_edit_pure.mjs) ──────────────────────
// KEEP BYTE-IDENTICAL WITH sanitize() IN site-copy-reader.js.
  function sanitize(html) {
    const ALLOWED = { B: 1, I: 1, EM: 1, STRONG: 1, BR: 1, A: 1 };
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html == null ? '' : html);
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 3) continue;
        if (child.nodeType !== 1) { child.remove(); continue; }
        const name = child.tagName.toUpperCase();
        if (name === 'SCRIPT' || name === 'STYLE') { child.remove(); continue; }
        walk(child);
        if (!ALLOWED[name]) { child.replaceWith(...Array.from(child.childNodes)); continue; }
        for (const attr of Array.from(child.attributes)) {
          const v = attr.value.trim();
          if (name === 'A' && attr.name === 'href' && /^(https?:|mailto:|tel:|#|\/|[^:]*$)/i.test(v)) continue;
          if (name === 'A' && attr.name === 'target' && v === '_blank') continue;
          if (name === 'A' && attr.name === 'class' && /^[a-z][a-z0-9-]*( [a-z][a-z0-9-]*)*$/.test(v)) continue;
          child.removeAttribute(attr.name);
        }
        if (name === 'A' && !child.getAttribute('href')) child.replaceWith(...Array.from(child.childNodes));
      }
    };
    walk(tpl.content);
    const out = tpl.innerHTML;
    return out.replace(/<br\s*\/?>/gi, '').trim() === '' ? '' : out;
  }

function snapshot() {
  const out = {};
  document.querySelectorAll('[data-copy]').forEach((el) => { out[el.getAttribute('data-copy')] = sanitize(el.innerHTML); });
  return out;
}
function diffKeys(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  return [...keys].filter((k) => (a || {})[k] !== (b || {})[k]).sort();
}
function sig(obj) {
  if (Array.isArray(obj)) return JSON.stringify(obj.slice().sort());
  return JSON.stringify(Object.keys(obj || {}).sort().map((k) => [k, obj[k]]));
}
// KEEP BYTE-IDENTICAL WITH assignSlots() IN pool-loader.js.
  function assignSlots(pool, slots) {
    if (!pool || pool.length < slots.length) return null;
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    const out = new Array(slots.length); const used = new Set();
    slots.forEach((s, i) => {
      if (s !== 'wide' && s !== 'tall') return;
      const p = shuffled.find((x) => !used.has(x.id) && (s === 'wide' ? x.w > x.h : x.h > x.w));
      if (p) { out[i] = p; used.add(p.id); }
    });
    slots.forEach((s, i) => {
      if (out[i] || s === 'wide' || s === 'tall') return;
      const p = shuffled.find((x) => !used.has(x.id));
      if (p) { out[i] = p; used.add(p.id); }
    });
    return Array.from(out).every(Boolean) ? out : null;  // Array.from: holes are not skipped
  }

// Apply ONLY this editor's changes (keys that differ from what the page showed at load,
// hide toggles relative to load) onto the LIVE doc, so a concurrent publish by someone else
// survives. Review C1, 2026-10-14.
function mergePublish(live, baseline, now, baseHidden, hidden) {
  const blocks = Object.assign({}, (live && live.blocks) || {});
  diffKeys(baseline, now).forEach((k) => { blocks[k] = now[k]; });
  const set = new Set((live && live.hiddenPhotos) || []);
  hidden.filter((x) => !baseHidden.includes(x)).forEach((x) => set.add(x));
  baseHidden.filter((x) => !hidden.includes(x)).forEach((x) => set.delete(x));
  return { blocks, hiddenPhotos: [...set] };
}

export { sanitize, snapshot, diffKeys, sig, assignSlots, mergePublish };
if (typeof window !== 'undefined') window.SiteEdit = { sanitize, snapshot, diffKeys, sig, assignSlots, mergePublish };

// ── UI ───────────────────────────────────────────────────────────────────────
const CSS = `
.se-bar{position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#1f1a16;color:#f4efe8;font:15px/1.4 -apple-system,system-ui,sans-serif;padding:12px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;box-shadow:0 -4px 20px rgba(0,0,0,.25)}
.se-bar b{font-weight:600}
.se-bar .se-sp{flex:1}
.se-btn{appearance:none;border:1px solid #f4efe8;background:transparent;color:#f4efe8;border-radius:6px;padding:8px 14px;font:inherit;cursor:pointer}
.se-btn[disabled]{opacity:.4;cursor:default}
.se-btn.se-pri{background:#b04a1a;border-color:#b04a1a;color:#fff}
.se-card{position:fixed;inset:0;z-index:99998;background:rgba(20,16,12,.6);display:flex;align-items:center;justify-content:center;padding:20px}
.se-card>div{background:#fff;color:#222;border-radius:12px;padding:24px;max-width:420px;width:100%;font:16px/1.5 -apple-system,system-ui,sans-serif}
.se-card h3{margin:0 0 8px;font-size:20px}
.se-card p{margin:0 0 14px}
.se-card input{width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid #bbb;border-radius:6px;margin-bottom:12px}
.se-card .se-btn{color:#222;border-color:#222}
.se-card .se-btn.se-pri{color:#fff;border-color:#b04a1a}
.se-on [data-copy]{outline:1px dashed rgba(176,74,26,.7);outline-offset:3px;cursor:text;min-height:1em}
.se-on [data-copy]:focus{outline:2px solid #b04a1a;background:rgba(176,74,26,.06)}
.se-on [data-copy].se-dirty{outline-color:#2d6a4f}
.se-menu{position:absolute;z-index:100000;background:#fff;color:#222;border:1px solid #ccc;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.2);font:14px -apple-system,system-ui,sans-serif}
.se-menu button{display:block;width:100%;text-align:left;background:none;border:0;padding:10px 14px;font:inherit;cursor:pointer}
.se-menu button:hover{background:#f3eee8}
.se-photos{position:fixed;left:0;right:0;bottom:var(--se-bar-h,62px);max-height:45vh;overflow:auto;background:#2a241f;color:#f4efe8;z-index:99998;padding:12px 16px;font:14px -apple-system,system-ui,sans-serif}
.se-photos .se-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.se-photos figure{margin:0;position:relative}
.se-photos img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;display:block}
.se-photos figure.se-hidden img{opacity:.3}
.se-photos figcaption{margin-top:4px}
.se-photos figcaption button{font:inherit;background:none;border:1px solid #f4efe8;color:#f4efe8;border-radius:4px;padding:3px 8px;cursor:pointer}
body.se-on{padding-bottom:var(--se-bar-h,70px)}
@media (max-width:560px){
  .se-bar{gap:6px;padding:8px 10px;font-size:14px}
  .se-bar>b{display:none}
  .se-bar .se-sp{display:none}
  .se-bar .se-status{flex-basis:100%;font-size:13px;opacity:.85}
  .se-btn{padding:8px 10px;flex:1 1 auto}
  .se-undo .se-long{display:none}
}
.se-undo .se-short{display:none}
@media (max-width:560px){ .se-undo .se-short{display:inline} }
/* FAQ: every answer fully open while editing, no clipping, no accordion toggling */
.se-on .faq-answer{max-height:none !important;overflow:visible !important;padding-top:1rem !important;transition:none !important}
.se-on .faq-question::after{display:none}
.se-on .faq-item{margin-bottom:1.25rem}
/* links and buttons read as text while editing */
.se-on a[data-copy],.se-on [data-copy] a,.se-on button[data-copy]{cursor:text}
.se-toast{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#2d6a4f;color:#fff;padding:10px 16px;border-radius:8px;z-index:100001;font:15px -apple-system,system-ui,sans-serif;max-width:90vw}
.se-toast.se-err{background:#a8311e}
`;

const state = { app: null, db: null, auth: null, fs: null, user: null, baseline: null, baseHidden: [], hidden: [], current: null, manifest: [], on: false };

function el(tag, attrs, html) { const e = document.createElement(tag); Object.assign(e, attrs || {}); if (html != null) e.innerHTML = html; return e; }
function toast(msg, isErr) { const t = el('div', { className: 'se-toast' + (isErr ? ' se-err' : ''), textContent: msg }); document.body.appendChild(t); setTimeout(() => t.remove(), isErr ? 7000 : 2600); }
function fail(msg) { console.log('siteedit: ' + msg); toast(msg, true); }
function stripAuthParams() { const u = new URL(location.href); if (u.searchParams.has('oobCode')) history.replaceState(null, '', u.pathname + '?edit'); }

async function boot() {
  document.head.appendChild(el('style', {}, CSS));
  const whenLoaded = window.__siteCopy !== undefined ? Promise.resolve() :
    new Promise((res) => document.addEventListener('sitecopy:loaded', () => res(), { once: true }));
  await whenLoaded;
  state.app = window.__siteCopyApp;
  if (!state.app || window.__siteCopyError) { fail('The site could not reach its publishing service just now, so editing is off to keep from overwriting anything. Reload in a minute.'); return; }
  state.fs = await import(FB + 'firebase-firestore.js');
  const A = await import(FB + 'firebase-auth.js');
  state.A = A;
  state.db = state.fs.getFirestore(state.app);
  state.auth = A.getAuth(state.app);
  await A.setPersistence(state.auth, A.browserLocalPersistence);
  state.current = window.__siteCopy;

  if (A.isSignInWithEmailLink(state.auth, location.href)) {
    const email = localStorage.getItem('siteEditEmail');
    if (!email) return finishCard();
    try { await A.signInWithEmailLink(state.auth, email, location.href); stripAuthParams(); }
    catch (e) {
      if (e.code === 'auth/invalid-action-code' && state.auth.currentUser) stripAuthParams();
      else return signInCard('That link has expired or was already used. Enter your email to get a fresh one.');
    }
  }
  A.onAuthStateChanged(state.auth, (u) => { state.user = u; if (u && !u.isAnonymous) enterEditMode(); else if (!state.on) signInCard(); });
}

// The link was opened somewhere that didn't ask for it (e.g. the Gmail app's own browser).
// Firebase's standard flow: confirm the address and finish signing in right here.
function finishCard() {
  if (document.querySelector('.se-card')) return;
  const wrap = el('div', { className: 'se-card' });
  wrap.innerHTML = `<div><h3>Finish signing in</h3>
    <p>Type the email address the link was sent to.</p>
    <input type="email" placeholder="you@example.com" autocomplete="email">
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="se-btn se-cancel">Cancel</button><button class="se-btn se-pri se-finish">Sign in</button></div>
    <p class="se-msg" style="margin:12px 0 0;font-size:14px;color:#555"></p></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('.se-cancel').onclick = () => { wrap.remove(); history.replaceState(null, '', location.pathname); };
  wrap.querySelector('.se-finish').onclick = async () => {
    const email = wrap.querySelector('input').value.trim().toLowerCase(); const msg = wrap.querySelector('.se-msg');
    try { await state.A.signInWithEmailLink(state.auth, email, location.href); localStorage.setItem('siteEditEmail', email); stripAuthParams(); wrap.remove(); }
    catch (e) { msg.textContent = (e.code === 'auth/invalid-email') ? 'That is not the address the link was sent to.' : 'That link has expired or was already used. Cancel and ask for a new one.'; }
  };
}

function signInCard(note) {
  if (document.querySelector('.se-card')) return;
  const wrap = el('div', { className: 'se-card' });
  wrap.innerHTML = `<div><h3>Edit ${window.SITE_NAME}</h3>
    <p>${note || 'Enter your email and we will send you a sign-in link. No password needed.'}</p>
    <input type="email" placeholder="you@example.com" autocomplete="email">
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="se-btn se-cancel">Cancel</button><button class="se-btn se-pri se-send">Send link</button></div>
    <p class="se-msg" style="margin:12px 0 0;font-size:14px;color:#555"></p></div>`;
  document.body.appendChild(wrap);
  const input = wrap.querySelector('input'); input.value = localStorage.getItem('siteEditEmail') || '';
  wrap.querySelector('.se-cancel').onclick = () => { wrap.remove(); history.replaceState(null, '', location.pathname); };
  wrap.querySelector('.se-send').onclick = async () => {
    const email = input.value.trim().toLowerCase(); const msg = wrap.querySelector('.se-msg');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { msg.textContent = 'That address does not look right.'; return; }
    try {
      await state.A.sendSignInLinkToEmail(state.auth, email, { url: location.origin + location.pathname + '?edit', handleCodeInApp: true });
      localStorage.setItem('siteEditEmail', email);
      msg.textContent = 'Sent. Open the email on this device and click the link. Check Spam the first time.';
    } catch (e) { msg.textContent = 'Could not send: ' + (e.code || e.message); }
  };
}

async function enterEditMode() {
  if (state.on) return;
  try { await state.fs.getDoc(state.fs.doc(state.db, 'site-copy-history', window.SITE + '-access-check')); }
  catch (e) { if (e.code === 'permission-denied') { fail("You're signed in, but this address isn't on the editor list. Ask Sam to add it."); return; } }
  if (state.on) return; state.on = true;
  document.querySelector('.se-card')?.remove();
  document.body.classList.add('se-on');
  state.baseline = snapshot();
  state.baseHidden = ((state.current && state.current.hiddenPhotos) || []).slice();
  state.hidden = state.baseHidden.slice();
  document.querySelectorAll('[data-copy]').forEach((e) => {
    e.setAttribute('contenteditable', 'true');
    e.addEventListener('input', refresh);
    e.addEventListener('paste', onPaste);
    e.addEventListener('contextmenu', (ev) => { ev.preventDefault(); blockMenu(e, ev.clientX, ev.clientY); });
    // Enter inserts a <br> everywhere. Browsers otherwise wrap the new line in a <div>, which
    // sanitize() unwraps, gluing the two sentences together on the live site (review I3).
    e.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); document.execCommand('insertLineBreak'); } });
    let t; e.addEventListener('touchstart', () => { t = setTimeout(() => { const r = e.getBoundingClientRect(); blockMenu(e, r.left + 10, r.top + 10); }, 600); }, { passive: true });
    e.addEventListener('touchend', () => clearTimeout(t)); e.addEventListener('touchmove', () => clearTimeout(t));
  });
  // While editing, a click on an editable link or button places the cursor instead of
  // navigating, opening the FAQ accordion, or submitting anything.
  document.addEventListener('click', (ev) => {
    if (!state.on) return;
    const t = ev.target.closest && ev.target.closest('a, button');
    if (t && (t.hasAttribute('data-copy') || t.closest('[data-copy]'))) { ev.preventDefault(); ev.stopPropagation(); }
  }, true);
  // Space inside a contentEditable <button> would "press" it in some browsers; type it instead.
  document.addEventListener('keydown', (ev) => {
    if (state.on && ev.key === ' ' && ev.target.tagName === 'BUTTON' && ev.target.hasAttribute('data-copy')) {
      ev.preventDefault(); document.execCommand('insertText', false, ' ');
    }
  }, true);
  const bar = el('div', { className: 'se-bar' });
  bar.innerHTML = `<b>Editing ${window.SITE_NAME}</b><span class="se-status">0 blocks changed</span><span class="se-sp"></span>
    <button class="se-btn se-photos-btn">Photos</button><button class="se-btn se-undo"><span class="se-long">Undo last publish</span><span class="se-short">Undo</span></button>
    <button class="se-btn se-pri se-publish" disabled>Publish</button><button class="se-btn se-done">Done</button>`;
  document.body.appendChild(bar);
  bar.querySelector('.se-publish').onclick = publish;
  bar.querySelector('.se-undo').onclick = undo;
  bar.querySelector('.se-done').onclick = () => { if (dirtyCount() && !confirm('You have unpublished changes. Leave anyway?')) return; location.href = location.pathname; };
  bar.querySelector('.se-photos-btn').onclick = togglePhotos;
  // Leave exactly enough room under the page for the bar, whatever it wraps to on a phone.
  const fit = () => document.documentElement.style.setProperty('--se-bar-h', (bar.offsetHeight + 8) + 'px');
  fit(); window.addEventListener('resize', fit);
  refresh();
}
function onPaste(ev) { ev.preventDefault(); const t = (ev.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); }
function dirtyCount() { return diffKeys(state.baseline, snapshot()).length + (sig(state.hidden) !== sig(state.baseHidden) ? 1 : 0); }
function refresh() {
  const now = snapshot(); const changed = new Set(diffKeys(state.baseline, now));
  document.querySelectorAll('[data-copy]').forEach((e) => e.classList.toggle('se-dirty', changed.has(e.getAttribute('data-copy'))));
  const n = dirtyCount(); const st = document.querySelector('.se-status'); const pb = document.querySelector('.se-publish');
  if (st) st.textContent = n + (n === 1 ? ' block changed' : ' blocks changed') + (sig(state.hidden) !== sig(state.baseHidden) ? ' (incl. photos)' : '');
  if (pb) pb.disabled = n === 0;
}
function blockMenu(target, x, y) {
  document.querySelector('.se-menu')?.remove();
  const m = el('div', { className: 'se-menu' }); m.style.left = x + 'px'; m.style.top = (y + window.scrollY) + 'px';
  const key = target.getAttribute('data-copy');
  m.innerHTML = `<button data-a="orig">Restore original text</button><button data-a="pub">Restore last published</button><button data-a="x">Cancel</button>`;
  m.onclick = (ev) => {
    const a = ev.target.getAttribute('data-a'); m.remove();
    if (a === 'orig') target.innerHTML = ORIGINAL[key];
    if (a === 'pub' && state.current && state.current.blocks && state.current.blocks[key]) target.innerHTML = sanitize(state.current.blocks[key]);
    refresh();
  };
  document.body.appendChild(m);
  setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
}
const ORIGINAL = {};
document.querySelectorAll('[data-copy]').forEach((e) => {
  const k = e.getAttribute('data-copy');
  ORIGINAL[k] = (window.__siteCopyBaked && k in window.__siteCopyBaked) ? window.__siteCopyBaked[k] : e.innerHTML;
});

// Publish and Undo both run in a transaction against the LIVE doc: read it, archive it to
// history, write the new version on top. Nothing someone else published in the meantime is
// lost or left out of history (review C1).
async function commit(build) {
  const { doc, runTransaction } = state.fs;
  const ref = doc(state.db, 'site-copy', window.SITE);
  let next = null;
  await runTransaction(state.db, async (tx) => {
    const snap = await tx.get(ref);
    const live = snap.exists() ? snap.data() : null;
    const body = await build(live, tx);
    if (!body) return;
    if (live && live.publishedAt) tx.set(doc(state.db, 'site-copy-history', window.SITE + '-' + live.publishedAt), live);
    next = { blocks: body.blocks, hiddenPhotos: body.hiddenPhotos, publishedAt: Date.now(), publishedBy: state.user.uid,
             prevAt: live && live.publishedAt ? live.publishedAt : null, schema: 1 };
    tx.set(ref, next);
  });
  if (next) { state.current = next; window.__siteCopy = next; }
  return next;
}
function showDoc(d) {
  document.querySelectorAll('[data-copy]').forEach((e) => {
    const k = e.getAttribute('data-copy'); const v = d && d.blocks && d.blocks[k] ? sanitize(d.blocks[k]) : '';
    e.innerHTML = v || ORIGINAL[k];
  });
  state.hidden = ((d && d.hiddenPhotos) || []).slice(); state.baseHidden = state.hidden.slice();
  state.baseline = snapshot(); refresh();
}
async function publish() {
  const btn = document.querySelector('.se-publish'); btn.disabled = true; btn.textContent = 'Publishing…';
  try {
    const now = snapshot(); const hidden = state.hidden.slice();
    const next = await commit(async (live) => mergePublish(live, state.baseline, now, state.baseHidden, hidden));
    showDoc(next);   // the page now shows exactly what guests get, including anyone else's changes
    toast('Published. Guests see it on their next visit.');
  } catch (e) {
    fail(e.code === 'permission-denied' ? "This address isn't on the editor list." : 'Publish failed: ' + (e.code || e.message));
  }
  btn.textContent = 'Publish'; refresh();
}
async function undo() {
  const { doc } = state.fs;
  try {
    if (!confirm('Put back the version from before the last publish?')) return;
    let restored = false;
    const next = await commit(async (live, tx) => {
      if (!live || !live.prevAt) return null;
      const snap = await tx.get(doc(state.db, 'site-copy-history', window.SITE + '-' + live.prevAt));
      if (!snap.exists()) return null;
      restored = true; const prev = snap.data();
      return { blocks: prev.blocks || {}, hiddenPhotos: prev.hiddenPhotos || [] };
    });
    if (!restored) { toast('Nothing to undo yet.'); return; }
    showDoc(next); toast('Previous version restored and published.');
  } catch (e) { fail('Undo failed: ' + (e.code || e.message)); }
}

async function togglePhotos() {
  const ex = document.querySelector('.se-photos'); if (ex) { ex.remove(); return; }
  if (!state.manifest.length) {
    try { state.manifest = await (await fetch('images/pool/manifest.json', { cache: 'no-cache' })).json(); } catch (e) { state.manifest = []; }
  }
  const p = el('div', { className: 'se-photos' });
  if (!state.manifest.length) { p.innerHTML = '<p>No pool photos yet. Add some to the shared Drive folder; they appear here the next morning.</p>'; document.body.appendChild(p); return; }
  p.innerHTML = '<p style="margin:0 0 10px">Hidden photos stay in the folder but never show on the site. Changes count toward Publish.</p><div class="se-grid"></div>';
  const grid = p.querySelector('.se-grid');
  state.manifest.forEach((ph) => {
    const f = el('figure'); f.className = state.hidden.includes(ph.id) ? 'se-hidden' : '';
    f.innerHTML = `<img src="images/pool/${ph.file}" alt=""><figcaption><button>${state.hidden.includes(ph.id) ? 'Show' : 'Hide'}</button></figcaption>`;
    f.querySelector('button').onclick = () => {
      if (state.hidden.includes(ph.id)) state.hidden = state.hidden.filter((x) => x !== ph.id); else state.hidden.push(ph.id);
      f.className = state.hidden.includes(ph.id) ? 'se-hidden' : ''; f.querySelector('button').textContent = state.hidden.includes(ph.id) ? 'Show' : 'Hide'; refresh();
    };
    grid.appendChild(f);
  });
  document.body.appendChild(p);
}

if (typeof document !== 'undefined' && document.body && window.SITE) boot();
