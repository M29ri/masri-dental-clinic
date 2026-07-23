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
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", ...options.headers
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
  const users = await api(`clinic_users?username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}`);
  if (!users.length) return alert("Wrong username or password");
  saveUser(users[0]);
  location.href = location.pathname;
}

async function registerDoctor() {
  const username = prompt("Enter username:");
  const password = prompt("Enter password:");
  const name = prompt("Enter full name:");
  if (!username || !password || !name) return;
  try {
    await api("clinic_users", {
      method: "POST",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({ username, password, name, role: "doctor" })
    });
    alert("Doctor registered successfully! You can now log in.");
  } catch (err) {
    alert("Registration failed: " + err.message);
  }
}

// --- Navigation & Routing ---
window.showPage = function(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".bottom-nav .tab").forEach(t => t.classList.remove("active"));
  
  const target = $(pageId);
  if (target) target.classList.add("active");
  
  const tab = document.querySelector(`.bottom-nav .tab[data-page="${pageId}"]`);
  if (tab) tab.classList.add("active");
  
  window.scrollTo(0, 0);
};

// --- Initialization & Bootup ---
window.addEventListener("DOMContentLoaded", async () => {
  if (location.search.includes("logout=1")) {
    localStorage.removeItem("clinicUser");
    history.replaceState({}, document.title, location.pathname);
  }

  currentUser = getSavedUser();
  if (!currentUser) {
    renderLoginScreen();
    return;
  }

  renderAppShell();
  await loadPatients();
  renderDashboard();
});

function renderLoginScreen() {
  const app = $("app");
  app.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;max-width:400px;margin:0 auto;">
      <div class="card" style="width:100%;text-align:center;">
        <h2 style="margin-bottom:20px;">Masri Dental Clinic</h2>
        <form id="loginForm" onsubmit="handleLogin(event)" style="display:flex;flex-direction:column;gap:15px;text-align:left;">
          <label>Username <input id="loginUser" required style="margin-top:5px;"></label>
          <label>Password <input id="loginPass" type="password" required style="margin-top:5px;"></label>
          <button type="submit" class="btn-primary" style="padding:12px;margin-top:10px;">Login</button>
        </form>
        <button onclick="registerDoctor()" class="btn-secondary" style="margin-top:15px;width:100%;">Register New Doctor</button>
      </div>
    </div>
  `;
}

async function handleLogin(e) {
  e.preventDefault();
  const u = $("loginUser").value.trim();
  const p = $("loginPass").value.trim();
  await login(u, p);
}

function renderAppShell() {
  const app = $("app");
  app.innerHTML = `
    <header class="app-header">
      <div class="header-left">
        <button id="menuBtn" class="icon-btn" onclick="logout()" title="Logout">🚪</button>
        <h1>Masri Dental Clinic</h1>
      </div>
      <div id="status" class="status-badge"><span class="status-dot"></span> Cloud connected</div>
    </header>

    <main class="app-content">
      <section id="dashboard" class="page active">
        <div id="dashboardContent"></div>
      </section>

      <section id="patients" class="page">
        <div class="search-bar">
          <input id="search" type="text" placeholder="Search patients by name or phone..." oninput="renderPatients()">
        </div>
        <div id="list" class="patient-list"></div>
      </section>

      <section id="detail" class="page">
        <button onclick="showPage('patients')" class="btn-secondary" style="margin-bottom:16px;">← Back to Patients</button>
        <div id="details"></div>
      </section>

      <section id="form" class="page">
        <div class="card">
          <h2 id="formTitle">Add Patient</h2>
          <form id="patientForm" onsubmit="savePatientData(event)">
            <input type="hidden" id="rowId">
            <label>Case ID <input id="caseId"></label>
            <label>Patient Name <input id="name" required></label>
            <label>Phone Number <input id="phone"></label>
            <label>Age <input id="age" type="number"></label>
            <label>Gender 
              <select id="gender">
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>
            <label>Chief Complaint <textarea id="chiefComplaint"></textarea></label>
            <label>Medical Alerts <input id="medicalAlerts"></label>
            <label>Diagnosis <textarea id="diagnosis"></textarea></label>
            <label>Treatment Plan <textarea id="treatmentPlan"></textarea></label>
            <label>Initial Visit Note <textarea id="progressNotes" placeholder="Optional first note..."></textarea></label>
            <label>Photos / X-rays <input id="photos" type="file" multiple accept="image/*"></label>
            <button type="submit" id="saveBtn" class="btn-primary" style="margin-top:20px;width:100%;">Save Patient</button>
          </form>
        </div>
      </section>

      <section id="scan" class="page">
        <div class="card" style="text-align:center;">
          <h2>Scan Patient QR</h2>
          <p style="color:var(--muted);font-size:14px;">QR scanning ready</p>
        </div>
      </section>
    </main>

    <nav class="bottom-nav">
      <button class="tab active" data-page="dashboard" onclick="showPage('dashboard')">Dashboard</button>
      <button class="tab" data-page="patients" onclick="showPage('patients')">Patients</button>
      <button class="tab" data-page="form" onclick="prepareAddForm(); showPage('form')">+ Add</button>
      <button class="tab" data-page="scan" onclick="showPage('scan')">QR Scan</button>
    </nav>
  `;
}

// --- Data Operations ---
async function loadPatients() {
  try {
    patients = await api("patients?order=created_at.desc");
    renderPatients();
    renderDashboard();
  } catch (err) {
    console.error("Failed to load patients:", err);
  }
}

function renderDashboard() {
  const container = $("dashboardContent");
  if (!container) return;

  const totalPatients = patients.length;
  const totalRevenue = patients.reduce((acc, p) => acc + (Number(p.total_revenue) || 0), 0);

  container.innerHTML = `
    <div class="stat-card">
      <div class="label">Total Patients</div>
      <div class="value">${totalPatients}</div>
    </div>
    <div class="stat-card">
      <div class="label">Today's Appts</div>
      <div class="value">0</div>
    </div>
    <div class="stat-card">
      <div class="label">Unpaid Balance</div>
      <div class="value">0</div>
    </div>
    <div class="stat-card">
      <div class="label">Total Revenue</div>
      <div class="value">${totalRevenue}</div>
    </div>
    <div class="stat-card">
      <div class="label">Paid Today</div>
      <div class="value">0</div>
    </div>
    <div style="grid-column: span 2; display:flex; gap:10px; margin-top:10px;">
      <button onclick="prepareAddForm(); showPage('form')" class="btn-primary" style="flex:1;">+ New Patient</button>
      <button onclick="showPage('scan')" class="btn-secondary" style="flex:1;">Scan QR</button>
    </div>
  `;
}

function renderPatients() {
  const list = $("list");
  const query = ($("search")?.value || "").toLowerCase();
  if (!list) return;

  const filtered = patients.filter(p => 
    (p.name || "").toLowerCase().includes(query) || 
    (p.phone || "").toLowerCase().includes(query)
  );

  if (!filtered.length) {
    list.innerHTML = `<div class="card" style="text-align:center;color:var(--muted);">No patients found</div>`;
    return;
  }

  list.innerHTML = filtered.map(p => `
    <div class="patient-card">
      <h3>${safeText(p.name)}</h3>
      <p>ID: ${safeText(p.case_id || p.id)}</p>
      <p>Phone: ${safeText(p.phone || "N/A")}</p>
      <div class="patient-actions">
        <button onclick="viewPatient('${p.id}')" class="btn-primary" style="padding:6px 12px;font-size:13px;">Open</button>
      </div>
    </div>
  `).join("");
}

window.viewPatient = function(id) {
  const p = patients.find(x => x.id == id);
  if (!p) return;

  const details = $("details");
  details.innerHTML = `
    <div class="card">
      <h2>${safeText(p.name)}</h2>
      <p><strong>ID:</strong> ${safeText(p.case_id || p.id)}</p>
      <p><strong>Phone:</strong> ${safeText(p.phone || "N/A")}</p>
      <p><strong>Age:</strong> ${safeText(p.age || "N/A")}</p>
      <p><strong>Gender:</strong> ${safeText(p.gender || "N/A")}</p>
      <p><strong>Chief Complaint:</strong> ${safeText(p.chief_complaint || "N/A")}</p>
      <p><strong>Diagnosis:</strong> ${safeText(p.diagnosis || "N/A")}</p>
      <p><strong>Treatment Plan:</strong> ${safeText(p.treatment_plan || "N/A")}</p>
      <p><strong>Medical Alerts:</strong> ${safeText(p.medical_alerts || "None")}</p>
    </div>
  `;
  showPage('detail');
};

window.prepareAddForm = function() {
  $("rowId").value = "";
  $("patientForm").reset();
  $("formTitle").innerText = "Add Patient";
};

async function savePatientData(e) {
  e.preventDefault();
  const data = {
    case_id: $("caseId").value.trim(),
    name: $("name").value.trim(),
    phone: $("phone").value.trim(),
    age: $("age").value ? Number($("age").value) : null,
    gender: $("gender").value,
    chief_complaint: $("chiefComplaint").value.trim(),
    medical_alerts: $("medicalAlerts").value.trim(),
    diagnosis: $("diagnosis").value.trim(),
    treatment_plan: $("treatmentPlan").value.trim()
  };

  try {
    await api("patients", {
      method: "POST",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify(data)
    });
    alert("Patient saved successfully!");
    await loadPatients();
    showPage("patients");
  } catch (err) {
    alert("Error saving patient: " + err.message);
  }
}
