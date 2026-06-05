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
  const full_name = prompt("Your full name:");
  if (!full_name) return;
  const username = prompt("Choose username:");
  if (!username) return;
  const password = prompt("Choose password:");
  if (!password) return;
  try {
    await api("clinic_users", {
      method: "POST",
      body: JSON.stringify({
        username: username.trim(),
        password: password.trim(),
        full_name: full_name.trim(),
        role: "doctor",
        clinic_name: "",
        clinic_logo: ""
      })
    });
    alert("Account created successfully. Login now.");
  } catch (err) {
    alert("Username already exists or account creation failed");
  }
}

async function addUser() {
  if (!currentUser || currentUser.role !== "admin") return alert("Only admin can add users");
  const username = prompt("New username:");
  if (!username) return;
  const password = prompt("Password:");
  if (!password) return;
  const full_name = prompt("Full name:") || username;
  const role = prompt("Role: admin / doctor / assistant", "doctor");
  if (!["admin", "doctor", "assistant"].includes(role)) return alert("Invalid role");
  await api("clinic_users", {
    method: "POST",
    body: JSON.stringify({ username, password, full_name, role })
  });
  alert("User added successfully");
}

function showLoginScreen() {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#070b10,#111827);padding:24px;color:white;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;">
      <div style="width:100%;max-width:420px;background:#121821;border:1px solid #263241;border-radius:32px;padding:28px;box-shadow:0 20px 50px rgba(0,0,0,.45);">
        <h1 style="font-size:30px;margin-bottom:8px;">Masri Dental Clinic</h1>
        <p style="color:#9ca9b8;margin-bottom:24px;">Secure login</p>
        <label style="display:block;margin-bottom:14px;">Username<input id="loginUsername" style="width:100%;margin-top:8px;padding:16px;border-radius:18px;border:1px solid #263241;background:#0f1620;color:white;font-size:16px;"></label>
        <label style="display:block;margin-bottom:20px;">Password<input id="loginPassword" type="password" style="width:100%;margin-top:8px;padding:16px;border-radius:18px;border:1px solid #263241;background:#0f1620;color:white;font-size:16px;"></label>
        <button id="loginBtn" style="width:100%;padding:16px;border:none;border-radius:18px;background:linear-gradient(135deg,#d4af37,#8f6b10);color:black;font-weight:900;font-size:17px;">Login</button>
        <button id="registerBtn" style="width:100%;margin-top:12px;padding:16px;border:none;border-radius:18px;background:#1f2937;color:white;font-weight:900;font-size:17px;">Create doctor account</button>
      </div>
    </div>`;
  $("loginBtn").onclick = () => login($("loginUsername").value.trim(), $("loginPassword").value.trim());
  $("registerBtn").onclick = registerDoctor;
}

function applyUserBar() {
  if (!currentUser) return;
  const doctorName = $("doctorName");
  const doctorRole = $("doctorRole");
  const logoutBtn = $("logoutBtn");
  const brand = document.querySelector(".brand h1");
  if (doctorName) doctorName.textContent = currentUser.full_name || currentUser.username || "Doctor";
  if (doctorRole) doctorRole.textContent = (currentUser.role || "doctor").toUpperCase();
  if (logoutBtn) logoutBtn.onclick = logout;
  if (brand) brand.textContent = currentUser.clinic_name || "Masri Dental Clinic";
  if ($("clinicName")) $("clinicName").value = currentUser.clinic_name || "";
}

function canEdit() { return currentUser && ["admin", "doctor"].includes(currentUser.role); }
function canDelete() { return currentUser && currentUser.role === "admin"; }
function makeId() { return "P-" + Date.now(); }

function injectExtraStyles() {
  if ($("clinicExtraStyles")) return;
  const style = document.createElement("style");
  style.id = "clinicExtraStyles";
  style.textContent = `
    .page{display:none}.page.active{display:block}
    .sectionTitle{margin-top:24px;margin-bottom:12px;color:var(--gold,#d4af37);font-size:22px;font-weight:900}
    .miniGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
    .miniCard{background:#0f1620;border:1px solid var(--border,#263241);border-radius:22px;padding:16px}.miniCard b{display:block;color:var(--gold,#d4af37);margin-bottom:6px}
    .money{font-size:22px;font-weight:900;color:var(--green,#19c37d)}.unpaid{color:#ff7676}
    .appointment{background:#0f1620;border:1px solid var(--border,#263241);border-radius:20px;padding:14px;margin-top:10px}.appointment b{color:var(--gold,#d4af37)}
    .visitDate{color:var(--muted,#9ca9b8);font-size:13px;margin-bottom:6px}
    .kv{margin-top:18px;padding:16px;background:#0f1620;border:1px solid var(--border,#263241);border-radius:20px}.kv b{display:block;color:var(--gold,#d4af37);margin-bottom:8px;font-size:14px}.kv span{color:#e5edf6;white-space:pre-wrap;line-height:1.6}
    .toothChart{display:grid;grid-template-columns:repeat(8,1fr);gap:8px;margin-top:14px}.tooth{background:#0f1620;border:1px solid var(--border,#263241);color:white;border-radius:14px;padding:10px 4px;text-align:center;font-size:13px;font-weight:800}
    .tooth.healthy{background:linear-gradient(180deg,#12351f,#0f2417);border:1px solid #22c55e;color:#86efac}.tooth.caries{background:linear-gradient(180deg,#4a1d1d,#210b0b);border:1px solid #ef4444;color:#fecaca}.tooth.filling{background:linear-gradient(180deg,#1e3a5f,#0b1f35);border:1px solid #60a5fa;color:#bfdbfe}.tooth.rct{background:linear-gradient(180deg,#3b2f13,#1f1605);border:1px solid #facc15;color:#fde68a}.tooth.crown{background:linear-gradient(135deg,#d4af37,#8f6b10);border:1px solid #f5d76e;color:#111}.tooth.missing{background:#05070a;border:1px solid #374151;color:#6b7280;text-decoration:line-through;opacity:.75}.tooth.extraction{background:linear-gradient(180deg,#3f1111,#170505);border:1px solid #fb7185;color:#fecdd3}.tooth.implant{background:linear-gradient(180deg,#12352b,#062019);border:1px solid #2dd4bf;color:#99f6e4}
    .toothLegend{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.legendItem{background:#0f1620;border:1px solid var(--border,#263241);padding:8px 10px;border-radius:999px;font-size:12px;color:var(--muted,#9ca9b8)}
    .modal{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:999;display:flex;align-items:center;justify-content:center;padding:18px}.modal.hidden{display:none!important}.modal img{max-width:100%;max-height:85vh;border-radius:24px}.modalClose{position:absolute;top:18px;right:18px;width:50px;height:50px;border-radius:50%;border:none;background:#1f2937;color:white;font-size:28px}.qrBox{background:#111827;border:1px solid var(--gold,#d4af37);border-radius:28px;padding:24px;text-align:center}#qrcode{background:white;padding:16px;border-radius:20px;margin:20px auto;width:max-content}
    .photoViewer{position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;backdrop-filter:blur(10px)}.photoViewer.hidden{display:none!important}.photoViewer img{max-width:95vw;max-height:82vh;border-radius:26px;object-fit:contain;box-shadow:0 20px 60px rgba(0,0,0,.5)}.photoControls{display:flex;gap:12px;margin-top:18px;flex-wrap:wrap}.photoControls button{border:none;border-radius:18px;padding:14px 18px;background:#121821;color:white;font-weight:800}.photoClose{position:absolute;top:22px;right:22px;width:56px;height:56px;border:none;border-radius:50%;background:#111827;color:white;font-size:22px}
    .timelineItem{border-left:3px solid #d4af37;padding:12px 16px;margin-bottom:14px;background:#111827;border-radius:18px}.timelineDate{color:#9ca3af;font-size:12px;font-weight:800;margin-bottom:6px}.timelineText{color:white;font-size:15px;font-weight:800}
    .compareBox{background:#111827;border:1px solid #263241;border-radius:24px;padding:16px;margin-top:16px}.compareGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.compareGrid img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:18px;border:1px solid #263241}.compareLabel{color:#d4af37;font-weight:900;margin-bottom:8px}
    .mouthChart{
  position:relative;
  width:100%;
  max-width:520px;
  height:640px;
  margin:22px auto;
  border-radius:36px;
  background:
    radial-gradient(circle at center,#111827 0%,#0b111a 58%,#070b10 100%);
  border:1px solid #263241;
  overflow:hidden;
}
.realMouthChart{
  width:100%;
  margin:20px auto;
  padding:16px;
  border-radius:28px;
  background:radial-gradient(circle at center,#111827,#070b10);
  border:1px solid #263241;
}

.jawLabel{
  color:#d4af37;
  font-weight:1000;
  margin:18px 0 10px;
  letter-spacing:1px;
}

.jawRow{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:12px;
  margin-bottom:14px;
}

.realTooth{
  background:#0f1620;
  border:1px solid #263241;
  border-radius:18px;
  padding:8px 4px;
  min-height:92px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
}

.toothSvg{
  width:38px;
  height:54px;
}

.toothSvg path{
  fill:#f8f1df;
  stroke:#d8d0bd;
  stroke-width:2;
}

.realTooth small{
  color:#e5e7eb;
  font-size:12px;
  font-weight:900;
  margin-top:5px;
}

.realTooth.caries .toothSvg path{fill:#ef4444}
.realTooth.filling .toothSvg path{fill:#60a5fa}
.realTooth.rct .toothSvg path{fill:#8b5cf6}
.realTooth.crown .toothSvg path{fill:#d4af37}
.realTooth.missing .toothSvg path{fill:#4b5563}
.realTooth.extraction .toothSvg path{fill:#fb7185}
.realTooth.implant .toothSvg path{fill:#2dd4bf}
.proMouthChart{
  position:relative;
  width:100%;
  height:620px;
  margin:22px auto;
  border-radius:34px;
  background:radial-gradient(circle at center,#111827,#070b10);
  border:1px solid #263241;
  overflow:hidden;
}

.proTooth{
  position:absolute;
  transform:translate(-50%,-50%);
  width:46px;
  height:70px;
  background:transparent;
  border:none;
  padding:0;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
}

.proToothSvg{
  width:42px;
  height:58px;
  filter:drop-shadow(0 8px 10px rgba(0,0,0,.45));
}

.proToothSvg path{
  fill:#f8f1df;
  stroke:#d8d0bd;
  stroke-width:2;
}

.proTooth span{
  color:#d1d5db;
  font-size:11px;
  font-weight:900;
  margin-top:2px;
}

.proTooth.caries .proToothSvg path{fill:#ef4444;stroke:#7f1d1d}
.proTooth.filling .proToothSvg path{fill:#60a5fa;stroke:#1e3a8a}
.proTooth.rct .proToothSvg path{fill:#8b5cf6;stroke:#4c1d95}
.proTooth.crown .proToothSvg path{fill:#d4af37;stroke:#8f6b10}
.proTooth.missing .proToothSvg path{fill:#4b5563;stroke:#111827}
.proTooth.extraction .proToothSvg path{fill:#fb7185;stroke:#881337}
.proTooth.implant .proToothSvg path{fill:#2dd4bf;stroke:#115e59}

.proMouthLabel{
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  color:#9ca3af;
  font-weight:1000;
  letter-spacing:4px;
  opacity:.65;
}

.proMouthLabel.upper{top:43%}
.proMouthLabel.lower{top:61%}

.proMidLine{
  position:absolute;
  left:50%;
  top:25%;
  height:55%;
  border-left:1px dashed rgba(212,175,55,.35);
}

.proHorizontalLine{
  position:absolute;
  left:18%;
  right:18%;
  top:55%;
  border-top:1px dashed rgba(212,175,55,.35);
}

.legendItem::before{
  content:"";
  display:inline-block;
  width:14px;
  height:14px;
  border-radius:50%;
  margin-right:8px;
  vertical-align:-2px;
}

.legendItem:nth-child(1)::before{background:#22c55e}
.legendItem:nth-child(2)::before{background:#ef4444}
.legendItem:nth-child(3)::before{background:#60a5fa}
.legendItem:nth-child(4)::before{background:#8b5cf6}
.legendItem:nth-child(5)::before{background:#d4af37}
.legendItem:nth-child(6)::before{background:#4b5563}
.legendItem:nth-child(7)::before{background:#fb7185}
.legendItem:nth-child(8)::before{background:#2dd4bf}

@media(max-width:520px){
  .proMouthChart{
    height:560px;
  }

  .proTooth{
    width:38px;
    height:62px;
  }

  .proToothSvg{
    width:34px;
    height:50px;
  }

  .proTooth span{
    font-size:10px;
  }
}
/* FINAL TOOTH CHART FIX */
.realMouthChart{
  position:relative !important;
  display:block !important;
  width:100% !important;
  max-width:none !important;
  min-width:0 !important;
  height:560px !important;
  margin:20px 0 !important;
  padding:0 !important;
  border-radius:32px !important;
  background:radial-gradient(circle at center,#111827,#070b10) !important;
  border:1px solid #263241 !important;
  overflow:hidden !important;
}

.proMouthChart{
  position:relative !important;
  width:100% !important;
  max-width:none !important;
  min-width:0 !important;
  height:560px !important;
  margin:20px 0 !important;
  border-radius:32px !important;
  background:radial-gradient(circle at center,#111827,#070b10) !important;
  border:1px solid #263241 !important;
  overflow:hidden !important;
}

.proTooth{
  position:absolute !important;
  transform:translate(-50%,-50%) !important;
  width:34px !important;
  height:52px !important;
  background:transparent !important;
  border:none !important;
  padding:0 !important;
  display:flex !important;
  flex-direction:column !important;
  align-items:center !important;
  justify-content:center !important;
}

.proToothSvg{
  width:32px !important;
  height:44px !important;
}

.proTooth span{
  color:#e5e7eb !important;
  font-size:9px !important;
  font-weight:900 !important;
  margin-top:0 !important;
}

.proMidLine{
  position:absolute !important;
  left:50% !important;
  top:25% !important;
  height:55% !important;
  border-left:1px dashed rgba(212,175,55,.35) !important;
}

.proHorizontalLine{
  position:absolute !important;
  left:12% !important;
  right:12% !important;
  top:55% !important;
  border-top:1px dashed rgba(212,175,55,.35) !important;
}

.proMouthLabel{
  position:absolute !important;
  left:50% !important;
  transform:translateX(-50%) !important;
  color:#9ca3af !important;
  font-weight:1000 !important;
  letter-spacing:4px !important;
  opacity:.65 !important;
}

.proMouthLabel.upper{top:43% !important}
.proMouthLabel.lower{top:61% !important}

.toothRow,
.jawRow,
.mouthArch{
  display:contents !important;
}

.realTooth{
  background:transparent !important;
}
.toothChartBox{
  display:block !important;
  width:100% !important;
  max-width:100% !important;
}

.toothChartBox .proMouthChart{
  width:100% !important;
  height:560px !important;
  margin:22px 0 !important;
}

.toothChart{
  display:block !important;
  grid-template-columns:none !important;
}
.toothLegend{
  display:grid !important;
  grid-template-columns:repeat(2,1fr) !important;
  gap:10px !important;
  margin-bottom:18px !important;
}

.legendItem{
  display:flex !important;
  align-items:center !important;
  gap:8px !important;
  justify-content:flex-start !important;
  font-size:14px !important;
  padding:10px 12px !important;
}

.proMouthChart{
  height:620px !important;
  padding:12px !important;
}

.proTooth{
  width:38px !important;
  height:56px !important;
}

.proToothSvg{
  width:34px !important;
  height:48px !important;
}

.proToothSvg path{
  stroke-width:2.4 !important;
}

.proToothSvg .shine{
  fill:none !important;
  stroke:rgba(255,255,255,.45) !important;
  stroke-width:3 !important;
  stroke-linecap:round !important;
}

.proTooth span{
  font-size:10px !important;
  margin-top:1px !important;
}

@media(max-width:520px){
  .toothLegend{
    grid-template-columns:repeat(2,1fr) !important;
  }

  .proMouthChart{
    height:620px !important;
  }

  .proTooth{
    width:34px !important;
    height:52px !important;
  }

  .proToothSvg{
    width:31px !important;
    height:45px !important;
  }

  .proTooth span{
    font-size:9px !important;
  }
}
  `;
  document.head.appendChild(style);
}

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  $(id)?.classList.add("active");
  document.querySelector(`[data-page="${id}"]`)?.classList.add("active");
  window.scrollTo(0, 0);
}

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
function saveClinicData(data) { return JSON.stringify({ visits: data.visits || [], appointments: data.appointments || [], payments: data.payments || [], teeth: data.teeth || {} }); }
function paymentTotals(data) { const total = data.payments.reduce((s, x) => s + Number(x.total || 0), 0); const paid = data.payments.reduce((s, x) => s + Number(x.paid || 0), 0); return { total, paid, remaining: total - paid }; }

function renderTimeline(patient) {
  const data = parseClinicData(patient.progress_notes);
  const timeline = [];
  (data.visits || []).forEach(v => timeline.push({ type: "visit", date: v.date || "", text: v.note || "Visit note" }));
  (data.payments || []).forEach(p => timeline.push({ type: "payment", date: p.date || "", text: `Paid ${p.paid || 0}` }));
  (data.appointments || []).forEach(a => timeline.push({ type: "appointment", date: a.date || "", text: a.note || "Appointment" }));
  (patient.photos || []).forEach(ph => timeline.push({ type: "photo", date: ph.date || "", text: "Photo added" }));
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
  return timeline.length ? timeline.map(item => `<div class="timelineItem"><div class="timelineDate">${safeText(item.date)}</div><div class="timelineText">${item.type === "payment" ? "ð°" : item.type === "visit" ? "ð" : item.type === "appointment" ? "ð" : "ð·"} ${safeText(item.text)}</div></div>`).join("") : `<p style="color:var(--muted);font-weight:800">No timeline yet</p>`;
}

async function loadPatients() {
  try {
    if ($("status")) $("status").textContent = "Loading cloud...";
    if (currentUser.role === "admin") patients = await api("patients?select=*&order=created_at.desc");
    else patients = await api(`patients?owner_id=eq.${currentUser.id}&select=*&order=created_at.desc`);
    renderPatients(); renderDashboard();
    if ($("status")) $("status").textContent = "Cloud connected â";
    const params = new URLSearchParams(location.search);
    const patientId = params.get("patient");
    if (patientId) openPatient(patientId);
  } catch (err) {
    console.error(err);
    if ($("status")) $("status").textContent = "Cloud error â";
    if ($("list")) $("list").innerHTML = `<div class="card"><h3>Cloud error</h3><p>${safeText(err.message)}</p></div>`;
  }
}

function renderDashboard() {
  const dash = $("dashboardContent"); if (!dash) return;
  let totalPhotos = 0, totalVisits = 0, unpaid = 0, totalRevenue = 0, paidToday = 0, missingPlan = 0;
  let upcoming = [], todayAppointments = [], overdueAppointments = [];
  patients.forEach(p => {
    const data = parseClinicData(p.progress_notes); const money = paymentTotals(data);
    totalPhotos += (p.photos || []).length; totalVisits += data.visits.length; unpaid += money.remaining; totalRevenue += money.paid;
    data.payments.forEach(pay => { if (new Date(pay.date).toDateString() === new Date().toDateString()) paidToday += Number(pay.paid || 0); });
    if (!p.treatment_plan || !p.treatment_plan.trim()) missingPlan++;
    data.appointments.forEach(a => {
      const item = { patient: p.name || "No name", phone: p.phone || "", date: a.date || "", note: a.note || "" };
      const appDate = new Date(a.date); const today = new Date();
      if (!isNaN(appDate)) {
        if (appDate.toDateString() === today.toDateString()) todayAppointments.push(item);
        else if (appDate < today) overdueAppointments.push(item);
        else upcoming.push(item);
      } else upcoming.push(item);
    });
  });
  upcoming = upcoming.slice(0, 5);
  dash.innerHTML = `<div class="heroGrid"><div class="statCard"><small>Total patients</small><strong>${patients.length}</strong></div><div class="statCard"><small>Total photos</small><strong>${totalPhotos}</strong></div><div class="statCard"><small>Unpaid balance</small><strong>${unpaid}</strong></div><div class="statCard"><small>Total visits</small><strong>${totalVisits}</strong></div><div class="statCard"><small>Total revenue</small><strong>${totalRevenue}</strong></div><div class="statCard"><small>Paid today</small><strong>${paidToday}</strong></div></div><div class="quickActions"><button class="primary" onclick="fillForm();showPage('form')">+ New Patient</button><button class="secondary" onclick="showPage('scan')">Scan QR</button><button class="secondary" onclick="backupData()">Backup</button><button class="secondary" onclick="restoreBackup()">Restore</button></div><div class="dashboardPanel"><h2>Clinic Alerts</h2><span class="pill">${missingPlan} without treatment plan</span><span class="pill">${todayAppointments.length} today appointments</span><span class="pill">${overdueAppointments.length} overdue appointments</span></div>${dashboardPanel("Today Appointments", todayAppointments, "No appointments today")}${dashboardPanel("Overdue Appointments", overdueAppointments, "No overdue appointments")}${dashboardPanel("Upcoming Appointments", upcoming, "No upcoming appointments")}`;
}
function dashboardPanel(title, arr, empty) { return `<div class="dashboardPanel"><h2>${title}</h2>${arr.length ? arr.map(a => `<div class="appointment"><b>${safeText(a.date)}</b><p>${safeText(a.patient)} - ${safeText(a.phone)}</p><p>${safeText(a.note)}</p></div>`).join("") : `<p style="color:var(--muted);font-weight:800">${empty}</p>`}</div>`; }

function renderPatients() {
  const q = ($("search")?.value || "").toLowerCase();
  const filtered = patients.filter(p => (p.name || "").toLowerCase().includes(q) || (p.phone || "").includes(q) || (p.case_id || "").toLowerCase().includes(q) || (p.diagnosis || "").toLowerCase().includes(q) || (p.chief_complaint || "").toLowerCase().includes(q));
  if ($("list")) $("list").innerHTML = filtered.length ? "" : `<div class="card"><h3>No patients yet</h3></div>`;
  filtered.forEach(p => {
    const data = parseClinicData(p.progress_notes); const money = paymentTotals(data);
    const card = document.createElement("div"); card.className = "patientCard";
    card.innerHTML = `<h3>${safeText(p.name || "No name")}</h3><span class="pill">ID: ${safeText(p.case_id || "-")}</span><span class="pill">${safeText(p.phone || "No phone")}</span><span class="pill">${(p.photos || []).length} photos</span><span class="pill">${data.visits.length} visits</span><span class="pill">Remaining: ${money.remaining}</span><p style="color:var(--muted);margin-top:8px">${safeText(p.chief_complaint || p.diagnosis || "")}</p><div class="actions"><button class="primary" onclick="openPatient('${p.id}')">Open</button>${canEdit() ? `<button class="secondary" onclick="editPatient('${p.id}')">Edit</button>` : ""}<button class="secondary" onclick="showQR('${p.id}')">QR</button></div>`;
    $("list").appendChild(card);
  });
}

function getFormData(oldPatient = null) {
  const oldData = parseClinicData(oldPatient?.progress_notes);
  const newNote = $("progressNotes")?.value.trim();
  if (newNote) oldData.visits.unshift({ date: new Date().toLocaleString(), note: newNote, treatment: $("treatmentPlan")?.value || "" });
  return { owner_id: oldPatient?.owner_id || currentUser.id, case_id: $("caseId").value || oldPatient?.case_id || makeId(), name: $("name").value, phone: $("phone").value, age: $("age").value, gender: $("gender").value, chief_complaint: $("chiefComplaint").value, medical_alerts: $("medicalAlerts").value, diagnosis: $("diagnosis").value, treatment_plan: $("treatmentPlan").value, progress_notes: saveClinicData(oldData), photos: oldPatient?.photos || [] };
}
function fillForm(p = null) {
  $("rowId").value = p?.id || ""; $("caseId").value = p?.case_id || ""; $("name").value = p?.name || ""; $("phone").value = p?.phone || ""; $("age").value = p?.age || ""; $("gender").value = p?.gender || ""; $("chiefComplaint").value = p?.chief_complaint || ""; $("medicalAlerts").value = p?.medical_alerts || ""; $("diagnosis").value = p?.diagnosis || ""; $("treatmentPlan").value = p?.treatment_plan || ""; $("progressNotes").value = ""; $("progressNotes").placeholder = p ? "Write a new visit note..." : "Write first visit note..."; $("formTitle").textContent = p ? "Edit Patient" : "Add Patient"; if ($("preview")) $("preview").innerHTML = ""; pendingFiles = [];
}

async function compressImage(file) {
  const img = await new Promise(resolve => { const i = new Image(); i.onload = () => resolve(i); i.src = URL.createObjectURL(file); });
  const canvas = document.createElement("canvas"); const max = 1400; let w = img.width, h = img.height;
  if (Math.max(w, h) > max) { const scale = max / Math.max(w, h); w = Math.round(w * scale); h = Math.round(h * scale); }
  canvas.width = w; canvas.height = h; canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.75));
}
async function uploadToBucket(bucket, path, blob, type) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": type || "application/octet-stream" }, body: blob });
  if (!res.ok) throw new Error(await res.text());
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
async function uploadPhotos(patientId) {
  const uploaded = [];
  for (const file of pendingFiles) {
    const blob = await compressImage(file); const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "-"); const path = `${patientId}/${Date.now()}-${cleanName}.jpg`;
    uploaded.push({ path, url: await uploadToBucket(PHOTO_BUCKET, path, blob, "image/jpeg"), name: file.name, date: new Date().toLocaleString() });
  }
  return uploaded;
}

function toothSvg() {
  return `
    <svg viewBox="0 0 80 110" class="proToothSvg">
      <path d="
        M40 8
        C25 8 15 20 15 38
        C15 52 21 65 24 78
        C27 94 31 104 37 104
        C43 104 42 82 48 82
        C54 82 54 104 61 104
        C68 104 72 90 74 76
        C77 60 78 48 76 36
        C73 18 60 8 48 8
        C45 8 42 10 40 13
        C37 10 34 8 30 8
        Z
      "/>

      <path
        class="shine"
        d="M28 18 C22 28 22 44 26 56"
      />
    </svg>
  `;
}
}

function renderToothChart(p) {
  const data = parseClinicData(p.progress_notes);
  const teeth = data.teeth || {};

 const toothPositions = [
  [18,11,47],[17,13,38],[16,17,30],[15,23,23],[14,31,18],[13,39,14],[12,47,12],[11,52,12],
  [21,58,12],[22,66,14],[23,74,18],[24,82,23],[25,88,30],[26,92,38],[27,94,47],[28,94,56],

  [48,11,61],[47,13,70],[46,18,78],[45,25,84],[44,33,89],[43,41,92],[42,48,94],[41,53,94],
  [31,59,94],[32,66,92],[33,74,89],[34,82,84],[35,89,78],[36,94,70],[37,96,61],[38,96,52]
];

  return `
    <div class="proMouthChart">
      <div class="proMouthLabel upper">UPPER</div>
      <div class="proMouthLabel lower">LOWER</div>
      <div class="proMidLine"></div>
      <div class="proHorizontalLine"></div>

      ${toothPositions.map(([n,x,y]) => {
        const status = teeth[n] || "healthy";
        return `
          <button
            class="proTooth ${safeText(status)}"
            style="left:${x}%;top:${y}%"
            onclick="openToothPopup('${p.id}', '${n}')"
          >
            ${toothSvg()}
            <span>${n}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}
function patientDetailsHTML(p) {
  const data = parseClinicData(p.progress_notes); const money = paymentTotals(data);
  return `<div class="card"><h2>${safeText(p.name || "No name")}</h2><span class="pill">ID: ${safeText(p.case_id || "-")}</span><span class="pill">${safeText(p.phone || "No phone")}</span><span class="pill">${safeText(p.age || "-")} yrs</span><span class="pill">${safeText(p.gender || "-")}</span><div class="kv"><b>Chief complaint</b><span>${safeText(p.chief_complaint || "-")}</span></div><div class="kv"><b>Medical alerts</b><span>${safeText(p.medical_alerts || "-")}</span></div><div class="kv"><b>Diagnosis</b><span>${safeText(p.diagnosis || "-")}</span></div><div class="kv"><b>Treatment plan</b><span>${safeText(p.treatment_plan || "-")}</span></div><h3 class="sectionTitle">Visits History</h3>${data.visits.length ? data.visits.map((v, i) => `<div class="kv"><b>Visit ${data.visits.length - i}</b><div class="visitDate">${safeText(v.date || "")}</div><span>${safeText(v.note || "-")}</span></div>`).join("") : `<div class="kv"><span>No visits yet</span></div>`}<h3 class="sectionTitle">Tooth Chart</h3><div class="toothChartBox"><span class="legendItem">Healthy</span><span class="legendItem">Caries</span><span class="legendItem">Filling</span><span class="legendItem">RCT</span><span class="legendItem">Crown</span><span class="legendItem">Missing</span><span class="legendItem">Extraction</span><span class="legendItem">Implant</span></div><div class="toothChart">${renderToothChart(p)}</div><h3 class="sectionTitle">Appointments</h3><div class="actions"><button class="primary" onclick="addAppointment('${p.id}')">+ Add Appointment</button></div>${data.appointments.length ? data.appointments.map((a, i) => `<div class="appointment"><b>${safeText(a.date || "-")}</b><p>${safeText(a.note || "")}</p><button class="danger" onclick="deleteAppointment('${p.id}', ${i})">Delete</button></div>`).join("") : `<div class="kv"><span>No appointments yet</span></div>`}<h3 class="sectionTitle">Payments</h3><div class="miniGrid"><div class="miniCard"><b>Total</b><span class="money">${money.total}</span></div><div class="miniCard"><b>Paid</b><span class="money">${money.paid}</span></div><div class="miniCard"><b>Remaining</b><span class="money unpaid">${money.remaining}</span></div></div><div class="actions"><button class="primary" onclick="addPayment('${p.id}')">+ Add Payment</button></div>${data.payments.length ? data.payments.map((pay, i) => `<div class="appointment"><b>${safeText(pay.date || "")}</b><p>Total: ${Number(pay.total || 0)} | Paid: ${Number(pay.paid || 0)} | Remaining: ${Number(pay.total || 0) - Number(pay.paid || 0)}</p><button class="danger" onclick="deletePayment('${p.id}', ${i})">Delete</button></div>`).join("") : `<div class="kv"><span>No payments yet</span></div>`}<h3 class="sectionTitle">Photos / X-rays</h3><button class="secondary" onclick="showBeforeAfter('${p.id}')">Before / After</button><div class="grid">${(p.photos || []).map((ph, i) => `<div class="thumbWrap"><img class="thumb" src="${ph.url}" onclick="viewPhoto('${ph.url}')"><button class="x" onclick="deletePhoto('${p.id}', ${i})">Ã</button></div>`).join("") || "<p>No photos</p>"}</div><h3 class="sectionTitle">Patient Timeline</h3><div class="patientCard">${renderTimeline(p)}</div><div class="actions">${canEdit() ? `<button class="primary" onclick="editPatient('${p.id}')">Edit</button>` : ""}<button class="secondary" onclick="showQR('${p.id}')">QR</button><button class="secondary" onclick="exportPDF('${p.id}')">PDF</button>${canDelete() ? `<button class="danger" onclick="deletePatient('${p.id}')">Delete</button>` : ""}</div></div>`;
}

window.openPatient = function(id) { const p = patients.find(x => x.id === id); if (!p) return alert("Patient not found or you do not have access."); $("details").innerHTML = patientDetailsHTML(p); showPage("detail"); };
window.editPatient = function(id) { const p = patients.find(x => x.id === id); if (!p) return alert("Patient not found or you do not have access."); fillForm(p); showPage("form"); };
window.deletePatient = async function(id) { if (!canDelete()) return alert("Only admin can delete patients"); if (!confirm("Delete this patient?")) return; await api(`patients?id=eq.${id}`, { method: "DELETE" }); await loadPatients(); showPage("patients"); };
let selectedToothPatientId = null;
let selectedToothNumber = null;

window.openToothPopup = function(patientId, toothNumber) {
  selectedToothPatientId = patientId;
  selectedToothNumber = toothNumber;

  const modal = document.getElementById("toothModal");
  const title = document.getElementById("toothModalTitle");

  if (title) {
    title.textContent = "Tooth " + toothNumber;
  }

  if (modal) {
    modal.classList.remove("hidden");
  }
};

window.closeToothPopup = function() {
  const modal = document.getElementById("toothModal");
  if (modal) modal.classList.add("hidden");
};

window.setToothStatus = async function(status) {
  if (!selectedToothPatientId || !selectedToothNumber) return;

  const p = patients.find(x => x.id === selectedToothPatientId);
  if (!p) return alert("Patient not found.");

  const data = parseClinicData(p.progress_notes);

  data.teeth[selectedToothNumber] = status;

  await api(`patients?id=eq.${selectedToothPatientId}`, {
    method: "PATCH",
    body: JSON.stringify({
      progress_notes: saveClinicData(data)
    })
  });

  closeToothPopup();

  await loadPatients();
  openPatient(selectedToothPatientId);
};
window.changeTooth = async function(patientId, toothNumber) { if (!canEdit()) return alert("You don't have permission to edit tooth chart"); const p = patients.find(x => x.id === patientId); if (!p) return alert("Patient not found or you do not have access."); const data = parseClinicData(p.progress_notes); const options = ["healthy","caries","filling","rct","crown","missing","extraction","implant"]; const current = data.teeth[toothNumber] || "healthy"; const next = prompt(`Tooth ${toothNumber} status:\n\n1 healthy\n2 caries\n3 filling\n4 rct\n5 crown\n6 missing\n7 extraction\n8 implant\n\nType number or word.\nCurrent: ${current}`, current); if (!next) return; const map = {"1":"healthy","2":"caries","3":"filling","4":"rct","5":"crown","6":"missing","7":"extraction","8":"implant"}; const clean = map[next.trim()] || next.toLowerCase().trim(); if (!options.includes(clean)) return alert("Invalid tooth status"); data.teeth[toothNumber] = clean; await api(`patients?id=eq.${patientId}`, { method:"PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) }); await loadPatients(); openPatient(patientId); };
window.addAppointment = async function(id) { const p = patients.find(x => x.id === id); if (!p) return alert("Patient not found or you do not have access."); const data = parseClinicData(p.progress_notes); const date = prompt("Appointment date/time:"); if (!date) return; const note = prompt("Appointment note:") || ""; data.appointments.unshift({ date, note }); await api(`patients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) }); await loadPatients(); openPatient(id); };
window.deleteAppointment = async function(id, index) { const p = patients.find(x => x.id === id); if (!p) return alert("Patient not found or you do not have access."); const data = parseClinicData(p.progress_notes); data.appointments.splice(index, 1); await api(`patients?id=eq.${id}`, { method:"PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) }); await loadPatients(); openPatient(id); };
window.addPayment = async function(id) { const p = patients.find(x => x.id === id); if (!p) return alert("Patient not found or you do not have access."); const data = parseClinicData(p.progress_notes); const total = prompt("Total treatment cost:"); if (!total) return; const paid = prompt("Paid amount:") || "0"; data.payments.unshift({ date: new Date().toLocaleString(), total: Number(total || 0), paid: Number(paid || 0) }); await api(`patients?id=eq.${id}`, { method:"PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) }); await loadPatients(); openPatient(id); };
window.deletePayment = async function(id, index) { const p = patients.find(x => x.id === id); if (!p) return alert("Patient not found or you do not have access."); const data = parseClinicData(p.progress_notes); data.payments.splice(index, 1); await api(`patients?id=eq.${id}`, { method:"PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) }); await loadPatients(); openPatient(id); };
window.showBeforeAfter = function(id) { const p = patients.find(x => x.id === id); if (!p || !(p.photos || []).length) return alert("No photos available for comparison."); const photos = p.photos || []; if (photos.length < 2) return alert("You need at least 2 photos for before / after comparison."); const before = photos[Number(prompt(`Choose BEFORE photo number: 1 to ${photos.length}`, "1")) - 1]; const after = photos[Number(prompt(`Choose AFTER photo number: 1 to ${photos.length}`, String(photos.length))) - 1]; if (!before || !after) return alert("Invalid photo number."); const box = document.createElement("div"); box.className = "compareBox"; box.innerHTML = `<h3 class="sectionTitle">Before / After Comparison</h3><div class="compareGrid"><div><div class="compareLabel">Before</div><img src="${before.url}"></div><div><div class="compareLabel">After</div><img src="${after.url}"></div></div>`; $("details").prepend(box); };

function openPhotoViewer(index = 0) { if (!currentPhotoList.length) return; currentPhotoIndex = index; $("viewerImage").src = currentPhotoList[currentPhotoIndex].url; $("photoViewer").classList.remove("hidden"); }
function closePhotoViewer() { $("photoViewer")?.classList.add("hidden"); }
function nextPhoto() { if (!currentPhotoList.length) return; currentPhotoIndex = (currentPhotoIndex + 1) % currentPhotoList.length; $("viewerImage").src = currentPhotoList[currentPhotoIndex].url; }
function prevPhoto() { if (!currentPhotoList.length) return; currentPhotoIndex = (currentPhotoIndex - 1 + currentPhotoList.length) % currentPhotoList.length; $("viewerImage").src = currentPhotoList[currentPhotoIndex].url; }
window.viewPhoto = function(url) { const patient = patients.find(p => (p.photos || []).some(ph => ph.url === url)); currentPhotoList = patient?.photos || [{ url }]; currentPhotoIndex = currentPhotoList.findIndex(ph => ph.url === url); if (currentPhotoIndex < 0) currentPhotoIndex = 0; openPhotoViewer(currentPhotoIndex); };
window.deletePhoto = async function(patientId, index) { if (!canEdit()) return alert("You don't have permission to delete photos"); const p = patients.find(x => x.id === patientId); if (!p) return alert("Patient not found or you do not have access."); if (!confirm("Delete this photo?")) return; const photos = [...(p.photos || [])]; photos.splice(index, 1); await api(`patients?id=eq.${patientId}`, { method:"PATCH", body: JSON.stringify({ photos }) }); await loadPatients(); openPatient(patientId); };
window.showQR = function(id) { const p = patients.find(x => x.id === id); if (!p) return alert("Patient not found or you do not have access."); $("qrcode").innerHTML = ""; const patientLink = location.origin + location.pathname + "?patient=" + encodeURIComponent(id); new QRCode($("qrcode"), { text: patientLink, width: 220, height: 220 }); $("qrModal").classList.remove("hidden"); };

window.backupData = function() { const backup = { exported_at: new Date().toISOString(), user: currentUser, patients }; const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `masri-dental-clinic-backup-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); };
window.restoreBackup = function() { const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json"; input.onchange = async e => { const file = e.target.files[0]; if (!file) return; if (!confirm("Restore backup? This will upload patients from the backup file.")) return; try { const backup = JSON.parse(await file.text()); if (!backup.patients || !Array.isArray(backup.patients)) return alert("Invalid backup file."); for (const p of backup.patients) { const newPatient = { owner_id: currentUser.role === "admin" ? (p.owner_id || currentUser.id) : currentUser.id, case_id: p.case_id || makeId(), name: p.name || "", phone: p.phone || "", age: p.age || "", gender: p.gender || "", chief_complaint: p.chief_complaint || "", medical_alerts: p.medical_alerts || "", diagnosis: p.diagnosis || "", treatment_plan: p.treatment_plan || "", progress_notes: p.progress_notes || "", photos: p.photos || [] }; await api("patients", { method: "POST", body: JSON.stringify(newPatient) }); } alert("Backup restored successfully."); await loadPatients(); showPage("patients"); } catch (err) { alert("Restore failed: " + err.message); } }; input.click(); };

window.saveClinicBranding = async function() {
  try {
    const clinicName = $("clinicName")?.value?.trim() || "";
    let logoUrl = currentUser.clinic_logo || "";
    const logoFile = $("clinicLogo")?.files?.[0];
    if (logoFile) {
      const clean = logoFile.name.replace(/[^a-zA-Z0-9.]/g, "-");
      const path = `${currentUser.id}/logo-${Date.now()}-${clean}`;
      logoUrl = await uploadToBucket(LOGO_BUCKET, path, logoFile, logoFile.type || "image/png");
    }
    await api(`clinic_users?id=eq.${currentUser.id}`, { method: "PATCH", body: JSON.stringify({ clinic_name: clinicName, clinic_logo: logoUrl }) });
    currentUser.clinic_name = clinicName; currentUser.clinic_logo = logoUrl; saveUser(currentUser); applyUserBar(); alert("Clinic branding saved.");
  } catch (err) { alert("Save failed: " + err.message); }
};

window.exportPDF = function(id) {
  const p = patients.find(x => x.id === id); if (!p) return alert("Patient not found or you do not have access.");
  const data = parseClinicData(p.progress_notes); const money = paymentTotals(data); const clinicName = currentUser.clinic_name || "Masri Dental Clinic"; const logo = currentUser.clinic_logo || ""; const win = window.open("", "_blank");
  win.document.write(`<html><head><title>${safeText(p.name)} - Dental Report</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f8;color:#111827}.report{max-width:900px;margin:auto;padding:28px}.header{background:linear-gradient(135deg,#070b10,#111827);color:white;border-radius:24px;padding:26px;margin-bottom:20px}.header h1{margin:0;font-size:34px}.header p{margin:8px 0 0;color:#d4af37;font-weight:bold}.logo{width:90px;height:90px;object-fit:contain;margin-bottom:12px;background:white;border-radius:18px;padding:8px}.section{background:white;border-radius:18px;padding:20px;margin-bottom:16px;border:1px solid #e5e7eb}.section h2{margin:0 0 14px;font-size:22px;color:#111827;border-bottom:2px solid #d4af37;padding-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.item{background:#f9fafb;border-radius:14px;padding:12px;border:1px solid #e5e7eb}.label{display:block;color:#6b7280;font-size:12px;font-weight:bold;text-transform:uppercase;margin-bottom:5px}.value{font-size:15px;white-space:pre-wrap}.visit,.payment,.appointment{border-left:4px solid #d4af37;padding:12px;background:#f9fafb;border-radius:12px;margin-bottom:10px}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.photos img{width:100%;height:160px;object-fit:cover;border-radius:14px;border:1px solid #e5e7eb}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.moneyBox{background:#111827;color:white;border-radius:16px;padding:14px}.moneyBox b{color:#d4af37;display:block;margin-bottom:6px}.footer{text-align:center;color:#6b7280;margin-top:24px;font-size:12px}@media print{body{background:white}.report{padding:0}.section,.header{break-inside:avoid}button{display:none}}</style></head><body><div class="report"><div class="header">${logo ? `<img class="logo" src="${logo}">` : ""}<h1>${safeText(clinicName)}</h1><p>Professional Dental Patient Report</p></div><div class="section"><h2>Patient Information</h2><div class="grid"><div class="item"><span class="label">Name</span><span class="value">${safeText(p.name || "-")}</span></div><div class="item"><span class="label">Patient ID</span><span class="value">${safeText(p.case_id || "-")}</span></div><div class="item"><span class="label">Phone</span><span class="value">${safeText(p.phone || "-")}</span></div><div class="item"><span class="label">Age / Gender</span><span class="value">${safeText(p.age || "-")} / ${safeText(p.gender || "-")}</span></div></div></div><div class="section"><h2>Clinical Summary</h2><div class="item"><span class="label">Chief Complaint</span><span class="value">${safeText(p.chief_complaint || "-")}</span></div><br><div class="item"><span class="label">Medical Alerts</span><span class="value">${safeText(p.medical_alerts || "-")}</span></div><br><div class="item"><span class="label">Diagnosis</span><span class="value">${safeText(p.diagnosis || "-")}</span></div><br><div class="item"><span class="label">Treatment Plan</span><span class="value">${safeText(p.treatment_plan || "-")}</span></div></div><div class="section"><h2>Payments Summary</h2><div class="summary"><div class="moneyBox"><b>Total</b>${money.total}</div><div class="moneyBox"><b>Paid</b>${money.paid}</div><div class="moneyBox"><b>Remaining</b>${money.remaining}</div></div></div><div class="section"><h2>Visits History</h2>${data.visits.length ? data.visits.map(v => `<div class="visit"><b>${safeText(v.date || "")}</b><p>${safeText(v.note || "-")}</p></div>`).join("") : "<p>No visits recorded.</p>"}</div><div class="section"><h2>Appointments</h2>${data.appointments.length ? data.appointments.map(a => `<div class="appointment"><b>${safeText(a.date || "")}</b><p>${safeText(a.note || "-")}</p></div>`).join("") : "<p>No appointments recorded.</p>"}</div><div class="section"><h2>Payments History</h2>${data.payments.length ? data.payments.map(pay => `<div class="payment"><b>${safeText(pay.date || "")}</b><p>Total: ${Number(pay.total || 0)} | Paid: ${Number(pay.paid || 0)} | Remaining: ${Number(pay.total || 0) - Number(pay.paid || 0)}</p></div>`).join("") : "<p>No payments recorded.</p>"}</div><div class="section"><h2>Photos / X-rays</h2><div class="photos">${(p.photos || []).length ? p.photos.map(ph => `<img src="${ph.url}">`).join("") : "<p>No photos recorded.</p>"}</div></div><div class="footer">Generated by ${safeText(clinicName)} Management System</div></div><script>window.onload=()=>setTimeout(()=>window.print(),700);</script></body></html>`);
  win.document.close();
};

$("patientForm")?.addEventListener("submit", async e => { e.preventDefault(); if (!canEdit()) return alert("You don't have permission to save patients"); $("saveBtn").disabled = true; $("saveBtn").textContent = "Saving..."; try { const id = $("rowId").value; const oldPatient = id ? patients.find(p => p.id === id) : null; const data = getFormData(oldPatient); let saved; if (id) { saved = await api(`patients?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(data) }); saved = saved[0]; } else { saved = await api("patients", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(data) }); saved = saved[0]; } if (pendingFiles.length) { $("saveBtn").textContent = "Uploading photos..."; const uploaded = await uploadPhotos(saved.id); const allPhotos = [...(saved.photos || []), ...uploaded]; await api(`patients?id=eq.${saved.id}`, { method: "PATCH", body: JSON.stringify({ photos: allPhotos }) }); } pendingFiles = []; $("patientForm").reset(); fillForm(); await loadPatients(); showPage("patients"); } catch (err) { alert("Save failed: " + err.message); } finally { $("saveBtn").disabled = false; $("saveBtn").textContent = "Save Patient"; } });
$("photos")?.addEventListener("change", e => { pendingFiles = [...e.target.files]; $("preview").innerHTML = pendingFiles.map(file => `<img class="thumb" src="${URL.createObjectURL(file)}">`).join(""); });
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
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => showPage(tab.dataset.page)));

async function startScan() { if (!window.Html5Qrcode) return alert("QR scanner library not loaded"); try { $("startScan").classList.add("hidden"); $("stopScan").classList.remove("hidden"); scanner = new Html5Qrcode("reader"); await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, decodedText => { stopScan(); try { const url = new URL(decodedText); const patientId = url.searchParams.get("patient"); if (patientId) openPatient(patientId); else alert("Invalid patient QR"); } catch { alert("Invalid QR code"); } }); } catch (err) { alert("Camera failed: " + err.message); stopScan(); } }
async function stopScan() { try { if (scanner) { await scanner.stop(); scanner.clear(); scanner = null; } } catch {} $("startScan")?.classList.remove("hidden"); $("stopScan")?.classList.add("hidden"); }

window.addEventListener("load", async () => {
  try {
    injectExtraStyles();
    if (location.search.includes("logout=1")) { localStorage.removeItem("clinicUser"); showLoginScreen(); return; }
    currentUser = getSavedUser();
    if (!currentUser || !currentUser.id || !currentUser.role) { localStorage.removeItem("clinicUser"); showLoginScreen(); return; }
    applyUserBar();
    await loadPatients();
  } catch (err) {
    document.body.innerHTML = "<pre style='padding:20px;color:red;white-space:pre-wrap'>" + safeText(err.message) + "</pre>";
  }
});
