// app.js - Main Application Logic
const SUPABASE_URL = "https://vstfquvvtsmgmztmnnaq.supabase.co";
const SUPABASE_KEY = "sb_publishable_9sp5XCEbqCNk0CQNyoE8SA_3a-rXoDn";
const PHOTO_BUCKET = "patient-photos";
const LOGO_BUCKET = "clinic-logos";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let patients = [];
let pendingFiles = [];
let scanner = null;
let currentPhotoList = [];
let currentPhotoIndex = 0;
let selectedToothPatientId = null;
let selectedToothNumber = null;

// Ensure safeText is globally available for HTML escaping
window.safeText = function(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// --- API Helpers ---
async function api(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : await res.json();
}

function doctorExtras(){
  try { return JSON.parse(localStorage.getItem("clinicDoctorExtras-" + (currentUser?.id || "guest")) || "{}"); }
  catch { return {}; }
}
function saveDoctorExtras(extras){ 
  localStorage.setItem("clinicDoctorExtras-" + (currentUser?.id || "guest"), JSON.stringify(extras || {})); 
}

function splitList(v){ return String(v || "").split(/[\n,]+/).map(x => x.trim()).filter(Boolean); }

// --- Auth & State ---
function getSavedUser() {
  try { return JSON.parse(localStorage.getItem("clinicUser")); } catch { return null; }
}

function saveUser(user) {
  localStorage.setItem("clinicUser", JSON.stringify(user));
  currentUser = user;
}

window.logout = function() {
  localStorage.removeItem("clinicUser");
  location.href = location.pathname + "?logout=1";
};

// --- Core UI Modals & Menus ---
window.openClinicMenu = function() {
  document.getElementById("drawerOverlay")?.remove();
  document.getElementById("sideDrawer")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "drawer-overlay clean-menu-overlay";
  overlay.id = "drawerOverlay";
  overlay.onclick = window.closeClinicMenu;

  const drawer = document.createElement("aside");
  drawer.className = "side-drawer clean-side-drawer";
  drawer.id = "sideDrawer";
  const isAdmin = currentUser?.role === "admin";

  drawer.innerHTML = `
    <div class="drawer-head">
      <h2>${safeText(window.t('menu'))}</h2>
      <button class="drawer-close-btn" onclick="closeClinicMenu()">×</button>
    </div>
    <div class="drawer-user">
      <div>${safeText(currentUser?.full_name || currentUser?.username || 'Doctor')}</div>
      <small>${safeText((currentUser?.role || 'doctor').toUpperCase())}</small>
    </div>
    <div class="drawer-menu clean-drawer-menu">
      <button class="primary-item" onclick="closeClinicMenu();showPage('form')">${safeText(window.t('addPatient'))}</button>
      <button onclick="closeClinicMenu();showPage('scan')">${safeText(window.t('scanQR'))}</button>
      <button onclick="closeClinicMenu();openPremiumCalendar()">Calendar</button>
      <button onclick="closeClinicMenu();openFinancialReports()">Reports</button>
      <button onclick="closeClinicMenu();showPage('settings')">${safeText(window.t('settings'))}</button>
      <button onclick="closeClinicMenu();openDoctorProfile()">${safeText(window.t('profile'))}</button>
      ${isAdmin ? `<button onclick="closeClinicMenu();manageUsers()">${safeText(window.t('manageUsers'))}</button>` : ''}
      <button class="danger-item" onclick="logout()">${safeText(window.t('logout'))}</button>
    </div>
  `;
  document.body.append(overlay, drawer);
};

window.closeClinicMenu = function() {
  document.getElementById("drawerOverlay")?.remove();
  document.getElementById("sideDrawer")?.remove();
};

window.showPage = function(page) {
  if (page === 'settings') {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    let s = document.getElementById('settings'); 
    if (!s) { 
      s = document.createElement('section'); 
      s.id = 'settings'; s.className = 'page'; 
      document.querySelector('main.app')?.appendChild(s); 
    }
    s.classList.add('active');
    s.innerHTML = `
      <div class="card settings-page">
        <h2>${safeText(window.t('settings'))}</h2>
        <p class="muted">Clinic tools and preferences in one simple place.</p>
        <div class="settings-grid-clean">
          <button class="settings-tile" onclick="openThemePicker()"><b>Theme</b><span>Custom color</span></button>
          <button class="settings-tile" onclick="openLanguagePicker()"><b>Language</b><span>Select App Language</span></button>
          <button class="settings-tile" onclick="openPdfPatternPicker()"><b>PDF Style</b><span>Reports and receipts</span></button>
          <button class="settings-tile" onclick="openDoctorInfoCard()"><b>Doctor Card</b><span>Specialty, phones, website</span></button>
          <button class="settings-tile" onclick="openSignaturePad()"><b>Signature</b><span>PDFs and receipts</span></button>
          <button class="settings-tile" onclick="backupData()"><b>Backup</b><span>Export clinic data</span></button>
          <button class="settings-tile" onclick="restoreBackup()"><b>Restore</b><span>Import backup file</span></button>
        </div>
      </div>
      <div class="card" id="premiumSettingsTools">
        <h2>Clinic Management</h2>
        <div class="premium-tools-grid">
          <button class="premium-tool-btn" onclick="openPremiumCalendar()">Calendar<small>Appointments and statuses</small></button>
          <button class="premium-tool-btn" onclick="openFinancialReports()">Financial reports<small>Revenue and unpaid balances</small></button>
          <button class="premium-tool-btn" onclick="openReminderCenter()">Reminders<small>WhatsApp templates</small></button>
          <button class="premium-tool-btn" onclick="openRolePermissions()">Roles<small>Permissions by staff type</small></button>
        </div>
      </div>
    `;
    window.scrollTo(0,0); 
    if(window.applyLanguage) window.applyLanguage(); 
    return;
  }
  
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  $(page)?.classList.add("active");
  document.querySelector(`[data-page="${page}"]`)?.classList.add("active");
  window.scrollTo(0, 0);
  if(window.applyLanguage) window.applyLanguage();
};

// --- Photos & Before/After (Unified from Repair Patches) ---
function normalizePhotosFinal(patient) {
  const list = Array.isArray(patient?.photos) ? patient.photos : [];
  return list.map((raw, index) => {
    const obj = (raw && typeof raw === 'object') ? raw : {url: raw, path: raw};
    let category = String(obj.category || obj.photoCategory || '').toLowerCase();
    let stage = String(obj.stage || obj.type || '').toLowerCase();
    const name = String(obj.name || obj.filename || '').toLowerCase();
    
    if (category.includes('x') || name.includes('xray') || name.includes('x-ray')) category = 'xray';
    if (category !== 'xray') category = 'clinical';
    if (!['before', 'after', 'general'].includes(stage)) stage = 'general';
    
    return { raw, obj, index, url: (typeof obj === 'string' ? obj : obj.url), category, stage, name };
  }).filter(x => x.url);
}

window.renderSimplePhotos = function(patient, type = 'clinical') {
  window.__photoFilter = type;
  const all = normalizePhotosFinal(patient);
  const filtered = type === 'xray' ? all.filter(p=>p.category==='xray') : type === 'beforeAfter' ? all.filter(p=>p.stage==='before' || p.stage==='after') : all.filter(p=>p.category==='clinical');
  
  return `
    <div class="clean-photo-section">
      <div class="clean-photo-tabs">
        <button type="button" class="${type==='clinical'?'active':''}" onclick="switchSimplePhotoType('${patient.id}','clinical')">Clinical <small>${all.filter(p=>p.category==='clinical').length}</small></button>
        <button type="button" class="${type==='xray'?'active':''}" onclick="switchSimplePhotoType('${patient.id}','xray')">X-Ray <small>${all.filter(p=>p.category==='xray').length}</small></button>
        <button type="button" class="${type==='beforeAfter'?'active':''}" onclick="showBeforeAfter('${patient.id}')">Before/After</button>
      </div>
      ${filtered.length ? `<div class="clean-photo-grid">${filtered.map(ph => `
        <div class="clean-photo-card" data-index="${ph.index}">
          <button class="photo-dots" type="button" aria-label="Options" onclick="openPhotoOptions('${patient.id}', ${ph.index})">•••</button>
          <img src="${safeText(ph.url)}" alt="Patient photo" onclick="openCleanPhotoViewer('${patient.id}', ${ph.index})" loading="lazy">
          <div class="clean-photo-meta"><span>${safeText(ph.category)}</span><span>•</span><span>${safeText(ph.stage)}</span></div>
        </div>
      `).join('')}</div>` : `<div class="clean-empty-photo">No photos found</div>`}
    </div>
  `;
};

window.switchSimplePhotoType = function(patientId, type) { 
  const p = patients.find(x => x.id === patientId); 
  const box = document.getElementById('simplePhotosBox'); 
  if (p && box) box.innerHTML = window.renderSimplePhotos(p, type); 
};

window.showBeforeAfter = function(patientId) {
  const p = patients.find(x => x.id === patientId); 
  if (!p) return;
  
  const all = normalizePhotosFinal(p);
  const before = all.find(x => x.stage === 'before');
  const after = all.find(x => x.stage === 'after');
  
  document.getElementById('beforeAfterOverlay')?.remove();
  const overlay = document.createElement('div'); 
  overlay.id = 'beforeAfterOverlay'; 
  overlay.className = 'clean-modal-overlay';
  
  const body = (before && after) ? `
    <div class="ba-selected-strip">
      <div><img src="${safeText(before.url)}"><b>Before</b></div>
      <div><img src="${safeText(after.url)}"><b>After</b></div>
    </div>
    <div class="ba-blend-wrap final-ba-wrap" style="--blend:50%">
      <img class="ba-img ba-before" src="${safeText(before.url)}" alt="Before">
      <img class="ba-img ba-after" src="${safeText(after.url)}" alt="After">
      <div class="ba-soft-bar"></div>
    </div>
    <input class="ba-range" type="range" min="0" max="100" value="50" oninput="document.querySelector('.ba-blend-wrap').style.setProperty('--blend', \`\${this.value}%\`)">
    <p class="muted">Slide to blend transition</p>
  ` : `<div class="clean-empty-photo">Mark one photo as Before and one as After from the 3-dot menu.</div>`;
  
  overlay.innerHTML = `
    <div class="clean-modal ba-modal" role="dialog" aria-modal="true">
      <div class="clean-modal-head">
        <div><h2>Before / After</h2></div>
        <button type="button" onclick="document.getElementById('beforeAfterOverlay')?.remove()">×</button>
      </div>
      ${body}
    </div>`;
    
  overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
};

// --- Patient Views ---
function parseClinicData(raw) {
  const base = { visits: [], appointments: [], payments: [], teeth: {}, extra_phones: [], websites: [], treatmentItems: [], prescriptions: [], consents: [], labWorks: [], reminders: [], tasks: [] };
  if (!raw) return base;
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return { ...base, visits: data };
    return { ...base, ...data, visits: data.visits || [], appointments: data.appointments || [], payments: data.payments || [], teeth: data.teeth || {} };
  } catch {
    return { ...base, visits: [{ date: "Old note", note: raw }] };
  }
}

function paymentTotals(data) {
  const total = data.payments.reduce((s, x) => s + Number(x.total || 0), 0);
  const discount = data.payments.reduce((s, x) => s + (Number(x.total || 0) * Number(x.discount || 0) / 100), 0);
  const net = Math.max(0, total - discount);
  const paid = data.payments.reduce((s, x) => s + Number(x.paid || 0), 0);
  return { total, discount, net, paid, remaining: net - paid };
}

window.patientDetailsHTML = function(p) {
  const data = parseClinicData(p.progress_notes);
  const money = paymentTotals(data);
  const statusText = money.remaining > 0 ? "Unpaid" : "Active";
  const statusCls = money.remaining > 0 ? "pill danger" : "pill success";
  
  // Premium Summary logic extracted from patch
  const next = (data.appointments||[]).filter(a=>a.date && new Date(a.date)>=new Date(Date.now()-86400000)).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
  const lastVisit = (data.visits||[])[0];
  
  const premiumSummary = `
    <div class="premium-section">
      <h3>Patient Command Center</h3>
      <div class="premium-summary-grid">
        <div class="premium-summary-card"><small>Last visit</small><strong>${safeText(lastVisit?.date||'No visits')}</strong></div>
        <div class="premium-summary-card"><small>Next appointment</small><strong>${safeText(next?.date||'Not scheduled')}</strong></div>
        <div class="premium-summary-card"><small>Remaining</small><strong>${money.remaining} EGP</strong></div>
        <div class="premium-summary-card"><small>Medical alerts</small><strong>${safeText((p.medical_alerts||'None'))}</strong></div>
      </div>
    </div>
  `;

  return `
    <div class="card">
      <div class="profile-hero">
        <div>
          <h2>${safeText(p.name || "No name")}</h2>
          <div class="tag-wrap"><span class="${statusCls}">${statusText}</span></div>
        </div>
      </div>

      <div class="tag-wrap">
        <span class="pill">ID: ${safeText(p.case_id || "-")}</span>
        <span class="pill">${safeText(p.phone || "No phone")}</span>
        <span class="pill">${safeText(p.age || "-")} yrs</span>
      </div>

      <div class="kv"><b>Chief Complaint</b><span>${safeText(p.chief_complaint || "-")}</span></div>
      <div class="kv"><b>Diagnosis</b><span>${safeText(p.diagnosis || "-")}</span></div>
      <div class="kv"><b>Treatment Plan</b><span>${safeText(p.treatment_plan || "-")}</span></div>

      ${premiumSummary}

      <div class="actions-bar" style="margin-top:16px;">
        <button class="btn-secondary" onclick="addPayment('${p.id}')">+ Payment</button>
        <button class="btn-secondary" onclick="addAppointment('${p.id}')">+ Appointment</button>
      </div>

      <h3 style="color:var(--accent);margin-top:24px;">Photos / X-rays</h3>
      <div id="simplePhotosBox">${window.renderSimplePhotos(p, "clinical")}</div>

      <h3 style="color:var(--accent);margin-top:24px;">Visits History</h3>
      ${data.visits.length ? data.visits.map((v, i) => `
        <div class="kv">
          <b>Visit ${data.visits.length - i}</b>
          <div style="color:var(--text-secondary);font-size:12px;margin-bottom:4px;">${safeText(v.date || "")}</div>
          <span>${safeText(v.note || "-")}</span>
        </div>
      `).join("") : `<div class="kv"><span class="muted">No visits yet</span></div>`}

      <div class="actions-bar" style="margin-top:20px;">
        <button class="btn-primary" onclick="editPatient('${p.id}')">Edit Patient</button>
        <button class="btn-secondary" onclick="exportPDF('${p.id}')">Export PDF</button>
      </div>
    </div>
  `;
};

// --- Initialization ---
window.addEventListener("load", async () => {
  try {
    currentUser = getSavedUser();
    
    // Bind the clean menu correctly
    const btn = document.getElementById('menuBtn');
    if (btn) {
      btn.onclick = null;
      btn.addEventListener('click', e => { e.preventDefault(); openClinicMenu(); });
    }
    
    if (window.applyLanguage) window.applyLanguage();
    
  } catch (err) {
    document.body.innerHTML = `<div style="padding:40px;color:#ef4444;"><h2>Error</h2><p>${safeText(err.message)}</p></div>`;
  }
});
