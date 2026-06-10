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

function safeText(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

function getSavedUser() {
  try { return JSON.parse(localStorage.getItem("clinicUser")); }
  catch { return null; }
}

function saveUser(user) {
  localStorage.setItem("clinicUser", JSON.stringify(user));
  currentUser = user;
}

function logout() {
  localStorage.removeItem("clinicUser");
  location.href = location.pathname + "?logout=1";
}

async function login(username, password) {
  try {
    const users = await api(`clinic_users?username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}&select=*`);
    if (!users.length) return alert("Wrong username or password");
    saveUser(users[0]);
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
    const existing = await api(`clinic_users?select=id&username=eq.${encodeURIComponent(cleanUsername)}`);
    if (existing.length) return alert("This username already exists. Please login.");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clinic_users`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        username: cleanUsername,
        password: password.trim(),
        full_name: full_name.trim(),
        role: "doctor",
        clinic_name: `${full_name.trim()}'s Clinic`,
        clinic_logo: ""
      })
    });
    if (!res.ok) throw new Error(await res.text());
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
      <button class="btn-secondary" style="width:100%;margin-top:10px" onclick="this.closest('.luxury-modal').remove()">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
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
  if (!raw) return { visits: [], appointments: [], payments: [], teeth: {} };
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return { visits: data, appointments: [], payments: [], teeth: {} };
    return { visits: data.visits || [], appointments: data.appointments || [], payments: data.payments || [], teeth: data.teeth || {} };
  } catch {
    return { visits: [{ date: "Old note", note: raw }], appointments: [], payments: [], teeth: {} };
  }
}

function saveClinicData(data) {
  return JSON.stringify({ visits: data.visits || [], appointments: data.appointments || [], payments: data.payments || [], teeth: data.teeth || {} });
}

function paymentTotals(data) {
  const total = data.payments.reduce((s, x) => s + Number(x.total || 0), 0);
  const paid = data.payments.reduce((s, x) => s + Number(x.paid || 0), 0);
  return { total, paid, remaining: total - paid };
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
        apptMap[key].push({ patient: p.name || "Patient", id: p.id });
      }
    });
  });

  dash.innerHTML = `
    <div class="hero-grid">
      <div class="stat-card"><span class="stat-label">Total Patients</span><strong class="stat-value">${patients.length}</strong></div>
      <div class="stat-card"><span class="stat-label">Today's Appts</span><strong class="stat-value">${todayAppointments.length}</strong></div>
      <div class="stat-card"><span class="stat-label">Unpaid Balance</span><strong class="stat-value unpaid">${unpaid}</strong></div>
      <div class="stat-card"><span class="stat-label">Total Visits</span><strong class="stat-value">${totalVisits}</strong></div>
      <div class="stat-card"><span class="stat-label">Total Revenue</span><strong class="stat-value gold">${totalRevenue}</strong></div>
      <div class="stat-card"><span class="stat-label">Paid Today</span><strong class="stat-value gold">${paidToday}</strong></div>
    </div>

    <div class="quick-actions">
      <button class="btn-primary" onclick="fillForm();showPage('form')">+ New Patient</button>
      <button class="btn-secondary" onclick="showPage('scan')">Scan QR</button>
      <button class="btn-secondary" onclick="backupData()">Backup</button>
      <button class="btn-secondary" onclick="restoreBackup()">Restore</button>
    </div>

    <div class="panel">
      <h2>Clinic Overview</h2>
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
      <h2>Appointment Calendar</h2>
      <div class="calendar-grid">
        ${Array.from({length: days}, (_, i) => {
          const day = i + 1;
          const list = apptMap[day] || [];
          return `<button class="calendar-cell ${list.length ? "has-appt" : ""}" onclick="${list[0] ? `openPatient('${list[0].id}')` : ""}">${day}${list.length ? `<small>${list.length} appt</small>` : ""}</button>`;
        }).join("")}
      </div>
    </div>

    ${todayAppointments.length ? `
    <div class="panel">
      <h2>Today</h2>
      ${todayAppointments.map(a => `
        <div class="appointment-row">
          <div><b>${safeText(a.date)}</b><p class="muted">${safeText(a.patient)} - ${safeText(a.note)}</p></div>
          <button class="btn-secondary" onclick="openPatient('${a.id}')">Open</button>
        </div>
      `).join("")}
    </div>` : ""}

    ${upcoming.length ? `
    <div class="panel">
      <h2>Upcoming</h2>
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
              <span class="pill">${safeText(p.phone || "No phone")}</span>
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
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const MAX_WIDTH = isXray ? 1600 : 900;
      const QUALITY = isXray ? 0.78 : 0.55;
      let w = img.width, h = img.height;
      if (w > MAX_WIDTH) { h *= MAX_WIDTH / w; w = MAX_WIDTH; }
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", QUALITY);
    };
    reader.readAsDataURL(file);
  });
}

async function uploadToBucket(bucket, path, blob, type) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": type || "application/octet-stream" },
    body: blob
  });
  if (!res.ok) throw new Error(await res.text());
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
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
        <span class="pill">${safeText(p.phone || "No phone")}</span>
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
          <span>Total: ${Number(pay.total || 0)} | Paid: ${Number(pay.paid || 0)} | Remaining: ${Number(pay.total || 0) - Number(pay.paid || 0)}</span>
          <button class="btn-danger" style="margin-top:8px;font-size:12px;padding:8px 14px;" onclick="deletePayment('${p.id}', ${i})">Delete</button>
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
  const total = await luxuryPrompt("Total treatment cost", "Enter total amount");
  if (total === null || total === "") return;
  const paid = await luxuryPrompt("Paid amount", "Enter paid amount", "0");
  if (paid === null) return;
  data.payments.unshift({ date: new Date().toLocaleString(), total: Number(total || 0), paid: Number(paid || 0) });
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
  data.payments.unshift({ date: new Date().toLocaleString(), total: Number(total || 0), paid: Number(first || 0), note: "Installment plan" });
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
      <button onclick="document.getElementById('premiumDocModal').remove()" style="padding:12px 18px;border:none;border-radius:14px;background:#1f2937;color:white;font-weight:700;font-family:inherit;cursor:pointer;">Close</button>
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
  let beforeIdx = 0, afterIdx = 1;

  const modal = document.createElement("div");
  modal.className = "luxury-modal";
  modal.innerHTML = `
    <div class="luxury-box" style="max-width:720px;">
      <h2>Before / After</h2>
      <div class="before-after-wrap" style="height:400px;">
        <span class="ba-label before">Before</span>
        <span class="ba-label after">After</span>
        <img src="${photos[afterIdx]}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;">
        <div id="baClip" style="position:absolute;inset:0;width:50%;overflow:hidden;">
          <img src="${photos[beforeIdx]}" style="width:100%;height:100%;object-fit:contain;">
        </div>
        <input type="range" min="0" max="100" value="50" id="baSlider" style="position:absolute;left:14px;right:14px;bottom:16px;width:calc(100% - 28px);z-index:5;accent-color:#d4af37;">
      </div>
      <div class="actions-bar" style="margin-top:14px;">
        <button class="btn-secondary" id="baPrevBefore">Prev Before</button>
        <button class="btn-secondary" id="baNextAfter">Next After</button>
        <button class="btn-primary" id="baAuto">Auto Play</button>
        <button class="btn-secondary baCloseBtn" onclick="this.closest('.luxury-modal').remove()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector("#baSlider").oninput = (e) => {
    modal.querySelector("#baClip").style.width = e.target.value + "%";
  };
  const fadeSwap = (img, src) => {
  img.style.transition = "opacity .35s ease, filter .35s ease";
  img.style.opacity = "0";
  img.style.filter = "blur(6px)";
  setTimeout(() => {
    img.src = src;
    img.style.opacity = "1";
    img.style.filter = "blur(0)";
  }, 180);
};
  modal.querySelector("#baAuto").onclick = () => {
  let v = 0;
  const slider = modal.querySelector("#baSlider");
  const clip = modal.querySelector("#baClip");
  const timer = setInterval(() => {
    v += 2;
    slider.value = v;
    clip.style.width = v + "%";
    if (v >= 100) clearInterval(timer);
  }, 50);
};
  
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
  if (oldPass.trim() !== currentUser.password) return alert("Wrong password.");
  const newPass = await luxuryPrompt("New password");
  if (!newPass) return;
  const confirmPass = await luxuryPrompt("Confirm new password");
  if (!confirmPass || newPass.trim() !== confirmPass.trim()) return alert("Passwords don't match.");
  if (newPass.trim().length < 4) return alert("Password must be at least 4 characters.");
  try {
    await api(`clinic_users?id=eq.${currentUser.id}`, { method: "PATCH", body: JSON.stringify({ password: newPass.trim() }) });
    currentUser.password = newPass.trim();
    saveUser(currentUser);
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
    <style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f8;color:#111827}
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
    .footer{text-align:center;color:#6b7280;margin-top:20px;font-size:12px}
    @media print{body{background:white}.report{padding:0}.section,.header{break-inside:avoid}}
    </style></head><body><div class="report">
    <div class="header">${logo?`<img class="logo" src="${logo}">`:""}<h1>${safeText(clinicName)}</h1><p>Patient Report</p></div>
    <div class="section"><h2>Patient Information</h2>
    <div class="grid"><div class="item"><span class="label">Name</span><span class="value">${safeText(p.name||"-")}</span></div>
    <div class="item"><span class="label">ID</span><span class="value">${safeText(p.case_id||p.id)}</span></div>
    <div class="item"><span class="label">Phone</span><span class="value">${safeText(p.phone||"-")}</span></div>
    <div class="item"><span class="label">Age/Gender</span><span class="value">${safeText(p.age||"-")} / ${safeText(p.gender||"-")}</span></div></div></div>
    <div class="section"><h2>Clinical</h2>
    <div class="item" style="margin-bottom:8px"><span class="label">Chief Complaint</span><span class="value">${safeText(p.chief_complaint||"-")}</span></div>
    <div class="item" style="margin-bottom:8px"><span class="label">Medical Alerts</span><span class="value">${safeText(p.medical_alerts||"-")}</span></div>
    <div class="item" style="margin-bottom:8px"><span class="label">Diagnosis</span><span class="value">${safeText(p.diagnosis||"-")}</span></div>
    <div class="item"><span class="label">Treatment Plan</span><span class="value">${safeText(p.treatment_plan||"-")}</span></div></div>
    <div class="section"><h2>Financial Summary</h2><div class="summary">
    <div class="moneyBox"><b>Total</b>${money.total}</div>
    <div class="moneyBox"><b>Paid</b>${money.paid}</div>
    <div class="moneyBox"><b>Remaining</b>${money.remaining}</div></div></div>
    <div class="section"><h2>Visits (${(data.visits||[]).length})</h2>
    ${(data.visits||[]).map(v=>`<div class="visit"><b>${safeText(v.date||"")}</b> - ${safeText(v.treatment||"Visit")}<br>${safeText(v.note||"-")}</div>`).join("")||"<p>No visits recorded.</p>"}</div>
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
    if (!currentUser || !currentUser.id || !currentUser.role) {
      localStorage.removeItem("clinicUser");
      showLoginScreen();
      return;
    }
    applyUserBar();
    enhanceHeader();
    await loadPatients();
    startAutoRefresh();
  } catch (err) {
    document.body.innerHTML = `<div style="padding:40px;color:#ef4444;font-family:'DM Sans',sans-serif;"><h2>Error</h2><p>${safeText(err.message)}</p></div>`;
  }
});
