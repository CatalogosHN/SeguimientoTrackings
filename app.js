/* Trackings USA Dashboard
   Static + GitHub sync (Contents API).
   Creador: Brayan Raudales Tu Papi
*/
(() => {
  'use strict';

  // ====== SAFE STORAGE (localStorage can be blocked in some browsers/webviews) ======
  // If localStorage fails, we fall back to in-memory storage so the UI still works.
  const __memStore = Object.create(null);
  let __storageOk = true;
  const lsGet = (k) => {
    try { return localStorage.getItem(k); }
    catch { __storageOk = false; return Object.prototype.hasOwnProperty.call(__memStore, k) ? __memStore[k] : null; }
  };
  const lsSet = (k, v) => {
    try { localStorage.setItem(k, v); }
    catch { __storageOk = false; __memStore[k] = String(v); }
  };
  const lsRemove = (k) => {
    try { localStorage.removeItem(k); }
    catch { delete __memStore[k]; }
  };

  // ====== BASIC "LOGIN" (visual lock) ======
  // In GitHub Pages there's no real secure auth. This is only a front-end lock.
  const AUTH_USER = 'admin';
  const AUTH_PASS_HASH_SHA256 = '391c10d2a2de5d6847292c4cd8b3bfa16224fecf2a4b6759df119fa021b8289b'; // sha256("BryandMay2026@")
  const AUTH_STORAGE_KEY = 'brayan_trackings_auth_v1';

  // ====== STORAGE KEYS ======
  const LS_SETTINGS = 'brayan_trackings_settings_v1';
  const LS_LOCAL_DATA = 'brayan_trackings_local_data_v1';
  const LS_LAST_REMOTE_SHA = 'brayan_trackings_last_sha_v1';

  // ====== DOM ======
  const $ = (id) => document.getElementById(id);

  const loginBackdrop = $('loginBackdrop');
  const loginUser = $('loginUser');
  const loginPass = $('loginPass');
  const loginError = $('loginError');
  const btnLogin = $('btnLogin');

  const settingsBackdrop = $('settingsBackdrop');
  const btnOpenSettings = $('btnOpenSettings');
  const btnCloseSettings = $('btnCloseSettings');
  const btnSaveSettings = $('btnSaveSettings');
  const btnTestSettings = $('btnTestSettings');
  const btnForceSync = $('btnForceSync');
  const settingsHint = $('settingsHint');
  const ghOwner = $('ghOwner');
  const ghRepo = $('ghRepo');
  const ghBranch = $('ghBranch');
  const ghDataPath = $('ghDataPath');
  const ghImageDir = $('ghImageDir');
  const ghToken = $('ghToken');

  // Tags settings
  const tagsManager = $('tagsManager');
  const newTagEmoji = $('newTagEmoji');
  const newTagName = $('newTagName');
  const newTagColor = $('newTagColor');
  const newTagKey = $('newTagKey');
  const btnAddTag = $('btnAddTag');

  const btnLogout = $('btnLogout');

  const searchInput = $('searchInput');
  const statusFilter = $('statusFilter');
  const tagFiltersWrap = $('tagFilters');
  const tagPickersWrap = $('tagPickers');

  const syncStatus = $('syncStatus');
  const btnPull = $('btnPull');
  const btnPush = $('btnPush');
  const stats = $('stats');
  const list = $('list');
  const btnAdd = $('btnAdd');

  const btnExport = $('btnExport');
  const importFile = $('importFile');

  // Gallery
  const galleryBackdrop = $('galleryBackdrop');
  const btnCloseGallery = $('btnCloseGallery');
  const btnGalleryPrev = $('btnGalleryPrev');
  const btnGalleryNext = $('btnGalleryNext');
  const galleryImg = $('galleryImg');
  const galleryCounter = $('galleryCounter');
  const galleryCaption = $('galleryCaption');
  const galleryThumbs = $('galleryThumbs');

  const editBackdrop = $('editBackdrop');
  const btnCloseEdit = $('btnCloseEdit');
  const btnSave = $('btnSave');
  const btnDelete = $('btnDelete');
  const btnMarkReceived = $('btnMarkReceived');
  const editHint = $('editHint');

  const fTitle = $('fTitle');
  const fQty = $('fQty');
  const fTrackingOriginal = $('fTrackingOriginal');
  const fTracking504 = $('fTracking504');
  const otherTrackings = $('otherTrackings');
  const btnAddOtherTracking = $('btnAddOtherTracking');
  const fStatus = $('fStatus');
  const fTotal = $('fTotal');
  const fCurrency = $('fCurrency');
  const fPayment = $('fPayment');
  const fNotes = $('fNotes');
  const fImages = $('fImages');
  const fImagesCamera = $('fImagesCamera');
  const btnPickImages = $('btnPickImages');
  const btnCameraImages = $('btnCameraImages');
  const pasteZone = $('pasteZone');
  const imageGrid = $('imageGrid');
  const metaCreated = $('metaCreated');
  const metaUpdated = $('metaUpdated');

  // ====== STATE ======
  let DATA = {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: []
  };
  let SETTINGS = loadSettings();
  let CURRENT_EDIT_ID = null;
  let CURRENT_EDIT_LOCAL_IMAGES = []; // images added before save
  let POLL_TIMER = null;
  let LAST_ETAG = null;
  let LAST_REMOTE_SHA = lsGet(LS_LAST_REMOTE_SHA) || null;

  // Gallery state
  let GALLERY = { images: [], index: 0, title: '' };

  // ====== UTILS ======
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const nowIso = () => new Date().toISOString();
  const fmtDT = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-HN', {
        year:'numeric', month:'2-digit', day:'2-digit',
        hour:'2-digit', minute:'2-digit'
      });
    } catch {
      return iso;
    }
  };

  const uid = () => {
    const rnd = Math.random().toString(36).slice(2, 10);
    return `${Date.now()}-${rnd}`;
  };

  function safeNumber(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeText(s) {
    return (s || '').toString().trim();
  }

  function toast(message, kind='info') {
    // simple inline toast via syncStatus
    syncStatus.innerHTML = `Sincronización: <span class="badge ${kind==='good'?'good':kind==='bad'?'bad':kind==='warn'?'warn':'info'}">${escapeHtml(message)}</span>`;
    setTimeout(() => renderSyncStatus(), 2400);
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

// ====== TAGS (customizable) ======
function defaultTagDefs() {
  return [
    { id:'pesoRaro', name:'Peso/volumen raro', emoji:'⚠️', color:'#ff7a7a' },
    { id:'inventario', name:'Inventario', emoji:'📦', color:'#38bdf8' },
    { id:'encargoCliente', name:'Encargo de cliente', emoji:'👤', color:'#a78bfa' },
    { id:'esperandoGenerenTracking', name:'Esperando generen tracking', emoji:'🕒', color:'#fbbf24' },
    { id:'recibidoEEUU', name:'Recibido en EEUU', emoji:'✅', color:'#76f7a6' },
    { id:'pendienteSeguimiento', name:'Pendiente de seguimiento', emoji:'🔎', color:'#6ee7ff' },
  ];
}

function slugify(s) {
  return normalizeText(s).toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/(^-|-$)/g,'')
    .slice(0, 40) || ('tag-' + Math.random().toString(36).slice(2,8));
}

function hexToRgba(hex, alpha=0.18) {
  try {
    let h = String(hex || '').trim();
    if (!h) return `rgba(110,231,255,${alpha})`;
    if (h[0] === '#') h = h.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0,2),16);
    const g = parseInt(h.slice(2,4),16);
    const b = parseInt(h.slice(4,6),16);
    if (![r,g,b].every(n => Number.isFinite(n))) return `rgba(110,231,255,${alpha})`;
    return `rgba(${r},${g},${b},${alpha})`;
  } catch {
    return `rgba(110,231,255,${alpha})`;
  }
}

function tagDefs() {
  return Array.isArray(SETTINGS.tagDefs) && SETTINGS.tagDefs.length ? SETTINGS.tagDefs : defaultTagDefs();
}

function findTagDef(id) {
  return tagDefs().find(t => t.id === id) || null;
}

function normalizeItemTags(it) {
  if (!it) return it;
  if (Array.isArray(it.tagIds)) return it;
  const tagIds = [];
  const legacy = it.tags;
  if (legacy && typeof legacy === 'object') {
    if (legacy.pesoRaro) tagIds.push('pesoRaro');
    if (legacy.inventario) tagIds.push('inventario');
    if (legacy.encargoCliente) tagIds.push('encargoCliente');
    if (legacy.esperandoGenerenTracking) tagIds.push('esperandoGenerenTracking');
    if (legacy.recibidoEEUU) tagIds.push('recibidoEEUU');
    if (legacy.pendienteSeguimiento) tagIds.push('pendienteSeguimiento');
  }
  it.tagIds = tagIds;
  return it;
}

function normalizeAllItems() {
  (DATA.items || []).forEach(normalizeItemTags);
}

function getSelectedFilterTagIds() {
  if (!tagFiltersWrap) return [];
  return Array.from(tagFiltersWrap.querySelectorAll('input[data-tagfilter]'))
    .filter(x => x.checked)
    .map(x => x.dataset.tagfilter);
}

function getSelectedEditTagIds() {
  if (!tagPickersWrap) return [];
  return Array.from(tagPickersWrap.querySelectorAll('input[data-tagedit]'))
    .filter(x => x.checked)
    .map(x => x.dataset.tagedit);
}

function renderTagFiltersUI() {
  if (!tagFiltersWrap) return;
  const prev = new Set(getSelectedFilterTagIds());
  tagFiltersWrap.innerHTML = tagDefs().map(t => {
    const c = escapeHtml(t.color || '#38bdf8');
    const id = escapeHtml(t.id);
    const name = escapeHtml(t.name || t.id);
    const em = escapeHtml(t.emoji || '🏷️');
    const checked = prev.has(t.id) ? 'checked' : '';
    return `<label class="chip" data-tagchip="1" style="--chipBorder:${c};"><input type="checkbox" data-tagfilter="${id}" ${checked}/> ${em} ${name}</label>`;
  }).join('');
}

function renderTagPickersUI(selectedIds=[]) {
  if (!tagPickersWrap) return;
  const sel = new Set(selectedIds || []);
  tagPickersWrap.innerHTML = tagDefs().map(t => {
    const c = escapeHtml(t.color || '#38bdf8');
    const id = escapeHtml(t.id);
    const name = escapeHtml(t.name || t.id);
    const em = escapeHtml(t.emoji || '🏷️');
    const checked = sel.has(t.id) ? 'checked' : '';
    return `<label class="chip" data-tagchip="1" style="--chipBorder:${c};"><input type="checkbox" data-tagedit="${id}" ${checked}/> ${em} ${name}</label>`;
  }).join('');
}

function renderTagsManagerUI() {
  if (!tagsManager) return;
  const defs = tagDefs();
  tagsManager.innerHTML = defs.map(t => {
    const id = escapeHtml(t.id);
    const name = escapeHtml(t.name || t.id);
    const em = escapeHtml(t.emoji || '🏷️');
    const color = escapeHtml(t.color || '#38bdf8');
    return `
      <div class="tagRow" data-id="${id}">
        <input class="input" data-field="emoji" value="${em}" placeholder="🏷️" />
        <input class="input" data-field="name" value="${name}" placeholder="Nombre" />
        <input class="input colorInput" data-field="color" type="color" value="${color}" />
        <button class="btn btnDanger btnTiny" type="button" data-action="deleteTag">Eliminar</button>
      </div>
    `;
  }).join('');
}

function readTagDefsFromManager() {
  if (!tagsManager) return tagDefs();
  const rows = Array.from(tagsManager.querySelectorAll('.tagRow'));
  const out = [];
  for (const r of rows) {
    const id = r.dataset.id;
    const emoji = normalizeText(r.querySelector('[data-field="emoji"]')?.value) || '🏷️';
    const name = normalizeText(r.querySelector('[data-field="name"]')?.value) || id;
    const color = normalizeText(r.querySelector('[data-field="color"]')?.value) || '#38bdf8';
    out.push({ id, emoji, name, color });
  }
  return out;
}

  function loadSettings() {
    try {
      const raw = lsGet(LS_SETTINGS);
      if (!raw) return {
        owner:'CatalogosHN',
        repo:'SeguimientoTrackings',
        branch:'main',
        dataPath:'data/trackings.json',
        imageDir:'data/images',
        token:'',
        tagDefs: defaultTagDefs()
      };
      const obj = JSON.parse(raw);
      return {
        owner: obj.owner || 'CatalogosHN',
        repo: obj.repo || 'SeguimientoTrackings',
        branch: obj.branch || 'main',
        dataPath: obj.dataPath || 'data/trackings.json',
        imageDir: obj.imageDir || 'data/images',
        token: obj.token || '',
        tagDefs: Array.isArray(obj.tagDefs) && obj.tagDefs.length ? obj.tagDefs : defaultTagDefs()
      };
    } catch {
      return {
        owner:'',
        repo:'',
        branch:'main',
        dataPath:'data/trackings.json',
        imageDir:'data/images',
        token:'',
        tagDefs: defaultTagDefs()
      };
    }
  }

  function saveSettings(patch) {
    SETTINGS = { ...SETTINGS, ...patch };
    lsSet(LS_SETTINGS, JSON.stringify(SETTINGS));
  }

  function saveLocalData() {
    lsSet(LS_LOCAL_DATA, JSON.stringify(DATA));
  }

  function loadLocalData() {
    try {
      const raw = lsGet(LS_LOCAL_DATA);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && Array.isArray(obj.items)) return obj;
      }
    } catch {}
    return null;
  }

  async function sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
  }

  // ====== GITHUB API ======
  function ghConfigured() {
    return !!(SETTINGS.owner && SETTINGS.repo && SETTINGS.branch && SETTINGS.dataPath);
  }
  function ghWritable() {
    return ghConfigured() && !!SETTINGS.token;
  }

  function ghApiBase() {
    return `https://api.github.com/repos/${SETTINGS.owner}/${SETTINGS.repo}`;
  }
  function ghHeaders(extra={}) {
    const h = {
      'Accept': 'application/vnd.github+json',
      ...extra
    };
    if (SETTINGS.token) h['Authorization'] = `Bearer ${SETTINGS.token}`;
    return h;
  }

  async function ghGetContent(path) {
    const url = `${ghApiBase()}/contents/${encodeURIComponent(path).replaceAll('%2F','/')}?ref=${encodeURIComponent(SETTINGS.branch)}`;
    const headers = ghHeaders();
    if (LAST_ETAG) headers['If-None-Match'] = LAST_ETAG;
    const res = await fetch(url, { headers });
    if (res.status === 304) return { notModified:true };
    LAST_ETAG = res.headers.get('ETag');
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GitHub GET fallo (${res.status}): ${txt.slice(0, 180)}`);
    }
    const json = await res.json();
    return { notModified:false, json };
  }

  function b64ToUtf8(b64) {
    // GitHub may return base64 with line breaks; remove any whitespace safely.
    const bin = atob((b64 || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function utf8ToB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  }

  async function ghPutFile(path, contentStr, sha=null, message='Update data') {
    const url = `${ghApiBase()}/contents/${encodeURIComponent(path).replaceAll('%2F','/')}`;
    const body = {
      message,
      content: utf8ToB64(contentStr),
      branch: SETTINGS.branch
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method:'PUT',
      headers: ghHeaders({'Content-Type':'application/json'}),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GitHub PUT fallo (${res.status}): ${txt.slice(0, 220)}`);
    }
    return await res.json();
  }

  async function fileToJpegDataUrl(file, maxSide=1200, quality=0.86) {
    const img = await fileToImage(file);
    const {canvas, ctx} = makeCanvasForImage(img, maxSide);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function makeCanvasForImage(img, maxSide) {
    const canvas = document.createElement('canvas');
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    return {canvas, ctx};
  }

  function dataUrlToBase64(dataUrl) {
    const idx = (dataUrl || '').indexOf(',');
    return idx >= 0 ? dataUrl.slice(idx+1) : dataUrl;
  }

  async function ghUploadImage(dataUrl, targetPath, message='Upload image') {
    const url = `${ghApiBase()}/contents/${encodeURIComponent(targetPath).replaceAll('%2F','/')}`;
    const body = {
      message,
      content: dataUrlToBase64(dataUrl),
      branch: SETTINGS.branch
    };
    const res = await fetch(url, {
      method:'PUT',
      headers: ghHeaders({'Content-Type':'application/json'}),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Subida de imagen falló (${res.status}): ${txt.slice(0, 220)}`);
    }
    return await res.json();
  }

  function rawUrlForPath(path) {
    const p = (path || '').replace(/^\//,'');
    return `https://raw.githubusercontent.com/${SETTINGS.owner}/${SETTINGS.repo}/${SETTINGS.branch}/${p}`;
  }

  // ====== SYNC FLOW ======
  async function ensureDataFileExists() {
    // If file doesn't exist, create it (requires token)
    if (!ghWritable()) return;
    try {
      await ghGetContent(SETTINGS.dataPath);
      return;
    } catch (e) {
      const msg = (e && e.message) || '';
      if (!msg.includes('404')) throw e;
      const initial = JSON.stringify({ version:1, updatedAt: nowIso(), items: [] }, null, 2);
      await ghPutFile(SETTINGS.dataPath, initial, null, 'Initialize trackings data');
    }
  }

  async function loadFromGitHubIfPossible({silent=false}={}) {
    if (!ghConfigured()) {
      const local = loadLocalData();
      if (local) DATA = local;
      if (!silent) renderAll();
      return;
    }

    try {
      const res = await ghGetContent(SETTINGS.dataPath);
      if (res.notModified) {
        if (!silent) renderAll();
        renderSyncStatus('ok');
        return;
      }
      const content = res.json.content ? b64ToUtf8(res.json.content) : '';
      const parsed = content ? JSON.parse(content) : { version:1, updatedAt: nowIso(), items: [] };
      if (!parsed.items) parsed.items = [];
      DATA = parsed;
      LAST_REMOTE_SHA = res.json.sha;
      lsSet(LS_LAST_REMOTE_SHA, LAST_REMOTE_SHA);

      // store a local backup too
      saveLocalData();
      if (!silent) renderAll();
      renderSyncStatus('ok');
    } catch (e) {
      console.error(e);
      const local = loadLocalData();
      if (local) DATA = local;
      renderAll();
      renderSyncStatus('error', (e && e.message) ? e.message : 'Error');
      if (!silent) toast('Sin conexión a GitHub (usando local)', 'warn');
    }
  }

  async function saveToGitHubIfPossible({silent=false}={}) {
    DATA.updatedAt = nowIso();
    saveLocalData();

    if (!ghWritable()) {
      if (!silent) toast('Guardado local (sin token)', 'warn');
      renderSyncStatus('readonly');
      return;
    }

    await ensureDataFileExists();

    // Releer para obtener SHA actual (evitar conflictos)
    let currentSha = null;
    try {
      const res = await ghGetContent(SETTINGS.dataPath);
      if (!res.notModified && res.json && res.json.sha) {
        currentSha = res.json.sha;
        LAST_REMOTE_SHA = currentSha;
        lsSet(LS_LAST_REMOTE_SHA, LAST_REMOTE_SHA);
      } else {
        currentSha = LAST_REMOTE_SHA;
      }
    } catch {
      currentSha = LAST_REMOTE_SHA;
    }

    try {
      const contentStr = JSON.stringify(DATA, null, 2);
      const out = await ghPutFile(SETTINGS.dataPath, contentStr, currentSha, 'Update trackings data');
      LAST_REMOTE_SHA = out.content && out.content.sha ? out.content.sha : LAST_REMOTE_SHA;
      if (LAST_REMOTE_SHA) lsSet(LS_LAST_REMOTE_SHA, LAST_REMOTE_SHA);
      renderSyncStatus('ok');
      if (!silent) toast('Guardado y sincronizado', 'good');
    } catch (e) {
      console.error(e);
      renderSyncStatus('error', (e && e.message) ? e.message : 'Error');
      if (!silent) toast('No se pudo subir (revisa token/permisos)', 'bad');
      // try to reload after a short delay
      await sleep(650);
      await loadFromGitHubIfPossible({silent:true});
    }
  }

  function startPolling() {
    if (POLL_TIMER) clearInterval(POLL_TIMER);
    // "Tiempo real": polling cada 10s (puedes bajar o subir)
    POLL_TIMER = setInterval(() => {
      if (!ghConfigured()) return;
      loadFromGitHubIfPossible({silent:true});
    }, 10000);
  }

  async function manualPull() {
    if (!ghConfigured()) {
      toast('Primero configura GitHub en ⚙️ Config', 'warn');
      openSettings();
      return;
    }
    try {
      renderSyncStatus('sync');
      await loadFromGitHubIfPossible({silent:false});
      toast('Datos actualizados', 'good');
    } catch (e) {
      console.error(e);
      renderSyncStatus('error', (e && e.message) ? e.message : 'Error');
      toast('No se pudo cargar', 'bad');
    }
  }

  async function manualPush() {
    if (!ghConfigured()) {
      toast('Primero configura GitHub en ⚙️ Config', 'warn');
      openSettings();
      return;
    }
    if (!ghWritable()) {
      toast('Necesitas token en ⚙️ Config para guardar en GitHub', 'warn');
      openSettings();
      return;
    }
    try {
      renderSyncStatus('sync');
      await saveToGitHubIfPossible({silent:false});
    } catch (e) {
      console.error(e);
      renderSyncStatus('error', (e && e.message) ? e.message : 'Error');
      toast('No se pudo guardar', 'bad');
    }
  }


  function updateSyncButtons() {
    if (!btnPull || !btnPush) return;
    btnPull.disabled = !ghConfigured();
    btnPush.disabled = !ghWritable();
  }

  function renderSyncStatus(state=null, detail='') {
    let text = '';
    if (!ghConfigured()) {
      text = 'Sincronización: <span class="muted">no configurada</span>';
    } else if (!SETTINGS.token) {
      if (state === 'sync') {
        text = 'Sincronización: <span class="badge warn">cargando… (solo lectura)</span>';
      } else if (state === 'error') {
        text = `Sincronización: <span class="badge bad">error</span> <span class="muted small">${escapeHtml(detail || '')}</span>`;
      } else {
        text = 'Sincronización: <span class="badge warn">solo lectura (sin token)</span>';
      }
    } else {
      if (state === 'sync') {
        text = 'Sincronización: <span class="badge">sincronizando…</span>';
      } else if (state === 'error') {
        text = `Sincronización: <span class="badge bad">error</span> <span class="muted small">${escapeHtml(detail || '')}</span>`;
      } else {
        text = 'Sincronización: <span class="badge good">activa</span>';
      }
    }
    syncStatus.innerHTML = text;
    updateSyncButtons();
  }

  // ====== RENDER ======
  
  function getFilteredItems() {
    normalizeAllItems();
    const q = normalizeText(searchInput.value).toLowerCase();
    const sf = statusFilter.value;
    const mustTags = getSelectedFilterTagIds(); // tag ids selected in filter chips (AND)

    const items = [...(DATA.items || [])];

    const out = items.filter(it => {
      if (sf !== '__all__' && it.status !== sf) return false;

      // Tag filters (AND): item must include all selected tag ids
      if (mustTags && mustTags.length) {
        const ids = Array.isArray(it.tagIds) ? it.tagIds : [];
        for (const t of mustTags) {
          if (!ids.includes(t)) return false;
        }
      }

      if (q) {
        const blob = [
          it.title,
          it.trackings?.original,
          it.trackings?.hn504,
          ...(it.trackings?.others || []),
          it.purchase?.method,
          it.notes
        ].join(' ').toLowerCase();
        if (!blob.includes(q)) return false;
      }

      return true;
    });

    out.sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return out;
  }

  function renderStats() {
    const items = DATA.items || [];
    const c1 = items.filter(x => x.status === 'Esperando tracking').length;
    const c2 = items.filter(x => x.status === 'Pendiente de seguimiento').length;
    const c3 = items.filter(x => x.status === 'Recibido en Estados Unidos').length;

    stats.innerHTML = `
      <div class="statCard">
        <div class="statLabel">Esperando tracking</div>
        <div class="statValue">${c1}</div>
      </div>
      <div class="statCard">
        <div class="statLabel">Pendiente de seguimiento</div>
        <div class="statValue">${c2}</div>
      </div>
      <div class="statCard">
        <div class="statLabel">Recibido en Estados Unidos</div>
        <div class="statValue">${c3}</div>
      </div>
    `;
  }

  function statusBadge(status) {
    if (status === 'Recibido en Estados Unidos') return `<span class="badge good">✅ ${escapeHtml(status)}</span>`;
    if (status === 'Pendiente de seguimiento') return `<span class="badge info">🕵️ ${escapeHtml(status)}</span>`;
    return `<span class="badge warn">⏳ ${escapeHtml(status || '—')}</span>`;
  }

  function tagBadges(tagIds) {
  const arr = [];
  const ids = Array.isArray(tagIds) ? tagIds : [];
  for (const id of ids) {
    const def = findTagDef(id);
    if (!def) continue;
    const bg = hexToRgba(def.color || '#38bdf8', 0.18);
    const border = escapeHtml(def.color || '#38bdf8');
    const em = escapeHtml(def.emoji || '🏷️');
    const name = escapeHtml(def.name || def.id);
    arr.push(`<span class="badge tagBadge" style="--tagBg:${bg}; --tagBorder:${border};">${em} ${name}</span>`);
  }
  return arr.join(' ');
}


  function compactTracking(it) {
    const a = normalizeText(it.trackings?.original);
    const b = normalizeText(it.trackings?.hn504);
    const others = (it.trackings?.others || []).map(normalizeText).filter(Boolean);
    const parts = [];
    if (a) parts.push(`ORI: ${a}`);
    if (b) parts.push(`504: ${b}`);
    if (others.length) parts.push(`OTR: ${others.join(' | ')}`);
    return parts.length ? parts.join(' • ') : '—';
  }

  function moneyText(it) {
    const total = normalizeText(it.purchase?.total);
    if (!total) return '—';
    const cur = it.purchase?.currency || 'USD';
    return `${cur} ${total}`;
  }

  function renderList() {
    const items = getFilteredItems();
    if (!items.length) {
      list.innerHTML = `
        <div class="card">
          <div class="cardLeft">
            <div class="hTitle">No hay registros</div>
            <div class="cardMeta">Agrega uno con <b>➕ Agregar</b> o ajusta filtros.</div>
          </div>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map(it => {
      const title = escapeHtml(it.title || '(Sin título)');
      const qty = (it.qty === null || it.qty === undefined || it.qty === '') ? '—' : escapeHtml(String(it.qty));
      const tr = escapeHtml(compactTracking(it));
      const status = statusBadge(it.status);
      const tags = tagBadges(it.tagIds);
      const updated = fmtDT(it.updatedAt);
      const created = fmtDT(it.createdAt);

      const hasImages = (it.images && it.images.length) ? `<span class="badge">🖼️ ${it.images.length}</span>` : '';
      const thumbUrl = (it.images && it.images.length) ? (it.images[0].url || '') : '';
      const total = escapeHtml(moneyText(it));
      const pay = escapeHtml(it.purchase?.method || '—');

      const thumbHtml = (thumbUrl)
        ? `
          <div class="miniThumb" role="button" tabindex="0" title="Ver fotos" data-act="photos" data-id="${it.id}">
            <img src="${escapeHtml(thumbUrl)}" alt="foto" />
            <div class="miniCount">${it.images.length}</div>
          </div>
        `
        : '';

      return `
        <div class="card">
          <div class="cardLeft">
            <div class="cardMedia">
              ${thumbHtml}
              <div style="flex:1; min-width:0">
                <div class="cardTitle">
                  <div class="hTitle">${title}</div>
                  ${status}
                  ${hasImages}
                  ${tags}
                </div>
                <div class="cardMeta">
                  <span>Qty: <b>${qty}</b></span>
                  <span class="mono">${tr}</span>
                  <span>Total: <b>${total}</b></span>
                  <span>Pago: <b>${pay}</b></span>
                  <span class="muted">Creado: ${created}</span>
                  <span class="muted">Editado: ${updated}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="cardActions">
            <button class="btn btnGhost" data-act="copyInfo" data-id="${it.id}">📋 Copiar</button>
            <button class="btn btnGhost" data-act="copyTracks" data-id="${it.id}">🔢 Copiar tracking</button>
            <button class="btn btnGhost" data-act="wa" data-id="${it.id}">📲 WhatsApp</button>
            ${(it.images && it.images.length) ? `<button class="btn btnGhost" data-act="photos" data-id="${it.id}">🖼️ Fotos</button>` : ''}
            <button class="btn btnGhost" data-act="received" data-id="${it.id}">✅ Recibido</button>
            <button class="btn btnPrimary" data-act="edit" data-id="${it.id}">✏️ Editar</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderAll() {
    renderStats();
    renderList();
    renderSyncStatus();
  }

  // ====== EDIT MODAL ======
  function openEdit(id=null) {
    CURRENT_EDIT_ID = id;
    CURRENT_EDIT_LOCAL_IMAGES = [];
    editHint.textContent = '';

    // reset other trackings UI
    otherTrackings.innerHTML = '';
    imageGrid.innerHTML = '';
    fImages.value = '';
    if (fImagesCamera) fImagesCamera.value = '';

    const it = id ? (DATA.items || []).find(x => x.id === id) : null;

    const blank = {
      id: uid(),
      title: '',
      qty: null,
      trackings: { original:'', hn504:'', others:[] },
      status: 'Esperando tracking',
      tagIds: [],
      tags: undefined,
      purchase: { total:'', currency:'USD', method:'' },
      notes: '',
      images: [],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    const item = it ? structuredClone(it) : blank;

    // fill form
    fTitle.value = item.title || '';
    fQty.value = (item.qty === null || item.qty === undefined) ? '' : String(item.qty);
    fTrackingOriginal.value = item.trackings?.original || '';
    fTracking504.value = item.trackings?.hn504 || '';
    fStatus.value = item.status || 'Esperando tracking';

        renderTagPickersUI(item.tagIds || []);

    fTotal.value = item.purchase?.total || '';
    fCurrency.value = item.purchase?.currency || 'USD';
    fPayment.value = item.purchase?.method || '';
    fNotes.value = item.notes || '';

    metaCreated.textContent = fmtDT(item.createdAt);
    metaUpdated.textContent = fmtDT(item.updatedAt);

    // other trackings
    const others = (item.trackings?.others || []).slice();
    if (others.length) {
      for (const val of others) addOtherTrackingRow(val);
    }

    // images
    const imgs = (item.images || []).slice();
    renderImageGrid(imgs);

    // button states
    btnDelete.style.display = id ? 'inline-flex' : 'none';
    btnMarkReceived.style.display = 'inline-flex';

    // attach current item snapshot to modal for saving
    editBackdrop.dataset.item = JSON.stringify(item);

    showModal(editBackdrop);
  }

  function closeEdit() {
    hideModal(editBackdrop);
  }

  function addOtherTrackingRow(value='') {
    const rowId = uid();
    const div = document.createElement('div');
    div.className = 'row';
    div.style.justifyContent = 'flex-start';
    div.style.marginTop = '8px';
    div.innerHTML = `
      <input class="input" data-other-tracking="1" id="otr_${rowId}" placeholder="Otro tracking..." value="${escapeHtml(value)}"/>
      <button class="btn btnDanger" data-remove-otr="${rowId}">✖</button>
    `;
    otherTrackings.appendChild(div);

    div.querySelector('[data-remove-otr]').addEventListener('click', () => {
      div.remove();
    });
  }

  function getOtherTrackingsFromUI() {
    return Array.from(otherTrackings.querySelectorAll('input[data-other-tracking]'))
      .map(x => normalizeText(x.value))
      .filter(Boolean);
  }

  function renderImageGrid(images) {
    imageGrid.innerHTML = '';
    (images || []).forEach((img, idx) => {
      const div = document.createElement('div');
      div.className = 'thumb';
      const url = img.url || '';
      div.innerHTML = `
        <img src="${escapeHtml(url)}" alt="img"/>
        <div class="thumbBar">
          <span>#${idx+1}</span>
          <button class="xBtn" data-del-img="${idx}">Eliminar</button>
        </div>
      `;
      // open preview gallery
      div.querySelector('img').addEventListener('click', () => {
        const urls = (images || []).map(x => x && x.url).filter(Boolean);
        if (!urls.length) return;
        GALLERY = { images: urls, index: idx, title: normalizeText(fTitle.value) || 'Fotos' };
        renderGallery();
        showModal(galleryBackdrop);
      });
      div.querySelector('[data-del-img]').addEventListener('click', () => {
        const item = JSON.parse(editBackdrop.dataset.item || '{}');
        item.images = (item.images || []).filter((_,i) => i !== idx);
        editBackdrop.dataset.item = JSON.stringify(item);
        renderImageGrid(item.images || []);
      });
      imageGrid.appendChild(div);
    });
  }

  async function onImagesChosen(files) {
    const arr = Array.from(files || []);
    if (!arr.length) return;

    // preview + prepare upload
    for (const f of arr) {
      const dataUrl = await fileToJpegDataUrl(f);
      CURRENT_EDIT_LOCAL_IMAGES.push({
        name: f.name,
        dataUrl
      });
    }

    // preview locally (not yet committed to repo)
    const item = JSON.parse(editBackdrop.dataset.item || '{}');
    const current = item.images || [];
    const preview = CURRENT_EDIT_LOCAL_IMAGES.map((x) => ({
      path: '',
      url: x.dataUrl,
      pending: true
    }));
    renderImageGrid([...current, ...preview]);

    editHint.textContent = ghWritable()
      ? 'Imágenes listas: al guardar se subirán al repo.'
      : 'Imágenes solo local: configura token para sincronizarlas.';
  }

  async function commitPendingImages(item) {
    if (!CURRENT_EDIT_LOCAL_IMAGES.length) return item.images || [];
    const out = [...(item.images || [])];

    if (!ghWritable()) {
      // keep base64 in local only (warning: increases local storage; not synced)
      CURRENT_EDIT_LOCAL_IMAGES.forEach(x => {
        out.push({ path:'', url:x.dataUrl, localOnly:true });
      });
      return out;
    }

    // upload each image to repo
    const baseDir = normalizeText(SETTINGS.imageDir) || 'data/images';
    const safeBase = baseDir.replace(/^\//,'').replace(/\/$/,'');
    const itemDir = `${safeBase}/${item.id}`;
    const ts = Date.now();

    for (let i=0;i<CURRENT_EDIT_LOCAL_IMAGES.length;i++) {
      const img = CURRENT_EDIT_LOCAL_IMAGES[i];
      const path = `${itemDir}/${ts}_${i+1}.jpg`;
      const message = `Upload image for ${item.id}`;
      try {
        await ghUploadImage(img.dataUrl, path, message);
        out.push({ path, url: rawUrlForPath(path) });
      } catch (e) {
        console.error(e);
        // fallback: keep it local if upload fails
        out.push({ path:'', url: img.dataUrl, localOnly:true });
      }
      // little breath for rate-limit
      await sleep(180);
    }
    return out;
  }

  async function saveEdit() {
    editHint.textContent = '';
    let item = JSON.parse(editBackdrop.dataset.item || '{}');

    // read UI
    item.title = normalizeText(fTitle.value);
    item.qty = safeNumber(fQty.value);
    item.trackings = item.trackings || { original:'', hn504:'', others:[] };
    item.trackings.original = normalizeText(fTrackingOriginal.value);
    item.trackings.hn504 = normalizeText(fTracking504.value);
    item.trackings.others = getOtherTrackingsFromUI();
    item.status = fStatus.value || 'Esperando tracking';

    item.tagIds = getSelectedEditTagIds();
    item.tags = undefined;

    item.purchase = item.purchase || { total:'', currency:'USD', method:'' };
    item.purchase.total = normalizeText(fTotal.value);
    item.purchase.currency = fCurrency.value || 'USD';
    item.purchase.method = normalizeText(fPayment.value);

    item.notes = normalizeText(fNotes.value);

    // timestamps
    const isNew = !DATA.items.some(x => x.id === item.id);
    if (isNew) item.createdAt = nowIso();
    item.updatedAt = nowIso();

    // commit pending images
    if (CURRENT_EDIT_LOCAL_IMAGES.length) {
      editHint.textContent = 'Subiendo imágenes...';
      item.images = await commitPendingImages(item);
    }

    // persist to DATA
    if (isNew) {
      DATA.items.unshift(item);
    } else {
      DATA.items = DATA.items.map(x => x.id === item.id ? item : x);
    }

    CURRENT_EDIT_LOCAL_IMAGES = [];

    await saveToGitHubIfPossible();
    closeEdit();
    renderAll();
  }

  async function deleteItem(id) {
    const ok = confirm('¿Eliminar este registro?');
    if (!ok) return;
    DATA.items = (DATA.items || []).filter(x => x.id !== id);
    await saveToGitHubIfPossible();
    closeEdit();
    renderAll();
  }

  async function markReceived(id) {
    const it = (DATA.items || []).find(x => x.id === id);
    if (!it) return;
    it.status = 'Recibido en Estados Unidos';
    it.updatedAt = nowIso();
    await saveToGitHubIfPossible({silent:true});
    renderAll();
    toast('Marcado como recibido', 'good');
  }

  
  function currencySymbol(cur) {
    if (!cur) return '';
    const c = String(cur).toUpperCase();
    if (c === 'USD') return '$';
    if (c === 'HNL') return 'L ';
    return `${c} `;
  }

  function moneyPretty(it) {
    const total = normalizeText(it.purchase?.total);
    const cur = normalizeText(it.purchase?.currency) || 'USD';
    if (!total) return '—';
    const sym = currencySymbol(cur);
    if (sym === '$') return `$${total}`;
    if (sym === 'L ') return `L ${total}`;
    return `${cur} ${total}`;
  }

  function statusEmoji(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('esperando')) return '⌛';
    if (s.includes('pendiente')) return '🕵️';
    if (s.includes('recibido')) return '✅';
    return '📌';
  }

  function tagsPretty(tagIds) {
  const out = [];
  const ids = Array.isArray(tagIds) ? tagIds : [];
  for (const id of ids) {
    const def = findTagDef(id);
    if (!def) continue;
    out.push(`${def.emoji || '🏷️'} ${def.name || def.id}`);
  }
  return out;
}


  function trackingsPrettyLines(it) {
    const a = normalizeText(it.trackings?.original);
    const b = normalizeText(it.trackings?.hn504);
    const others = (it.trackings?.others || []).map(normalizeText).filter(Boolean);
    const lines = [];
    if (a) lines.push(`🔎 ORI: ${a}`);
    if (b) lines.push(`🇭🇳 504: ${b}`);
    if (others.length) lines.push(`➕ Otros: ${others.join(' | ')}`);
    return lines;
  }

  function formatShareText(it, {imagesAttached=0, imagesTotal=0}={}) {
    const title = normalizeText(it.title) || '(Sin título)';
    const status = normalizeText(it.status) || '—';
    const qty = (it.qty === null || it.qty === undefined || it.qty === '') ? '—' : String(it.qty);
    const pay = normalizeText(it.purchase?.method) || '—';
    const total = moneyPretty(it);

    const lines = [];
    lines.push(`📦 Producto: ${title}`);
    lines.push('');
    lines.push(`${statusEmoji(status)} ${status}`);

    const trLines = trackingsPrettyLines(it);
    if (trLines.length) {
      lines.push('');
      lines.push(...trLines);
    }

    if (qty !== '—') {
      lines.push('');
      lines.push(`🔢 Cantidad: ${qty}`);
    }

    if (total !== '—') lines.push(`💸 Total costo: ${total}`);
    if (pay !== '—') lines.push(`💳 Pago: ${pay}`);

    const tagLines = tagsPretty(it.tagIds);
    if (tagLines.length) {
      lines.push('');
      lines.push(...tagLines);
    }

    const notes = normalizeText(it.notes);
    if (notes) {
      lines.push('');
      lines.push(`📝 Notas: ${notes}`);
    }

    // Images note (best-effort)
    if (imagesTotal > 0) {
      lines.push('');
      if (imagesAttached > 0) lines.push(`📷 Imágenes adjuntas: ${imagesAttached}/${imagesTotal}`);
      else lines.push(`📷 Imágenes: ${imagesTotal}`);
    }

    lines.push('');
    lines.push(`🕒 Editado: ${fmtDT(it.updatedAt)}`);

    return lines.join('\n');
  }

  function copyInfo(id) {
    const it = (DATA.items || []).find(x => x.id === id);
    if (!it) return;
    const t = formatShareText(it, {imagesTotal: (it.images || []).length});
    navigator.clipboard?.writeText(t).then(() => toast('Copiado', 'good')).catch(() => toast('No se pudo copiar', 'bad'));
  }

  function copyOnlyTrackings(id) {
    const it = (DATA.items || []).find(x => x.id === id);
    if (!it) return;
    const title = normalizeText(it.title);
    const lines = [];
    if (title) lines.push(`📦 ${title}`);
    const tr = trackingsPrettyLines(it);
    if (tr.length) lines.push(...tr.map(x => x.replace('🔎 ', '').replace('🇭🇳 ', '').replace('➕ ', '')));
    else lines.push('—');
    const t = lines.join('\n');
    navigator.clipboard?.writeText(t).then(() => toast('Copiado', 'good')).catch(() => toast('No se pudo copiar', 'bad'));
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || '').split(',');
    const meta = parts[0] || '';
    const b64 = parts[1] || '';
    const m = /data:([^;]+);base64/i.exec(meta);
    const mime = m ? m[1] : 'application/octet-stream';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function urlToFile(url, fallbackName='imagen.jpg') {
    if (!url) return null;
    // data URL
    if (String(url).startsWith('data:')) {
      const blob = dataUrlToBlob(url);
      return new File([blob], fallbackName, { type: blob.type });
    }
    const res = await fetch(url, { mode:'cors' });
    const blob = await res.blob();
    const clean = String(url).split('?')[0];
    const name = clean.split('/').pop() || fallbackName;
    return new File([blob], name, { type: blob.type || 'image/jpeg' });
  }

  async function shareWhatsApp(id) {
    const it = (DATA.items || []).find(x => x.id === id);
    if (!it) return;

    const imgs = (it.images || []).map(x => x && x.url).filter(Boolean);
    const max = 5;
    const toGet = imgs.slice(0, max);

    let files = [];
    for (let i=0;i<toGet.length;i++) {
      try {
        const f = await urlToFile(toGet[i], `imagen_${i+1}.jpg`);
        if (f) files.push(f);
      } catch (e) {
        console.warn('No pude cargar imagen para compartir:', e);
      }
    }

    const text = formatShareText(it, {imagesTotal: imgs.length});

    // Copy text first so you can paste it once as the album caption in WhatsApp.
    try { await navigator.clipboard?.writeText(text); } catch {}

    // Prefer native share with ONLY files to avoid WhatsApp repeating the caption per image.
    // The user can paste the copied text once as the caption.
    if (navigator.share) {
      try {
        if (files.length && navigator.canShare && navigator.canShare({ files })) {
          await navigator.share({ title: it.title || 'Trackings USA', files });
          toast(files.length ? 'Imágenes compartidas ✅ (texto copiado: pégalo 1 vez como descripción)' : 'Compartido', 'good');
          return;
        }
        // If no files or cannot share files, share text.
        await navigator.share({ title: it.title || 'Trackings USA', text });
        toast('Compartido', 'good');
        return;
      } catch (e) {
        console.warn(e);
      }
    }

    // Fallback: open WhatsApp with text (no images)
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    toast(files.length ? 'Abrí WhatsApp con el texto (si quieres, adjunta las imágenes manualmente)' : 'Abrí WhatsApp con el texto', files.length ? 'warn' : 'good');
  }

  
// ====== MODALS ======
let __scrollLockY = 0;
let __scrollLocked = false;

function lockBodyScroll() {
  if (__scrollLocked) return;
  __scrollLockY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.classList.add('noScroll');
  document.body.style.position = 'fixed';
  document.body.style.top = `-${__scrollLockY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  __scrollLocked = true;
}

function unlockBodyScrollIfNeeded() {
  const open = document.querySelectorAll('.modalBackdrop.show').length;
  if (open > 0) return;
  if (!__scrollLocked) return;
  document.body.classList.remove('noScroll');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, __scrollLockY);
  __scrollLocked = false;
}

function showModal(backdropEl) {
  backdropEl.classList.add('show');
  backdropEl.setAttribute('aria-hidden','false');
  lockBodyScroll();
}
function hideModal(backdropEl) {
  backdropEl.classList.remove('show');
  backdropEl.setAttribute('aria-hidden','true');
  unlockBodyScrollIfNeeded();
}

  // ====== GALLERY ======
  function openGalleryForItem(id, startIndex=0) {
    const it = (DATA.items || []).find(x => x.id === id);
    if (!it) return;
    const imgs = (it.images || []).map(x => x && x.url).filter(Boolean);
    if (!imgs.length) return;
    GALLERY = { images: imgs, index: Math.max(0, Math.min(startIndex, imgs.length-1)), title: it.title || 'Fotos' };
    renderGallery();
    showModal(galleryBackdrop);
  }

  function closeGallery() {
    hideModal(galleryBackdrop);
  }

  function renderGallery() {
    const imgs = GALLERY.images || [];
    const n = imgs.length;
    if (!n) {
      galleryImg.src = '';
      galleryCounter.textContent = '0 / 0';
      galleryThumbs.innerHTML = '';
      return;
    }
    const i = ((GALLERY.index % n) + n) % n;
    GALLERY.index = i;
    galleryImg.src = imgs[i];
    galleryCounter.textContent = `${i+1} / ${n}`;
    galleryCaption.textContent = GALLERY.title ? `📦 ${GALLERY.title}` : '';

    // thumbs
    galleryThumbs.innerHTML = imgs.map((u, idx) => {
      const active = idx === i ? 'active' : '';
      return `<div class="gThumb ${active}" data-gidx="${idx}" title="${idx+1}"><img src="${escapeHtml(u)}" alt="thumb"/></div>`;
    }).join('');
  }

  function galleryPrev() {
    GALLERY.index = (GALLERY.index || 0) - 1;
    renderGallery();
  }
  function galleryNext() {
    GALLERY.index = (GALLERY.index || 0) + 1;
    renderGallery();
  }

  // ====== SETTINGS UI ======
  function openSettings() {
    ghOwner.value = SETTINGS.owner;
    ghRepo.value = SETTINGS.repo;
    ghBranch.value = SETTINGS.branch || 'main';
    ghDataPath.value = SETTINGS.dataPath || 'data/trackings.json';
    ghImageDir.value = SETTINGS.imageDir || 'data/images';
    ghToken.value = SETTINGS.token || '';
    // tags
    SETTINGS.tagDefs = tagDefs();
    renderTagsManagerUI();
    settingsHint.textContent = '';
    showModal(settingsBackdrop);
  }
  function closeSettings() {
    hideModal(settingsBackdrop);
  }

  async function testSettings() {
    settingsHint.textContent = 'Probando...';
    try {
      const tmp = {
        owner: normalizeText(ghOwner.value),
        repo: normalizeText(ghRepo.value),
        branch: normalizeText(ghBranch.value) || 'main',
        dataPath: normalizeText(ghDataPath.value) || 'data/trackings.json',
        imageDir: normalizeText(ghImageDir.value) || 'data/images',
        token: normalizeText(ghToken.value)
      };
      saveSettings(tmp);

      await loadFromGitHubIfPossible({silent:true});
      if (ghWritable()) {
        await ensureDataFileExists();
      }
      settingsHint.textContent = '✅ OK. Se pudo leer (y escribir si hay token).';
      toast('Conexión OK', 'good');
      renderAll();
      startPolling();
    } catch (e) {
      console.error(e);
      settingsHint.textContent = '❌ Error: ' + (e && e.message ? e.message : 'desconocido');
      toast('Error de conexión', 'bad');
      renderAll();
    }
  }

  async function saveSettingsFromUI() {
    saveSettings({
      owner: normalizeText(ghOwner.value),
      repo: normalizeText(ghRepo.value),
      branch: normalizeText(ghBranch.value) || 'main',
      dataPath: normalizeText(ghDataPath.value) || 'data/trackings.json',
      imageDir: normalizeText(ghImageDir.value) || 'data/images',
      token: normalizeText(ghToken.value),
      tagDefs: readTagDefsFromManager()
    });
    settingsHint.textContent = 'Guardado. Recargando...';
    await loadFromGitHubIfPossible();
    startPolling();
  }

  async function forceSync() {
    LAST_ETAG = null;
    await loadFromGitHubIfPossible();
    toast('Recarga completa', 'good');
  }

  // ====== EXPORT / IMPORT ======
  function exportJson() {
    const blob = new Blob([JSON.stringify(DATA, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trackings_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file) {
    if (!file) return;
    const txt = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(txt);
    } catch {
      alert('JSON inválido');
      return;
    }
    if (!parsed || !Array.isArray(parsed.items)) {
      alert('JSON no tiene formato correcto (items[])');
      return;
    }
    const ok = confirm('¿Importar este JSON? Esto reemplaza tu lista actual.');
    if (!ok) return;

    DATA = parsed;
    DATA.updatedAt = nowIso();
    saveLocalData();
    await saveToGitHubIfPossible();
    renderAll();
    toast('Importado', 'good');
  }

  // ====== LOGIN FLOW ======
  function isAuthed() {
    try {
      const raw = lsGet(AUTH_STORAGE_KEY);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      // session valid for 12h
      if (!obj || !obj.ts) return false;
      const age = Date.now() - obj.ts;
      return age < (12 * 60 * 60 * 1000);
    } catch {
      return false;
    }
  }

  function requireLogin() {
    if (isAuthed()) {
      hideModal(loginBackdrop);
      loginUser.value = '';
      loginPass.value = '';
      return;
    }
    showModal(loginBackdrop);
    loginUser.value = '';
    loginPass.value = '';
    setTimeout(() => loginUser.focus(), 50);
  }

  async function doLogin() {
    loginError.style.display = 'none';
    const u = normalizeText(loginUser.value);
    const p = loginPass.value || '';
    if (!u || !p) {
      loginError.textContent = 'Falta usuario o contraseña.';
      loginError.style.display = 'block';
      return;
    }
    const h = await sha256Hex(p);
    if (u === AUTH_USER && h === AUTH_PASS_HASH_SHA256) {
      lsSet(AUTH_STORAGE_KEY, JSON.stringify({ts: Date.now()}));
      hideModal(loginBackdrop);
      toast('Bienvenido', 'good');
    } else {
      loginError.textContent = 'Usuario o contraseña incorrectos.';
      loginError.style.display = 'block';
    }
  }

  function logout() {
    lsRemove(AUTH_STORAGE_KEY);
    requireLogin();
  }

  // ====== EVENTS ======
  btnLogin.addEventListener('click', doLogin);
  loginPass.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });

  btnLogout.addEventListener('click', logout);

  btnOpenSettings.addEventListener('click', openSettings);
  btnCloseSettings.addEventListener('click', closeSettings);
  settingsBackdrop.addEventListener('click', (e) => {
    if (e.target === settingsBackdrop) closeSettings();
  });
  btnSaveSettings.addEventListener('click', saveSettingsFromUI);
  btnTestSettings.addEventListener('click', testSettings);
  btnForceSync.addEventListener('click', forceSync);


// Tags manager actions
if (tagsManager) {
  tagsManager.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action="deleteTag"]');
    if (!b) return;
    const row = e.target.closest('.tagRow');
    if (row) row.remove();
  });
}
if (btnAddTag) {
  btnAddTag.addEventListener('click', () => {
    const name = normalizeText(newTagName?.value);
    if (!name) return toast('Escribe el nombre de la etiqueta', 'warn');
    const emoji = normalizeText(newTagEmoji?.value) || '🏷️';
    const color = normalizeText(newTagColor?.value) || '#38bdf8';
    const keyRaw = normalizeText(newTagKey?.value);
    let id = slugify(keyRaw || name);
    const existing = new Set(Array.from(tagsManager?.querySelectorAll('.tagRow') || []).map(r => r.dataset.id));
    let base = id, k = 2;
    while (existing.has(id)) { id = `${base}-${k++}`; }
    // append row
    if (tagsManager) {
      const div = document.createElement('div');
      div.className = 'tagRow';
      div.dataset.id = id;
      div.innerHTML = `
        <input class="input" data-field="emoji" value="${escapeHtml(emoji)}" placeholder="🏷️" />
        <input class="input" data-field="name" value="${escapeHtml(name)}" placeholder="Nombre" />
        <input class="input colorInput" data-field="color" type="color" value="${escapeHtml(color)}" />
        <button class="btn btnDanger btnTiny" type="button" data-action="deleteTag">Eliminar</button>
      `;
      tagsManager.appendChild(div);
    }
    if (newTagName) newTagName.value = '';
    if (newTagKey) newTagKey.value = '';
    if (newTagEmoji) newTagEmoji.value = '';
    toast('Etiqueta agregada (recuerda Guardar Config)', 'good');
  });
}
  btnAdd.addEventListener('click', () => openEdit(null));
  btnPull && btnPull.addEventListener('click', manualPull);
  btnPush && btnPush.addEventListener('click', manualPush);
  btnCloseEdit.addEventListener('click', closeEdit);
  editBackdrop.addEventListener('click', (e) => {
    if (e.target === editBackdrop) closeEdit();
  });

  btnAddOtherTracking.addEventListener('click', () => addOtherTrackingRow(''));

  btnSave.addEventListener('click', saveEdit);
  btnDelete.addEventListener('click', () => {
    const item = JSON.parse(editBackdrop.dataset.item || '{}');
    deleteItem(item.id);
  });
  btnMarkReceived.addEventListener('click', async () => {
    const item = JSON.parse(editBackdrop.dataset.item || '{}');
    await markReceived(item.id);
    closeEdit();
  });

  // Image pickers
  if (btnPickImages) btnPickImages.addEventListener('click', () => fImages && fImages.click());
  if (btnCameraImages) btnCameraImages.addEventListener('click', () => fImagesCamera && fImagesCamera.click());

  fImages.addEventListener('change', (e) => onImagesChosen(e.target.files));
  if (fImagesCamera) fImagesCamera.addEventListener('change', (e) => onImagesChosen(e.target.files));

  // Paste & drag/drop images (useful on PC)
  function handlePasteImages(e) {
    if (!editBackdrop.classList.contains('show')) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const it of items) {
      if (it && it.type && it.type.startsWith('image/')) {
        const f = it.getAsFile?.();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      onImagesChosen(files);
      toast(`Imagen${files.length>1?'es':''} pegada${files.length>1?'s':''} ✅`, 'good');
    }
  }
  window.addEventListener('paste', handlePasteImages);

  function wireDropZone(el) {
    if (!el) return;
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.style.borderColor = 'rgba(110,231,255,.55)'; });
    el.addEventListener('dragleave', () => { el.style.borderColor = ''; });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.style.borderColor = '';
      const files = Array.from(e.dataTransfer?.files || []).filter(f => (f.type||'').startsWith('image/'));
      if (files.length) onImagesChosen(files);
    });
  }
  wireDropZone(pasteZone);
  wireDropZone(imageGrid);

  // Filters
  [searchInput, statusFilter].forEach(el => {
    el.addEventListener('input', renderAll);
    el.addEventListener('change', renderAll);
  });
  if (tagFiltersWrap) {
    tagFiltersWrap.addEventListener('change', renderAll);
    tagFiltersWrap.addEventListener('input', renderAll);
  }

  // List actions (delegation)
  list.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const id = el.dataset.id;
    if (act === 'edit') openEdit(id);
    if (act === 'received') markReceived(id);
    if (act === 'copyInfo') copyInfo(id);
    if (act === 'copyTracks') copyOnlyTrackings(id);
    if (act === 'wa') shareWhatsApp(id);
    if (act === 'photos') openGalleryForItem(id, 0);
  });

  // Export/Import
  btnExport.addEventListener('click', exportJson);
  importFile.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    importJson(f);
    importFile.value = '';
  });

  // Close modals with ESC
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (editBackdrop.classList.contains('show')) closeEdit();
    if (settingsBackdrop.classList.contains('show')) closeSettings();
    if (galleryBackdrop && galleryBackdrop.classList.contains('show')) closeGallery();
  });

  // Gallery events
  if (btnCloseGallery) btnCloseGallery.addEventListener('click', closeGallery);
  if (galleryBackdrop) {
    galleryBackdrop.addEventListener('click', (e) => {
      if (e.target === galleryBackdrop) closeGallery();
    });
  }
  if (btnGalleryPrev) btnGalleryPrev.addEventListener('click', galleryPrev);
  if (btnGalleryNext) btnGalleryNext.addEventListener('click', galleryNext);
  if (galleryThumbs) {
    galleryThumbs.addEventListener('click', (e) => {
      const t = e.target.closest('[data-gidx]');
      if (!t) return;
      GALLERY.index = Number(t.dataset.gidx || 0);
      renderGallery();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (!galleryBackdrop || !galleryBackdrop.classList.contains('show')) return;
    if (e.key === 'ArrowLeft') galleryPrev();
    if (e.key === 'ArrowRight') galleryNext();
  });

  // Swipe for gallery (mobile friendly)
  let __swipeStartX = null;
  if (galleryImg) {
    galleryImg.addEventListener('touchstart', (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      __swipeStartX = t.clientX;
    }, {passive:true});
    galleryImg.addEventListener('touchend', (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t || __swipeStartX === null) return;
      const dx = t.clientX - __swipeStartX;
      __swipeStartX = null;
      if (Math.abs(dx) < 45) return;
      if (dx > 0) galleryPrev();
      else galleryNext();
    });
  }

  // ====== INIT ======
  async function init() {
    renderSyncStatus();

    requireLogin(); // show login overlay if not authed

    // Load initial data
    const local = loadLocalData();
    if (local) DATA = local;

    // Then try GitHub
    await loadFromGitHubIfPossible();
    renderTagFiltersUI();
    startPolling();
    renderAll();
  }

  window.addEventListener('load', init);

})();
