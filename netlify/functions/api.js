const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Content-Type": "application/json"
};

async function supabase(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const action = event.queryStringParameters?.action || "list";
    const id = event.queryStringParameters?.id;

    if (action === "list" && event.httpMethod === "GET") {
      const res = await supabase("patients?select=*&order=created_at.desc");
      return { statusCode: res.status, headers, body: await res.text() };
    }

    if (action === "get" && event.httpMethod === "GET") {
      const res = await supabase(`patients?id=eq.${id}&select=*`);
      return { statusCode: res.status, headers, body: await res.text() };
    }

    if (action === "create" && event.httpMethod === "POST") {
      const p = JSON.parse(event.body || "{}");

      const payload = {
        case_id: p.case_id || p.caseId || String(Date.now()),
        name: p.name || "",
        phone: p.phone || "",
        age: p.age || "",
        gender: p.gender || "",
        chief_complaint: p.chief_complaint || p.chiefComplaint || "",
        medical_alerts: p.medical_alerts || p.medicalAlerts || "",
        diagnosis: p.diagnosis || "",
        treatment_plan: p.treatment_plan || p.treatmentPlan || "",
        progress_notes: p.progress_notes || p.progressNotes || "",
        photos: p.photos || []
      };

      const res = await supabase("patients", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      });

      return { statusCode: res.status, headers, body: await res.text() };
    }

    if (action === "update" && event.httpMethod === "PUT") {
      const p = JSON.parse(event.body || "{}");

      const payload = {
        case_id: p.case_id || p.caseId || "",
        name: p.name || "",
        phone: p.phone || "",
        age: p.age || "",
        gender: p.gender || "",
        chief_complaint: p.chief_complaint || p.chiefComplaint || "",
        medical_alerts: p.medical_alerts || p.medicalAlerts || "",
        diagnosis: p.diagnosis || "",
        treatment_plan: p.treatment_plan || p.treatmentPlan || "",
        progress_notes: p.progress_notes || p.progressNotes || "",
        photos: p.photos || [],
        updated_at: new Date().toISOString()
      };

      const res = await supabase(`patients?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      });

      return { statusCode: res.status, headers, body: await res.text() };
    }

    if (action === "delete" && event.httpMethod === "DELETE") {
      const res = await supabase(`patients?id=eq.${id}`, {
        method: "DELETE"
      });

      return { statusCode: res.status, headers, body: JSON.stringify({ ok: true }) };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Not found" })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
