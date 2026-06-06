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
  const full_name = await luxuryPrompt("Your full name", "Doctor name");
  if (!full_name) return;
  const username = await luxuryPrompt("Choose username", "Username");
  if (!username) return;
  const password = await luxuryPrompt("Choose password", "Password");
  if (!password) return;
  try {
    await api("clinic_users", {
      method: "POST",
      body: JSON.stringify({ username: username.trim(), password: password.trim(), full_name: full_name.trim(), role: "doctor", clinic_name: "", clinic_logo: "" })
    });
    alert("Account created successfully. Login now.");
  } catch (err) { alert("Username already exists or account creation failed"); }
}

async function addUser() {
  if (!currentUser || currentUser.role !== "admin") return alert("Only admin can add users");
  const username = await luxuryPrompt("New username", "Username");
  if (!username) return;
  const password = await luxuryPrompt("Password", "Password");
  if (!password) return;
  const full_name = await luxuryPrompt("Full name", "Full name", username) || username;
  const role = await luxuryPrompt("Role", "admin / doctor / assistant", "doctor");
  if (!["admin", "doctor", "assistant"].includes(role)) return alert("Invalid role");
  await api("clinic_users", { method: "POST", body: JSON.stringify({ username, password, full_name, role }) });
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

  if (brand) {
    brand.textContent = currentUser.clinic_name || "Masri Dental Clinic";
    const brandBox = brand.parentElement;
    if (brandBox && currentUser.clinic_logo && !brandBox.querySelector(".brandLogoMini")) {
      const img = document.createElement("img");
      img.className = "brandLogoMini";
      img.src = currentUser.clinic_logo;
      img.alt = "Clinic logo";
      brandBox.insertBefore(img, brand);
    }
  }

  if ($("clinicName")) $("clinicName").value = currentUser.clinic_name || "";
}

function canEdit() { return currentUser && ["admin", "doctor"].includes(currentUser.role); }
function canDelete() { return currentUser && currentUser.role === "admin"; }
function makeId() { return "P-" + Date.now(); }

function injectExtraStyles() {
  const old = document.getElementById("extraStyles");
  if (old) old.remove();

  const style = document.createElement("style");
  style.id = "extraStyles";
  style.innerHTML = `
    *{-webkit-tap-highlight-color:transparent!important}
    button,a{user-select:none!important;-webkit-user-select:none!important}
    input,textarea,select{user-select:text!important;-webkit-user-select:text!important}

    .sectionTitle{
      margin:28px 0 14px!important;
      color:var(--gold,#d4af37)!important;
      font-size:clamp(30px,6vw,42px)!important;
      font-weight:1000!important;
      letter-spacing:-.8px!important;
    }

    .kv{
      background:#0f1620!important;
      border:1px solid var(--border,#263241)!important;
      border-radius:24px!important;
      padding:18px!important;
      margin:12px 0!important;
    }
    .kv b{display:block!important;color:var(--gold,#d4af37)!important;font-weight:1000!important;margin-bottom:8px!important}
    .visitDate{color:#9ca9b8!important;font-size:13px!important;font-weight:800!important;margin-bottom:6px!important}
    .miniGrid{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:12px!important;margin:14px 0!important}
    .miniCard{background:#0f1620!important;border:1px solid var(--border,#263241)!important;border-radius:22px!important;padding:14px!important}
    .miniCard b{display:block!important;color:var(--gold,#d4af37)!important;margin-bottom:8px!important}
    .money{font-size:24px!important;font-weight:1000!important;color:#19c37d!important}
    .unpaid{color:#fb7185!important}

    .timelineItem{padding:10px 0!important;border-bottom:1px solid rgba(255,255,255,.06)!important}
    .timelineItem:last-child{border-bottom:none!important}
    .timelineDate{color:#dbe6f3!important;font-weight:900!important}
    .timelineText{color:#f8fafc!important;font-weight:800!important}

    /* Legend */
    .toothChartBox{
      display:flex!important;
      flex-wrap:wrap!important;
      gap:10px!important;
      margin:10px 0 18px!important;
      overflow:visible!important;
      width:100%!important;
      justify-content:flex-start!important;
    }
    .legendItem{
      display:inline-flex!important;
      align-items:center!important;
      gap:10px!important;
      padding:11px 16px!important;
      border-radius:999px!important;
      background:#0f1620!important;
      border:1px solid #263241!important;
      color:#dbe6f3!important;
      font-weight:1000!important;
      white-space:nowrap!important;
    }
    .legendItem:before{
      content:"";
      width:14px;
      height:14px;
      border-radius:50%;
      display:inline-block;
      flex-shrink:0;
      background:#22c55e;
    }
    .legendItem:nth-child(2):before{background:#ef4444}
    .legendItem:nth-child(3):before{background:#60a5fa}
    .legendItem:nth-child(4):before{background:#8b5cf6}
    .legendItem:nth-child(5):before{background:#d4af37}
    .legendItem:nth-child(6):before{background:#4b5563}
    .legendItem:nth-child(7):before{background:#fb7185}
    .legendItem:nth-child(8):before{background:#2dd4bf}

    /* Tooth chart */
    .toothChart{display:block!important;width:100%!important;overflow:visible!important}
    .proMouthChart{
      position:relative!important;
      width:100%!important;
      max-width:760px!important;
      height:620px!important;
      margin:20px auto!important;
      left:0!important;
      border-radius:34px!important;
      background:radial-gradient(circle at center,#111827,#070b10)!important;
      border:1px solid #263241!important;
      overflow:hidden!important;
    }
    .proMidLine{
      position:absolute!important;
      left:61%!important;
      top:22%!important;
      height:58%!important;
      border-left:1px dashed rgba(212,175,55,.28)!important;
      z-index:1!important;
    }
    .proHorizontalLine{
      position:absolute!important;
      left:12%!important;
      right:12%!important;
      top:50%!important;
      border-top:1px dashed rgba(212,175,55,.28)!important;
      z-index:1!important;
    }
    .proMouthLabel{
      position:absolute!important;
      left:61%!important;
      transform:translateX(-50%)!important;
      color:#9ca3af!important;
      font-weight:1000!important;
      letter-spacing:5px!important;
      opacity:.65!important;
      z-index:2!important;
      pointer-events:none!important;
    }
    .proMouthLabel.upper{top:38%!important}
    .proMouthLabel.lower{top:58%!important}

    .proTooth{
      position:absolute!important;
      transform:translate(-50%,-50%)!important;
      background:transparent!important;
      border:none!important;
      padding:0!important;
      width:42px!important;
      height:54px!important;
      display:flex!important;
      flex-direction:column!important;
      align-items:center!important;
      justify-content:center!important;
      z-index:2!important;
      cursor:pointer!important;
    }
    .toothArt{
      width:40px!important;
      height:40px!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
    }
    .proToothSvg{
      width:36px!important;
      height:40px!important;
      filter:drop-shadow(0 6px 8px rgba(0,0,0,.35))!important;
    }
    .proTooth.molar .proToothSvg{width:40px!important;height:40px!important}
    .proToothSvg path:first-child{
      fill:#fff7e6!important;
      stroke:rgba(255,255,255,.35)!important;
      stroke-width:2.5!important;
      stroke-linecap:round!important;
    }
    .groove{fill:none!important;stroke:rgba(145,130,105,.38)!important;stroke-width:2.2!important;stroke-linecap:round!important}
    .shine{fill:none!important;stroke:rgba(255,255,255,.35)!important;stroke-width:2.5!important;stroke-linecap:round!important}
    .toothNo{color:#eef2f7!important;font-size:11px!important;font-weight:900!important;margin-top:1px!important;line-height:1!important}
    .proTooth.caries path:first-child{fill:#ef4444!important}
    .proTooth.filling path:first-child{fill:#60a5fa!important}
    .proTooth.rct path:first-child{fill:#8b5cf6!important}
    .proTooth.crown path:first-child{fill:#d4af37!important}
    .proTooth.missing path:first-child{fill:#4b5563!important}
    .proTooth.extraction path:first-child{fill:#fb7185!important}
    .proTooth.implant path:first-child{fill:#2dd4bf!important}

    @media (min-width:768px){
      .proMouthChart{max-width:760px!important;height:640px!important}
      .proTooth{width:40px!important;height:50px!important}
      .toothArt{width:36px!important;height:36px!important}
      .proToothSvg{width:34px!important;height:38px!important}
      .proTooth.molar .proToothSvg{width:38px!important;height:38px!important}
    }

    @media (max-width:480px){
      .proMouthChart{height:560px!important;max-width:100%!important}
      .proTooth{width:38px!important;height:50px!important}
      .toothArt{width:36px!important;height:36px!important}
      .proToothSvg{width:33px!important;height:36px!important}
      .proTooth.molar .proToothSvg{width:36px!important;height:36px!important}
      .toothNo{font-size:10px!important}
    }

    /* Photos grid and delete */
    .photoGrid,.photosGrid,.patientPhotos,.grid.photoGrid{
      display:grid!important;
      grid-template-columns:repeat(2,1fr)!important;
      gap:12px!important;
      margin-top:14px!important;
    }
    .photoItem{
      position:relative!important;
      overflow:hidden!important;
      border-radius:18px!important;
      background:#111827!important;
      border:1px solid #263241!important;
      min-height:170px!important;
    }
    .photoItem img{
      width:100%!important;
      height:170px!important;
      object-fit:cover!important;
      display:block!important;
      border-radius:18px!important;
      cursor:pointer!important;
      user-select:none!important;
      -webkit-user-select:none!important;
    }
    .photoItem button{
      position:absolute!important;
      top:10px!important;
      right:10px!important;
      width:42px!important;
      height:42px!important;
      border-radius:50%!important;
      border:3px solid rgba(255,255,255,.92)!important;
      background:linear-gradient(135deg,#ff4d4d,#d62828)!important;
      color:transparent!important;
      font-size:0!important;
      padding:0!important;
      z-index:99!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      box-shadow:0 10px 28px rgba(0,0,0,.45)!important;
    }
    .photoItem button::before{
      content:"X"!important;
      color:white!important;
      font-size:22px!important;
      font-weight:1000!important;
      line-height:1!important;
    }

    /* Fullscreen photo viewer */
    #photoViewer,#photoModal{
      position:fixed!important;
      inset:0!important;
      background:rgba(0,0,0,.96)!important;
      z-index:999999!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      flex-direction:column!important;
      padding:80px 14px 110px!important;
      box-sizing:border-box!important;
    }
    #photoViewer.hidden,#photoModal.hidden{display:none!important}
    #viewerImage,#bigPhoto{
      max-width:94vw!important;
      max-height:72vh!important;
      width:auto!important;
      height:auto!important;
      object-fit:contain!important;
      border-radius:22px!important;
      box-shadow:0 28px 70px rgba(0,0,0,.65)!important;
    }
    .photoClose,.photoCloseBtn,#closePhoto{
      position:fixed!important;
      top:22px!important;
      right:22px!important;
      width:60px!important;
      height:60px!important;
      border-radius:50%!important;
      border:3px solid rgba(255,255,255,.9)!important;
      background:linear-gradient(135deg,#ff4d4d,#d62828)!important;
      color:white!important;
      font-size:0!important;
      font-weight:900!important;
      z-index:1000000!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      box-shadow:0 12px 35px rgba(255,0,0,.35)!important;
    }
    .photoClose:before,.photoCloseBtn:before,#closePhoto:before{
      content:"X"!important;
      font-size:28px!important;
      color:#fff!important;
      line-height:1!important;
    }
    .photoControls,.photoNavBtns{
      position:fixed!important;
      bottom:28px!important;
      left:50%!important;
      transform:translateX(-50%)!important;
      display:flex!important;
      gap:16px!important;
      z-index:1000000!important;
    }
    .photoControls button,.photoNavBtn{
      border:none!important;
      border-radius:22px!important;
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;
      color:#050505!important;
      padding:16px 22px!important;
      font-size:18px!important;
      font-weight:1000!important;
      min-width:126px!important;
      box-shadow:0 14px 35px rgba(0,0,0,.45)!important;
    }

    /* Before/After */
    #beforeAfterModal{
      position:fixed!important;
      inset:0!important;
      background:rgba(0,0,0,.96)!important;
      z-index:999999!important;
      overflow:auto!important;
      padding:80px 18px 80px!important;
      box-sizing:border-box!important;
    }
    .beforeAfterContainer{
      max-width:720px!important;
      margin:0 auto!important;
      display:grid!important;
      grid-template-columns:1fr!important;
      gap:22px!important;
    }
    .beforeAfterContainer img{
      width:100%!important;
      max-height:430px!important;
      object-fit:contain!important;
      border-radius:24px!important;
      background:#111827!important;
      box-shadow:0 18px 45px rgba(0,0,0,.45)!important;
      display:block!important;
    }
    .beforeAfterTitle{
      color:#d4af37!important;
      text-align:center!important;
      font-size:30px!important;
      font-weight:1000!important;
      margin:0 0 24px!important;
    }
    .beforeAfterClose{
      position:fixed!important;
      top:22px!important;
      right:22px!important;
      width:58px!important;
      height:58px!important;
      border-radius:50%!important;
      border:3px solid rgba(255,255,255,.9)!important;
      background:linear-gradient(135deg,#ff4d4d,#d62828)!important;
      color:white!important;
      font-size:0!important;
      z-index:1000000!important;
      box-shadow:0 12px 35px rgba(255,0,0,.35)!important;
    }
    .beforeAfterClose::before{content:"X"!important;font-size:26px!important;font-weight:1000!important;color:white!important}

    /* Luxury prompts */
    .luxuryModal{
      position:fixed!important;
      inset:0!important;
      background:rgba(0,0,0,.78)!important;
      backdrop-filter:blur(14px)!important;
      z-index:999999!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      padding:20px!important;
    }
    .luxuryBox{
      width:100%!important;
      max-width:440px!important;
      background:linear-gradient(145deg,#111827,#1f2937)!important;
      border:1px solid rgba(212,175,55,.35)!important;
      border-radius:30px!important;
      padding:26px!important;
      box-shadow:0 25px 70px rgba(0,0,0,.65)!important;
    }
    .luxuryBox h2{color:#d4af37!important;font-size:26px!important;margin:0 0 18px!important;font-weight:1000!important}
    .luxuryBox p{color:#dbe6f3!important;margin:0 0 18px!important;font-weight:800!important;line-height:1.5!important}
    .luxuryBox input{
      width:100%!important;
      box-sizing:border-box!important;
      padding:18px!important;
      border-radius:18px!important;
      border:1px solid #475569!important;
      background:#0f172a!important;
      color:white!important;
      font-size:20px!important;
      outline:none!important;
    }
    .luxuryBox input:focus{
      border-color:#d4af37!important;
      box-shadow:0 0 0 4px rgba(212,175,55,.18)!important;
    }
    .luxuryActions{display:flex!important;gap:12px!important;margin-top:20px!important}
    .luxuryActions button{flex:1!important;padding:16px!important;border-radius:18px!important;border:none!important;font-size:18px!important;font-weight:900!important}
    .luxuryActions .primary{background:linear-gradient(135deg,#f5d76e,#b8860b)!important;color:#000!important}
    .luxuryActions .secondary{background:#263241!important;color:white!important}

    .statCard,.heroCard,.dashboardPanel,.card,.patientCard{
      transition:transform .2s ease,box-shadow .2s ease!important;
    }
    .statCard:active,.heroCard:active,.dashboardPanel:active,.card:active,.patientCard:active{
      transform:scale(.985)!important;
    }
    .primary,button{
      transition:transform .18s ease,box-shadow .18s ease!important;
    }
    .primary:active,button:active{
      transform:scale(.97)!important;
    }


    .photoTabs{display:flex!important;gap:10px!important;overflow-x:auto!important;padding-bottom:6px!important;margin-bottom:12px!important}
    .photoTabs button{white-space:nowrap!important}
    .photoTag{position:absolute!important;left:10px!important;top:10px!important;z-index:8!important;background:rgba(0,0,0,.68)!important;color:white!important;padding:6px 10px!important;border-radius:999px!important;font-size:12px!important;font-weight:900!important}
    .deletePhotoBtn{position:absolute!important;top:10px!important;right:10px!important;width:42px!important;height:42px!important;border-radius:50%!important;border:3px solid rgba(255,255,255,.92)!important;background:linear-gradient(135deg,#ff4d4d,#d62828)!important;color:transparent!important;font-size:0!important;padding:0!important;z-index:99!important;display:flex!important;align-items:center!important;justify-content:center!important;box-shadow:0 10px 28px rgba(0,0,0,.45)!important}
    .deletePhotoBtn::before{content:"X"!important;color:white!important;font-size:22px!important;font-weight:1000!important;line-height:1!important}
    .baPick{border:2px solid #263241!important;border-radius:18px!important;overflow:hidden!important;padding:0!important;background:#111827!important;position:relative!important}
    .baPick img{width:100%!important;height:150px!important;object-fit:cover!important;display:block!important}
    .baTag{position:absolute!important;top:8px!important;left:8px!important;background:rgba(0,0,0,.7)!important;color:white!important;padding:6px 10px!important;border-radius:999px!important;font-size:12px!important;font-weight:900!important}
  
    /* Extra premium modules */
    .premiumChip{display:inline-flex!important;align-items:center!important;gap:8px!important;padding:9px 12px!important;border-radius:999px!important;background:rgba(212,175,55,.12)!important;border:1px solid rgba(212,175,55,.25)!important;color:#d4af37!important;font-weight:1000!important;font-size:12px!important;margin:4px!important}
    .dashboardList{display:grid!important;gap:12px!important;margin-top:12px!important}
    .dashboardRow{background:#0f1620!important;border:1px solid #263241!important;border-radius:18px!important;padding:14px!important;display:flex!important;justify-content:space-between!important;gap:12px!important;align-items:center!important}
    .dashboardRow b{color:#f8fafc!important}.dashboardRow small{color:#94a3b8!important;font-weight:800!important}
    .templateGrid{display:grid!important;grid-template-columns:repeat(2,1fr)!important;gap:10px!important;margin:12px 0!important}
    .templateBtn{border:none!important;border-radius:18px!important;background:#1f2937!important;color:#fff!important;padding:13px!important;font-weight:1000!important}
    .calendarMini{display:grid!important;grid-template-columns:repeat(7,1fr)!important;gap:6px!important;margin-top:12px!important}
    .calendarDay{border-radius:14px!important;background:#0f1620!important;border:1px solid #263241!important;min-height:54px!important;padding:8px!important;color:#e5e7eb!important;font-size:12px!important;font-weight:900!important}
    .calendarDay.hasAppt{background:rgba(212,175,55,.14)!important;border-color:rgba(212,175,55,.35)!important;color:#d4af37!important}
    .caseSummaryBox{background:linear-gradient(145deg,#0f172a,#111827)!important;border:1px solid rgba(212,175,55,.18)!important;border-radius:22px!important;padding:16px!important;color:#dbe6f3!important;font-weight:750!important;line-height:1.55!important}

  `;
  document.head.appendChild(style);
}
function luxuryPrompt(title, placeholder = "", initialValue = "") {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "luxuryModal";
    modal.innerHTML = `
      <div class="luxuryBox">
        <h2>${safeText(title)}</h2>
        <input id="luxuryInput" placeholder="${safeText(placeholder)}" value="${safeText(initialValue)}">
        <div class="luxuryActions">
          <button type="button" class="secondary">Cancel</button>
          <button type="button" class="primary">OK</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const input = modal.querySelector("#luxuryInput");
    setTimeout(() => input.focus(), 50);
    modal.querySelector(".secondary").onclick = () => { modal.remove(); resolve(null); };
    modal.querySelector(".primary").onclick = () => { const value = input.value.trim(); modal.remove(); resolve(value); };
    input.addEventListener("keydown", e => { if (e.key === "Enter") modal.querySelector(".primary").click(); });
  });
}

function luxuryConfirm(title, message = "") {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "luxuryModal";
    modal.innerHTML = `
      <div class="luxuryBox">
        <h2>${safeText(title)}</h2>
        ${message ? `<p>${safeText(message)}</p>` : ""}
        <div class="luxuryActions">
          <button type="button" class="secondary">Cancel</button>
          <button type="button" class="primary">OK</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector(".secondary").onclick = () => { modal.remove(); resolve(false); };
    modal.querySelector(".primary").onclick = () => { modal.remove(); resolve(true); };
  });
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

  (data.visits || []).forEach(v => {
    timeline.push({
      type: "Visit",
      title: v.treatment || "Visit",
      date: v.date || "",
      text: v.note || v.notes || ""
    });
  });

  (data.payments || []).forEach(p => {
    timeline.push({
      type: "Payment",
      title: "Payment",
      date: p.date || "",
      text: `Total: ${p.total || 0} | Paid: ${p.paid || 0}`
    });
  });

  (data.appointments || []).forEach(a => {
    timeline.push({
      type: "Appointment",
      title: "Appointment",
      date: a.date || "",
      text: a.note || ""
    });
  });

  (patient.photos || []).forEach(ph => {
    timeline.push({
      type: "Photo",
      title: "Photo",
      date: ph.date || "",
      text: ph.category ? `${ph.category} photo added` : "Photo added"
    });
  });

  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!timeline.length) {
    return `<p style="color:var(--muted);font-weight:800">No timeline yet</p>`;
  }

  return timeline.map(item => `
    <div class="kv" style="
      margin-bottom:16px;
      border-radius:28px;
      overflow:hidden;
      background:linear-gradient(145deg,#0f172a,#111827);
      border:1px solid rgba(212,175,55,.15);
      box-shadow:0 12px 30px rgba(0,0,0,.22);
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.05);">
        <div>
          <div style="color:#d4af37;font-weight:1000;font-size:18px;">${safeText(item.title)}</div>
          <div style="color:#94a3b8;font-size:13px;font-weight:800;margin-top:4px;">${safeText(item.date)}</div>
        </div>
        <div style="background:rgba(212,175,55,.12);color:#d4af37;padding:9px 12px;border-radius:999px;font-size:12px;font-weight:1000;white-space:nowrap;">${safeText(item.type)}</div>
      </div>
      <div style="padding:18px 20px;color:#dbe6f3;line-height:1.6;font-weight:700;">${safeText(item.text || "-")}</div>
    </div>
  `).join("");
}

async function loadPatients() {
  try {
    if ($("status")) $("status").textContent = "Loading cloud...";
    if (currentUser.role === "admin") patients = await api("patients?select=*&order=created_at.desc");
    else patients = await api(`patients?owner_id=eq.${currentUser.id}&select=*&order=created_at.desc`);
    renderPatients(); renderDashboard();
    if ($("status")) $("status").textContent = "Cloud connected";
    const params = new URLSearchParams(location.search);
    const patientId = params.get("patient");
    if (patientId) openPatient(patientId);
  } catch (err) {
    console.error(err);
    if ($("status")) $("status").textContent = "Cloud error";
    if ($("list")) $("list").innerHTML = `<div class="card"><h3>Cloud error</h3><p>${safeText(err.message)}</p></div>`;
  }
}


function getPatientStatus(patient, data = parseClinicData(patient.progress_notes), money = paymentTotals(data)) {
  const visitsCount = (data.visits || []).length;
  if (money.remaining > 0) return { text: "Unpaid", cls: "badgeRed" };
  if (!patient.treatment_plan || !patient.treatment_plan.trim()) return { text: "Needs Plan", cls: "badgeGold" };
  if (visitsCount > 0) return { text: "Active", cls: "badgeGreen" };
  return { text: "New", cls: "badgeBlue" };
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

window.openWhatsAppReminder = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");

  const phone = normalizePhoneForWhatsApp(p.phone || "");
  if (!phone) return alert("No valid phone number for this patient.");

  const clinicName = currentUser?.clinic_name || "Masri Dental Clinic";
  const data = parseClinicData(p.progress_notes);
  const next = nextAppointmentInfo(data);
  const appointmentLine = next?.date ? `\nYour next appointment: ${next.date}` : "";

  const message = `Hello ${p.name || ""}, this is ${clinicName}. This is a reminder from the clinic.${appointmentLine}`;
  
  const encoded = encodeURIComponent(message);
  const appUrl = `whatsapp://send?phone=${phone}&text=${encoded}`;
  const webUrl = `https://wa.me/${phone}?text=${encoded}`;
  const openedAt = Date.now();

  window.location.href = appUrl;

  setTimeout(() => {
    if (Date.now() - openedAt < 1800) {
      window.open(webUrl, "_blank", "noopener,noreferrer");
    }
  }, 900);
};


function followUpItems() {
  const now = new Date();
  const items = [];

  patients.forEach(p => {
    const data = parseClinicData(p.progress_notes);
    (data.appointments || []).forEach(a => {
      const d = new Date(a.date);
      if (!isNaN(d) && d < now) {
        items.push({
          id: p.id,
          patient: p.name || "No name",
          phone: p.phone || "",
          date: a.date || "",
          note: a.note || "Follow-up",
          days: Math.max(0, Math.floor((now - d) / 86400000))
        });
      }
    });
  });

  return items.sort((a, b) => b.days - a.days);
}

function monthAppointments() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const map = {};

  patients.forEach(p => {
    const data = parseClinicData(p.progress_notes);
    (data.appointments || []).forEach(a => {
      const d = new Date(a.date);
      if (!isNaN(d) && d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate();
        if (!map[key]) map[key] = [];
        map[key].push({ patient: p.name || "No name", id: p.id, note: a.note || "" });
      }
    });
  });

  return Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const appts = map[day] || [];
    return `<button class="calendarDay ${appts.length ? "hasAppt" : ""}" onclick="${appts[0] ? `openPatient('${appts[0].id}')` : ""}">
      <div>${day}</div>
      ${appts.length ? `<small>${appts.length} appt</small>` : ""}
    </button>`;
  }).join("");
}

function treatmentStats() {
  const stats = {};
  patients.forEach(p => {
    const text = `${p.diagnosis || ""} ${p.treatment_plan || ""}`.toLowerCase();
    ["rct", "crown", "implant", "extraction", "scaling", "filling"].forEach(k => {
      if (text.includes(k)) stats[k] = (stats[k] || 0) + 1;
    });
  });
  return stats;
}

function generateLocalCaseSummary(p) {
  const data = parseClinicData(p.progress_notes);
  const money = paymentTotals(data);
  const lastVisit = (data.visits || [])[0];
  const next = nextAppointmentInfo(data);

  return [
    `Patient: ${p.name || "No name"}`,
    `Chief complaint: ${p.chief_complaint || "-"}`,
    `Diagnosis: ${p.diagnosis || "-"}`,
    `Treatment plan: ${p.treatment_plan || "-"}`,
    `Visits: ${(data.visits || []).length}`,
    `Photos: ${(p.photos || []).length}`,
    `Financial: Total ${money.total}, Paid ${money.paid}, Remaining ${money.remaining}`,
    lastVisit ? `Last visit: ${lastVisit.date || ""} - ${lastVisit.note || ""}` : "Last visit: none",
    next?.date ? `Next appointment: ${next.date}` : "Next appointment: none"
  ].join("\\n");
}

function renderDashboard() {
  const dash = $("dashboardContent");
  if (!dash) return;

  let totalPhotos = 0;
  let totalVisits = 0;
  let unpaid = 0;
  let totalRevenue = 0;
  let paidToday = 0;
  let missingPlan = 0;
  let todayAppointments = [];
  let overdueAppointments = [];
  let upcoming = [];
  let unpaidPatients = [];

  patients.forEach(p => {
    const data = parseClinicData(p.progress_notes);
    const money = paymentTotals(data);

    totalPhotos += (p.photos || []).length;
    totalVisits += (data.visits || []).length;
    unpaid += money.remaining;
    totalRevenue += money.paid;

    if (money.remaining > 0) {
      unpaidPatients.push({ patient: p.name || "No name", phone: p.phone || "", amount: money.remaining, id: p.id });
    }

    (data.payments || []).forEach(pay => {
      if (new Date(pay.date).toDateString() === new Date().toDateString()) {
        paidToday += Number(pay.paid || 0);
      }
    });

    if (!p.treatment_plan || !p.treatment_plan.trim()) missingPlan++;

    (data.appointments || []).forEach(a => {
      const item = { patient: p.name || "No name", phone: p.phone || "", date: a.date || "", note: a.note || "", id: p.id };
      const appDate = new Date(a.date);
      const today = new Date();

      if (!isNaN(appDate)) {
        if (appDate.toDateString() === today.toDateString()) todayAppointments.push(item);
        else if (appDate < today) overdueAppointments.push(item);
        else upcoming.push(item);
      } else {
        upcoming.push(item);
      }
    });
  });

  upcoming = upcoming
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .slice(0, 5);
  unpaidPatients = unpaidPatients.sort((a, b) => b.amount - a.amount).slice(0, 5);

  dash.innerHTML = `
    <div class="heroGrid">
      <div class="statCard"><small>Total patients</small><strong>${patients.length}</strong></div>
      <div class="statCard"><small>Today's appointments</small><strong>${todayAppointments.length}</strong></div>
      <div class="statCard"><small>Unpaid balance</small><strong>${unpaid}</strong></div>
      <div class="statCard"><small>Total visits</small><strong>${totalVisits}</strong></div>
      <div class="statCard"><small>Total revenue</small><strong>${totalRevenue}</strong></div>
      <div class="statCard"><small>Paid today</small><strong>${paidToday}</strong></div>
    </div>

    <div class="quickActions">
      <button class="primary" onclick="fillForm();showPage('form')">+ New Patient</button>
      <button class="secondary" onclick="showPage('scan')">Scan QR</button>
      <button class="secondary" onclick="backupData()">Backup</button>
      <button class="secondary" onclick="restoreBackup()">Restore</button>
    </div>

    <div class="dashboardPanel">
      <h2>Clinic Alerts</h2>
      <span class="pill">${missingPlan} without treatment plan</span>
      <span class="pill">${todayAppointments.length} today appointments</span>
      <span class="pill">${overdueAppointments.length} overdue appointments</span>
      <span class="pill">${unpaidPatients.length} unpaid priority</span>
    </div>

    <div class="dashboardPanel">
      <h2>Follow-up Watch</h2>
      ${followUpItems().slice(0, 6).length ? `<div class="dashboardList">${followUpItems().slice(0, 6).map(f => `
        <div class="dashboardRow">
          <div>
            <b>${safeText(f.patient)}</b><br>
            <small>${safeText(f.note)} - overdue ${f.days} day(s)</small>
          </div>
          <button class="secondary" onclick="openPatient('${f.id}')">Open</button>
        </div>
      `).join("")}</div>` : `<p style="color:var(--muted);font-weight:800">No missed follow-ups</p>`}
    </div>

    <div class="dashboardPanel">
      <h2>This Month Calendar</h2>
      <div class="calendarMini">${monthAppointments()}</div>
    </div>

    <div class="dashboardPanel">
      <h2>Treatment Stats</h2>
      ${Object.keys(treatmentStats()).length ? Object.entries(treatmentStats()).map(([k,v]) => `<span class="premiumChip">${safeText(k.toUpperCase())}: ${v}</span>`).join(" ") : `<p style="color:var(--muted);font-weight:800">No treatment stats yet</p>`}
    </div>

    ${dashboardPanel("Today Appointments", todayAppointments, "No appointments today")}
    ${dashboardPanel("Upcoming Appointments", upcoming, "No upcoming appointments")}
    ${dashboardPanel("Unpaid Priority", unpaidPatients.map(x => ({ patient: x.patient, phone: x.phone, date: `Remaining: ${x.amount}`, note: "Payment follow-up", id: x.id })), "No unpaid priority patients")}
    ${dashboardPanel("Overdue Appointments", overdueAppointments, "No overdue appointments")}
  `;
}

function dashboardPanel(title, arr, empty) { return `<div class="dashboardPanel"><h2>${title}</h2>${arr.length ? arr.map(a => `<div class="appointment"><b>${safeText(a.date)}</b><p>${safeText(a.patient)} - ${safeText(a.phone)}</p><p>${safeText(a.note)}</p></div>`).join("") : `<p style="color:var(--muted);font-weight:800">${empty}</p>`}</div>`; }

function renderPatients() {
  const q = ($("search")?.value || "").toLowerCase();

  const filtered = [...patients]
    .sort((a, b) => {
      const aData = parseClinicData(a.progress_notes);
      const bData = parseClinicData(b.progress_notes);
      const aMoney = paymentTotals(aData);
      const bMoney = paymentTotals(bData);
      const aUnpaid = aMoney.remaining > 0 ? 1 : 0;
      const bUnpaid = bMoney.remaining > 0 ? 1 : 0;
      if (bUnpaid !== aUnpaid) return bUnpaid - aUnpaid;
      const aNext = nextAppointmentInfo(aData)?.parsed || new Date(8640000000000000);
      const bNext = nextAppointmentInfo(bData)?.parsed || new Date(8640000000000000);
      if (+aNext !== +bNext) return aNext - bNext;
      const aLast = new Date((aData.visits || [])[0]?.date || 0);
      const bLast = new Date((bData.visits || [])[0]?.date || 0);
      return bLast - aLast;
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
    list.innerHTML = `
      <div class="card" style="text-align:center;padding:26px;">
        <h3>No patients yet</h3>
        <p style="color:var(--muted);font-weight:800;">Add your first patient to start.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = "";

  filtered.forEach(p => {
    const data = parseClinicData(p.progress_notes);
    const money = paymentTotals(data);
    const visitsCount = (data.visits || []).length;
    const photosCount = (p.photos || []).length;
    const lastVisit = lastVisitText(data);
    const next = nextAppointmentInfo(data);
    const status = getPatientStatus(p, data, money);

    const card = document.createElement("div");
    card.className = "patientCard";

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div>
          <h3 style="margin-bottom:8px;">${safeText(p.name || "No name")}</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
            <span class="pill">ID: ${safeText(p.case_id || p.id)}</span>
            <span class="pill">${safeText(p.phone || "No phone")}</span>
            ${p.age ? `<span class="pill">${safeText(p.age)} yrs</span>` : ""}
          </div>
        </div>
        <span class="premiumBadge ${status.cls}">${status.text}</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0;">
        <div class="miniCard"><b>Visits</b><div class="money">${visitsCount}</div></div>
        <div class="miniCard"><b>Photos</b><div class="money">${photosCount}</div></div>
        <div class="miniCard"><b>Remaining</b><div class="money ${money.remaining > 0 ? "unpaid" : ""}">${money.remaining || 0}</div></div>
      </div>

      <div class="kv" style="margin:12px 0;">
        <b>Last visit</b>
        <div style="color:#dbe6f3;font-weight:800;">${safeText(lastVisit)}</div>
      </div>

      ${next ? `<div class="kv" style="margin:12px 0;"><b>Next appointment</b><div style="color:#dbe6f3;font-weight:800;">${safeText(next.date || "")}</div></div>` : ""}

      <div class="actions">
        <button class="primary" onclick="openPatient('${p.id}')">Open</button>
        ${canEdit() ? `<button class="secondary" onclick="editPatient('${p.id}')">Edit</button>` : ""}
        <button class="secondary" onclick="showQR('${p.id}')">QR</button>
        <button class="secondary whatsappBtn" onclick="openWhatsAppReminder('${p.id}')">WhatsApp</button>
      </div>
    `;

    list.appendChild(card);
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

function getToothType(n) {
  const incisors = [11,12,21,22,31,32,41,42];
  const canines = [13,23,33,43];
  if (incisors.includes(Number(n))) return "incisor";
  if (canines.includes(Number(n))) return "canine";
  return "molar";
}

function toothSvg(type = "molar") {
  if (type === "incisor") {
    return `<svg viewBox="-40 -55 80 110" class="proToothSvg">
      <path d="M-14,-36 C-8,-46 8,-46 14,-36 C18,-18 16,10 10,30 C6,43 3,50 0,50 C-3,50 -6,43 -10,30 C-16,10 -18,-18 -14,-36 Z"/>
      <path class="shine" d="M-5,-28 C-9,-10 -8,8 -4,24"/>
    </svg>`;
  }

  if (type === "canine") {
    return `<svg viewBox="-42 -55 84 110" class="proToothSvg">
      <path d="M-17,-34 C-9,-48 10,-48 18,-34 C24,-15 15,18 6,36 C2,45 0,52 -4,52 C-9,52 -9,40 -13,30 C-22,10 -25,-15 -17,-34 Z"/>
      <path class="shine" d="M-7,-26 C-12,-8 -10,12 -5,28"/>
    </svg>`;
  }

  return `<svg viewBox="-52 -48 104 96" class="proToothSvg">
    <path d="M-28,-22 C-20,-40 -6,-37 0,-28 C8,-39 24,-38 30,-20 C38,2 29,25 15,38 C5,47 -5,38 0,25 C-8,41 -23,47 -31,28 C-39,10 -38,-8 -28,-22 Z"/>
    <path class="groove" d="M-15,-7 C-3,3 12,3 23,-7"/>
    <path class="groove" d="M-20,16 C-5,8 12,9 24,17"/>
    <path class="groove" d="M0,-23 C-3,-4 -3,14 0,29"/>
  </svg>`;
}

function getToothType(n) {
  n = Number(n);
  if ([11,12,21,22,31,32,41,42].includes(n)) return "incisor";
  if ([13,23,33,43].includes(n)) return "canine";
  return "molar";
}

function renderToothChart(p) {
  const data = parseClinicData(p.progress_notes);
  const teeth = data.teeth || {};

 const toothData = [
  [18,18,44,-28],[17,24,37,-22],[16,30,31,-16],[15,36,25,-10],
  [14,42,19,-5],[13,48,14,-2],[12,54,10,0],[11,59,9,0],

  [21,63,9,0],[22,68,10,0],[23,73,14,2],[24,78,19,5],
  [25,84,25,10],[26,89,31,16],[27,93,37,22],[28,95,44,28],

  [48,18,60,-152],[47,24,67,-158],[46,30,74,-164],[45,36,81,-170],
  [44,43,88,-176],[43,49,92,180],[42,54,95,180],[41,58,96,180],

  [31,62,96,180],[32,66,95,180],[33,71,92,180],[34,77,88,176],
  [35,83,81,170],[36,86,74,164],[37,91,67,158],[38,93,60,152]
];

  return `
    <div class="proMouthChart">
      <div class="proMouthLabel upper">UPPER</div>
      <div class="proMouthLabel lower">LOWER</div>
      <div class="proMidLine"></div>
      <div class="proHorizontalLine"></div>

      ${toothData.map(([n,x,y,r]) => {
        const status = teeth[n] || "healthy";
        const type = getToothType(n);

        return `
          <button
            type="button"
            class="proTooth ${safeText(status)} ${type}"
            style="left:${x}%;top:${y}%"
            onclick="window.openToothPopup('${p.id}', '${n}')"
          >
            <span class="toothArt" style="transform:rotate(${r}deg)">
              ${toothSvg(type)}
            </span>
            <span class="toothNo">${n}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}
function patientDetailsHTML(p) {
  const data = parseClinicData(p.progress_notes);
  const money = paymentTotals(data);
  const photos = (p.photos || []);
  return `
    <div class="card">
      <h2>${safeText(p.name || "No name")}</h2>
      <span class="pill">ID: ${safeText(p.case_id || "-")}</span>
      <span class="pill">${safeText(p.phone || "No phone")}</span>
      <span class="pill">${safeText(p.age || "-")} yrs</span>
      <span class="pill">${safeText(p.gender || "-")}</span>

      <div class="kv"><b>Chief complaint</b><span>${safeText(p.chief_complaint || "-")}</span></div>
      <div class="kv"><b>Medical alerts</b><span>${safeText(p.medical_alerts || "-")}</span></div>
      <div class="kv"><b>Diagnosis</b><span>${safeText(p.diagnosis || "-")}</span></div>
      <div class="kv"><b>Treatment plan</b><span>${safeText(p.treatment_plan || "-")}</span></div>

      <div class="actions" style="margin:14px 0;">
        <button class="secondary" onclick="sendWhatsAppReminder('${p.id}')">WhatsApp Reminder</button>
        <button class="secondary" onclick="addTreatmentTemplate('${p.id}')">Treatment Template</button>
        <button class="secondary" onclick="showCaseSummary('${p.id}')">Case Summary</button>
        <button class="secondary" onclick="addVoiceNote('${p.id}')">Voice Note</button>
      </div>

      <h3 class="sectionTitle">Visits History</h3>
      ${data.visits.length ? data.visits.map((v, i) => `<div class="kv"><b>Visit ${data.visits.length - i}</b><div class="visitDate">${safeText(v.date || "")}</div><span>${safeText(v.note || "-")}</span></div>`).join("") : `<div class="kv"><span>No visits yet</span></div>`}

      <h3 class="sectionTitle">Tooth Chart</h3>
      <div class="toothChartBox">
        <span class="legendItem">Healthy</span><span class="legendItem">Caries</span><span class="legendItem">Filling</span><span class="legendItem">RCT</span>
        <span class="legendItem">Crown</span><span class="legendItem">Missing</span><span class="legendItem">Extraction</span><span class="legendItem">Implant</span>
      </div>
      <div class="toothChart">${renderToothChart(p)}</div>

      <h3 class="sectionTitle">Appointments</h3>
      <div class="actions"><button class="primary" onclick="addAppointment('${p.id}')">+ Add Appointment</button></div>
      ${data.appointments.length ? data.appointments.map((a, i) => `<div class="appointment"><b>${safeText(a.date || "-")}</b><p>${safeText(a.note || "")}</p><button class="danger" onclick="deleteAppointment('${p.id}', ${i})">Delete</button></div>`).join("") : `<div class="kv"><span>No appointments yet</span></div>`}

      <h3 class="sectionTitle">Payments</h3>
      <div class="miniGrid"><div class="miniCard"><b>Total</b><span class="money">${money.total}</span></div><div class="miniCard"><b>Paid</b><span class="money">${money.paid}</span></div><div class="miniCard"><b>Remaining</b><span class="money unpaid">${money.remaining}</span></div></div>
      <div class="actions"><button class="primary" onclick="addPayment('${p.id}')">+ Add Payment</button></div>
      ${data.payments.length ? data.payments.map((pay, i) => `<div class="appointment"><b>${safeText(pay.date || "")}</b><p>Total: ${Number(pay.total || 0)} | Paid: ${Number(pay.paid || 0)} | Remaining: ${Number(pay.total || 0) - Number(pay.paid || 0)}</p><button class="danger" onclick="deletePayment('${p.id}', ${i})">Delete</button></div>`).join("") : `<div class="kv"><span>No payments yet</span></div>`}

      <h3 class="sectionTitle">Photos / X-rays</h3>

      <div class="actions photoTabs">
        <button class="secondary" onclick="setPhotoTab('all')">All</button>
        <button class="secondary" onclick="setPhotoTab('clinical')">Clinical</button>
        <button class="secondary" onclick="setPhotoTab('xray')">X-rays</button>
        <button class="secondary" onclick="showBeforeAfter('${p.id}')">Before / After</button>
      </div>

      <div class="photoGrid">
        ${
          photos.length
            ? photos.map((ph, i) => {
                const url = photoUrl(ph);
                const category = ph.category || "Clinical";
                const isXray = ["x-ray", "xray", "x ray"].includes(String(category).toLowerCase());
                const group = isXray ? "xray" : "clinical";

                return `
                  <div class="photoItem photoTabItem ${group}">
                    <span class="photoTag" onclick="event.stopPropagation();setPhotoCategory('${p.id}', ${i})">
                      ${safeText(category)}
                    </span>
                    <img src="${url}" onclick="viewPhotoGroup('${p.id}', ${i}, '${group}')">
                    ${canEdit() ? `<button class="deletePhotoBtn" type="button" onclick="event.stopPropagation();deletePhoto('${p.id}', ${i})" aria-label="Delete photo">X</button>` : ""}
                  </div>
                `;
              }).join("")
            : "<p>No photos</p>"
        }
      </div>

      <h3 class="sectionTitle">Patient Timeline</h3>
      <div class="patientCard">${renderTimeline(p)}</div>
      <div class="actions">
        ${canEdit() ? `<button class="primary" onclick="editPatient('${p.id}')">Edit</button>` : ""}
        <button class="secondary" onclick="showQR('${p.id}')">QR</button>
        <button class="secondary whatsappBtn" onclick="openWhatsAppReminder('${p.id}')">WhatsApp</button>
        <button class="secondary" onclick="exportPDF('${p.id}')">PDF</button>
        ${canDelete() ? `<button class="danger" onclick="deletePatient('${p.id}')">Delete</button>` : ""}
      </div>
    </div>`;
}

window.openPatient = function(id) { const p = patients.find(x => x.id === id); if (!p) return alert("Patient not found or you do not have access."); $("details").innerHTML = patientDetailsHTML(p); showPage("detail"); };
window.showQR = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found");

  const old = document.getElementById("qrModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "qrModal";
  modal.innerHTML = `
    <div style="
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.92);
      z-index:999999;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      box-sizing:border-box;
    ">
      <div style="
        background:linear-gradient(145deg,#111827,#1f2937);
        border:1px solid rgba(212,175,55,.35);
        border-radius:30px;
        padding:28px;
        text-align:center;
        max-width:360px;
        width:100%;
        box-shadow:0 25px 70px rgba(0,0,0,.65);
        position:relative;
      ">
        <button onclick="document.getElementById('qrModal').remove()" style="
          position:absolute;
          top:14px;
          right:14px;
          background:linear-gradient(135deg,#ff4d4d,#d62828);
          color:white;
          border:3px solid rgba(255,255,255,.9);
          border-radius:50%;
          width:46px;
          height:46px;
          font-size:0;
          font-weight:900;
          display:flex;
          align-items:center;
          justify-content:center;
        "><span style="font-size:22px;line-height:1;">X</span></button>

        <h2 style="color:#d4af37;margin:22px 0;">Patient QR</h2>
        <div id="qrCodeBox" style="
          background:white;
          padding:16px;
          border-radius:18px;
          display:inline-block;
        "></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const qrTarget = document.getElementById("qrCodeBox");
  const qrText = `${location.origin}${location.pathname}?patient=${p.id}`;

  if (window.QRCode) {
    new QRCode(qrTarget, { text: qrText, width: 220, height: 220 });
  } else {
    qrTarget.innerHTML = `<p style="color:#111;max-width:220px;word-break:break-all;">${safeText(qrText)}</p>`;
  }
};
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

  await refreshPatientKeepingScroll(selectedToothPatientId);
};
window.changeTooth = async function(patientId, toothNumber) {
  window.openToothPopup(patientId, toothNumber);
};

async function refreshPatientKeepingScroll(patientId) {
  const scrollY = window.scrollY;
  await loadPatients();
  openPatient(patientId);
  requestAnimationFrame(() => {
    window.scrollTo({ top: scrollY, behavior: "instant" });
  });
}


window.addTreatmentTemplate = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");

  const template = await luxuryPrompt(
    "Treatment template",
    "RCT / Scaling / Crown / Extraction / Implant / Filling / Follow-up",
    "Follow-up"
  );

  if (!template) return;

  const notes = {
    "rct": "Root canal treatment visit: access, canal preparation/irrigation, working length and temporary restoration.",
    "scaling": "Scaling and oral hygiene instructions were performed. Patient advised for maintenance.",
    "crown": "Crown preparation/checking stage. Occlusion and margins reviewed.",
    "extraction": "Extraction visit. Post-operative instructions explained.",
    "implant": "Implant treatment stage. Healing and follow-up instructions discussed.",
    "filling": "Restorative filling visit. Caries removed and restoration placed.",
    "follow-up": "Follow-up visit. Healing/progress checked and next steps discussed."
  };

  const key = String(template).toLowerCase();
  const note = notes[key] || template;

  const data = parseClinicData(p.progress_notes);
  data.visits.unshift({
    date: new Date().toLocaleString(),
    treatment: template,
    note
  });

  await api(`patients?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ progress_notes: saveClinicData(data) })
  });

  await refreshPatientKeepingScroll(id);
};

window.showCaseSummary = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");

  const summary = generateLocalCaseSummary(p);

  const modal = document.createElement("div");
  modal.className = "luxuryModal";
  modal.innerHTML = `
    <div class="luxuryBox">
      <h2>Case Summary</h2>
      <pre class="caseSummaryBox" style="white-space:pre-wrap;text-align:left;">${safeText(summary)}</pre>
      <div class="luxuryActions">
        <button type="button" class="secondary">Close</button>
        <button type="button" class="primary">Copy</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector(".secondary").onclick = () => modal.remove();
  modal.querySelector(".primary").onclick = async () => {
    try { await navigator.clipboard.writeText(summary); } catch {}
    modal.remove();
    await luxuryConfirm("Copied", "Case summary copied.");
  };
};

window.addVoiceNote = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");

  const note = await luxuryPrompt("Voice note text", "Type a dictated note here", "");
  if (!note) return;

  const data = parseClinicData(p.progress_notes);
  data.visits.unshift({
    date: new Date().toLocaleString(),
    treatment: "Voice note",
    note
  });

  await api(`patients?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ progress_notes: saveClinicData(data) })
  });

  await refreshPatientKeepingScroll(id);
};


window.addAppointment = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found or you do not have access.");
  const data = parseClinicData(p.progress_notes);
  const date = await luxuryPrompt("Appointment date / time", "Example: 2026-06-10 7:00 PM");
  if (!date) return;
  const note = await luxuryPrompt("Appointment note", "Optional note") || "";
  data.appointments.unshift({ date, note });
  await api(`patients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
};

window.deleteAppointment = async function(id, index) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found or you do not have access.");
  if (!(await luxuryConfirm("Delete appointment?"))) return;
  const data = parseClinicData(p.progress_notes);
  data.appointments.splice(index, 1);
  await api(`patients?id=eq.${id}`, { method:"PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
};

window.addPayment = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found or you do not have access.");
  const data = parseClinicData(p.progress_notes);
  const total = await luxuryPrompt("Total treatment cost", "Enter total amount");
  if (total === null || total === "") return;
  const paid = await luxuryPrompt("Paid amount", "Enter paid amount", "0");
  if (paid === null) return;
  data.payments.unshift({ date: new Date().toLocaleString(), total: Number(total || 0), paid: Number(paid || 0) });
  await api(`patients?id=eq.${id}`, { method:"PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
};

window.deletePayment = async function(id, index) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found or you do not have access.");
  if (!(await luxuryConfirm("Delete payment?"))) return;
  const data = parseClinicData(p.progress_notes);
  data.payments.splice(index, 1);
  await api(`patients?id=eq.${id}`, { method:"PATCH", body: JSON.stringify({ progress_notes: saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
};

function photoUrl(photo){ return typeof photo === "string" ? photo : (photo?.url || ""); }

window.showBeforeAfter = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");

  const photos = (p.photos || []).map(photoUrl).filter(Boolean);
  if (photos.length < 2) return luxuryConfirm("Before / After", "Need at least 2 photos.");

  document.getElementById("beforeAfterModal")?.remove();

  let beforeIndex = null;
  let afterIndex = null;

  const modal = document.createElement("div");
  modal.id = "beforeAfterModal";
  modal.innerHTML = `
    <button type="button" class="beforeAfterClose" id="beforeAfterClose">X</button>
    <h2 class="beforeAfterTitle">Choose Before / After</h2>
    <div class="beforeAfterContainer">
      <p style="color:white;font-weight:800;text-align:center;">Tap one photo as Before, then tap another as After.</p>
      <div id="baGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
        ${photos.map((url, i) => `
          <button type="button" class="baPick" data-index="${i}">
            <img src="${url}">
            <span class="baTag">Select</span>
          </button>
        `).join("")}
      </div>
      <button type="button" id="createBA" style="margin-top:18px;width:100%;padding:16px;border:none;border-radius:20px;background:linear-gradient(135deg,#f5d76e,#b8860b);color:#050505;font-size:18px;font-weight:1000;">Create Comparison</button>
      <div id="baResult" style="display:none;margin-top:22px;">
        <div style="position:relative;width:100%;height:430px;border-radius:24px;overflow:hidden;background:#000;box-shadow:0 18px 45px rgba(0,0,0,.45);">
          <img id="baAfterImg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;">
          <div id="baBeforeWrap" style="position:absolute;inset:0;width:50%;overflow:hidden;">
            <img id="baBeforeImg" style="width:100%;height:100%;object-fit:contain;">
          </div>
          <input id="baSlider" type="range" min="0" max="100" value="50" style="position:absolute;left:5%;right:5%;bottom:18px;width:90%;z-index:5;">
          <div style="position:absolute;left:12px;top:12px;background:rgba(0,0,0,.65);color:white;padding:8px 12px;border-radius:999px;font-weight:900;">Before</div>
          <div style="position:absolute;right:12px;top:12px;background:rgba(0,0,0,.65);color:white;padding:8px 12px;border-radius:999px;font-weight:900;">After</div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.getElementById("beforeAfterClose").onclick = () => modal.remove();

  modal.querySelectorAll(".baPick").forEach(btn => {
    btn.onclick = () => {
      const i = Number(btn.dataset.index);
      if (beforeIndex === null || (beforeIndex !== null && afterIndex !== null)) {
        beforeIndex = i;
        afterIndex = null;
      } else if (i !== beforeIndex) {
        afterIndex = i;
      }
      modal.querySelectorAll(".baPick").forEach((b, idx) => {
        const tag = b.querySelector(".baTag");
        b.style.borderColor = "#263241";
        tag.textContent = "Select";
        tag.style.background = "rgba(0,0,0,.7)";
        if (idx === beforeIndex) { b.style.borderColor = "#d4af37"; tag.textContent = "Before"; tag.style.background = "#b8860b"; }
        if (idx === afterIndex) { b.style.borderColor = "#22c55e"; tag.textContent = "After"; tag.style.background = "#16a34a"; }
      });
    };
  });

  document.getElementById("createBA").onclick = () => {
    if (beforeIndex === null || afterIndex === null) return luxuryConfirm("Before / After", "Choose both Before and After photos.");
    document.getElementById("baResult").style.display = "block";
    document.getElementById("baBeforeImg").src = photos[beforeIndex];
    document.getElementById("baAfterImg").src = photos[afterIndex];
    const slider = document.getElementById("baSlider");
    const beforeWrap = document.getElementById("baBeforeWrap");
    slider.oninput = () => { beforeWrap.style.width = slider.value + "%"; };
    document.getElementById("baResult").scrollIntoView({ behavior: "smooth", block: "center" });
  };
};

function openPhotoViewer(index = 0) {
  if (!currentPhotoList.length) return;

  currentPhotoIndex = Math.max(0, Math.min(index, currentPhotoList.length - 1));

  const viewer = document.getElementById("photoViewer");
  const img = document.getElementById("viewerImage");

  if (!viewer || !img) {
    document.getElementById("photoModal")?.remove();

    const modal = document.createElement("div");
    modal.id = "photoModal";
    modal.innerHTML = `
      <button type="button" class="photoCloseBtn" onclick="closePhotoViewer()">X</button>
      <img id="viewerImage" src="${currentPhotoList[currentPhotoIndex]}">
      <div class="photoControls">
        <button type="button" onclick="prevPhoto()">Prev</button>
        <button type="button" onclick="nextPhoto()">Next</button>
      </div>
    `;
    document.body.appendChild(modal);
    return;
  }

  img.src = currentPhotoList[currentPhotoIndex];
  viewer.classList.remove("hidden");
}

function closePhotoViewer() {
  const viewer = document.getElementById("photoViewer");
  if (viewer) viewer.classList.add("hidden");
  document.getElementById("photoModal")?.remove();
}

function nextPhoto() {
  if (!currentPhotoList.length) return;
  currentPhotoIndex = (currentPhotoIndex + 1) % currentPhotoList.length;
  const img = document.getElementById("viewerImage");
  if (img) img.src = currentPhotoList[currentPhotoIndex];
}

function prevPhoto() {
  if (!currentPhotoList.length) return;
  currentPhotoIndex = (currentPhotoIndex - 1 + currentPhotoList.length) % currentPhotoList.length;
  const img = document.getElementById("viewerImage");
  if (img) img.src = currentPhotoList[currentPhotoIndex];
}

window.setPhotoTab = function(tab) {
  document.querySelectorAll(".photoTabItem").forEach(item => {
    if (tab === "all") item.style.display = "";
    else item.style.display = item.classList.contains(tab) ? "" : "none";
  });
};

window.viewPhotoGroup = function(patientId, index, group) {
  const p = patients.find(x => x.id === patientId);
  if (!p) return;

  const grouped = (p.photos || [])
    .map((ph, i) => ({ ph, i, url: photoUrl(ph) }))
    .filter(item => {
      const category = item.ph.category || "Clinical";
      const isXray = ["x-ray", "xray", "x ray"].includes(String(category).toLowerCase());
      return group === "xray" ? isXray : !isXray;
    })
    .filter(item => item.url);

  currentPhotoList = grouped.map(item => item.url);
  const clickedUrl = photoUrl(p.photos[index]);
  currentPhotoIndex = Math.max(0, currentPhotoList.indexOf(clickedUrl));
  openPhotoViewer(currentPhotoIndex);
};

window.setPhotoCategory = async function(patientId, index) {
  const p = patients.find(x => x.id === patientId);
  if (!p || !p.photos?.[index]) return;

  const category = await luxuryPrompt(
    "Photo category",
    "Clinical / X-ray / Before / After / Other",
    p.photos[index].category || "Clinical"
  );

  if (!category) return;

  if (typeof p.photos[index] === "string") p.photos[index] = { url: p.photos[index], category };
  else p.photos[index].category = category;

  await api(`patients?id=eq.${patientId}`, {
    method: "PATCH",
    body: JSON.stringify({ photos: p.photos })
  });

  await refreshPatientKeepingScroll(patientId);
};

window.viewPhoto = function(url) {
  const p = patients.find(patient => (patient.photos || []).some(photo => photoUrl(photo) === url));
  currentPhotoList = p ? (p.photos || []).map(photoUrl).filter(Boolean) : [url];
  currentPhotoIndex = Math.max(0, currentPhotoList.indexOf(url));
  openPhotoViewer(currentPhotoIndex);
};

window.deletePhoto = async function(patientId, index) {
  const p = patients.find(x => x.id === patientId);
  if (!p || !p.photos?.[index]) return;
  if (!(await luxuryConfirm("Delete this photo?"))) return;
  p.photos.splice(index, 1);
  await api(`patients?id=eq.${patientId}`, { method: "PATCH", body: JSON.stringify({ photos: p.photos }) });
  await refreshPatientKeepingScroll(patientId);
};

window.openPhotoViewer = openPhotoViewer;
window.closePhotoViewer = closePhotoViewer;
window.nextPhoto = nextPhoto;
window.prevPhoto = prevPhoto;

window.backupData = function() {
  const backup = {
    exported_at: new Date().toISOString(),
    clinic: currentUser?.clinic_name || "Masri Dental Clinic",
    user: currentUser,
    patients
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `masri-dental-clinic-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

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
    currentUser.clinic_name = clinicName; currentUser.clinic_logo = logoUrl; saveUser(currentUser); applyUserBar(); await luxuryConfirm("Clinic branding", "Clinic branding saved successfully.");
  } catch (err) { alert("Save failed: " + err.message); }
};

window.exportPDF = async function(id) {
  const reportType = await luxuryPrompt("Report type", "full / payment / clinical", "full");
  if (!reportType) return;
  const p = patients.find(x => x.id === id); if (!p) return alert("Patient not found or you do not have access.");
  const data = parseClinicData(p.progress_notes); const money = paymentTotals(data); const clinicName = currentUser.clinic_name || "Masri Dental Clinic"; const logo = currentUser.clinic_logo || ""; const win = window.open("", "_blank");
  win.document.write(`<html><head><title>${safeText(p.name)} - Dental Report</title><style>body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f8;color:#111827}.report{max-width:900px;margin:auto;padding:28px}.header{background:linear-gradient(135deg,#070b10,#111827);color:white;border-radius:24px;padding:26px;margin-bottom:20px}.header h1{margin:0;font-size:34px}.header p{margin:8px 0 0;color:#d4af37;font-weight:bold}.logo{width:90px;height:90px;object-fit:contain;margin-bottom:12px;background:white;border-radius:18px;padding:8px}.section{background:white;border-radius:18px;padding:20px;margin-bottom:16px;border:1px solid #e5e7eb}.section h2{margin:0 0 14px;font-size:22px;color:#111827;border-bottom:2px solid #d4af37;padding-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.item{background:#f9fafb;border-radius:14px;padding:12px;border:1px solid #e5e7eb}.label{display:block;color:#6b7280;font-size:12px;font-weight:bold;text-transform:uppercase;margin-bottom:5px}.value{font-size:15px;white-space:pre-wrap}.visit,.payment,.appointment{border-left:4px solid #d4af37;padding:12px;background:#f9fafb;border-radius:12px;margin-bottom:10px}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.photos img{width:100%;height:160px;object-fit:cover;border-radius:14px;border:1px solid #e5e7eb}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.moneyBox{background:#111827;color:white;border-radius:16px;padding:14px}.moneyBox b{color:#d4af37;display:block;margin-bottom:6px}.footer{text-align:center;color:#6b7280;margin-top:24px;font-size:12px}@media print{body{background:white}.report{padding:0}.section,.header{break-inside:avoid}button{display:none}}</style></head><body><div class="report"><div class="header">${logo ? `<img class="logo" src="${logo}">` : ""}<h1>${safeText(clinicName)}</h1><p>Professional Dental Patient Report - ${safeText(reportType)}</p></div><div class="section"><h2>Patient Information</h2><div class="grid"><div class="item"><span class="label">Name</span><span class="value">${safeText(p.name || "-")}</span></div><div class="item"><span class="label">Patient ID</span><span class="value">${safeText(p.case_id || "-")}</span></div><div class="item"><span class="label">Phone</span><span class="value">${safeText(p.phone || "-")}</span></div><div class="item"><span class="label">Age / Gender</span><span class="value">${safeText(p.age || "-")} / ${safeText(p.gender || "-")}</span></div></div></div><div class="section"><h2>Clinical Summary</h2><div class="item"><span class="label">Chief Complaint</span><span class="value">${safeText(p.chief_complaint || "-")}</span></div><br><div class="item"><span class="label">Medical Alerts</span><span class="value">${safeText(p.medical_alerts || "-")}</span></div><br><div class="item"><span class="label">Diagnosis</span><span class="value">${safeText(p.diagnosis || "-")}</span></div><br><div class="item"><span class="label">Treatment Plan</span><span class="value">${safeText(p.treatment_plan || "-")}</span></div></div><div class="section"><h2>Payments Summary</h2><div class="summary"><div class="moneyBox"><b>Total</b>${money.total}</div><div class="moneyBox"><b>Paid</b>${money.paid}</div><div class="moneyBox"><b>Remaining</b>${money.remaining}</div></div></div><div class="section"><h2>Visits History</h2>${data.visits.length ? data.visits.map(v => `<div class="visit"><b>${safeText(v.date || "")}</b><p>${safeText(v.note || "-")}</p></div>`).join("") : "<p>No visits recorded.</p>"}</div><div class="section"><h2>Appointments</h2>${data.appointments.length ? data.appointments.map(a => `<div class="appointment"><b>${safeText(a.date || "")}</b><p>${safeText(a.note || "-")}</p></div>`).join("") : "<p>No appointments recorded.</p>"}</div><div class="section"><h2>Payments History</h2>${data.payments.length ? data.payments.map(pay => `<div class="payment"><b>${safeText(pay.date || "")}</b><p>Total: ${Number(pay.total || 0)} | Paid: ${Number(pay.paid || 0)} | Remaining: ${Number(pay.total || 0) - Number(pay.paid || 0)}</p></div>`).join("") : "<p>No payments recorded.</p>"}</div><div class="section"><h2>Photos / X-rays</h2><div class="photos">${(p.photos || []).length ? p.photos.map(ph => `<img src="${ph.url}">`).join("") : "<p>No photos recorded.</p>"}</div></div><div class="footer">Generated by ${safeText(clinicName)} Management System</div></div><div style="position:fixed;top:18px;right:18px;display:flex;gap:10px;z-index:9999;">
<button onclick="window.close()" style="padding:12px 18px;border:none;border-radius:16px;background:#263241;color:white;font-weight:900;">Cancel</button>
<button onclick="window.print()" style="padding:12px 18px;border:none;border-radius:16px;background:#d4af37;color:#111827;font-weight:900;">Print / Save PDF</button>
</div></body></html>`);
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
