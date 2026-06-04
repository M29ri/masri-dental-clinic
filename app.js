let currentUser = null;

function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("clinicUser"));
  } catch {
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem("clinicUser", JSON.stringify(user));
  currentUser = user;
}

function logout() {
  localStorage.removeItem("clinicUser");
  location.reload();
}

async function login(username, password) {
  const users = await api(
    `clinic_users?username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}&select=*`
  );

  if (!users.length) {
    alert("Wrong username or password");
    return;
  }

  saveUser(users[0]);
  location.reload();
}

function showLoginScreen() {
  document.body.innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:linear-gradient(160deg,#070b10,#111827);
      padding:24px;
      color:white;
      font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;
    ">
      <div style="
        width:100%;
        max-width:420px;
        background:#121821;
        border:1px solid #263241;
        border-radius:32px;
        padding:28px;
        box-shadow:0 20px 50px rgba(0,0,0,.45);
      ">
        <h1 style="font-size:30px;margin-bottom:8px;">Masri Dental Clinic</h1>
        <p style="color:#9ca9b8;margin-bottom:24px;">Secure login</p>

        <label style="display:block;margin-bottom:14px;">
          Username
          <input id="loginUsername" style="
            width:100%;
            margin-top:8px;
            padding:16px;
            border-radius:18px;
            border:1px solid #263241;
            background:#0f1620;
            color:white;
            font-size:16px;
          ">
        </label>

        <label style="display:block;margin-bottom:20px;">
          Password
          <input id="loginPassword" type="password" style="
            width:100%;
            margin-top:8px;
            padding:16px;
            border-radius:18px;
            border:1px solid #263241;
            background:#0f1620;
            color:white;
            font-size:16px;
          ">
        </label>

        <button id="loginBtn" style="
          width:100%;
          padding:16px;
          border:none;
          border-radius:18px;
          background:linear-gradient(135deg,#d4af37,#8f6b10);
          color:black;
          font-weight:900;
          font-size:17px;
        ">
          Login
        </button>

        <p style="margin-top:18px;color:#9ca9b8;font-size:13px;">
          Default admin: admin / 1234
        </p>
      </div>
    </div>
  `;

  document.getElementById("loginBtn").onclick = () => {
    login(
      document.getElementById("loginUsername").value.trim(),
      document.getElementById("loginPassword").value.trim()
    );
  };
}

async function addUser() {
  if (!currentUser || currentUser.role !== "admin") {
    alert("Only admin can add users");
    return;
  }

  const username = prompt("New username:");
  if (!username) return;

  const password = prompt("Password:");
  if (!password) return;

  const full_name = prompt("Full name:") || username;

  const role = prompt("Role: admin / doctor / assistant", "doctor");
  if (!["admin", "doctor", "assistant"].includes(role)) {
    alert("Invalid role");
    return;
  }

  await api("clinic_users", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
      full_name,
      role
    })
  });

  alert("User added successfully");
}

function applyUserBar() {
  const topbar = document.querySelector(".topbar") || document.querySelector("header");
  if (!topbar || !currentUser) return;

  const userBox = document.createElement("div");
  userBox.style.cssText = `
    margin-top:10px;
    display:flex;
    gap:8px;
    flex-wrap:wrap;
    align-items:center;
  `;

  userBox.innerHTML = `
    <span class="pill">
      ${currentUser.full_name || currentUser.username} (${currentUser.role})
    </span>
    ${
      currentUser.role === "admin"
        ? `<button class="secondary" onclick="addUser()">+ User</button>`
        : ""
    }
    <button class="danger" onclick="logout()">Logout</button>
  `;

  topbar.appendChild(userBox);
}

function canEdit() {
  return currentUser && ["admin", "doctor"].includes(currentUser.role);
}

function canDelete() {
  return currentUser && currentUser.role === "admin";
}
const SUPABASE_URL = "https://vstfquvvtsmgmztmnnaq.supabase.co";
const SUPABASE_KEY = "sb_publishable_9sp5XCEbqCNk0CQNyoE8SA_3a-rXoDn";
const BUCKET = "patient-photos";

const $ = id => document.getElementById(id);

let patients = [];
let pendingFiles = [];
let scanner = null;

function safeText(value = "") {
  return String(value ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function injectExtraStyles() {
  if (document.getElementById("clinicExtraStyles")) return;

  const style = document.createElement("style");
  style.id = "clinicExtraStyles";
  style.textContent = `
    .page{display:none}
    .page.active{display:block}

    .sectionTitle{
      margin-top:24px;
      margin-bottom:12px;
      color:var(--gold,#d4af37);
      font-size:22px;
      font-weight:900;
    }

    .miniGrid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
      margin-top:14px;
    }

    .miniCard{
      background:#0f1620;
      border:1px solid var(--border,#263241);
      border-radius:22px;
      padding:16px;
    }

    .miniCard b{
      display:block;
      color:var(--gold,#d4af37);
      margin-bottom:6px;
    }

    .money{
      font-size:22px;
      font-weight:900;
      color:var(--green,#19c37d);
    }

    .unpaid{
      color:#ff7676;
    }

    .appointment{
      background:#0f1620;
      border:1px solid var(--border,#263241);
      border-radius:20px;
      padding:14px;
      margin-top:10px;
    }

    .appointment b{
      color:var(--gold,#d4af37);
    }

    .visitDate{
      color:var(--muted,#9ca9b8);
      font-size:13px;
      margin-bottom:6px;
    }

    .kv{
      margin-top:18px;
      padding:16px;
      background:#0f1620;
      border:1px solid var(--border,#263241);
      border-radius:20px;
    }

    .kv b{
      display:block;
      color:var(--gold,#d4af37);
      margin-bottom:8px;
      font-size:14px;
    }

    .kv span{
      color:#e5edf6;
      white-space:pre-wrap;
      line-height:1.6;
    }

    .toothChart{
      display:grid;
      grid-template-columns:repeat(8,1fr);
      gap:8px;
      margin-top:14px;
    }

    .tooth{
      background:#0f1620;
      border:1px solid var(--border,#263241);
      color:white;
      border-radius:14px;
      padding:10px 4px;
      text-align:center;
      font-size:13px;
      font-weight:800;
    }

    .tooth.healthy{border-color:#334155}
    .tooth.caries{background:#4a1d1d;color:#ff9b9b}
    .tooth.filling{background:#1e3a5f;color:#93c5fd}
    .tooth.rct{background:#3b2f13;color:#facc15}
    .tooth.crown{background:#3a2b00;color:#ffd700}
    .tooth.missing{background:#111827;color:#6b7280;text-decoration:line-through}
    .tooth.extraction{background:#3f1111;color:#f87171}
    .tooth.implant{background:#12352b;color:#5eead4}

    .toothLegend{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:12px;
    }

    .legendItem{
      background:#0f1620;
      border:1px solid var(--border,#263241);
      padding:8px 10px;
      border-radius:999px;
      font-size:12px;
      color:var(--muted,#9ca9b8);
    }
  `;
  document.head.appendChild(style);
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

function makeId() {
  return "P-" + Date.now();
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

    if (Array.isArray(data)) {
      return { visits: data, appointments: [], payments: [], teeth: {} };
    }

    return {
      visits: data.visits || [],
      appointments: data.appointments || [],
      payments: data.payments || [],
      teeth: data.teeth || {}
    };
  } catch {
    return {
      visits: [{ date: "Old note", note: raw }],
      appointments: [],
      payments: [],
      teeth: {}
    };
  }
}

function saveClinicData(data) {
  return JSON.stringify({
    visits: data.visits || [],
    appointments: data.appointments || [],
    payments: data.payments || [],
    teeth: data.teeth || {}
  });
}

function paymentTotals(data) {
  const total = data.payments.reduce((s, x) => s + Number(x.total || 0), 0);
  const paid = data.payments.reduce((s, x) => s + Number(x.paid || 0), 0);
  return { total, paid, remaining: total - paid };
}

async function loadPatients() {
  try {
    $("status").textContent = "Loading cloud...";
    patients = await api("patients?select=*&order=created_at.desc");
    renderPatients();
    $("status").textContent = "Cloud connected ✅";

    const match = location.hash.match(/patient=([^&]+)/);
    if (match) openPatient(match[1]);
  } catch (err) {
    console.error(err);
    $("status").textContent = "Cloud error ❌";
  }
}

function renderPatients() {
  const q = ($("search")?.value || "").toLowerCase();

  const filtered = patients.filter(p =>
    (p.name || "").toLowerCase().includes(q) ||
    (p.phone || "").includes(q) ||
    (p.case_id || "").toLowerCase().includes(q) ||
    (p.diagnosis || "").toLowerCase().includes(q) ||
    (p.chief_complaint || "").toLowerCase().includes(q)
  );

  $("list").innerHTML = filtered.length
    ? ""
    : `<div class="card"><h3>No patients yet</h3></div>`;

  filtered.forEach(p => {
    const data = parseClinicData(p.progress_notes);
    const money = paymentTotals(data);

    const card = document.createElement("div");
    card.className = "patientCard";
    card.innerHTML = `
      <h3>${safeText(p.name || "No name")}</h3>
      <span class="pill">ID: ${safeText(p.case_id || "-")}</span>
      <span class="pill">${safeText(p.phone || "No phone")}</span>
      <span class="pill">${(p.photos || []).length} photos</span>
      <span class="pill">${data.visits.length} visits</span>
      <span class="pill">Remaining: ${money.remaining}</span>

      <p style="color:var(--muted);margin-top:8px">
        ${safeText(p.chief_complaint || p.diagnosis || "")}
      </p>

      <div class="actions">
        <button class="primary" onclick="openPatient('${p.id}')">Open</button>
        <button class="secondary" onclick="editPatient('${p.id}')">Edit</button>
        <button class="secondary" onclick="showQR('${p.id}')">QR</button>
      </div>
    `;

    $("list").appendChild(card);
  });
}
function getFormData(oldPatient = null) {
  const oldData = parseClinicData(oldPatient?.progress_notes);
  const newNote = $("progressNotes")?.value.trim();

  if (newNote) {
    oldData.visits.unshift({
      date: new Date().toLocaleString(),
      note: newNote,
      treatment: $("treatmentPlan")?.value || ""
    });
  }

  return {
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
  $("progressNotes").placeholder = p
    ? "Write a new visit note..."
    : "Write first visit note...";

  $("formTitle").textContent = p
    ? "Edit Patient"
    : "Add Patient";

  if ($("preview")) $("preview").innerHTML = "";

  pendingFiles = [];
}

async function compressImage(file) {
  const img = await new Promise(resolve => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.src = URL.createObjectURL(file);
  });

  const canvas = document.createElement("canvas");

  const max = 1400;
  let w = img.width;
  let h = img.height;

  if (Math.max(w, h) > max) {
    const scale = max / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  canvas.width = w;
  canvas.height = h;

  canvas.getContext("2d").drawImage(img, 0, 0, w, h);

  return new Promise(resolve =>
    canvas.toBlob(resolve, "image/jpeg", 0.75)
  );
}

async function uploadPhotos(patientId) {
  const uploaded = [];

  for (const file of pendingFiles) {
    const blob = await compressImage(file);

    const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "-");

    const path =
      `${patientId}/${Date.now()}-${cleanName}.jpg`;

    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "image/jpeg"
        },
        body: blob
      }
    );

    if (!res.ok) {
      throw new Error("Photo upload failed");
    }

    uploaded.push({
      path,
      url:
        `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
      name: file.name,
      date: new Date().toLocaleString()
    });
  }

  return uploaded;
}

function renderToothChart(p) {
  const data = parseClinicData(p.progress_notes);
  const teeth = data.teeth || {};

  const numbers = [
    18,17,16,15,14,13,12,11,
    21,22,23,24,25,26,27,28,
    48,47,46,45,44,43,42,41,
    31,32,33,34,35,36,37,38
  ];

  return numbers.map(n => {
    const status = teeth[n] || "healthy";

    return `
      <button
        class="tooth ${status}"
        onclick="changeTooth('${p.id}','${n}')"
      >
        ${n}
      </button>
    `;
  }).join("");
}

function patientDetailsHTML(p) {
  const data = parseClinicData(p.progress_notes);
  const money = paymentTotals(data);

  return `
    <div class="card">

      <h2>${safeText(p.name || "No name")}</h2>

      <span class="pill">
        ID: ${safeText(p.case_id || "-")}
      </span>

      <span class="pill">
        ${safeText(p.phone || "No phone")}
      </span>

      <span class="pill">
        ${safeText(p.age || "-")} yrs
      </span>

      <span class="pill">
        ${safeText(p.gender || "-")}
      </span>

      <div class="kv">
        <b>Chief complaint</b>
        <span>
          ${safeText(p.chief_complaint || "-")}
        </span>
      </div>

      <div class="kv">
        <b>Medical alerts</b>
        <span>
          ${safeText(p.medical_alerts || "-")}
        </span>
      </div>

      <div class="kv">
        <b>Diagnosis</b>
        <span>
          ${safeText(p.diagnosis || "-")}
        </span>
      </div>

      <div class="kv">
        <b>Treatment plan</b>
        <span>
          ${safeText(p.treatment_plan || "-")}
        </span>
      </div>

      <h3 class="sectionTitle">
        Visits History
      </h3>

      ${
        data.visits.length
          ? data.visits.map((v, i) => `
            <div class="kv">
              <b>
                Visit ${data.visits.length - i}
              </b>

              <div class="visitDate">
                ${safeText(v.date || "")}
              </div>

              <span>
                ${safeText(v.note || "-")}
              </span>
            </div>
          `).join("")
          : `
            <div class="kv">
              <span>No visits yet</span>
            </div>
          `
      }

      <h3 class="sectionTitle">
        Tooth Chart
      </h3>

      <div class="toothLegend">
        <span class="legendItem">Healthy</span>
        <span class="legendItem">Caries</span>
        <span class="legendItem">Filling</span>
        <span class="legendItem">RCT</span>
        <span class="legendItem">Crown</span>
        <span class="legendItem">Missing</span>
        <span class="legendItem">Extraction</span>
        <span class="legendItem">Implant</span>
      </div>

      <div class="toothChart">
        ${renderToothChart(p)}
      </div>
            <h3 class="sectionTitle">
        Appointments
      </h3>

      <div class="actions">
        <button
          class="primary"
          onclick="addAppointment('${p.id}')"
        >
          + Add Appointment
        </button>
      </div>

      ${
        data.appointments.length
          ? data.appointments.map((a, i) => `
            <div class="appointment">
              <b>${safeText(a.date || "-")}</b>
              <p>${safeText(a.note || "")}</p>

              <button
                class="danger"
                onclick="deleteAppointment('${p.id}',${i})"
              >
                Delete
              </button>
            </div>
          `).join("")
          : `
            <div class="kv">
              <span>No appointments yet</span>
            </div>
          `
      }

      <h3 class="sectionTitle">
        Payments
      </h3>

      <div class="miniGrid">
        <div class="miniCard">
          <b>Total</b>
          <div class="money">${money.total}</div>
        </div>

        <div class="miniCard">
          <b>Paid</b>
          <div class="money">${money.paid}</div>
        </div>

        <div class="miniCard">
          <b>Remaining</b>
          <div class="money unpaid">
            ${money.remaining}
          </div>
        </div>
      </div>

      <div class="actions">
        <button
          class="primary"
          onclick="addPayment('${p.id}')"
        >
          + Add Payment
        </button>
      </div>

      ${
        data.payments.length
          ? data.payments.map((pay, i) => `
            <div class="appointment">
              <b>${safeText(pay.date || "")}</b>

              <p>
                Total: ${Number(pay.total || 0)}
                |
                Paid: ${Number(pay.paid || 0)}
                |
                Remaining:
                ${Number(pay.total || 0) - Number(pay.paid || 0)}
              </p>

              <button
                class="danger"
                onclick="deletePayment('${p.id}',${i})"
              >
                Delete
              </button>
            </div>
          `).join("")
          : `
            <div class="kv">
              <span>No payments yet</span>
            </div>
          `
      }

      <h3 class="sectionTitle">
        Photos / X-rays
      </h3>

      <div class="grid">
        ${
          (p.photos || []).map((ph, i) => `
            <div class="thumbWrap">
              <img
                class="thumb"
                src="${ph.url}"
                onclick="viewPhoto('${ph.url}')"
              >

              <button
                class="x"
                onclick="deletePhoto('${p.id}',${i})"
              >
                ×
              </button>
            </div>
          `).join("") || "<p>No photos</p>"
        }
      </div>

      <div class="actions">
        <button
          class="primary"
          onclick="editPatient('${p.id}')"
        >
          Edit
        </button>

        <button
          class="secondary"
          onclick="showQR('${p.id}')"
        >
          QR
        </button>

        <button
          class="secondary"
          onclick="exportPDF('${p.id}')"
        >
          PDF
        </button>

        <button
          class="danger"
          onclick="deletePatient('${p.id}')"
        >
          Delete
        </button>
      </div>

    </div>
  `;
}

window.openPatient = function(id) {
  const p = patients.find(x => x.id === id);

  if (!p) {
    alert("Patient not found. Refresh and try again.");
    return;
  }

  $("details").innerHTML = patientDetailsHTML(p);
  showPage("detail");
};

window.changeTooth = async function(patientId, toothNumber) {
  const p = patients.find(x => x.id === patientId);
  const data = parseClinicData(p.progress_notes);

  const options = [
    "healthy",
    "caries",
    "filling",
    "rct",
    "crown",
    "missing",
    "extraction",
    "implant"
  ];

  const current = data.teeth[toothNumber] || "healthy";

  const next = prompt(
    `Tooth ${toothNumber} status:\n\n` +
    options.join("\n") +
    `\n\nCurrent: ${current}`,
    current
  );

  if (!next) return;

  const clean = next.toLowerCase();

  if (!options.includes(clean)) {
    alert("Invalid tooth status");
    return;
  }

  data.teeth[toothNumber] = clean;

  await api(`patients?id=eq.${patientId}`, {
    method: "PATCH",
    body: JSON.stringify({
      progress_notes: saveClinicData(data)
    })
  });

  await loadPatients();
  openPatient(patientId);
};

window.addAppointment = async function(id) {
  const p = patients.find(x => x.id === id);
  const data = parseClinicData(p.progress_notes);

  const date = prompt("Appointment date/time:");

  if (!date) return;

  const note = prompt("Appointment note:") || "";

  data.appointments.unshift({
    date,
    note
  });

  await api(`patients?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      progress_notes: saveClinicData(data)
    })
  });

  await loadPatients();
  openPatient(id);
};

window.deleteAppointment = async function(id, index) {
  const p = patients.find(x => x.id === id);
  const data = parseClinicData(p.progress_notes);

  data.appointments.splice(index, 1);

  await api(`patients?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      progress_notes: saveClinicData(data)
    })
  });

  await loadPatients();
  openPatient(id);
};

window.addPayment = async function(id) {
  const p = patients.find(x => x.id === id);
  const data = parseClinicData(p.progress_notes);

  const total = prompt("Total treatment cost:");

  if (!total) return;

  const paid = prompt("Paid amount:") || "0";

  data.payments.unshift({
    date: new Date().toLocaleString(),
    total: Number(total || 0),
    paid: Number(paid || 0)
  });

  await api(`patients?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      progress_notes: saveClinicData(data)
    })
  });

  await loadPatients();
  openPatient(id);
};

window.deletePayment = async function(id, index) {
  const p = patients.find(x => x.id === id);
  const data = parseClinicData(p.progress_notes);

  data.payments.splice(index, 1);

  await api(`patients?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      progress_notes: saveClinicData(data)
    })
  });

  await loadPatients();
  openPatient(id);
};
window.exportPDF = function(id) {
  const p = patients.find(x => x.id === id);
  const data = parseClinicData(p.progress_notes);
  const money = paymentTotals(data);

  const win = window.open("", "_blank");

  win.document.write(`
    <html>
      <head>
        <title>${safeText(p.name)} - Patient File</title>

        <style>
          body{
            font-family:Arial;
            padding:25px;
            color:#111;
          }

          h1{
            border-bottom:2px solid #111;
            padding-bottom:10px;
          }

          h2{
            margin-top:25px;
          }

          .box{
            border:1px solid #ccc;
            padding:12px;
            margin:10px 0;
            border-radius:10px;
            white-space:pre-wrap;
          }

          img{
            max-width:180px;
            margin:8px;
            border-radius:8px;
          }

          table{
            border-collapse:collapse;
            width:100%;
            margin-top:10px;
          }

          td,th{
            border:1px solid #ccc;
            padding:8px;
            text-align:left;
          }
        </style>
      </head>

      <body>
        <h1>Masri Dental Clinic</h1>

        <h2>Patient File</h2>

        <p><b>Name:</b> ${safeText(p.name || "")}</p>
        <p><b>ID:</b> ${safeText(p.case_id || "")}</p>
        <p><b>Phone:</b> ${safeText(p.phone || "")}</p>
        <p><b>Age:</b> ${safeText(p.age || "")}</p>
        <p><b>Gender:</b> ${safeText(p.gender || "")}</p>

        <h2>Clinical Data</h2>

        <div class="box">
          <b>Chief complaint:</b><br>
          ${safeText(p.chief_complaint || "-")}
        </div>

        <div class="box">
          <b>Medical alerts:</b><br>
          ${safeText(p.medical_alerts || "-")}
        </div>

        <div class="box">
          <b>Diagnosis:</b><br>
          ${safeText(p.diagnosis || "-")}
        </div>

        <div class="box">
          <b>Treatment plan:</b><br>
          ${safeText(p.treatment_plan || "-")}
        </div>

        <h2>Visits</h2>

        ${
          data.visits.length
            ? data.visits.map(v => `
              <div class="box">
                <b>${safeText(v.date)}</b><br>
                ${safeText(v.note || "-")}
              </div>
            `).join("")
            : "<p>No visits</p>"
        }

        <h2>Tooth Chart</h2>

        <table>
          <tr>
            <th>Tooth</th>
            <th>Status</th>
          </tr>

          ${
            Object.entries(data.teeth || {}).map(([tooth, status]) => `
              <tr>
                <td>${tooth}</td>
                <td>${safeText(status)}</td>
              </tr>
            `).join("") ||
            "<tr><td colspan='2'>No tooth data</td></tr>"
          }
        </table>

        <h2>Appointments</h2>

        ${
          data.appointments.length
            ? data.appointments.map(a => `
              <div class="box">
                <b>${safeText(a.date)}</b><br>
                ${safeText(a.note || "")}
              </div>
            `).join("")
            : "<p>No appointments</p>"
        }

        <h2>Payments</h2>

        <p><b>Total:</b> ${money.total}</p>
        <p><b>Paid:</b> ${money.paid}</p>
        <p><b>Remaining:</b> ${money.remaining}</p>

        <h2>Photos / X-rays</h2>

        ${
          (p.photos || []).map(ph => `
            <img src="${ph.url}">
          `).join("") || "<p>No photos</p>"
        }

        <script>
          window.onload = () =>
            setTimeout(() => window.print(), 500);
        </script>
      </body>
    </html>
  `);

  win.document.close();
};

window.deletePatient = async function(id) {

  if (!currentUser || currentUser.role !== "admin") {
    alert("Only admin can delete patients");
    return;
  }

  if (!confirm("Delete this patient?")) return;

  await api(`patients?id=eq.${id}`, {
    method: "DELETE"
  });

  await loadPatients();
  showPage("patients");
};

window.deletePhoto = async function(id, index) {
  if (!confirm("Delete this photo?")) return;

  const p = patients.find(x => x.id === id);

  const photos = [...(p.photos || [])];

  photos.splice(index, 1);

  await api(`patients?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      photos
    })
  });

  await loadPatients();

  openPatient(id);
};

window.viewPhoto = function(url) {
  $("bigPhoto").src = url;

  $("photoModal").classList.remove("hidden");
};

window.showQR = function(id) {
  $("qrcode").innerHTML = "";

  new QRCode($("qrcode"), {
    text: location.origin + location.pathname + "#patient=" + id,
    width: 220,
    height: 220
  });

  $("qrModal").classList.remove("hidden");
};

async function startScan() {
  try {
    scanner = new Html5Qrcode("reader");

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      text => {
        const match = text.match(/#patient=([^&]+)/);

        if (match) {
          stopScan();
          openPatient(match[1]);
        } else {
          alert("Not a patient QR");
        }
      }
    );

    $("startScan")?.classList.add("hidden");

    $("stopScan")?.classList.remove("hidden");
  } catch (err) {
    alert("Scanner failed: " + err.message);
  }
}

async function stopScan() {
  if (scanner) {
    await scanner.stop();
    scanner = null;
  }

  if ($("reader")) {
    $("reader").innerHTML = "";
  }

  $("startScan")?.classList.remove("hidden");

  $("stopScan")?.classList.add("hidden");
}

$("patientForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  try {
    $("saveBtn").disabled = true;

    $("saveBtn").textContent = "Saving...";

    const id = $("rowId").value;

    const oldPatient = patients.find(p => p.id === id);

    let data = getFormData(oldPatient);

    let saved;

    if (id) {
      saved = await api(`patients?id=eq.${id}`, {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify(data)
      });

      saved = saved[0];
    } else {
      saved = await api("patients", {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify(data)
      });

      saved = saved[0];
    }

    if (pendingFiles.length) {
      $("saveBtn").textContent = "Uploading photos...";

      const uploaded = await uploadPhotos(saved.id);

      const allPhotos = [
        ...(saved.photos || []),
        ...uploaded
      ];

      await api(`patients?id=eq.${saved.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          photos: allPhotos
        })
      });
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

$("photos")?.addEventListener("change", e => {
  pendingFiles = [...e.target.files];

  $("preview").innerHTML = pendingFiles.map(file => `
    <img class="thumb" src="${URL.createObjectURL(file)}">
  `).join("");
});

$("closePhoto")?.addEventListener("click", () =>
  $("photoModal").classList.add("hidden")
);

$("closeQr")?.addEventListener("click", () =>
  $("qrModal").classList.add("hidden")
);

$("backBtn")?.addEventListener("click", () =>
  showPage("patients")
);

$("refreshBtn")?.addEventListener("click", loadPatients);

$("search")?.addEventListener("input", renderPatients);

$("startScan")?.addEventListener("click", startScan);

$("stopScan")?.addEventListener("click", stopScan);

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () =>
    showPage(tab.dataset.page)
  );
window.addEventListener("load", async () => {
  injectExtraStyles();

  currentUser = getSavedUser();

  if (!currentUser) {
    showLoginScreen();
    return;
  applyUserBar();
if (!canEdit()) {
  document.querySelectorAll(".editBtn,.deleteBtn")
    .forEach(el => el.style.display = "none");
}
  await loadPatients();

  const match = location.hash.match(/patient=([^&]+)/);

  if (match) {
    openPatient(match[1]);
  }
});
                                          
