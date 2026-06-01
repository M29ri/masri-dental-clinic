const SUPABASE_URL = "https://vstfquvvtsmgmztmnnaq.supabase.co";
const SUPABASE_KEY = "sb_publishable_9sp5XCEbqCNk0CQNyoE8SA_3a-rXoDn";

const statusEl = document.getElementById("status");
const tabs = document.querySelectorAll(".tab");
const pages = document.querySelectorAll(".page");
const form = document.getElementById("patientForm");
const list = document.getElementById("list");
const search = document.getElementById("search");

let patients = [];

async function api(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

async function loadPatients() {
  statusEl.textContent = "Loading cloud...";
  const res = await api("patients?select=*&order=created_at.desc");
  patients = await res.json();
  renderPatients();
  statusEl.textContent = "Cloud connected ✅";
}

function renderPatients() {
  const q = (search.value || "").toLowerCase();
  const filtered = patients.filter(p =>
    (p.name || "").toLowerCase().includes(q) ||
    (p.phone || "").includes(q) ||
    (p.case_id || "").toLowerCase().includes(q)
  );

  list.innerHTML = filtered.length ? "" : "<h3>No patients yet</h3>";

  filtered.forEach(p => {
    const card = document.createElement("div");
    card.className = "patientCard";
    card.innerHTML = `
      <h2>${p.name || "No name"}</h2>
      <p><b>ID:</b> ${p.case_id || "-"}</p>
      <p><b>Phone:</b> ${p.phone || "-"}</p>
    `;
    list.appendChild(card);
  });
}

form.addEventListener("submit", async e => {
  e.preventDefault();

  const patient = {
    case_id: document.getElementById("caseId").value || String(Date.now()),
    name: document.getElementById("name").value,
    phone: document.getElementById("phone").value,
    age: document.getElementById("age").value,
    gender: document.getElementById("gender").value,
    chief_complaint: document.getElementById("chiefComplaint").value,
    medical_alerts: document.getElementById("medicalAlerts").value,
    diagnosis: document.getElementById("diagnosis").value,
    treatment_plan: document.getElementById("treatmentPlan").value,
    progress_notes: document.getElementById("progressNotes").value,
    photos: []
  };

  const res = await api("patients", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patient)
  });

  if (!res.ok) {
    alert("Save failed");
    return;
  }

  form.reset();
  await loadPatients();
  showPage("patients");
});

function showPage(id) {
  tabs.forEach(t => t.classList.toggle("active", t.dataset.page === id));
  pages.forEach(p => p.classList.toggle("active", p.id === id));
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => showPage(tab.dataset.page));
});

search.addEventListener("input", renderPatients);

loadPatients();
