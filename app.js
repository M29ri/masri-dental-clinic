// app.js - Complete & Unified Version
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

window.safeText = function(value = "") {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

// --- API & Auth ---
async function api(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : await res.json();
}

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

async function login(username, password) {
  try {
    const users = await api(`clinic_users?username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}&select=*`);
    if (!users.length) return alert("Wrong username or password");
    saveUser(users[0]);
    location.href = location.pathname;
  } catch (err) { alert("Login failed: " + err.message); }
}

async function registerDoctor() {
  const full_name = await luxuryPrompt("Your full name", "Doctor name"); if (!full_name) return;
  const username = await luxuryPrompt("Choose username", "Any username you want"); if (!username) return;
  const password = await luxuryPrompt("Choose password", "Password"); if (!password) return;
  try {
    const existing = await api(`clinic_users?select=id&username=eq.${encodeURIComponent(username.trim())}`);
    if (existing.length) return alert("Username exists.");
    await api("clinic_users", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ username: username.trim(), password: password.trim(), full_name: full_name.trim(), role: "doctor", clinic_name: `${full_name.trim()}'s Clinic` })
    });
    alert("Account created. Please login.");
  } catch (err) { alert("Creation failed: " + err.message); }
}

function showLoginScreen() {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#070b10,#111827);padding:24px;color:white;font-family:'DM Sans',sans-serif;">
      <div style="width:100%;max-width:420px;background:#0f1520;border:1px solid #253044;border-radius:28px;padding:32px;box-shadow:0 20px 50px rgba(0,0,0,.45);">
        <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#e8c84a,#b8941f);display:grid;place-items:center;color:#0a0a0a;font-weight:800;font-size:24px;margin-bottom:18px;">M</div>
        <h1 style="font-size:28px;margin-bottom:6px;font-weight:700;">Masri Dental Clinic</h1>
        <p style="color:#8b9db8;margin-bottom:28px;font-weight:500;">Secure login</p>
        <label style="display:block;margin-bottom:16px;color:#8b9db8;font-size:12px;font-weight:600;text-transform:uppercase;">Username
          <input id="loginUsername" style="width:100%;margin-top:8px;padding:16px;border-radius:16px;border:1px solid #253044;background:#0a0f18;color:white;font-size:16px;outline:none;">
        </label>
        <label style="display:block;margin-bottom:24px;color:#8b9db8;font-size:12px;font-weight:600;text-transform:uppercase;">Password
          <input id="loginPassword" type="password" style="width:100%;margin-top:8px;padding:16px;border-radius:16px;border:1px solid #253044;background:#0a0f18;color:white;font-size:16px;outline:none;">
        </label>
        <button id="loginBtn" style="width:100%;padding:16px;border:none;border-radius:16px;background:linear-gradient(135deg,#e8c84a,#b8941f);color:#0a0a0a;font-weight:700;font-size:16px;cursor:pointer;">Login</button>
        <button id="registerBtn" style="width:100%;margin-top:12px;padding:16px;border:none;border-radius:16px;background:#161f2e;color:white;font-weight:600;font-size:16px;cursor:pointer;border:1px solid #253044;">Create doctor account</button>
      </div>
    </div>`;
  $("loginBtn").onclick = () => login($("loginUsername").value.trim(), $("loginPassword").value.trim());
  $("registerBtn").onclick = registerDoctor;
}

// --- Menu & Navigation ---
window.openClinicMenu = function() {
  $("drawerOverlay")?.remove(); $("sideDrawer")?.remove();
  const overlay = document.createElement("div"); overlay.className = "drawer-overlay clean-menu-overlay"; overlay.id = "drawerOverlay"; overlay.onclick = closeClinicMenu;
  const drawer = document.createElement("aside"); drawer.className = "side-drawer clean-side-drawer"; drawer.id = "sideDrawer";
  const isAdmin = currentUser?.role === "admin";
  drawer.innerHTML = `
    <div class="drawer-head"><h2>${safeText(window.t('menu'))}</h2><button class="drawer-close-btn" onclick="closeClinicMenu()">×</button></div>
    <div class="drawer-user"><div>${safeText(currentUser?.full_name || currentUser?.username)}</div><small>${safeText((currentUser?.role || 'doctor').toUpperCase())}</small></div>
    <div class="drawer-menu clean-drawer-menu">
      <button class="primary-item" onclick="closeClinicMenu();showPage('form')">${safeText(window.t('addPatient'))}</button>
      <button onclick="closeClinicMenu();showPage('scan')">${safeText(window.t('scanQR'))}</button>
      <button onclick="closeClinicMenu();openPremiumCalendar()">Calendar</button>
      <button onclick="closeClinicMenu();openFinancialReports()">Reports</button>
      <button onclick="closeClinicMenu();showPage('settings')">${safeText(window.t('settings'))}</button>
      <button onclick="closeClinicMenu();openDoctorProfile()">${safeText(window.t('profile'))}</button>
      ${isAdmin ? `<button onclick="closeClinicMenu();manageUsers()">${safeText(window.t('manageUsers'))}</button>` : ''}
      <button class="danger-item" onclick="logout()">${safeText(window.t('logout'))}</button>
    </div>`;
  document.body.append(overlay, drawer);
};
window.closeClinicMenu = function() { $("drawerOverlay")?.remove(); $("sideDrawer")?.remove(); };

window.showPage = function(page) {
  if (page === 'settings') {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    let s = $("settings"); if (!s) { s = document.createElement('section'); s.id = 'settings'; s.className = 'page'; document.querySelector('main.app')?.appendChild(s); }
    s.classList.add('active');
    s.innerHTML = `
      <div class="card settings-page"><h2>${safeText(window.t('settings'))}</h2><p class="muted">Clinic tools and preferences.</p>
        <div class="settings-grid-clean">
          <button class="settings-tile" onclick="openThemePicker()"><b>Theme</b><span>Custom color</span></button>
          <button class="settings-tile" onclick="openLanguagePicker()"><b>Language</b><span>App Language</span></button>
          <button class="settings-tile" onclick="openPdfPatternPicker()"><b>PDF Style</b><span>Reports & receipts</span></button>
          <button class="settings-tile" onclick="openDoctorInfoCard()"><b>Doctor Card</b><span>Specialty & info</span></button>
          <button class="settings-tile" onclick="openSignaturePad()"><b>Signature</b><span>PDFs & receipts</span></button>
          <button class="settings-tile" onclick="backupData()"><b>Backup</b><span>Export data</span></button>
          <button class="settings-tile" onclick="restoreBackup()"><b>Restore</b><span>Import backup</span></button>
        </div>
      </div>
      <div class="card" id="premiumSettingsTools"><h2>Clinic Management</h2>
        <div class="premium-tools-grid">
          <button class="premium-tool-btn" onclick="openPremiumCalendar()">Calendar<small>Appointments</small></button>
          <button class="premium-tool-btn" onclick="openFinancialReports()">Financial reports<small>Revenue tracking</small></button>
          <button class="premium-tool-btn" onclick="openReminderCenter()">Reminders<small>WhatsApp templates</small></button>
          <button class="premium-tool-btn" onclick="openRolePermissions()">Roles<small>Staff permissions</small></button>
        </div>
      </div>`;
    window.scrollTo(0,0); if(window.applyLanguage) window.applyLanguage(); return;
  }
  document.querySelectorAll(".page, .tab").forEach(e => e.classList.remove("active"));
  $(page)?.classList.add("active"); document.querySelector(`[data-page="${page}"]`)?.classList.add("active");
  window.scrollTo(0, 0); if(window.applyLanguage) window.applyLanguage();
};

// --- Utilities & Prompts ---
function doctorExtras() { try { return JSON.parse(localStorage.getItem("clinicDoctorExtras-" + (currentUser?.id || "guest")) || "{}"); } catch { return {}; } }
function saveDoctorExtras(ex) { localStorage.setItem("clinicDoctorExtras-" + (currentUser?.id || "guest"), JSON.stringify(ex || {})); }
function splitList(v) { return String(v || "").split(/[\n,]+/).map(x => x.trim()).filter(Boolean); }
function pdfPatternStyle(pattern = "classic") { return `background:#f4f6f8;`; }
function signatureImgHTML() { const sig = doctorExtras().signature || ""; return sig ? `<img class="signature-img" src="${sig}">` : `<div class="signature-line"></div>`; }
function canEdit() { return ["admin", "doctor"].includes(currentUser?.role); }
function canDelete() { return ["admin", "doctor"].includes(currentUser?.role); }
function makeId() { return "P-" + Date.now(); }

function luxuryPrompt(title, placeholder = "", initialValue = "") {
  return new Promise((resolve) => {
    const modal = document.createElement("div"); modal.className = "luxury-modal";
    modal.innerHTML = `<div class="luxury-box"><h2>${safeText(title)}</h2><input id="luxuryInput" placeholder="${safeText(placeholder)}" value="${safeText(initialValue)}"><div class="luxury-actions"><button type="button" class="btn-secondary">Cancel</button><button type="button" class="btn-primary">OK</button></div></div>`;
    document.body.appendChild(modal);
    const input = modal.querySelector("#luxuryInput"); setTimeout(() => input.focus(), 50);
    modal.querySelector(".btn-secondary").onclick = () => { modal.remove(); resolve(null); };
    modal.querySelector(".btn-primary").onclick = () => { modal.remove(); resolve(input.value.trim()); };
    input.addEventListener("keydown", e => { if (e.key === "Enter") modal.querySelector(".btn-primary").click(); });
  });
}
function luxuryConfirm(title, message = "") {
  return new Promise((resolve) => {
    const modal = document.createElement("div"); modal.className = "luxury-modal";
    modal.innerHTML = `<div class="luxury-box"><h2>${safeText(title)}</h2>${message ? `<p>${safeText(message)}</p>` : ""}<div class="luxury-actions"><button type="button" class="btn-secondary">Cancel</button><button type="button" class="btn-primary">OK</button></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector(".btn-secondary").onclick = () => { modal.remove(); resolve(false); };
    modal.querySelector(".btn-primary").onclick = () => { modal.remove(); resolve(true); };
  });
}
function modal(title, body) {
  $("premiumFeatureModal")?.remove();
  const div = document.createElement('div'); div.id = 'premiumFeatureModal'; div.className = 'luxury-modal';
  div.innerHTML = `<div class="luxury-box premium-modal-big"><div style="display:flex;justify-content:space-between;align-items:start"><h2>${safeText(title)}</h2><button class="drawer-close-btn" onclick="document.getElementById('premiumFeatureModal')?.remove()">×</button></div>${body}</div>`;
  div.addEventListener('click', e => { if(e.target === div) div.remove(); }); document.body.appendChild(div); return div;
}

// --- Data Loading & Parsing ---
function parseClinicData(raw) {
  const base = { visits: [], appointments: [], payments: [], teeth: {}, extra_phones: [], websites: [], treatmentItems: [], prescriptions: [], consents: [], labWorks: [], reminders: [], tasks: [] };
  if (!raw) return base;
  try { const data = JSON.parse(raw); return Array.isArray(data) ? { ...base, visits: data } : { ...base, ...data }; } catch { return { ...base, visits: [{ date: "Old note", note: raw }] }; }
}
function saveClinicData(data) { return JSON.stringify(data); }
function paymentTotals(data) {
  const total = data.payments.reduce((s, x) => s + Number(x.total || 0), 0);
  const discount = data.payments.reduce((s, x) => s + (Number(x.total || 0) * Number(x.discount || 0) / 100), 0);
  const net = Math.max(0, total - discount);
  const paid = data.payments.reduce((s, x) => s + Number(x.paid || 0), 0);
  return { total, discount, net, paid, remaining: net - paid };
}

async function loadPatients() {
  try {
    if ($("status")) $("status").innerHTML = '<span class="status-dot pulse"></span> Loading cloud...';
    patients = currentUser.role === "admin" ? await api("patients?select=*&order=created_at.desc") : await api(`patients?owner_id=eq.${currentUser.id}&select=*&order=created_at.desc`);
    renderPatients(); renderDashboard();
    localStorage.setItem("clinicOfflinePatients-" + currentUser.id, JSON.stringify(patients));
    if ($("status")) $("status").innerHTML = '<span class="status-dot"></span> Cloud connected';
  } catch (err) {
    const raw = localStorage.getItem("clinicOfflinePatients-" + currentUser?.id);
    if (raw) { patients = JSON.parse(raw); renderPatients(); renderDashboard(); if ($("status")) $("status").textContent = "Offline mode"; }
  }
}

// --- Dashboard & Premium Tools ---
function renderDashboard() {
  const dash = $("dashboardContent"); if (!dash) return;
  let unpaid = 0, totalRevenue = 0, paidToday = 0, todayAppointments = [];
  const now = new Date();
  patients.forEach(p => {
    const data = parseClinicData(p.progress_notes); const money = paymentTotals(data);
    unpaid += money.remaining; totalRevenue += money.paid;
    (data.payments || []).forEach(pay => { if (new Date(pay.date).toDateString() === now.toDateString()) paidToday += Number(pay.paid || 0); });
    (data.appointments || []).forEach(a => {
      const appDate = new Date(a.date); if (!isNaN(appDate) && appDate.toDateString() === now.toDateString()) todayAppointments.push(a);
    });
  });

  dash.innerHTML = `
    <div class="hero-grid">
      <div class="stat-card"><span class="stat-label">Total Patients</span><strong class="stat-value">${patients.length}</strong></div>
      <div class="stat-card"><span class="stat-label">Today's Appts</span><strong class="stat-value">${todayAppointments.length}</strong></div>
      <div class="stat-card"><span class="stat-label">Unpaid Balance</span><strong class="stat-value unpaid">${unpaid}</strong></div>
      <div class="stat-card"><span class="stat-label">Total Revenue</span><strong class="stat-value gold">${totalRevenue}</strong></div>
      <div class="stat-card"><span class="stat-label">Paid Today</span><strong class="stat-value gold">${paidToday}</strong></div>
    </div>
    <div class="quick-actions">
      <button class="btn-primary" onclick="fillForm();showPage('form')">+ New Patient</button>
      <button class="btn-secondary" onclick="showPage('scan')">Scan QR</button>
      <button class="btn-secondary" onclick="openPremiumCalendar()">Calendar</button>
      <button class="btn-secondary" onclick="openFinancialReports()">Reports</button>
    </div>`;
}

window.openPremiumCalendar = function() { modal("Calendar", "<p class='muted'>Your premium calendar view will appear here.</p>"); };
window.openFinancialReports = function() { modal("Financial Reports", "<p class='muted'>Your premium financial reports will appear here.</p>"); };
window.openReminderCenter = function() { modal("Reminders", "<p class='muted'>Your WhatsApp reminder center will appear here.</p>"); };
window.openRolePermissions = function() { modal("Roles", "<p class='muted'>Staff permissions will appear here.</p>"); };

// --- Patients List ---
function renderPatients() {
  const q = ($("search")?.value || "").toLowerCase();
  const list = $("list"); if (!list) return;
  const filtered = patients.filter(p => (p.name || "").toLowerCase().includes(q) || (p.phone || "").includes(q));

  if (!filtered.length) { list.innerHTML = `<div class="card" style="text-align:center;"><h3>No patients found</h3></div>`; return; }
  
  list.innerHTML = filtered.map(p => {
    const data = parseClinicData(p.progress_notes); const money = paymentTotals(data);
    const statusText = money.remaining > 0 ? "Unpaid" : "Active";
    return `
      <div class="patient-card">
        <div class="patient-card-header">
          <div><h3>${safeText(p.name)}</h3><div class="patient-meta"><span class="pill">ID: ${safeText(p.case_id || p.id)}</span><span class="pill">${safeText(p.phone)}</span></div></div>
          <span class="pill ${money.remaining > 0 ? 'danger' : 'success'}">${statusText}</span>
        </div>
        <div class="actions-bar">
          <button class="btn-primary" onclick="openPatient('${p.id}')">Open</button>
          <button class="btn-secondary" onclick="showQR('${p.id}')">QR</button>
        </div>
      </div>`;
  }).join("");
}

// --- Patient Profile & Clean Photos ---
function normalizePhotosFinal(patient) {
  return (patient?.photos || []).map((raw, index) => {
    const obj = typeof raw === 'object' ? raw : {url: raw, path: raw};
    let cat = String(obj.category || obj.photoCategory || '').toLowerCase();
    let stage = String(obj.stage || obj.type || '').toLowerCase();
    if (cat.includes('x') || String(obj.name).toLowerCase().includes('xray')) cat = 'xray'; else cat = 'clinical';
    if (!['before', 'after', 'general'].includes(stage)) stage = 'general';
    return { raw, obj, index, url: obj.url || obj.path, category: cat, stage, name: obj.name || `Photo ${index+1}` };
  }).filter(x => x.url);
}

window.renderSimplePhotos = function(patient, type = 'clinical') {
  window.__photoFilter = type; const all = normalizePhotosFinal(patient);
  const filtered = type === 'xray' ? all.filter(p=>p.category==='xray') : type === 'beforeAfter' ? all.filter(p=>p.stage==='before'||p.stage==='after') : all.filter(p=>p.category==='clinical');
  return `
    <div class="clean-photo-section">
      <div class="clean-photo-tabs">
        <button type="button" class="${type==='clinical'?'active':''}" onclick="switchSimplePhotoType('${patient.id}','clinical')">Clinical <small>${all.filter(p=>p.category==='clinical').length}</small></button>
        <button type="button" class="${type==='xray'?'active':''}" onclick="switchSimplePhotoType('${patient.id}','xray')">X-Ray <small>${all.filter(p=>p.category==='xray').length}</small></button>
        <button type="button" class="${type==='beforeAfter'?'active':''}" onclick="showBeforeAfter('${patient.id}')">Before/After</button>
      </div>
      ${filtered.length ? `<div class="clean-photo-grid">${filtered.map(ph => `
        <div class="clean-photo-card" data-index="${ph.index}">
          <button class="photo-dots" type="button" onclick="openPhotoOptions('${patient.id}', ${ph.index})">•••</button>
          <img src="${safeText(ph.url)}" onclick="openCleanPhotoViewer('${patient.id}', ${ph.index})">
          <div class="clean-photo-meta"><span>${safeText(ph.category)}</span><span>•</span><span>${safeText(ph.stage)}</span></div>
        </div>`).join('')}</div>` : `<div class="clean-empty-photo">No photos found</div>`}
    </div>`;
};
window.switchSimplePhotoType = function(patientId, type) { const p = patients.find(x => x.id === patientId); if (p && $("simplePhotosBox")) $("simplePhotosBox").innerHTML = window.renderSimplePhotos(p, type); };

window.openCleanPhotoViewer = function(patientId, index) {
  const p = patients.find(x => x.id === patientId); if (!p) return;
  const all = normalizePhotosFinal(p); currentPhotoList = all.map(x => x.url); currentPhotoIndex = all.findIndex(x => x.index === index) || 0;
  $("photoViewer")?.classList.remove("hidden"); $("viewerImage").src = currentPhotoList[currentPhotoIndex];
};
$("closeViewer")?.addEventListener("click", () => $("photoViewer")?.classList.add("hidden"));
$("nextPhoto")?.addEventListener("click", () => { currentPhotoIndex = (currentPhotoIndex + 1) % currentPhotoList.length; $("viewerImage").src = currentPhotoList[currentPhotoIndex]; });
$("prevPhoto")?.addEventListener("click", () => { currentPhotoIndex = (currentPhotoIndex - 1 + currentPhotoList.length) % currentPhotoList.length; $("viewerImage").src = currentPhotoList[currentPhotoIndex]; });

window.showBeforeAfter = function(patientId) {
  const p = patients.find(x => x.id === patientId); if (!p) return;
  const all = normalizePhotosFinal(p); const before = all.find(x => x.stage === 'before'); const after = all.find(x => x.stage === 'after');
  $("beforeAfterOverlay")?.remove(); const overlay = document.createElement('div'); overlay.id = 'beforeAfterOverlay'; overlay.className = 'clean-modal-overlay';
  overlay.innerHTML = `
    <div class="clean-modal ba-modal" role="dialog"><div class="clean-modal-head"><div><h2>Before / After</h2></div><button onclick="document.getElementById('beforeAfterOverlay')?.remove()">×</button></div>
    ${(before && after) ? `<div class="ba-blend-wrap final-ba-wrap" style="--blend:50%"><img class="ba-img ba-before" src="${safeText(before.url)}"><img class="ba-img ba-after" src="${safeText(after.url)}"><div class="ba-soft-bar"></div></div><input class="ba-range" type="range" min="0" max="100" value="50" oninput="document.querySelector('.ba-blend-wrap').style.setProperty('--blend', \`\${this.value}%\`)">` : `<div class="clean-empty-photo">Mark one photo as Before and one as After from the 3-dot menu.</div>`}
    </div>`;
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); }; document.body.appendChild(overlay);
};

window.openPhotoOptions = function(patientId, index) {
  const p = patients.find(x => x.id === patientId); if(!p) return; const ph = normalizePhotosFinal(p).find(x => x.index === index); if(!ph) return;
  $("photoOptionsOverlay")?.remove(); const overlay = document.createElement('div'); overlay.id='photoOptionsOverlay'; overlay.className='clean-sheet-overlay';
  overlay.innerHTML = `<div class="clean-photo-sheet"><div class="sheet-head"><img src="${safeText(ph.url)}"><div><h3>Photo Options</h3></div><button onclick="document.getElementById('photoOptionsOverlay')?.remove()">×</button></div>
    <div class="sheet-actions">
      <button onclick="savePhotoMetaClean('${patientId}',${index},{category:'clinical'});document.getElementById('photoOptionsOverlay')?.remove()">Clinical</button>
      <button onclick="savePhotoMetaClean('${patientId}',${index},{category:'xray'});document.getElementById('photoOptionsOverlay')?.remove()">X-Ray</button>
      <button onclick="savePhotoMetaClean('${patientId}',${index},{stage:'before'});document.getElementById('photoOptionsOverlay')?.remove()">Before</button>
      <button onclick="savePhotoMetaClean('${patientId}',${index},{stage:'after'});document.getElementById('photoOptionsOverlay')?.remove()">After</button>
    </div></div>`;
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); }; document.body.appendChild(overlay);
};

window.savePhotoMetaClean = async function(patientId, index, patch) {
  const p = patients.find(x => x.id === patientId); if(!p) return;
  const next = (p.photos || []).map((raw, i) => {
    const obj = typeof raw === 'object' ? { ...raw } : { url: raw, path: raw };
    if ((patch.stage === 'before' || patch.stage === 'after') && i !== index && (obj.stage || obj.type) === patch.stage) { obj.stage = 'general'; obj.type = 'general'; }
    return obj;
  });
  Object.assign(next[index] || {}, patch); if(patch.stage) next[index].type = patch.stage; p.photos = next;
  try { await api(`patients?id=eq.${patientId}`, { method: 'PATCH', body: JSON.stringify({ photos: next }) }); } catch(err) {}
  if ($("simplePhotosBox")) $("simplePhotosBox").innerHTML = window.renderSimplePhotos(p, window.__photoFilter || 'clinical');
};

window.patientDetailsHTML = function(p) {
  const data = parseClinicData(p.progress_notes); const money = paymentTotals(data);
  return `
    <div class="card">
      <div class="profile-hero"><div><h2>${safeText(p.name)}</h2><div class="tag-wrap"><span class="pill ${money.remaining > 0 ? 'danger' : 'success'}">${money.remaining > 0 ? "Unpaid" : "Active"}</span></div></div></div>
      <div class="tag-wrap"><span class="pill">ID: ${safeText(p.case_id || p.id)}</span><span class="pill">${safeText(p.phone)}</span></div>
      <div class="kv"><b>Chief Complaint</b><span>${safeText(p.chief_complaint || "-")}</span></div>
      <div class="kv"><b>Diagnosis</b><span>${safeText(p.diagnosis || "-")}</span></div>
      <div class="kv"><b>Treatment Plan</b><span>${safeText(p.treatment_plan || "-")}</span></div>
      <div class="premium-section"><h3>Command Center</h3>
        <div class="premium-summary-grid">
          <div class="premium-summary-card"><small>Remaining</small><strong>${money.remaining} EGP</strong></div>
          <div class="premium-summary-card"><small>Medical alerts</small><strong>${safeText(p.medical_alerts || 'None')}</strong></div>
        </div>
      </div>
      <div class="actions-bar" style="margin-top:16px;">
        <button class="btn-secondary" onclick="addPayment('${p.id}')">+ Payment</button>
        <button class="btn-secondary" onclick="addAppointment('${p.id}')">+ Appointment</button>
      </div>
      <h3 style="color:var(--accent);margin-top:24px;">Photos / X-rays</h3>
      <div id="simplePhotosBox">${window.renderSimplePhotos(p, "clinical")}</div>
      <h3 style="color:var(--accent);margin-top:24px;">Visits History</h3>
      ${data.visits.length ? data.visits.map((v, i) => `<div class="kv"><b>Visit ${data.visits.length - i}</b><div class="muted" style="font-size:12px;">${safeText(v.date)}</div><span>${safeText(v.note || "-")}</span></div>`).join("") : `<div class="kv"><span class="muted">No visits yet</span></div>`}
      <div class="actions-bar" style="margin-top:20px;">
        <button class="btn-primary" onclick="editPatient('${p.id}')">Edit Patient</button>
        <button class="btn-danger" onclick="deletePatient('${p.id}')">Delete</button>
      </div>
    </div>`;
};

window.openPatient = function(id) {
  const p = patients.find(x => x.id === id); if (!p) return;
  $("details").innerHTML = patientDetailsHTML(p); showPage("detail");
};

// --- Actions & Forms ---
window.fillForm = function(p = null) {
  $("rowId").value = p?.id || ""; $("caseId").value = p?.case_id || ""; $("name").value = p?.name || ""; $("phone").value = p?.phone || "";
  $("age").value = p?.age || ""; $("gender").value = p?.gender || ""; $("chiefComplaint").value = p?.chief_complaint || "";
  $("medicalAlerts").value = p?.medical_alerts || ""; $("diagnosis").value = p?.diagnosis || ""; $("treatmentPlan").value = p?.treatment_plan || "";
  $("progressNotes").value = ""; $("formTitle").textContent = p ? "Edit Patient" : "Add Patient"; pendingFiles = [];
};

window.editPatient = function(id) { const p = patients.find(x => x.id === id); if(p) { fillForm(p); showPage("form"); } };
window.deletePatient = async function(id) {
  if (!canDelete()) return alert("Not authorized");
  if (!(await luxuryConfirm("Delete this patient?"))) return;
  await api(`patients?id=eq.${id}`, { method: "DELETE" }); await loadPatients(); showPage("patients");
};

window.addPayment = async function(id) {
  const p = patients.find(x => x.id === id); if (!p) return;
  const total = await luxuryPrompt("Total treatment cost"); if (!total) return;
  const paid = await luxuryPrompt("Paid amount", "", "0"); if (!paid) return;
  const data = parseClinicData(p.progress_notes);
  data.payments.unshift({ date: new Date().toLocaleString(), total: Number(total), paid: Number(paid), discount: 0 });
  await api(`patients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await loadPatients(); openPatient(id);
};

window.addAppointment = async function(id) {
  const p = patients.find(x => x.id === id); if (!p) return;
  const date = await luxuryPrompt("Appointment date/time", "e.g. 2026-06-15 2:00 PM"); if (!date) return;
  const data = parseClinicData(p.progress_notes); data.appointments.unshift({ date, note: "Scheduled" });
  await api(`patients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await loadPatients(); openPatient(id);
};

async function uploadToBucket(bucket, path, blob, type) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": type }, body: blob });
  if (!res.ok) throw new Error(await res.text()); return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

$("patientForm")?.addEventListener("submit", async e => {
  e.preventDefault(); $("saveBtn").disabled = true; $("saveBtn").textContent = "Saving...";
  try {
    const id = $("rowId").value; const old = id ? patients.find(p => p.id === id) : null;
    const oldData = parseClinicData(old?.progress_notes); const newNote = $("progressNotes").value.trim();
    if (newNote) oldData.visits.unshift({ date: new Date().toLocaleString(), note: newNote });
    const payload = {
      owner_id: old?.owner_id || currentUser.id, case_id: $("caseId").value || makeId(), name: $("name").value, phone: $("phone").value, age: $("age").value, gender: $("gender").value,
      chief_complaint: $("chiefComplaint").value, medical_alerts: $("medicalAlerts").value, diagnosis: $("diagnosis").value, treatment_plan: $("treatmentPlan").value,
      progress_notes: saveClinicData(oldData), photos: old?.photos || []
    };
    const saved = (await api(id ? `patients?id=eq.${id}` : "patients", { method: id ? "PATCH" : "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) }))[0];
    if (pendingFiles.length) {
      $("saveBtn").textContent = "Uploading photos..."; const uploaded = [];
      for (const file of pendingFiles) {
        const path = `${saved.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        uploaded.push({ url: await uploadToBucket(PHOTO_BUCKET, path, file, file.type), name: file.name, category: "clinical", stage: "general" });
      }
      await api(`patients?id=eq.${saved.id}`, { method: "PATCH", body: JSON.stringify({ photos: [...(saved.photos || []), ...uploaded] }) });
    }
    $("patientForm").reset(); await loadPatients(); showPage("patients");
  } catch (err) { alert("Save failed: " + err.message); } finally { $("saveBtn").disabled = false; $("saveBtn").textContent = "Save Patient"; }
});

$("photos")?.addEventListener("change", e => { pendingFiles = [...e.target.files]; });
$("backBtn")?.addEventListener("click", () => showPage("patients"));

window.addEventListener("load", async () => {
  try {
    if (location.search.includes("logout=1")) { localStorage.removeItem("clinicUser"); showLoginScreen(); return; }
    currentUser = getSavedUser();
    if (!currentUser) { showLoginScreen(); return; }
    
    // Bind menu & Header
    $("menuBtn").addEventListener('click', e => { e.preventDefault(); openClinicMenu(); });
    if ($("doctorName")) $("doctorName").textContent = currentUser.full_name || currentUser.username;
    
    await loadPatients();
    if (window.applyLanguage) window.applyLanguage();
  } catch (err) { document.body.innerHTML = `<div style="padding:40px;color:#ef4444;"><h2>Error</h2><p>${safeText(err.message)}</p></div>`; }
});
