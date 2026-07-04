// The browser no longer talks to Supabase directly or holds any Supabase key.
// Every request goes through our own Netlify function, which holds the secret
// service key server-side and checks who's logged in before touching data.
const API_BASE = "/.netlify/functions/api";
const PHOTO_BUCKET = "patient-photos";
const LOGO_BUCKET = "clinic-logos";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let authToken = null;
let patients = [];
let pendingFiles = [];
let scanner = null;
let currentPhotoList = [];
let currentPhotoIndex = 0;
let selectedToothPatientId = null;
let selectedToothNumber = null;

function safeText(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// --- Doctor extras, language, patterns, custom theme ---
const I18N = {
  en: { dashboard:"Dashboard", patients:"Patients", addPatient:"Add Patient", scanQR:"Scan QR", totalPatients:"Total Patients", todaysAppts:"Today's Appts", unpaidBalance:"Unpaid Balance", totalVisits:"Total Visits", totalRevenue:"Total Revenue", paidToday:"Paid Today", clinicOverview:"Clinic Overview", appointmentCalendar:"Appointment Calendar", today:"Today", upcoming:"Upcoming", search:"Search name, phone, ID, diagnosis..." },
  ar: { dashboard:"لوحة التحكم", patients:"المرضى", addPatient:"إضافة مريض", scanQR:"مسح QR", totalPatients:"إجمالي المرضى", todaysAppts:"مواعيد اليوم", unpaidBalance:"المتبقي غير المدفوع", totalVisits:"إجمالي الزيارات", totalRevenue:"إجمالي الإيراد", paidToday:"مدفوع اليوم", clinicOverview:"نظرة عامة", appointmentCalendar:"تقويم المواعيد", today:"اليوم", upcoming:"القادم", search:"ابحث بالاسم أو الهاتف أو الكود أو التشخيص..." }
};
function getLang(){ return localStorage.getItem("clinicLanguage") || "en"; }
function t(key){ return (I18N[getLang()] && I18N[getLang()][key]) || I18N.en[key] || key; }
function doctorExtras(){
  try { return JSON.parse(localStorage.getItem("clinicDoctorExtras-" + (currentUser?.id || "guest")) || "{}"); }
  catch { return {}; }
}
function saveDoctorExtras(extras){ localStorage.setItem("clinicDoctorExtras-" + (currentUser?.id || "guest"), JSON.stringify(extras || {})); }
function splitList(v){ return String(v || "").split(/[\n,]+/).map(x => x.trim()).filter(Boolean); }
function pdfPatternStyle(pattern = "classic") {
  const accent = doctorExtras().accent || "#d4af37";
  const safeAccent = String(accent).replace(/[^#a-zA-Z0-9(),.%\s-]/g, "");
  if (pattern === "waves") return `background: radial-gradient(circle at 10% 20%, ${safeAccent}22, transparent 22%), radial-gradient(circle at 90% 5%, ${safeAccent}18, transparent 24%), #f4f6f8;`;
  if (pattern === "grid") return `background-color:#f4f6f8;background-image:linear-gradient(${safeAccent}16 1px,transparent 1px),linear-gradient(90deg,${safeAccent}16 1px,transparent 1px);background-size:24px 24px;`;
  if (pattern === "dots") return `background-color:#f4f6f8;background-image:radial-gradient(${safeAccent}33 1.4px,transparent 1.4px);background-size:18px 18px;`;
  return `background:#f4f6f8;`;
}
function signatureImgHTML(){
  const sig = doctorExtras().signature || "";
  return sig ? `<img class="signature-img" src="${sig}" alt="Doctor signature">` : `<div class="signature-line"></div>`;
}
function setUILanguage(lang){
  localStorage.setItem("clinicLanguage", lang === "ar" ? "ar" : "en");
  applyLanguage();
  renderDashboard();
  renderPatients();
}
function applyLanguage(){
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  const map = [["dashboard","dashboard"],["patients","patients"],["form","addPatient"],["scan","scanQR"]];
  map.forEach(([page,key]) => { const el = document.querySelector(`[data-page="${page}"]`); if (el) el.textContent = t(key); });
  if ($("search")) $("search").placeholder = t("search");
}
function applyCustomAccent(){
  const extra = doctorExtras();
  if (extra.accent) document.documentElement.style.setProperty("--accent", extra.accent);
  if (extra.accentLight) document.documentElement.style.setProperty("--accent-light", extra.accentLight);
  if (extra.accentDark) document.documentElement.style.setProperty("--accent-dark", extra.accentDark);
}
function allPatientPhones(p, data = parseClinicData(p.progress_notes)){ return [p.phone, ...(data.extra_phones || [])].filter(Boolean); }
function allPatientWebsites(data){ return (data.websites || []).filter(Boolean); }


async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}?action=query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken || ""}` },
    body: JSON.stringify({ path, method: options.method || "GET", body: options.body })
  });
  if (res.status === 401) {
    logout();
    throw new Error("Session expired, please log in again.");
  }
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function getSavedUser() {
  try { return JSON.parse(localStorage.getItem("clinicUser")); }
  catch { return null; }
}

function saveUser(user, token) {
  localStorage.setItem("clinicUser", JSON.stringify(user));
  if (token) {
    localStorage.setItem("clinicToken", token);
    authToken = token;
  }
  currentUser = user;
}

function logout() {
  localStorage.removeItem("clinicUser");
  localStorage.removeItem("clinicToken");
  authToken = null;
  location.href = location.pathname + "?logout=1";
}

async function login(username, password) {
  try {
    const res = await fetch(`${API_BASE}?action=login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Wrong username or password");
    saveUser(data.user, data.token);
    location.href = location.pathname;
  } catch (err) {
    alert("Login failed: " + err.message);
  }
}

async function registerDoctor() {
  const full_name = await luxuryPrompt("Your full name", "Doctor name");
  if (!full_name) return;
  const username = await luxuryPrompt("Choose username", "Any username you want");
  if (!username) return;
  const password = await luxuryPrompt("Choose password", "Password");
  if (!password) return;
  const cleanUsername = username.trim();
  try {
    const res = await fetch(`${API_BASE}?action=signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUsername, password: password.trim(), full_name: full_name.trim() })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Account creation failed");
    alert("Account created successfully. Please login now.");
  } catch (err) {
    alert("Account creation failed: " + err.message);
  }
}

function showLoginScreen() {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#070b10,#111827);padding:24px;color:white;font-family:'DM Sans',-apple-system,sans-serif;">
      <div style="width:100%;max-width:420px;background:#0f1520;border:1px solid #253044;border-radius:28px;padding:32px;box-shadow:0 20px 50px rgba(0,0,0,.45);">
        <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#e8c84a,#b8941f);display:grid;place-items:center;color:#0a0a0a;font-weight:800;font-size:24px;margin-bottom:18px;">M</div>
        <h1 style="font-size:28px;margin-bottom:6px;font-weight:700;letter-spacing:-0.02em;">Masri Dental Clinic</h1>
        <p style="color:#8b9db8;margin-bottom:28px;font-weight:500;">Secure login</p>
        <label style="display:block;margin-bottom:16px;color:#8b9db8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Username
          <input id="loginUsername" style="width:100%;margin-top:8px;padding:16px;border-radius:16px;border:1px solid #253044;background:#0a0f18;color:white;font-size:16px;font-family:inherit;outline:none;">
        </label>
        <label style="display:block;margin-bottom:24px;color:#8b9db8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Password
          <input id="loginPassword" type="password" style="width:100%;margin-top:8px;padding:16px;border-radius:16px;border:1px solid #253044;background:#0a0f18;color:white;font-size:16px;font-family:inherit;outline:none;">
        </label>
        <button id="loginBtn" style="width:100%;padding:16px;border:none;border-radius:16px;background:linear-gradient(135deg,#e8c84a,#b8941f);color:#0a0a0a;font-weight:700;font-size:16px;font-family:inherit;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25);">Login</button>
        <button id="registerBtn" style="width:100%;margin-top:12px;padding:16px;border:none;border-radius:16px;background:#161f2e;color:white;font-weight:600;font-size:16px;font-family:inherit;cursor:pointer;border:1px solid #253044;">Create doctor account</button>
      </div>
    </div>`;
  $("loginBtn").onclick = () => login($("loginUsername").value.trim(), $("loginPassword").value.trim());
  $("registerBtn").onclick = registerDoctor;
}

function clinicLogoMarkup() {
  const logo = currentUser?.clinic_logo || "";
  return `<div class="clinic-logo">${logo ? `<img src="${logo}" alt="Clinic logo">` : "M"}</div>`;
}

// --- Menu & Drawer ---
window.openClinicMenu = function() {
  document.getElementById("drawerOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "drawer-overlay";
  overlay.id = "drawerOverlay";
  overlay.onclick = closeClinicMenu;

  const drawer = document.createElement("aside");
  drawer.className = "side-drawer";
  drawer.id = "sideDrawer";
  drawer.innerHTML = `
    <div class="drawer-head">
      <h2>Menu</h2>
      <button class="drawer-close-btn" onclick="closeClinicMenu()" aria-label="Close">&#10005;</button>
    </div>
    <div class="drawer-user">
      <div>${safeText(currentUser?.full_name || currentUser?.username || "Doctor")}</div>
      <small>${safeText((currentUser?.role || "doctor").toUpperCase())}</small>
    </div>
    <div class="drawer-menu">
      <button class="primary-item" onclick="closeClinicMenu();showPage('dashboard')">Dashboard</button>
      <button onclick="closeClinicMenu();showPage('patients')">Patients</button>
      <button onclick="closeClinicMenu();showPage('form')">Add Patient</button>
      <button onclick="closeClinicMenu();showPage('scan')">Scan QR</button>
      <button onclick="closeClinicMenu();showPage('settings')">Settings</button>
      <button onclick="closeClinicMenu();location.reload()">Refresh</button>
      <button onclick="closeClinicMenu();backupData()">Backup</button>
      <button onclick="closeClinicMenu();restoreBackup()">Restore</button>
      <button onclick="closeClinicMenu();openThemePicker()">Theme</button>
      <button onclick="closeClinicMenu();openLanguagePicker()">Language</button>
      <button onclick="closeClinicMenu();openPdfPatternPicker()">PDF Pattern</button>
      <button onclick="closeClinicMenu();openDoctorInfoCard()">Dental Info Card</button>
      <button onclick="closeClinicMenu();openDoctorProfile()">Profile</button>
      ${currentUser?.role === "admin" ? `<button onclick="closeClinicMenu();manageUsers()">Manage Users</button>` : ""}
      <button class="danger-item" onclick="logout()">Logout</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
};

window.closeClinicMenu = function() {
  document.getElementById("drawerOverlay")?.remove();
  document.getElementById("sideDrawer")?.remove();
};

// --- Theme System ---
window.openThemePicker = function() {
  const extras = doctorExtras();
  const modal = document.createElement("div");
  modal.className = "luxury-modal";
  modal.innerHTML = `
    <div class="luxury-box">
      <h2>Choose Theme</h2>
      <div class="theme-picker">
        <button style="background:#d4af37" onclick="setClinicTheme('gold')">Gold</button>
        <button style="background:#ff4fa3" onclick="setClinicTheme('pink')">Pink</button>
        <button style="background:#ef4444" onclick="setClinicTheme('red')">Red</button>
        <button style="background:#3b82f6" onclick="setClinicTheme('blue')">Blue</button>
        <button style="background:#06b6d4" onclick="setClinicTheme('cyan')">Cyan</button>
        <button style="background:#8b5cf6" onclick="setClinicTheme('purple')">Purple</button>
        <button style="background:#22c55e" onclick="setClinicTheme('green')">Green</button>
        <button style="background:#f97316" onclick="setClinicTheme('orange')">Orange</button>
      </div>
      <div class="field" style="margin-top:14px;">
        <label>Custom color hue circle</label>
        <input id="customAccentPicker" type="color" value="${safeText(extras.accent || '#d4af37')}" style="height:54px;width:100%;border-radius:16px;padding:6px;">
      </div>
      <button class="btn-primary" style="width:100%;margin-top:10px" onclick="saveCustomAccent()">Apply Custom Color</button>
      <button class="btn-secondary" style="width:100%;margin-top:10px" onclick="this.closest('.luxury-modal').remove()">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
};

window.saveCustomAccent = function() {
  const color = document.getElementById("customAccentPicker")?.value || "#d4af37";
  const extras = doctorExtras();
  extras.accent = color;
  extras.accentLight = color;
  extras.accentDark = color;
  saveDoctorExtras(extras);
  applyCustomAccent();
  document.querySelector(".luxury-modal")?.remove();
};

window.openLanguagePicker = function() {
  const modal = document.createElement("div");
  modal.className = "luxury-modal";
  modal.innerHTML = `<div class="luxury-box"><h2>Language / اللغة</h2><div class="actions-bar"><button class="btn-primary" onclick="setUILanguage('en');this.closest('.luxury-modal').remove()">English</button><button class="btn-primary" onclick="setUILanguage('ar');this.closest('.luxury-modal').remove()">العربية</button></div><button class="btn-secondary" style="width:100%;margin-top:12px" onclick="this.closest('.luxury-modal').remove()">Close</button></div>`;
  document.body.appendChild(modal);
};

window.openPdfPatternPicker = function() {
  const extras = doctorExtras();
  const modal = document.createElement("div");
  modal.className = "luxury-modal";
  modal.innerHTML = `<div class="luxury-box"><h2>PDF Pattern</h2><p class="muted">This pattern is saved for this doctor account and used on reports and receipts.</p><div class="pattern-grid">${["classic","waves","grid","dots"].map(x=>`<button class="pattern-card ${extras.pattern===x?'active':''}" onclick="setPdfPattern('${x}')"><span class="pdf-pattern-preview ${x}"></span>${x}</button>`).join("")}</div><button class="btn-secondary" style="width:100%;margin-top:12px" onclick="this.closest('.luxury-modal').remove()">Close</button></div>`;
  document.body.appendChild(modal);
};

window.setPdfPattern = function(pattern) {
  const extras = doctorExtras();
  extras.pattern = pattern;
  saveDoctorExtras(extras);
  document.querySelector(".luxury-modal")?.remove();
};

window.openDoctorInfoCard = function() {
  const extras = doctorExtras();
  const modal = document.createElement("div");
  modal.className = "luxury-modal";
  modal.innerHTML = `
    <div class="luxury-box wide-box">
      <h2>Dental Information Card</h2>
      <div class="doctor-info-card">
        <h3>${safeText(currentUser?.full_name || currentUser?.username || "Doctor")}</h3>
        <p>${safeText(extras.specialty || "General Dentist")}</p>
        <p><b>License:</b> ${safeText(extras.license || "-")}</p>
        <p><b>Phones:</b> ${safeText((extras.phones || []).join(" / ") || "-")}</p>
        <p><b>Websites:</b> ${safeText((extras.websites || []).join(" / ") || "-")}</p>
        <p><b>Address:</b> ${safeText(extras.address || "-")}</p>
        <p>${safeText(extras.bio || "")}</p>
        <div class="signature-display">${signatureImgHTML()}</div>
      </div>
      <div class="actions-bar"><button class="btn-primary" onclick="editDoctorInfoCard()">Edit Card</button><button class="btn-secondary" onclick="this.closest('.luxury-modal').remove()">Close</button></div>
    </div>`;
  document.body.appendChild(modal);
};

window.editDoctorInfoCard = async function() {
  const extras = doctorExtras();
  const specialty = await luxuryPrompt("Dental specialty", "e.g. Endodontist", extras.specialty || "General Dentist"); if (specialty === null) return;
  const license = await luxuryPrompt("License number", "Professional license", extras.license || ""); if (license === null) return;
  const phones = await luxuryPrompt("Doctor phones", "Separate with commas", (extras.phones || []).join(", ")); if (phones === null) return;
  const websites = await luxuryPrompt("Websites / social links", "Separate with commas", (extras.websites || []).join(", ")); if (websites === null) return;
  const address = await luxuryPrompt("Clinic address", "Address", extras.address || ""); if (address === null) return;
  const bio = await luxuryPrompt("Short dental bio", "Experience / services", extras.bio || ""); if (bio === null) return;
  Object.assign(extras, { specialty, license, phones: splitList(phones), websites: splitList(websites), address, bio });
  saveDoctorExtras(extras);
  document.querySelector(".luxury-modal")?.remove();
  openDoctorInfoCard();
};

window.uploadDoctorSignature = function(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { const extras = doctorExtras(); extras.signature = reader.result; saveDoctorExtras(extras); alert("Signature saved."); };
  reader.readAsDataURL(file);
};

window.setClinicTheme = function(theme) {
  const themes = ["gold","pink","red","blue","cyan","purple","green","orange"];
  themes.forEach(t => document.body.classList.remove(`theme-${t}`));
  const clean = themes.includes(theme) ? theme : "gold";
  document.body.classList.add(`theme-${clean}`);
  localStorage.setItem("clinicTheme", clean);
  document.querySelector(".luxury-modal")?.remove();
};

function applySavedTheme() {
  const theme = localStorage.getItem("clinicTheme") || "gold";
  setClinicTheme(theme);
  applyCustomAccent();
  applyLanguage();
}

// --- Header & User Bar ---
function applyUserBar() {
  if (!currentUser) return;
  const doctorName = $("doctorName");
  const doctorRole = $("doctorRole");
  const brandTitle = $("clinicTitle");
  const logoEl = $("clinicLogo");

  if (doctorName) doctorName.textContent = currentUser.full_name || currentUser.username || "Doctor";
  if (doctorRole) doctorRole.textContent = (currentUser.role || "doctor").toUpperCase();

  if (brandTitle) brandTitle.textContent = currentUser.clinic_name || "Masri Dental Clinic";

  if (logoEl && currentUser.clinic_logo) {
    logoEl.innerHTML = `<img src="${currentUser.clinic_logo}" alt="Clinic logo">`;
  }
}

function enhanceHeader() {
  const brand = $("brandArea");
  if (!brand) return;
  if (!brand.querySelector(".clinic-logo")) {
    const h1 = brand.querySelector("h1");
    if (h1) h1.insertAdjacentHTML("beforebegin", clinicLogoMarkup());
  }
}

// --- Permissions ---
function canEdit() { return currentUser && ["admin", "doctor"].includes(currentUser.role); }
function canDelete() { return currentUser && ["admin", "doctor"].includes(currentUser.role); }
function makeId() { return "P-" + Date.now(); }

// --- Luxury Prompts ---
function luxuryPrompt(title, placeholder = "", initialValue = "") {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "luxury-modal";
    modal.innerHTML = `
      <div class="luxury-box">
        <h2>${safeText(title)}</h2>
        <input id="luxuryInput" placeholder="${safeText(placeholder)}" value="${safeText(initialValue)}">
        <div class="luxury-actions">
          <button type="button" class="btn-secondary">Cancel</button>
          <button type="button" class="btn-primary">OK</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const input = modal.querySelector("#luxuryInput");
    setTimeout(() => input.focus(), 50);
    modal.querySelector(".btn-secondary").onclick = () => { modal.remove(); resolve(null); };
    modal.querySelector(".btn-primary").onclick = () => { const value = input.value.trim(); modal.remove(); resolve(value); };
    input.addEventListener("keydown", e => { if (e.key === "Enter") modal.querySelector(".btn-primary").click(); });
  });
}

function luxuryConfirm(title, message = "") {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "luxury-modal";
    modal.innerHTML = `
      <div class="luxury-box">
        <h2>${safeText(title)}</h2>
        ${message ? `<p>${safeText(message)}</p>` : ""}
        <div class="luxury-actions">
          <button type="button" class="btn-secondary">Cancel</button>
          <button type="button" class="btn-primary">OK</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector(".btn-secondary").onclick = () => { modal.remove(); resolve(false); };
    modal.querySelector(".btn-primary").onclick = () => { modal.remove(); resolve(true); };
  });
}

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  $(id)?.classList.add("active");
  document.querySelector(`[data-page="${id}"]`)?.classList.add("active");
  window.scrollTo(0, 0);
}

// --- Data Parsing ---
function parseClinicData(raw) {
  const base = { visits: [], appointments: [], payments: [], teeth: {}, extra_phones: [], websites: [] };
  if (!raw) return base;
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return { ...base, visits: data };
    return { ...base, ...data, visits: data.visits || [], appointments: data.appointments || [], payments: data.payments || [], teeth: data.teeth || {}, extra_phones: data.extra_phones || [], websites: data.websites || [] };
  } catch {
    return { ...base, visits: [{ date: "Old note", note: raw }] };
  }
}

function saveClinicData(data) {
  return JSON.stringify({ ...data, visits: data.visits || [], appointments: data.appointments || [], payments: data.payments || [], teeth: data.teeth || {}, extra_phones: data.extra_phones || [], websites: data.websites || [] });
}

function paymentTotals(data) {
  const total = data.payments.reduce((s, x) => s + Number(x.total || 0), 0);
  const discount = data.payments.reduce((s, x) => s + (Number(x.total || 0) * Number(x.discount || 0) / 100), 0);
  const net = Math.max(0, total - discount);
  const paid = data.payments.reduce((s, x) => s + Number(x.paid || 0), 0);
  return { total, discount, net, paid, remaining: net - paid };
}

function photoUrl(photo) {
  return typeof photo === "string" ? photo : (photo?.url || "");
}

// --- Patient Loading ---
async function loadPatients() {
  try {
    const statusEl = $("status");
    if (statusEl) {
      statusEl.innerHTML = '<span class="status-dot pulse"></span> Loading cloud...';
    }
    if (currentUser.role === "admin") {
      patients = await api("patients?select=*&order=created_at.desc");
    } else {
      patients = await api(`patients?owner_id=eq.${currentUser.id}&select=*&order=created_at.desc`);
    }
    renderPatients();
    renderDashboard();
    cachePatientsOffline();
    if (statusEl) {
      statusEl.innerHTML = '<span class="status-dot"></span> Cloud connected';
    }
    const params = new URLSearchParams(location.search);
    const patientId = params.get("patient");
    if (patientId) openPatient(patientId);
  } catch (err) {
    console.error(err);
    loadOfflinePatientsIfNeeded();
    if ($("status")) $("status").textContent = "Cloud error";
    if ($("list")) $("list").innerHTML = `<div class="card"><h3>Cloud error</h3><p>${safeText(err.message)}</p></div>`;
  }
}

function cachePatientsOffline() {
  try {
    localStorage.setItem("clinicOfflinePatients-" + (currentUser?.id || "guest"), JSON.stringify(patients));
    localStorage.setItem("clinicOfflineDate", new Date().toISOString());
  } catch {}
}

function loadOfflinePatientsIfNeeded() {
  try {
    const raw = localStorage.getItem("clinicOfflinePatients-" + (currentUser?.id || "guest"));
    if (raw && (!patients || !patients.length)) {
      patients = JSON.parse(raw);
      renderPatients();
      renderDashboard();
      if ($("status")) $("status").textContent = "Offline mode";
    }
  } catch {}
}

// --- Status Helpers ---
function getPatientStatus(patient, data, money) {
  const visitsCount = (data.visits || []).length;
  if (money.remaining > 0) return { text: "Unpaid", cls: "pill danger" };
  if (!patient.treatment_plan || !patient.treatment_plan.trim()) return { text: "Needs Plan", cls: "pill" };
  if (visitsCount > 0) return { text: "Active", cls: "pill success" };
  return { text: "New", cls: "pill" };
}

function nextAppointmentInfo(data) {
  const now = new Date();
  const future = (data.appointments || [])
    .map(a => ({ ...a, parsed: new Date(a.date || "") }))
    .filter(a => !isNaN(a.parsed) && a.parsed >= now)
    .sort((a, b) => a.parsed - b.parsed);
  return future[0] || null;
}

function lastVisitText(data) {
  return (data.visits || [])[0]?.date || "No visits yet";
}

function normalizePhoneForWhatsApp(phone = "") {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = "20" + digits.slice(1);
  if (!digits.startsWith("20") && digits.length <= 11) digits = "20" + digits;
  return digits;
}

// --- Timeline ---
function renderTimeline(patient) {
  const data = parseClinicData(patient.progress_notes);
  const timeline = [];
  (data.visits || []).forEach(v => timeline.push({ type: "Visit", title: v.treatment || "Visit", date: v.date || "", text: v.note || v.notes || "" }));
  (data.payments || []).forEach(p => timeline.push({ type: "Payment", title: "Payment", date: p.date || "", text: `Total: ${p.total || 0} | Paid: ${p.paid || 0}` }));
  (data.appointments || []).forEach(a => timeline.push({ type: "Appointment", title: "Appointment", date: a.date || "", text: a.note || "" }));
  (patient.photos || []).forEach(ph => timeline.push({ type: "Photo", title: "Photo", date: ph.date || "", text: ph.category ? `${ph.category} photo added` : "Photo added" }));
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!timeline.length) return `<p class="muted">No timeline yet</p>`;

  return timeline.map(item => `
    <div class="timeline-item">
      <div class="timeline-header">
        <div>
          <div class="timeline-title">${safeText(item.title)}</div>
          <div class="timeline-date">${safeText(item.date)}</div>
        </div>
        <span class="timeline-type">${safeText(item.type)}</span>
      </div>
      <div class="timeline-body">${safeText(item.text || "-")}</div>
    </div>
  `).join("");
}

// --- Dashboard ---
function renderDashboard() {
  const dash = $("dashboardContent");
  if (!dash) return;

  let totalPhotos = 0, totalVisits = 0, unpaid = 0, totalRevenue = 0, paidToday = 0;
  let missingPlan = 0, todayAppointments = [], overdueAppointments = [], upcoming = [];
  let unpaidPatients = [], followUpItems = [];
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  patients.forEach(p => {
    const data = parseClinicData(p.progress_notes);
    const money = paymentTotals(data);
    totalPhotos += (p.photos || []).length;
    totalVisits += (data.visits || []).length;
    unpaid += money.remaining;
    totalRevenue += money.paid;
    if (money.remaining > 0) unpaidPatients.push({ patient: p.name || "No name", amount: money.remaining, id: p.id });
    if (!p.treatment_plan || !p.treatment_plan.trim()) missingPlan++;

    (data.payments || []).forEach(pay => {
      if (new Date(pay.date).toDateString() === now.toDateString()) paidToday += Number(pay.paid || 0);
    });

    (data.appointments || []).forEach(a => {
      const appDate = new Date(a.date);
      const item = { patient: p.name || "No name", date: a.date || "", note: a.note || "", id: p.id };
      if (!isNaN(appDate)) {
        if (appDate.toDateString() === now.toDateString()) todayAppointments.push(item);
        else if (appDate < now) overdueAppointments.push(item);
        else upcoming.push(item);
      }
      if (!isNaN(appDate) && appDate < now) {
        followUpItems.push({ id: p.id, patient: p.name || "No name", date: a.date, note: a.note || "Follow-up", days: Math.max(0, Math.floor((now - appDate) / 86400000)) });
      }
    });
  });

  upcoming = upcoming.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)).slice(0, 5);
  unpaidPatients = unpaidPatients.sort((a, b) => b.amount - a.amount).slice(0, 5);
  followUpItems = followUpItems.sort((a, b) => b.days - a.days).slice(0, 6);

  // Treatment stats
  const tStats = {};
  patients.forEach(p => {
    const text = `${p.diagnosis || ""} ${p.treatment_plan || ""}`.toLowerCase();
    ["rct", "crown", "implant", "extraction", "scaling", "filling"].forEach(k => {
      if (text.includes(k)) tStats[k] = (tStats[k] || 0) + 1;
    });
  });

  // Calendar
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const apptMap = {};
  patients.forEach(p => {
    const data = parseClinicData(p.progress_notes);
    (data.appointments || []).forEach(a => {
      const d = new Date(a.date);
      if (!isNaN(d) && d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate();
        if (!apptMap[key]) apptMap[key] = [];
        apptMap[key].push({ patient: p.name || "Patient", id: p.id, date: a.date || "", note: a.note || "" });
      }
    });
  });

  window.currentCalendarMap = apptMap;
  dash.innerHTML = `
    <div class="hero-grid">
      <div class="stat-card"><span class="stat-label">${t('totalPatients')}</span><strong class="stat-value">${patients.length}</strong></div>
      <div class="stat-card"><span class="stat-label">${t('todaysAppts')}</span><strong class="stat-value">${todayAppointments.length}</strong></div>
      <div class="stat-card"><span class="stat-label">${t('unpaidBalance')}</span><strong class="stat-value unpaid">${unpaid}</strong></div>
      <div class="stat-card"><span class="stat-label">${t('totalVisits')}</span><strong class="stat-value">${totalVisits}</strong></div>
      <div class="stat-card"><span class="stat-label">${t('totalRevenue')}</span><strong class="stat-value gold">${totalRevenue}</strong></div>
      <div class="stat-card"><span class="stat-label">${t('paidToday')}</span><strong class="stat-value gold">${paidToday}</strong></div>
    </div>

    <div class="quick-actions">
      <button class="btn-primary" onclick="fillForm();showPage('form')">+ New Patient</button>
      <button class="btn-secondary" onclick="showPage('scan')">Scan QR</button>
      <button class="btn-secondary" onclick="backupData()">Backup</button>
      <button class="btn-secondary" onclick="restoreBackup()">Restore</button>
    </div>

    <div class="panel">
      <h2>${t('clinicOverview')}</h2>
      <span class="pill">${missingPlan} without treatment plan</span>
      <span class="pill">${todayAppointments.length} today</span>
      <span class="pill danger">${overdueAppointments.length} overdue</span>
      <span class="pill danger">${unpaidPatients.length} unpaid</span>
    </div>

    ${followUpItems.length ? `
    <div class="panel">
      <h2>Follow-up Watch</h2>
      <div class="dashboard-list">
        ${followUpItems.map(f => `
          <div class="dashboard-row">
            <div><b>${safeText(f.patient)}</b><br><small>${safeText(f.note)} - overdue ${f.days} day(s)</small></div>
            <button class="btn-secondary" onclick="openPatient('${f.id}')">Open</button>
          </div>
        `).join("")}
      </div>
    </div>` : ""}

    ${Object.keys(tStats).length ? `
    <div class="panel">
      <h2>Treatment Stats</h2>
      ${Object.entries(tStats).map(([k,v]) => `<span class="pill">${safeText(k.toUpperCase())}: ${v}</span>`).join(" ")}
    </div>` : ""}

    <div class="panel">
      <h2>${t('appointmentCalendar')}</h2>
      <div class="calendar-grid">
        ${Array.from({length: days}, (_, i) => {
          const day = i + 1;
          const list = apptMap[day] || [];
          return `<button class="calendar-cell ${list.length ? "has-appt" : ""}" onclick="${list.length ? `openCalendarDay(${day})` : ""}">${day}${list.length ? `<small>${list.length} cases</small>` : ""}</button>`;
        }).join("")}
      </div>
    </div>

    ${todayAppointments.length ? `
    <div class="panel">
      <h2>${t('today')}</h2>
      ${todayAppointments.map(a => `
        <div class="appointment-row">
          <div><b>${safeText(a.date)}</b><p class="muted">${safeText(a.patient)} - ${safeText(a.note)}</p></div>
          <button class="btn-secondary" onclick="openPatient('${a.id}')">Open</button>
        </div>
      `).join("")}
    </div>` : ""}

    ${upcoming.length ? `
    <div class="panel">
      <h2>${t('upcoming')}</h2>
      ${upcoming.map(a => `
        <div class="appointment-row">
          <div><b>${safeText(a.date)}</b><p class="muted">${safeText(a.patient)} - ${safeText(a.note)}</p></div>
          <button class="btn-secondary" onclick="openPatient('${a.id}')">Open</button>
        </div>
      `).join("")}
    </div>` : ""}

    ${unpaidPatients.length ? `
    <div class="panel">
      <h2>Unpaid Priority</h2>
      ${unpaidPatients.map(x => `
        <div class="appointment-row">
          <div><b>${safeText(x.patient)}</b><p class="muted">Remaining: ${x.amount}</p></div>
          <button class="btn-secondary" onclick="openPatient('${x.id}')">Open</button>
        </div>
      `).join("")}
    </div>` : ""}
  `;
}


window.openCalendarDay = function(day) {
  const items = (window.currentCalendarMap && window.currentCalendarMap[day]) || [];
  if (!items.length) return;
  const modal = document.createElement("div");
  modal.className = "luxury-modal";
  modal.innerHTML = `<div class="luxury-box"><h2>Cases on day ${day}</h2>${items.map(x=>`<div class="appointment-row"><div><b>${safeText(x.patient)}</b><p class="muted">${safeText(x.date)} ${x.note ? '- ' + safeText(x.note) : ''}</p></div><button class="btn-secondary" onclick="this.closest('.luxury-modal').remove();openPatient('${x.id}')">Open</button></div>`).join("")}<button class="btn-secondary" style="width:100%;margin-top:12px" onclick="this.closest('.luxury-modal').remove()">Close</button></div>`;
  document.body.appendChild(modal);
};

// --- Patient List ---
function renderPatients() {
  const q = ($("search")?.value || "").toLowerCase();
  const filtered = [...patients]
    .sort((a, b) => {
      const aData = parseClinicData(a.progress_notes);
      const bData = parseClinicData(b.progress_notes);
      const aMoney = paymentTotals(aData);
      const bMoney = paymentTotals(bData);
      if ((bMoney.remaining > 0) !== (aMoney.remaining > 0)) return (bMoney.remaining > 0) - (aMoney.remaining > 0);
      const aNext = nextAppointmentInfo(aData)?.parsed || new Date(8640000000000000);
      const bNext = nextAppointmentInfo(bData)?.parsed || new Date(8640000000000000);
      if (+aNext !== +bNext) return aNext - bNext;
      return new Date((bData.visits || [])[0]?.date || 0) - new Date((aData.visits || [])[0]?.date || 0);
    })
    .filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.phone || "").includes(q) ||
      (parseClinicData(p.progress_notes).extra_phones || []).join(" ").toLowerCase().includes(q) ||
      (parseClinicData(p.progress_notes).websites || []).join(" ").toLowerCase().includes(q) ||
      (p.case_id || "").toLowerCase().includes(q) ||
      (p.diagnosis || "").toLowerCase().includes(q) ||
      (p.chief_complaint || "").toLowerCase().includes(q)
    );

  const list = $("list");
  if (!list) return;

  if (!filtered.length) {
    list.innerHTML = `<div class="card" style="text-align:center;padding:32px;"><h3>No patients found</h3><p class="muted">Add your first patient to get started.</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(p => {
    const data = parseClinicData(p.progress_notes);
    const money = paymentTotals(data);
    const status = getPatientStatus(p, data, money);
    return `
      <div class="patient-card">
        <div class="patient-card-header">
          <div>
            <h3>${safeText(p.name || "No name")}</h3>
            <div class="patient-meta">
              <span class="pill">ID: ${safeText(p.case_id || p.id)}</span>
              <span class="pill">${safeText(allPatientPhones(p, data).join(" / ") || "No phone")}</span>
              ${p.age ? `<span class="pill">${p.age} yrs</span>` : ""}
            </div>
          </div>
          <span class="${status.cls}">${status.text}</span>
        </div>
        <div class="patient-stats">
          <div class="mini-card"><b>Visits</b><div class="value">${(data.visits || []).length}</div></div>
          <div class="mini-card"><b>Photos</b><div class="value">${(p.photos || []).length}</div></div>
          <div class="mini-card"><b>Remaining</b><div class="value ${money.remaining > 0 ? 'unpaid' : ''}">${money.remaining || 0}</div></div>
        </div>
        <div class="actions-bar">
          <button class="btn-primary" data-open-patient="${p.id}">Open</button>
          ${canEdit() ? `<button class="btn-secondary" data-edit-patient="${p.id}">Edit</button>` : ""}
          <button class="btn-secondary" data-qr-patient="${p.id}">QR</button>
          <button class="btn-secondary" data-wa-patient="${p.id}">WhatsApp</button>
        </div>
      </div>
    `;
  }).join("");
}

// --- Form ---
function getFormData(oldPatient = null) {
  const oldData = parseClinicData(oldPatient?.progress_notes);
  const newNote = $("progressNotes")?.value.trim();
  if (newNote) oldData.visits.unshift({ date: new Date().toLocaleString(), note: newNote, treatment: $("treatmentPlan")?.value || "" });
  oldData.extra_phones = splitList($("extraPhones")?.value || "");
  oldData.websites = splitList($("websites")?.value || "");
  return {
    owner_id: oldPatient?.owner_id || currentUser.id,
    case_id: $("caseId").value || oldPatient?.case_id || makeId(),
    name: $("name").value,
    phone: $("phone").value,
    age: $("age").value,
    gender: $("gender").value,
    chief_complaint: $("chiefComplaint").value,
    medical_alerts: $("medicalAlerts").value,
    diagnosis: $("diagnosis").value,
    treatment_plan: $("treatmentPlan").value,
    progress_notes: saveClinicData(oldData),
    photos: oldPatient?.photos || []
  };
}

function fillForm(p = null) {
  $("rowId").value = p?.id || "";
  $("caseId").value = p?.case_id || "";
  $("name").value = p?.name || "";
  $("phone").value = p?.phone || "";
  const parsedData = parseClinicData(p?.progress_notes);
  if ($("extraPhones")) $("extraPhones").value = (parsedData.extra_phones || []).join(", ");
  if ($("websites")) $("websites").value = (parsedData.websites || []).join(", ");
  $("age").value = p?.age || "";
  $("gender").value = p?.gender || "";
  $("chiefComplaint").value = p?.chief_complaint || "";
  $("medicalAlerts").value = p?.medical_alerts || "";
  $("diagnosis").value = p?.diagnosis || "";
  $("treatmentPlan").value = p?.treatment_plan || "";
  $("progressNotes").value = "";
  $("progressNotes").placeholder = p ? "Write a new visit note..." : "Write first visit note...";
  $("formTitle").textContent = p ? "Edit Patient" : "Add Patient";
  if ($("preview")) $("preview").innerHTML = "";
  pendingFiles = [];
}

// --- Photo Upload ---
async function compressImage(file, isXray = false) {
  // Premium photo quality: keep more detail for before/after smile photos and X-rays.
  // Older builds compressed clinical photos too aggressively, which made the After side look soft.
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { alpha: false });
      const MAX_WIDTH = isXray ? 2400 : 2000;
      const QUALITY = isXray ? 0.94 : 0.92;
      let w = img.width, h = img.height;
      if (w > MAX_WIDTH) { h *= MAX_WIDTH / w; w = MAX_WIDTH; }
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", QUALITY);
    };
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function uploadToBucket(bucket, path, blob, type) {
  const base64 = await blobToBase64(blob);
  const res = await fetch(`${API_BASE}?action=uploadPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken || ""}` },
    body: JSON.stringify({ bucket, path, contentType: type || "application/octet-stream", base64 })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url;
}

async function uploadPhotos(patientId) {
  const uploaded = [];
  for (const file of pendingFiles) {
    const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const path = `${patientId}/${Date.now()}-${cleanName}`;
    const isXray = file.category === "xray" || file.name.toLowerCase().includes("xray");
    const compressedBlob = await compressImage(file, isXray);
    uploaded.push({
      path,
      url: await uploadToBucket(PHOTO_BUCKET, path, compressedBlob, "image/jpeg"),
      name: file.name,
      date: new Date().toLocaleString()
    });
  }
  return uploaded;
}

// ============================================
// TOOTH CHART â THE CENTERPIECE
// ============================================

function getToothType(n) {
  n = Number(n);
  if ([11,12,21,22,31,32,41,42].includes(n)) return "incisor";
  if ([13,23,33,43].includes(n)) return "canine";
  if ([14,15,24,25,34,35,44,45].includes(n)) return "premolar";
  return "molar";
}

// Anatomically inspired SVG tooth shapes
function toothSvg(type = "molar") {
  if (type === "incisor") {
    // Chisel-shaped incisor with cervical line and subtle convex surface
    return `<svg viewBox="0 0 40 70" class="tooth-svg" style="width:20px;height:42px;">
      <path class="tooth-body" d="M8,4 C12,-2 28,-2 32,4 C36,14 34,28 30,44 C27,56 22,64 20,66 C18,64 13,56 10,44 C6,28 4,14 8,4 Z"/>
      <path class="tooth-stroke" d="M8,4 C12,-2 28,-2 32,4 C36,14 34,28 30,44 C27,56 22,64 20,66 C18,64 13,56 10,44 C6,28 4,14 8,4 Z"/>
      <path class="tooth-detail" d="M12,8 C14,20 14,32 12,44"/>
      <path class="tooth-shine" d="M10,6 C8,18 10,30 14,40"/>
      <ellipse class="tooth-detail" cx="20" cy="50" rx="8" ry="3" opacity="0.3"/>
    </svg>`;
  }

  if (type === "canine") {
    // Pointed cusp, longest crown
    return `<svg viewBox="0 0 44 76" class="tooth-svg" style="width:22px;height:48px;">
      <path class="tooth-body" d="M8,6 C12,-4 32,-4 36,6 C40,18 37,34 32,50 C28,62 22,70 20,72 C18,70 12,62 8,50 C3,34 0,18 8,6 Z"/>
      <path class="tooth-stroke" d="M8,6 C12,-4 32,-4 36,6 C40,18 37,34 32,50 C28,62 22,70 20,72 C18,70 12,62 8,50 C3,34 0,18 8,6 Z"/>
      <path class="tooth-detail" d="M16,10 C14,22 16,36 18,48"/>
      <path class="tooth-detail" d="M24,10 C26,22 24,36 22,48"/>
      <path class="tooth-shine" d="M10,8 C8,20 10,34 14,46"/>
      <ellipse class="tooth-detail" cx="20" cy="54" rx="9" ry="3" opacity="0.25"/>
    </svg>`;
  }

  if (type === "premolar") {
    // Rectangular crown with two cusps
    return `<svg viewBox="0 0 48 56" class="tooth-svg" style="width:28px;height:36px;">
      <path class="tooth-body" d="M6,8 C10,2 38,2 42,8 C46,18 44,30 40,40 C36,48 28,52 24,52 C20,52 12,48 8,40 C4,30 2,18 6,8 Z"/>
      <path class="tooth-stroke" d="M6,8 C10,2 38,2 42,8 C46,18 44,30 40,40 C36,48 28,52 24,52 C20,52 12,48 8,40 C4,30 2,18 6,8 Z"/>
      <path class="tooth-detail" d="M24,8 C22,18 22,32 24,44"/>
      <path class="tooth-detail" d="M10,22 C16,26 32,26 38,22"/>
      <path class="tooth-detail" d="M12,14 C18,10 30,10 36,14"/>
      <path class="tooth-shine" d="M8,10 C6,20 8,30 12,38"/>
      <ellipse class="tooth-detail" cx="24" cy="42" rx="10" ry="3" opacity="0.2"/>
    </svg>`;
  }

  // Molar â wide square crown with multiple cusps and cross-grooves
  return `<svg viewBox="0 0 56 56" class="tooth-svg" style="width:34px;height:38px;">
    <path class="tooth-body" d="M6,10 C10,4 46,4 50,10 C54,22 52,34 46,44 C40,50 32,52 28,52 C24,52 16,50 10,44 C4,34 2,22 6,10 Z"/>
    <path class="tooth-stroke" d="M6,10 C10,4 46,4 50,10 C54,22 52,34 46,44 C40,50 32,52 28,52 C24,52 16,50 10,44 C4,34 2,22 6,10 Z"/>
    <path class="tooth-detail" d="M28,8 C26,20 26,36 28,48"/>
    <path class="tooth-detail" d="M8,26 C16,22 40,22 48,26"/>
    <path class="tooth-detail" d="M12,16 C20,12 36,12 44,16"/>
    <path class="tooth-detail" d="M12,36 C20,32 36,32 44,36"/>
    <path class="tooth-shine" d="M8,12 C6,22 8,32 12,40"/>
    <circle class="tooth-detail" cx="18" cy="22" r="3" opacity="0.12"/>
    <circle class="tooth-detail" cx="38" cy="22" r="3" opacity="0.12"/>
    <circle class="tooth-detail" cx="20" cy="36" r="2.5" opacity="0.12"/>
    <circle class="tooth-detail" cx="36" cy="36" r="2.5" opacity="0.12"/>
  </svg>`;
}

function surfaceOverlayHTML(toothInfo) {
  if (!toothInfo || typeof toothInfo === "string") return "";
  const status = toothInfo.status || "";
  const surfaces = toothInfo.surfaces || [];
  if (!surfaces.length || !status || status === "healthy") return "";
  const cls = status === "caries" ? "#ef4444" : status === "filling" ? "#60a5fa" : status === "rct" ? "#a855f7" : status === "crown" ? "#d4af37" : "#60a5fa";
  return `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;pointer-events:none;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;overflow:hidden;opacity:0.7;mix-blend-mode:multiply;">
    <span style="background:${surfaces.includes("M") ? cls : 'transparent'};border:1px solid rgba(0,0,0,0.08);"></span>
    <span style="background:${surfaces.includes("D") ? cls : 'transparent'};border:1px solid rgba(0,0,0,0.08);"></span>
    <span style="background:${surfaces.includes("B") ? cls : 'transparent'};border:1px solid rgba(0,0,0,0.08);"></span>
    <span style="background:${surfaces.includes("L") ? cls : 'transparent'};border:1px solid rgba(0,0,0,0.08);"></span>
  </div>`;
}

function toothExtraOverlay(status) {
  if (status === "rct") {
    return `<svg viewBox="0 0 40 48" style="position:absolute;inset:4px;width:36px;height:44px;pointer-events:none;opacity:0.6;">
      <path d="M14,20 C14,30 12,38 10,44" stroke="#7c3aed" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M26,20 C26,30 28,38 30,44" stroke="#7c3aed" stroke-width="3" stroke-linecap="round" fill="none"/>
    </svg>`;
  }
  if (status === "implant") {
    return `<svg viewBox="0 0 40 48" style="position:absolute;inset:4px;width:36px;height:44px;pointer-events:none;opacity:0.7;">
      <line x1="20" y1="18" x2="20" y2="44" stroke="#0f766e" stroke-width="4" stroke-linecap="round"/>
      <line x1="10" y1="30" x2="30" y2="30" stroke="#0f766e" stroke-width="3" stroke-linecap="round"/>
      <line x1="12" y1="38" x2="28" y2="38" stroke="#0f766e" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }
  return "";
}

function renderToothChart(p) {
  const data = parseClinicData(p.progress_notes);
  const teeth = data.teeth || {};
  const upperRight = [18,17,16,15,14,13,12,11];
  const upperLeft = [21,22,23,24,25,26,27,28];
  const lowerLeft = [31,32,33,34,35,36,37,38];
  const lowerRight = [48,47,46,45,44,43,42,41];
  const upper = [...upperRight, ...upperLeft];
  const lower = [...lowerRight, ...lowerLeft];

  const toothButton = (n) => {
    const toothInfo = teeth[n] || "healthy";
    const status = typeof toothInfo === "string" ? toothInfo : (toothInfo.status || "healthy");
    const surfaces = typeof toothInfo === "string" ? [] : (toothInfo.surfaces || []);
    const type = getToothType(n);
    return `
      <button type="button" class="tooth-btn ${safeText(status)} ${type}" data-tooth="${n}" onclick="window.openToothPopup('${p.id}', '${n}')">
        <span style="position:relative;display:block;">${toothSvg(type)}${surfaceOverlayHTML(toothInfo)}${toothExtraOverlay(status)}</span>
        <span class="tooth-number">${n}</span>
        ${surfaces.length ? `<span class="tooth-surface-badge">${safeText(surfaces.join(""))}</span>` : ""}
      </button>`;
  };

  return `
    <div class="quad-tabs">
      <button class="quad-tab active" data-quad="all" onclick="setQuadrantFilter('all')">All</button>
      <button class="quad-tab" data-quad="upperR" onclick="setQuadrantFilter('upperR')">UR</button>
      <button class="quad-tab" data-quad="upperL" onclick="setQuadrantFilter('upperL')">UL</button>
      <button class="quad-tab" data-quad="lowerL" onclick="setQuadrantFilter('lowerL')">LL</button>
      <button class="quad-tab" data-quad="lowerR" onclick="setQuadrantFilter('lowerR')">LR</button>
    </div>
    <div class="odontogram">
      <div class="jaw-row">
        <div class="teeth-row">${upper.map(toothButton).join("")}</div>
      </div>
      <div style="height:24px;"></div>
      <div class="jaw-row">
        <div class="teeth-row lower">${lower.map(toothButton).join("")}</div>
      </div>
    </div>
    <div class="tooth-legend">
      <span class="legend-item"><span class="legend-dot healthy"></span> Healthy</span>
      <span class="legend-item"><span class="legend-dot caries"></span> Caries</span>
      <span class="legend-item"><span class="legend-dot filling"></span> Filling</span>
      <span class="legend-item"><span class="legend-dot rct"></span> RCT</span>
      <span class="legend-item"><span class="legend-dot crown"></span> Crown</span>
      <span class="legend-item"><span class="legend-dot missing"></span> Missing</span>
      <span class="legend-item"><span class="legend-dot extraction"></span> Extraction</span>
      <span class="legend-item"><span class="legend-dot implant"></span> Implant</span>
    </div>`;
}

window.setQuadrantFilter = function(q) {
  const map = {
    all: () => true,
    upperR: n => n >= 11 && n <= 18,
    upperL: n => n >= 21 && n <= 28,
    lowerL: n => n >= 31 && n <= 38,
    lowerR: n => n >= 41 && n <= 48
  };
  const fn = map[q] || map.all;
  document.querySelectorAll(".tooth-btn").forEach(btn => {
    const n = Number(btn.dataset.tooth || 0);
    btn.classList.toggle("hidden-quad", !fn(n));
  });
  document.querySelectorAll(".quad-tab").forEach(b => b.classList.toggle("active", b.dataset.quad === q));
};

// --- Tooth Popup ---
window.openToothPopup = function(patientId, toothNumber) {
  selectedToothPatientId = patientId;
  selectedToothNumber = toothNumber;
  const modal = document.getElementById("toothModal");
  $("toothModalTitle").textContent = `Tooth ${toothNumber}`;
  modal.classList.remove("hidden");

  // Reset surface buttons
  modal.querySelectorAll(".surface-btn").forEach(btn => btn.classList.remove("active"));

  // Load existing surfaces
  const p = patients.find(x => x.id === patientId);
  if (p) {
    const data = parseClinicData(p.progress_notes);
    const toothInfo = data.teeth?.[toothNumber];
    if (toothInfo && typeof toothInfo === "object" && toothInfo.surfaces) {
      toothInfo.surfaces.forEach(s => {
        const btn = modal.querySelector(`.surface-btn[data-s="${s}"]`);
        if (btn) btn.classList.add("active");
      });
    }
  }
};

window.closeToothPopup = function() {
  document.getElementById("toothModal").classList.add("hidden");
};

window.setToothStatus = async function(status) {
  if (!selectedToothPatientId || !selectedToothNumber) return;
  const p = patients.find(x => x.id === selectedToothPatientId);
  if (!p) return alert("Patient not found.");
  const data = parseClinicData(p.progress_notes);
  if (!data.teeth) data.teeth = {};
  const selectedSurfaces = [...document.querySelectorAll("#toothModal .surface-btn.active")].map(btn => btn.dataset.s);
  data.teeth[selectedToothNumber] = { status, surfaces: selectedSurfaces };
  await api(`patients?id=eq.${selectedToothPatientId}`, {
    method: "PATCH",
    body: JSON.stringify({ progress_notes: saveClinicData(data) })
  });
  closeToothPopup();
  await refreshPatientKeepingScroll(selectedToothPatientId);
};

// --- Patient Details ---
function treatmentProgressItems(patient) {
  const items = [];
  const hasDiagnosis = !!String(patient.diagnosis || "").trim();
  const hasPlan = !!String(patient.treatment_plan || "").trim();
  items.push({ name: "Diagnosis", state: hasDiagnosis ? "done" : "pending" });
  items.push({ name: "Treatment plan", state: hasPlan ? "done" : (hasDiagnosis ? "active" : "pending") });
  const data = parseClinicData(patient.progress_notes);
  const visits = data.visits || [];
  items.push({ name: "Treatment started", state: visits.length ? "done" : (hasPlan ? "active" : "pending") });
  items.push({ name: "Review", state: visits.length >= 2 ? "done" : (visits.length ? "active" : "pending") });
  const completed = String(patient.status || "").toLowerCase().includes("complete") || visits.some(v => String(v.note || v.treatment || "").toLowerCase().includes("complete"));
  items.push({ name: "Completed", state: completed ? "done" : "pending" });
  return items;
}

function treatmentCompletionPercent(patient) {
  const steps = treatmentProgressItems(patient);
  if (!steps.length) return 0;
  const done = steps.filter(s => s.state === "done").length;
  return Math.min(100, Math.round((done / steps.length) * 100));
}

function renderTreatmentProgress(patient) {
  return `<div class="progress-steps">
    ${treatmentProgressItems(patient).map(s => `
      <div class="progress-step ${s.state}">
        <span>${s.state === "done" ? "&#10003;" : s.state === "active" ? "&#9654;" : "&#9675;"} ${safeText(s.name)}</span>
        <span>${s.state === "done" ? "Done" : s.state === "active" ? "In Progress" : "Pending"}</span>
      </div>
    `).join("")}
  </div>`;
}

function medicalAlertBanner(patient) {
  const text = `${patient.medical_alerts || ""}`.trim();
  if (!text || text === "-" || /^n\/?a$/i.test(text) || /^nad$/i.test(text) || /^none$/i.test(text)) return "";
  return `<div class="alert-banner">&#9888; Medical alert: ${safeText(text)}</div>`;
}

function categorizedPhotos(patient) {
  const photos = (patient.photos || []).map((x, i) => ({
    url: photoUrl(x),
    category: String(x?.category || "").toLowerCase(),
    name: String(x?.name || x?.filename || "").toLowerCase(),
    index: i
  })).filter(x => x.url);
  const xrays = photos.filter(x => x.category.includes("x") || x.name.includes("xray") || x.name.includes("x-ray"));
  const clinical = photos.filter(x => !xrays.includes(x));
  return { clinical, xrays };
}

window.simplePhotoState = {};

function renderSimplePhotos(patient, type = "clinical") {
  const cats = categorizedPhotos(patient);
  const list = type === "xray" ? cats.xrays : cats.clinical;
  const fallback = type === "xray" ? cats.clinical : cats.xrays;
  const photos = list.length ? list : fallback;
  if (!photos.length) return `<p class="muted">No photos yet</p>`;
  window.simplePhotoState[patient.id] = { type, photos };
  return `
    <div class="photo-tabs">
      <button class="photo-tab ${type === "clinical" ? "active" : ""}" onclick="switchSimplePhotoType('${patient.id}','clinical')">Clinical</button>
      <button class="photo-tab ${type === "xray" ? "active" : ""}" onclick="switchSimplePhotoType('${patient.id}','xray')">X-ray</button>
    </div>
    <div class="simple-photo-grid">
      ${photos.map((p, i) => `<img src="${p.url}" onclick="openSimplePhotoViewer('${patient.id}', ${i})" alt="Photo">`).join("")}
    </div>`;
}

window.switchSimplePhotoType = function(patientId, type) {
  const p = patients.find(x => x.id === patientId);
  if (!p) return;
  const target = document.getElementById("simplePhotosBox");
  if (target) target.innerHTML = renderSimplePhotos(p, type);
};

window.openSimplePhotoViewer = function(patientId, index = 0) {
  const p = patients.find(x => x.id === patientId);
  if (!p) return;
  const s = window.simplePhotoState[patientId];
  if (!s || !s.photos?.length) return;
  const urls = s.photos.map(x => x.url);
  window.simplePhotoState[patientId].index = index;

  document.getElementById("fullPhotoViewer")?.remove();
  const viewer = document.createElement("div");
  viewer.className = "photo-viewer";
  viewer.id = "fullPhotoViewer";
  viewer.innerHTML = `
    <div class="viewer-nav" style="position:fixed;top:20px;left:20px;right:20px;justify-content:space-between;z-index:1002;">
      <span style="color:white;font-weight:700;font-size:14px;">${index + 1} / ${urls.length}</span>
      <button class="viewer-close" onclick="closeSimplePhotoViewer()" style="position:static;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <img src="${urls[index]}" style="max-width:92vw;max-height:78vh;object-fit:contain;border-radius:16px;">
    <div class="viewer-nav">
      <button onclick="moveSimplePhoto('${patientId}', -1)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Prev
      </button>
      <button onclick="moveSimplePhoto('${patientId}', 1)">
        Next
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
    </div>
  `;
  document.body.appendChild(viewer);
};

window.moveSimplePhoto = function(patientId, step) {
  const s = window.simplePhotoState[patientId];
  if (!s || !s.photos?.length) return;
  s.index = (s.index + step + s.photos.length) % s.photos.length;
  openSimplePhotoViewer(patientId, s.index);
};

window.closeSimplePhotoViewer = function() {
  document.getElementById("fullPhotoViewer")?.remove();
};

// --- Patient Detail HTML ---
function patientDetailsHTML(p) {
  const data = parseClinicData(p.progress_notes);
  const money = paymentTotals(data);
  const status = getPatientStatus(p, data, money);
  return `
    <div class="card">
      <div class="profile-hero">
        <div>
          <h2>${safeText(p.name || "No name")}</h2>
          <div class="tag-wrap">
            <span class="${status.cls}">${status.text}</span>
          </div>
        </div>
        <div style="text-align:center;">
          <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,var(--accent-light),var(--accent-dark));display:grid;place-items:center;color:#0a0a0a;font-weight:800;font-size:20px;margin:0 auto 8px;">${safeText((p.name || "?").trim().split(/\s+/).slice(0,2).map(x => x[0] || "").join("").toUpperCase() || "?")}</div>
          <div class="completion-ring" style="--p:${treatmentCompletionPercent(p)}%">
            <span>${treatmentCompletionPercent(p)}%</span>
          </div>
        </div>
      </div>

      <div class="tag-wrap">
        <span class="pill">ID: ${safeText(p.case_id || "-")}</span>
        <span class="pill">${safeText(allPatientPhones(p, data).join(" / ") || "No phone")}</span>
        <span class="pill">${safeText(p.age || "-")} yrs</span>
        <span class="pill">${safeText(p.gender || "-")}</span>
      </div>

      <div class="kv"><b>Chief Complaint</b><span>${safeText(p.chief_complaint || "-")}</span></div>
      <div class="kv"><b>Medical Alerts</b><span>${safeText(p.medical_alerts || "-")}</span></div>
      <div class="kv"><b>Diagnosis</b><span>${safeText(p.diagnosis || "-")}</span></div>
      <div class="kv"><b>Treatment Plan</b><span>${safeText(p.treatment_plan || "-")}</span></div>
      ${medicalAlertBanner(p)}

      <h3 style="color:var(--accent);margin-top:20px;">Treatment Progress</h3>
      ${renderTreatmentProgress(p)}

      <div class="actions-bar" style="margin-top:16px;">
        <button class="btn-secondary" onclick="sendWhatsAppReminder('${p.id}')">WhatsApp</button>
        <button class="btn-secondary" onclick="addTreatmentTemplate('${p.id}')">Template</button>
        <button class="btn-secondary" onclick="generateAITreatmentPlan('${p.id}')">AI Plan</button>
        <button class="btn-secondary" onclick="showCaseSummary('${p.id}')">Summary</button>
        <button class="btn-secondary" onclick="generateSmartNote('${p.id}')">Smart Note</button>
        <button class="btn-secondary" onclick="generateSmartConsentPro('${p.id}')">Consent</button>
        <button class="btn-secondary" onclick="generatePrescriptionPro('${p.id}')">Prescription</button>
        <button class="btn-secondary" onclick="addLabWork('${p.id}')">Lab</button>
        <button class="btn-secondary" onclick="addPayment('${p.id}')">+ Payment</button>
      </div>

      <h3 style="color:var(--accent);margin-top:24px;">Visits History</h3>
      ${data.visits.length ? data.visits.map((v, i) => `
        <div class="kv">
          <b>Visit ${data.visits.length - i}</b>
          <div style="color:var(--text-secondary);font-size:12px;margin-bottom:4px;">${safeText(v.date || "")}</div>
          <span>${safeText(v.note || "-")}</span>
        </div>
      `).join("") : `<div class="kv"><span class="muted">No visits yet</span></div>`}

      <h3 style="color:var(--accent);margin-top:24px;">Tooth Chart</h3>
      <div class="tooth-chart-wrap">
        ${renderToothChart(p)}
      </div>

      <h3 style="color:var(--accent);margin-top:24px;">Appointments</h3>
      <div class="actions-bar">
        <button class="btn-primary" onclick="addAppointment('${p.id}')">+ Add Appointment</button>
      </div>
      ${data.appointments.length ? data.appointments.map((a, i) => `
        <div class="kv">
          <b>${safeText(a.date || "-")}</b>
          <span>${safeText(a.note || "")}</span>
          <button class="btn-danger" style="margin-top:8px;font-size:12px;padding:8px 14px;" onclick="deleteAppointment('${p.id}', ${i})">Delete</button>
        </div>
      `).join("") : `<div class="kv"><span class="muted">No appointments yet</span></div>`}

      <h3 style="color:var(--accent);margin-top:24px;">Payments</h3>
      <div class="finance-grid">
        <div class="finance-card"><small>Total</small><strong>${money.total}</strong></div>
        <div class="finance-card"><small>Paid</small><strong>${money.paid}</strong></div>
        <div class="finance-card"><small>Remaining</small><strong style="color:var(--danger)">${money.remaining}</strong></div>
        <div class="finance-card"><small>Collection</small><strong>${money.total ? Math.round((money.paid / money.total) * 100) : 0}%</strong></div>
      </div>
      <div class="actions-bar">
        <button class="btn-primary" onclick="addPayment('${p.id}')">+ Add Payment</button>
        <button class="btn-secondary" onclick="addInstallmentPlan('${p.id}')">Installments</button>
      </div>
      ${data.payments.length ? data.payments.map((pay, i) => `
        <div class="kv">
          <b>${safeText(pay.date || "")}</b>
          <span>Procedure: ${safeText(pay.procedure || "-")} | Total: ${Number(pay.total || 0)} | Discount: ${Number(pay.discount || 0)}% | Paid: ${Number(pay.paid || 0)} | Remaining: ${Math.max(0, Number(pay.total || 0) - (Number(pay.total || 0) * Number(pay.discount || 0) / 100) - Number(pay.paid || 0))}</span>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;"><button class="btn-secondary" style="font-size:12px;padding:8px 14px;" onclick="exportReceipt('${p.id}', ${i})">Receipt</button><button class="btn-danger" style="font-size:12px;padding:8px 14px;" onclick="deletePayment('${p.id}', ${i})">Delete</button></div>
        </div>
      `).join("") : `<div class="kv"><span class="muted">No payments yet</span></div>`}

      <h3 style="color:var(--accent);margin-top:24px;">Photos / X-rays</h3>
      <div class="actions-bar">
        <button class="btn-secondary" onclick="showBeforeAfter('${p.id}')">Before / After</button>
      </div>
      <div id="simplePhotosBox">${renderSimplePhotos(p, "clinical")}</div>

      <h3 style="color:var(--accent);margin-top:24px;">Patient Timeline</h3>
      ${renderTimeline(p)}

      <h3 style="color:var(--accent);margin-top:24px;">Lab Tracking</h3>
      ${renderLabMini(p.id)}

      <div class="actions-bar" style="margin-top:20px;">
        ${canEdit() ? `<button class="btn-primary" onclick="editPatient('${p.id}')">Edit Patient</button>` : ""}
        <button class="btn-secondary" data-qr-patient="${p.id}">QR Code</button>
        <button class="btn-secondary" data-wa-patient="${p.id}">WhatsApp</button>
        <button class="btn-secondary" onclick="exportPDF('${p.id}')">Export PDF</button>
        ${canDelete() ? `<button class="btn-danger" onclick="deletePatient('${p.id}')">Delete</button>` : ""}
      </div>
    </div>`;
}

function renderLabMini(patientId) {
  const lab = JSON.parse(localStorage.getItem("clinicLab") || "[]").map((x, i) => ({ ...x, index: i })).filter(x => x.patientId === patientId);
  if (!lab.length) return `<p class="muted">No lab work yet</p>`;
  return lab.map(it => `
    <div class="lab-row">
      <div><b>${safeText(it.item || "Lab work")}</b><span class="pill">${safeText(it.status || "Sent")}</span></div>
      <div style="display:flex;gap:8px;">
        <button class="btn-secondary" style="font-size:12px;padding:8px 14px;" onclick="editLabWork('${patientId}', ${it.index})">Edit</button>
        <button class="btn-danger" style="font-size:12px;padding:8px 14px;" onclick="deleteLabWork('${patientId}', ${it.index})">Delete</button>
      </div>
    </div>
    <div class="lab-stepper">${["Impression","Lab","Ready","Delivered"].map((s,i) => `<div class="lab-step ${i <= (it.status?.toLowerCase().includes('deliver') ? 3 : it.status?.toLowerCase().includes('ready') ? 2 : it.status?.toLowerCase().includes('wait') ? 1 : 0) ? 'done' : ''}">${s}</div>`).join("")}</div>
  `).join("");
}

// --- Patient Operations ---
window.openPatient = function(id) {
  try {
    const p = patients.find(x => String(x.id) === String(id));
    if (!p) return alert("Patient not found or you do not have access.");
    const details = $("details");
    if (!details) return;
    details.innerHTML = patientDetailsHTML(p);
    showPage("detail");
    window.scrollTo(0, 0);
  } catch (err) {
    console.error("Open patient failed", err);
    alert("Open patient failed: " + err.message);
  }
};

window.editPatient = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");
  fillForm(p);
  showPage("form");
};

window.deletePatient = async function(id) {
  if (!canDelete()) return alert("Only doctor/admin can delete patients");
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");
  if (!(await luxuryConfirm("Delete this patient?", "You can undo for a short time."))) return;
  localStorage.setItem("lastDeletedPatient", JSON.stringify(p));
  await api(`patients?id=eq.${id}`, { method: "DELETE" });
  await loadPatients();
  showPage("patients");
  showUndoToast(p.name);
};

window.undoLastDelete = async function() {
  const raw = localStorage.getItem("lastDeletedPatient");
  if (!raw) return alert("No deleted patient to restore.");
  const p = JSON.parse(raw);
  if (!(await luxuryConfirm("Restore patient?", `Restore ${p.name || "patient"}?`))) return;
  await api("patients", { method: "POST", body: JSON.stringify(p) });
  localStorage.removeItem("lastDeletedPatient");
  await loadPatients();
  showPage("patients");
};

function showUndoToast(name) {
  document.getElementById("undoToast")?.remove();
  const toast = document.createElement("div");
  toast.id = "undoToast";
  toast.className = "toast-undo";
  toast.innerHTML = `<span>Deleted ${safeText(name || "patient")}</span><button class="btn-secondary" onclick="undoLastDelete();document.getElementById('undoToast')?.remove();">Undo</button>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 9000);
}

async function refreshPatientKeepingScroll(patientId) {
  const scrollY = window.scrollY;
  await loadPatients();
  openPatient(patientId);
  requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "instant" }));
}

// --- Appointments ---
window.addAppointment = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");
  const data = parseClinicData(p.progress_notes);
  const date = await luxuryPrompt("Appointment date/time", "e.g. 2026-06-15 2:00 PM");
  if (!date) return;
  const note = await luxuryPrompt("Note (optional)") || "";
  data.appointments.unshift({ date, note });
  await api(`patients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
};

window.deleteAppointment = async function(id, index) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  if (!(await luxuryConfirm("Delete appointment?"))) return;
  const data = parseClinicData(p.progress_notes);
  data.appointments.splice(index, 1);
  await api(`patients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
};

// --- Payments ---
window.addPayment = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");
  const data = parseClinicData(p.progress_notes);
  const procedure = await luxuryPrompt("Procedure", "e.g. RCT upper molar");
  if (procedure === null) return;
  const total = await luxuryPrompt("Total treatment cost", "Enter total amount");
  if (total === null || total === "") return;
  const discount = await luxuryPrompt("Percentage discount", "0-100", "0");
  if (discount === null) return;
  const paid = await luxuryPrompt("Paid amount", "Enter paid amount", "0");
  if (paid === null) return;
  data.payments.unshift({ date: new Date().toLocaleString(), procedure, total: Number(total || 0), discount: Math.max(0, Math.min(100, Number(discount || 0))), paid: Number(paid || 0) });
  await api(`patients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
};

window.deletePayment = async function(id, index) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  if (!(await luxuryConfirm("Delete payment?"))) return;
  const data = parseClinicData(p.progress_notes);
  data.payments.splice(index, 1);
  await api(`patients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
};

window.addInstallmentPlan = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const total = await luxuryPrompt("Installment total", "e.g. 10000");
  if (!total) return;
  const first = await luxuryPrompt("First payment", "e.g. 2000", "0");
  const data = parseClinicData(p.progress_notes);
  data.payments.unshift({ date: new Date().toLocaleString(), procedure: "Installment plan", total: Number(total || 0), discount: 0, paid: Number(first || 0), note: "Installment plan" });
  await api(`patients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
};

// --- WhatsApp ---
window.openWhatsAppReminder = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");
  const phone = normalizePhoneForWhatsApp(p.phone || "");
  if (!phone) return alert("No valid phone number.");
  const clinicName = currentUser?.clinic_name || "Masri Dental Clinic";
  const data = parseClinicData(p.progress_notes);
  const next = nextAppointmentInfo(data);
  const apptLine = next?.date ? `\nYour next appointment: ${next.date}` : "";
  const message = `Hello ${p.name || ""}, this is ${clinicName}. This is a reminder from the clinic.${apptLine}`;

  const modal = document.createElement("div");
  modal.className = "luxury-modal";
  modal.id = "whatsappModal";
  modal.innerHTML = `
    <div class="luxury-box">
      <h2>WhatsApp Reminder</h2>
      <p style="white-space:pre-wrap;text-align:left;background:var(--bg-elevated);padding:14px;border-radius:12px;border:1px solid var(--border);">${safeText(message)}</p>
      <div class="luxury-actions">
        <button type="button" class="btn-secondary" id="copyWhatsappMsg">Copy</button>
        <button type="button" class="btn-primary" id="openWhatsappApp">Open WhatsApp</button>
      </div>
      <div class="luxury-actions" style="margin-top:8px;">
        <button type="button" class="btn-secondary" style="width:100%;" onclick="document.getElementById('whatsappModal').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("#copyWhatsappMsg").onclick = async () => {
    try { await navigator.clipboard.writeText(message); alert("Copied!"); } catch { alert(message); }
  };
  modal.querySelector("#openWhatsappApp").onclick = () => {
    window.location.href = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
  };
};
window.sendWhatsAppReminder = window.openWhatsAppReminder;

// --- Smart Notes & Templates ---
window.generateSmartNote = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const keyword = await luxuryPrompt("Smart note type", "extraction / rct / crown / scaling / filling / follow-up", "follow-up");
  if (!keyword) return;
  const k = keyword.toLowerCase();
  const notes = {
    extraction: "Extraction completed atraumatically. Hemostasis achieved. Post-operative instructions explained.",
    rct: "RCT visit completed: canal preparation/irrigation performed, temporary restoration placed, next visit planned.",
    crown: "Crown procedure visit completed. Margins, occlusion and shade were reviewed.",
    scaling: "Scaling and oral hygiene instructions completed. Patient advised for maintenance visit.",
    filling: "Caries removed and restoration placed. Occlusion checked and polished.",
    "follow-up": "Follow-up visit completed. Patient progress reviewed and instructions explained.",
    "follow up": "Follow-up visit completed. Patient progress reviewed and instructions explained."
  };
  const note = notes[k] || notes[Object.keys(notes).find(key => k.includes(key))] || keyword;
  const data = parseClinicData(p.progress_notes);
  data.visits.unshift({ date: new Date().toLocaleString(), treatment: keyword, note });
  await api(`patients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
};

window.addTreatmentTemplate = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const template = await luxuryPrompt("Treatment template", "rct / scaling / crown / extraction / implant / filling / follow-up", "follow-up");
  if (!template) return;
  const key = String(template).toLowerCase();
  const notes = {
    rct: "Root canal treatment visit: access, canal preparation/irrigation, working length and temporary restoration.",
    scaling: "Scaling and oral hygiene instructions were performed. Patient advised for maintenance.",
    crown: "Crown preparation/checking stage. Occlusion and margins reviewed.",
    extraction: "Extraction visit. Post-operative instructions explained.",
    implant: "Implant treatment stage. Healing and follow-up instructions discussed.",
    filling: "Restorative filling visit. Caries removed and restoration placed.",
    "follow-up": "Follow-up visit. Healing/progress checked and next steps discussed.",
    "follow up": "Follow-up visit. Healing/progress checked and next steps discussed."
  };
  const note = notes[key] || template;
  const data = parseClinicData(p.progress_notes);
  data.visits.unshift({ date: new Date().toLocaleString(), treatment: template, note });
  await api(`patients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
};

window.generateAITreatmentPlan = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const text = `${p.chief_complaint || ""} ${p.diagnosis || ""} ${p.treatment_plan || ""}`.toLowerCase();
  let plan = "Examination, diagnosis confirmation, treatment discussion, consent, treatment, and follow-up.";
  if (text.includes("caries") || text.includes("decay")) plan = "Clinical/radiographic assessment, caries removal, restoration, occlusion check, oral hygiene instructions, and follow-up.";
  if (text.includes("rct") || text.includes("pulp") || text.includes("pain")) plan = "Endodontic assessment, pre-operative radiograph, access cavity, canal preparation/irrigation, obturation, final restoration/crown planning, and follow-up.";
  if (text.includes("crown")) plan = "Crown assessment, tooth preparation, impression/scan, temporary crown, try-in, cementation, occlusion adjustment, and follow-up.";
  if (text.includes("implant")) plan = "Implant assessment, radiographic planning, surgical phase, healing period, prosthetic phase, maintenance, and follow-up.";
  if (text.includes("extraction")) plan = "Extraction assessment, consent, atraumatic extraction, post-operative instructions, medications if indicated, and follow-up.";
  if (text.includes("perio") || text.includes("scaling")) plan = "Periodontal assessment, scaling/root debridement, oral hygiene instructions, re-evaluation, and maintenance plan.";
  const accepted = await luxuryConfirm("AI Treatment Plan", plan);
  if (!accepted) return;
  await api(`patients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ treatment_plan: plan }) });
  await refreshPatientKeepingScroll(id);
};

window.showCaseSummary = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const data = parseClinicData(p.progress_notes);
  const money = paymentTotals(data);
  const summary = [
    `Patient: ${p.name || "No name"}`,
    `Chief complaint: ${p.chief_complaint || "-"}`,
    `Diagnosis: ${p.diagnosis || "-"}`,
    `Treatment plan: ${p.treatment_plan || "-"}`,
    `Visits: ${(data.visits || []).length}`,
    `Photos: ${(p.photos || []).length}`,
    `Financial: Total ${money.total}, Paid ${money.paid}, Remaining ${money.remaining}`,
    `Last visit: ${(data.visits || [])[0]?.date || "none"}`
  ].join("\n");
  const modal = document.createElement("div");
  modal.className = "luxury-modal";
  modal.innerHTML = `
    <div class="luxury-box">
      <h2>Case Summary</h2>
      <pre style="white-space:pre-wrap;text-align:left;background:var(--bg-elevated);padding:16px;border-radius:12px;border:1px solid var(--border);font-family:inherit;color:var(--text);line-height:1.6;font-size:14px;">${safeText(summary)}</pre>
      <div class="luxury-actions">
        <button type="button" class="btn-secondary" onclick="this.closest('.luxury-modal').remove()">Close</button>
        <button type="button" class="btn-primary" onclick="navigator.clipboard.writeText(\`${safeText(summary).replace(/`/g, '\`')}\`);this.closest('.luxury-modal').remove();">Copy</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
};

// --- Consent & Prescription Documents ---
function openPremiumDocument(title, bodyHtml) {
  document.getElementById("premiumDocModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "premiumDocModal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.88);backdrop-filter:blur(16px);z-index:1000;overflow:auto;padding:70px 18px 34px;box-sizing:border-box;";
  const clinicName = currentUser?.clinic_name || "Masri Dental Clinic";
  const logo = currentUser?.clinic_logo || "";
  modal.innerHTML = `
    <div style="position:fixed;top:14px;right:14px;display:flex;gap:10px;z-index:1001;">
      <button onclick="document.getElementById('premiumDocModal').remove()" style="padding:12px 18px;border:none;border-radius:14px;background:#1f2937;color:white;font-weight:700;font-family:inherit;cursor:pointer;">Close PDF</button>
      <button onclick="window.print()" style="padding:12px 18px;border:none;border-radius:14px;background:linear-gradient(135deg,#e8c84a,#b8941f);color:#0a0a0a;font-weight:700;font-family:inherit;cursor:pointer;">Print / PDF</button>
    </div>
    <div style="max-width:800px;margin:0 auto;background:#f7f8fb;color:#111827;border-radius:24px;padding:28px;box-shadow:0 28px 80px rgba(0,0,0,0.55);font-family:Arial,sans-serif;">
      <h1 style="margin:0;font-size:30px;color:#111827;">${logo ? `<img src="${logo}" style="width:60px;height:60px;object-fit:contain;vertical-align:middle;margin-right:12px;border-radius:12px;background:white;">` : ""}${safeText(clinicName)}</h1>
      ${bodyHtml}
    </div>`;
  document.body.appendChild(modal);
}

window.closePremiumDoc = function() {
  document.getElementById("premiumDocModal")?.remove();
};

window.generateSmartConsentPro = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const type = await luxuryPrompt("Consent type", "extraction / rct / implant / crown", "extraction");
  if (!type) return;
  const body = `
    <p style="color:#b8941f;font-weight:700;margin-top:8px;">${safeText(type.toUpperCase())} Consent Form</p>
    <div style="border:1px solid #e5e7eb;border-radius:14px;padding:18px;background:white;margin:14px 0;line-height:1.6;">
      I acknowledge that the planned dental treatment, alternatives, benefits, risks, limitations, and possible complications have been explained to me. I had the chance to ask questions and agree to proceed.
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:14px;padding:18px;background:white;margin:14px 0;line-height:1.6;">
      <b>Patient:</b> ${safeText(p.name || "-")}<br>
      <b>ID:</b> ${safeText(p.case_id || p.id)}<br>
      <b>Diagnosis:</b> ${safeText(p.diagnosis || "-")}<br>
      <b>Medical alerts:</b> ${safeText(p.medical_alerts || "-")}
    </div>
    <br><br>
    <p>Patient signature: ________________________</p>
    <p>Doctor signature: ________________________</p>
    <p>Date: ________________________</p>
  `;
  openPremiumDocument("Consent Form", body);
};

window.generatePrescriptionPro = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const type = await luxuryPrompt("Prescription type", "pain / infection / extraction / implant", "pain");
  if (!type) return;
  let meds = "Analgesic as prescribed\nFollow doctor's instructions";
  if (type.toLowerCase().includes("infection")) meds = "Antibiotic as prescribed\nAnalgesic as needed\nWarm saline rinse";
  if (type.toLowerCase().includes("extraction")) meds = "Analgesic as prescribed\nPost-operative instructions\nAvoid smoking and vigorous rinsing for 24 hours";
  if (type.toLowerCase().includes("implant")) meds = "Analgesic as prescribed\nAntibiotic as prescribed if indicated\nCold packs for the first day\nFollow-up appointment";
  const body = `
    <p style="color:#b8941f;font-weight:700;margin-top:8px;">Prescription</p>
    <div style="font-size:42px;font-weight:800;color:#b8941f;margin:14px 0;">Rx</div>
    <div style="border:1px solid #e5e7eb;border-radius:14px;padding:18px;background:white;margin:14px 0;white-space:pre-wrap;font-size:16px;line-height:1.6;">${safeText(meds)}</div>
    <div style="border:1px solid #e5e7eb;border-radius:14px;padding:18px;background:white;margin:14px 0;line-height:1.6;">
      <b>Diagnosis:</b> ${safeText(p.diagnosis || "-")}<br>
      <b>Notes:</b> ${safeText(type)}
    </div>
    <br><br>
    <p>Doctor signature: ________________________</p>
  `;
  openPremiumDocument("Prescription", body);
};

// --- Lab Work ---
window.addLabWork = async function(id) {
  const item = await luxuryPrompt("Lab work item", "Crown / Bridge / Night guard");
  if (!item) return;
  const status = await luxuryPrompt("Lab status", "Sent / Waiting / Ready / Delivered", "Sent");
  const lab = JSON.parse(localStorage.getItem("clinicLab") || "[]");
  lab.push({ patientId: id, item, status: status || "Sent", created_at: new Date().toISOString() });
  localStorage.setItem("clinicLab", JSON.stringify(lab));
  await refreshPatientKeepingScroll(id);
};

window.editLabWork = async function(patientId, index) {
  const lab = JSON.parse(localStorage.getItem("clinicLab") || "[]");
  if (!lab[index]) return;
  const item = await luxuryPrompt("Lab work", "Crown / Bridge / Night guard", lab[index].item || "");
  if (!item) return;
  const status = await luxuryPrompt("Lab status", "Sent / Waiting / Ready / Delivered", lab[index].status || "Sent");
  if (!status) return;
  lab[index].item = item;
  lab[index].status = status;
  lab[index].updated_at = new Date().toISOString();
  localStorage.setItem("clinicLab", JSON.stringify(lab));
  await refreshPatientKeepingScroll(patientId);
};

window.deleteLabWork = async function(patientId, index) {
  const lab = JSON.parse(localStorage.getItem("clinicLab") || "[]");
  if (!lab[index]) return;
  if (!(await luxuryConfirm("Delete lab work?"))) return;
  lab.splice(index, 1);
  localStorage.setItem("clinicLab", JSON.stringify(lab));
  await refreshPatientKeepingScroll(patientId);
};

// --- Before/After ---
window.showBeforeAfter = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const photos = (p.photos || []).map(photoUrl).filter(Boolean);
  if (photos.length < 2) return alert("Need at least 2 photos for comparison.");

  let beforeIdx = 0;
  let afterIdx = 1;
  let showing = "before";
  let autoTimer = null;

  const modal = document.createElement("div");
  modal.className = "luxury-modal ba-modal";
  modal.innerHTML = `
    <div class="luxury-box ba-box">
      <button type="button" class="ba-x" aria-label="Close">×</button>
      <h2>Before / After</h2>

      <div class="ba-fade-stage">
        <span class="ba-label before">Before</span>
        <span class="ba-label after">After</span>
        <img id="baFadeImg" src="${photos[beforeIdx]}" alt="Before / After comparison">
      </div>

      <div class="ba-controls">
        <button class="btn-secondary" id="baPrevBefore">Prev Before</button>
        <button class="btn-secondary" id="baNextAfter">Next After</button>
        <button class="btn-primary" id="baAuto">Auto Play</button>
        <button class="btn-secondary" id="baClose">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const img = modal.querySelector("#baFadeImg");
  const beforeLabel = modal.querySelector(".ba-label.before");
  const afterLabel = modal.querySelector(".ba-label.after");

  const showPhoto = (src, mode) => {
    showing = mode;
    img.classList.add("is-changing");
    setTimeout(() => {
      img.src = src;
      beforeLabel.classList.toggle("active", mode === "before");
      afterLabel.classList.toggle("active", mode === "after");
      img.classList.remove("is-changing");
    }, 180);
  };

  showPhoto(photos[beforeIdx], "before");

  const stopAuto = () => {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = null;
  };

  modal.querySelector("#baPrevBefore").onclick = (e) => {
    e.stopPropagation();
    stopAuto();
    beforeIdx = (beforeIdx - 1 + photos.length) % photos.length;
    if (beforeIdx === afterIdx) beforeIdx = (beforeIdx - 1 + photos.length) % photos.length;
    showPhoto(photos[beforeIdx], "before");
  };

  modal.querySelector("#baNextAfter").onclick = (e) => {
    e.stopPropagation();
    stopAuto();
    afterIdx = (afterIdx + 1) % photos.length;
    if (afterIdx === beforeIdx) afterIdx = (afterIdx + 1) % photos.length;
    showPhoto(photos[afterIdx], "after");
  };

  modal.querySelector("#baAuto").onclick = (e) => {
    e.stopPropagation();
    stopAuto();
    autoTimer = setInterval(() => {
      if (showing === "before") showPhoto(photos[afterIdx], "after");
      else showPhoto(photos[beforeIdx], "before");
    }, 1700);
  };

  const close = () => {
    stopAuto();
    modal.remove();
  };

  modal.querySelector("#baClose").onclick = (e) => { e.stopPropagation(); close(); };
  modal.querySelector(".ba-x").onclick = (e) => { e.stopPropagation(); close(); };
  modal.querySelector(".ba-box").onclick = (e) => e.stopPropagation();
  modal.onclick = close;
};

// --- QR Code ---
window.showQR = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found");
  const modal = $("qrModal");
  const qrTarget = $("qrcode");
  qrTarget.innerHTML = "";
  const qrText = `${location.origin}${location.pathname}?patient=${p.id}`;
  if (window.QRCode) {
    new QRCode(qrTarget, { text: qrText, width: 200, height: 200 });
  } else {
    qrTarget.innerHTML = `<p style="color:#111;word-break:break-all;font-size:12px;">${safeText(qrText)}</p>`;
  }
  modal.classList.remove("hidden");
};

// --- Scanner ---
async function startScan() {
  if (!window.Html5Qrcode) return alert("QR scanner library not loaded");
  try {
    $("startScan").classList.add("hidden");
    $("stopScan").classList.remove("hidden");
    scanner = new Html5Qrcode("reader");
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, decodedText => {
      stopScan();
      try {
        const url = new URL(decodedText);
        const patientId = url.searchParams.get("patient");
        if (patientId) openPatient(patientId); else alert("Invalid QR code");
      } catch { alert("Invalid QR code"); }
    });
  } catch (err) { alert("Camera failed: " + err.message); stopScan(); }
}

async function stopScan() {
  try { if (scanner) { await scanner.stop(); scanner.clear(); scanner = null; } } catch {}
  $("startScan")?.classList.remove("hidden");
  $("stopScan")?.classList.add("hidden");
}

// --- Backup & Restore ---
window.backupData = function() {
  const backup = { exported_at: new Date().toISOString(), clinic: currentUser?.clinic_name || "Masri Dental Clinic", user: currentUser, patients };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dental-clinic-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

window.restoreBackup = function() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm("Restore backup? This will add patients from the backup file.")) return;
    try {
      const backup = JSON.parse(await file.text());
      if (!backup.patients || !Array.isArray(backup.patients)) return alert("Invalid backup file.");
      for (const p of backup.patients) {
        await api("patients", { method: "POST", body: JSON.stringify({
          owner_id: currentUser.role === "admin" ? (p.owner_id || currentUser.id) : currentUser.id,
          case_id: p.case_id || makeId(),
          name: p.name || "", phone: p.phone || "", age: p.age || "", gender: p.gender || "",
          chief_complaint: p.chief_complaint || "", medical_alerts: p.medical_alerts || "",
          diagnosis: p.diagnosis || "", treatment_plan: p.treatment_plan || "",
          progress_notes: p.progress_notes || "", photos: p.photos || []
        }) });
      }
      alert("Backup restored successfully.");
      await loadPatients();
      showPage("patients");
    } catch (err) { alert("Restore failed: " + err.message); }
  };
  input.click();
};

// --- Settings ---
window.saveClinicBranding = async function() {
  try {
    const clinicName = $("clinicName")?.value?.trim() || "";
    let logoUrl = currentUser.clinic_logo || "";
    const logoFile = $("clinicLogo")?.files?.[0];
    if (logoFile) {
      try {
        const clean = logoFile.name.replace(/[^a-zA-Z0-9.]/g, "-");
        const path = `${currentUser.id}/logo-${Date.now()}-${clean}`;
        logoUrl = await uploadToBucket(LOGO_BUCKET, path, logoFile, logoFile.type || "image/png");
      } catch {}
    }
    await api(`clinic_users?id=eq.${currentUser.id}`, { method: "PATCH", body: JSON.stringify({ clinic_name: clinicName, clinic_logo: logoUrl }) });
    currentUser.clinic_name = clinicName;
    currentUser.clinic_logo = logoUrl;
    saveUser(currentUser);
    applyUserBar();
    alert("Branding saved!");
  } catch (err) { alert("Save failed: " + err.message); }
};

// --- Profile ---
window.openDoctorProfile = async function() {
  if (!currentUser) return;
  const modal = document.createElement("div");
  modal.className = "luxury-modal";
  modal.innerHTML = `
    <div class="luxury-box">
      <h2>Doctor Profile</h2>
      <div class="kv"><b>Name</b><span>${safeText(currentUser.full_name || currentUser.username || "-")}</span></div>
      <div class="kv"><b>Username</b><span>${safeText(currentUser.username || "-")}</span></div>
      <div class="kv"><b>Role</b><span>${safeText((currentUser.role || "doctor").toUpperCase())}</span></div>
      <div class="signature-display">${signatureImgHTML()}</div>
      <div class="field"><label>Signature display</label><input type="file" accept="image/*" onchange="uploadDoctorSignature(this.files[0])"></div>
      <div class="actions-bar" style="margin-top:16px;">
        <button class="btn-primary" onclick="closeThisModal(this);setTimeout(()=>editProfile(),200)">Edit Profile</button>
        <button class="btn-secondary" onclick="closeThisModal(this);setTimeout(()=>changeMyPassword(),200)">Change Password</button>
        <button class="btn-secondary" onclick="this.closest('.luxury-modal').remove()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
};

window.closeThisModal = function(el) { el.closest(".luxury-modal").remove(); };

window.editProfile = async function() {
  const full_name = await luxuryPrompt("Doctor name", "Full name", currentUser.full_name || "");
  if (!full_name) return;
  const username = await luxuryPrompt("Username", "Any username", currentUser.username || "");
  if (!username) return;
  const cleanUsername = username.trim();
  try {
    const existing = await api(`clinic_users?select=id&username=eq.${encodeURIComponent(cleanUsername)}`);
    if (existing.some(u => u.id !== currentUser.id)) return alert("Username already exists.");
    await api(`clinic_users?id=eq.${currentUser.id}`, { method: "PATCH", body: JSON.stringify({ full_name: full_name.trim(), username: cleanUsername }) });
    currentUser.full_name = full_name.trim();
    currentUser.username = cleanUsername;
    saveUser(currentUser);
    applyUserBar();
    alert("Profile updated!");
  } catch (err) { alert("Update failed: " + err.message); }
};

window.changeMyPassword = async function() {
  const oldPass = await luxuryPrompt("Current password");
  if (!oldPass) return;
  const newPass = await luxuryPrompt("New password");
  if (!newPass) return;
  const confirmPass = await luxuryPrompt("Confirm new password");
  if (!confirmPass || newPass.trim() !== confirmPass.trim()) return alert("Passwords don't match.");
  if (newPass.trim().length < 4) return alert("Password must be at least 4 characters.");
  try {
    const res = await fetch(`${API_BASE}?action=changePassword`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken || ""}` },
      body: JSON.stringify({ oldPassword: oldPass.trim(), newPassword: newPass.trim() })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Update failed");
    alert("Password updated!");
  } catch (err) { alert("Update failed: " + err.message); }
};

// --- User Management ---
window.manageUsers = async function() {
  if (!currentUser || currentUser.role !== "admin") return alert("Only admin can manage users.");
  const users = await api("clinic_users?select=*&order=created_at.desc");
  const modal = document.createElement("div");
  modal.className = "luxury-modal";
  modal.innerHTML = `
    <div class="luxury-box">
      <h2>Manage Users</h2>
      ${users.map(u => `
        <div class="kv" style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div><b>${safeText(u.full_name || u.username)}</b><br><small class="muted">${safeText(u.username)} - ${safeText((u.role || "doctor").toUpperCase())}</small></div>
          <div style="display:flex;gap:8px;">
            ${u.id !== currentUser.id ? `<button class="btn-danger" style="font-size:12px;padding:8px 14px;" onclick="deleteUser('${u.id}')">Delete</button>` : "<span class='pill'>You</span>"}
          </div>
        </div>
      `).join("")}
      <div class="actions-bar" style="margin-top:14px;">
        <button class="btn-secondary" style="width:100%;" onclick="this.closest('.luxury-modal').remove()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
};

window.deleteUser = async function(id) {
  if (!(await luxuryConfirm("Delete user?"))) return;
  await api(`clinic_users?id=eq.${id}`, { method: "DELETE" });
  alert("User deleted.");
  document.querySelector(".luxury-modal")?.remove();
};


window.exportReceipt = function(id, index) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const data = parseClinicData(p.progress_notes);
  const pay = (data.payments || [])[index];
  if (!pay) return alert("Receipt not found.");
  const extras = doctorExtras();
  const clinicName = currentUser?.clinic_name || "Masri Dental Clinic";
  const logo = currentUser?.clinic_logo || "";
  const discountValue = Number(pay.total || 0) * Number(pay.discount || 0) / 100;
  const net = Math.max(0, Number(pay.total || 0) - discountValue);
  const remaining = Math.max(0, net - Number(pay.paid || 0));
  const win = window.open("", "_blank");
  win.document.write(`<html><head><title>Receipt - ${safeText(p.name)}</title><style>body{margin:0;font-family:Arial,sans-serif;color:#111827;${pdfPatternStyle(extras.pattern)}}.receipt{max-width:760px;margin:auto;padding:28px}.top{background:#111827;color:white;border-radius:20px;padding:22px;margin-bottom:16px}.top h1{margin:0}.logo{width:58px;height:58px;object-fit:contain;background:white;border-radius:14px;padding:6px;margin-bottom:8px}.box{background:white;border:1px solid #e5e7eb;border-radius:16px;padding:18px;margin-bottom:12px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding:10px 0}.row:last-child{border-bottom:0}.total{font-size:20px;font-weight:bold}.actions{position:sticky;top:0;background:white;padding:10px;display:flex;gap:8px;justify-content:flex-end}.actions button{padding:10px 14px;border:0;border-radius:12px;font-weight:bold;cursor:pointer}.print{background:#d4af37}.close{background:#111827;color:white}.signature-img{max-width:180px;max-height:70px}.signature-line{width:180px;border-top:2px solid #111827;margin-top:46px}@media print{.actions{display:none}.receipt{padding:0}}</style></head><body><div class="actions"><button class="print" onclick="window.print()">Print / PDF</button><button class="close" onclick="window.close()">Close PDF</button></div><div class="receipt"><div class="top">${logo?`<img class="logo" src="${logo}">`:""}<h1>${safeText(clinicName)}</h1><p>Payment Receipt</p></div><div class="box"><div class="row"><b>Patient</b><span>${safeText(p.name||"-")}</span></div><div class="row"><b>Case ID</b><span>${safeText(p.case_id||p.id)}</span></div><div class="row"><b>Procedure</b><span>${safeText(pay.procedure||pay.note||"Procedure")}</span></div><div class="row"><b>Date</b><span>${safeText(pay.date||"")}</span></div></div><div class="box"><div class="row"><b>Total</b><span>${Number(pay.total||0)}</span></div><div class="row"><b>Discount</b><span>${Number(pay.discount||0)}% (${discountValue})</span></div><div class="row"><b>Net</b><span>${net}</span></div><div class="row total"><b>Paid</b><span>${Number(pay.paid||0)}</span></div><div class="row"><b>Remaining</b><span>${remaining}</span></div></div><div class="box"><b>Doctor signature</b><div>${signatureImgHTML()}</div></div></div></body></html>`);
  win.document.close();
};

// --- PDF Export ---
window.exportPDF = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const data = parseClinicData(p.progress_notes);
  const money = paymentTotals(data);
  const clinicName = currentUser?.clinic_name || "Masri Dental Clinic";
  const logo = currentUser?.clinic_logo || "";
  const win = window.open("", "_blank");
  win.document.write(`<html><head><title>${safeText(p.name)} - Dental Report</title>
    <style>body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111827;${pdfPatternStyle(doctorExtras().pattern)}}
    .report{max-width:800px;margin:auto;padding:28px}
    .header{background:linear-gradient(135deg,#070b10,#111827);color:white;border-radius:20px;padding:24px;margin-bottom:20px}
    .header h1{margin:0;font-size:28px}.header p{margin:8px 0 0;color:#d4af37;font-weight:700}
    .logo{width:64px;height:64px;object-fit:contain;margin-bottom:10px;background:white;border-radius:14px;padding:6px}
    .section{background:white;border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid #e5e7eb}
    .section h2{margin:0 0 12px;font-size:20px;color:#111827;border-bottom:2px solid #d4af37;padding-bottom:8px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .item{background:#f9fafb;border-radius:12px;padding:12px;border:1px solid #e5e7eb}
    .label{display:block;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:4px}
    .value{font-size:14px}.visit{padding:10px;background:#f9fafb;border-radius:10px;margin-bottom:8px;border-left:3px solid #d4af37}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .moneyBox{background:#111827;color:white;border-radius:14px;padding:14px;text-align:center}
    .moneyBox b{color:#d4af37;display:block;margin-bottom:4px;font-size:11px}
    .footer{text-align:center;color:#6b7280;margin-top:20px;font-size:12px}.actions{position:sticky;top:0;background:white;padding:10px;display:flex;gap:8px;justify-content:flex-end}.actions button{padding:10px 14px;border:0;border-radius:12px;font-weight:bold;cursor:pointer}.print{background:#d4af37}.close{background:#111827;color:white}.signature-img{max-width:180px;max-height:70px}.signature-line{width:180px;border-top:2px solid #111827;margin-top:46px}
    @media print{.actions{display:none}body{background:white}.report{padding:0}.section,.header{break-inside:avoid}}
    </style></head><body><div class="actions"><button class="print" onclick="window.print()">Print / PDF</button><button class="close" onclick="window.close()">Close PDF</button></div><div class="report">
    <div class="header">${logo?`<img class="logo" src="${logo}">`:""}<h1>${safeText(clinicName)}</h1><p>Patient Report</p></div>
    <div class="section"><h2>Patient Information</h2>
    <div class="grid"><div class="item"><span class="label">Name</span><span class="value">${safeText(p.name||"-")}</span></div>
    <div class="item"><span class="label">ID</span><span class="value">${safeText(p.case_id||p.id)}</span></div>
    <div class="item"><span class="label">Phones</span><span class="value">${safeText(allPatientPhones(p, data).join(" / ") || "-")}</span></div>
    <div class="item"><span class="label">Age/Gender</span><span class="value">${safeText(p.age||"-")} / ${safeText(p.gender||"-")}</span></div>
    <div class="item"><span class="label">Websites</span><span class="value">${safeText(allPatientWebsites(data).join(" / ") || "-")}</span></div></div></div>
    <div class="section"><h2>Clinical</h2>
    <div class="item" style="margin-bottom:8px"><span class="label">Chief Complaint</span><span class="value">${safeText(p.chief_complaint||"-")}</span></div>
    <div class="item" style="margin-bottom:8px"><span class="label">Medical Alerts</span><span class="value">${safeText(p.medical_alerts||"-")}</span></div>
    <div class="item" style="margin-bottom:8px"><span class="label">Diagnosis</span><span class="value">${safeText(p.diagnosis||"-")}</span></div>
    <div class="item"><span class="label">Treatment Plan</span><span class="value">${safeText(p.treatment_plan||"-")}</span></div></div>
    <div class="section"><h2>Financial Summary</h2><div class="summary">
    <div class="moneyBox"><b>Total</b>${money.total}</div>
    <div class="moneyBox"><b>Discount</b>${money.discount}</div>
    <div class="moneyBox"><b>Paid</b>${money.paid}</div>
    <div class="moneyBox"><b>Remaining</b>${money.remaining}</div></div></div>
    <div class="section"><h2>Visits (${(data.visits||[]).length})</h2>
    ${(data.visits||[]).map(v=>`<div class="visit"><b>${safeText(v.date||"")}</b> - ${safeText(v.treatment||"Visit")}<br>${safeText(v.note||"-")}</div>`).join("")||"<p>No visits recorded.</p>"}</div>
    <div class="section"><h2>Doctor Information</h2><div class="item"><span class="label">Doctor</span><span class="value">${safeText(currentUser?.full_name || currentUser?.username || "Doctor")}</span></div><div class="item"><span class="label">Specialty</span><span class="value">${safeText(doctorExtras().specialty || "General Dentist")}</span></div><div class="item"><span class="label">Signature</span><span class="value">${signatureImgHTML()}</span></div></div>
    <div class="footer">Generated on ${new Date().toLocaleString()}</div>
    </div></body></html>`);
  win.document.close();
};

// ============================================
// EVENT LISTENERS & INIT
// ============================================

// Form submit
$("patientForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!canEdit()) return alert("You don't have permission to save patients");
  $("saveBtn").disabled = true;
  $("saveBtn").textContent = "Saving...";
  try {
    const id = $("rowId").value;
    const oldPatient = id ? patients.find(p => p.id === id) : null;
    const data = getFormData(oldPatient);
    let saved;
    if (id) {
      saved = await api(`patients?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(data) });
      saved = saved[0];
    } else {
      saved = await api("patients", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(data) });
      saved = saved[0];
    }
    if (pendingFiles.length) {
      $("saveBtn").textContent = "Uploading photos...";
      const uploaded = await uploadPhotos(saved.id);
      const allPhotos = [...(saved.photos || []), ...uploaded];
      await api(`patients?id=eq.${saved.id}`, { method: "PATCH", body: JSON.stringify({ photos: allPhotos }) });
    }
    pendingFiles = [];
    $("patientForm").reset();
    fillForm();
    await loadPatients();
    showPage("patients");
  } catch (err) {
    alert("Save failed: " + err.message);
  } finally {
    $("saveBtn").disabled = false;
    $("saveBtn").textContent = "Save Patient";
  }
});

// Photo preview
$("photos")?.addEventListener("change", e => {
  pendingFiles = [...e.target.files];
  $("preview").innerHTML = pendingFiles.map(file => `<img src="${URL.createObjectURL(file)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;border:1px solid var(--border);">`).join("");
});

// Modal closes
$("closePhoto")?.addEventListener("click", () => $("photoModal").classList.add("hidden"));
$("closeQr")?.addEventListener("click", () => $("qrModal").classList.add("hidden"));
$("backBtn")?.addEventListener("click", () => showPage("patients"));
$("refreshBtn")?.addEventListener("click", loadPatients);
$("search")?.addEventListener("input", renderPatients);
$("startScan")?.addEventListener("click", startScan);
$("stopScan")?.addEventListener("click", stopScan);
$("closeViewer")?.addEventListener("click", closePhotoViewer);
$("nextPhoto")?.addEventListener("click", nextPhoto);
$("prevPhoto")?.addEventListener("click", prevPhoto);

// Tabs
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => showPage(tab.dataset.page));
});

// Delegated click handlers
document.addEventListener("click", function(e) {
  const openBtn = e.target.closest("[data-open-patient]");
  if (openBtn) { e.preventDefault(); e.stopPropagation(); openPatient(openBtn.dataset.openPatient); return; }
  const editBtn = e.target.closest("[data-edit-patient]");
  if (editBtn) { e.preventDefault(); e.stopPropagation(); editPatient(editBtn.dataset.editPatient); return; }
  const qrBtn = e.target.closest("[data-qr-patient]");
  if (qrBtn) { e.preventDefault(); e.stopPropagation(); showQR(qrBtn.dataset.qrPatient); return; }
  const waBtn = e.target.closest("[data-wa-patient]");
  if (waBtn) { e.preventDefault(); e.stopPropagation(); openWhatsAppReminder(waBtn.dataset.waPatient); }
});

// Tooth modal surface buttons
document.querySelectorAll(".surface-btn").forEach(btn => {
  btn.addEventListener("click", () => btn.classList.toggle("active"));
});

// Photo viewer keyboard
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    $("photoModal")?.classList.add("hidden");
    $("qrModal")?.classList.add("hidden");
    $("toothModal")?.classList.add("hidden");
    closePhotoViewer();
    closeSimplePhotoViewer();
    document.querySelector(".luxury-modal")?.remove();
    document.getElementById("premiumDocModal")?.remove();
  }
});

// Photo viewer functions
function openPhotoViewer(index = 0) {
  if (!currentPhotoList.length) return;
  currentPhotoIndex = Math.max(0, Math.min(index, currentPhotoList.length - 1));
  const viewer = $("photoViewer");
  const img = $("viewerImage");
  if (viewer && img) {
    img.src = currentPhotoList[currentPhotoIndex];
    viewer.classList.remove("hidden");
  }
}

function closePhotoViewer() {
  $("photoViewer")?.classList.add("hidden");
}

function nextPhoto() {
  if (!currentPhotoList.length) return;
  currentPhotoIndex = (currentPhotoIndex + 1) % currentPhotoList.length;
  const img = $("viewerImage");
  if (img) img.src = currentPhotoList[currentPhotoIndex];
}

function prevPhoto() {
  if (!currentPhotoList.length) return;
  currentPhotoIndex = (currentPhotoIndex - 1 + currentPhotoList.length) % currentPhotoList.length;
  const img = $("viewerImage");
  if (img) img.src = currentPhotoList[currentPhotoIndex];
}

// --- Menu button ---
$("menuBtn")?.addEventListener("click", openClinicMenu);

// --- Auto Refresh ---
function startAutoRefresh() {
  if (window.__clinicAutoRefresh) return;
  window.__clinicAutoRefresh = setInterval(() => {
    if (document.visibilityState === "visible") loadPatients();
  }, 45000);
}

// --- Init ---
window.addEventListener("load", async () => {
  try {
    applySavedTheme();
    if (location.search.includes("logout=1")) {
      localStorage.removeItem("clinicUser");
      showLoginScreen();
      return;
    }
    currentUser = getSavedUser();
    authToken = localStorage.getItem("clinicToken");
    if (!currentUser || !currentUser.id || !currentUser.role || !authToken) {
      localStorage.removeItem("clinicUser");
      localStorage.removeItem("clinicToken");
      showLoginScreen();
      return;
    }
    applyCustomAccent();
    applyUserBar();
    enhanceHeader();
    await loadPatients();
    startAutoRefresh();
  } catch (err) {
    document.body.innerHTML = `<div style="padding:40px;color:#ef4444;font-family:'DM Sans',sans-serif;"><h2>Error</h2><p>${safeText(err.message)}</p></div>`;
  }
});

// =========================================================
// CLEAN SOURCE REPAIR 2026-06-28
// Single source-level repair for menu, language, and photos.
// This replaces the old patch stacking approach.
// =========================================================
(function cleanSourceRepair(){
  'use strict';

  const photoState = { patientId: null, filter: 'clinical', beforeIndex: 0, afterIndex: 1, blend: 50 };

  function byId(id){ return document.getElementById(id); }
  function htmlSafe(v){ return (typeof safeText === 'function') ? safeText(v) : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function getPatients(){ return Array.isArray(window.patients) ? window.patients : patients; }
  function findPatient(id){ return getPatients().find(p => String(p.id) === String(id)); }
  function getPhotoUrl(photo){ return typeof photo === 'string' ? photo : (photo?.url || photo?.path || ''); }
  function isRtlLang(code){ return ['ar','he','ur','fa','ps','ku','sd','ug','yi'].includes(code); }

  function notify(message){
    let el = byId('cleanToast');
    if (!el){
      el = document.createElement('div');
      el.id = 'cleanToast';
      el.className = 'clean-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(notify._t);
    notify._t = setTimeout(() => el.classList.remove('show'), 1700);
  }

  const LANGS = {
    en:{native:'English', dir:'ltr', dashboard:'Dashboard', patients:'Patients', addPatient:'Add Patient', scanQR:'Scan QR', settings:'Settings', profile:'Profile', manageUsers:'Manage Users', logout:'Logout', menu:'Menu', search:'Search by name, phone, ID, or diagnosis...', photos:'Photos / X-rays', clinical:'Clinical', xray:'X-ray', beforeAfter:'Before / After', general:'General', before:'Before', after:'After', chooseLanguage:'Language', languageHelp:'Choose the language for the app interface.', theme:'Theme color', pdf:'PDF style', doctorCard:'Doctor card', signature:'Draw signature', backup:'Backup', restore:'Restore', photoOptions:'Photo options', viewPhoto:'View photo', markAs:'Mark as', selectBefore:'Choose before photo', selectAfter:'Choose after photo', blendHint:'Move the bar to blend the two photos with a soft transition.'},
    ar:{native:'العربية', dir:'rtl', dashboard:'لوحة التحكم', patients:'المرضى', addPatient:'إضافة مريض', scanQR:'مسح QR', settings:'الإعدادات', profile:'الملف الشخصي', manageUsers:'إدارة المستخدمين', logout:'تسجيل الخروج', menu:'القائمة', search:'ابحث بالاسم أو الهاتف أو الكود أو التشخيص...', photos:'الصور / الأشعة', clinical:'سريري', xray:'أشعة', beforeAfter:'قبل / بعد', general:'عام', before:'قبل', after:'بعد', chooseLanguage:'اللغة', languageHelp:'اختر لغة واجهة التطبيق.', theme:'لون التطبيق', pdf:'شكل PDF', doctorCard:'بطاقة الطبيب', signature:'رسم التوقيع', backup:'نسخة احتياطية', restore:'استرجاع', photoOptions:'خيارات الصورة', viewPhoto:'عرض الصورة', markAs:'تحديد كـ', selectBefore:'اختر صورة قبل', selectAfter:'اختر صورة بعد', blendHint:'حرك الشريط لدمج الصورتين بانتقال ناعم.'},
    fr:{native:'Français', dir:'ltr', dashboard:'Tableau', patients:'Patients', addPatient:'Ajouter patient', scanQR:'Scanner QR', settings:'Réglages', profile:'Profil', manageUsers:'Utilisateurs', logout:'Déconnexion', menu:'Menu', search:'Rechercher nom, téléphone, ID ou diagnostic...', photos:'Photos / Radios', clinical:'Clinique', xray:'Radio', beforeAfter:'Avant / Après', general:'Général', before:'Avant', after:'Après', chooseLanguage:'Langue', languageHelp:"Choisissez la langue de l’interface.", theme:'Couleur', pdf:'Style PDF', doctorCard:'Carte médecin', signature:'Signature', backup:'Sauvegarde', restore:'Restaurer', photoOptions:'Options photo', viewPhoto:'Voir photo', markAs:'Marquer comme', selectBefore:'Choisir avant', selectAfter:'Choisir après', blendHint:'Déplacez la barre pour fusionner les photos.'},
    es:{native:'Español', dir:'ltr', dashboard:'Panel', patients:'Pacientes', addPatient:'Añadir paciente', scanQR:'Escanear QR', settings:'Ajustes', profile:'Perfil', manageUsers:'Usuarios', logout:'Salir', menu:'Menú', search:'Buscar nombre, teléfono, ID o diagnóstico...', photos:'Fotos / Rayos X', clinical:'Clínica', xray:'Rayos X', beforeAfter:'Antes / Después', general:'General', before:'Antes', after:'Después', chooseLanguage:'Idioma', languageHelp:'Elige el idioma de la interfaz.', theme:'Color', pdf:'Estilo PDF', doctorCard:'Tarjeta doctor', signature:'Firma', backup:'Copia', restore:'Restaurar', photoOptions:'Opciones de foto', viewPhoto:'Ver foto', markAs:'Marcar como', selectBefore:'Elegir antes', selectAfter:'Elegir después', blendHint:'Mueve la barra para mezclar las fotos.'},
    de:{native:'Deutsch', dir:'ltr', dashboard:'Dashboard', patients:'Patienten', addPatient:'Patient hinzufügen', scanQR:'QR scannen', settings:'Einstellungen', profile:'Profil', manageUsers:'Benutzer', logout:'Abmelden', menu:'Menü', search:'Name, Telefon, ID oder Diagnose suchen...', photos:'Fotos / Röntgen', clinical:'Klinisch', xray:'Röntgen', beforeAfter:'Vorher / Nachher', general:'Allgemein', before:'Vorher', after:'Nachher', chooseLanguage:'Sprache', languageHelp:'Wählen Sie die Sprache der App.', theme:'Farbe', pdf:'PDF-Stil', doctorCard:'Arztkarte', signature:'Unterschrift', backup:'Backup', restore:'Wiederherstellen', photoOptions:'Fotooptionen', viewPhoto:'Foto anzeigen', markAs:'Markieren als', selectBefore:'Vorher wählen', selectAfter:'Nachher wählen', blendHint:'Bewegen Sie den Regler für weichen Übergang.'},
    it:{native:'Italiano', dir:'ltr', dashboard:'Cruscotto', patients:'Pazienti', addPatient:'Aggiungi paziente', scanQR:'Scansiona QR', settings:'Impostazioni', profile:'Profilo', manageUsers:'Utenti', logout:'Esci', menu:'Menu', search:'Cerca nome, telefono, ID o diagnosi...', photos:'Foto / Radiografie', clinical:'Clinica', xray:'Radiografia', beforeAfter:'Prima / Dopo', general:'Generale', before:'Prima', after:'Dopo', chooseLanguage:'Lingua', languageHelp:'Scegli la lingua dell’interfaccia.', theme:'Colore', pdf:'Stile PDF', doctorCard:'Scheda medico', signature:'Firma', backup:'Backup', restore:'Ripristina', photoOptions:'Opzioni foto', viewPhoto:'Vedi foto', markAs:'Segna come', selectBefore:'Scegli prima', selectAfter:'Scegli dopo', blendHint:'Muovi la barra per fondere le foto.'},
    pt:{native:'Português', dir:'ltr', dashboard:'Painel', patients:'Pacientes', addPatient:'Adicionar paciente', scanQR:'Ler QR', settings:'Configurações', profile:'Perfil', manageUsers:'Usuários', logout:'Sair', menu:'Menu', search:'Pesquisar nome, telefone, ID ou diagnóstico...', photos:'Fotos / Raios X', clinical:'Clínica', xray:'Raio X', beforeAfter:'Antes / Depois', general:'Geral', before:'Antes', after:'Depois', chooseLanguage:'Idioma', languageHelp:'Escolha o idioma da interface.', theme:'Cor', pdf:'Estilo PDF', doctorCard:'Cartão médico', signature:'Assinatura', backup:'Backup', restore:'Restaurar', photoOptions:'Opções da foto', viewPhoto:'Ver foto', markAs:'Marcar como', selectBefore:'Escolher antes', selectAfter:'Escolher depois', blendHint:'Mova a barra para misturar as fotos.'},
    tr:{native:'Türkçe', dir:'ltr', dashboard:'Panel', patients:'Hastalar', addPatient:'Hasta ekle', scanQR:'QR tara', settings:'Ayarlar', profile:'Profil', manageUsers:'Kullanıcılar', logout:'Çıkış', menu:'Menü', search:'Ad, telefon, ID veya teşhis ara...', photos:'Fotoğraflar / Röntgen', clinical:'Klinik', xray:'Röntgen', beforeAfter:'Önce / Sonra', general:'Genel', before:'Önce', after:'Sonra', chooseLanguage:'Dil', languageHelp:'Uygulama arayüz dilini seçin.', theme:'Renk', pdf:'PDF stili', doctorCard:'Doktor kartı', signature:'İmza', backup:'Yedek', restore:'Geri yükle', photoOptions:'Foto seçenekleri', viewPhoto:'Fotoğrafı aç', markAs:'Olarak işaretle', selectBefore:'Önce seç', selectAfter:'Sonra seç', blendHint:'Fotoğrafları yumuşak geçişle karıştırın.'},
    ru:{native:'Русский', dir:'ltr', dashboard:'Панель', patients:'Пациенты', addPatient:'Добавить пациента', scanQR:'QR скан', settings:'Настройки', profile:'Профиль', manageUsers:'Пользователи', logout:'Выйти', menu:'Меню', search:'Поиск имени, телефона, ID или диагноза...', photos:'Фото / Рентген', clinical:'Клинические', xray:'Рентген', beforeAfter:'До / После', general:'Общие', before:'До', after:'После', chooseLanguage:'Язык', languageHelp:'Выберите язык интерфейса.', theme:'Цвет', pdf:'Стиль PDF', doctorCard:'Карта врача', signature:'Подпись', backup:'Резерв', restore:'Восстановить', photoOptions:'Параметры фото', viewPhoto:'Открыть фото', markAs:'Отметить как', selectBefore:'Выбрать до', selectAfter:'Выбрать после', blendHint:'Передвиньте ползунок для мягкого перехода.'},
    hi:{native:'हिन्दी', dir:'ltr', dashboard:'डैशबोर्ड', patients:'मरीज़', addPatient:'मरीज़ जोड़ें', scanQR:'QR स्कैन', settings:'सेटिंग्स', profile:'प्रोफ़ाइल', manageUsers:'यूज़र', logout:'लॉग आउट', menu:'मेनू', search:'नाम, फोन, ID या निदान खोजें...', photos:'फोटो / एक्स-रे', clinical:'क्लिनिकल', xray:'एक्स-रे', beforeAfter:'पहले / बाद', general:'सामान्य', before:'पहले', after:'बाद', chooseLanguage:'भाषा', languageHelp:'ऐप इंटरफ़ेस की भाषा चुनें।', theme:'रंग', pdf:'PDF शैली', doctorCard:'डॉक्टर कार्ड', signature:'हस्ताक्षर', backup:'बैकअप', restore:'रीस्टोर', photoOptions:'फोटो विकल्प', viewPhoto:'फोटो देखें', markAs:'चिह्नित करें', selectBefore:'पहले चुनें', selectAfter:'बाद चुनें', blendHint:'सॉफ्ट ट्रांज़िशन के लिए बार चलाएं।'},
    ur:{native:'اردو', dir:'rtl', dashboard:'ڈیش بورڈ', patients:'مریض', addPatient:'مریض شامل کریں', scanQR:'QR اسکین', settings:'ترتیبات', profile:'پروفائل', manageUsers:'صارفین', logout:'لاگ آؤٹ', menu:'مینو', search:'نام، فون، ID یا تشخیص تلاش کریں...', photos:'تصاویر / ایکس رے', clinical:'کلینیکل', xray:'ایکس رے', beforeAfter:'پہلے / بعد', general:'عام', before:'پہلے', after:'بعد', chooseLanguage:'زبان', languageHelp:'ایپ انٹرفیس کی زبان منتخب کریں۔', theme:'رنگ', pdf:'PDF انداز', doctorCard:'ڈاکٹر کارڈ', signature:'دستخط', backup:'بیک اپ', restore:'بحال', photoOptions:'تصویر کے اختیارات', viewPhoto:'تصویر دیکھیں', markAs:'نشان لگائیں', selectBefore:'پہلے منتخب کریں', selectAfter:'بعد منتخب کریں', blendHint:'نرم منتقلی کے لیے بار حرکت دیں۔'},
    zh:{native:'中文', dir:'ltr', dashboard:'仪表板', patients:'患者', addPatient:'添加患者', scanQR:'扫描 QR', settings:'设置', profile:'资料', manageUsers:'用户', logout:'退出', menu:'菜单', search:'搜索姓名、电话、ID 或诊断...', photos:'照片 / X光', clinical:'临床', xray:'X光', beforeAfter:'前 / 后', general:'普通', before:'前', after:'后', chooseLanguage:'语言', languageHelp:'选择应用界面语言。', theme:'颜色', pdf:'PDF 样式', doctorCard:'医生卡', signature:'签名', backup:'备份', restore:'恢复', photoOptions:'照片选项', viewPhoto:'查看照片', markAs:'标记为', selectBefore:'选择前照', selectAfter:'选择后照', blendHint:'移动滑杆以柔和混合两张照片。'},
    ja:{native:'日本語', dir:'ltr', dashboard:'ダッシュボード', patients:'患者', addPatient:'患者を追加', scanQR:'QRスキャン', settings:'設定', profile:'プロフィール', manageUsers:'ユーザー管理', logout:'ログアウト', menu:'メニュー', search:'名前、電話、ID、診断を検索...', photos:'写真 / X線', clinical:'臨床', xray:'X線', beforeAfter:'前 / 後', general:'一般', before:'前', after:'後', chooseLanguage:'言語', languageHelp:'アプリの表示言語を選択します。', theme:'テーマ色', pdf:'PDFスタイル', doctorCard:'医師カード', signature:'署名', backup:'バックアップ', restore:'復元', photoOptions:'写真オプション', viewPhoto:'写真を見る', markAs:'分類', selectBefore:'前の写真を選択', selectAfter:'後の写真を選択', blendHint:'バーを動かして写真をなめらかに比較します。'},
    ko:{native:'한국어', dir:'ltr', dashboard:'대시보드', patients:'환자', addPatient:'환자 추가', scanQR:'QR 스캔', settings:'설정', profile:'프로필', manageUsers:'사용자 관리', logout:'로그아웃', menu:'메뉴', search:'이름, 전화, ID, 진단 검색...', photos:'사진 / X-ray', clinical:'임상', xray:'X-ray', beforeAfter:'전 / 후', general:'일반', before:'전', after:'후', chooseLanguage:'언어', languageHelp:'앱 인터페이스 언어를 선택하세요.', theme:'색상', pdf:'PDF 스타일', doctorCard:'의사 카드', signature:'서명', backup:'백업', restore:'복원', photoOptions:'사진 옵션', viewPhoto:'사진 보기', markAs:'표시', selectBefore:'전 사진 선택', selectAfter:'후 사진 선택', blendHint:'바를 움직여 부드럽게 비교하세요.'},
    fa:{native:'فارسی', dir:'rtl', dashboard:'داشبورد', patients:'بیماران', addPatient:'افزودن بیمار', scanQR:'اسکن QR', settings:'تنظیمات', profile:'پروفایل', manageUsers:'کاربران', logout:'خروج', menu:'منو', search:'جستجو بر اساس نام، تلفن، ID یا تشخیص...', photos:'عکس‌ها / رادیوگرافی', clinical:'کلینیکی', xray:'رادیوگرافی', beforeAfter:'قبل / بعد', general:'عمومی', before:'قبل', after:'بعد', chooseLanguage:'زبان', languageHelp:'زبان رابط برنامه را انتخاب کنید.', theme:'رنگ', pdf:'سبک PDF', doctorCard:'کارت پزشک', signature:'امضا', backup:'پشتیبان', restore:'بازیابی', photoOptions:'گزینه‌های عکس', viewPhoto:'نمایش عکس', markAs:'علامت‌گذاری به عنوان', selectBefore:'انتخاب عکس قبل', selectAfter:'انتخاب عکس بعد', blendHint:'برای انتقال نرم، نوار را حرکت دهید.'}
  };
  const EXTRA_LANGS = [
    ['nl','Nederlands'],['sv','Svenska'],['da','Dansk'],['nb','Norsk'],['fi','Suomi'],['pl','Polski'],['cs','Čeština'],['sk','Slovenčina'],['hu','Magyar'],['ro','Română'],['el','Ελληνικά'],['uk','Українська'],['th','ไทย'],['vi','Tiếng Việt'],['id','Bahasa Indonesia'],['ms','Bahasa Melayu'],['he','עברית'],['bn','বাংলা'],['ta','தமிழ்'],['te','తెలుగు'],['mr','मराठी'],['sw','Kiswahili']
  ];
  EXTRA_LANGS.forEach(([code,native]) => { if(!LANGS[code]) LANGS[code] = Object.assign({}, LANGS.en, {native, dir:isRtlLang(code)?'rtl':'ltr'}); });
  function lang(){ return localStorage.getItem('clinicLanguage') || 'en'; }
  function tr(key){ const pack = LANGS[lang()] || LANGS.en; return pack[key] || LANGS.en[key] || key; }
  window.t = tr;

  window.applyLanguage = function applyLanguageClean(){
    const code = lang(); const pack = LANGS[code] || LANGS.en;
    document.documentElement.lang = code;
    document.documentElement.dir = pack.dir || 'ltr';
    document.body.dataset.lang = code;
    const tabMap = {dashboard:'dashboard', patients:'patients', form:'addPatient', scan:'scanQR'};
    Object.entries(tabMap).forEach(([page,key]) => { const el = document.querySelector(`[data-page="${page}"]`); if (el) el.textContent = tr(key); });
    if (byId('menuBtn')) byId('menuBtn').textContent = tr('menu');
    if (byId('search')) byId('search').placeholder = tr('search');
    const title = document.querySelector('#settings .card h2, .settings-page h2'); if(title) title.textContent = tr('settings');
  };
  window.setUILanguage = function setUILanguageClean(code){
    localStorage.setItem('clinicLanguage', LANGS[code] ? code : 'en');
    window.applyLanguage();
    byId('languageCleanOverlay')?.remove();
    try { renderDashboard(); renderPatients(); if (byId('detail')?.classList.contains('active') && photoState.patientId) openPatient(photoState.patientId); } catch(e) {}
    notify((LANGS[code]?.native || 'Language') + ' selected');
  };
  window.openLanguagePicker = function openLanguagePickerClean(){
    byId('languageCleanOverlay')?.remove();
    const current = lang();
    const order = Object.keys(LANGS);
    const overlay = document.createElement('div');
    overlay.id = 'languageCleanOverlay';
    overlay.className = 'clean-modal-overlay';
    overlay.innerHTML = `<div class="clean-modal clean-language-modal" role="dialog" aria-modal="true" dir="ltr">
      <div class="clean-modal-head"><div><h2>${htmlSafe(tr('chooseLanguage'))}</h2><p>${htmlSafe(tr('languageHelp'))}</p></div><button type="button" onclick="document.getElementById('languageCleanOverlay')?.remove()">×</button></div>
      <div class="clean-language-grid">${order.map(code => `<button type="button" class="clean-language-item no-translate ${current===code?'active':''}" dir="${LANGS[code].dir}" onclick="setUILanguage('${code}')"><strong>${htmlSafe(LANGS[code].native)}</strong><span>${code.toUpperCase()}</span></button>`).join('')}</div>
    </div>`;
    overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  window.openClinicMenu = function openClinicMenuClean(){
    byId('drawerOverlay')?.remove(); byId('sideDrawer')?.remove();
    const overlay = document.createElement('div'); overlay.className = 'drawer-overlay'; overlay.id = 'drawerOverlay'; overlay.onclick = closeClinicMenu;
    const drawer = document.createElement('aside'); drawer.className = 'side-drawer clean-side-drawer'; drawer.id = 'sideDrawer';
    const admin = currentUser?.role === 'admin';
    drawer.innerHTML = `<div class="drawer-head"><h2>${htmlSafe(tr('menu'))}</h2><button class="drawer-close-btn" onclick="closeClinicMenu()" aria-label="Close">×</button></div>
      <div class="drawer-user"><div>${htmlSafe(currentUser?.full_name || currentUser?.username || 'Doctor')}</div><small>${htmlSafe((currentUser?.role || 'doctor').toUpperCase())}</small></div>
      <div class="drawer-menu clean-drawer-menu">
        <button class="primary-item" onclick="closeClinicMenu();showPage('form')">${htmlSafe(tr('addPatient'))}</button>
        <button onclick="closeClinicMenu();showPage('scan')">${htmlSafe(tr('scanQR'))}</button>
        <button onclick="closeClinicMenu();showPage('settings')">${htmlSafe(tr('settings'))}</button>
        <button onclick="closeClinicMenu();openDoctorProfile()">${htmlSafe(tr('profile'))}</button>
        ${admin ? `<button onclick="closeClinicMenu();manageUsers()">${htmlSafe(tr('manageUsers'))}</button>` : ''}
        <button class="danger-item" onclick="logout()">${htmlSafe(tr('logout'))}</button>
      </div>`;
    document.body.appendChild(overlay); document.body.appendChild(drawer);
  };
  window.closeClinicMenu = function closeClinicMenuClean(){ byId('drawerOverlay')?.remove(); byId('sideDrawer')?.remove(); };

  function takeOverMenuButton(){
    const btn = byId('menuBtn');
    if (!btn || btn.dataset.cleanOwned === '1') return;
    const clone = btn.cloneNode(true);
    clone.dataset.cleanOwned = '1';
    clone.textContent = tr('menu');
    clone.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); openClinicMenu(); }, true);
    btn.replaceWith(clone);
  }

  function normalizePhotos(patient){
    return (patient?.photos || []).map((raw, index) => {
      const url = getPhotoUrl(raw);
      const obj = (raw && typeof raw === 'object') ? Object.assign({}, raw) : {url, path:url};
      const text = `${obj.category || ''} ${obj.name || ''} ${obj.filename || ''} ${obj.path || ''} ${obj.url || ''}`.toLowerCase();
      const stageText = `${obj.stage || obj.photoStage || obj.type || ''} ${obj.name || ''} ${obj.filename || ''}`.toLowerCase();
      let category = (obj.category || obj.photoCategory || '').toLowerCase();
      if (!['clinical','xray'].includes(category)) category = (text.includes('xray') || text.includes('x-ray') || text.includes('radiograph')) ? 'xray' : 'clinical';
      let stage = (obj.stage || obj.photoStage || '').toLowerCase();
      if (!['general','before','after'].includes(stage)) stage = stageText.includes('before') || stageText.includes('pre') ? 'before' : (stageText.includes('after') || stageText.includes('post') ? 'after' : 'general');
      return { raw:obj, index, url, category, stage, name: obj.name || obj.filename || `Photo ${index+1}`, date: obj.date || '' };
    }).filter(p => p.url);
  }

  async function savePhotoMeta(patientId, index, patch){
    const patient = findPatient(patientId); if (!patient) return;
    const next = [...(patient.photos || [])];
    const old = next[index];
    const obj = (old && typeof old === 'object') ? Object.assign({}, old) : {url: old, path: old, name: `Photo ${index+1}`};
    Object.assign(obj, patch);
    next[index] = obj;
    patient.photos = next;
    try { await api(`patients?id=eq.${encodeURIComponent(patientId)}`, {method:'PATCH', body: JSON.stringify({photos: next})}); } catch(err) { console.error(err); alert('Could not save photo type: ' + err.message); }
    const box = byId('simplePhotosBox'); if(box) box.innerHTML = renderSimplePhotos(patient, photoState.filter || 'clinical');
    notify('Saved');
  }
  window.savePhotoMetaClean = savePhotoMeta;

  function photoCard(patientId, photo){
    return `<div class="clean-photo-card" data-index="${photo.index}">
      <button class="photo-dots" type="button" aria-label="Photo options" onclick="event.preventDefault();event.stopPropagation();openPhotoOptions('${patientId}', ${photo.index})">•••</button>
      <img src="${htmlSafe(photo.url)}" alt="Patient photo" onclick="openCleanPhotoViewer('${patientId}', ${photo.index})" loading="lazy">
      <div class="clean-photo-meta"><span>${htmlSafe(tr(photo.category === 'xray' ? 'xray' : 'clinical'))}</span><span>•</span><span>${htmlSafe(tr(photo.stage || 'general'))}</span></div>
    </div>`;
  }

  window.renderSimplePhotos = function renderSimplePhotosClean(patient, type='clinical'){
    photoState.patientId = patient.id; photoState.filter = type;
    const all = normalizePhotos(patient);
    const filtered = type === 'xray' ? all.filter(p=>p.category==='xray') : type === 'beforeAfter' ? all.filter(p=>p.stage==='before' || p.stage==='after') : all.filter(p=>p.category==='clinical');
    return `<div class="clean-photo-section">
      <div class="clean-photo-tabs">
        <button type="button" class="${type==='clinical'?'active':''}" onclick="switchSimplePhotoType('${patient.id}','clinical')">${htmlSafe(tr('clinical'))} <small>${all.filter(p=>p.category==='clinical').length}</small></button>
        <button type="button" class="${type==='xray'?'active':''}" onclick="switchSimplePhotoType('${patient.id}','xray')">${htmlSafe(tr('xray'))} <small>${all.filter(p=>p.category==='xray').length}</small></button>
        <button type="button" class="${type==='beforeAfter'?'active':''}" onclick="showBeforeAfter('${patient.id}')">${htmlSafe(tr('beforeAfter'))}</button>
      </div>
      ${filtered.length ? `<div class="clean-photo-grid">${filtered.map(p=>photoCard(patient.id,p)).join('')}</div>` : `<div class="clean-empty-photo">No photos in this section yet.</div>`}
    </div>`;
  };
  window.switchSimplePhotoType = function switchSimplePhotoTypeClean(patientId, type){ const p = findPatient(patientId); const box = byId('simplePhotosBox'); if(p && box) box.innerHTML = renderSimplePhotos(p, type); };
  window.openCleanPhotoViewer = function openCleanPhotoViewer(patientId, index){
    const p = findPatient(patientId); if(!p) return;
    const all = normalizePhotos(p); const start = Math.max(0, all.findIndex(x=>x.index===index));
    currentPhotoList = all.map(x=>x.url); openPhotoViewer(start < 0 ? 0 : start);
  };

  window.openPhotoOptions = function openPhotoOptionsClean(patientId, index){
    const p = findPatient(patientId); if(!p) return;
    const ph = normalizePhotos(p).find(x=>x.index===index); if(!ph) return;
    byId('photoOptionsOverlay')?.remove();
    const overlay = document.createElement('div'); overlay.id = 'photoOptionsOverlay'; overlay.className = 'clean-sheet-overlay';
    overlay.innerHTML = `<div class="clean-photo-sheet" role="dialog" aria-modal="true">
      <div class="sheet-grip"></div>
      <div class="sheet-head"><img src="${htmlSafe(ph.url)}" alt=""><div><h3>${htmlSafe(tr('photoOptions'))}</h3><p>${htmlSafe(tr('markAs'))}</p></div><button type="button" onclick="document.getElementById('photoOptionsOverlay')?.remove()">×</button></div>
      <div class="sheet-actions">
        <button class="${ph.category==='clinical'?'active':''}" onclick="savePhotoMetaClean('${patientId}',${index},{category:'clinical'});document.getElementById('photoOptionsOverlay')?.remove()">${htmlSafe(tr('clinical'))}</button>
        <button class="${ph.category==='xray'?'active':''}" onclick="savePhotoMetaClean('${patientId}',${index},{category:'xray'});document.getElementById('photoOptionsOverlay')?.remove()">${htmlSafe(tr('xray'))}</button>
        <button class="${ph.stage==='general'?'active':''}" onclick="savePhotoMetaClean('${patientId}',${index},{stage:'general'});document.getElementById('photoOptionsOverlay')?.remove()">${htmlSafe(tr('general'))}</button>
        <button class="${ph.stage==='before'?'active':''}" onclick="savePhotoMetaClean('${patientId}',${index},{stage:'before'});document.getElementById('photoOptionsOverlay')?.remove()">${htmlSafe(tr('before'))}</button>
        <button class="${ph.stage==='after'?'active':''}" onclick="savePhotoMetaClean('${patientId}',${index},{stage:'after'});document.getElementById('photoOptionsOverlay')?.remove()">${htmlSafe(tr('after'))}</button>
        <button onclick="openCleanPhotoViewer('${patientId}',${index});document.getElementById('photoOptionsOverlay')?.remove()">${htmlSafe(tr('viewPhoto'))}</button>
      </div>
    </div>`;
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  function thumbPicker(labelKey, all, selected, cbName){
    return `<div class="ba-picker"><h4>${htmlSafe(tr(labelKey))}</h4><div class="ba-thumb-grid">${all.map(ph => `<button type="button" class="ba-thumb ${selected===ph.index?'active':''}" onclick="${cbName}(${ph.index})"><img src="${htmlSafe(ph.url)}" alt=""><span>${htmlSafe(tr(ph.category==='xray'?'xray':'clinical'))} • ${htmlSafe(tr(ph.stage||'general'))}</span></button>`).join('')}</div></div>`;
  }
  function renderBeforeAfterContent(patientId){
    const p = findPatient(patientId); const all = normalizePhotos(p);
    if(all.length < 2) return `<p class="muted">Need at least 2 photos for before / after comparison.</p>`;
    if(!all.some(x=>x.index===photoState.beforeIndex)) photoState.beforeIndex = all[0].index;
    if(!all.some(x=>x.index===photoState.afterIndex) || photoState.afterIndex===photoState.beforeIndex) photoState.afterIndex = (all.find(x=>x.index!==photoState.beforeIndex)||all[1]).index;
    const before = all.find(x=>x.index===photoState.beforeIndex) || all[0];
    const after = all.find(x=>x.index===photoState.afterIndex) || all.find(x=>x.index!==before.index) || all[1];
    return `${thumbPicker('selectBefore', all, before.index, 'selectBeforeClean')}${thumbPicker('selectAfter', all, after.index, 'selectAfterClean')}
      <div class="ba-blend-wrap" style="--blend:${photoState.blend}%">
        <img class="ba-img ba-before" src="${htmlSafe(before.url)}" alt="Before">
        <img class="ba-img ba-after" src="${htmlSafe(after.url)}" alt="After">
        <span class="ba-label before-label">${htmlSafe(tr('before'))}</span><span class="ba-label after-label">${htmlSafe(tr('after'))}</span>
        <div class="ba-soft-bar"></div>
      </div>
      <input class="ba-range" type="range" min="0" max="100" value="${photoState.blend}" oninput="setBlendClean(this.value)">
      <p class="muted">${htmlSafe(tr('blendHint'))}</p>`;
  }
  window.selectBeforeClean = function(idx){ photoState.beforeIndex = Number(idx); const body = byId('beforeAfterBody'); if(body) body.innerHTML = renderBeforeAfterContent(photoState.patientId); };
  window.selectAfterClean = function(idx){ photoState.afterIndex = Number(idx); const body = byId('beforeAfterBody'); if(body) body.innerHTML = renderBeforeAfterContent(photoState.patientId); };
  window.setBlendClean = function(v){ photoState.blend = Number(v); const box = document.querySelector('.ba-blend-wrap'); if(box) box.style.setProperty('--blend', `${photoState.blend}%`); };
  window.showBeforeAfter = function showBeforeAfterClean(patientId){
    photoState.patientId = patientId;
    byId('beforeAfterOverlay')?.remove();
    const overlay = document.createElement('div'); overlay.id = 'beforeAfterOverlay'; overlay.className = 'clean-modal-overlay';
    overlay.innerHTML = `<div class="clean-modal ba-modal" role="dialog" aria-modal="true">
      <div class="clean-modal-head"><div><h2>${htmlSafe(tr('beforeAfter'))}</h2><p>${htmlSafe(tr('blendHint'))}</p></div><button type="button" onclick="document.getElementById('beforeAfterOverlay')?.remove()">×</button></div>
      <div id="beforeAfterBody">${renderBeforeAfterContent(patientId)}</div>
    </div>`;
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  window.openSettingsPage = function(){ showPage('settings'); };
  const oldShowPage = window.showPage || showPage;
  window.showPage = function showPageClean(page){
    if(page === 'settings'){
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      let s = byId('settings');
      if(!s){ s = document.createElement('section'); s.id = 'settings'; s.className = 'page'; document.querySelector('main.app')?.appendChild(s); }
      s.classList.add('active');
      s.innerHTML = `<div class="card settings-page"><h2>${htmlSafe(tr('settings'))}</h2><p class="muted">Clinic tools and preferences in one simple place.</p><div class="settings-grid-clean">
        <button class="settings-tile" onclick="openThemePicker()"><b>${htmlSafe(tr('theme'))}</b><span>Preset / custom color</span></button>
        <button class="settings-tile" onclick="openLanguagePicker()"><b>${htmlSafe(tr('language'))}</b><span>${htmlSafe((LANGS[lang()]||LANGS.en).native)}</span></button>
        <button class="settings-tile" onclick="openPdfPatternPicker()"><b>${htmlSafe(tr('pdf'))}</b><span>Reports and receipts</span></button>
        <button class="settings-tile" onclick="openDoctorInfoCard()"><b>${htmlSafe(tr('doctorCard'))}</b><span>Specialty, phones, website</span></button>
        <button class="settings-tile" onclick="openSignaturePad()"><b>${htmlSafe(tr('signature'))}</b><span>Used on PDFs and receipts</span></button>
        <button class="settings-tile" onclick="backupData()"><b>${htmlSafe(tr('backup'))}</b><span>Export clinic data</span></button>
        <button class="settings-tile" onclick="restoreBackup()"><b>${htmlSafe(tr('restore'))}</b><span>Import backup file</span></button>
      </div></div>`;
      window.scrollTo(0,0); return;
    }
    return oldShowPage(page);
  };

  document.addEventListener('DOMContentLoaded', function(){ takeOverMenuButton(); window.applyLanguage(); }, {once:true});
  setTimeout(function(){ takeOverMenuButton(); window.applyLanguage(); }, 0);
  setTimeout(takeOverMenuButton, 500);
})();

/* === FINAL SOURCE-LEVEL REPAIR: premium language/theme + simple before/after === */
(function(){
  function byId(id){ return document.getElementById(id); }
  function esc(v){ return (typeof safeText === 'function') ? safeText(v) : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function patientById(id){ return (Array.isArray(window.patients) ? window.patients : patients).find(p => String(p.id) === String(id)); }
  function urlOf(photo){ return typeof photo === 'string' ? photo : (photo?.url || photo?.path || ''); }
  function rtl(code){ return ['ar','he','ur','fa','ps','ku','sd','ug','yi'].includes(code); }
  function toast(msg){
    let el = byId('cleanToast');
    if(!el){ el = document.createElement('div'); el.id='cleanToast'; el.className='clean-toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(()=>el.classList.remove('show'),1700);
  }

  const BASE = {
    en:{native:'English', dir:'ltr', language:'Language', chooseLanguage:'Language', languageHelp:'Choose the language for the app interface.', menu:'Menu', dashboard:'Dashboard', patients:'Patients', addPatient:'Add Patient', scanQR:'Scan QR', settings:'Settings', profile:'Profile', manageUsers:'Manage Users', logout:'Logout', search:'Search by name, phone, ID, or diagnosis...', photos:'Photos / X-rays', clinical:'Clinical', xray:'X-ray', beforeAfter:'Before / After', general:'General', before:'Before', after:'After', photoOptions:'Photo options', markAs:'Mark as', viewPhoto:'View photo', theme:'Theme color', themeHelp:'Choose a premium preset or pick any custom color.', customColor:'Custom color', applyCustom:'Apply custom color', presets:'Premium presets', pdf:'PDF style', doctorCard:'Doctor card', signature:'Draw signature', backup:'Backup', restore:'Restore', tools:'Clinic tools and preferences in one simple place.', noBA:'Mark one photo as Before and one photo as After from the 3-dot menu.', noPhotos:'No photos in this section yet.', baHint:'The Before and After photos are selected from the 3-dot menu. Move the bar for a soft blurry transition.'},
    ar:{native:'العربية', dir:'rtl', language:'اللغة', chooseLanguage:'اللغة', languageHelp:'اختر لغة واجهة التطبيق.', menu:'القائمة', dashboard:'لوحة التحكم', patients:'المرضى', addPatient:'إضافة مريض', scanQR:'مسح QR', settings:'الإعدادات', profile:'الملف الشخصي', manageUsers:'إدارة المستخدمين', logout:'تسجيل الخروج', search:'ابحث بالاسم أو الهاتف أو الكود أو التشخيص...', photos:'الصور / الأشعة', clinical:'سريري', xray:'أشعة', beforeAfter:'قبل / بعد', general:'عام', before:'قبل', after:'بعد', photoOptions:'خيارات الصورة', markAs:'تحديد كـ', viewPhoto:'عرض الصورة', theme:'لون التطبيق', themeHelp:'اختر لوناً جاهزاً أو لوناً مخصصاً.', customColor:'لون مخصص', applyCustom:'تطبيق اللون', presets:'ألوان مميزة', pdf:'شكل PDF', doctorCard:'بطاقة الطبيب', signature:'رسم التوقيع', backup:'نسخة احتياطية', restore:'استرجاع', tools:'أدوات العيادة والإعدادات في مكان واحد.', noBA:'حدد صورة قبل وصورة بعد من قائمة الثلاث نقاط.', noPhotos:'لا توجد صور في هذا القسم.', baHint:'صور قبل وبعد يتم اختيارها من قائمة الثلاث نقاط. حرّك الشريط لانتقال ضبابي ناعم.'},
    fr:{native:'Français', dir:'ltr', language:'Langue', chooseLanguage:'Langue', languageHelp:'Choisissez la langue de l’interface.', menu:'Menu', dashboard:'Tableau', patients:'Patients', addPatient:'Ajouter patient', scanQR:'Scanner QR', settings:'Réglages', profile:'Profil', manageUsers:'Utilisateurs', logout:'Déconnexion', search:'Rechercher nom, téléphone, ID ou diagnostic...', photos:'Photos / Radios', clinical:'Clinique', xray:'Radio', beforeAfter:'Avant / Après', general:'Général', before:'Avant', after:'Après', photoOptions:'Options photo', markAs:'Marquer comme', viewPhoto:'Voir photo', theme:'Couleur', themeHelp:'Choisissez un préréglage premium ou une couleur personnalisée.', customColor:'Couleur personnalisée', applyCustom:'Appliquer', presets:'Préréglages', pdf:'Style PDF', doctorCard:'Carte médecin', signature:'Signature', backup:'Sauvegarde', restore:'Restaurer', tools:'Outils et préférences de la clinique.', noBA:'Marquez une photo Avant et une photo Après avec le menu à 3 points.', noPhotos:'Aucune photo dans cette section.', baHint:'Les photos Avant/Après viennent du menu à 3 points. Déplacez la barre pour une transition douce.'},
    es:{native:'Español', dir:'ltr', language:'Idioma', chooseLanguage:'Idioma', languageHelp:'Elige el idioma de la interfaz.', menu:'Menú', dashboard:'Panel', patients:'Pacientes', addPatient:'Añadir paciente', scanQR:'Escanear QR', settings:'Ajustes', profile:'Perfil', manageUsers:'Usuarios', logout:'Salir', search:'Buscar nombre, teléfono, ID o diagnóstico...', photos:'Fotos / Rayos X', clinical:'Clínica', xray:'Rayos X', beforeAfter:'Antes / Después', general:'General', before:'Antes', after:'Después', photoOptions:'Opciones de foto', markAs:'Marcar como', viewPhoto:'Ver foto', theme:'Color', themeHelp:'Elige un color premium o personalizado.', customColor:'Color personalizado', applyCustom:'Aplicar color', presets:'Colores premium', pdf:'Estilo PDF', doctorCard:'Tarjeta doctor', signature:'Firma', backup:'Copia', restore:'Restaurar', tools:'Herramientas y preferencias de la clínica.', noBA:'Marca una foto como Antes y otra como Después desde los 3 puntos.', noPhotos:'No hay fotos en esta sección.', baHint:'Las fotos Antes/Después se eligen desde los 3 puntos. Mueve la barra para una transición suave.'},
    de:{native:'Deutsch', dir:'ltr', language:'Sprache', chooseLanguage:'Sprache', languageHelp:'Wählen Sie die Sprache der App.', menu:'Menü', dashboard:'Dashboard', patients:'Patienten', addPatient:'Patient hinzufügen', scanQR:'QR scannen', settings:'Einstellungen', profile:'Profil', manageUsers:'Benutzer', logout:'Abmelden', search:'Name, Telefon, ID oder Diagnose suchen...', photos:'Fotos / Röntgen', clinical:'Klinisch', xray:'Röntgen', beforeAfter:'Vorher / Nachher', general:'Allgemein', before:'Vorher', after:'Nachher', photoOptions:'Fotooptionen', markAs:'Markieren als', viewPhoto:'Foto anzeigen', theme:'Farbe', themeHelp:'Wählen Sie ein Premium-Preset oder eine eigene Farbe.', customColor:'Eigene Farbe', applyCustom:'Farbe anwenden', presets:'Premium Farben', pdf:'PDF-Stil', doctorCard:'Arztkarte', signature:'Unterschrift', backup:'Backup', restore:'Wiederherstellen', tools:'Klinik-Tools und Einstellungen.', noBA:'Markieren Sie ein Foto als Vorher und eins als Nachher im 3-Punkte-Menü.', noPhotos:'Keine Fotos in diesem Bereich.', baHint:'Vorher/Nachher-Fotos kommen aus dem 3-Punkte-Menü. Bewegen Sie den Regler für weichen Übergang.'},
    it:{native:'Italiano', dir:'ltr', language:'Lingua', chooseLanguage:'Lingua', languageHelp:'Scegli la lingua dell’interfaccia.', menu:'Menu', dashboard:'Cruscotto', patients:'Pazienti', addPatient:'Aggiungi paziente', scanQR:'Scansiona QR', settings:'Impostazioni', profile:'Profilo', manageUsers:'Utenti', logout:'Esci', search:'Cerca nome, telefono, ID o diagnosi...', photos:'Foto / Radiografie', clinical:'Clinica', xray:'Radiografia', beforeAfter:'Prima / Dopo', general:'Generale', before:'Prima', after:'Dopo', photoOptions:'Opzioni foto', markAs:'Segna come', viewPhoto:'Vedi foto', theme:'Colore', themeHelp:'Scegli un preset premium o un colore personalizzato.', customColor:'Colore personalizzato', applyCustom:'Applica colore', presets:'Preset premium', pdf:'PDF stile', doctorCard:'Scheda medico', signature:'Firma', backup:'Backup', restore:'Ripristina', tools:'Strumenti e preferenze della clinica.', noBA:'Segna una foto come Prima e una come Dopo dal menu a 3 punti.', noPhotos:'Nessuna foto in questa sezione.', baHint:'Le foto Prima/Dopo vengono scelte dal menu a 3 punti. Muovi la barra per una transizione morbida.'},
    pt:{native:'Português', dir:'ltr', language:'Idioma', chooseLanguage:'Idioma', languageHelp:'Escolha o idioma da interface.', menu:'Menu', dashboard:'Painel', patients:'Pacientes', addPatient:'Adicionar paciente', scanQR:'Ler QR', settings:'Configurações', profile:'Perfil', manageUsers:'Usuários', logout:'Sair', search:'Pesquisar nome, telefone, ID ou diagnóstico...', photos:'Fotos / Raios X', clinical:'Clínica', xray:'Raio X', beforeAfter:'Antes / Depois', general:'Geral', before:'Antes', after:'Depois', photoOptions:'Opções da foto', markAs:'Marcar como', viewPhoto:'Ver foto', theme:'Cor', themeHelp:'Escolha um preset premium ou cor personalizada.', customColor:'Cor personalizada', applyCustom:'Aplicar cor', presets:'Cores premium', pdf:'Estilo PDF', doctorCard:'Cartão médico', signature:'Assinatura', backup:'Backup', restore:'Restaurar', tools:'Ferramentas e preferências da clínica.', noBA:'Marque uma foto como Antes e outra como Depois no menu de 3 pontos.', noPhotos:'Nenhuma foto nesta seção.', baHint:'As fotos Antes/Depois são escolhidas no menu de 3 pontos. Mova a barra para uma transição suave.'},
    ru:{native:'Русский', dir:'ltr', language:'Язык', chooseLanguage:'Язык', languageHelp:'Выберите язык интерфейса.', menu:'Меню', dashboard:'Панель', patients:'Пациенты', addPatient:'Добавить пациента', scanQR:'QR скан', settings:'Настройки', profile:'Профиль', manageUsers:'Пользователи', logout:'Выйти', search:'Поиск имени, телефона, ID или диагноза...', photos:'Фото / Рентген', clinical:'Клинические', xray:'Рентген', beforeAfter:'До / После', general:'Общие', before:'До', after:'После', photoOptions:'Параметры фото', markAs:'Отметить как', viewPhoto:'Открыть фото', theme:'Цвет', themeHelp:'Выберите премиум цвет или свой цвет.', customColor:'Свой цвет', applyCustom:'Применить', presets:'Премиум цвета', pdf:'Стиль PDF', doctorCard:'Карта врача', signature:'Подпись', backup:'Резерв', restore:'Восстановить', tools:'Инструменты и настройки клиники.', noBA:'Отметьте одно фото как До, а другое как После в меню с 3 точками.', noPhotos:'В этом разделе нет фото.', baHint:'Фото До/После выбираются из меню с 3 точками. Двигайте ползунок для мягкого перехода.'},
    tr:{native:'Türkçe', dir:'ltr', language:'Dil', chooseLanguage:'Dil', languageHelp:'Uygulama arayüz dilini seçin.', menu:'Menü', dashboard:'Panel', patients:'Hastalar', addPatient:'Hasta ekle', scanQR:'QR tara', settings:'Ayarlar', profile:'Profil', manageUsers:'Kullanıcılar', logout:'Çıkış', search:'Ad, telefon, ID veya teşhis ara...', photos:'Fotoğraflar / Röntgen', clinical:'Klinik', xray:'Röntgen', beforeAfter:'Önce / Sonra', general:'Genel', before:'Önce', after:'Sonra', photoOptions:'Foto seçenekleri', markAs:'Olarak işaretle', viewPhoto:'Fotoğrafı aç', theme:'Renk', themeHelp:'Premium hazır renk veya özel renk seçin.', customColor:'Özel renk', applyCustom:'Rengi uygula', presets:'Premium renkler', pdf:'PDF stili', doctorCard:'Doktor kartı', signature:'İmza', backup:'Yedek', restore:'Geri yükle', tools:'Klinik araçları ve ayarları.', noBA:'3 nokta menüsünden bir fotoğrafı Önce, birini Sonra olarak işaretleyin.', noPhotos:'Bu bölümde fotoğraf yok.', baHint:'Önce/Sonra fotoğrafları 3 nokta menüsünden seçilir. Yumuşak geçiş için çubuğu hareket ettirin.'},
    zh:{native:'中文', dir:'ltr', language:'语言', chooseLanguage:'语言', languageHelp:'选择应用界面语言。', menu:'菜单', dashboard:'仪表板', patients:'患者', addPatient:'添加患者', scanQR:'扫描 QR', settings:'设置', profile:'资料', manageUsers:'用户', logout:'退出', search:'搜索姓名、电话、ID 或诊断...', photos:'照片 / X光', clinical:'临床', xray:'X光', beforeAfter:'前 / 后', general:'普通', before:'前', after:'后', photoOptions:'照片选项', markAs:'标记为', viewPhoto:'查看照片', theme:'主题色', themeHelp:'选择高级预设或自定义颜色。', customColor:'自定义颜色', applyCustom:'应用颜色', presets:'高级预设', pdf:'PDF 样式', doctorCard:'医生卡', signature:'签名', backup:'备份', restore:'恢复', tools:'诊所工具和偏好设置。', noBA:'请从三点菜单标记一张前照和一张后照。', noPhotos:'此部分没有照片。', baHint:'前后照片来自三点菜单。移动滑杆实现柔和过渡。'},
    ja:{native:'日本語', dir:'ltr', language:'言語', chooseLanguage:'言語', languageHelp:'アプリの表示言語を選択します。', menu:'メニュー', dashboard:'ダッシュボード', patients:'患者', addPatient:'患者を追加', scanQR:'QRスキャン', settings:'設定', profile:'プロフィール', manageUsers:'ユーザー管理', logout:'ログアウト', search:'名前、電話、ID、診断を検索...', photos:'写真 / X線', clinical:'臨床', xray:'X線', beforeAfter:'前 / 後', general:'一般', before:'前', after:'後', photoOptions:'写真オプション', markAs:'分類', viewPhoto:'写真を見る', theme:'テーマ色', themeHelp:'プレミアム色またはカスタム色を選択します。', customColor:'カスタム色', applyCustom:'適用', presets:'プレミアム色', pdf:'PDFスタイル', doctorCard:'医師カード', signature:'署名', backup:'バックアップ', restore:'復元', tools:'クリニックのツールと設定。', noBA:'3点メニューで前と後の写真を指定してください。', noPhotos:'このセクションに写真はありません。', baHint:'前後写真は3点メニューから選択されます。バーを動かして柔らかく比較します。'},
    ko:{native:'한국어', dir:'ltr', language:'언어', chooseLanguage:'언어', languageHelp:'앱 인터페이스 언어를 선택하세요.', menu:'메뉴', dashboard:'대시보드', patients:'환자', addPatient:'환자 추가', scanQR:'QR 스캔', settings:'설정', profile:'프로필', manageUsers:'사용자 관리', logout:'로그아웃', search:'이름, 전화, ID, 진단 검색...', photos:'사진 / X-ray', clinical:'임상', xray:'X-ray', beforeAfter:'전 / 후', general:'일반', before:'전', after:'후', photoOptions:'사진 옵션', markAs:'표시', viewPhoto:'사진 보기', theme:'테마 색상', themeHelp:'프리미엄 색상 또는 사용자 색상을 선택하세요.', customColor:'사용자 색상', applyCustom:'적용', presets:'프리미엄 색상', pdf:'PDF 스타일', doctorCard:'의사 카드', signature:'서명', backup:'백업', restore:'복원', tools:'클리닉 도구 및 설정.', noBA:'3점 메뉴에서 전/후 사진을 표시하세요.', noPhotos:'이 섹션에 사진이 없습니다.', baHint:'전/후 사진은 3점 메뉴에서 선택됩니다. 바를 움직여 부드럽게 비교하세요.'},
    hi:{native:'हिन्दी', dir:'ltr', language:'भाषा', chooseLanguage:'भाषा', languageHelp:'ऐप इंटरफ़ेस की भाषा चुनें।', menu:'मेनू', dashboard:'डैशबोर्ड', patients:'मरीज़', addPatient:'मरीज़ जोड़ें', scanQR:'QR स्कैन', settings:'सेटिंग्स', profile:'प्रोफ़ाइल', manageUsers:'यूज़र', logout:'लॉग आउट', search:'नाम, फोन, ID या निदान खोजें...', photos:'फोटो / एक्स-रे', clinical:'क्लिनिकल', xray:'एक्स-रे', beforeAfter:'पहले / बाद', general:'सामान्य', before:'पहले', after:'बाद', photoOptions:'फोटो विकल्प', markAs:'चिह्नित करें', viewPhoto:'फोटो देखें', theme:'रंग', themeHelp:'प्रीमियम रंग या कस्टम रंग चुनें।', customColor:'कस्टम रंग', applyCustom:'रंग लागू करें', presets:'प्रीमियम रंग', pdf:'PDF शैली', doctorCard:'डॉक्टर कार्ड', signature:'हस्ताक्षर', backup:'बैकअप', restore:'रीस्टोर', tools:'क्लिनिक टूल और सेटिंग्स।', noBA:'3-dot मेनू से एक फोटो Before और एक After चिह्नित करें।', noPhotos:'इस सेक्शन में कोई फोटो नहीं है।', baHint:'Before/After फोटो 3-dot मेनू से चुने जाते हैं। सॉफ्ट ट्रांज़िशन के लिए बार चलाएं।'},
    ur:{native:'اردو', dir:'rtl', language:'زبان', chooseLanguage:'زبان', languageHelp:'ایپ انٹرفیس کی زبان منتخب کریں۔', menu:'مینو', dashboard:'ڈیش بورڈ', patients:'مریض', addPatient:'مریض شامل کریں', scanQR:'QR اسکین', settings:'ترتیبات', profile:'پروفائل', manageUsers:'صارفین', logout:'لاگ آؤٹ', search:'نام، فون، ID یا تشخیص تلاش کریں...', photos:'تصاویر / ایکس رے', clinical:'کلینیکل', xray:'ایکس رے', beforeAfter:'پہلے / بعد', general:'عام', before:'پہلے', after:'بعد', photoOptions:'تصویر کے اختیارات', markAs:'نشان لگائیں', viewPhoto:'تصویر دیکھیں', theme:'رنگ', themeHelp:'پریمیم یا کسٹم رنگ منتخب کریں۔', customColor:'کسٹم رنگ', applyCustom:'رنگ لگائیں', presets:'پریمیم رنگ', pdf:'PDF انداز', doctorCard:'ڈاکٹر کارڈ', signature:'دستخط', backup:'بیک اپ', restore:'بحال', tools:'کلینک ٹولز اور سیٹنگز۔', noBA:'تین نقطوں والے مینو سے ایک تصویر پہلے اور ایک بعد کے طور پر نشان لگائیں۔', noPhotos:'اس حصے میں کوئی تصویر نہیں۔', baHint:'پہلے/بعد کی تصاویر تین نقطوں والے مینو سے منتخب ہوتی ہیں۔ نرم منتقلی کے لیے بار حرکت دیں۔'},
    fa:{native:'فارسی', dir:'rtl', language:'زبان', chooseLanguage:'زبان', languageHelp:'زبان رابط برنامه را انتخاب کنید.', menu:'منو', dashboard:'داشبورد', patients:'بیماران', addPatient:'افزودن بیمار', scanQR:'اسکن QR', settings:'تنظیمات', profile:'پروفایل', manageUsers:'کاربران', logout:'خروج', search:'جستجو بر اساس نام، تلفن، ID یا تشخیص...', photos:'عکس‌ها / رادیوگرافی', clinical:'کلینیکی', xray:'رادیوگرافی', beforeAfter:'قبل / بعد', general:'عمومی', before:'قبل', after:'بعد', photoOptions:'گزینه‌های عکس', markAs:'علامت‌گذاری به عنوان', viewPhoto:'نمایش عکس', theme:'رنگ', themeHelp:'یک رنگ آماده یا رنگ دلخواه انتخاب کنید.', customColor:'رنگ دلخواه', applyCustom:'اعمال رنگ', presets:'رنگ‌های ویژه', pdf:'سبک PDF', doctorCard:'کارت پزشک', signature:'امضا', backup:'پشتیبان', restore:'بازیابی', tools:'ابزارها و تنظیمات کلینیک.', noBA:'از منوی سه نقطه یک عکس قبل و یک عکس بعد تعیین کنید.', noPhotos:'عکسی در این بخش نیست.', baHint:'عکس‌های قبل/بعد از منوی سه نقطه انتخاب می‌شوند. برای انتقال نرم نوار را حرکت دهید.'}
  };
  const IOS_LANGS = [
    ['af','Afrikaans'],['am','አማርኛ'],['az','Azərbaycanca'],['bg','Български'],['bn','বাংলা'],['bs','Bosanski'],['ca','Català'],['cs','Čeština'],['cy','Cymraeg'],['da','Dansk'],['el','Ελληνικά'],['et','Eesti'],['eu','Euskara'],['fi','Suomi'],['fil','Filipino'],['ga','Gaeilge'],['gl','Galego'],['gu','ગુજરાતી'],['he','עברית'],['hr','Hrvatski'],['hu','Magyar'],['id','Bahasa Indonesia'],['is','Íslenska'],['kn','ಕನ್ನಡ'],['kk','Қазақша'],['km','ភាសាខ្មែរ'],['lo','ລາວ'],['lt','Lietuvių'],['lv','Latviešu'],['mk','Македонски'],['ml','മലയാളം'],['mn','Монгол'],['mr','मराठी'],['ms','Bahasa Melayu'],['my','မြန်မာ'],['nb','Norsk Bokmål'],['ne','नेपाली'],['nl','Nederlands'],['pa','ਪੰਜਾਬੀ'],['pl','Polski'],['ro','Română'],['sk','Slovenčina'],['sl','Slovenščina'],['sq','Shqip'],['sr','Српски'],['sv','Svenska'],['sw','Kiswahili'],['ta','தமிழ்'],['te','తెలుగు'],['th','ไทย'],['uk','Українська'],['vi','Tiếng Việt'],['zu','Zulu']
  ];
  IOS_LANGS.forEach(([code,native]) => { if(!BASE[code]) BASE[code] = Object.assign({}, BASE.en, {native, dir:rtl(code)?'rtl':'ltr'}); });
  function lang(){ return localStorage.getItem('clinicLanguage') || 'en'; }
  function tr2(key){ const pack = BASE[lang()] || BASE.en; return pack[key] || BASE.en[key] || key; }
  window.t = tr2;

  const PHRASES = {
    'Dashboard':'dashboard','Patients':'patients','Add Patient':'addPatient','Scan QR':'scanQR','Settings':'settings','Profile':'profile','Manage Users':'manageUsers','Logout':'logout','Menu':'menu','Photos / X-rays':'photos','Photos / X-rays':'photos','Clinical':'clinical','X-ray':'xray','X-rays':'xray','Before / After':'beforeAfter','General':'general','Before':'before','After':'after','Photo options':'photoOptions','Mark as':'markAs','View photo':'viewPhoto','Theme color':'theme','PDF style':'pdf','Doctor card':'doctorCard','Draw signature':'signature','Backup':'backup','Restore':'restore','Language':'language'
  };
  function translateStaticText(root){
    if(lang()==='en') return;
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if(!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if(!p || ['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const raw = n.nodeValue.trim();
      const key = PHRASES[raw];
      if(key) n.nodeValue = n.nodeValue.replace(raw, tr2(key));
    });
  }

  window.applyLanguage = function finalApplyLanguage(){
    const code = lang(); const pack = BASE[code] || BASE.en;
    document.documentElement.lang = code;
    document.documentElement.dir = pack.dir || 'ltr';
    document.body.dataset.lang = code;
    const tabMap = {dashboard:'dashboard', patients:'patients', form:'addPatient', scan:'scanQR'};
    Object.entries(tabMap).forEach(([page,key]) => { const el = document.querySelector(`[data-page="${page}"]`); if(el) el.textContent = tr2(key); });
    const mb = byId('menuBtn'); if(mb) mb.textContent = tr2('menu');
    const search = byId('search'); if(search) search.placeholder = tr2('search');
    translateStaticText(document.body);
  };
  window.setUILanguage = function finalSetUILanguage(code){
    localStorage.setItem('clinicLanguage', BASE[code] ? code : 'en');
    byId('languageCleanOverlay')?.remove();
    try { if(typeof renderDashboard==='function') renderDashboard(); if(typeof renderPatients==='function') renderPatients(); } catch(e) { console.warn(e); }
    setTimeout(window.applyLanguage, 0);
    toast((BASE[code]?.native || 'Language') + ' selected');
  };
  window.openLanguagePicker = function finalOpenLanguagePicker(){
    byId('languageCleanOverlay')?.remove();
    const current = lang();
    const overlay = document.createElement('div');
    overlay.id = 'languageCleanOverlay'; overlay.className = 'clean-modal-overlay';
    const codes = Object.keys(BASE).sort((a,b) => (BASE[a].native || a).localeCompare(BASE[b].native || b));
    overlay.innerHTML = `<div class="clean-modal clean-language-modal final-language-modal no-translate" role="dialog" aria-modal="true" dir="ltr" translate="no">
      <div class="clean-modal-head"><div><h2>${esc(tr2('chooseLanguage'))}</h2><p>${esc(tr2('languageHelp'))}</p></div><button type="button" onclick="document.getElementById('languageCleanOverlay')?.remove()">×</button></div>
      <div class="final-language-search"><input id="languageSearchInput" placeholder="Search language..." oninput="filterLanguagesFinal(this.value)"></div>
      <div class="clean-language-grid final-language-grid">${codes.map(code => `<button type="button" data-language-item="${esc(code + ' ' + BASE[code].native)}" class="clean-language-item no-translate ${current===code?'active':''}" dir="${BASE[code].dir}" onclick="setUILanguage('${code}')"><strong>${esc(BASE[code].native)}</strong><span>${esc(code.toUpperCase())}</span></button>`).join('')}</div>
    </div>`;
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    setTimeout(()=>byId('languageSearchInput')?.focus(),80);
  };
  window.filterLanguagesFinal = function(q){
    q = String(q || '').toLowerCase();
    document.querySelectorAll('[data-language-item]').forEach(btn => { btn.style.display = btn.dataset.languageItem.toLowerCase().includes(q) ? '' : 'none'; });
  };

  function hexToRgb(hex){ hex = String(hex || '#d4af37').replace('#',''); if(hex.length===3) hex = hex.split('').map(x=>x+x).join(''); const n = parseInt(hex,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
  function rgbToHex(r,g,b){ return '#' + [r,g,b].map(x => Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join(''); }
  function mix(hex, pct, target){ const a = hexToRgb(hex), b = hexToRgb(target || (pct>0?'#ffffff':'#000000')); const p = Math.abs(pct); return rgbToHex(a.r+(b.r-a.r)*p,a.g+(b.g-a.g)*p,a.b+(b.b-a.b)*p); }
  const PRESETS = {gold:'#d4af37',rose:'#ff4fa3',ruby:'#ef4444',ocean:'#3b82f6',cyan:'#06b6d4',violet:'#8b5cf6',emerald:'#22c55e',orange:'#f97316',graphite:'#94a3b8',mint:'#14b8a6'};
  function applyAccent(hex, mode){
    const color = hex || PRESETS.gold;
    Object.keys(PRESETS).forEach(k => document.body.classList.remove('theme-'+k));
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-light', mix(color,.32,'#ffffff'));
    document.documentElement.style.setProperty('--accent-dark', mix(color,.38,'#000000'));
    localStorage.setItem('clinicThemeMode', mode || 'custom');
    localStorage.setItem('clinicAccent', color);
    try { const ex = doctorExtras(); ex.accent = color; ex.accentLight = mix(color,.32,'#ffffff'); ex.accentDark = mix(color,.38,'#000000'); saveDoctorExtras(ex); } catch(e) {}
  }
  window.setClinicTheme = function finalSetClinicTheme(name){
    const color = PRESETS[name] || PRESETS.gold;
    document.body.classList.add('theme-'+name);
    applyAccent(color, name);
    byId('themePickerOverlay')?.remove(); document.querySelector('.luxury-modal')?.remove(); toast('Theme saved');
  };
  window.saveCustomAccent = function finalSaveCustomAccent(){
    const color = byId('customAccentPicker')?.value || localStorage.getItem('clinicAccent') || PRESETS.gold;
    applyAccent(color, 'custom');
    byId('themePickerOverlay')?.remove(); document.querySelector('.luxury-modal')?.remove(); toast('Theme saved');
  };
  window.applySavedTheme = function finalApplySavedTheme(){ applyAccent(localStorage.getItem('clinicAccent') || (doctorExtras()?.accent) || PRESETS.gold, localStorage.getItem('clinicThemeMode') || 'gold'); };
  window.openThemePicker = function finalOpenThemePicker(){
    byId('themePickerOverlay')?.remove();
    const selected = localStorage.getItem('clinicAccent') || (doctorExtras()?.accent) || PRESETS.gold;
    const overlay = document.createElement('div'); overlay.id='themePickerOverlay'; overlay.className='clean-modal-overlay';
    overlay.innerHTML = `<div class="clean-modal premium-theme-modal" role="dialog" aria-modal="true">
      <div class="clean-modal-head"><div><h2>${esc(tr2('theme'))}</h2><p>${esc(tr2('themeHelp'))}</p></div><button type="button" onclick="document.getElementById('themePickerOverlay')?.remove()">×</button></div>
      <h3 class="theme-section-title">${esc(tr2('presets'))}</h3>
      <div class="premium-theme-grid">${Object.entries(PRESETS).map(([name,color]) => `<button type="button" class="premium-swatch" style="--sw:${color}" onclick="setClinicTheme('${name}')"><span></span><b>${esc(name[0].toUpperCase()+name.slice(1))}</b></button>`).join('')}</div>
      <div class="custom-theme-card"><label>${esc(tr2('customColor'))}</label><input id="customAccentPicker" type="color" value="${esc(selected)}"><button class="btn-primary" onclick="saveCustomAccent()">${esc(tr2('applyCustom'))}</button></div>
    </div>`;
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  function normalizePhotosFinal(patient){
    const list = Array.isArray(patient?.photos) ? patient.photos : [];
    return list.map((raw,index) => {
      const obj = (raw && typeof raw === 'object') ? raw : {url:raw, path:raw};
      let category = String(obj.category || obj.photoCategory || '').toLowerCase();
      let stage = String(obj.stage || obj.type || '').toLowerCase();
      const name = String(obj.name || obj.filename || '').toLowerCase();
      if(category.includes('x') || name.includes('xray') || name.includes('x-ray')) category='xray';
      if(category !== 'xray') category='clinical';
      if(!['before','after','general'].includes(stage)) stage='general';
      return {raw,obj,index,url:urlOf(obj),category,stage,name};
    }).filter(x=>x.url);
  }
  async function savePhotoMetaFinal(patientId,index,patch){
    const patient = patientById(patientId); if(!patient) return;
    const next = (patient.photos || []).map((raw,i) => {
      const obj = (raw && typeof raw === 'object') ? Object.assign({}, raw) : {url:raw, path:raw, name:`Photo ${i+1}`};
      if((patch.stage === 'before' || patch.stage === 'after') && i !== index && (obj.stage || obj.type) === patch.stage) { obj.stage = 'general'; obj.type = 'general'; }
      return obj;
    });
    const current = next[index] || {};
    Object.assign(current, patch);
    if(patch.stage) current.type = patch.stage;
    next[index] = current;
    patient.photos = next;
    try { await api(`patients?id=eq.${encodeURIComponent(patientId)}`, {method:'PATCH', body: JSON.stringify({photos: next})}); } catch(err){ console.error(err); alert('Could not save photo type: ' + err.message); }
    const box = byId('simplePhotosBox'); if(box) box.innerHTML = window.renderSimplePhotos(patient, window.__photoFilter || 'clinical');
    toast('Saved');
  }
  window.savePhotoMetaClean = savePhotoMetaFinal;

  function card(patientId, ph){
    return `<div class="clean-photo-card" data-index="${ph.index}">
      <button class="photo-dots" type="button" aria-label="Photo options" onclick="event.preventDefault();event.stopPropagation();openPhotoOptions('${patientId}', ${ph.index})">•••</button>
      <img src="${esc(ph.url)}" alt="Patient photo" onclick="openCleanPhotoViewer('${patientId}', ${ph.index})" loading="lazy">
      <div class="clean-photo-meta"><span>${esc(tr2(ph.category === 'xray' ? 'xray' : 'clinical'))}</span><span>•</span><span>${esc(tr2(ph.stage || 'general'))}</span></div>
    </div>`;
  }
  window.renderSimplePhotos = function finalRenderSimplePhotos(patient,type='clinical'){
    window.__photoFilter = type;
    const all = normalizePhotosFinal(patient);
    const filtered = type === 'xray' ? all.filter(p=>p.category==='xray') : type === 'beforeAfter' ? all.filter(p=>p.stage==='before' || p.stage==='after') : all.filter(p=>p.category==='clinical');
    return `<div class="clean-photo-section">
      <div class="clean-photo-tabs">
        <button type="button" class="${type==='clinical'?'active':''}" onclick="switchSimplePhotoType('${patient.id}','clinical')">${esc(tr2('clinical'))} <small>${all.filter(p=>p.category==='clinical').length}</small></button>
        <button type="button" class="${type==='xray'?'active':''}" onclick="switchSimplePhotoType('${patient.id}','xray')">${esc(tr2('xray'))} <small>${all.filter(p=>p.category==='xray').length}</small></button>
        <button type="button" class="${type==='beforeAfter'?'active':''}" onclick="showBeforeAfter('${patient.id}')">${esc(tr2('beforeAfter'))}</button>
      </div>
      ${filtered.length ? `<div class="clean-photo-grid">${filtered.map(p=>card(patient.id,p)).join('')}</div>` : `<div class="clean-empty-photo">${esc(tr2('noPhotos'))}</div>`}
    </div>`;
  };
  window.switchSimplePhotoType = function(patientId,type){ const p = patientById(patientId); const box = byId('simplePhotosBox'); if(p && box) box.innerHTML = window.renderSimplePhotos(p,type); };
  window.openCleanPhotoViewer = function(patientId,index){ const p = patientById(patientId); if(!p) return; const all = normalizePhotosFinal(p); const start = Math.max(0, all.findIndex(x=>x.index===index)); window.currentPhotoList = all.map(x=>x.url); currentPhotoList = window.currentPhotoList; if(typeof openPhotoViewer === 'function') openPhotoViewer(start < 0 ? 0 : start); };
  window.openPhotoOptions = function(patientId,index){
    const p = patientById(patientId); if(!p) return; const ph = normalizePhotosFinal(p).find(x=>x.index===index); if(!ph) return;
    byId('photoOptionsOverlay')?.remove();
    const overlay = document.createElement('div'); overlay.id='photoOptionsOverlay'; overlay.className='clean-sheet-overlay';
    overlay.innerHTML = `<div class="clean-photo-sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div>
      <div class="sheet-head"><img src="${esc(ph.url)}" alt=""><div><h3>${esc(tr2('photoOptions'))}</h3><p>${esc(tr2('markAs'))}</p></div><button type="button" onclick="document.getElementById('photoOptionsOverlay')?.remove()">×</button></div>
      <div class="sheet-actions">
        <button class="${ph.category==='clinical'?'active':''}" onclick="savePhotoMetaClean('${patientId}',${index},{category:'clinical'});document.getElementById('photoOptionsOverlay')?.remove()">${esc(tr2('clinical'))}</button>
        <button class="${ph.category==='xray'?'active':''}" onclick="savePhotoMetaClean('${patientId}',${index},{category:'xray'});document.getElementById('photoOptionsOverlay')?.remove()">${esc(tr2('xray'))}</button>
        <button class="${ph.stage==='general'?'active':''}" onclick="savePhotoMetaClean('${patientId}',${index},{stage:'general'});document.getElementById('photoOptionsOverlay')?.remove()">${esc(tr2('general'))}</button>
        <button class="${ph.stage==='before'?'active':''}" onclick="savePhotoMetaClean('${patientId}',${index},{stage:'before'});document.getElementById('photoOptionsOverlay')?.remove()">${esc(tr2('before'))}</button>
        <button class="${ph.stage==='after'?'active':''}" onclick="savePhotoMetaClean('${patientId}',${index},{stage:'after'});document.getElementById('photoOptionsOverlay')?.remove()">${esc(tr2('after'))}</button>
        <button onclick="openCleanPhotoViewer('${patientId}',${index});document.getElementById('photoOptionsOverlay')?.remove()">${esc(tr2('viewPhoto'))}</button>
      </div></div>`;
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };
  window.setBlendClean = function(v){ const box = document.querySelector('.ba-blend-wrap'); if(box) box.style.setProperty('--blend', `${Number(v)}%`); };
  window.showBeforeAfter = function(patientId){
    const p = patientById(patientId); if(!p) return;
    const all = normalizePhotosFinal(p);
    const before = all.find(x=>x.stage==='before');
    const after = all.find(x=>x.stage==='after');
    byId('beforeAfterOverlay')?.remove();
    const overlay = document.createElement('div'); overlay.id='beforeAfterOverlay'; overlay.className='clean-modal-overlay';
    const body = (before && after) ? `<div class="ba-selected-strip"><div><img src="${esc(before.url)}"><b>${esc(tr2('before'))}</b></div><div><img src="${esc(after.url)}"><b>${esc(tr2('after'))}</b></div></div>
      <div class="ba-blend-wrap final-ba-wrap" style="--blend:50%"><img class="ba-img ba-before" src="${esc(before.url)}" alt="Before"><img class="ba-img ba-after" src="${esc(after.url)}" alt="After"><span class="ba-label before-label">${esc(tr2('before'))}</span><span class="ba-label after-label">${esc(tr2('after'))}</span><div class="ba-soft-bar"></div></div>
      <input class="ba-range" type="range" min="0" max="100" value="50" oninput="setBlendClean(this.value)"><p class="muted">${esc(tr2('baHint'))}</p>` : `<div class="clean-empty-photo">${esc(tr2('noBA'))}</div>`;
    overlay.innerHTML = `<div class="clean-modal ba-modal" role="dialog" aria-modal="true"><div class="clean-modal-head"><div><h2>${esc(tr2('beforeAfter'))}</h2><p>${esc(tr2('baHint'))}</p></div><button type="button" onclick="document.getElementById('beforeAfterOverlay')?.remove()">×</button></div>${body}</div>`;
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  const oldShowPageFinal = window.showPage || showPage;
  window.showPage = function finalShowPage(page){
    if(page === 'settings'){
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      let s = byId('settings'); if(!s){ s = document.createElement('section'); s.id='settings'; s.className='page'; document.querySelector('main.app')?.appendChild(s); }
      s.classList.add('active');
      s.innerHTML = `<div class="card settings-page"><h2>${esc(tr2('settings'))}</h2><p class="muted">${esc(tr2('tools'))}</p><div class="settings-grid-clean">
        <button class="settings-tile" onclick="openThemePicker()"><b>${esc(tr2('theme'))}</b><span>${esc(tr2('customColor'))}</span></button>
        <button class="settings-tile" onclick="openLanguagePicker()"><b>${esc(tr2('language'))}</b><span>${esc((BASE[lang()]||BASE.en).native)}</span></button>
        <button class="settings-tile" onclick="openPdfPatternPicker()"><b>${esc(tr2('pdf'))}</b><span>Reports and receipts</span></button>
        <button class="settings-tile" onclick="openDoctorInfoCard()"><b>${esc(tr2('doctorCard'))}</b><span>Specialty, phones, website</span></button>
        <button class="settings-tile" onclick="openSignaturePad()"><b>${esc(tr2('signature'))}</b><span>PDFs and receipts</span></button>
        <button class="settings-tile" onclick="backupData()"><b>${esc(tr2('backup'))}</b><span>Export clinic data</span></button>
        <button class="settings-tile" onclick="restoreBackup()"><b>${esc(tr2('restore'))}</b><span>Import backup file</span></button>
      </div></div>`;
      window.scrollTo(0,0); window.applyLanguage(); return;
    }
    const out = oldShowPageFinal(page); setTimeout(window.applyLanguage,0); return out;
  };

  function ownMenu(){
    const btn = byId('menuBtn'); if(!btn || btn.dataset.finalOwned === '1') return;
    const clone = btn.cloneNode(true); clone.dataset.finalOwned='1'; clone.textContent = tr2('menu'); clone.onclick = null; clone.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openClinicMenu(); }, true); btn.replaceWith(clone);
  }
  const oldOpenMenu = window.openClinicMenu;
  window.openClinicMenu = function finalOpenClinicMenu(){
    byId('drawerOverlay')?.remove(); byId('sideDrawer')?.remove();
    const overlay = document.createElement('div'); overlay.className='drawer-overlay'; overlay.id='drawerOverlay'; overlay.onclick = closeClinicMenu;
    const drawer = document.createElement('aside'); drawer.className='side-drawer clean-side-drawer'; drawer.id='sideDrawer';
    const admin = currentUser?.role === 'admin';
    drawer.innerHTML = `<div class="drawer-head"><h2>${esc(tr2('menu'))}</h2><button class="drawer-close-btn" onclick="closeClinicMenu()" aria-label="Close">×</button></div>
      <div class="drawer-user"><div>${esc(currentUser?.full_name || currentUser?.username || 'Doctor')}</div><small>${esc((currentUser?.role || 'doctor').toUpperCase())}</small></div>
      <div class="drawer-menu clean-drawer-menu">
        <button class="primary-item" onclick="closeClinicMenu();showPage('form')">${esc(tr2('addPatient'))}</button>
        <button onclick="closeClinicMenu();showPage('scan')">${esc(tr2('scanQR'))}</button>
        <button onclick="closeClinicMenu();showPage('settings')">${esc(tr2('settings'))}</button>
        <button onclick="closeClinicMenu();openDoctorProfile()">${esc(tr2('profile'))}</button>
        ${admin ? `<button onclick="closeClinicMenu();manageUsers()">${esc(tr2('manageUsers'))}</button>` : ''}
        <button class="danger-item" onclick="logout()">${esc(tr2('logout'))}</button>
      </div>`;
    document.body.appendChild(overlay); document.body.appendChild(drawer);
  };

  document.addEventListener('DOMContentLoaded', () => { window.applySavedTheme(); ownMenu(); window.applyLanguage(); }, {once:true});
  setTimeout(()=>{ window.applySavedTheme(); ownMenu(); window.applyLanguage(); },0);
  setTimeout(()=>{ ownMenu(); window.applyLanguage(); },600);
})();

/* === DEPLOY-SAFE LANGUAGE FIX: make selected language actually apply everywhere === */
(function(){
  const RTL = new Set(['ar','he','ur','fa','ps','ku','sd','ug','yi']);
  const PACKS = {
    en:{native:'English',dir:'ltr',language:'Language',languageHelp:'Choose the language for the app interface.',menu:'Menu',dashboard:'Dashboard',patients:'Patients',addPatient:'Add Patient',scanQR:'Scan QR',settings:'Settings',profile:'Profile',manageUsers:'Manage Users',logout:'Logout',search:'Search by name, phone, ID, or diagnosis...',totalPatients:'Total Patients',todaysAppts:"Today's Appts",unpaidBalance:'Unpaid Balance',totalVisits:'Total Visits',totalRevenue:'Total Revenue',paidToday:'Paid Today',clinicOverview:'Clinic Overview',appointmentCalendar:'Appointment Calendar',today:'Today',upcoming:'Upcoming',newPatient:'+ New Patient',backup:'Backup',restore:'Restore',open:'Open',withoutTreatmentPlan:'without treatment plan',overdue:'overdue',unpaid:'unpaid',followUpWatch:'Follow-up Watch',treatmentStats:'Treatment Stats',unpaidPriority:'Unpaid Priority',remaining:'Remaining',cases:'cases',photos:'Photos / X-rays',clinical:'Clinical',xray:'X-ray',beforeAfter:'Before / After',general:'General',before:'Before',after:'After',photoOptions:'Photo options',markAs:'Mark as',viewPhoto:'View photo',theme:'Theme color',themeHelp:'Choose a premium preset or pick any custom color.',customColor:'Custom color',applyCustom:'Apply custom color',presets:'Premium presets',pdf:'PDF style',doctorCard:'Doctor card',signature:'Draw signature',tools:'Clinic tools and preferences in one simple place.',noBA:'Mark one photo as Before and one photo as After from the 3-dot menu.',noPhotos:'No photos in this section yet.',baHint:'The Before and After photos are selected from the 3-dot menu. Move the bar for a soft blurry transition.',addPayment:'+ Add Payment',installments:'Installments',receipt:'Receipt',delete:'Delete',patientTimeline:'Patient Timeline',visit:'Visit'},
    ar:{native:'العربية',dir:'rtl',language:'اللغة',languageHelp:'اختر لغة واجهة التطبيق.',menu:'القائمة',dashboard:'لوحة التحكم',patients:'المرضى',addPatient:'إضافة مريض',scanQR:'مسح QR',settings:'الإعدادات',profile:'الملف الشخصي',manageUsers:'إدارة المستخدمين',logout:'تسجيل الخروج',search:'ابحث بالاسم أو الهاتف أو الكود أو التشخيص...',totalPatients:'إجمالي المرضى',todaysAppts:'مواعيد اليوم',unpaidBalance:'المتبقي غير المدفوع',totalVisits:'إجمالي الزيارات',totalRevenue:'إجمالي الإيرادات',paidToday:'مدفوع اليوم',clinicOverview:'نظرة عامة على العيادة',appointmentCalendar:'تقويم المواعيد',today:'اليوم',upcoming:'القادم',newPatient:'+ مريض جديد',backup:'نسخة احتياطية',restore:'استرجاع',open:'فتح',withoutTreatmentPlan:'بدون خطة علاج',overdue:'متأخر',unpaid:'غير مدفوع',followUpWatch:'متابعة المرضى',treatmentStats:'إحصائيات العلاج',unpaidPriority:'أولوية المتبقي',remaining:'المتبقي',cases:'حالات',photos:'الصور / الأشعة',clinical:'سريري',xray:'أشعة',beforeAfter:'قبل / بعد',general:'عام',before:'قبل',after:'بعد',photoOptions:'خيارات الصورة',markAs:'تحديد كـ',viewPhoto:'عرض الصورة',theme:'لون التطبيق',themeHelp:'اختر لوناً جاهزاً أو لوناً مخصصاً.',customColor:'لون مخصص',applyCustom:'تطبيق اللون',presets:'ألوان مميزة',pdf:'شكل PDF',doctorCard:'بطاقة الطبيب',signature:'رسم التوقيع',tools:'أدوات العيادة والإعدادات في مكان واحد.',noBA:'حدد صورة قبل وصورة بعد من قائمة الثلاث نقاط.',noPhotos:'لا توجد صور في هذا القسم.',baHint:'صور قبل وبعد يتم اختيارها من قائمة الثلاث نقاط. حرّك الشريط لانتقال ضبابي ناعم.',addPayment:'+ إضافة دفعة',installments:'الأقساط',receipt:'إيصال',delete:'حذف',patientTimeline:'سجل المريض',visit:'زيارة'},
    fr:{native:'Français',dir:'ltr',language:'Langue',languageHelp:'Choisissez la langue de l’interface.',menu:'Menu',dashboard:'Tableau',patients:'Patients',addPatient:'Ajouter patient',scanQR:'Scanner QR',settings:'Réglages',profile:'Profil',manageUsers:'Utilisateurs',logout:'Déconnexion',search:'Rechercher nom, téléphone, ID ou diagnostic...',totalPatients:'Total patients',todaysAppts:'RDV du jour',unpaidBalance:'Solde impayé',totalVisits:'Total visites',totalRevenue:'Revenu total',paidToday:'Payé aujourd’hui',clinicOverview:'Vue clinique',appointmentCalendar:'Calendrier',today:'Aujourd’hui',upcoming:'À venir',newPatient:'+ Nouveau patient',backup:'Sauvegarde',restore:'Restaurer',open:'Ouvrir',withoutTreatmentPlan:'sans plan de traitement',overdue:'en retard',unpaid:'impayé',followUpWatch:'Suivi',treatmentStats:'Statistiques traitement',unpaidPriority:'Impayés prioritaires',remaining:'Restant',cases:'cas',photos:'Photos / Radios',clinical:'Clinique',xray:'Radio',beforeAfter:'Avant / Après',general:'Général',before:'Avant',after:'Après',photoOptions:'Options photo',markAs:'Marquer comme',viewPhoto:'Voir photo',theme:'Couleur',themeHelp:'Choisissez une couleur premium ou personnalisée.',customColor:'Couleur personnalisée',applyCustom:'Appliquer',presets:'Couleurs premium',pdf:'Style PDF',doctorCard:'Carte médecin',signature:'Signature',tools:'Outils et préférences de la clinique.',noBA:'Marquez une photo Avant et une photo Après depuis le menu à 3 points.',noPhotos:'Aucune photo dans cette section.',baHint:'Les photos Avant/Après viennent du menu à 3 points. Déplacez la barre pour une transition douce.',addPayment:'+ Ajouter paiement',installments:'Versements',receipt:'Reçu',delete:'Supprimer',patientTimeline:'Historique patient',visit:'Visite'},
    es:{native:'Español',dir:'ltr',language:'Idioma',languageHelp:'Elige el idioma de la interfaz.',menu:'Menú',dashboard:'Panel',patients:'Pacientes',addPatient:'Añadir paciente',scanQR:'Escanear QR',settings:'Ajustes',profile:'Perfil',manageUsers:'Usuarios',logout:'Salir',search:'Buscar nombre, teléfono, ID o diagnóstico...',totalPatients:'Pacientes totales',todaysAppts:'Citas de hoy',unpaidBalance:'Saldo pendiente',totalVisits:'Visitas totales',totalRevenue:'Ingresos totales',paidToday:'Pagado hoy',clinicOverview:'Resumen clínica',appointmentCalendar:'Calendario',today:'Hoy',upcoming:'Próximas',newPatient:'+ Nuevo paciente',backup:'Copia',restore:'Restaurar',open:'Abrir',withoutTreatmentPlan:'sin plan de tratamiento',overdue:'atrasado',unpaid:'pendiente',followUpWatch:'Seguimiento',treatmentStats:'Estadísticas',unpaidPriority:'Pendientes prioritarios',remaining:'Restante',cases:'casos',photos:'Fotos / Rayos X',clinical:'Clínica',xray:'Rayos X',beforeAfter:'Antes / Después',general:'General',before:'Antes',after:'Después',photoOptions:'Opciones de foto',markAs:'Marcar como',viewPhoto:'Ver foto',theme:'Color',themeHelp:'Elige un color premium o personalizado.',customColor:'Color personalizado',applyCustom:'Aplicar color',presets:'Colores premium',pdf:'Estilo PDF',doctorCard:'Tarjeta doctor',signature:'Firma',tools:'Herramientas y preferencias de la clínica.',noBA:'Marca una foto como Antes y otra como Después desde el menú de 3 puntos.',noPhotos:'No hay fotos en esta sección.',baHint:'Las fotos Antes/Después se eligen desde el menú de 3 puntos. Mueve la barra para una transición suave.',addPayment:'+ Añadir pago',installments:'Cuotas',receipt:'Recibo',delete:'Eliminar',patientTimeline:'Historial del paciente',visit:'Visita'},
    de:{native:'Deutsch',dir:'ltr',language:'Sprache',languageHelp:'Wählen Sie die Sprache der App.',menu:'Menü',dashboard:'Dashboard',patients:'Patienten',addPatient:'Patient hinzufügen',scanQR:'QR scannen',settings:'Einstellungen',profile:'Profil',manageUsers:'Benutzer',logout:'Abmelden',search:'Name, Telefon, ID oder Diagnose suchen...',totalPatients:'Patienten gesamt',todaysAppts:'Termine heute',unpaidBalance:'Offener Betrag',totalVisits:'Besuche gesamt',totalRevenue:'Umsatz gesamt',paidToday:'Heute bezahlt',clinicOverview:'Praxisübersicht',appointmentCalendar:'Kalender',today:'Heute',upcoming:'Anstehend',newPatient:'+ Neuer Patient',backup:'Backup',restore:'Wiederherstellen',open:'Öffnen',withoutTreatmentPlan:'ohne Behandlungsplan',overdue:'überfällig',unpaid:'unbezahlt',followUpWatch:'Nachverfolgung',treatmentStats:'Behandlungsstatistik',unpaidPriority:'Offene Zahlungen',remaining:'Restbetrag',cases:'Fälle',photos:'Fotos / Röntgen',clinical:'Klinisch',xray:'Röntgen',beforeAfter:'Vorher / Nachher',general:'Allgemein',before:'Vorher',after:'Nachher',photoOptions:'Fotooptionen',markAs:'Markieren als',viewPhoto:'Foto ansehen',theme:'Farbe',themeHelp:'Wählen Sie eine Premium- oder eigene Farbe.',customColor:'Eigene Farbe',applyCustom:'Anwenden',presets:'Premiumfarben',pdf:'PDF-Stil',doctorCard:'Arztkarte',signature:'Unterschrift',tools:'Praxiswerkzeuge und Einstellungen.',noBA:'Markieren Sie ein Foto als Vorher und eines als Nachher im Drei-Punkte-Menü.',noPhotos:'Keine Fotos in diesem Bereich.',baHint:'Vorher/Nachher-Fotos werden im Drei-Punkte-Menü gewählt. Bewegen Sie den Regler für weichen Übergang.',addPayment:'+ Zahlung hinzufügen',installments:'Raten',receipt:'Quittung',delete:'Löschen',patientTimeline:'Patientenverlauf',visit:'Besuch'},
    it:{native:'Italiano',dir:'ltr',language:'Lingua',languageHelp:'Scegli la lingua dell’interfaccia.',menu:'Menu',dashboard:'Cruscotto',patients:'Pazienti',addPatient:'Aggiungi paziente',scanQR:'Scansiona QR',settings:'Impostazioni',profile:'Profilo',manageUsers:'Utenti',logout:'Esci',search:'Cerca nome, telefono, ID o diagnosi...',totalPatients:'Pazienti totali',todaysAppts:'Appuntamenti oggi',unpaidBalance:'Saldo non pagato',totalVisits:'Visite totali',totalRevenue:'Entrate totali',paidToday:'Pagato oggi',clinicOverview:'Panoramica clinica',appointmentCalendar:'Calendario',today:'Oggi',upcoming:'Prossimi',newPatient:'+ Nuovo paziente',backup:'Backup',restore:'Ripristina',open:'Apri',withoutTreatmentPlan:'senza piano di trattamento',overdue:'in ritardo',unpaid:'non pagato',followUpWatch:'Follow-up',treatmentStats:'Statistiche trattamenti',unpaidPriority:'Pagamenti aperti',remaining:'Rimanente',cases:'casi',photos:'Foto / Radiografie',clinical:'Clinica',xray:'Radiografia',beforeAfter:'Prima / Dopo',general:'Generale',before:'Prima',after:'Dopo',photoOptions:'Opzioni foto',markAs:'Segna come',viewPhoto:'Vedi foto',theme:'Colore',themeHelp:'Scegli un colore premium o personalizzato.',customColor:'Colore personalizzato',applyCustom:'Applica',presets:'Colori premium',pdf:'Stile PDF',doctorCard:'Scheda medico',signature:'Firma',tools:'Strumenti e preferenze della clinica.',noBA:'Segna una foto come Prima e una come Dopo dal menu a 3 punti.',noPhotos:'Nessuna foto in questa sezione.',baHint:'Le foto Prima/Dopo vengono scelte dal menu a 3 punti. Muovi la barra per una transizione morbida.',addPayment:'+ Aggiungi pagamento',installments:'Rate',receipt:'Ricevuta',delete:'Elimina',patientTimeline:'Cronologia paziente',visit:'Visita'},
    pt:{native:'Português',dir:'ltr',language:'Idioma',languageHelp:'Escolha o idioma da interface.',menu:'Menu',dashboard:'Painel',patients:'Pacientes',addPatient:'Adicionar paciente',scanQR:'Ler QR',settings:'Configurações',profile:'Perfil',manageUsers:'Usuários',logout:'Sair',search:'Pesquisar nome, telefone, ID ou diagnóstico...',totalPatients:'Total de pacientes',todaysAppts:'Consultas hoje',unpaidBalance:'Saldo em aberto',totalVisits:'Total de visitas',totalRevenue:'Receita total',paidToday:'Pago hoje',clinicOverview:'Visão da clínica',appointmentCalendar:'Calendário',today:'Hoje',upcoming:'Próximas',newPatient:'+ Novo paciente',backup:'Backup',restore:'Restaurar',open:'Abrir',withoutTreatmentPlan:'sem plano de tratamento',overdue:'atrasado',unpaid:'em aberto',followUpWatch:'Acompanhamento',treatmentStats:'Estatísticas',unpaidPriority:'Pendentes prioritários',remaining:'Restante',cases:'casos',photos:'Fotos / Raios X',clinical:'Clínica',xray:'Raio X',beforeAfter:'Antes / Depois',general:'Geral',before:'Antes',after:'Depois',photoOptions:'Opções da foto',markAs:'Marcar como',viewPhoto:'Ver foto',theme:'Cor',themeHelp:'Escolha uma cor premium ou personalizada.',customColor:'Cor personalizada',applyCustom:'Aplicar cor',presets:'Cores premium',pdf:'Estilo PDF',doctorCard:'Cartão médico',signature:'Assinatura',tools:'Ferramentas e preferências da clínica.',noBA:'Marque uma foto como Antes e outra como Depois no menu de 3 pontos.',noPhotos:'Nenhuma foto nesta seção.',baHint:'As fotos Antes/Depois são escolhidas no menu de 3 pontos. Mova a barra para uma transição suave.',addPayment:'+ Adicionar pagamento',installments:'Parcelas',receipt:'Recibo',delete:'Excluir',patientTimeline:'Histórico do paciente',visit:'Visita'},
    tr:{native:'Türkçe',dir:'ltr',language:'Dil',languageHelp:'Uygulama arayüz dilini seçin.',menu:'Menü',dashboard:'Panel',patients:'Hastalar',addPatient:'Hasta ekle',scanQR:'QR tara',settings:'Ayarlar',profile:'Profil',manageUsers:'Kullanıcılar',logout:'Çıkış',search:'Ad, telefon, ID veya teşhis ara...',totalPatients:'Toplam hasta',todaysAppts:'Bugünkü randevular',unpaidBalance:'Ödenmemiş bakiye',totalVisits:'Toplam ziyaret',totalRevenue:'Toplam gelir',paidToday:'Bugün ödenen',clinicOverview:'Klinik özeti',appointmentCalendar:'Takvim',today:'Bugün',upcoming:'Yaklaşan',newPatient:'+ Yeni hasta',backup:'Yedek',restore:'Geri yükle',open:'Aç',withoutTreatmentPlan:'tedavi plansız',overdue:'gecikmiş',unpaid:'ödenmemiş',followUpWatch:'Takip',treatmentStats:'Tedavi istatistikleri',unpaidPriority:'Ödenmemiş öncelik',remaining:'Kalan',cases:'vaka',photos:'Fotoğraflar / Röntgen',clinical:'Klinik',xray:'Röntgen',beforeAfter:'Önce / Sonra',general:'Genel',before:'Önce',after:'Sonra',photoOptions:'Foto seçenekleri',markAs:'Olarak işaretle',viewPhoto:'Fotoğrafı aç',theme:'Renk',themeHelp:'Premium veya özel renk seçin.',customColor:'Özel renk',applyCustom:'Uygula',presets:'Premium renkler',pdf:'PDF stili',doctorCard:'Doktor kartı',signature:'İmza',tools:'Klinik araçları ve ayarları.',noBA:'3 nokta menüsünden bir fotoğrafı Önce, birini Sonra olarak işaretleyin.',noPhotos:'Bu bölümde fotoğraf yok.',baHint:'Önce/Sonra fotoğrafları 3 nokta menüsünden seçilir. Yumuşak geçiş için çubuğu hareket ettirin.',addPayment:'+ Ödeme ekle',installments:'Taksitler',receipt:'Makbuz',delete:'Sil',patientTimeline:'Hasta zaman çizelgesi',visit:'Ziyaret'},
    ru:{native:'Русский',dir:'ltr',language:'Язык',languageHelp:'Выберите язык интерфейса.',menu:'Меню',dashboard:'Панель',patients:'Пациенты',addPatient:'Добавить пациента',scanQR:'QR скан',settings:'Настройки',profile:'Профиль',manageUsers:'Пользователи',logout:'Выйти',search:'Поиск имени, телефона, ID или диагноза...',totalPatients:'Всего пациентов',todaysAppts:'Приёмы сегодня',unpaidBalance:'Неоплачено',totalVisits:'Всего визитов',totalRevenue:'Общий доход',paidToday:'Оплачено сегодня',clinicOverview:'Обзор клиники',appointmentCalendar:'Календарь',today:'Сегодня',upcoming:'Предстоящие',newPatient:'+ Новый пациент',backup:'Резерв',restore:'Восстановить',open:'Открыть',withoutTreatmentPlan:'без плана лечения',overdue:'просрочено',unpaid:'не оплачено',followUpWatch:'Контроль',treatmentStats:'Статистика лечения',unpaidPriority:'Неоплаченные',remaining:'Осталось',cases:'случаи',photos:'Фото / Рентген',clinical:'Клинические',xray:'Рентген',beforeAfter:'До / После',general:'Общие',before:'До',after:'После',photoOptions:'Параметры фото',markAs:'Отметить как',viewPhoto:'Открыть фото',theme:'Цвет',themeHelp:'Выберите премиум или свой цвет.',customColor:'Свой цвет',applyCustom:'Применить',presets:'Премиум цвета',pdf:'Стиль PDF',doctorCard:'Карта врача',signature:'Подпись',tools:'Инструменты и настройки клиники.',noBA:'Отметьте одно фото как До, а другое как После в меню с 3 точками.',noPhotos:'В этом разделе нет фото.',baHint:'Фото До/После выбираются из меню с 3 точками. Двигайте ползунок для мягкого перехода.',addPayment:'+ Добавить оплату',installments:'Рассрочка',receipt:'Квитанция',delete:'Удалить',patientTimeline:'История пациента',visit:'Визит'},
    zh:{native:'中文',dir:'ltr',language:'语言',languageHelp:'选择应用界面语言。',menu:'菜单',dashboard:'仪表板',patients:'患者',addPatient:'添加患者',scanQR:'扫描 QR',settings:'设置',profile:'资料',manageUsers:'用户',logout:'退出',search:'搜索姓名、电话、ID 或诊断...',totalPatients:'患者总数',todaysAppts:'今日预约',unpaidBalance:'未付余额',totalVisits:'总访问',totalRevenue:'总收入',paidToday:'今日已付',clinicOverview:'诊所概览',appointmentCalendar:'预约日历',today:'今天',upcoming:'即将到来',newPatient:'+ 新患者',backup:'备份',restore:'恢复',open:'打开',withoutTreatmentPlan:'无治疗计划',overdue:'逾期',unpaid:'未付',followUpWatch:'随访监控',treatmentStats:'治疗统计',unpaidPriority:'未付款优先',remaining:'剩余',cases:'病例',photos:'照片 / X光',clinical:'临床',xray:'X光',beforeAfter:'前 / 后',general:'普通',before:'前',after:'后',photoOptions:'照片选项',markAs:'标记为',viewPhoto:'查看照片',theme:'主题色',themeHelp:'选择高级预设或自定义颜色。',customColor:'自定义颜色',applyCustom:'应用颜色',presets:'高级预设',pdf:'PDF 样式',doctorCard:'医生卡',signature:'签名',tools:'诊所工具和偏好设置。',noBA:'请从三点菜单标记一张前照和一张后照。',noPhotos:'此部分没有照片。',baHint:'前后照片来自三点菜单。移动滑杆实现柔和过渡。',addPayment:'+ 添加付款',installments:'分期',receipt:'收据',delete:'删除',patientTimeline:'患者时间线',visit:'访问'},
    hi:{native:'हिन्दी',dir:'ltr',language:'भाषा',languageHelp:'ऐप इंटरफ़ेस की भाषा चुनें।',menu:'मेनू',dashboard:'डैशबोर्ड',patients:'मरीज़',addPatient:'मरीज़ जोड़ें',scanQR:'QR स्कैन',settings:'सेटिंग्स',profile:'प्रोफ़ाइल',manageUsers:'यूज़र',logout:'लॉग आउट',search:'नाम, फोन, ID या निदान खोजें...',totalPatients:'कुल मरीज़',todaysAppts:'आज की अपॉइंटमेंट',unpaidBalance:'बकाया राशि',totalVisits:'कुल विज़िट',totalRevenue:'कुल आय',paidToday:'आज भुगतान',clinicOverview:'क्लिनिक अवलोकन',appointmentCalendar:'अपॉइंटमेंट कैलेंडर',today:'आज',upcoming:'आगामी',newPatient:'+ नया मरीज़',backup:'बैकअप',restore:'रीस्टोर',open:'खोलें',withoutTreatmentPlan:'बिना उपचार योजना',overdue:'देरी',unpaid:'अवैतनिक',followUpWatch:'फॉलो-अप',treatmentStats:'उपचार आँकड़े',unpaidPriority:'बकाया प्राथमिकता',remaining:'शेष',cases:'केस',photos:'फोटो / एक्स-रे',clinical:'क्लिनिकल',xray:'एक्स-रे',beforeAfter:'पहले / बाद',general:'सामान्य',before:'पहले',after:'बाद',photoOptions:'फोटो विकल्प',markAs:'चिह्नित करें',viewPhoto:'फोटो देखें',theme:'रंग',themeHelp:'प्रीमियम रंग या कस्टम रंग चुनें।',customColor:'कस्टम रंग',applyCustom:'रंग लागू करें',presets:'प्रीमियम रंग',pdf:'PDF शैली',doctorCard:'डॉक्टर कार्ड',signature:'हस्ताक्षर',tools:'क्लिनिक टूल और सेटिंग्स।',noBA:'3-dot मेनू से एक फोटो Before और एक After चिह्नित करें।',noPhotos:'इस सेक्शन में कोई फोटो नहीं है।',baHint:'Before/After फोटो 3-dot मेनू से चुने जाते हैं। सॉफ्ट ट्रांज़िशन के लिए बार चलाएं।',addPayment:'+ भुगतान जोड़ें',installments:'किश्तें',receipt:'रसीद',delete:'हटाएं',patientTimeline:'मरीज़ टाइमलाइन',visit:'विज़िट'},
    ur:{native:'اردو',dir:'rtl',language:'زبان',languageHelp:'ایپ انٹرفیس کی زبان منتخب کریں۔',menu:'مینو',dashboard:'ڈیش بورڈ',patients:'مریض',addPatient:'مریض شامل کریں',scanQR:'QR اسکین',settings:'ترتیبات',profile:'پروفائل',manageUsers:'صارفین',logout:'لاگ آؤٹ',search:'نام، فون، ID یا تشخیص تلاش کریں...',totalPatients:'کل مریض',todaysAppts:'آج کی اپائنٹمنٹس',unpaidBalance:'بقایہ رقم',totalVisits:'کل وزٹس',totalRevenue:'کل آمدنی',paidToday:'آج ادا شدہ',clinicOverview:'کلینک کا جائزہ',appointmentCalendar:'اپائنٹمنٹ کیلنڈر',today:'آج',upcoming:'آنے والی',newPatient:'+ نیا مریض',backup:'بیک اپ',restore:'بحال',open:'کھولیں',withoutTreatmentPlan:'بغیر علاج پلان',overdue:'تاخیر',unpaid:'بقایہ',followUpWatch:'فالو اپ',treatmentStats:'علاج کے اعداد و شمار',unpaidPriority:'بقایہ ترجیح',remaining:'باقی',cases:'کیسز',photos:'تصاویر / ایکس رے',clinical:'کلینیکل',xray:'ایکس رے',beforeAfter:'پہلے / بعد',general:'عام',before:'پہلے',after:'بعد',photoOptions:'تصویر کے اختیارات',markAs:'نشان لگائیں',viewPhoto:'تصویر دیکھیں',theme:'رنگ',themeHelp:'پریمیم یا کسٹم رنگ منتخب کریں۔',customColor:'کسٹم رنگ',applyCustom:'رنگ لگائیں',presets:'پریمیم رنگ',pdf:'PDF انداز',doctorCard:'ڈاکٹر کارڈ',signature:'دستخط',tools:'کلینک ٹولز اور سیٹنگز۔',noBA:'تین نقطوں والے مینو سے ایک تصویر پہلے اور ایک بعد کے طور پر نشان لگائیں۔',noPhotos:'اس حصے میں کوئی تصویر نہیں۔',baHint:'پہلے/بعد کی تصاویر تین نقطوں والے مینو سے منتخب ہوتی ہیں۔ نرم منتقلی کے لیے بار حرکت دیں۔',addPayment:'+ ادائیگی شامل کریں',installments:'اقساط',receipt:'رسید',delete:'حذف',patientTimeline:'مریض کا ریکارڈ',visit:'وزٹ'},
    fa:{native:'فارسی',dir:'rtl',language:'زبان',languageHelp:'زبان رابط برنامه را انتخاب کنید.',menu:'منو',dashboard:'داشبورد',patients:'بیماران',addPatient:'افزودن بیمار',scanQR:'اسکن QR',settings:'تنظیمات',profile:'پروفایل',manageUsers:'کاربران',logout:'خروج',search:'جستجو بر اساس نام، تلفن، ID یا تشخیص...',totalPatients:'کل بیماران',todaysAppts:'نوبت‌های امروز',unpaidBalance:'مانده پرداخت نشده',totalVisits:'کل ویزیت‌ها',totalRevenue:'درآمد کل',paidToday:'پرداخت امروز',clinicOverview:'نمای کلی کلینیک',appointmentCalendar:'تقویم نوبت‌ها',today:'امروز',upcoming:'آینده',newPatient:'+ بیمار جدید',backup:'پشتیبان',restore:'بازیابی',open:'باز کردن',withoutTreatmentPlan:'بدون طرح درمان',overdue:'عقب‌افتاده',unpaid:'پرداخت نشده',followUpWatch:'پیگیری',treatmentStats:'آمار درمان',unpaidPriority:'اولویت بدهی',remaining:'مانده',cases:'مورد',photos:'عکس‌ها / رادیوگرافی',clinical:'کلینیکی',xray:'رادیوگرافی',beforeAfter:'قبل / بعد',general:'عمومی',before:'قبل',after:'بعد',photoOptions:'گزینه‌های عکس',markAs:'علامت‌گذاری به عنوان',viewPhoto:'نمایش عکس',theme:'رنگ',themeHelp:'یک رنگ آماده یا رنگ دلخواه انتخاب کنید.',customColor:'رنگ دلخواه',applyCustom:'اعمال رنگ',presets:'رنگ‌های ویژه',pdf:'سبک PDF',doctorCard:'کارت پزشک',signature:'امضا',tools:'ابزارها و تنظیمات کلینیک.',noBA:'از منوی سه نقطه یک عکس قبل و یک عکس بعد تعیین کنید.',noPhotos:'عکسی در این بخش نیست.',baHint:'عکس‌های قبل/بعد از منوی سه نقطه انتخاب می‌شوند. برای انتقال نرم نوار را حرکت دهید.',addPayment:'+ افزودن پرداخت',installments:'اقساط',receipt:'رسید',delete:'حذف',patientTimeline:'سوابق بیمار',visit:'ویزیت'}
  };
  const IOS_LANGS = [['af','Afrikaans'],['am','አማርኛ'],['az','Azərbaycanca'],['bg','Български'],['bn','বাংলা'],['bs','Bosanski'],['ca','Català'],['cs','Čeština'],['cy','Cymraeg'],['da','Dansk'],['el','Ελληνικά'],['et','Eesti'],['eu','Euskara'],['fi','Suomi'],['fil','Filipino'],['ga','Gaeilge'],['gl','Galego'],['gu','ગુજરાતી'],['he','עברית'],['hr','Hrvatski'],['hu','Magyar'],['id','Bahasa Indonesia'],['is','Íslenska'],['ja','日本語'],['kn','ಕನ್ನಡ'],['kk','Қазақша'],['km','ភាសាខ្មែរ'],['ko','한국어'],['lo','ລາວ'],['lt','Lietuvių'],['lv','Latviešu'],['mk','Македонски'],['ml','മലയാളം'],['mn','Монгол'],['mr','मराठी'],['ms','Bahasa Melayu'],['my','မြန်မာ'],['nb','Norsk Bokmål'],['ne','नेपाली'],['nl','Nederlands'],['pa','ਪੰਜਾਬੀ'],['pl','Polski'],['ro','Română'],['sk','Slovenčina'],['sl','Slovenščina'],['sq','Shqip'],['sr','Српски'],['sv','Svenska'],['sw','Kiswahili'],['ta','தமிழ்'],['te','తెలుగు'],['th','ไทย'],['uk','Українська'],['vi','Tiếng Việt'],['zu','Zulu']];
  IOS_LANGS.forEach(([code,native])=>{ if(!PACKS[code]) PACKS[code] = Object.assign({}, PACKS.en, {native, dir:RTL.has(code)?'rtl':'ltr'}); });
  function currentLang(){ return localStorage.getItem('clinicLanguage') || 'en'; }
  function L(key){ const p = PACKS[currentLang()] || PACKS.en; return p[key] || PACKS.en[key] || key; }
  try { window.__LANG_PACKS__ = PACKS; window.getLang = getLang = currentLang; window.t = t = L; } catch(e) { window.getLang = currentLang; window.t = L; }

  const textMap = {
    'Dashboard':'dashboard','Patients':'patients','Add Patient':'addPatient','Scan QR':'scanQR','Settings':'settings','Profile':'profile','Manage Users':'manageUsers','Logout':'logout','Menu':'menu','Search by name, phone, ID, or diagnosis...':'search','Search name, phone, ID, diagnosis...':'search','Total Patients':'totalPatients',"Today's Appts":'todaysAppts','Unpaid Balance':'unpaidBalance','Total Visits':'totalVisits','Total Revenue':'totalRevenue','Paid Today':'paidToday','Clinic Overview':'clinicOverview','Appointment Calendar':'appointmentCalendar','Today':'today','Upcoming':'upcoming','+ New Patient':'newPatient','Backup':'backup','Restore':'restore','Open':'open','without treatment plan':'withoutTreatmentPlan','overdue':'overdue','unpaid':'unpaid','Follow-up Watch':'followUpWatch','Treatment Stats':'treatmentStats','Unpaid Priority':'unpaidPriority','Remaining':'remaining','cases':'cases','Photos / X-rays':'photos','Clinical':'clinical','X-ray':'xray','X-rays':'xray','Before / After':'beforeAfter','General':'general','Before':'before','After':'after','Photo options':'photoOptions','Mark as':'markAs','View photo':'viewPhoto','Theme color':'theme','PDF style':'pdf','Doctor card':'doctorCard','Draw signature':'signature','Custom color':'customColor','Apply custom color':'applyCustom','Premium presets':'presets','+ Add Payment':'addPayment','Add Payment +':'addPayment','Installments':'installments','Receipt':'receipt','Delete':'delete','Patient Timeline':'patientTimeline','VISIT':'visit','Visit':'visit','Language':'language'
  };
  const allLocalized = {};
  Object.values(PACKS).forEach(pack => Object.keys(pack).forEach(k => { if(k==='native' || k==='dir') return; const v = pack[k]; if(typeof v === 'string') allLocalized[v] = k; }));
  function keyForText(txt){ return textMap[txt] || allLocalized[txt]; }
  function applyText(root){
    const code = currentLang(); const pack = PACKS[code] || PACKS.en;
    document.documentElement.lang = code; document.documentElement.dir = pack.dir || 'ltr'; document.body.dir = pack.dir || 'ltr'; document.body.dataset.lang = code;
    document.querySelectorAll('[data-page="dashboard"]').forEach(el=>el.textContent=L('dashboard'));
    document.querySelectorAll('[data-page="patients"]').forEach(el=>el.textContent=L('patients'));
    document.querySelectorAll('[data-page="form"]').forEach(el=>el.textContent=L('addPatient'));
    document.querySelectorAll('[data-page="scan"]').forEach(el=>el.textContent=L('scanQR'));
    const menuBtn = document.getElementById('menuBtn'); if(menuBtn) menuBtn.textContent = L('menu');
    const search = document.getElementById('search'); if(search) search.placeholder = L('search');
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el=>{ const k = keyForText(el.getAttribute('placeholder')); if(k) el.setAttribute('placeholder', L(k)); });
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {acceptNode(n){ if(!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT; const p=n.parentElement; if(!p || ['SCRIPT','STYLE','TEXTAREA','INPUT','OPTION'].includes(p.tagName)) return NodeFilter.FILTER_REJECT; if(p.closest('#languageCleanOverlay, .no-translate, [translate="no"], [data-native-code], .clean-language-item')) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; }});
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n=>{ const raw=n.nodeValue.trim(); const k=keyForText(raw); if(k) n.nodeValue = n.nodeValue.replace(raw, L(k)); });
  }
  window.applyLanguage = applyLanguage = function(){ applyText(document.body); };
  window.setUILanguage = setUILanguage = function(code){
    localStorage.setItem('clinicLanguage', PACKS[code] ? code : 'en');
    document.getElementById('languageCleanOverlay')?.remove();
    try { if(typeof renderDashboard==='function') renderDashboard(); } catch(e) {}
    try { if(typeof renderPatients==='function') renderPatients(); } catch(e) {}
    try { if(document.getElementById('detail')?.classList.contains('active') && window.__lastOpenedPatientId && typeof openPatient==='function') openPatient(window.__lastOpenedPatientId); } catch(e) {}
    setTimeout(()=>applyText(document.body),0);
    setTimeout(()=>applyText(document.body),120);
  };
  window.openLanguagePicker = function(){
    document.getElementById('languageCleanOverlay')?.remove();
    const current = currentLang();
    const codes = Object.keys(PACKS).sort((a,b)=>(PACKS[a].native||a).localeCompare(PACKS[b].native||b));
    const overlay = document.createElement('div'); overlay.id='languageCleanOverlay'; overlay.className='clean-modal-overlay no-translate'; overlay.setAttribute('translate','no');
    overlay.innerHTML = `<div class="clean-modal clean-language-modal final-language-modal no-translate" role="dialog" aria-modal="true" dir="ltr" translate="no"><div class="clean-modal-head"><div><h2>${safeText(L('language'))}</h2><p>${safeText(L('languageHelp'))}</p></div><button type="button" onclick="document.getElementById('languageCleanOverlay')?.remove()">×</button></div><div class="final-language-search"><input id="languageSearchInput" placeholder="Search language..." oninput="filterLanguagesFinal(this.value)"></div><div class="clean-language-grid final-language-grid">${codes.map(code=>`<button type="button" translate="no" data-native-code="${code}" data-language-item="${safeText(code+' '+PACKS[code].native)}" class="clean-language-item no-translate ${current===code?'active':''}" dir="${PACKS[code].dir}" onclick="setUILanguage('${code}')"><strong translate="no">${safeText(PACKS[code].native)}</strong><span translate="no">${safeText(code.toUpperCase())}</span></button>`).join('')}</div></div>`;
    overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    setTimeout(()=>document.getElementById('languageSearchInput')?.focus(),80);
  };
  window.filterLanguagesFinal = function(q){ q=String(q||'').toLowerCase(); document.querySelectorAll('[data-language-item]').forEach(btn=>{ btn.style.display = btn.dataset.languageItem.toLowerCase().includes(q) ? '' : 'none'; }); };
  try {
    const oldOpenPatient = openPatient;
    window.openPatient = openPatient = function(id){ window.__lastOpenedPatientId = id; const out = oldOpenPatient.apply(this, arguments); setTimeout(()=>applyText(document.body),0); setTimeout(()=>applyText(document.body),150); return out; };
  } catch(e) {}
  ['renderDashboard','renderPatients','showPage'].forEach(name=>{
    try { const old = window[name] || eval(name); if(typeof old !== 'function' || old.__langWrapped) return; const wrapped=function(){ const out=old.apply(this, arguments); setTimeout(()=>applyText(document.body),0); setTimeout(()=>applyText(document.body),120); return out; }; wrapped.__langWrapped=true; window[name]=wrapped; eval(name+' = wrapped'); } catch(e) {}
  });
  let pending=false; const mo = new MutationObserver(()=>{ if(pending) return; pending=true; setTimeout(()=>{ pending=false; applyText(document.body); },60); });
  function start(){ applyText(document.body); try { mo.observe(document.body,{childList:true,subtree:true}); } catch(e) {} }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
/* === FINAL LANGUAGE PICKER NAME FIX: keep native names, do not translate language list === */
(function(){
  const RTL = new Set(['ar','he','ur','fa','ps','ku','sd','ug','yi']);
  const LANGUAGE_OPTIONS = [
    ['en','English'],['ar','العربية'],['fr','Français'],['es','Español'],['de','Deutsch'],['it','Italiano'],['pt','Português'],['tr','Türkçe'],['ur','اردو'],['fa','فارسی'],
    ['af','Afrikaans'],['am','አማርኛ'],['az','Azərbaycanca'],['bg','Български'],['bn','বাংলা'],['bs','Bosanski'],['ca','Català'],['cs','Čeština'],['cy','Cymraeg'],['da','Dansk'],
    ['el','Ελληνικά'],['et','Eesti'],['eu','Euskara'],['fi','Suomi'],['fil','Filipino'],['ga','Gaeilge'],['gl','Galego'],['gu','ગુજરાતી'],['he','עברית'],['hi','हिन्दी'],
    ['hr','Hrvatski'],['hu','Magyar'],['id','Bahasa Indonesia'],['is','Íslenska'],['ja','日本語'],['kn','ಕನ್ನಡ'],['kk','Қазақша'],['km','ភាសាខ្មែរ'],['ko','한국어'],['lo','ລາວ'],
    ['lt','Lietuvių'],['lv','Latviešu'],['mk','Македонски'],['ml','മലയാളം'],['mn','Монгол'],['mr','मराठी'],['ms','Bahasa Melayu'],['my','မြန်မာ'],['nb','Norsk Bokmål'],['ne','नेपाली'],
    ['nl','Nederlands'],['pa','ਪੰਜਾਬੀ'],['pl','Polski'],['ro','Română'],['ru','Русский'],['sk','Slovenčina'],['sl','Slovenščina'],['sq','Shqip'],['sr','Српски'],['sv','Svenska'],
    ['sw','Kiswahili'],['ta','தமிழ்'],['te','తెలుగు'],['th','ไทย'],['uk','Українська'],['vi','Tiếng Việt'],['zh','中文'],['zu','Zulu']
  ];
  const labelMap = Object.fromEntries(LANGUAGE_OPTIONS);
  function esc(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function langTitle(){ try { return (window.t && window.t('language')) || 'Language'; } catch(e){ return 'Language'; } }
  function langHelp(){ try { return (window.t && window.t('languageHelp')) || 'Choose the language for the app interface.'; } catch(e){ return 'Choose the language for the app interface.'; } }
  function refreshNativeNames(){
    document.querySelectorAll('#languageCleanOverlay [data-native-code]').forEach(btn=>{
      const code = btn.getAttribute('data-native-code');
      const strong = btn.querySelector('strong');
      const span = btn.querySelector('span');
      if(strong) strong.textContent = labelMap[code] || code.toUpperCase();
      if(span) span.textContent = code.toUpperCase();
      btn.dir = RTL.has(code) ? 'rtl' : 'ltr';
      btn.dataset.languageItem = (code + ' ' + (labelMap[code] || '')).toLowerCase();
    });
  }
  window.filterLanguagesFinal = function(q){
    q = String(q||'').toLowerCase().trim();
    document.querySelectorAll('#languageCleanOverlay [data-native-code]').forEach(btn=>{
      const hay = (btn.dataset.languageItem || '').toLowerCase();
      btn.style.display = !q || hay.includes(q) ? '' : 'none';
    });
  };
  window.openLanguagePicker = function(){
    document.getElementById('languageCleanOverlay')?.remove();
    const current = localStorage.getItem('clinicLanguage') || 'en';
    const overlay = document.createElement('div');
    overlay.id = 'languageCleanOverlay';
    overlay.className = 'clean-modal-overlay no-translate';
    overlay.setAttribute('translate','no');
    const optionsHtml = LANGUAGE_OPTIONS.map(([code,name]) => `
      <button type="button" translate="no" data-native-code="${esc(code)}" data-language-item="${esc((code+' '+name).toLowerCase())}" class="clean-language-item no-translate ${current===code?'active':''}" dir="${RTL.has(code)?'rtl':'ltr'}" onclick="setUILanguage('${esc(code)}')">
        <strong translate="no">${esc(name)}</strong><span translate="no">${esc(code.toUpperCase())}</span>
      </button>`).join('');
    overlay.innerHTML = `<div class="clean-modal clean-language-modal final-language-modal no-translate" role="dialog" aria-modal="true" dir="ltr" translate="no">
      <div class="clean-modal-head"><div><h2>${esc(langTitle())}</h2><p>${esc(langHelp())}</p></div><button type="button" onclick="document.getElementById('languageCleanOverlay')?.remove()">×</button></div>
      <div class="final-language-search"><input id="languageSearchInput" placeholder="Search language..." oninput="filterLanguagesFinal(this.value)"></div>
      <div class="clean-language-grid final-language-grid">${optionsHtml}</div>
    </div>`;
    overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    // Older language observer may run right after insertion; restore native names after it finishes.
    [0,80,180,400,900].forEach(ms=>setTimeout(refreshNativeNames, ms));
    setTimeout(()=>document.getElementById('languageSearchInput')?.focus(),120);
  };
  // Make setting a language use the selected code and then reapply the UI, without touching native names.
  const previousSet = window.setUILanguage;
  window.setUILanguage = function(code){
    localStorage.setItem('clinicLanguage', code || 'en');
    document.getElementById('languageCleanOverlay')?.remove();
    if(typeof previousSet === 'function') {
      try { previousSet(code); } catch(e) {}
    }
    try { window.applyLanguage && window.applyLanguage(); } catch(e) {}
    [0,120,350].forEach(ms=>setTimeout(()=>{ try { window.applyLanguage && window.applyLanguage(); } catch(e) {} }, ms));
  };
})();


/* === HARD GUARD APPJS LANGUAGE NAMES: never translate native picker labels === */
(function(){
  const native = {
    en:'English', ar:'العربية', fr:'Français', es:'Español', de:'Deutsch', it:'Italiano', pt:'Português', tr:'Türkçe', ur:'اردو', fa:'فارسی',
    af:'Afrikaans', am:'አማርኛ', az:'Azərbaycanca', bg:'Български', bn:'বাংলা', bs:'Bosanski', ca:'Català', cs:'Čeština', cy:'Cymraeg', da:'Dansk', el:'Ελληνικά', et:'Eesti', eu:'Euskara', fi:'Suomi', fil:'Filipino', ga:'Gaeilge', gl:'Galego', gu:'ગુજરાતી', he:'עברית', hi:'हिन्दी', hr:'Hrvatski', hu:'Magyar', id:'Bahasa Indonesia', is:'Íslenska', ja:'日本語', kn:'ಕನ್ನಡ', kk:'Қазақша', km:'ភាសាខ្មែរ', ko:'한국어', lo:'ລາວ', lt:'Lietuvių', lv:'Latviešu', mk:'Македонски', ml:'മലയാളം', mn:'Монгол', mr:'मराठी', ms:'Bahasa Melayu', my:'မြန်မာ', nb:'Norsk Bokmål', ne:'नेपाली', nl:'Nederlands', pa:'ਪੰਜਾਬੀ', pl:'Polski', ro:'Română', ru:'Русский', sk:'Slovenčina', sl:'Slovenščina', sq:'Shqip', sr:'Српски', sv:'Svenska', sw:'Kiswahili', ta:'தமிழ்', te:'తెలుగు', th:'ไทย', uk:'Українська', vi:'Tiếng Việt', zh:'中文', zu:'Zulu'
  };
  const rtl = new Set(['ar','he','ur','fa','ps','ku','sd','ug','yi']);
  function restore(){
    const overlay = document.getElementById('languageCleanOverlay');
    if(!overlay) return;
    overlay.classList.add('no-translate'); overlay.setAttribute('translate','no');
    const items = overlay.querySelectorAll('.clean-language-item, [data-native-code]');
    items.forEach(btn=>{
      let code = (btn.getAttribute('data-native-code') || '').toLowerCase();
      if(!code){ code = (btn.querySelector('span')?.textContent || '').trim().toLowerCase(); }
      if(!native[code]) return;
      btn.setAttribute('translate','no'); btn.classList.add('no-translate'); btn.dir = rtl.has(code) ? 'rtl':'ltr';
      const strong = btn.querySelector('strong'); const span = btn.querySelector('span');
      if(strong){ strong.textContent = native[code]; strong.setAttribute('translate','no'); }
      if(span){ span.textContent = code.toUpperCase(); span.setAttribute('translate','no'); }
      btn.dataset.languageItem = (code+' '+native[code]).toLowerCase();
    });
  }
  const oldOpen = window.openLanguagePicker;
  window.openLanguagePicker = function(){
    const out = oldOpen ? oldOpen.apply(this, arguments) : undefined;
    [0,10,30,60,120,250,500,1000,1600].forEach(ms=>setTimeout(restore,ms));
    return out;
  };
  const oldApply = window.applyLanguage;
  window.applyLanguage = function(){
    const out = oldApply ? oldApply.apply(this, arguments) : undefined;
    restore();
    return out;
  };
})();


/* === PREMIUM MANAGEMENT UPGRADE: calendar, structured plans, docs, lab, finance, reminders, roles === */
(function(){
  const esc = (v='') => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const todayISO = () => new Date().toISOString().slice(0,10);
  const moneyFmt = v => `${Number(v||0).toLocaleString()} EGP`;
  function getData(p){ const d=parseClinicData(p?.progress_notes); d.treatmentItems=d.treatmentItems||[]; d.prescriptions=d.prescriptions||[]; d.consents=d.consents||[]; d.labWorks=d.labWorks||[]; d.reminders=d.reminders||[]; d.tasks=d.tasks||[]; return d; }
  async function saveData(id, data){ await api(`patients?id=eq.${id}`, {method:'PATCH', body:JSON.stringify({progress_notes:saveClinicData(data)})}); await refreshPatientKeepingScroll(id); }
  function findP(id){ return patients.find(x=>String(x.id)===String(id)); }
  function modal(title, body, opts=''){
    document.getElementById('premiumFeatureModal')?.remove();
    const div=document.createElement('div'); div.id='premiumFeatureModal'; div.className='luxury-modal';
    div.innerHTML=`<div class="luxury-box premium-modal-big" ${opts}><div style="display:flex;justify-content:space-between;gap:12px;align-items:start"><div><h2 style="margin-bottom:4px">${esc(title)}</h2></div><button class="drawer-close-btn" onclick="document.getElementById('premiumFeatureModal')?.remove()">×</button></div>${body}</div>`;
    div.addEventListener('click',e=>{ if(e.target===div) div.remove(); });
    document.body.appendChild(div); return div;
  }
  function field(id,label,type='text',val='',extra='') { return `<div class="field"><label for="${id}">${esc(label)}</label><${type==='textarea'?'textarea':'input'} id="${id}" ${type!=='textarea'?`type="${type}" value="${esc(val)}"`:''} ${extra}>${type==='textarea'?esc(val):''}${type==='textarea'?'</textarea>':''}</div>`; }
  function selectField(id,label,options,val='') { return `<div class="field"><label>${esc(label)}</label><select id="${id}">${options.map(o=>`<option ${String(o)===String(val)?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`; }

  // Dashboard premium shortcuts
  function injectPremiumDashboard(){
    const dash=document.getElementById('dashboardContent'); if(!dash || document.getElementById('premiumDashboardTools')) return;
    const box=document.createElement('div'); box.id='premiumDashboardTools'; box.className='panel';
    box.innerHTML=`<h2>Premium Clinic Tools</h2><p class="muted">Calendar, finance reports, reminders, roles, and clinical documents.</p><div class="premium-tools-grid">
      <button class="premium-tool-btn" onclick="openPremiumCalendar()">Appointment calendar<small>Daily, weekly, monthly view and status tracking</small></button>
      <button class="premium-tool-btn" onclick="openFinancialReports()">Financial reports<small>Daily/monthly income, unpaid balances, doctor revenue</small></button>
      <button class="premium-tool-btn" onclick="openReminderCenter()">Reminders<small>Follow-up, unpaid, lab due, birthday, recall WhatsApp messages</small></button>
      <button class="premium-tool-btn" onclick="openRolePermissions()">Roles & permissions<small>Admin, doctor, assistant, receptionist, accountant</small></button>
    </div>`;
    dash.prepend(box);
  }
  setInterval(injectPremiumDashboard, 1200);

  // Clean menu should include Calendar and Reports but not duplicate setting internals
  const oldMenu = window.openClinicMenu;
  window.openClinicMenu = function(){
    document.getElementById('drawerOverlay')?.remove(); document.getElementById('sideDrawer')?.remove();
    const overlay=document.createElement('div'); overlay.className='drawer-overlay'; overlay.id='drawerOverlay'; overlay.onclick=closeClinicMenu;
    const drawer=document.createElement('aside'); drawer.className='side-drawer'; drawer.id='sideDrawer';
    drawer.innerHTML=`<div class="drawer-head"><h2>Menu</h2><button class="drawer-close-btn" onclick="closeClinicMenu()">×</button></div>
      <div class="drawer-user"><div>${esc(currentUser?.full_name||currentUser?.username||'Admin')}</div><small>${esc((currentUser?.role||'admin').toUpperCase())}</small></div>
      <div class="drawer-menu">
        <button onclick="closeClinicMenu();showPage('form')">Add Patient</button>
        <button onclick="closeClinicMenu();showPage('scan')">Scan QR</button>
        <button class="primary-item" onclick="closeClinicMenu();openPremiumCalendar()">Calendar</button>
        <button onclick="closeClinicMenu();openFinancialReports()">Reports</button>
        <button onclick="closeClinicMenu();showPage('settings')">Settings</button>
        <button onclick="closeClinicMenu();openDoctorProfile()">Profile</button>
        ${currentUser?.role==='admin'?`<button onclick="closeClinicMenu();openRolePermissions()">Manage Users</button>`:''}
        <button class="danger-item" onclick="logout()">Logout</button>
      </div>`;
    document.body.append(overlay,drawer);
  };
  setTimeout(()=>{ const b=document.getElementById('menuBtn'); if(b) b.onclick=window.openClinicMenu; },500);

  // Patient profile enhancement
  const originalPatientDetailsHTML = patientDetailsHTML;
  patientDetailsHTML = function(p){
    const data=getData(p), money=paymentTotals(data);
    const next=(data.appointments||[]).filter(a=>a.date && new Date(a.date)>=new Date(Date.now()-86400000)).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
    const lastVisit=(data.visits||[])[0];
    const alertTxt = (p.medical_alerts||'').trim();
    const summary=`<div class="premium-section"><h3>Patient Command Center</h3><div class="premium-summary-grid">
      <div class="premium-summary-card"><small>Last visit</small><strong>${esc(lastVisit?.date||'No visits')}</strong></div>
      <div class="premium-summary-card"><small>Next appointment</small><strong>${esc(next?.date||'Not scheduled')}</strong></div>
      <div class="premium-summary-card"><small>Remaining</small><strong>${moneyFmt(money.remaining)}</strong></div>
      <div class="premium-summary-card"><small>Treatment stage</small><strong>${treatmentCompletionPercent(p)}%</strong></div>
      <div class="premium-summary-card"><small>Medical alerts</small><strong>${esc(alertTxt||'None')}</strong></div>
      <div class="premium-summary-card"><small>Quick actions</small><div class="premium-pill-grid"><button class="btn-secondary" onclick="generatePrescriptionPro('${p.id}')">Rx</button><button class="btn-secondary" onclick="generateSmartConsentPro('${p.id}')">Consent</button><button class="btn-secondary" onclick="openReminderCenter('${p.id}')">Reminder</button></div></div>
    </div></div>`;
    const plans=renderStructuredPlan(p); const docs=renderPatientDocs(p); const labs=renderPremiumLab(p);
    let html=originalPatientDetailsHTML(p);
    html=html.replace('<h3 style="color:var(--accent);margin-top:20px;">Treatment Progress</h3>', summary+'<h3 style="color:var(--accent);margin-top:20px;">Treatment Progress</h3>');
    html=html.replace('<h3 style="color:var(--accent);margin-top:24px;">Payments</h3>', plans+'<h3 style="color:var(--accent);margin-top:24px;">Payments</h3>');
    html=html.replace('<h3 style="color:var(--accent);margin-top:24px;">Lab Tracking</h3>', docs+labs+'<h3 style="color:var(--accent);margin-top:24px;">Lab Tracking</h3>');
    return html;
  };

  function renderStructuredPlan(p){ const data=getData(p); const items=data.treatmentItems||[]; return `<div class="premium-section"><h3>Structured Treatment Plan</h3><div class="actions-bar"><button class="btn-primary" onclick="addStructuredTreatment('${p.id}')">+ Treatment item</button><button class="btn-secondary" onclick="printTreatmentPlan('${p.id}')">Print plan</button></div>${items.length?items.map((it,i)=>`<div class="premium-list-row"><div><b>Tooth ${esc(it.tooth||'-')} · ${esc(it.procedure||'Procedure')}</b><span>${esc(it.status||'Planned')} · ${moneyFmt(it.price)} · Paid ${moneyFmt(it.paid)} · Discount ${Number(it.discount||0)}%</span><br><span>${esc(it.notes||'')}</span></div><div class="premium-pill-grid"><button class="btn-secondary" onclick="editStructuredTreatment('${p.id}',${i})">Edit</button><button class="btn-danger" onclick="deleteStructuredTreatment('${p.id}',${i})">Delete</button></div></div>`).join(''):`<p class="muted">No structured treatment items yet.</p>`}</div>`; }

  window.addStructuredTreatment=async id=> editStructuredTreatment(id,-1);
  window.editStructuredTreatment=async function(id,index){ const p=findP(id), data=getData(p), old=index>=0?data.treatmentItems[index]:{}; modal('Treatment item',`<div class="premium-form-grid">${field('ptTooth','Tooth number','text',old.tooth||'')}${field('ptProc','Procedure','text',old.procedure||'')}${field('ptPrice','Price','number',old.price||'')}${field('ptPaid','Paid','number',old.paid||'')}${field('ptDisc','Discount %','number',old.discount||0)}${selectField('ptStatus','Status',['Planned','Started','Completed','Paused','Cancelled'],old.status||'Planned')}<div class="field full"><label>Notes</label><textarea id="ptNotes">${esc(old.notes||'')}</textarea></div></div><button class="btn-primary" style="width:100%;margin-top:12px" onclick="saveStructuredTreatment('${id}',${index})">Save treatment item</button>`); };
  window.saveStructuredTreatment=async function(id,index){ const p=findP(id), data=getData(p); const item={tooth:ptTooth.value,procedure:ptProc.value,price:+ptPrice.value||0,paid:+ptPaid.value||0,discount:+ptDisc.value||0,status:ptStatus.value,notes:ptNotes.value,updated:new Date().toLocaleString()}; if(index>=0)data.treatmentItems[index]=item; else data.treatmentItems.unshift(item); document.getElementById('premiumFeatureModal')?.remove(); await saveData(id,data); };
  window.deleteStructuredTreatment=async function(id,index){ if(!confirm('Delete treatment item?'))return; const p=findP(id),data=getData(p); data.treatmentItems.splice(index,1); await saveData(id,data); };

  // Calendar
  window.openPremiumCalendar=function(){ const now=new Date(); const y=now.getFullYear(), m=now.getMonth(); const first=new Date(y,m,1), days=new Date(y,m+1,0).getDate(); const start=first.getDay(); const appts=[]; patients.forEach(p=>{ const d=getData(p); (d.appointments||[]).forEach((a,i)=>appts.push({...a,pid:p.id,pname:p.name,index:i,day:a.date?new Date(a.date).getDate():0,status:a.status||'scheduled'})); }); let cells=''; for(let i=0;i<start;i++) cells+='<div></div>'; for(let d=1;d<=days;d++){ const list=appts.filter(a=>a.date&&new Date(a.date).getMonth()===m&&a.day===d); cells+=`<div class="premium-calendar-day"><b>${d}</b>${list.map(a=>`<button class="premium-appt-chip" onclick="openPatient('${a.pid}');document.getElementById('premiumFeatureModal')?.remove()">${esc(a.pname)} · ${esc(a.status)}</button>`).join('')}</div>`;} modal('Appointment Calendar',`<div class="actions-bar"><button class="btn-primary" onclick="quickScheduleAppointment()">+ Schedule appointment</button><button class="btn-secondary" onclick="printCalendar()">Print</button></div><div class="premium-calendar-grid"><b>Sun</b><b>Mon</b><b>Tue</b><b>Wed</b><b>Thu</b><b>Fri</b><b>Sat</b>${cells}</div>`); };
  window.quickScheduleAppointment=function(){ const opts=patients.map(p=>`<option value="${p.id}">${esc(p.name||'No name')}</option>`).join(''); modal('Schedule appointment',`<div class="premium-form-grid"><div class="field"><label>Patient</label><select id="calPatient">${opts}</select></div>${field('calDate','Date and time','datetime-local')}${selectField('calStatus','Status',['Confirmed','Waiting','Done','Cancelled','No-show'],'Confirmed')}<div class="field full"><label>Note</label><textarea id="calNote"></textarea></div></div><button class="btn-primary" style="width:100%;margin-top:12px" onclick="saveQuickAppointment()">Save appointment</button>`); };
  window.saveQuickAppointment=async function(){ const id=calPatient.value,p=findP(id),data=getData(p); data.appointments.unshift({date:calDate.value,note:calNote.value,status:calStatus.value}); await saveData(id,data); document.getElementById('premiumFeatureModal')?.remove(); openPremiumCalendar(); };
  window.printCalendar=()=>window.print();

  // Documents: prescription and consent storage
  function renderPatientDocs(p){ const d=getData(p); return `<div class="premium-section"><h3>Clinical Documents</h3><div class="actions-bar"><button class="btn-primary" onclick="generatePrescriptionPro('${p.id}')">+ Prescription</button><button class="btn-secondary" onclick="generateSmartConsentPro('${p.id}')">+ Consent</button></div>${[...(d.prescriptions||[]).map((x,i)=>({...x,type:'Prescription',i})),...(d.consents||[]).map((x,i)=>({...x,type:'Consent',i}))].map(x=>`<div class="premium-list-row"><div><b>${esc(x.type)} · ${esc(x.title||x.kind||'Document')}</b><span>${esc(x.date||'')}</span></div><button class="btn-secondary" onclick="openStoredDocument('${p.id}','${x.type}',${x.i})">Open</button></div>`).join('')||'<p class="muted">No prescription or consent documents yet.</p>'}</div>`; }
  const oldRx=window.generatePrescriptionPro;
  window.generatePrescriptionPro=async function(id){ const p=findP(id); modal('Prescription builder',`<div class="premium-form-grid">${field('rxMed','Medicine','text','Amoxicillin 500mg')}${field('rxDose','Dose','text','1 capsule')}${field('rxFreq','Frequency','text','Every 8 hours')}${field('rxDur','Duration','text','5 days')}<div class="field full"><label>Notes</label><textarea id="rxNotes">After meals. Avoid if allergic.</textarea></div></div><button class="btn-primary" style="width:100%;margin-top:12px" onclick="savePrescriptionDoc('${id}')">Save & Open PDF</button>`); };
  window.savePrescriptionDoc=async function(id){ const p=findP(id),data=getData(p); const doc={date:new Date().toLocaleString(),title:rxMed.value,med:rxMed.value,dose:rxDose.value,freq:rxFreq.value,dur:rxDur.value,notes:rxNotes.value}; data.prescriptions.unshift(doc); document.getElementById('premiumFeatureModal')?.remove(); await api(`patients?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({progress_notes:saveClinicData(data)})}); openStoredDocument(id,'Prescription',0); await loadPatients(); openPatient(id); };
  const oldConsent=window.generateSmartConsentPro;
  window.generateSmartConsentPro=async function(id){ modal('Consent form',`<div class="premium-form-grid">${selectField('consType','Treatment',['Extraction','Root canal','Implant','Whitening','Surgery','Orthodontics','General treatment'],'General treatment')}<div class="field full"><label>Details</label><textarea id="consText">I understand the proposed treatment, benefits, alternatives, and possible risks. I agree to proceed.</textarea></div></div><button class="btn-primary" style="width:100%;margin-top:12px" onclick="saveConsentDoc('${id}')">Save & Open PDF</button>`); };
  window.saveConsentDoc=async function(id){ const p=findP(id),data=getData(p); const doc={date:new Date().toLocaleString(),kind:consType.value,text:consText.value,signature:doctorExtras().signature||''}; data.consents.unshift(doc); document.getElementById('premiumFeatureModal')?.remove(); await api(`patients?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({progress_notes:saveClinicData(data)})}); openStoredDocument(id,'Consent',0); await loadPatients(); openPatient(id); };
  window.openStoredDocument=function(id,type,index){ const p=findP(id),data=getData(p); const doc=type==='Prescription'?data.prescriptions[index]:data.consents[index]; if(!doc)return; const html=`<div style="font-family:Arial;padding:28px;max-width:760px;margin:auto"><h1>${esc(currentUser?.clinic_name||'Masri Dental Clinic')}</h1><h2>${esc(type)}</h2><p><b>Patient:</b> ${esc(p.name||'')}</p><p><b>Date:</b> ${esc(doc.date||'')}</p><hr>${type==='Prescription'?`<p><b>Medicine:</b> ${esc(doc.med)}</p><p><b>Dose:</b> ${esc(doc.dose)}</p><p><b>Frequency:</b> ${esc(doc.freq)}</p><p><b>Duration:</b> ${esc(doc.dur)}</p><p>${esc(doc.notes)}</p>`:`<p><b>Treatment:</b> ${esc(doc.kind)}</p><p>${esc(doc.text)}</p>`}<br><p>Doctor signature</p>${signatureImgHTML?signatureImgHTML():''}<script>setTimeout(()=>window.print(),300)<\/script></div>`; const w=window.open('','_blank'); w.document.write(html); w.document.close(); };

  // Lab tracking in patient data
  function renderPremiumLab(p){ const d=getData(p), labs=d.labWorks||[]; return `<div class="premium-section"><h3>Lab Work Tracking</h3><div class="actions-bar"><button class="btn-primary" onclick="addPremiumLab('${p.id}')">+ Lab case</button></div>${labs.length?labs.map((l,i)=>`<div class="premium-list-row"><div><b>${esc(l.type||'Lab work')} · Tooth ${esc(l.tooth||'-')}</b><span>${esc(l.lab||'No lab')} · Due ${esc(l.due||'-')} · Shade ${esc(l.shade||'-')} · ${esc(l.status||'Sent')}</span></div><div class="premium-pill-grid"><button class="btn-secondary" onclick="editPremiumLab('${p.id}',${i})">Edit</button><button class="btn-danger" onclick="deletePremiumLab('${p.id}',${i})">Delete</button></div></div>`).join(''):'<p class="muted">No lab work yet.</p>'}</div>`; }
  window.addPremiumLab=id=>editPremiumLab(id,-1);
  window.editPremiumLab=function(id,index){ const d=getData(findP(id)), old=index>=0?d.labWorks[index]:{}; modal('Lab case',`<div class="premium-form-grid">${field('labName','Lab name','text',old.lab||'')}${field('labType','Case type','text',old.type||'Crown')}${field('labTooth','Tooth','text',old.tooth||'')}${field('labShade','Shade','text',old.shade||'')}${field('labDue','Due date','date',old.due||'')}${selectField('labStatus','Status',['Sent','In lab','Received','Fitted'],old.status||'Sent')}<div class="field full"><label>Notes</label><textarea id="labNotes">${esc(old.notes||'')}</textarea></div></div><button class="btn-primary" style="width:100%;margin-top:12px" onclick="savePremiumLab('${id}',${index})">Save lab case</button>`); };
  window.savePremiumLab=async function(id,index){ const d=getData(findP(id)); const item={lab:labName.value,type:labType.value,tooth:labTooth.value,shade:labShade.value,due:labDue.value,status:labStatus.value,notes:labNotes.value}; if(index>=0)d.labWorks[index]=item; else d.labWorks.unshift(item); document.getElementById('premiumFeatureModal')?.remove(); await saveData(id,d); };
  window.deletePremiumLab=async function(id,index){ const d=getData(findP(id)); d.labWorks.splice(index,1); await saveData(id,d); };

  // Finance reports
  window.openFinancialReports=function(){ let total=0,paid=0,unpaid=0,todayPaid=0; const today=new Date().toDateString(); const rows=[]; patients.forEach(p=>{ const d=getData(p); (d.payments||[]).forEach(pay=>{ const net=(+pay.total||0)-((+pay.total||0)*(+pay.discount||0)/100); total+=net; paid+=+pay.paid||0; const rem=Math.max(0,net-(+pay.paid||0)); unpaid+=rem; if(pay.date && new Date(pay.date).toDateString()===today) todayPaid+=+pay.paid||0; rows.push({patient:p.name,procedure:pay.procedure||'-',date:pay.date,total:net,paid:+pay.paid||0,remaining:rem}); }); }); modal('Financial Reports',`<div class="premium-summary-grid"><div class="premium-summary-card"><small>Total revenue</small><strong class="premium-kpi">${moneyFmt(total)}</strong></div><div class="premium-summary-card"><small>Paid</small><strong>${moneyFmt(paid)}</strong></div><div class="premium-summary-card"><small>Unpaid</small><strong>${moneyFmt(unpaid)}</strong></div><div class="premium-summary-card"><small>Paid today</small><strong>${moneyFmt(todayPaid)}</strong></div></div><div class="actions-bar"><button class="btn-primary" onclick="exportFinanceCSV()">Export CSV</button><button class="btn-secondary" onclick="window.print()">Print report</button></div>${rows.slice(0,60).map(r=>`<div class="premium-list-row"><div><b>${esc(r.patient)} · ${esc(r.procedure)}</b><span>${esc(r.date||'')} · Total ${moneyFmt(r.total)} · Paid ${moneyFmt(r.paid)} · Remaining ${moneyFmt(r.remaining)}</span></div></div>`).join('')||'<p class="muted">No payments yet.</p>'}`); window.__financeRows=rows; };
  window.exportFinanceCSV=function(){ const rows=window.__financeRows||[]; const csv='Patient,Procedure,Date,Total,Paid,Remaining\n'+rows.map(r=>[r.patient,r.procedure,r.date,r.total,r.paid,r.remaining].map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='clinic-finance-report.csv'; a.click(); };

  // Reminder center
  window.openReminderCenter=function(patientId=''){ const patientOptions=patients.map(p=>`<option value="${p.id}" ${String(p.id)===String(patientId)?'selected':''}>${esc(p.name||'No name')}</option>`).join(''); modal('Reminder Center',`<div class="premium-form-grid"><div class="field"><label>Patient</label><select id="remPatient">${patientOptions}</select></div>${selectField('remType','Reminder type',['Upcoming appointment','Unpaid balance','Follow-up visit','Lab due date','Birthday message','6-month recall'],'Follow-up visit')}<div class="field full"><label>Message</label><textarea id="remMsg">Hello, this is a reminder from Masri Dental Clinic.</textarea></div></div><div class="actions-bar"><button class="btn-primary" onclick="sendPremiumReminder()">Open WhatsApp</button><button class="btn-secondary" onclick="saveReminderOnly()">Save reminder</button></div>`); };
  window.sendPremiumReminder=function(){ const p=findP(remPatient.value); const phone=(allPatientPhones(p,getData(p))[0]||'').replace(/\D/g,''); const msg=encodeURIComponent(remMsg.value); if(!phone)return alert('No phone number for this patient.'); window.open(`https://wa.me/${phone}?text=${msg}`,'_blank'); };
  window.saveReminderOnly=async function(){ const p=findP(remPatient.value),d=getData(p); d.reminders.unshift({date:new Date().toLocaleString(),type:remType.value,msg:remMsg.value}); await saveData(p.id,d); document.getElementById('premiumFeatureModal')?.remove(); };

  // Roles and permissions
  window.openRolePermissions=function(){ const roles=['Admin','Doctor','Assistant','Receptionist','Accountant']; const perms={Admin:'Full access, users, delete, finance',Doctor:'Clinical records, treatment, photos, prescriptions',Assistant:'Photos, notes, appointments, lab tracking',Receptionist:'Patients, appointments, reminders',Accountant:'Payments, receipts, financial reports'}; modal('Roles & Permissions',`<p class="muted">Use these roles when creating or managing clinic users.</p>${roles.map(r=>`<div class="premium-list-row"><div><b>${r}</b><span>${perms[r]}</span></div><span class="premium-status">${r===currentUser?.role?'Current':''}</span></div>`).join('')}<button class="btn-primary" style="width:100%;margin-top:12px" onclick="manageUsers()">Open user manager</button>`); };

  // Print treatment plan
  window.printTreatmentPlan=function(id){ const p=findP(id),d=getData(p); const rows=(d.treatmentItems||[]).map(it=>`<tr><td>${esc(it.tooth)}</td><td>${esc(it.procedure)}</td><td>${esc(it.status)}</td><td>${moneyFmt(it.price)}</td><td>${moneyFmt(it.paid)}</td></tr>`).join(''); const w=window.open('','_blank'); w.document.write(`<html><head><title>Treatment Plan</title><style>body{font-family:Arial;padding:28px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:10px}</style></head><body><h1>Treatment Plan</h1><p><b>Patient:</b> ${esc(p.name)}</p><table><tr><th>Tooth</th><th>Procedure</th><th>Status</th><th>Price</th><th>Paid</th></tr>${rows}</table><script>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close(); };

  // Better settings: add premium tools if page exists
  const oldShowPage=window.showPage;
  window.showPage=function(id){ const out=oldShowPage?oldShowPage(id):undefined; if(id==='settings') setTimeout(()=>{ const page=document.getElementById('settings'); if(page && !document.getElementById('premiumSettingsTools')){ const block=document.createElement('div'); block.id='premiumSettingsTools'; block.className='card'; block.innerHTML=`<h2>Clinic Management</h2><div class="premium-tools-grid"><button class="premium-tool-btn" onclick="openPremiumCalendar()">Calendar<small>Appointments and statuses</small></button><button class="premium-tool-btn" onclick="openFinancialReports()">Financial reports<small>Revenue and unpaid balances</small></button><button class="premium-tool-btn" onclick="openReminderCenter()">Reminders<small>WhatsApp templates</small></button><button class="premium-tool-btn" onclick="openRolePermissions()">Roles<small>Permissions by staff type</small></button></div>`; page.appendChild(block); } },120); return out; };
})();
