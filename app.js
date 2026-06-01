const SUPABASE_URL = "https://vstfquvvtsmgmztmnnaq.supabase.co";
const SUPABASE_KEY = "sb_publishable_9sp5XCEbqCNk0CQNyoE8SA_3a-rXoDn";
const BUCKET = "patient-photos";

const $ = id => document.getElementById(id);
let patients = [];
let pendingFiles = [];

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

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  $(id).classList.add("active");
  document.querySelector(`[data-page="${id}"]`)?.classList.add("active");
}

function makeId() {
  return "P-" + Date.now();
}

async function loadPatients() {
  $("status").textContent = "Loading cloud...";
  patients = await api("patients?select=*&order=created_at.desc");
  renderPatients();
  $("status").textContent = "Cloud connected ✅";
}

function renderPatients() {
  const q = ($("search").value || "").toLowerCase();

  const filtered = patients.filter(p =>
    (p.name || "").toLowerCase().includes(q) ||
    (p.phone || "").includes(q) ||
    (p.case_id || "").toLowerCase().includes(q) ||
    (p.diagnosis || "").toLowerCase().includes(q)
  );

  $("list").innerHTML = filtered.length ? "" : `<div class="card"><h3>No patients yet</h3></div>`;

  filtered.forEach(p => {
    const card = document.createElement("div");
    card.className = "patientCard";
    card.innerHTML = `
      <h3>${p.name || "No name"}</h3>
      <span class="pill">ID: ${p.case_id || "-"}</span>
      <span class="pill">${p.phone || "No phone"}</span>
      <span class="pill">${(p.photos || []).length} photos</span>
      <p style="color:var(--muted);margin-top:8px">${p.chief_complaint || p.diagnosis || ""}</p>

      <div class="actions">
        <button class="primary" onclick="openPatient('${p.id}')">Open</button>
        <button class="secondary" onclick="editPatient('${p.id}')">Edit</button>
        <button class="secondary" onclick="showQR('${p.id}')">QR</button>
      </div>
    `;
    $("list").appendChild(card);
  });
}

function getFormData() {
  return {
    case_id: $("caseId").value || makeId(),
    name: $("name").value,
    phone: $("phone").value,
    age: $("age").value,
    gender: $("gender").value,
    chief_complaint: $("chiefComplaint").value,
    medical_alerts: $("medicalAlerts").value,
    diagnosis: $("diagnosis").value,
    treatment_plan: $("treatmentPlan").value,
    progress_notes: $("progressNotes").value,
    photos: []
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
  $("progressNotes").value = p?.progress_notes || "";
  $("formTitle").textContent = p ? "Edit Patient" : "Add Patient";
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
    const path = `${patientId}/${Date.now()}-${file.name}.jpg`;

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
    $("saveBtn").textContent = "Saving...";
    $("saveBtn").disabled = true;

    const id = $("rowId").value;
    let data = getFormData();
    let saved;

    if (id) {
      const old = patients.find(p => p.id === id);
      data.photos = old.photos || [];

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

    pendingFiles = [];
    fillForm();
    $("patientForm").reset();
    await loadPatients();
    showPage("patients");

  } catch (err) {
    alert("Save failed: " + err.message);
  } finally {
    $("saveBtn").textContent = "Save Patient";
    $("saveBtn").disabled = false;
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

  $("details").innerHTML = `
    <div class="card">
      <h2>${p.name}</h2>
      <span class="pill">ID: ${p.case_id}</span>
      <span class="pill">${p.phone || "No phone"}</span>
      <span class="pill">${p.age || "-"} yrs</span>
      <span class="pill">${p.gender || "-"}</span>

      <div class="kv"><b>Chief complaint</b><span>${p.chief_complaint || "-"}</span></div>
      <div class="kv"><b>Medical alerts</b><span>${p.medical_alerts || "-"}</span></div>
      <div class="kv"><b>Diagnosis</b><span>${p.diagnosis || "-"}</span></div>
      <div class="kv"><b>Treatment plan</b><span>${p.treatment_plan || "-"}</span></div>
      <div class="kv"><b>Progress / Visits</b><span>${p.progress_notes || "-"}</span></div>

      <h3 style="margin-top:20px">Photos / X-rays</h3>
      <div class="grid">
        ${(p.photos || []).map(ph =>
          `<img class="thumb" src="${ph.url}" onclick="viewPhoto('${ph.url}')">`
        ).join("") || "<p>No photos</p>"}
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

$("closePhoto")?.addEventListener("click", () => $("photoModal").classList.add("hidden"));
$("closeQr")?.addEventListener("click", () => $("qrModal").classList.add("hidden"));
$("backBtn")?.addEventListener("click", () => showPage("patients"));
$("refreshBtn")?.addEventListener("click", loadPatients);
$("search")?.addEventListener("input", renderPatients);

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => showPage(tab.dataset.page));
});

window.addEventListener("load", async () => {
  await loadPatients();

  const match = location.hash.match(/patient=([^&]+)/);
  if (match) openPatient(match[1]);
});
