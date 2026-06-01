const SUPABASE_URL = "https://vstfquvvtsmgmztmnnaq.supabase.co";
const SUPABASE_KEY = "sb_publishable_9sp5XCEbqCNk0CQNyoE8SA_3a-rXoDn";
const BUCKET = "patient-photos";

const $ = id => document.getElementById(id);

let patients = [];
let pendingFiles = [];
let scanner = null;

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

function parseVisits(progress) {
  if (!progress) return [];

  try {
    const data = JSON.parse(progress);
    if (Array.isArray(data)) return data;
  } catch {}

  return [{
    date: "Old note",
    tooth: "",
    treatment: "",
    note: progress
  }];
}

function visitsToText(visits) {
  return JSON.stringify(visits || []);
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
    $("status").textContent = "Cloud error ❌";
    console.error(err);
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
    const visits = parseVisits(p.progress_notes);

    const card = document.createElement("div");
    card.className = "patientCard";
    card.innerHTML = `
      <h3>${p.name || "No name"}</h3>
      <span class="pill">ID: ${p.case_id || "-"}</span>
      <span class="pill">${p.phone || "No phone"}</span>
      <span class="pill">${(p.photos || []).length} photos</span>
      <span class="pill">${visits.length} visits</span>

      <p style="color:var(--muted);margin-top:8px">
        ${p.chief_complaint || p.diagnosis || ""}
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
  const oldVisits = parseVisits(oldPatient?.progress_notes);
  const newNote = $("progressNotes")?.value.trim();

  let visits = [...oldVisits];

  if (newNote) {
    visits.unshift({
      date: new Date().toLocaleString(),
      tooth: $("caseId").value || "",
      treatment: $("treatmentPlan").value || "",
      note: newNote
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
    progress_notes: visitsToText(visits),
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

  $("formTitle").textContent = p ? "Edit Patient" : "Add Patient";
  $("preview").innerHTML = "";
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

  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.75));
}

async function uploadPhotos(patientId) {
  const uploaded = [];

  for (const file of pendingFiles) {
    const blob = await compressImage(file);
    const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "-");
    const path = `${patientId}/${Date.now()}-${cleanName}.jpg`;

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "image/jpeg"
      },
      body: blob
    });

    if (!res.ok) throw new Error("Photo upload failed");

    uploaded.push({
      path,
      url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
      name: file.name,
      date: new Date().toLocaleString()
    });
  }

  return uploaded;
}

$("patientForm").addEventListener("submit", async e => {
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
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(data)
      });
      saved = saved[0];
    } else {
      saved = await api("patients", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(data)
      });
      saved = saved[0];
    }

    if (pendingFiles.length) {
      $("saveBtn").textContent = "Uploading photos...";
      const uploaded = await uploadPhotos(saved.id);
      const allPhotos = [...(saved.photos || []), ...uploaded];

      await api(`patients?id=eq.${saved.id}`, {
        method: "PATCH",
        body: JSON.stringify({ photos: allPhotos })
      });
    }

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

$("photos").addEventListener("change", e => {
  pendingFiles = [...e.target.files];
  $("preview").innerHTML = pendingFiles.map(file =>
    `<img class="thumb" src="${URL.createObjectURL(file)}">`
  ).join("");
});

window.openPatient = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;

  const visits = parseVisits(p.progress_notes);

  $("details").innerHTML = `
    <div class="card">
      <h2>${p.name || "No name"}</h2>

      <span class="pill">ID: ${p.case_id || "-"}</span>
      <span class="pill">${p.phone || "No phone"}</span>
      <span class="pill">${p.age || "-"} yrs</span>
      <span class="pill">${p.gender || "-"}</span>

      <div class="kv"><b>Chief complaint</b><span>${p.chief_complaint || "-"}</span></div>
      <div class="kv"><b>Medical alerts</b><span>${p.medical_alerts || "-"}</span></div>
      <div class="kv"><b>Diagnosis</b><span>${p.diagnosis || "-"}</span></div>
      <div class="kv"><b>Treatment plan</b><span>${p.treatment_plan || "-"}</span></div>

      <h3 style="margin-top:24px">Visits History</h3>
      ${
        visits.length
          ? visits.map((v, i) => `
            <div class="kv">
              <b>Visit ${visits.length - i} — ${v.date}</b>
              <span>${v.note || "-"}</span>
            </div>
          `).join("")
          : `<div class="kv"><span>No visits yet</span></div>`
      }

      <h3 style="margin-top:24px">Photos / X-rays</h3>
      <div class="grid">
        ${
          (p.photos || []).map(ph =>
            `<img class="thumb" src="${ph.url}" onclick="viewPhoto('${ph.url}')">`
          ).join("") || "<p>No photos</p>"
        }
      </div>

      <div class="actions">
        <button class="primary" onclick="editPatient('${p.id}')">Edit</button>
        <button class="secondary" onclick="showQR('${p.id}')">QR</button>
        <button class="danger" onclick="deletePatient('${p.id}')">Delete</button>
      </div>
    </div>
  `;

  showPage("detail");
};

window.editPatient = function(id) {
  const p = patients.find(x => x.id === id);
  fillForm(p);
  showPage("form");
};

window.deletePatient = async function(id) {
  if (!confirm("Delete this patient?")) return;

  await api(`patients?id=eq.${id}`, { method: "DELETE" });
  await loadPatients();
  showPage("patients");
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

    $("startScan").classList.add("hidden");
    $("stopScan").classList.remove("hidden");

  } catch (err) {
    alert("Scanner failed: " + err.message);
  }
}

async function stopScan() {
  if (scanner) {
    await scanner.stop();
    scanner = null;
  }

  $("reader").innerHTML = "";
  $("startScan").classList.remove("hidden");
  $("stopScan").classList.add("hidden");
}

$("closePhoto")?.addEventListener("click", () => $("photoModal").classList.add("hidden"));
$("closeQr")?.addEventListener("click", () => $("qrModal").classList.add("hidden"));
$("backBtn")?.addEventListener("click", () => showPage("patients"));
$("refreshBtn")?.addEventListener("click", loadPatients);
$("search")?.addEventListener("input", renderPatients);
$("startScan")?.addEventListener("click", startScan);
$("stopScan")?.addEventListener("click", stopScan);

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => showPage(tab.dataset.page));
});

window.addEventListener("load", async () => {
  await loadPatients();

  const match = location.hash.match(/patient=([^&]+)/);
  if (match) openPatient(match[1]);
});
