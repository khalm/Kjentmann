/* Kjentmann – dine egne gode plasser på kartet.
   Alt lagres lokalt på telefonen. Ingen konto, ingen server, ingen kostnader. */
'use strict';

const APP_VERSION = '1.0.0';

/* ---------------------------------------------------------------- Data */

const CATEGORIES = [
  { id: 'fiske',     name: 'Fiske',     icon: '🎣', color: '#2f6fb5' },
  { id: 'sopp',      name: 'Sopp',      icon: '🍄', color: '#b5652f' },
  { id: 'baer',      name: 'Bær',       icon: '🫐', color: '#6a3fa0' },
  { id: 'jakt',      name: 'Jakt',      icon: '🦌', color: '#7a5a2f' },
  { id: 'telt',      name: 'Telt',      icon: '⛺', color: '#3f8a4f' },
  { id: 'baal',      name: 'Bål',       icon: '🔥', color: '#d9542b' },
  { id: 'bad',       name: 'Bading',    icon: '🏊', color: '#1fa3b8' },
  { id: 'utsikt',    name: 'Utsikt',    icon: '🏔️', color: '#5f6f7a' },
  { id: 'vann',      name: 'Vann',      icon: '💧', color: '#3a8fd9' },
  { id: 'parkering', name: 'Parkering', icon: '🅿️', color: '#4a5560' },
  { id: 'annet',     name: 'Annet',     icon: '📍', color: '#c9442b' },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const ICONS = [
  '🎣','🐟','🦐','🦀','🦞','🍄','🫐','🍓',
  '🍒','🍎','🌰','🌿','🌸','🌼','🦌','🫎',
  '🦆','🐦','🐻','🦊','⛺','🏕️','🔥','🪵',
  '🏊','🛶','⛵','🏔️','💧','🅿️','🌲','🍂',
  '🧺','⭐','❤️','⚠️','🚫','🏠','🚶','📍',
];

const COLORS = ['#c9442b','#d9542b','#e0a21b','#3f8a4f','#24493a','#1fa3b8','#2f6fb5','#6a3fa0','#b5652f','#4a5560'];

const LAYERS = {
  topo: {
    name: 'Topografisk', sub: 'Kartverket – stier, vann, høydekurver',
    url: 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png',
    opts: { maxZoom: 18, maxNativeZoom: 18, attribution: '© <a href="https://www.kartverket.no/">Kartverket</a>' },
  },
  graa: {
    name: 'Gråtone', sub: 'Kartverket – rolig kart der ikonene synes godt',
    url: 'https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png',
    opts: { maxZoom: 18, maxNativeZoom: 18, attribution: '© <a href="https://www.kartverket.no/">Kartverket</a>' },
  },
  foto: {
    name: 'Flyfoto', sub: 'Satellitt- og flybilder',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opts: { maxZoom: 19, maxNativeZoom: 18, attribution: 'Bilder © Esri, Maxar, Earthstar Geographics' },
  },
  osm: {
    name: 'OpenStreetMap', sub: 'Fungerer i hele verden',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    opts: { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  },
};

const STORE_KEY = 'kjentmann.places.v1';
const SETTINGS_KEY = 'kjentmann.settings.v1';

let places = load(STORE_KEY, []);
let settings = Object.assign({ layer: 'topo', view: null, welcomed: false }, load(SETTINGS_KEY, {}));

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function savePlaces() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(places)); }
  catch { toast('Klarte ikke å lagre – lagringsplassen er kanskje full.'); }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------------------------------------------------------------- Hjelpere */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n, d = 0) => n.toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d });

function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

function fmtDist(m) {
  if (m == null) return '';
  if (m < 15) return 'her';
  if (m < 1000) return `${nf(Math.round(m / 5) * 5)} m`;
  if (m < 10000) return `${nf(m / 1000, 1)} km`;
  return `${nf(m / 1000)} km`;
}

/* Areal av polygon på kuleflate (m²) */
function polygonArea(coords) {
  const R = 6378137, rad = Math.PI / 180;
  let s = 0;
  for (let i = 0; i < coords.length; i++) {
    const [la1, lo1] = coords[i], [la2, lo2] = coords[(i + 1) % coords.length];
    s += (lo2 - lo1) * rad * (2 + Math.sin(la1 * rad) + Math.sin(la2 * rad));
  }
  return Math.abs(s * R * R / 2);
}
function fmtArea(m2) {
  if (m2 < 1000) return `${nf(Math.round(m2))} m²`;
  if (m2 < 1e6) return `${nf(m2 / 1000, m2 < 1e4 ? 1 : 0)} dekar`;
  return `${nf(m2 / 1e6, 2)} km²`;
}

function placeCenter(p) {
  if (p.type === 'point') return L.latLng(p.coords[0], p.coords[1]);
  return L.polygon(p.coords).getBounds().getCenter();
}
function distanceTo(p) {
  return me ? map.distance([me.lat, me.lng], placeCenter(p)) : null;
}
function fmtCoord(ll) {
  return `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;
}

/* ---------------------------------------------------------------- Kart */

$('#version').textContent = 'v' + APP_VERSION;

const map = L.map('map', {
  zoomControl: false,
  attributionControl: true,
  worldCopyJump: true,
}).setView(settings.view?.c || [64.5, 12.5], settings.view?.z || 5);

L.control.zoom({ position: 'topleft' }).addTo(map);
L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

let baseLayer = null;
function setLayer(id) {
  if (!LAYERS[id]) id = 'topo';
  if (baseLayer) map.removeLayer(baseLayer);
  baseLayer = L.tileLayer(LAYERS[id].url, LAYERS[id].opts).addTo(map);
  settings.layer = id; saveSettings();
}
setLayer(settings.layer);

map.on('moveend', () => {
  const c = map.getCenter();
  settings.view = { c: [c.lat, c.lng], z: map.getZoom() };
  saveSettings();
});

/* ---------------------------------------------------------------- Plasser på kartet */

const placeLayer = L.featureGroup().addTo(map);
const layerById = new Map();
let filterCats = new Set();      // tom = vis alle
let selectedId = null;

function pinIcon(p, selected) {
  const html = `<div class="pin${selected ? ' selected' : ''}"><svg viewBox="0 0 40 48" width="40" height="48">
    <path d="M20 1.5C9.8 1.5 2 9.3 2 19.2c0 12.7 14.8 23.5 17 26.8a1.2 1.2 0 0 0 2 0c2.2-3.3 17-14.1 17-26.8C38 9.3 30.2 1.5 20 1.5z" fill="${p.color}" stroke="#fff" stroke-width="2"/>
    <circle cx="20" cy="19" r="13.5" fill="#fff"/></svg><div class="emo">${esc(p.icon)}</div></div>`;
  return L.divIcon({ html, className: '', iconSize: [40, 48], iconAnchor: [20, 47] });
}
function areaIcon(p) {
  return L.divIcon({
    html: `<div class="area-label" style="color:${p.color}">${esc(p.icon)}</div>`,
    className: '', iconSize: [34, 34], iconAnchor: [17, 17],
  });
}

function renderPlaces() {
  placeLayer.clearLayers();
  layerById.clear();
  for (const p of places) {
    if (filterCats.size && !filterCats.has(p.cat)) continue;
    const onClick = e => onPlaceTap(p.id, e);
    if (p.type === 'point') {
      const m = L.marker(p.coords, { icon: pinIcon(p, p.id === selectedId), zIndexOffset: p.id === selectedId ? 1000 : 0 })
        .on('click', onClick);
      placeLayer.addLayer(m);
      layerById.set(p.id, m);
    } else {
      const sel = p.id === selectedId;
      const poly = L.polygon(p.coords, {
        color: p.color, weight: sel ? 4 : 3, fillOpacity: sel ? .32 : .2, dashArray: sel ? null : '6 4',
      }).on('click', onClick);
      const label = L.marker(placeCenter(p), { icon: areaIcon(p) }).on('click', onClick);
      placeLayer.addLayer(poly); placeLayer.addLayer(label);
      layerById.set(p.id, poly);
    }
  }
}

function onPlaceTap(id, e) {
  if (mode) {
    // I tegnemodus fungerer et trykk på en eksisterende plass som et vanlig trykk i kartet
    L.DomEvent.stopPropagation(e);
    handleMapTapInMode(e.latlng);
    return;
  }
  L.DomEvent.stopPropagation(e);
  openDetail(id);
}

function select(id) {
  selectedId = id;
  renderPlaces();
}

/* ---------------------------------------------------------------- Posisjon */

let me = null;            // { lat, lng, acc, t }
let follow = false;
let meMarker = null, meCircle = null;
let watchId = null;
const posListeners = new Set();

function startWatch() {
  if (!('geolocation' in navigator) || watchId != null) return;
  watchId = navigator.geolocation.watchPosition(onPos, onPosErr, {
    enableHighAccuracy: true, maximumAge: 5000, timeout: 30000,
  });
}
function onPos(pos) {
  const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
  me = { lat, lng, acc, t: Date.now() };
  if (!meMarker) {
    meCircle = L.circle([lat, lng], { radius: acc, color: '#2b7bff', weight: 1, fillOpacity: .12, interactive: false }).addTo(map);
    meMarker = L.marker([lat, lng], {
      icon: L.divIcon({ html: '<div class="me-dot"></div>', className: '', iconSize: [18, 18], iconAnchor: [9, 9] }),
      interactive: false, zIndexOffset: 2000,
    }).addTo(map);
  } else {
    meMarker.setLatLng([lat, lng]);
    meCircle.setLatLng([lat, lng]).setRadius(acc);
  }
  if (follow) map.panTo([lat, lng], { animate: true });
  posListeners.forEach(fn => fn(me));
}
function onPosErr(err) {
  if (err.code === 1) {
    stopFollow();
    if (!onPosErr.warned) { onPosErr.warned = true; toast('Kjentmann har ikke lov til å se hvor du er. Slå på posisjon i innstillingene.', 4500); }
  }
}

function getFreshPosition() {
  return new Promise((resolve, reject) => {
    if (me && Date.now() - me.t < 10000 && me.acc <= 40) return resolve(me);
    if (!('geolocation' in navigator)) return reject(new Error('Telefonen støtter ikke posisjon.'));
    startWatch();
    let done = false;
    // Vent på en god posisjon, men ta den beste vi har etter en stund
    const finish = (ok, v) => { if (done) return; done = true; posListeners.delete(listener); clearTimeout(timer); ok ? resolve(v) : reject(v); };
    const listener = p => { if (p.acc <= 25) finish(true, p); };
    posListeners.add(listener);
    const timer = setTimeout(() => me ? finish(true, me) : finish(false, new Error('Fant ikke posisjonen din. Prøv igjen litt senere, gjerne ute.')), 12000);
    navigator.geolocation.getCurrentPosition(pos => {
      onPos(pos);
      if (pos.coords.accuracy <= 40) finish(true, me);
    }, err => {
      if (err.code === 1) finish(false, new Error('Du må gi Kjentmann lov til å se posisjonen din.'));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  });
}

function stopFollow() {
  follow = false;
  $('#btnLocate').classList.remove('following');
}

$('#btnLocate').addEventListener('click', async () => {
  if (follow) { stopFollow(); return; }
  startWatch();
  if (me) {
    map.setView([me.lat, me.lng], Math.max(map.getZoom(), 15));
  } else {
    toast('Finner posisjonen din …');
    try { const p = await getFreshPosition(); map.setView([p.lat, p.lng], Math.max(map.getZoom(), 15)); }
    catch (e) { toast(e.message, 4000); return; }
  }
  follow = true;
  $('#btnLocate').classList.add('following');
});
map.on('dragstart', stopFollow);

/* ---------------------------------------------------------------- Bunnark */

let sheetOpen = false, onSheetClose = null;

/* Tilbake-knappen på telefonen lukker ark og avbryter tegning.
   Ett historikk-steg dekker alt som er åpent; det fjernes først når ingenting er åpent lenger. */
let overlayInHistory = false, ignorePops = 0;
function overlayOpened() {
  if (!overlayInHistory) { history.pushState({ kjentmann: 1 }, ''); overlayInHistory = true; }
}
function overlayMaybeClosed() {
  setTimeout(() => {
    if (!sheetOpen && !mode && overlayInHistory) { overlayInHistory = false; ignorePops++; history.back(); }
  }, 0);
}

function openSheet(html, opts = {}) {
  if (sheetOpen && onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
  $('#sheetBody').innerHTML = html;
  $('#sheetBody').scrollTop = 0;
  $('#sheet').classList.remove('hidden');
  $('#backdrop').classList.toggle('hidden', !!opts.noBackdrop);
  sheetOpen = true;
  onSheetClose = opts.onClose || null;
  overlayOpened();
  return $('#sheetBody');
}
function closeSheet(fromPop = false) {
  if (!sheetOpen) return;
  $('#sheet').classList.add('hidden');
  $('#backdrop').classList.add('hidden');
  sheetOpen = false;
  if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
  if (!fromPop) overlayMaybeClosed();
}
$('#backdrop').addEventListener('click', () => closeSheet());
window.addEventListener('popstate', () => {
  if (ignorePops > 0) { ignorePops--; return; }
  overlayInHistory = false;
  if (sheetOpen) closeSheet(true);
  else if (mode) cancelMode(true);
});

// Dra ned for å lukke
(() => {
  const sheet = $('#sheet');
  let y0 = null, dy = 0;
  const grip = sheet.querySelector('.sheet-grip');
  const startOn = el => el === grip || ($('#sheetBody').scrollTop <= 0 && el.closest('.sheet-head-drag'));
  sheet.addEventListener('touchstart', e => { if (startOn(e.target)) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener('touchend', () => {
    if (y0 == null) return;
    sheet.style.transform = '';
    if (dy > 90) closeSheet();
    y0 = null;
  });
})();

/* ---------------------------------------------------------------- Tegnemodus */

let mode = null;       // null | 'point' | 'area'
let modeState = null;
const draftLayer = L.layerGroup().addTo(map);

function showModeBar(text, buttons) {
  $('#modeText').innerHTML = text;
  const box = $('#modeActions');
  box.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = 'btn ' + (b.cls || '');
    el.innerHTML = b.label;
    if (b.disabled) el.disabled = true;
    el.addEventListener('click', b.onClick);
    box.appendChild(el);
  }
  $('#modeBar').classList.remove('hidden');
  $('#dock').classList.add('hidden');
}
function enterMode(m, state) {
  closeSheet();
  mode = m; modeState = state;
  overlayOpened();
}
function endMode(fromPop = false) {
  if (!fromPop) overlayMaybeClosed();
  posListeners.delete(walkListener);
  mode = null; modeState = null;
  draftLayer.clearLayers();
  $('#modeBar').classList.add('hidden');
  $('#crosshair').classList.add('hidden');
  $('#dock').classList.remove('hidden');
  map.getContainer().style.cursor = '';
}
function cancelMode(fromPop = false) {
  const st = modeState;
  endMode(fromPop === true);
  if (st?.onCancel) st.onCancel();
}

map.on('click', e => {
  if (mode) handleMapTapInMode(e.latlng);
  else if (sheetOpen) closeSheet();
});

function handleMapTapInMode(latlng) {
  if (mode === 'point') {
    const st = modeState; endMode(); st.onPick(latlng);
  } else if (mode === 'area') {
    addVertex(latlng);
  }
}

/* Punkt: trykk i kartet, eller sikt med krysset */
function startPointMode({ onPick, onCancel, title, start }) {
  enterMode('point', { onPick, onCancel });
  if (start) map.setView(start, Math.max(map.getZoom(), 16));
  $('#crosshair').classList.remove('hidden');
  showModeBar(title || '<b>Nytt punkt:</b> trykk der plassen er, eller flytt kartet så krysset står på den.', [
    { label: 'Avbryt', onClick: () => cancelMode() },
    { label: '✔ Plasser ved krysset', cls: 'primary grow', onClick: () => { const c = map.getCenter(); const st = modeState; endMode(); st.onPick(c); } },
  ]);
}

/* Område: trykk ut hjørnene, eller gå rundt området med GPS */
function startAreaMode({ onDone, onCancel, initial }) {
  enterMode('area', { verts: (initial || []).map(c => L.latLng(c)), walking: false, onDone, onCancel });
  posListeners.add(walkListener);
  updateArea();
  if (initial?.length) map.fitBounds(L.latLngBounds(initial), { padding: [60, 60] });
}
function walkListener(p) {
  if (mode !== 'area' || !modeState?.walking) return;
  if (p.acc > 30) return;
  const ll = L.latLng(p.lat, p.lng);
  const last = modeState.verts[modeState.verts.length - 1];
  if (!last || map.distance(last, ll) >= 8) addVertex(ll);
}
function addVertex(ll) {
  modeState.verts.push(L.latLng(ll.lat, ll.lng));
  updateArea();
}
function updateArea() {
  const st = modeState;
  draftLayer.clearLayers();
  const v = st.verts;
  if (v.length >= 3) L.polygon(v, { color: '#c9442b', weight: 3, fillOpacity: .18, interactive: false }).addTo(draftLayer);
  else if (v.length === 2) L.polyline(v, { color: '#c9442b', weight: 3, interactive: false }).addTo(draftLayer);
  v.forEach((ll, i) => L.marker(ll, {
    interactive: false,
    icon: L.divIcon({ html: `<div class="vertex${i === 0 ? ' first' : ''}"></div>`, className: '', iconSize: [16, 16], iconAnchor: [8, 8] }),
  }).addTo(draftLayer));

  const info = v.length >= 3 ? ` – ${fmtArea(polygonArea(v.map(l => [l.lat, l.lng])))}` : '';
  const text = st.walking
    ? `<b>Gå rundt området.</b> Et nytt hjørne legges til hver 8. meter. ${v.length} hjørner${info}`
    : `<b>Nytt område:</b> trykk ut hjørnene i kartet. ${v.length} hjørner${info}`;
  showModeBar(text, [
    { label: 'Avbryt', onClick: () => cancelMode() },
    { label: '↶ Angre', disabled: !v.length, onClick: () => { st.verts.pop(); updateArea(); } },
    { label: st.walking ? '⏸ Stopp' : '🚶 Gå rundt', onClick: async () => {
        if (!st.walking) {
          try { const p = await getFreshPosition(); st.walking = true; walkListener(p); toast('Gå langs kanten av området. Trykk Stopp når du er rundt.'); }
          catch (e) { toast(e.message, 4000); }
        } else st.walking = false;
        if (mode === 'area') updateArea();
      } },
    { label: '📍 Her', onClick: async () => {
        try { const p = await getFreshPosition(); addVertex(L.latLng(p.lat, p.lng)); }
        catch (e) { toast(e.message, 4000); }
      } },
    { label: '✔ Ferdig', cls: 'primary grow', disabled: v.length < 3, onClick: () => {
        const coords = st.verts.map(l => [+l.lat.toFixed(6), +l.lng.toFixed(6)]);
        endMode(); st.onDone(coords);
      } },
  ]);
}

/* ---------------------------------------------------------------- Ny plass / rediger */

function blankDraft(type, coords, extra = {}) {
  const c = CAT.annet;
  return Object.assign({ type, coords, name: '', cat: c.id, icon: c.icon, color: c.color, note: '' }, extra);
}

function openForm(draft, { isNew = true, accuracy = null } = {}) {
  let iconTouched = !isNew, colorTouched = !isNew;
  const where = draft.type === 'point'
    ? `Punkt ved ${fmtCoord(L.latLng(draft.coords))}${accuracy ? ` (±${Math.round(accuracy)} m)` : ''}`
    : `Område på ${fmtArea(polygonArea(draft.coords))}`;

  const body = openSheet(`
    <h2>${isNew ? (draft.type === 'point' ? 'Ny plass' : 'Nytt område') : 'Rediger'}</h2>
    <div class="sub">${esc(where)}</div>

    <h3>Navn</h3>
    <input type="text" id="fName" maxlength="80" placeholder="F.eks. Ørretkulpen, Kantarellbakken …" value="${esc(draft.name)}" autocomplete="off">

    <h3>Hva er det her?</h3>
    <div class="chips" id="fCats">
      ${CATEGORIES.map(c => `<button class="chip${c.id === draft.cat ? ' on' : ''}" data-cat="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('')}
    </div>

    <h3>Ikon</h3>
    <div class="icon-grid" id="fIcons">
      ${ICONS.map(i => `<button class="icon-cell${i === draft.icon ? ' on' : ''}" data-icon="${i}" aria-label="${i}">${i}</button>`).join('')}
    </div>

    <h3>Farge</h3>
    <div class="colors" id="fColors">
      ${COLORS.map(c => `<button class="swatch${c === draft.color ? ' on' : ''}" data-color="${c}" style="background:${c}" aria-label="Farge"></button>`).join('')}
    </div>

    <h3>Notat</h3>
    <textarea id="fNote" maxlength="2000" placeholder="Hva er bra her? Når på året? Hvilket agn? Tips til veien inn …">${esc(draft.note)}</textarea>

    <div class="actions">
      ${!isNew ? `<button class="btn" id="fMove">${draft.type === 'point' ? '✥ Flytt punktet' : '⬠ Tegn området på nytt'}</button>` : ''}
      <button class="btn" id="fCancel">Avbryt</button>
      <button class="btn primary grow" id="fSave">Lagre</button>
    </div>
  `);

  const sync = () => {
    body.querySelectorAll('#fCats .chip').forEach(b => b.classList.toggle('on', b.dataset.cat === draft.cat));
    body.querySelectorAll('#fIcons .icon-cell').forEach(b => b.classList.toggle('on', b.dataset.icon === draft.icon));
    body.querySelectorAll('#fColors .swatch').forEach(b => b.classList.toggle('on', b.dataset.color === draft.color));
  };
  const readText = () => { draft.name = $('#fName').value.trim(); draft.note = $('#fNote').value.trim(); };

  body.querySelector('#fCats').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    draft.cat = b.dataset.cat;
    if (!iconTouched) draft.icon = CAT[draft.cat].icon;
    if (!colorTouched) draft.color = CAT[draft.cat].color;
    sync();
  });
  body.querySelector('#fIcons').addEventListener('click', e => {
    const b = e.target.closest('[data-icon]'); if (!b) return;
    draft.icon = b.dataset.icon; iconTouched = true; sync();
  });
  body.querySelector('#fColors').addEventListener('click', e => {
    const b = e.target.closest('[data-color]'); if (!b) return;
    draft.color = b.dataset.color; colorTouched = true; sync();
  });
  body.querySelector('#fCancel').addEventListener('click', () => {
    if (isNew) closeSheet(); else openDetail(draft.id);
  });
  body.querySelector('#fSave').addEventListener('click', () => {
    readText();
    if (!draft.name) draft.name = CAT[draft.cat].name + (draft.type === 'area' ? 'område' : 'plass');
    const now = Date.now();
    if (isNew) {
      const p = { id: newId(), ...draft, created: now, updated: now };
      places.push(p);
      savePlaces();
      selectedId = p.id;
      renderPlaces();
      toast('Lagret ✔');
      openDetail(p.id);
    } else {
      const i = places.findIndex(p => p.id === draft.id);
      if (i >= 0) places[i] = { ...places[i], ...draft, updated: now };
      savePlaces(); renderPlaces();
      toast('Endringene er lagret');
      openDetail(draft.id);
    }
  });
  const mv = body.querySelector('#fMove');
  if (mv) mv.addEventListener('click', () => {
    readText();
    const back = () => openForm(draft, { isNew: false });
    if (draft.type === 'point') {
      startPointMode({
        title: '<b>Flytt punktet:</b> trykk på ny plassering, eller flytt kartet så krysset står der.',
        start: draft.coords,
        onPick: ll => { draft.coords = [+ll.lat.toFixed(6), +ll.lng.toFixed(6)]; back(); },
        onCancel: back,
      });
    } else {
      startAreaMode({ initial: draft.coords, onDone: coords => { draft.coords = coords; back(); }, onCancel: back });
    }
  });
  if (isNew) setTimeout(() => $('#fName')?.focus({ preventScroll: true }), 250);
}

/* Knappene nede */
$('#btnHere').addEventListener('click', async () => {
  toast('Finner posisjonen din …', 8000);
  try {
    const p = await getFreshPosition();
    toast(`Funnet (±${Math.round(p.acc)} m)`);
    map.setView([p.lat, p.lng], Math.max(map.getZoom(), 16));
    openForm(blankDraft('point', [+p.lat.toFixed(6), +p.lng.toFixed(6)]), { accuracy: p.acc });
  } catch (e) { toast(e.message, 4500); }
});
$('#btnPoint').addEventListener('click', () => {
  startPointMode({
    onPick: ll => openForm(blankDraft('point', [+ll.lat.toFixed(6), +ll.lng.toFixed(6)])),
  });
});
$('#btnArea').addEventListener('click', () => {
  startAreaMode({ onDone: coords => openForm(blankDraft('area', coords)) });
});
$('#btnList').addEventListener('click', () => openList());

/* ---------------------------------------------------------------- Detaljer */

function openDetail(id) {
  const p = places.find(x => x.id === id);
  if (!p) return;
  select(id);
  const c = CAT[p.cat] || CAT.annet;
  const center = placeCenter(p);
  const dist = distanceTo(p);
  const kind = p.type === 'point' ? 'Punkt' : `Område · ${fmtArea(polygonArea(p.coords))}`;
  const created = new Date(p.created).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });

  const body = openSheet(`
    <div class="detail-head sheet-head-drag">
      <div class="big-emo" style="background:${p.color}">${esc(p.icon)}</div>
      <div>
        <h2>${esc(p.name)}</h2>
        <div class="sub">${c.icon} ${esc(c.name)} · ${kind}${dist != null ? (dist < 15 ? ' · du er her' : ` · ${fmtDist(dist)} unna`) : ''}</div>
      </div>
    </div>
    ${p.note ? `<div class="note">${esc(p.note)}</div>` : ''}
    <div class="meta">
      ${p.type === 'point' ? 'Posisjon' : 'Midtpunkt'}: <code>${fmtCoord(center)}</code><br>
      Lagt til ${created}${p.from ? ' · delt med deg' : ''}
    </div>
    <div class="actions">
      <button class="btn primary grow" id="dShare">📤 Del</button>
      <button class="btn grow" id="dNav">🧭 Veibeskrivelse</button>
    </div>
    <div class="actions" style="margin-top:8px">
      <button class="btn grow" id="dZoom">🔍 Vis</button>
      <button class="btn grow" id="dEdit">✏️ Rediger</button>
      <button class="btn danger" id="dDel">Slett</button>
    </div>
  `, { noBackdrop: true, onClose: () => { if (selectedId === id) select(null); } });

  body.querySelector('#dShare').addEventListener('click', () => sharePlaces([p], p.name));
  body.querySelector('#dNav').addEventListener('click', () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`, '_blank', 'noopener');
  });
  body.querySelector('#dZoom').addEventListener('click', () => zoomTo(p));
  body.querySelector('#dEdit').addEventListener('click', () => openForm(structuredClone(p), { isNew: false }));
  body.querySelector('#dDel').addEventListener('click', () => {
    if (!confirm(`Slette «${p.name}»? Dette kan ikke angres.`)) return;
    places = places.filter(x => x.id !== id);
    savePlaces();
    selectedId = null;
    closeSheet();
    renderPlaces();
    toast('Slettet');
  });
}

function zoomTo(p) {
  // Gi plass til arket nederst
  const pad = { paddingTopLeft: [40, 90], paddingBottomRight: [40, Math.round(window.innerHeight * 0.45)] };
  if (p.type === 'point') {
    const z = Math.max(map.getZoom(), 15);
    const pt = map.project(p.coords, z).add([0, window.innerHeight * 0.18]);
    map.setView(map.unproject(pt, z), z);
  } else {
    map.fitBounds(L.polygon(p.coords).getBounds(), pad);
  }
}

/* ---------------------------------------------------------------- Liste */

let listQuery = '';
function openList() {
  const used = CATEGORIES.filter(c => places.some(p => p.cat === c.id));
  const body = openSheet(`
    <h2 class="sheet-head-drag">Mine plasser <span class="sub" style="font-size:.9rem">(${places.length})</span></h2>
    ${places.length ? `
      <input type="search" id="lQ" placeholder="Søk i navn og notater" value="${esc(listQuery)}">
      <div class="chips" id="lCats" style="margin-top:10px">
        <button class="chip${filterCats.size ? '' : ' on'}" data-cat="">Alle</button>
        ${used.map(c => `<button class="chip${filterCats.has(c.id) ? ' on' : ''}" data-cat="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('')}
      </div>
      <ul class="list" id="lItems"></ul>
      <div class="actions"><button class="btn grow" id="lShare">📤 Del plassene i listen</button></div>
    ` : `<div class="empty">Du har ikke lagt inn noen plasser ennå.<br><br>
      Trykk <b>📍 Her jeg står</b> for å lagre plassen du er på nå,<br>
      eller <b>➕ Punkt</b> og <b>⬠ Område</b> for å merke hvor som helst i kartet.</div>`}
  `);
  if (!places.length) return;

  const visible = () => {
    const q = listQuery.toLowerCase();
    return places
      .filter(p => !filterCats.size || filterCats.has(p.cat))
      .filter(p => !q || p.name.toLowerCase().includes(q) || (p.note || '').toLowerCase().includes(q));
  };
  const draw = () => {
    let items = visible().map(p => ({ p, d: distanceTo(p) }));
    items.sort((a, b) => (a.d != null && b.d != null) ? a.d - b.d : b.p.created - a.p.created);
    body.querySelector('#lItems').innerHTML = items.length ? items.map(({ p, d }) => {
      const c = CAT[p.cat] || CAT.annet;
      return `<li data-id="${esc(p.id)}">
        <div class="li-emo" style="background:${p.color}22">${esc(p.icon)}</div>
        <div class="li-main"><div class="li-name">${esc(p.name)}</div>
          <div class="li-sub">${esc(c.name)} · ${p.type === 'point' ? 'punkt' : 'område'}</div></div>
        <div class="li-dist">${fmtDist(d)}</div></li>`;
    }).join('') : `<div class="empty">Ingen treff.</div>`;
    body.querySelector('#lShare').disabled = !items.length;
  };
  draw();

  body.querySelector('#lQ').addEventListener('input', e => { listQuery = e.target.value; draw(); });
  body.querySelector('#lCats').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    const id = b.dataset.cat;
    if (!id) filterCats.clear();
    else filterCats.has(id) ? filterCats.delete(id) : filterCats.add(id);
    body.querySelectorAll('#lCats .chip').forEach(x => x.classList.toggle('on', x.dataset.cat ? filterCats.has(x.dataset.cat) : !filterCats.size));
    renderPlaces(); draw();
  });
  body.querySelector('#lItems').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    const p = places.find(x => x.id === li.dataset.id);
    if (p) { zoomTo(p); openDetail(p.id); }
  });
  body.querySelector('#lShare').addEventListener('click', () => {
    const v = visible();
    sharePlaces(v, v.length === 1 ? v[0].name : `${v.length} plasser`);
  });
}

/* ---------------------------------------------------------------- Deling via lenke */

function b64urlEncode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function streamBytes(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

async function encodeShare(list) {
  const compact = {
    v: 1,
    p: list.map(p => {
      const o = { n: p.name, c: p.cat, i: p.icon, k: p.color, t: p.type === 'area' ? 'a' : 'p' };
      o.g = p.type === 'point'
        ? [+p.coords[0].toFixed(6), +p.coords[1].toFixed(6)]
        : p.coords.map(c => [+c[0].toFixed(6), +c[1].toFixed(6)]);
      if (p.note) o.o = p.note;
      return o;
    }),
  };
  const raw = new TextEncoder().encode(JSON.stringify(compact));
  if ('CompressionStream' in window) {
    try { return 'z' + b64urlEncode(await streamBytes(raw, new CompressionStream('deflate-raw'))); } catch {}
  }
  return 'j' + b64urlEncode(raw);
}

async function decodeShare(token) {
  const kind = token[0];
  let bytes = b64urlDecode(token.slice(1));
  if (kind === 'z') bytes = await streamBytes(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('ukjent format');
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || !Array.isArray(data.p)) throw new Error('ugyldig');
  return data.p.slice(0, 500).map(sanitizeShared).filter(Boolean);
}

const okLat = v => typeof v === 'number' && isFinite(v) && v >= -90 && v <= 90;
const okLng = v => typeof v === 'number' && isFinite(v) && v >= -180 && v <= 180;
function sanitizeShared(o) {
  if (!o || typeof o !== 'object') return null;
  const type = o.t === 'a' ? 'area' : 'point';
  let coords;
  if (type === 'point') {
    if (!Array.isArray(o.g) || !okLat(o.g[0]) || !okLng(o.g[1])) return null;
    coords = [o.g[0], o.g[1]];
  } else {
    if (!Array.isArray(o.g) || o.g.length < 3 || o.g.length > 5000) return null;
    coords = o.g.filter(c => Array.isArray(c) && okLat(c[0]) && okLng(c[1])).map(c => [c[0], c[1]]);
    if (coords.length < 3) return null;
  }
  const cat = CAT[o.c] ? o.c : 'annet';
  const icon = typeof o.i === 'string' && o.i.length <= 12 ? o.i : CAT[cat].icon;
  const color = typeof o.k === 'string' && /^#[0-9a-f]{6}$/i.test(o.k) ? o.k : CAT[cat].color;
  const name = typeof o.n === 'string' ? o.n.slice(0, 80) : CAT[cat].name;
  const note = typeof o.o === 'string' ? o.o.slice(0, 2000) : '';
  return { type, coords, cat, icon, color, name, note };
}

async function sharePlaces(list, title) {
  if (!list.length) return;
  const token = await encodeShare(list);
  const url = `${location.origin}${location.pathname}#del=${token}`;
  const text = list.length === 1
    ? `${list[0].icon} ${list[0].name} – en plass fra Kjentmann`
    : `${list.length} plasser fra Kjentmann`;
  if (navigator.share) {
    try { await navigator.share({ title: `Kjentmann: ${title}`, text, url }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Lenken er kopiert – lim den inn i en melding'); return; } catch {}
  openSheet(`<h2>Del</h2><p>Kopier lenken og send den til den du vil dele med:</p>
    <div class="share-box"><textarea readonly style="min-height:120px">${esc(url)}</textarea></div>`);
}

function sameAs(a, b) {
  return a.type === b.type && a.name === b.name && JSON.stringify(a.coords) === JSON.stringify(b.coords);
}

async function checkIncomingShare() {
  const m = location.hash.match(/^#del=([A-Za-z0-9_-]+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  let list;
  try { list = await decodeShare(m[1]); }
  catch { toast('Lenken ser ut til å være ødelagt – be om å få den på nytt.', 4500); return; }
  if (!list.length) return;

  const preview = L.featureGroup().addTo(map);
  list.forEach(p => {
    if (p.type === 'point') L.marker(p.coords, { icon: pinIcon(p, true), interactive: false }).addTo(preview);
    else {
      L.polygon(p.coords, { color: p.color, weight: 4, fillOpacity: .3, interactive: false }).addTo(preview);
      L.marker(placeCenter(p), { icon: areaIcon(p), interactive: false }).addTo(preview);
    }
  });
  const b = preview.getBounds();
  if (list.length === 1 && list[0].type === 'point') {
    const z = 15, pt = map.project(list[0].coords, z).add([0, window.innerHeight * 0.18]);
    map.setView(map.unproject(pt, z), z);
  } else map.fitBounds(b, { paddingTopLeft: [40, 90], paddingBottomRight: [40, Math.round(window.innerHeight * 0.45)] });

  const fresh = list.filter(p => !places.some(q => sameAs(p, q)));
  let saved = false;
  const body = openSheet(`
    <h2 class="sheet-head-drag">${list.length === 1 ? 'En plass er delt med deg' : `${list.length} plasser er delt med deg`}</h2>
    <ul class="list">
      ${list.map(p => `<li><div class="li-emo" style="background:${p.color}22">${esc(p.icon)}</div>
        <div class="li-main"><div class="li-name">${esc(p.name)}</div>
        <div class="li-sub">${esc(CAT[p.cat].name)} · ${p.type === 'point' ? 'punkt' : 'område på ' + fmtArea(polygonArea(p.coords))}</div>
        ${p.note ? `<div class="li-sub" style="white-space:pre-wrap">${esc(p.note)}</div>` : ''}</div></li>`).join('')}
    </ul>
    ${fresh.length < list.length ? `<div class="sub" style="margin-top:8px">${list.length - fresh.length} av dem har du fra før.</div>` : ''}
    <div class="actions">
      <button class="btn" id="iNo">Nei takk</button>
      <button class="btn primary grow" id="iYes" ${fresh.length ? '' : 'disabled'}>Lagre i mine plasser</button>
    </div>
  `, { noBackdrop: true, onClose: () => { map.removeLayer(preview); } });

  body.querySelector('#iNo').addEventListener('click', () => closeSheet());
  body.querySelector('#iYes').addEventListener('click', () => {
    const now = Date.now();
    const added = fresh.map(p => ({ id: newId(), ...p, from: 'delt', created: now, updated: now }));
    places.push(...added);
    savePlaces(); saved = true;
    closeSheet();
    renderPlaces();
    toast(added.length === 1 ? `«${added[0].name}» er lagret` : `${added.length} plasser er lagret`);
  });
}
window.addEventListener('hashchange', checkIncomingShare);

/* ---------------------------------------------------------------- Kartlag */

$('#btnLayers').addEventListener('click', () => {
  const body = openSheet(`
    <h2 class="sheet-head-drag">Kartlag</h2>
    ${Object.entries(LAYERS).map(([id, l]) => `
      <button class="menu-item layer-item${settings.layer === id ? ' on' : ''}" data-layer="${id}">
        <span class="menu-ico">${settings.layer === id ? '●' : '○'}</span>
        <span>${esc(l.name)}<small>${esc(l.sub)}</small></span>
      </button>`).join('')}
  `);
  body.addEventListener('click', e => {
    const b = e.target.closest('[data-layer]'); if (!b) return;
    setLayer(b.dataset.layer);
    closeSheet();
  });
});

/* ---------------------------------------------------------------- Meny */

let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });

$('#btnMenu').addEventListener('click', () => {
  const body = openSheet(`
    <h2 class="sheet-head-drag">Kjentmann <span class="sub" style="font-size:.9rem">v${APP_VERSION}</span></h2>
    ${installPrompt ? `<button class="menu-item" data-act="install"><span class="menu-ico">📲</span><span>Legg til på hjemskjermen<small>Åpnes som en vanlig app</small></span></button>` : ''}
    <button class="menu-item" data-act="offline"><span class="menu-ico">⬇️</span><span>Last ned kart for området<small>Så kartet virker der det ikke er dekning</small></span></button>
    <button class="menu-item" data-act="shareall"><span class="menu-ico">📤</span><span>Del plasser<small>Velg hvilke i «Mine plasser» og trykk Del</small></span></button>
    <button class="menu-item" data-act="export"><span class="menu-ico">💾</span><span>Ta sikkerhetskopi<small>Lagre alle plassene i en fil</small></span></button>
    <button class="menu-item" data-act="import"><span class="menu-ico">📂</span><span>Hent fra sikkerhetskopi<small>Legg til plasser fra en fil</small></span></button>
    <button class="menu-item" data-act="about"><span class="menu-ico">ℹ️</span><span>Om Kjentmann</span></button>
  `);
  body.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'install') { closeSheet(); installPrompt.prompt(); installPrompt = null; }
    if (act === 'offline') openOffline();
    if (act === 'shareall') openList();
    if (act === 'export') exportBackup();
    if (act === 'import') { closeSheet(); $('#importFile').click(); }
    if (act === 'about') openAbout();
  });
});

function exportBackup() {
  const data = { app: 'kjentmann', version: APP_VERSION, exported: new Date().toISOString(), places };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kjentmann-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(`Sikkerhetskopi med ${places.length} plasser er lastet ned`);
}

$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const arr = Array.isArray(data) ? data : data.places;
    if (!Array.isArray(arr)) throw 0;
    let added = 0;
    for (const raw of arr) {
      const s = sanitizeShared({ n: raw.name, c: raw.cat, i: raw.icon, k: raw.color, t: raw.type === 'area' ? 'a' : 'p', g: raw.coords, o: raw.note });
      if (!s) continue;
      if (places.some(q => q.id === raw.id || sameAs(q, s))) continue;
      places.push({ id: typeof raw.id === 'string' ? raw.id : newId(), ...s, created: +raw.created || Date.now(), updated: Date.now() });
      added++;
    }
    savePlaces(); renderPlaces();
    toast(added ? `${added} plasser er lagt til` : 'Ingen nye plasser i filen');
  } catch { toast('Filen kunne ikke leses som en Kjentmann-sikkerhetskopi', 4000); }
});

function openAbout() {
  openSheet(`
    <h2 class="sheet-head-drag">Om Kjentmann</h2>
    <p>Versjon <b>${APP_VERSION}</b></p>
    <p>Kjentmann er din egen kartbok over gode plasser – fiskeplasser, sopp, bær og alt annet du vil huske.</p>
    <p><b>Plassene dine lagres bare på denne telefonen.</b> Ingen konto, ingen sporing, ingen reklame. Det betyr også at de forsvinner hvis du sletter appen eller nettleserdataene, så ta gjerne en sikkerhetskopi av og til.</p>
    <p>Når du deler en plass, ligger plassen inni selve lenken. Den sendes ikke via noen server.</p>
    <p class="sub">Kart: © Kartverket, © OpenStreetMap-bidragsytere, bilder © Esri.</p>
  `);
}

/* ---------------------------------------------------------------- Nedlasting for bruk uten dekning */

function tilesFor(bounds, zMin, zMax) {
  const out = [];
  const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
  const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
  for (let z = zMin; z <= zMax; z++) {
    const x0 = lon2x(bounds.getWest(), z), x1 = lon2x(bounds.getEast(), z);
    const y0 = lat2y(bounds.getNorth(), z), y1 = lat2y(bounds.getSouth(), z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ x, y, z });
  }
  return out;
}

function openOffline() {
  const MAX = 3000;
  const layer = LAYERS[settings.layer];
  const z0 = Math.max(map.getZoom(), 8);
  let zMax = Math.min(17, z0 + 4);
  let tiles = tilesFor(map.getBounds(), z0, zMax);
  while (tiles.length > MAX && zMax > z0) { zMax--; tiles = tilesFor(map.getBounds(), z0, zMax); }
  const tooBig = tiles.length > MAX;
  const mb = tiles.length * 0.025;

  const body = openSheet(`
    <h2 class="sheet-head-drag">Last ned kart</h2>
    <p>Lagrer kartet <b>${esc(layer.name)}</b> for det du ser på skjermen nå, slik at det virker uten dekning.</p>
    ${tooBig
      ? `<p>Området er for stort. Zoom inn litt mer og prøv igjen.</p>`
      : `<p class="sub">${nf(tiles.length)} kartbiter (omtrent ${nf(Math.max(1, mb), mb < 10 ? 1 : 0)} MB), zoomnivå ${z0}–${zMax}. Dette går best på wifi.</p>
         <div class="progress hidden" id="oProg"><div></div></div>
         <div class="sub" id="oText" style="margin-top:6px"></div>
         <div class="actions"><button class="btn" id="oCancel">Lukk</button><button class="btn primary grow" id="oGo">⬇️ Last ned</button></div>`}
  `);
  if (tooBig) return;
  let stop = false;
  body.querySelector('#oCancel').addEventListener('click', () => { stop = true; closeSheet(); });
  body.querySelector('#oGo').addEventListener('click', async e => {
    e.target.disabled = true;
    const bar = body.querySelector('#oProg'), txt = body.querySelector('#oText');
    bar.classList.remove('hidden');
    const cache = await caches.open('kjentmann-tiles-saved');
    let done = 0, failed = 0, i = 0;
    const worker = async () => {
      while (!stop && i < tiles.length) {
        const t = tiles[i++];
        const url = L.Util.template(layer.url, { ...t, s: 'a', r: '' });
        try {
          if (!(await cache.match(url))) {
            const res = await fetch(url, { mode: 'no-cors' });
            await cache.put(url, res);
          }
        } catch { failed++; }
        done++;
        if (done % 10 === 0 || done === tiles.length) {
          bar.firstElementChild.style.width = `${(done / tiles.length) * 100}%`;
          txt.textContent = `${nf(done)} av ${nf(tiles.length)}`;
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (stop) return;
    txt.textContent = failed ? `Ferdig, men ${failed} kartbiter feilet. Prøv igjen for å hente resten.` : 'Ferdig! Kartet for dette området virker nå uten dekning.';
    if (navigator.storage?.persist) navigator.storage.persist();
  });
}

/* ---------------------------------------------------------------- Velkommen */

function maybeWelcome() {
  if (settings.welcomed || places.length || location.hash.startsWith('#del=')) return;
  openSheet(`
    <h2 class="sheet-head-drag">Velkommen til Kjentmann 🌲</h2>
    <p>Her samler du dine egne gode plasser – fiskekulper, kantarellbakker, multemyrer og alt annet du vil finne igjen.</p>
    <ul style="padding-left:20px;line-height:1.6">
      <li><b>📍 Her jeg står</b> lagrer plassen du er på akkurat nå.</li>
      <li><b>➕ Punkt</b> lar deg merke hvor som helst i kartet.</li>
      <li><b>⬠ Område</b> merker en hel myr eller li – trykk ut hjørnene, eller gå rundt med telefonen.</li>
      <li><b>📤 Del</b> sender en plass til andre som en lenke.</li>
    </ul>
    <p class="sub">Plassene lagres bare på telefonen din.</p>
    <div class="actions"><button class="btn primary grow" id="wOk">Sett i gang</button></div>
  `, { onClose: () => { settings.welcomed = true; saveSettings(); } });
  $('#wOk').addEventListener('click', () => closeSheet());
}

/* ---------------------------------------------------------------- Oppstart */

renderPlaces();
startWatch();
checkIncomingShare();
maybeWelcome();
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
