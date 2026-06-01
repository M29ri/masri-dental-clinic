const API = "/.netlify/functions/api?path=";

const statusEl = document.getElementById("status");
const tabs = document.querySelectorAll(".tab");
const pages = document.querySelectorAll(".page");

const patientForm = document.getElementById("patientForm");
const list = document.getElementById("list");
const search = document.getElementById("search");

let patients = [];

async function loadPatients() {
  try {
    statusEl.textContent = "Connecting...";

    const res = await fetch(API + "patients");
    const text = await res.text();

    try {
      patients = JSON.parse(text);
    } catch {
      patients = [];
    }

    renderPatients();
    statusEl.textContent = "Cloud connected ✅";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Cloud error ❌";
  }
}

function renderPatients() {
  list.innerHTML = "";

  const query = search.value?.toLowerCase() || "";

  const filtered = patients.filter(p =>
    (p.name || "").toLowerCase().includes(query) ||
    (p.phone || "").includes(query) ||
    (p.caseId || "").includes(query)
  );

  if (filtered.length === 0) {
    list.innerHTML = "<p>No patients yet</p>";
    return;
  }

  filtered.forEach(patient => {
    const card = document.createElement("div");
    card.className = "patientCard";
    card.style.padding = "12px";
    card.style.margin = "10px 0";
    card.style.background = "#fff";
    card.style.borderRadius = "12px";

    card.innerHTML = `
      <h3>${patient.name || "No name"}</h3>
      <p>ID: ${patient.caseId || "-"}</p>
      <p>Phone: ${patient.phone || "-"}</p>
    `;

    list.appendChild(card);
  });
}

patientForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const patient = {
    caseId: document.getElementById("caseId")?.value || Date.now().toString(),
    name: document.getElementById("name")?.value || "",
    phone: document.getElementById("phone")?.value || "",
    age: document.getElementById("age")?.value || "",
    gender: document.getElementById("gender")?.value || "",
    chiefComplaint: document.getElementById("chiefComplaint")?.value || "",
    diagnosis: document.getElementById("diagnosis")?.value || "",
    treatmentPlan: document.getElementById("treatmentPlan")?.value || "",
    progressNotes: document.getElementById("progressNotes")?.value || ""
  };

  patients.push(patient);

  renderPatients();

  alert("Patient added ✅");

  patientForm.reset();
});

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    pages.forEach(p => p.classList.remove("active"));

    tab.classList.add("active");

    const page = document.getElementById(tab.dataset.page);
    page?.classList.add("active");
  });
});

search?.addEventListener("input", renderPatients);

loadPatients();
