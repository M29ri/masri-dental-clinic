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

  const username = await luxuryPrompt("Choose username", "Any username you want");
  if (!username) return;

  const password = await luxuryPrompt("Choose password", "Password");
  if (!password) return;

  const cleanUsername = username.trim();

  try {
    const existing = await api(
      `clinic_users?select=id&username=eq.${encodeURIComponent(cleanUsername)}`
    );

    if (existing.length) {
      return alert("This username already exists. Please login.");
    }

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


function clinicLogoMarkup() {
  const logo = currentUser?.clinic_logo || "";
  return `<div class="clinicLogoPremium">${logo ? `<img src="${logo}" alt="Clinic logo">` : "M"}</div>`;
}

window.openClinicMenu = function() {
  document.getElementById("drawerOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "drawerOverlay";
  overlay.id = "drawerOverlay";
  overlay.onclick = closeClinicMenu;

  const drawer = document.createElement("aside");
  drawer.className = "sideDrawer";
  drawer.id = "sideDrawer";
  drawer.innerHTML = `
    <div class="drawerHead">
      <h2>Menu</h2>
      <button class="drawerClose" onclick="closeClinicMenu()" aria-label="Close">Ã</button>
    </div>

    <div class="drawerUser">
      <div>${safeText(currentUser?.full_name || currentUser?.username || "Doctor")}</div>
      <small>${safeText((currentUser?.role || "doctor").toUpperCase())}</small>
    </div>

    <div class="drawerMenu">
      <button class="primaryItem" onclick="closeClinicMenu(); showPage('dashboard')">Dashboard</button>
      <button onclick="closeClinicMenu(); showPage('patients')">Patients</button>
      <button onclick="closeClinicMenu(); showPage('settings')">Profile / Branding</button>
      <button onclick="closeClinicMenu(); backupData()">Backup</button>
      <button onclick="closeClinicMenu(); restoreBackup()">Restore</button>
      <button onclick="closeClinicMenu(); typeof showReminderCenter==='function' ? showReminderCenter() : alert('Reminders are available from patient WhatsApp tools')">Reminders</button>
      <button onclick="closeClinicMenu(); typeof startDailyBackup==='function' ? startDailyBackup() : backupData()">Daily Backup</button>
      <button onclick="closeClinicMenu(); typeof addUser==='function' ? addUser() : alert('Users can be managed from Supabase / admin setup')">Users</button>
      <button onclick="closeClinicMenu(); openThemeMenu()">Themes</button>
      <button class="dangerItem" onclick="logout()">Logout</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
};

window.closeClinicMenu = function() {
  document.getElementById("drawerOverlay")?.remove();
  document.getElementById("sideDrawer")?.remove();
};

window.openThemeMenu = function() {
  document.getElementById("drawerOverlay")?.remove();
  document.getElementById("sideDrawer")?.remove();

  const modal = document.createElement("div");
  modal.className = "luxuryModal";
  modal.innerHTML = `
    <div class="luxuryBox" style="max-width:520px;">
      <h2>Choose Theme</h2>
      <div class="themePalette">
        <button style="background:#d4af37" onclick="setClinicTheme('gold')">Gold</button>
        <button style="background:#ff4fa3" onclick="setClinicTheme('pink')">Pink</button>
        <button style="background:#ef4444" onclick="setClinicTheme('red')">Red</button>
        <button style="background:#3b82f6" onclick="setClinicTheme('blue')">Blue</button>
        <button style="background:#06b6d4" onclick="setClinicTheme('cyan')">Cyan</button>
        <button style="background:#8b5cf6" onclick="setClinicTheme('purple')">Purple</button>
        <button style="background:#22c55e" onclick="setClinicTheme('green')">Green</button>
        <button style="background:#f97316" onclick="setClinicTheme('orange')">Orange</button>
      </div>
      <button class="secondary" style="width:100%;margin-top:14px" onclick="this.closest('.luxuryModal').remove()">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
};

window.setClinicTheme = function(theme) {
  const themes = ["gold","pink","red","blue","cyan","purple","green","orange"];
  themes.forEach(t => document.body.classList.remove(`theme-${t}`));
  if (theme && theme !== "gold") document.body.classList.add(`theme-${theme}`);
  localStorage.setItem("clinicTheme", theme || "gold");
  document.querySelector(".luxuryModal")?.remove();
};

function applySavedTheme() {
  const theme = localStorage.getItem("clinicTheme") || "gold";
  setClinicTheme(theme);
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


function enhancePremiumHeader() {
  const brand = document.querySelector(".brand");
  if (!brand || brand.querySelector(".clinicLogoPremium")) return;

  const h1 = brand.querySelector("h1");
  if (!h1) return;

  const oldText = h1.textContent;
  const statusText = document.body.textContent.includes("Cloud connected") ? "Cloud connected" : "";
  const logo = clinicLogoMarkup();

  h1.insertAdjacentHTML("beforebegin", logo);
  brand.classList.add("brandWrapPremium");

  const rightArea = document.querySelector(".userBox")?.parentElement || brand.parentElement;
  if (rightArea && !document.getElementById("hamburgerBtn")) {
    const btn = document.createElement("button");
    btn.id = "hamburgerBtn";
    btn.className = "hamburgerBtn";
    btn.textContent = "";
    btn.onclick = openClinicMenu;
    rightArea.appendChild(btn);
  }
}

function canEdit() { return currentUser && ["admin", "doctor"].includes(currentUser.role); }
function canDelete() { return currentUser && ["admin", "doctor"].includes(currentUser.role); }
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

  
    /* Premium tooth chart rescue upgrade */
    .proMouthChart{
      box-shadow:inset 0 0 90px rgba(212,175,55,.05),0 24px 70px rgba(0,0,0,.35)!important;
      background:
        radial-gradient(circle at 50% 38%,rgba(212,175,55,.10),transparent 28%),
        radial-gradient(circle at 50% 62%,rgba(96,165,250,.07),transparent 32%),
        linear-gradient(145deg,#0b111a,#111827 48%,#070b10)!important;
    }
    .proTooth{transition:transform .18s ease,filter .18s ease!important}
    .proTooth:active{transform:translate(-50%,-50%) scale(.92)!important}
    .proToothSvg{filter:drop-shadow(0 10px 12px rgba(0,0,0,.42))!important}
    .proToothSvg path:first-child{stroke:rgba(255,255,255,.55)!important;stroke-width:2.2!important}
    .toothNo{text-shadow:0 2px 8px rgba(0,0,0,.8)!important}
    .proMouthLabel{color:rgba(212,175,55,.72)!important}

  
    body.lightMode{background:#f5f7fb!important;color:#111827!important}
    body.lightMode .card,body.lightMode .patientCard,body.lightMode .dashboardPanel,body.lightMode .kv,body.lightMode .miniCard{background:#ffffff!important;color:#111827!important;border-color:#e5e7eb!important}
    body.lightMode .kv span,body.lightMode .timelineText{color:#111827!important}

  
    .proBadge{display:inline-flex!important;align-items:center!important;border-radius:999px!important;padding:8px 11px!important;font-size:12px!important;font-weight:1000!important;background:rgba(212,175,55,.12)!important;color:#d4af37!important;border:1px solid rgba(212,175,55,.25)!important;margin:4px!important}
    .alertBanner{background:linear-gradient(135deg,rgba(239,68,68,.20),rgba(127,29,29,.22))!important;border:1px solid rgba(248,113,113,.45)!important;color:#fecaca!important;border-radius:22px!important;padding:16px!important;margin:14px 0!important;font-weight:1000!important}
    .progressSteps{display:grid!important;gap:10px!important;margin:14px 0!important}
    .progressStep{display:flex!important;align-items:center!important;justify-content:space-between!important;background:#0f1620!important;border:1px solid #263241!important;border-radius:18px!important;padding:12px 14px!important;color:#dbe6f3!important;font-weight:900!important}
    .progressStep.done{border-color:rgba(34,197,94,.35)!important;background:rgba(34,197,94,.08)!important}
    .progressStep.active{border-color:rgba(212,175,55,.45)!important;background:rgba(212,175,55,.10)!important;color:#d4af37!important}
    .calendarBoard{display:grid!important;grid-template-columns:repeat(7,1fr)!important;gap:7px!important;margin:14px 0!important}
    .calendarCell{min-height:58px!important;border-radius:16px!important;background:#0f1620!important;border:1px solid #263241!important;color:#e5e7eb!important;font-weight:900!important;padding:8px!important;text-align:left!important}
    .calendarCell.hasAppt{background:rgba(212,175,55,.13)!important;border-color:rgba(212,175,55,.42)!important;color:#d4af37!important}
    .calendarCell small{display:block!important;color:#94a3b8!important;font-size:10px!important;margin-top:4px!important}
    .financeChart{display:flex!important;align-items:end!important;gap:8px!important;height:130px!important;margin:14px 0!important;padding:12px!important;background:#0f1620!important;border:1px solid #263241!important;border-radius:22px!important}
    .financeBar{flex:1!important;border-radius:12px 12px 4px 4px!important;background:linear-gradient(180deg,#f5d76e,#b8860b)!important;min-height:8px!important;position:relative!important}
    .financeBar span{position:absolute!important;bottom:-24px!important;left:50%!important;transform:translateX(-50%)!important;color:#94a3b8!important;font-size:10px!important;font-weight:900!important}
    .inventoryRow,.labRow{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:12px!important;background:#0f1620!important;border:1px solid #263241!important;border-radius:18px!important;padding:12px!important;margin:10px 0!important}
    body.lightMode{background:#f5f7fb!important;color:#111827!important}
    body.lightMode .card,body.lightMode .patientCard,body.lightMode .dashboardPanel,body.lightMode .kv,body.lightMode .miniCard,body.lightMode .progressStep,body.lightMode .inventoryRow,body.lightMode .labRow{background:#ffffff!important;color:#111827!important;border-color:#e5e7eb!important}

  
    /* Safe bugfix polish */
    .kv b::before,.progressStep span:first-child::before,.alertBanner::before{content:none!important}
    .cleanField b{font-size:15px!important;color:#d4af37!important}
    .cleanField span{font-size:19px!important;line-height:1.45!important;color:#eef2f7!important}
    .toothStatusGrid{display:grid!important;grid-template-columns:repeat(2,1fr)!important;gap:10px!important;margin-top:12px!important}
    .toothStatusGrid button,.surfaceBtn{cursor:pointer!important;touch-action:manipulation!important;min-height:48px!important}
    .surfaceGrid{display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:8px!important;margin:12px 0!important}
    .surfaceBtn{border:none!important;border-radius:16px!important;background:#1f2937!important;color:white!important;font-weight:1000!important}
    .surfaceBtn.active{background:linear-gradient(135deg,#f5d76e,#b8860b)!important;color:#050505!important}
    .labRow button{min-height:40px!important;border-radius:14px!important;font-size:12px!important;padding:8px 10px!important}

  
    /* Premium form + tooth popup final polish */
    .toothPopupBox .toothStatusGrid button{
      background:linear-gradient(145deg,#101722,#0b111a)!important;
      border:1px solid rgba(148,163,184,.18)!important;
      color:#eef2f7!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 10px 22px rgba(0,0,0,.22)!important;
      letter-spacing:.4px!important;
    }
    .toothPopupBox .toothStatusGrid button:active{
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;
      color:#050505!important;
      transform:scale(.97)!important;
    }
    .toothPopupBox .surfaceBtn{
      background:linear-gradient(145deg,#243041,#1d2735)!important;
      border:1px solid rgba(148,163,184,.15)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.05)!important;
    }
    .toothPopupBox .surfaceBtn.active{
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;
      color:#050505!important;
    }
    .premiumDocBackdrop{
      position:fixed!important;
      inset:0!important;
      background:rgba(0,0,0,.82)!important;
      backdrop-filter:blur(16px)!important;
      z-index:999999!important;
      overflow:auto!important;
      padding:70px 18px 34px!important;
      box-sizing:border-box!important;
    }
    .premiumDoc{
      max-width:880px!important;
      margin:0 auto!important;
      background:#f7f8fb!important;
      color:#111827!important;
      border-radius:28px!important;
      padding:26px!important;
      box-shadow:0 28px 80px rgba(0,0,0,.55)!important;
      font-family:Arial,sans-serif!important;
    }
    .premiumDoc h1{margin:0!important;color:#111827!important;font-size:32px!important}
    .premiumDoc h2{color:#111827!important;border-bottom:3px solid #d4af37!important;padding-bottom:10px!important}
    .premiumDocBox{
      border:1px solid #e5e7eb!important;
      border-radius:18px!important;
      padding:18px!important;
      background:white!important;
      margin:14px 0!important;
      line-height:1.55!important;
    }
    .premiumDocActions{
      position:fixed!important;
      top:14px!important;
      right:14px!important;
      display:flex!important;
      gap:10px!important;
      z-index:1000000!important;
    }
    .premiumDocActions button{
      border:none!important;
      border-radius:16px!important;
      padding:12px 16px!important;
      font-weight:1000!important;
      min-height:44px!important;
    }
    .premiumDocActions .closeDoc{background:#263241!important;color:white!important}
    .premiumDocActions .printDoc{background:#d4af37!important;color:#111827!important}
    @media print{
      .premiumDocActions{display:none!important}
      .premiumDocBackdrop{position:static!important;background:white!important;padding:0!important}
      .premiumDoc{box-shadow:none!important;border-radius:0!important;max-width:none!important}
    }

  
    /* Big professional upgrades */
    .profileGrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;margin-top:12px!important}
    .profileGrid button{min-height:54px!important;border-radius:20px!important}
    .tagWrap{display:flex!important;flex-wrap:wrap!important;gap:8px!important;margin:12px 0!important}
    .patientTag{display:inline-flex!important;align-items:center!important;gap:8px!important;padding:8px 12px!important;border-radius:999px!important;background:rgba(212,175,55,.13)!important;border:1px solid rgba(212,175,55,.28)!important;color:#d4af37!important;font-weight:1000!important;font-size:12px!important}
    .analyticsGrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin-top:12px!important}
    .analyticsBox{background:#0f1620!important;border:1px solid #263241!important;border-radius:18px!important;padding:14px!important}
    .analyticsBox small{display:block!important;color:#94a3b8!important;font-weight:900!important;margin-bottom:6px!important}
    .analyticsBox b{color:#fff!important;font-size:20px!important}
    .manageRow{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:10px!important;background:#0f1620!important;border:1px solid #263241!important;border-radius:18px!important;padding:12px!important;margin:10px 0!important}
    .manageRow b{color:#fff!important}.manageRow small{color:#94a3b8!important;font-weight:800!important}
    .toastUndo{position:fixed!important;left:16px!important;right:16px!important;bottom:18px!important;z-index:1000000!important;background:#111827!important;border:1px solid rgba(212,175,55,.35)!important;border-radius:22px!important;padding:14px!important;display:flex!important;justify-content:space-between!important;align-items:center!important;color:white!important;box-shadow:0 18px 50px rgba(0,0,0,.45)!important}

  
    /* Final+ luxury themes */
    body.themeGold{--gold:#f1c94c!important;--border:#334155!important;background:radial-gradient(circle at top,#151308,#04070b 45%,#020305)!important}
    body.themeMidnight{--gold:#8ab4ff!important;--border:#263b60!important;background:radial-gradient(circle at top,#0b1220,#020617 55%,#000)!important}
    body.themeEmerald{--gold:#34d399!important;--border:#1f4d3b!important;background:radial-gradient(circle at top,#061b14,#020806 55%,#000)!important}
    .themePicker{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:10px!important;margin:12px 0!important}
    .themePicker button{min-height:50px!important;border-radius:18px!important;border:1px solid var(--border)!important;background:#1f2937!important;color:white!important;font-weight:1000!important}

    /* Premium teeth chart v2 */
    .proMouthChart{
      height:680px!important;
      max-width:820px!important;
      border-radius:42px!important;
      background:
        radial-gradient(ellipse at 50% 26%,rgba(212,175,55,.16),transparent 28%),
        radial-gradient(ellipse at 50% 74%,rgba(96,165,250,.09),transparent 30%),
        linear-gradient(145deg,#05070a,#111827 50%,#05070a)!important;
      box-shadow:inset 0 0 110px rgba(212,175,55,.06),0 28px 90px rgba(0,0,0,.50)!important;
      overflow:visible!important;
    }
    .proMouthChart:after{
      content:"";
      position:absolute;
      left:13%;
      right:13%;
      top:12%;
      bottom:12%;
      border:1px solid rgba(212,175,55,.10);
      border-radius:50%;
      pointer-events:none;
    }
    .proTooth{
      width:50px!important;
      height:62px!important;
      border-radius:20px!important;
      background:rgba(15,22,32,.25)!important;
      transition:transform .18s ease,filter .18s ease,box-shadow .18s ease!important;
    }
    .proTooth:hover,.proTooth:focus{
      transform:translate(-50%,-50%) scale(1.08)!important;
      filter:brightness(1.12)!important;
      box-shadow:0 0 0 4px rgba(212,175,55,.15),0 18px 35px rgba(0,0,0,.45)!important;
      z-index:20!important;
    }
    .proToothSvg{width:46px!important;height:48px!important;filter:drop-shadow(0 12px 13px rgba(0,0,0,.48))!important}
    .proTooth.molar .proToothSvg{width:50px!important;height:50px!important}
    .proToothSvg path:first-child{fill:#fff2d7!important;stroke:rgba(255,255,255,.78)!important;stroke-width:2.2!important}
    .proToothSvg .surfaceMark{stroke:rgba(0,0,0,.35)!important;stroke-width:3!important;fill:none!important}
    .proTooth.caries path:first-child{fill:#ef4444!important}
    .proTooth.filling path:first-child{fill:#60a5fa!important}
    .proTooth.rct path:first-child{fill:#8b5cf6!important}
    .proTooth.crown path:first-child{fill:#d4af37!important}
    .proTooth.missing path:first-child{fill:#4b5563!important}
    .proTooth.extraction path:first-child{fill:#fb7185!important}
    .proTooth.implant path:first-child{fill:#2dd4bf!important}
    .toothSurfaceText{
      position:absolute!important;
      right:-7px!important;
      top:-7px!important;
      min-width:22px!important;
      height:22px!important;
      border-radius:999px!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      font-size:9px!important;
      font-weight:1000!important;
      background:rgba(212,175,55,.95)!important;
      color:#050505!important;
      border:2px solid rgba(255,255,255,.65)!important;
    }
    .toothStatusGrid button{
      background:linear-gradient(145deg,#111827,#0b111a)!important;
      border:1px solid rgba(148,163,184,.18)!important;
      color:#eef2f7!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 10px 22px rgba(0,0,0,.22)!important;
    }
    .toothStatusGrid button:active{
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;
      color:#050505!important;
      transform:scale(.97)!important;
    }

  
    /* Phase 1 professional upgrades */
    .apptStatusGrid,.priorityGrid{
      display:grid!important;
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:10px!important;
      margin:12px 0!important;
    }
    .apptStatusBtn,.priorityBtn{
      min-height:54px!important;
      border:none!important;
      border-radius:18px!important;
      color:#fff!important;
      font-weight:1000!important;
      background:#1f2937!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 10px 22px rgba(0,0,0,.22)!important;
    }
    .statusConfirmed{border-left:5px solid #22c55e!important}
    .statusPending{border-left:5px solid #f59e0b!important}
    .statusCancelled{border-left:5px solid #ef4444!important}
    .statusEmergency{border-left:5px solid #8b5cf6!important}
    .waitingListBadge{background:rgba(139,92,246,.14)!important;color:#c4b5fd!important;border:1px solid rgba(139,92,246,.35)!important}
    .completionRing{
      width:86px!important;height:86px!important;border-radius:50%!important;
      display:grid!important;place-items:center!important;
      background:conic-gradient(var(--gold,#d4af37) var(--p), #1f2937 0)!important;
      box-shadow:0 18px 40px rgba(0,0,0,.35)!important;
      margin:auto!important;
    }
    .completionRing span{
      width:64px!important;height:64px!important;border-radius:50%!important;background:#0f1620!important;
      display:grid!important;place-items:center!important;color:#fff!important;font-weight:1000!important;
      font-size:16px!important;
    }
    .profileHero{
      display:grid!important;grid-template-columns:1fr auto!important;gap:18px!important;align-items:center!important;
      background:linear-gradient(145deg,#0f172a,#111827)!important;border:1px solid rgba(212,175,55,.18)!important;
      border-radius:28px!important;padding:20px!important;margin-bottom:16px!important;
    }
    .patientAvatar{
      width:82px!important;height:82px!important;border-radius:24px!important;
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;color:#050505!important;
      display:grid!important;place-items:center!important;font-size:34px!important;font-weight:1000!important;
      box-shadow:0 18px 40px rgba(0,0,0,.35)!important;
    }
    .riskBadge{background:rgba(239,68,68,.15)!important;color:#fecaca!important;border:1px solid rgba(239,68,68,.35)!important}
    .vipBadge{background:rgba(212,175,55,.16)!important;color:#fde68a!important;border:1px solid rgba(212,175,55,.38)!important}
    .photoCompareWrap{
      position:relative!important;height:420px!important;border-radius:26px!important;overflow:hidden!important;
      background:#05070a!important;border:1px solid #263241!important;box-shadow:0 24px 65px rgba(0,0,0,.45)!important;
    }
    .photoCompareWrap img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:contain!important}
    .compareBefore{clip-path:inset(0 50% 0 0)!important}
    .compareSlider{
      position:absolute!important;left:5%!important;right:5%!important;bottom:18px!important;width:90%!important;z-index:5!important;
    }
    .zoomPhoto{
      max-width:100%!important;max-height:78vh!important;object-fit:contain!important;transition:transform .18s ease!important;
    }
    .surfaceOverlay{
      position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;
      width:42px!important;height:42px!important;border-radius:50%!important;pointer-events:none!important;
      display:grid!important;grid-template-columns:1fr 1fr!important;grid-template-rows:1fr 1fr!important;overflow:hidden!important;opacity:.82!important;
    }
    .surfaceOverlay span{border:1px solid rgba(0,0,0,.18)!important}
    .surfaceCaries{background:#ef4444!important}.surfaceFilling{background:#60a5fa!important}.surfaceRCT{background:#8b5cf6!important}.surfaceCrown{background:#d4af37!important}
    .financeProGrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;margin:14px 0!important}
    .financeProCard{background:#0f1620!important;border:1px solid #263241!important;border-radius:20px!important;padding:16px!important}
    .financeProCard small{display:block!important;color:#94a3b8!important;font-weight:900!important;margin-bottom:8px!important}
    .financeProCard strong{font-size:26px!important;color:#fff!important}
    .topProcedureRow{display:flex!important;justify-content:space-between!important;gap:10px!important;background:#0f1620!important;border:1px solid #263241!important;border-radius:16px!important;padding:12px!important;margin:8px 0!important}
    .labStepper{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:8px!important;margin-top:10px!important}
    .labStep{border-radius:14px!important;background:#1f2937!important;color:#94a3b8!important;padding:9px 6px!important;text-align:center!important;font-size:11px!important;font-weight:1000!important}
    .labStep.done{background:rgba(34,197,94,.16)!important;color:#86efac!important;border:1px solid rgba(34,197,94,.30)!important}
    @media(max-width:460px){
      .profileHero{grid-template-columns:1fr!important}
      .patientAvatar{width:70px!important;height:70px!important;font-size:30px!important}
      .photoCompareWrap{height:320px!important}
      .financeProGrid{grid-template-columns:1fr!important}
    }

  
    /* Phase 2 premium systems */
    .reportCenterGrid{
      display:grid!important;
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:12px!important;
      margin:14px 0!important;
    }
    .reportCenterGrid button{
      min-height:58px!important;
      border-radius:20px!important;
      font-weight:1000!important;
    }
    .signaturePad{
      background:#fff!important;
      border:2px dashed #d4af37!important;
      border-radius:18px!important;
      width:100%!important;
      height:180px!important;
      touch-action:none!important;
      margin:12px 0!important;
    }
    .docHistoryRow{
      display:flex!important;
      justify-content:space-between!important;
      gap:10px!important;
      align-items:center!important;
      background:#0f1620!important;
      border:1px solid #263241!important;
      border-radius:18px!important;
      padding:12px!important;
      margin:10px 0!important;
    }
    .syncBanner{
      position:fixed!important;
      left:16px!important;
      right:16px!important;
      top:14px!important;
      background:#111827!important;
      color:#fff!important;
      border:1px solid rgba(212,175,55,.35)!important;
      border-radius:18px!important;
      padding:12px 14px!important;
      z-index:1000000!important;
      font-weight:1000!important;
      box-shadow:0 18px 45px rgba(0,0,0,.35)!important;
    }
    .smartSearchHint{
      color:#94a3b8!important;
      font-size:12px!important;
      font-weight:800!important;
      margin-top:6px!important;
    }
    .quadTabs{
      display:grid!important;
      grid-template-columns:repeat(4,1fr)!important;
      gap:8px!important;
      margin:12px 0!important;
    }
    .quadTabs button{
      border:none!important;
      border-radius:16px!important;
      background:#1f2937!important;
      color:white!important;
      font-weight:1000!important;
      min-height:44px!important;
    }
    .quadTabs button.active{
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;
      color:#050505!important;
    }
    .toothRootLine{
      stroke:#7c3aed!important;
      stroke-width:4!important;
      stroke-linecap:round!important;
      fill:none!important;
      opacity:.75!important;
    }
    .implantPost{
      stroke:#0f766e!important;
      stroke-width:5!important;
      stroke-linecap:round!important;
      opacity:.9!important;
    }
    @media(max-width:460px){
      .reportCenterGrid{grid-template-columns:1fr!important}
      .signaturePad{height:150px!important}
    }

  
    /* Teeth chart v4 + Before/After Morph */
    .quadTabs{
      display:grid!important;
      grid-template-columns:repeat(5,minmax(0,1fr))!important;
      gap:8px!important;
      margin:12px 0 18px!important;
      position:relative!important;
      z-index:10!important;
    }
    .quadTabs button{
      min-height:48px!important;
      border:none!important;
      border-radius:16px!important;
      background:linear-gradient(145deg,#1f2937,#111827)!important;
      color:#e5e7eb!important;
      font-weight:1000!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 10px 20px rgba(0,0,0,.18)!important;
    }
    .quadTabs button.active{
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;
      color:#050505!important;
      box-shadow:0 0 26px rgba(212,175,55,.35)!important;
    }
    .proMouthChart{
      position:relative!important;
      height:720px!important;
      max-width:860px!important;
      margin:18px auto!important;
      border-radius:46px!important;
      overflow:hidden!important;
      background:
        radial-gradient(ellipse at 50% 35%,rgba(212,175,55,.16),transparent 30%),
        radial-gradient(ellipse at 50% 68%,rgba(59,130,246,.10),transparent 34%),
        linear-gradient(145deg,#05070a,#111827 52%,#05070a)!important;
      border:1px solid rgba(212,175,55,.18)!important;
      box-shadow:inset 0 0 110px rgba(212,175,55,.06),0 30px 90px rgba(0,0,0,.55)!important;
    }
    .proMouthChart::before{
      content:"";
      position:absolute;
      left:12%;
      right:12%;
      top:10%;
      bottom:10%;
      border:1px solid rgba(212,175,55,.13);
      border-radius:50%;
      pointer-events:none;
      box-shadow:inset 0 0 70px rgba(212,175,55,.03);
    }
    .proMouthLabel{
      position:absolute!important;
      left:50%!important;
      transform:translateX(-50%)!important;
      color:rgba(212,175,55,.62)!important;
      letter-spacing:12px!important;
      font-size:18px!important;
      font-weight:1000!important;
      pointer-events:none!important;
      z-index:2!important;
    }
    .proMouthLabel.upper{top:38%!important}
    .proMouthLabel.lower{top:59%!important}
    .proMidLine{
      position:absolute!important;
      top:16%!important;
      bottom:16%!important;
      left:50%!important;
      border-left:1px dashed rgba(212,175,55,.28)!important;
      z-index:1!important;
    }
    .proHorizontalLine{
      position:absolute!important;
      left:16%!important;
      right:16%!important;
      top:50%!important;
      border-top:1px dashed rgba(212,175,55,.28)!important;
      z-index:1!important;
    }
    .proTooth{
      position:absolute!important;
      transform:translate(-50%,-50%)!important;
      width:54px!important;
      height:62px!important;
      border:none!important;
      background:transparent!important;
      padding:0!important;
      transition:opacity .2s ease,transform .2s ease,filter .2s ease!important;
      z-index:6!important;
      overflow:visible!important;
    }
    .proTooth.hiddenByQuad{
      opacity:.08!important;
      filter:grayscale(1)!important;
      pointer-events:none!important;
    }
    .proTooth:hover,.proTooth:focus{
      transform:translate(-50%,-50%) scale(1.14)!important;
      filter:brightness(1.12)!important;
      z-index:20!important;
    }
    .toothArt{
      position:relative!important;
      display:block!important;
      width:56px!important;
      height:56px!important;
      filter:drop-shadow(0 14px 14px rgba(0,0,0,.52))!important;
    }
    .proToothSvg{width:56px!important;height:56px!important;overflow:visible!important}
    .proToothSvg path:first-child{
      fill:#fff2d7!important;
      stroke:rgba(255,255,255,.85)!important;
      stroke-width:2.2!important;
    }
    .proToothSvg .surfaceMark{stroke:rgba(0,0,0,.36)!important;stroke-width:3!important;fill:none!important}
    .proToothSvg .shine{stroke:rgba(255,255,255,.75)!important;stroke-width:2!important;fill:none!important}
    .proTooth.caries .proToothSvg path:first-child{fill:#ef4444!important}
    .proTooth.filling .proToothSvg path:first-child{fill:#60a5fa!important}
    .proTooth.rct .proToothSvg path:first-child{fill:#8b5cf6!important}
    .proTooth.crown .proToothSvg path:first-child{fill:#d4af37!important}
    .proTooth.missing .proToothSvg path:first-child{fill:#4b5563!important}
    .proTooth.extraction .proToothSvg path:first-child{fill:#fb7185!important}
    .proTooth.implant .proToothSvg path:first-child{fill:#2dd4bf!important}
    .toothNo{
      position:absolute!important;
      left:50%!important;
      top:54px!important;
      transform:translateX(-50%)!important;
      color:#e5e7eb!important;
      text-shadow:0 2px 6px #000!important;
      font-size:12px!important;
      font-weight:1000!important;
    }
    .toothSurfaceText{
      position:absolute!important;
      right:-8px!important;
      top:-8px!important;
      min-width:24px!important;
      height:24px!important;
      border-radius:999px!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      font-size:8px!important;
      font-weight:1000!important;
      background:rgba(212,175,55,.96)!important;
      color:#050505!important;
      border:2px solid rgba(255,255,255,.75)!important;
      z-index:30!important;
    }
    .surfaceOverlay{
      position:absolute!important;
      left:50%!important;
      top:50%!important;
      transform:translate(-50%,-50%) rotate(45deg)!important;
      width:38px!important;
      height:38px!important;
      border-radius:50%!important;
      pointer-events:none!important;
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      grid-template-rows:1fr 1fr!important;
      overflow:hidden!important;
      opacity:.75!important;
      mix-blend-mode:multiply!important;
    }
    .surfaceOverlay span{border:1px solid rgba(0,0,0,.12)!important}
    .surfaceCaries{background:#ef4444!important}.surfaceFilling{background:#60a5fa!important}.surfaceRCT{background:#8b5cf6!important}.surfaceCrown{background:#d4af37!important}
    .toothRootLine{stroke:#4c1d95!important;stroke-width:4!important;stroke-linecap:round!important;fill:none!important}
    .implantPost{stroke:#0f766e!important;stroke-width:5!important;stroke-linecap:round!important;fill:none!important}

    .baMorphWrap{
      position:relative!important;
      height:460px!important;
      border-radius:28px!important;
      overflow:hidden!important;
      background:#020617!important;
      border:1px solid #263241!important;
      box-shadow:0 24px 65px rgba(0,0,0,.50)!important;
      display:grid!important;
      place-items:center!important;
    }
    .baMorphWrap img{
      position:absolute!important;
      inset:0!important;
      width:100%!important;
      height:100%!important;
      object-fit:contain!important;
      background:#020617!important;
      transition:opacity .25s ease,filter .25s ease,transform .25s ease!important;
    }
    .baMorphAfter{opacity:.5!important}
    .baGhostLabel{
      position:absolute!important;
      top:14px!important;
      padding:8px 12px!important;
      border-radius:999px!important;
      background:rgba(0,0,0,.58)!important;
      color:#fff!important;
      font-weight:1000!important;
      z-index:6!important;
    }
    .baGhostLabel.before{left:14px!important}
    .baGhostLabel.after{right:14px!important}
    .baControlPanel{
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:10px!important;
      margin-top:14px!important;
    }
    .baControlPanel input[type=range]{
      grid-column:1/-1!important;
      width:100%!important;
    }
    @media(max-width:460px){
      .proMouthChart{height:650px!important}
      .proTooth{width:43px!important;height:52px!important}
      .toothArt,.proToothSvg{width:46px!important;height:46px!important}
      .toothNo{top:45px!important;font-size:11px!important}
      .baMorphWrap{height:380px!important}
    }

  
    /* FULL LAUNCH RELEASE UI */
    body{overflow-x:hidden!important}
    .card{border-radius:24px!important}
    .sectionTitle{
      margin:24px 0 12px!important;
      color:#d4af37!important;
      font-size:20px!important;
      letter-spacing:.2px!important;
    }
    .actions{
      display:flex!important;
      flex-wrap:wrap!important;
      gap:8px!important;
      margin:10px 0!important;
    }
    .actions button{
      min-height:44px!important;
      border-radius:14px!important;
      font-size:13px!important;
      font-weight:900!important;
    }

    /* Patient page full but clean */
    .profileHero{
      display:grid!important;
      grid-template-columns:1fr auto!important;
      gap:14px!important;
      align-items:center!important;
      padding:16px!important;
      border-radius:26px!important;
      background:linear-gradient(145deg,#0b1220,#111827)!important;
      border:1px solid rgba(212,175,55,.18)!important;
      margin-bottom:14px!important;
    }
    .profileHero h2{
      font-size:24px!important;
      margin:0 0 8px!important;
      color:#f8fafc!important;
    }
    .patientAvatar{
      width:78px!important;
      height:78px!important;
      border-radius:24px!important;
      overflow:hidden!important;
      cursor:pointer!important;
      position:relative!important;
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;
      color:#050505!important;
      display:grid!important;
      place-items:center!important;
      font-size:30px!important;
      font-weight:1000!important;
    }
    .patientAvatar img{width:100%!important;height:100%!important;object-fit:cover!important}
    .patientAvatar::after{
      content:"Edit";
      position:absolute;
      right:3px;
      bottom:3px;
      background:#111827;
      color:#fff;
      border:1px solid rgba(255,255,255,.65);
      border-radius:999px;
      font-size:9px;
      font-weight:1000;
      padding:3px 6px;
    }
    .completionRing{
      width:78px!important;
      height:78px!important;
    }
    .completionRing span{
      width:58px!important;
      height:58px!important;
      font-size:14px!important;
    }
    .kv.cleanField{
      border-radius:16px!important;
      padding:12px!important;
      margin:9px 0!important;
    }

    /* Full premium tooth chart: clean arch, no fake 3D */
    .toothChartBox{
      display:flex!important;
      flex-wrap:wrap!important;
      gap:6px!important;
      margin:8px 0 12px!important;
    }
    .legendItem{
      padding:6px 10px!important;
      border-radius:999px!important;
      font-size:11px!important;
      background:rgba(212,175,55,.10)!important;
      border:1px solid rgba(212,175,55,.22)!important;
      color:#d4af37!important;
      font-weight:900!important;
    }
    .quadTabs{
      display:grid!important;
      grid-template-columns:repeat(5,1fr)!important;
      gap:7px!important;
      margin:8px 0 12px!important;
    }
    .quadTabs button{
      min-height:40px!important;
      border:none!important;
      border-radius:14px!important;
      background:#1f2937!important;
      color:#e5e7eb!important;
      font-weight:1000!important;
      font-size:12px!important;
    }
    .quadTabs button.active{
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;
      color:#050505!important;
    }
    .proMouthChart{
      height:480px!important;
      max-width:100%!important;
      border-radius:28px!important;
      background:
        radial-gradient(ellipse at 50% 49%,rgba(143,36,52,.22),transparent 42%),
        radial-gradient(ellipse at 50% 35%,rgba(212,175,55,.10),transparent 28%),
        linear-gradient(145deg,#050914,#0b1220 55%,#030507)!important;
      border:1px solid rgba(212,175,55,.16)!important;
      position:relative!important;
      overflow:hidden!important;
      box-shadow:inset 0 0 80px rgba(212,175,55,.04),0 18px 50px rgba(0,0,0,.28)!important;
    }
    .proMouthChart::before{
      content:"";
      position:absolute;
      left:50%;
      top:50%;
      width:250px;
      height:170px;
      transform:translate(-50%,-50%);
      border-radius:50%;
      background:radial-gradient(ellipse at center,rgba(0,0,0,.55),rgba(0,0,0,.10) 60%,transparent 72%);
      pointer-events:none;
      z-index:1;
    }
    .proMouthLabel,.proMidLine,.proHorizontalLine{display:none!important}
    .proTooth{
      position:absolute!important;
      width:31px!important;
      height:48px!important;
      border:none!important;
      background:transparent!important;
      padding:0!important;
      transform:translate(-50%,-50%) rotate(var(--rot,0deg))!important;
      z-index:5!important;
      transition:transform .15s ease,filter .15s ease,opacity .15s ease!important;
      overflow:visible!important;
    }
    .proTooth:hover,.proTooth:focus{
      transform:translate(-50%,-50%) rotate(var(--rot,0deg)) scale(1.18)!important;
      filter:drop-shadow(0 0 13px rgba(212,175,55,.85))!important;
      z-index:20!important;
    }
    .proTooth.hiddenByQuad{
      opacity:.13!important;
      pointer-events:none!important;
      filter:grayscale(1)!important;
    }
    .toothArt{
      display:block!important;
      width:34px!important;
      height:45px!important;
      filter:drop-shadow(0 7px 8px rgba(0,0,0,.38))!important;
    }
    .proToothSvg,.proTooth svg{
      width:34px!important;
      height:45px!important;
      overflow:visible!important;
    }
    .proToothSvg path:first-child,.proTooth svg path:first-child{
      fill:#fff7e6!important;
      stroke:rgba(255,255,255,.95)!important;
      stroke-width:1.8!important;
    }
    .proTooth.caries path:first-child{fill:#ef4444!important}
    .proTooth.filling path:first-child{fill:#60a5fa!important}
    .proTooth.rct path:first-child{fill:#8b5cf6!important}
    .proTooth.crown path:first-child{fill:#d4af37!important}
    .proTooth.implant path:first-child{fill:#2dd4bf!important}
    .proTooth.missing path:first-child{fill:#475569!important;opacity:.45!important}
    .proTooth.extraction path:first-child{fill:#fb7185!important}
    .toothNo{display:none!important}
    .toothSurfaceText{
      min-width:18px!important;
      height:18px!important;
      border-radius:999px!important;
      top:-5px!important;
      right:-5px!important;
      font-size:7px!important;
    }
    .surfaceOverlay{width:20px!important;height:20px!important}

    /* Full gallery */
    .photoTabs,.photoGrid{display:none!important}
    .photoSectionTabs{
      display:grid!important;
      grid-template-columns:repeat(2,1fr)!important;
      gap:8px!important;
      margin:10px 0!important;
    }
    .photoSectionTabs button{
      min-height:44px!important;
      border-radius:14px!important;
      border:none!important;
      background:#1f2937!important;
      color:#e5e7eb!important;
      font-weight:1000!important;
    }
    .photoSectionTabs button.active{
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;
      color:#050505!important;
    }
    .photoGalleryHeader{
      display:flex!important;
      justify-content:space-between!important;
      align-items:center!important;
      gap:8px!important;
      margin:10px 0!important;
    }
    .photoGalleryHeader h3{
      margin:0!important;
      color:#d4af37!important;
      font-size:18px!important;
    }
    .galleryControls{display:flex!important;gap:8px!important}
    .galleryControls button{
      min-width:56px!important;
      height:38px!important;
      border:none!important;
      border-radius:12px!important;
      background:#1f2937!important;
      color:#fff!important;
      font-weight:1000!important;
    }
    .premiumPhotoViewer{
      height:330px!important;
      border-radius:18px!important;
      overflow:hidden!important;
      background:#020617!important;
      border:1px solid #263241!important;
      display:grid!important;
      place-items:center!important;
      position:relative!important;
      margin-bottom:10px!important;
    }
    .premiumPhotoViewer img{
      width:100%!important;
      height:100%!important;
      object-fit:contain!important;
      filter:none!important;
    }
    .photoThumbs{
      display:flex!important;
      gap:8px!important;
      overflow-x:auto!important;
      padding:6px 0!important;
    }
    .photoThumbs img{
      width:82px!important;
      height:70px!important;
      object-fit:cover!important;
      border-radius:12px!important;
      border:2px solid transparent!important;
      flex:0 0 auto!important;
    }
    .photoThumbs img.active{border-color:#d4af37!important}

    /* Zoom and before/after */
    .zoomOverlay{
      position:fixed!important;
      inset:0!important;
      background:rgba(0,0,0,.94)!important;
      z-index:999999!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      padding:18px!important;
    }
    .zoomToolbar{
      position:absolute!important;
      top:calc(14px + env(safe-area-inset-top))!important;
      left:12px!important;
      right:12px!important;
      display:flex!important;
      justify-content:space-between!important;
      gap:8px!important;
    }
    .zoomToolbar button{
      border:none!important;
      border-radius:14px!important;
      background:#1f2937!important;
      color:white!important;
      min-height:42px!important;
      padding:0 13px!important;
      font-weight:1000!important;
    }
    .zoomOverlay img{
      max-width:100%!important;
      max-height:82vh!important;
      object-fit:contain!important;
      border-radius:14px!important;
      transform:scale(var(--zoomScale,1))!important;
      transition:transform .15s ease!important;
      filter:none!important;
    }
    .baMorphWrap{
      height:350px!important;
      border-radius:18px!important;
      background:#020617!important;
      overflow:hidden!important;
      position:relative!important;
      display:grid!important;
      place-items:center!important;
    }
    .baMorphWrap img{
      position:absolute!important;
      inset:0!important;
      width:100%!important;
      height:100%!important;
      object-fit:contain!important;
      filter:none!important;
    }
    .baMorphAfter{opacity:0!important}
    .baControlPanel{
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:8px!important;
      margin-top:12px!important;
    }
    .baControlPanel input{grid-column:1/-1!important;width:100%!important}

    @media(max-width:480px){
      .profileHero{grid-template-columns:1fr!important}
      .patientAvatar{width:66px!important;height:66px!important}
      .proMouthChart{height:405px!important}
      .proTooth{width:26px!important;height:40px!important}
      .proToothSvg,.proTooth svg,.toothArt{width:28px!important;height:38px!important}
      .premiumPhotoViewer{height:285px!important}
      .baMorphWrap{height:300px!important}
    }

  
    /* FINAL PREMIUM CLINIC UI REDESIGN */
    :root{
      --menu-bg:#0b1118;
      --menu-card:#111a27;
    }

    .topHeaderPremium{
      display:flex!important;
      align-items:flex-start!important;
      justify-content:space-between!important;
      gap:14px!important;
      margin:0 0 18px!important;
    }

    .brandWrapPremium{
      display:flex!important;
      align-items:center!important;
      gap:12px!important;
      min-width:0!important;
    }

    .clinicLogoPremium{
      width:52px!important;
      height:52px!important;
      border-radius:16px!important;
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;
      display:grid!important;
      place-items:center!important;
      box-shadow:0 12px 28px rgba(212,175,55,.22)!important;
      overflow:hidden!important;
      flex:0 0 auto!important;
      color:#050505!important;
      font-weight:1000!important;
      font-size:22px!important;
    }

    .clinicLogoPremium img{
      width:100%!important;
      height:100%!important;
      object-fit:cover!important;
    }

    .brandWrapPremium h1,
    .brand h1{
      font-size:clamp(34px,8vw,56px)!important;
      line-height:.92!important;
      letter-spacing:-2px!important;
      margin:0!important;
      max-width:260px!important;
    }

    .clinicStatusPremium{
      color:#9ca9b8!important;
      font-weight:1000!important;
      margin-top:6px!important;
      font-size:15px!important;
    }

    #logoutBtn{
      display:none!important;
    }

    .hamburgerBtn{
      width:58px!important;
      height:58px!important;
      border-radius:20px!important;
      border:1px solid rgba(148,163,184,.18)!important;
      background:linear-gradient(145deg,#162233,#0d1522)!important;
      color:#fff!important;
      font-size:28px!important;
      font-weight:1000!important;
      display:grid!important;
      place-items:center!important;
      box-shadow:0 14px 34px rgba(0,0,0,.30)!important;
      flex:0 0 auto!important;
    }

    .drawerOverlay{
      position:fixed!important;
      inset:0!important;
      background:rgba(0,0,0,.55)!important;
      z-index:999998!important;
      backdrop-filter:blur(8px)!important;
    }

    .sideDrawer{
      position:fixed!important;
      top:0!important;
      right:0!important;
      width:min(86vw,360px)!important;
      height:100vh!important;
      background:linear-gradient(180deg,#0b1118,#0f1724)!important;
      border-left:1px solid rgba(212,175,55,.22)!important;
      z-index:999999!important;
      padding:18px!important;
      box-shadow:-30px 0 70px rgba(0,0,0,.55)!important;
      overflow-y:auto!important;
    }

    .drawerHead{
      display:flex!important;
      align-items:center!important;
      justify-content:space-between!important;
      gap:10px!important;
      margin-bottom:14px!important;
    }

    .drawerHead h2{
      margin:0!important;
      color:#f8fafc!important;
      font-size:24px!important;
      line-height:1!important;
    }

    .drawerClose{
      width:42px!important;
      height:42px!important;
      border:none!important;
      border-radius:14px!important;
      background:#1f2937!important;
      color:#fff!important;
      font-weight:1000!important;
      font-size:20px!important;
    }

    .drawerUser{
      background:#111a27!important;
      border:1px solid rgba(148,163,184,.18)!important;
      border-radius:20px!important;
      padding:14px!important;
      color:#e5e7eb!important;
      font-weight:900!important;
      margin-bottom:12px!important;
    }

    .drawerMenu{
      display:grid!important;
      gap:8px!important;
    }

    .drawerMenu button{
      min-height:52px!important;
      border:none!important;
      border-radius:16px!important;
      background:#1f2937!important;
      color:#e5e7eb!important;
      font-weight:1000!important;
      font-size:15px!important;
      text-align:left!important;
      padding:0 14px!important;
    }

    .drawerMenu button.primaryItem{
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;
      color:#050505!important;
    }

    .drawerMenu button.dangerItem{
      background:linear-gradient(135deg,#ef4444,#991b1b)!important;
      color:#fff!important;
      margin-top:12px!important;
    }

    /* Remove patient photo from details */
    .patientAvatar{
      display:none!important;
    }

    .profileHero{
      grid-template-columns:1fr!important;
      padding:18px!important;
      min-height:unset!important;
    }

    .profileHero h2{
      font-size:28px!important;
      color:#f8fafc!important;
    }

    .completionRing{
      margin:12px auto 0!important;
    }

    /* Better natural tooth chart spacing */
    .proMouthChart{
      height:520px!important;
      padding:0!important;
      border-radius:30px!important;
    }

    .proMouthChart::before{
      width:270px!important;
      height:190px!important;
    }

    .proTooth{
      width:28px!important;
      height:42px!important;
    }

    .toothArt,
    .proToothSvg,
    .proTooth svg{
      width:31px!important;
      height:42px!important;
    }

    .proTooth.premolar .toothArt,
    .proTooth.premolar .proToothSvg,
    .proTooth.premolar svg{
      width:34px!important;
      height:39px!important;
    }

    .proTooth.molar .toothArt,
    .proTooth.molar .proToothSvg,
    .proTooth.molar svg{
      width:39px!important;
      height:40px!important;
    }

    .proTooth.incisor .toothArt,
    .proTooth.incisor .proToothSvg,
    .proTooth.incisor svg{
      width:25px!important;
      height:43px!important;
    }

    .proTooth.canine .toothArt,
    .proTooth.canine .proToothSvg,
    .proTooth.canine svg{
      width:28px!important;
      height:44px!important;
    }

    .quadTabs{
      grid-template-columns:repeat(5,1fr)!important;
      margin-bottom:14px!important;
    }

    .legendItem{
      font-size:12px!important;
      padding:7px 11px!important;
    }

    /* More theme colors */
    body.theme-pink{--gold:#ff4fa3!important;--accent:#ff4fa3!important;--primary:#ff4fa3!important}
    body.theme-red{--gold:#ef4444!important;--accent:#ef4444!important;--primary:#ef4444!important}
    body.theme-blue{--gold:#3b82f6!important;--accent:#3b82f6!important;--primary:#3b82f6!important}
    body.theme-cyan{--gold:#06b6d4!important;--accent:#06b6d4!important;--primary:#06b6d4!important}
    body.theme-purple{--gold:#8b5cf6!important;--accent:#8b5cf6!important;--primary:#8b5cf6!important}
    body.theme-green{--gold:#22c55e!important;--accent:#22c55e!important;--primary:#22c55e!important}
    body.theme-orange{--gold:#f97316!important;--accent:#f97316!important;--primary:#f97316!important}

    .themePalette{
      display:grid!important;
      grid-template-columns:repeat(4,1fr)!important;
      gap:8px!important;
      margin-top:12px!important;
    }

    .themePalette button{
      min-height:44px!important;
      border:none!important;
      border-radius:14px!important;
      color:#fff!important;
      font-weight:1000!important;
    }

    @media(max-width:480px){
      .brandWrapPremium h1,.brand h1{
        max-width:210px!important;
        font-size:38px!important;
      }
      .clinicLogoPremium{
        width:46px!important;
        height:46px!important;
        border-radius:14px!important;
      }
      .hamburgerBtn{
        width:52px!important;
        height:52px!important;
      }
      .proMouthChart{
        height:445px!important;
      }
      .proTooth{
        width:24px!important;
        height:38px!important;
      }
      .toothArt,.proToothSvg,.proTooth svg{
        width:28px!important;
        height:38px!important;
      }
      .proTooth.molar .toothArt,.proTooth.molar .proToothSvg,.proTooth.molar svg{
        width:34px!important;
        height:36px!important;
      }
    }

  
    /* FINAL REQUEST FIX: dashboard clean, drawer menu, simple photos, cleaner arch */
    #logoutBtn{display:none!important}
    #hamburgerBtn,.hamburgerBtn{
      width:54px!important;height:54px!important;border-radius:18px!important;
      border:1px solid rgba(148,163,184,.22)!important;
      background:linear-gradient(145deg,#172235,#0d1624)!important;
      color:#fff!important;font-size:0!important;position:relative!important;
      display:grid!important;place-items:center!important;
      box-shadow:0 12px 30px rgba(0,0,0,.32)!important;
    }
    #hamburgerBtn::before,.hamburgerBtn::before{
      content:"Menu";font-size:28px!important;line-height:1!important;font-weight:1000!important;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif!important;
    }

    .drawerOverlay{position:fixed!important;inset:0!important;background:rgba(0,0,0,.55)!important;z-index:999998!important;backdrop-filter:blur(8px)!important}
    .sideDrawer{position:fixed!important;top:0!important;right:0!important;width:min(86vw,360px)!important;height:100vh!important;background:linear-gradient(180deg,#0b1118,#0f1724)!important;border-left:1px solid rgba(212,175,55,.22)!important;z-index:999999!important;padding:18px!important;box-shadow:-30px 0 70px rgba(0,0,0,.55)!important;overflow-y:auto!important}
    .drawerHead{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin-bottom:14px!important}
    .drawerHead h2{margin:0!important;color:#f8fafc!important;font-size:26px!important}
    .drawerClose{width:42px!important;height:42px!important;border:none!important;border-radius:14px!important;background:#1f2937!important;color:#fff!important;font-weight:1000!important;font-size:22px!important}
    .drawerUser{background:#111a27!important;border:1px solid rgba(148,163,184,.18)!important;border-radius:20px!important;padding:14px!important;color:#e5e7eb!important;font-weight:900!important;margin-bottom:12px!important}
    .drawerMenu{display:grid!important;gap:8px!important}
    .drawerMenu button{min-height:52px!important;border:none!important;border-radius:16px!important;background:#1f2937!important;color:#e5e7eb!important;font-weight:1000!important;font-size:15px!important;text-align:left!important;padding:0 14px!important}
    .drawerMenu button.primaryItem{background:linear-gradient(135deg,#f5d76e,#b8860b)!important;color:#050505!important}
    .drawerMenu button.dangerItem{background:linear-gradient(135deg,#ef4444,#991b1b)!important;color:#fff!important;margin-top:12px!important}

    /* Hide dashboard shortcut buttons that moved to drawer */
    .quickActions button[onclick*="backupData"],
    .quickActions button[onclick*="restoreBackup"],
    .quickActions button[onclick*="openThemeMenu"],
    .quickActions button[onclick*="showPage('settings')"],
    .quickActions button[onclick*="showPage(&quot;settings&quot;)"],
    .quickActions button[onclick*="addUser"],
    .quickActions button[onclick*="Daily"],
    .quickActions button[onclick*="Reminder"],
    .quickActions button:nth-child(n+5){
      display:none!important;
    }

    .brandWrapPremium,.brand{
      display:flex!important;align-items:center!important;gap:12px!important;min-width:0!important;
    }
    .clinicLogoPremium{
      width:50px!important;height:50px!important;border-radius:16px!important;
      background:linear-gradient(135deg,#f5d76e,#b8860b)!important;
      display:grid!important;place-items:center!important;color:#050505!important;
      font-weight:1000!important;font-size:22px!important;overflow:hidden!important;flex:0 0 auto!important;
      box-shadow:0 12px 28px rgba(212,175,55,.24)!important;
    }
    .clinicLogoPremium img{width:100%!important;height:100%!important;object-fit:cover!important}
    .brand h1,.brandWrapPremium h1{
      font-size:clamp(34px,8vw,54px)!important;line-height:.92!important;letter-spacing:-2px!important;
      margin:0!important;max-width:250px!important;
    }

    /* keep settings tab hidden because settings in drawer */
    nav button[onclick*="settings"], .tabs button[onclick*="settings"], .tabBar button[onclick*="settings"]{display:none!important}

    /* Tooth chart cleaner, less overlap */
    .proMouthChart{
      height:540px!important;border-radius:30px!important;
      background:radial-gradient(ellipse at 50% 50%,rgba(143,36,52,.18),transparent 38%),linear-gradient(145deg,#050914,#0b1220 55%,#030507)!important;
      border:1px solid rgba(212,175,55,.16)!important;position:relative!important;overflow:hidden!important;
    }
    .proMouthChart::before{
      content:"";position:absolute;left:50%;top:50%;width:260px;height:175px;transform:translate(-50%,-50%);
      border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.52),rgba(0,0,0,.08) 62%,transparent 72%);z-index:1;pointer-events:none;
    }
    .proMouthLabel,.proMidLine,.proHorizontalLine,.toothNo{display:none!important}
    .proTooth{position:absolute!important;border:none!important;background:transparent!important;padding:0!important;transform:translate(-50%,-50%) rotate(var(--rot,0deg))!important;z-index:5!important;transition:.15s!important;overflow:visible!important}
    .proTooth:hover,.proTooth:focus{transform:translate(-50%,-50%) rotate(var(--rot,0deg)) scale(1.16)!important;filter:drop-shadow(0 0 13px rgba(212,175,55,.85))!important;z-index:20!important}
    .proTooth.hiddenByQuad{opacity:.13!important;pointer-events:none!important;filter:grayscale(1)!important}
    .toothArt,.proToothSvg,.proTooth svg{display:block!important;overflow:visible!important;filter:drop-shadow(0 7px 8px rgba(0,0,0,.35))!important}
    .proTooth.incisor .toothArt,.proTooth.incisor svg{width:25px!important;height:44px!important}
    .proTooth.canine .toothArt,.proTooth.canine svg{width:29px!important;height:45px!important}
    .proTooth.premolar .toothArt,.proTooth.premolar svg{width:35px!important;height:39px!important}
    .proTooth.molar .toothArt,.proTooth.molar svg{width:42px!important;height:40px!important}
    .proToothSvg path:first-child,.proTooth svg path:first-child{fill:#fff7e6!important;stroke:rgba(255,255,255,.95)!important;stroke-width:1.8!important}
    .proTooth.caries path:first-child{fill:#ef4444!important}.proTooth.filling path:first-child{fill:#60a5fa!important}.proTooth.rct path:first-child{fill:#8b5cf6!important}.proTooth.crown path:first-child{fill:#d4af37!important}.proTooth.implant path:first-child{fill:#2dd4bf!important}.proTooth.missing path:first-child{fill:#475569!important;opacity:.45!important}.proTooth.extraction path:first-child{fill:#fb7185!important}
    .quadTabs{display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:8px!important;margin:10px 0 14px!important}
    .quadTabs button{min-height:42px!important;border:none!important;border-radius:15px!important;background:#1f2937!important;color:#e5e7eb!important;font-weight:1000!important}
    .quadTabs button.active{background:linear-gradient(135deg,#f5d76e,#b8860b)!important;color:#050505!important}

    /* Simple photo grid + fullscreen viewer */
    .photoSectionTabs{display:grid!important;grid-template-columns:repeat(2,1fr)!important;gap:8px!important;margin:10px 0!important}
    .photoSectionTabs button{min-height:44px!important;border:none!important;border-radius:14px!important;background:#1f2937!important;color:#e5e7eb!important;font-weight:1000!important}
    .photoSectionTabs button.active{background:linear-gradient(135deg,#f5d76e,#b8860b)!important;color:#050505!important}
    .simplePhotoGrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin:12px 0!important}
    .simplePhotoGrid img{width:100%!important;height:180px!important;object-fit:cover!important;border-radius:16px!important;background:#020617!important;border:1px solid #263241!important}
    .photoGalleryHeader,.premiumPhotoViewer,.photoThumbs{display:none!important}
    .baMorphWrap,.baControlPanel,.baGhostLabel{display:none!important}

    .fullPhotoViewer{position:fixed!important;inset:0!important;background:rgba(0,0,0,.94)!important;z-index:999999!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:16px!important}
    .fullPhotoViewer img{max-width:100%!important;max-height:86vh!important;object-fit:contain!important;border-radius:14px!important}
    .fullPhotoTop{position:absolute!important;top:calc(12px + env(safe-area-inset-top))!important;left:12px!important;right:12px!important;display:flex!important;justify-content:space-between!important;align-items:center!important;z-index:2!important}
    .fullPhotoTop button,.fullPhotoNav button{border:none!important;border-radius:14px!important;background:#1f2937!important;color:white!important;font-weight:1000!important;min-height:44px!important;padding:0 14px!important}
    .fullPhotoNav{position:absolute!important;left:12px!important;right:12px!important;bottom:calc(16px + env(safe-area-inset-bottom))!important;display:flex!important;justify-content:space-between!important;z-index:2!important}

    @media(max-width:480px){
      .brand h1,.brandWrapPremium h1{font-size:38px!important;max-width:210px!important}
      .clinicLogoPremium{width:46px!important;height:46px!important}
      #hamburgerBtn,.hamburgerBtn{width:50px!important;height:50px!important}
      .proMouthChart{height:455px!important}
      .simplePhotoGrid img{height:155px!important}
    }

  
/* FINAL POLISH PATCH */
:root{--accent:#d4af37;--gold:#d4af37;--primary:#d4af37;--theme1:#f5d76e;--theme2:#b8860b}
body.theme-gold{--accent:#d4af37;--gold:#d4af37;--primary:#d4af37;--theme1:#f5d76e;--theme2:#b8860b}
body.theme-pink{--accent:#ff4fa3;--gold:#ff4fa3;--primary:#ff4fa3;--theme1:#ff8ac5;--theme2:#db2777}
body.theme-red{--accent:#ef4444;--gold:#ef4444;--primary:#ef4444;--theme1:#f87171;--theme2:#991b1b}
body.theme-blue{--accent:#3b82f6;--gold:#3b82f6;--primary:#3b82f6;--theme1:#60a5fa;--theme2:#1d4ed8}
body.theme-cyan{--accent:#06b6d4;--gold:#06b6d4;--primary:#06b6d4;--theme1:#22d3ee;--theme2:#0e7490}
body.theme-purple{--accent:#8b5cf6;--gold:#8b5cf6;--primary:#8b5cf6;--theme1:#a78bfa;--theme2:#6d28d9}
body.theme-green{--accent:#22c55e;--gold:#22c55e;--primary:#22c55e;--theme1:#4ade80;--theme2:#15803d}
body.theme-orange{--accent:#f97316;--gold:#f97316;--primary:#f97316;--theme1:#fb923c;--theme2:#c2410c}
.primary,button.primary,.quickActions .primary,.quadTabs button.active,.photoSectionTabs button.active,.drawerMenu button.primaryItem{background:linear-gradient(135deg,var(--theme1),var(--theme2))!important;color:#050505!important}
h2,h3,.sectionTitle,.legendItem,.kv b{color:var(--accent)!important}
.brand,.brandWrapPremium{display:flex!important;align-items:flex-start!important;gap:10px!important;min-width:0!important;max-width:100%!important}
.clinicLogoPremium{width:42px!important;height:42px!important;border-radius:14px!important;display:grid!important;place-items:center!important;background:linear-gradient(135deg,var(--theme1),var(--theme2))!important;color:#050505!important;font-weight:1000!important;font-size:20px!important;overflow:hidden!important;margin-top:4px!important;flex:0 0 auto!important}
.clinicLogoPremium img{width:100%!important;height:100%!important;object-fit:cover!important}
.brand h1,.brandWrapPremium h1{font-size:clamp(30px,7vw,42px)!important;line-height:.95!important;letter-spacing:-1.7px!important;margin:0!important;max-width:165px!important}
.userBox{max-width:105px!important;min-width:92px!important;padding:9px 11px!important;border-radius:19px!important;align-self:start!important;margin-top:0!important}
.userBox strong,.userBox b{font-size:15px!important;line-height:1.05!important}.userBox small{font-size:10px!important}
#refreshBtn{width:48px!important;height:48px!important;border-radius:16px!important}
#logoutBtn{display:none!important}
#hamburgerBtn,.hamburgerBtn{width:48px!important;height:48px!important;border-radius:16px!important;font-size:0!important;position:relative!important;overflow:hidden!important;background:linear-gradient(145deg,#172235,#0d1624)!important;border:1px solid rgba(148,163,184,.22)!important;flex:0 0 auto!important}
#hamburgerBtn::before,.hamburgerBtn::before{content:"Menu"!important;color:#fff!important;font-size:27px!important;font-weight:1000!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif!important}
nav button[onclick*="settings"],.tabs button[onclick*="settings"],.tabBar button[onclick*="settings"],button[data-page="settings"]{display:none!important}
.quickActions button[onclick*="backupData"],.quickActions button[onclick*="restoreBackup"],.quickActions button[onclick*="openThemeMenu"],.quickActions button[onclick*="showPage('settings')"],.quickActions button[onclick*="addUser"],.quickActions button:nth-child(n+5){display:none!important}
.proMouthChart{height:560px!important;border-radius:28px!important;background:radial-gradient(ellipse at 50% 50%,rgba(80,10,25,.22),transparent 34%),linear-gradient(145deg,#050914,#0b1220 55%,#030507)!important;overflow:hidden!important;position:relative!important}
.proMouthChart::before{content:"";position:absolute;left:50%;top:50%;width:250px;height:170px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.55),rgba(0,0,0,.08) 62%,transparent 72%);pointer-events:none;z-index:1}
.proMouthLabel,.proMidLine,.proHorizontalLine,.toothNo{display:none!important}
.proTooth{position:absolute!important;border:none!important;background:transparent!important;padding:0!important;transform:translate(-50%,-50%) rotate(var(--rot,0deg))!important;z-index:5!important;transition:.15s!important;overflow:visible!important}
.proTooth:hover,.proTooth:focus{transform:translate(-50%,-50%) rotate(var(--rot,0deg)) scale(1.16)!important;filter:drop-shadow(0 0 13px var(--accent))!important;z-index:20!important}
.proTooth.hiddenByQuad{opacity:.12!important;pointer-events:none!important;filter:grayscale(1)!important}
.toothArt,.proTooth svg{display:block!important;overflow:visible!important;filter:drop-shadow(0 7px 8px rgba(0,0,0,.35))!important}
.proTooth.incisor .toothArt,.proTooth.incisor svg{width:21px!important;height:41px!important}.proTooth.canine .toothArt,.proTooth.canine svg{width:25px!important;height:43px!important}.proTooth.premolar .toothArt,.proTooth.premolar svg{width:32px!important;height:37px!important}.proTooth.molar .toothArt,.proTooth.molar svg{width:38px!important;height:38px!important}
.proTooth svg path:first-child{stroke-width:1.6!important}
.quadTabs{display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:8px!important;margin:10px 0 14px!important}.quadTabs button{min-height:42px!important;border:none!important;border-radius:15px!important;background:#1f2937!important;color:#e5e7eb!important;font-weight:1000!important}
.photoSectionTabs{display:grid!important;grid-template-columns:repeat(2,1fr)!important;gap:8px!important;margin:10px 0!important}.photoSectionTabs button{min-height:44px!important;border:none!important;border-radius:14px!important;background:#1f2937!important;color:#e5e7eb!important;font-weight:1000!important}
.simplePhotoGrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin:12px 0!important}.simplePhotoGrid img{width:100%!important;height:175px!important;object-fit:cover!important;border-radius:16px!important;background:#020617!important;border:1px solid #263241!important}
.photoGalleryHeader,.premiumPhotoViewer,.photoThumbs{display:none!important}
.fullPhotoViewer{position:fixed!important;inset:0!important;background:rgba(0,0,0,.94)!important;z-index:999999!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:16px!important}.fullPhotoViewer img{max-width:100%!important;max-height:84vh!important;object-fit:contain!important;border-radius:18px!important;box-shadow:0 25px 80px rgba(0,0,0,.55)!important}
.fullPhotoTop{position:absolute!important;top:calc(12px + env(safe-area-inset-top))!important;left:12px!important;right:12px!important;display:flex!important;justify-content:space-between!important;align-items:center!important;z-index:2!important}
.fullPhotoTop button,.fullPhotoNav button{border:none!important;border-radius:16px!important;background:linear-gradient(145deg,#1f2937,#111827)!important;color:white!important;font-weight:1000!important;min-height:48px!important;padding:0 18px!important;box-shadow:0 14px 35px rgba(0,0,0,.36)!important;border:1px solid rgba(255,255,255,.10)!important}
.fullPhotoTop button{width:52px!important;height:52px!important;padding:0!important;background:linear-gradient(135deg,var(--theme1),var(--theme2))!important;color:#050505!important;font-size:28px!important}
.fullPhotoNav{position:absolute!important;left:16px!important;right:16px!important;bottom:calc(18px + env(safe-area-inset-bottom))!important;display:flex!important;justify-content:space-between!important;z-index:2!important}.fullPhotoCounter{color:white!important;font-weight:1000!important;background:rgba(0,0,0,.5)!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:999px!important;padding:8px 12px!important}
.beforeAfterSwipe{position:relative!important;height:340px!important;border-radius:20px!important;overflow:hidden!important;background:#020617!important;border:1px solid rgba(148,163,184,.20)!important;margin:12px 0!important}.beforeAfterSwipe img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:contain!important;filter:none!important}.beforeAfterSwipe .afterClip{position:absolute!important;inset:0!important;clip-path:inset(0 0 0 50%)}.beforeAfterSwipe input{position:absolute!important;left:14px!important;right:14px!important;bottom:16px!important;width:calc(100% - 28px)!important;z-index:3!important}.beforeAfterSwipe .label{position:absolute!important;top:12px!important;z-index:4!important;background:rgba(0,0,0,.55)!important;color:#fff!important;border-radius:999px!important;padding:7px 11px!important;font-weight:1000!important}.beforeAfterSwipe .label.before{left:12px!important}.beforeAfterSwipe .label.after{right:12px!important}
@media(max-width:480px){.brand h1,.brandWrapPremium h1{font-size:32px!important;max-width:150px!important}.clinicLogoPremium{width:38px!important;height:38px!important}.userBox{max-width:100px!important;min-width:88px!important}.proMouthChart{height:475px!important}.simplePhotoGrid img{height:150px!important}}

  
/* FINAL FIX: clean menu button, premium photo controls, new clear dental chart */
#hamburgerBtn,.hamburgerBtn{
  width:auto!important;
  min-width:76px!important;
  height:48px!important;
  padding:0 16px!important;
  border-radius:18px!important;
  font-size:16px!important;
  font-weight:1000!important;
  color:#050505!important;
  background:linear-gradient(135deg,var(--theme1,#f5d76e),var(--theme2,#b8860b))!important;
  border:0!important;
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  letter-spacing:.2px!important;
  box-shadow:0 16px 36px rgba(0,0,0,.35)!important;
}
#hamburgerBtn::before,.hamburgerBtn::before{content:"Menu"!important;font-size:16px!important;color:#050505!important;font-family:inherit!important}

.fullPhotoViewer{background:rgba(0,0,0,.96)!important}
.fullPhotoTop button{
  width:auto!important;
  min-width:86px!important;
  height:50px!important;
  padding:0 18px!important;
  border-radius:18px!important;
  background:linear-gradient(135deg,var(--theme1,#f5d76e),var(--theme2,#b8860b))!important;
  color:#050505!important;
  font-size:15px!important;
  font-weight:1000!important;
}
.fullPhotoTop button::before{content:"Close"!important}
.fullPhotoTop button{font-size:0!important}
.fullPhotoNav button{
  min-width:118px!important;
  height:54px!important;
  border-radius:20px!important;
  background:linear-gradient(145deg,rgba(31,41,55,.96),rgba(15,23,42,.96))!important;
  border:1px solid color-mix(in srgb,var(--accent,#d4af37) 40%, transparent)!important;
  color:#fff!important;
  box-shadow:0 16px 42px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08)!important;
}
.fullPhotoNav button:hover{background:linear-gradient(135deg,var(--theme1,#f5d76e),var(--theme2,#b8860b))!important;color:#050505!important}
.fullPhotoCounter{background:rgba(0,0,0,.62)!important;border-color:rgba(255,255,255,.18)!important}

/* new chart: two clean dental arches, not crowded */
.proMouthChart{
  height:auto!important;
  min-height:0!important;
  padding:20px 12px 24px!important;
  display:grid!important;
  gap:26px!important;
  border-radius:28px!important;
  background:
    radial-gradient(ellipse at 50% 52%,rgba(80,10,25,.18),transparent 40%),
    linear-gradient(145deg,#050914,#0b1220 55%,#030507)!important;
}
.proMouthChart::before,.proMouthChart::after{display:none!important}
.dentalArch{
  position:relative!important;
  height:150px!important;
  border-radius:999px 999px 38px 38px!important;
  background:linear-gradient(180deg,rgba(210,92,100,.82),rgba(132,40,54,.88))!important;
  border:1px solid rgba(255,210,210,.25)!important;
  box-shadow:inset 0 14px 28px rgba(255,255,255,.13), inset 0 -18px 28px rgba(80,0,10,.28), 0 22px 48px rgba(0,0,0,.35)!important;
  margin:0 auto!important;
  width:min(100%,650px)!important;
}
.dentalArch.lower{
  border-radius:38px 38px 999px 999px!important;
  background:linear-gradient(0deg,rgba(210,92,100,.82),rgba(132,40,54,.88))!important;
}
.archLabel{
  position:absolute!important;
  left:50%!important;
  transform:translateX(-50%)!important;
  top:10px!important;
  color:rgba(255,255,255,.72)!important;
  font-size:12px!important;
  font-weight:1000!important;
  letter-spacing:4px!important;
  z-index:2!important;
}
.dentalArch.lower .archLabel{top:auto!important;bottom:10px!important}
.proTooth{
  position:absolute!important;
  border:none!important;
  background:transparent!important;
  padding:0!important;
  transform:translate(-50%,-50%) rotate(var(--rot,0deg))!important;
  z-index:5!important;
}
.proTooth.hiddenByQuad{opacity:.12!important;pointer-events:none!important;filter:grayscale(1)!important}
.proTooth:hover,.proTooth:focus{transform:translate(-50%,-50%) rotate(var(--rot,0deg)) scale(1.16)!important;filter:drop-shadow(0 0 13px var(--accent,#d4af37))!important;z-index:20!important}
.proTooth.incisor .toothArt,.proTooth.incisor svg{width:24px!important;height:54px!important}
.proTooth.canine .toothArt,.proTooth.canine svg{width:30px!important;height:56px!important}
.proTooth.premolar .toothArt,.proTooth.premolar svg{width:39px!important;height:48px!important}
.proTooth.molar .toothArt,.proTooth.molar svg{width:47px!important;height:48px!important}
.toothArt,.proTooth svg{display:block!important;overflow:visible!important;filter:drop-shadow(0 8px 9px rgba(0,0,0,.40))!important}
.proToothSvg path:first-child,.proTooth svg path:first-child{fill:#fff7e6!important;stroke:rgba(255,255,255,.95)!important;stroke-width:1.6!important}
.proTooth.caries path:first-child{fill:#ef4444!important}
.proTooth.filling path:first-child{fill:#60a5fa!important}
.proTooth.rct path:first-child{fill:#8b5cf6!important}
.proTooth.crown path:first-child{fill:#d4af37!important}
.proTooth.implant path:first-child{fill:#2dd4bf!important}
.proTooth.missing path:first-child{fill:#475569!important;opacity:.45!important}
.proTooth.extraction path:first-child{fill:#fb7185!important}
.toothNo{
  display:block!important;
  position:absolute!important;
  left:50%!important;
  top:100%!important;
  transform:translateX(-50%)!important;
  color:#e5e7eb!important;
  font-size:9px!important;
  font-weight:1000!important;
  text-shadow:0 2px 5px #000!important;
}
.dentalArch.lower .toothNo{top:auto!important;bottom:100%!important}
@media(max-width:480px){
  .dentalArch{height:132px!important}
  .proTooth.incisor .toothArt,.proTooth.incisor svg{width:19px!important;height:45px!important}
  .proTooth.canine .toothArt,.proTooth.canine svg{width:24px!important;height:47px!important}
  .proTooth.premolar .toothArt,.proTooth.premolar svg{width:31px!important;height:41px!important}
  .proTooth.molar .toothArt,.proTooth.molar svg{width:36px!important;height:41px!important}
  .toothNo{font-size:8px!important}
}

  
/* HOTFIX: menu no duplicate, visible Close, cleaner orthodontic chart */
#hamburgerBtn,.hamburgerBtn{
  min-width:82px!important;
  width:82px!important;
  height:48px!important;
  padding:0!important;
  border-radius:18px!important;
  font-size:0!important;
  color:transparent!important;
  background:linear-gradient(135deg,var(--theme1,#f5d76e),var(--theme2,#b8860b))!important;
  border:0!important;
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  box-shadow:0 16px 36px rgba(0,0,0,.35)!important;
}
#hamburgerBtn::before,.hamburgerBtn::before{
  content:"Menu"!important;
  font-size:16px!important;
  line-height:1!important;
  color:#050505!important;
  font-weight:1000!important;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif!important;
}

.drawerClose{
  font-size:0!important;
}
.drawerClose::before{
  content:"Ã"!important;
  font-size:26px!important;
  color:#fff!important;
}

.fullPhotoTop button{
  min-width:92px!important;
  width:92px!important;
  height:52px!important;
  border-radius:18px!important;
  padding:0!important;
  font-size:0!important;
  color:transparent!important;
  background:linear-gradient(135deg,var(--theme1,#f5d76e),var(--theme2,#b8860b))!important;
}
.fullPhotoTop button::before{
  content:"Close"!important;
  font-size:15px!important;
  font-weight:1000!important;
  color:#050505!important;
}
.fullPhotoNav button{
  min-width:126px!important;
  height:54px!important;
  border-radius:20px!important;
  background:linear-gradient(145deg,#202b3f,#111827)!important;
  border:1px solid color-mix(in srgb,var(--accent,#d4af37) 48%, transparent)!important;
  color:#fff!important;
  font-weight:1000!important;
  box-shadow:0 18px 42px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.10)!important;
}

/* cleaner two-row dental chart */
.proMouthChart{
  height:auto!important;
  min-height:0!important;
  padding:22px 12px 26px!important;
  display:grid!important;
  gap:34px!important;
  border-radius:28px!important;
  background:
    radial-gradient(ellipse at 50% 52%,rgba(80,10,25,.13),transparent 42%),
    linear-gradient(145deg,#050914,#0b1220 55%,#030507)!important;
}
.proMouthChart::before,.proMouthChart::after{display:none!important}
.dentalArch{
  position:relative!important;
  height:178px!important;
  width:min(100%,650px)!important;
  margin:0 auto!important;
  border-radius:34px!important;
  background:linear-gradient(180deg,rgba(184,73,86,.92),rgba(105,34,47,.95))!important;
  border:1px solid rgba(255,220,220,.22)!important;
  box-shadow:inset 0 16px 24px rgba(255,255,255,.12), inset 0 -18px 28px rgba(80,0,10,.30), 0 22px 48px rgba(0,0,0,.35)!important;
  overflow:visible!important;
}
.dentalArch.upper{
  clip-path:polygon(4% 26%, 9% 13%, 18% 7%, 31% 3%, 50% 0%, 69% 3%, 82% 7%, 91% 13%, 96% 26%, 96% 92%, 4% 92%)!important;
}
.dentalArch.lower{
  clip-path:polygon(4% 8%, 96% 8%, 96% 74%, 91% 87%, 82% 93%, 69% 97%, 50% 100%, 31% 97%, 18% 93%, 9% 87%, 4% 74%)!important;
}
.archLabel{
  position:absolute!important;
  left:50%!important;
  transform:translateX(-50%)!important;
  color:rgba(255,255,255,.75)!important;
  font-size:12px!important;
  font-weight:1000!important;
  letter-spacing:5px!important;
  z-index:2!important;
}
.dentalArch.upper .archLabel{top:18px!important}
.dentalArch.lower .archLabel{bottom:18px!important}

.proTooth{
  position:absolute!important;
  border:none!important;
  background:transparent!important;
  padding:0!important;
  transform:translate(-50%,-50%) rotate(var(--rot,0deg))!important;
  z-index:8!important;
  overflow:visible!important;
  transition:transform .15s ease, filter .15s ease!important;
}
.proTooth:hover,.proTooth:focus{
  transform:translate(-50%,-50%) rotate(var(--rot,0deg)) scale(1.14)!important;
  filter:drop-shadow(0 0 13px var(--accent,#d4af37))!important;
  z-index:20!important;
}
.proTooth.hiddenByQuad{opacity:.12!important;pointer-events:none!important;filter:grayscale(1)!important}
.toothArt,.proTooth svg{display:block!important;overflow:visible!important;filter:drop-shadow(0 7px 8px rgba(0,0,0,.42))!important}
.proTooth.incisor .toothArt,.proTooth.incisor svg{width:18px!important;height:45px!important}
.proTooth.canine .toothArt,.proTooth.canine svg{width:23px!important;height:47px!important}
.proTooth.premolar .toothArt,.proTooth.premolar svg{width:31px!important;height:39px!important}
.proTooth.molar .toothArt,.proTooth.molar svg{width:38px!important;height:40px!important}
.toothNo{
  display:block!important;
  position:absolute!important;
  left:50%!important;
  transform:translateX(-50%)!important;
  color:#fff!important;
  font-size:8px!important;
  font-weight:1000!important;
  text-shadow:0 2px 6px #000!important;
}
.dentalArch.upper .toothNo{top:calc(100% + 2px)!important}
.dentalArch.lower .toothNo{bottom:calc(100% + 2px)!important}
.toothSurfaceText{font-size:7px!important;min-width:17px!important;height:17px!important}

@media(max-width:480px){
  .dentalArch{height:145px!important}
  .proTooth.incisor .toothArt,.proTooth.incisor svg{width:15px!important;height:38px!important}
  .proTooth.canine .toothArt,.proTooth.canine svg{width:19px!important;height:40px!important}
  .proTooth.premolar .toothArt,.proTooth.premolar svg{width:25px!important;height:33px!important}
  .proTooth.molar .toothArt,.proTooth.molar svg{width:30px!important;height:34px!important}
  .toothNo{font-size:7px!important}
}

  
/* FINAL REQUEST: drawer X, selectable before/after, compact clean odontogram */
.drawerClose,
.sideDrawer .drawerClose,
#sideDrawer .drawerClose{
  width:48px!important;
  height:48px!important;
  min-width:48px!important;
  border-radius:16px!important;
  background:linear-gradient(135deg,var(--theme1,#f5d76e),var(--theme2,#b8860b))!important;
  color:#050505!important;
  border:0!important;
  font-size:0!important;
  display:grid!important;
  place-items:center!important;
  padding:0!important;
}
.drawerClose::before,
.sideDrawer .drawerClose::before,
#sideDrawer .drawerClose::before{
  content:"Ã"!important;
  font-size:32px!important;
  line-height:1!important;
  font-weight:1000!important;
  color:#050505!important;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif!important;
}

/* Make chart clinical/simple instead of fake 3D */
.proMouthChart{
  height:auto!important;
  padding:18px 12px 22px!important;
  border-radius:28px!important;
  background:linear-gradient(145deg,#050914,#0b1220 60%,#030507)!important;
  display:grid!important;
  gap:18px!important;
  overflow:hidden!important;
}
.proMouthChart::before,.proMouthChart::after{display:none!important}
.dentalArch{
  position:relative!important;
  width:100%!important;
  max-width:640px!important;
  height:155px!important;
  margin:0 auto!important;
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
  clip-path:none!important;
  overflow:visible!important;
}
.dentalArch::before{
  content:""!important;
  position:absolute!important;
  left:4%!important;
  right:4%!important;
  height:72px!important;
  background:linear-gradient(180deg,rgba(208,92,100,.92),rgba(122,37,50,.96))!important;
  border:1px solid rgba(255,220,220,.24)!important;
  box-shadow:inset 0 16px 24px rgba(255,255,255,.12), inset 0 -14px 22px rgba(70,0,10,.28)!important;
  z-index:1!important;
}
.dentalArch.upper::before{
  top:32px!important;
  border-radius:90px 90px 20px 20px!important;
}
.dentalArch.lower::before{
  bottom:32px!important;
  border-radius:20px 20px 90px 90px!important;
}
.archLabel{
  display:none!important;
}
.proTooth{
  position:absolute!important;
  border:none!important;
  background:transparent!important;
  padding:0!important;
  transform:translate(-50%,-50%) rotate(var(--rot,0deg))!important;
  z-index:6!important;
  overflow:visible!important;
  transition:transform .15s ease, filter .15s ease!important;
}
.proTooth:hover,.proTooth:focus{
  transform:translate(-50%,-50%) rotate(var(--rot,0deg)) scale(1.13)!important;
  filter:drop-shadow(0 0 12px var(--accent,#d4af37))!important;
  z-index:20!important;
}
.proTooth.hiddenByQuad{opacity:.12!important;pointer-events:none!important;filter:grayscale(1)!important}
.toothArt,.proTooth svg{
  display:block!important;
  overflow:visible!important;
  filter:drop-shadow(0 6px 7px rgba(0,0,0,.38))!important;
}
.proTooth.incisor .toothArt,.proTooth.incisor svg{width:16px!important;height:39px!important}
.proTooth.canine .toothArt,.proTooth.canine svg{width:20px!important;height:42px!important}
.proTooth.premolar .toothArt,.proTooth.premolar svg{width:27px!important;height:33px!important}
.proTooth.molar .toothArt,.proTooth.molar svg{width:32px!important;height:34px!important}
.toothNo{
  display:block!important;
  position:absolute!important;
  left:50%!important;
  transform:translateX(-50%)!important;
  color:#fff!important;
  font-size:7px!important;
  font-weight:1000!important;
  text-shadow:0 2px 5px #000!important;
}
.dentalArch.upper .toothNo{top:calc(100% + 1px)!important}
.dentalArch.lower .toothNo{bottom:calc(100% + 1px)!important}

/* Before/After picker */
.baPickerGrid{
  display:grid!important;
  grid-template-columns:repeat(2,1fr)!important;
  gap:10px!important;
  margin:12px 0!important;
  max-height:300px!important;
  overflow:auto!important;
}
.baPickCard{
  border:2px solid rgba(148,163,184,.20)!important;
  border-radius:16px!important;
  overflow:hidden!important;
  background:#020617!important;
  position:relative!important;
}
.baPickCard.selectedBefore{border-color:#22c55e!important;box-shadow:0 0 0 3px rgba(34,197,94,.18)!important}
.baPickCard.selectedAfter{border-color:var(--accent,#d4af37)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent,#d4af37) 20%, transparent)!important}
.baPickCard img{
  width:100%!important;
  height:130px!important;
  object-fit:cover!important;
  display:block!important;
}
.baPickActions{
  display:grid!important;
  grid-template-columns:1fr 1fr!important;
  gap:6px!important;
  padding:8px!important;
}
.baPickActions button{
  min-height:34px!important;
  border:0!important;
  border-radius:10px!important;
  font-weight:1000!important;
  background:#1f2937!important;
  color:#fff!important;
}
.baPickActions button.active{
  background:linear-gradient(135deg,var(--theme1,#f5d76e),var(--theme2,#b8860b))!important;
  color:#050505!important;
}
.beforeAfterSwipe{
  height:330px!important;
}
@media(max-width:480px){
  .dentalArch{height:132px!important}
  .proTooth.incisor .toothArt,.proTooth.incisor svg{width:14px!important;height:34px!important}
  .proTooth.canine .toothArt,.proTooth.canine svg{width:17px!important;height:36px!important}
  .proTooth.premolar .toothArt,.proTooth.premolar svg{width:23px!important;height:29px!important}
  .proTooth.molar .toothArt,.proTooth.molar svg{width:27px!important;height:30px!important}
  .baPickCard img{height:105px!important}
}

  
/* ABSOLUTE FINAL: real X close + no-overlap odontogram grid */
.drawerClose,
.sideDrawer .drawerClose,
#sideDrawer .drawerClose{
  width:48px!important;
  height:48px!important;
  min-width:48px!important;
  border-radius:16px!important;
  background:linear-gradient(135deg,var(--theme1,#f5d76e),var(--theme2,#b8860b))!important;
  color:#050505!important;
  border:0!important;
  font-size:28px!important;
  font-weight:1000!important;
  line-height:1!important;
  display:grid!important;
  place-items:center!important;
  padding:0!important;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif!important;
}
.drawerClose::before,
.sideDrawer .drawerClose::before,
#sideDrawer .drawerClose::before{
  content:""!important;
  display:none!important;
}

/* kill old fake mouth/absolute chart */
.proMouthChart{
  height:auto!important;
  min-height:0!important;
  padding:16px!important;
  border-radius:28px!important;
  background:linear-gradient(145deg,#050914,#0b1220 60%,#030507)!important;
  display:block!important;
  overflow:visible!important;
}
.proMouthChart::before,.proMouthChart::after{display:none!important}
.dentalArch,.dentalArch.upper,.dentalArch.lower{
  height:auto!important;
  width:100%!important;
  max-width:none!important;
  margin:0!important;
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
  clip-path:none!important;
  overflow:visible!important;
}
.dentalArch::before{display:none!important}
.archLabel{display:none!important}

.odontogramWrap{
  display:grid!important;
  gap:18px!important;
}
.odontogramJaw{
  border:1px solid rgba(148,163,184,.16)!important;
  background:linear-gradient(180deg,rgba(15,23,42,.78),rgba(2,6,23,.70))!important;
  border-radius:24px!important;
  padding:14px 10px 12px!important;
}
.odontogramTitle{
  text-align:center!important;
  color:var(--accent,#d4af37)!important;
  font-weight:1000!important;
  letter-spacing:3px!important;
  font-size:12px!important;
  margin-bottom:12px!important;
}
.odontogramRow{
  display:grid!important;
  grid-template-columns:repeat(16,minmax(0,1fr))!important;
  gap:6px!important;
  align-items:end!important;
}
.odontogramRow.lower{
  align-items:start!important;
}
.proTooth{
  position:relative!important;
  left:auto!important;
  top:auto!important;
  border:none!important;
  background:transparent!important;
  padding:0!important;
  transform:none!important;
  z-index:2!important;
  overflow:visible!important;
  min-width:0!important;
  display:grid!important;
  place-items:center!important;
  gap:3px!important;
}
.proTooth:hover,.proTooth:focus{
  transform:scale(1.12)!important;
  filter:drop-shadow(0 0 12px var(--accent,#d4af37))!important;
  z-index:10!important;
}
.proTooth.hiddenByQuad{
  opacity:.16!important;
  pointer-events:none!important;
  filter:grayscale(1)!important;
}
.toothArt,.proTooth svg{
  display:block!important;
  overflow:visible!important;
  filter:drop-shadow(0 5px 6px rgba(0,0,0,.35))!important;
}
.proTooth.incisor .toothArt,.proTooth.incisor svg{width:18px!important;height:38px!important}
.proTooth.canine .toothArt,.proTooth.canine svg{width:21px!important;height:40px!important}
.proTooth.premolar .toothArt,.proTooth.premolar svg{width:27px!important;height:31px!important}
.proTooth.molar .toothArt,.proTooth.molar svg{width:31px!important;height:32px!important}
.toothNo{
  display:block!important;
  position:static!important;
  transform:none!important;
  color:#fff!important;
  font-size:9px!important;
  line-height:1!important;
  font-weight:1000!important;
  text-shadow:0 2px 5px #000!important;
}
.dentalArch.upper .toothNo,.dentalArch.lower .toothNo{
  top:auto!important;
  bottom:auto!important;
}
.toothSurfaceText{
  top:-9px!important;
  right:-4px!important;
  font-size:7px!important;
  min-width:16px!important;
  height:16px!important;
}
@media(max-width:480px){
  .proMouthChart{padding:12px 8px!important}
  .odontogramJaw{padding:12px 7px 10px!important}
  .odontogramRow{gap:3px!important}
  .proTooth.incisor .toothArt,.proTooth.incisor svg{width:13px!important;height:31px!important}
  .proTooth.canine .toothArt,.proTooth.canine svg{width:16px!important;height:33px!important}
  .proTooth.premolar .toothArt,.proTooth.premolar svg{width:21px!important;height:25px!important}
  .proTooth.molar .toothArt,.proTooth.molar svg{width:24px!important;height:26px!important}
  .toothNo{font-size:7px!important}
}

  
/* FINAL TIDY: true drawer X + prettier odontogram */
.drawerClose,
.sideDrawer .drawerClose,
#sideDrawer .drawerClose{
  width:48px!important;
  height:48px!important;
  min-width:48px!important;
  border-radius:16px!important;
  background:linear-gradient(135deg,var(--theme1,#f5d76e),var(--theme2,#b8860b))!important;
  color:#050505!important;
  border:0!important;
  font-size:30px!important;
  font-weight:1000!important;
  line-height:1!important;
  display:grid!important;
  place-items:center!important;
  padding:0!important;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif!important;
  text-indent:0!important;
  overflow:hidden!important;
}
.drawerClose::before,
.drawerClose::after,
.sideDrawer .drawerClose::before,
.sideDrawer .drawerClose::after,
#sideDrawer .drawerClose::before,
#sideDrawer .drawerClose::after{
  content:""!important;
  display:none!important;
}

/* tooth chart: clear two clinical rows, less crowding, centered */
.proMouthChart{
  height:auto!important;
  padding:18px 14px 20px!important;
  border-radius:28px!important;
  background:
    radial-gradient(ellipse at 50% 50%, rgba(8,145,178,.10), transparent 42%),
    linear-gradient(145deg,#050914,#0b1220 60%,#030507)!important;
  display:block!important;
  overflow:visible!important;
}
.proMouthChart::before,.proMouthChart::after{display:none!important}

.odontogramWrap{
  display:grid!important;
  gap:22px!important;
}
.odontogramJaw{
  border:1px solid rgba(148,163,184,.16)!important;
  background:linear-gradient(180deg,rgba(15,23,42,.82),rgba(2,6,23,.72))!important;
  border-radius:24px!important;
  padding:16px 12px 14px!important;
  overflow:visible!important;
}
.odontogramTitle{
  text-align:center!important;
  color:var(--accent,#d4af37)!important;
  font-weight:1000!important;
  letter-spacing:4px!important;
  font-size:13px!important;
  margin-bottom:14px!important;
}
.odontogramRow{
  display:grid!important;
  grid-template-columns:
    1.18fr 1.18fr 1.18fr 1fr 1fr .82fr .72fr .72fr
    .72fr .72fr .82fr 1fr 1fr 1.18fr 1.18fr 1.18fr!important;
  gap:8px!important;
  align-items:end!important;
  justify-items:center!important;
}
.odontogramRow.lower{align-items:start!important}

.dentalArch,.dentalArch.upper,.dentalArch.lower{
  height:auto!important;
  width:100%!important;
  max-width:none!important;
  margin:0!important;
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
  clip-path:none!important;
  overflow:visible!important;
}
.dentalArch::before{display:none!important}
.archLabel{display:none!important}

.proTooth{
  position:relative!important;
  left:auto!important;
  top:auto!important;
  border:0!important;
  background:transparent!important;
  padding:0!important;
  transform:none!important;
  z-index:2!important;
  display:grid!important;
  place-items:center!important;
  gap:4px!important;
  min-width:0!important;
  overflow:visible!important;
}
.proTooth:hover,.proTooth:focus{
  transform:scale(1.12)!important;
  filter:drop-shadow(0 0 12px var(--accent,#d4af37))!important;
  z-index:10!important;
}
.proTooth.hiddenByQuad{opacity:.16!important;pointer-events:none!important;filter:grayscale(1)!important}
.toothArt,.proTooth svg{
  display:block!important;
  overflow:visible!important;
  filter:drop-shadow(0 5px 6px rgba(0,0,0,.36))!important;
}
.proTooth.incisor .toothArt,.proTooth.incisor svg{width:20px!important;height:42px!important}
.proTooth.canine .toothArt,.proTooth.canine svg{width:23px!important;height:44px!important}
.proTooth.premolar .toothArt,.proTooth.premolar svg{width:30px!important;height:34px!important}
.proTooth.molar .toothArt,.proTooth.molar svg{width:36px!important;height:35px!important}
.toothNo{
  display:block!important;
  position:static!important;
  transform:none!important;
  color:#f8fafc!important;
  font-size:10px!important;
  line-height:1!important;
  font-weight:1000!important;
  text-shadow:0 2px 5px #000!important;
}
.toothSurfaceText{
  top:-10px!important;
  right:-5px!important;
  font-size:8px!important;
  min-width:18px!important;
  height:18px!important;
}
@media(max-width:480px){
  .proMouthChart{padding:12px 8px 14px!important}
  .odontogramJaw{padding:13px 7px 11px!important}
  .odontogramRow{gap:4px!important}
  .proTooth.incisor .toothArt,.proTooth.incisor svg{width:15px!important;height:34px!important}
  .proTooth.canine .toothArt,.proTooth.canine svg{width:17px!important;height:36px!important}
  .proTooth.premolar .toothArt,.proTooth.premolar svg{width:23px!important;height:28px!important}
  .proTooth.molar .toothArt,.proTooth.molar svg{width:27px!important;height:29px!important}
  .toothNo{font-size:8px!important}
}

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
    cachePatientsOffline();
    if ($("status")) $("status").textContent = "Cloud connected";
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

function buildWhatsAppReminder(patient) {
  const phone = normalizePhoneForWhatsApp(patient.phone || "");
  if (!phone) return null;

  const clinicName = currentUser?.clinic_name || "Masri Dental Clinic";
  const data = parseClinicData(patient.progress_notes);
  const next = nextAppointmentInfo(data);
  const appointmentLine = next?.date ? `\nYour next appointment: ${next.date}` : "";

  const message = `Hello ${patient.name || ""}, this is ${clinicName}. This is a reminder from the clinic.${appointmentLine}`;
  const encoded = encodeURIComponent(message);

  return {
    phone,
    message,
    appUrl: `whatsapp://send?phone=${phone}&text=${encoded}`,
    webUrl: `https://wa.me/${phone}?text=${encoded}`
  };
}

window.openWhatsAppReminder = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");

  const reminder = buildWhatsAppReminder(p);
  if (!reminder) return alert("No valid phone number for this patient.");

  document.getElementById("whatsappModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "whatsappModal";
  modal.className = "luxuryModal";
  modal.innerHTML = `
    <div class="luxuryBox">
      <h2>WhatsApp Reminder</h2>
      <p style="white-space:pre-wrap;text-align:left;">${safeText(reminder.message)}</p>
      <div class="luxuryActions">
        <button type="button" class="secondary" id="copyWhatsappMsg">Copy</button>
        <button type="button" class="primary" id="openWhatsappApp">Open WhatsApp</button>
      </div>
      <div class="luxuryActions" style="margin-top:10px;">
        <button type="button" class="secondary" id="closeWhatsappModal">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("#closeWhatsappModal").onclick = () => modal.remove();

  modal.querySelector("#copyWhatsappMsg").onclick = async () => {
    try {
      await navigator.clipboard.writeText(reminder.message);
      await luxuryConfirm("Copied", "Reminder message copied.");
    } catch {
      alert(reminder.message);
    }
  };

  modal.querySelector("#openWhatsappApp").onclick = () => {
    // Use the WhatsApp app deep-link only. This avoids leaving the clinic app on a Safari wa.me page.
    window.location.href = reminder.appUrl;
  };
};

// Backward-compatible name used by the patient button.
window.sendWhatsAppReminder = window.openWhatsAppReminder;



window.setClinicTheme = function(theme) {
  document.body.classList.remove("themeGold", "themeMidnight", "themeEmerald", "lightMode");
  if (theme === "gold") document.body.classList.add("themeGold");
  if (theme === "midnight") document.body.classList.add("themeMidnight");
  if (theme === "emerald") document.body.classList.add("themeEmerald");
  if (theme === "light") document.body.classList.add("lightMode");
  localStorage.setItem("clinicThemeName", theme);
};

function applyClinicTheme() {
  const theme = localStorage.getItem("clinicThemeName") || localStorage.getItem("clinicTheme") || "gold";
  window.setClinicTheme(theme === "dark" ? "gold" : theme);
}

window.openThemePicker = function() {
  const modal = document.createElement("div");
  modal.className = "luxuryModal";
  modal.innerHTML = `
    <div class="luxuryBox">
      <h2>Luxury Theme</h2>
      <div class="themePicker">
        <button onclick="setClinicTheme('gold');this.closest('.luxuryModal').remove()">Gold</button>
        <button onclick="setClinicTheme('midnight');this.closest('.luxuryModal').remove()">Midnight</button>
        <button onclick="setClinicTheme('emerald');this.closest('.luxuryModal').remove()">Emerald</button>
        <button onclick="setClinicTheme('light');this.closest('.luxuryModal').remove()">Light</button>
      </div>
      <button class="secondary" onclick="this.closest('.luxuryModal').remove()">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);
};



window.addInventoryItem = async function() {
  const name = await luxuryPrompt("Inventory item", "Composite / Anesthesia / Implant kit");
  if (!name) return;
  const qty = await luxuryPrompt("Quantity", "Example: 10", "1");
  const items = JSON.parse(localStorage.getItem("clinicInventory") || "[]");
  items.push({ name, qty: qty || "1", created_at: new Date().toISOString() });
  localStorage.setItem("clinicInventory", JSON.stringify(items));
  renderDashboard();
};

window.removeInventoryItem = function(index) {
  const items = JSON.parse(localStorage.getItem("clinicInventory") || "[]");
  items.splice(index, 1);
  localStorage.setItem("clinicInventory", JSON.stringify(items));
  renderDashboard();
};


window.editLabWork = async function(patientId, index) {
  const lab = JSON.parse(localStorage.getItem("clinicLab") || "[]");
  if (!lab[index]) return;
  const item = await luxuryPrompt("Lab work", "Crown / Bridge / Night guard", lab[index].item || "");
  if (!item) return;
  const status = await luxuryPrompt("Lab status", "Sent / Waiting / Returned / Delivered", lab[index].status || "Sent");
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
  if (!(await luxuryConfirm("Delete lab work?", "This will remove the lab item."))) return;
  lab.splice(index, 1);
  localStorage.setItem("clinicLab", JSON.stringify(lab));
  await refreshPatientKeepingScroll(patientId);
};

window.addLabWork = async function(id) {
  const item = await luxuryPrompt("Lab work", "Crown / Bridge / Night guard");
  if (!item) return;
  const status = await luxuryPrompt("Lab status", "Sent / Waiting / Returned", "Sent");
  const lab = JSON.parse(localStorage.getItem("clinicLab") || "[]");
  lab.push({ patientId:id, item, status, created_at:new Date().toISOString() });
  localStorage.setItem("clinicLab", JSON.stringify(lab));
  await refreshPatientKeepingScroll(id);
};


window.closePremiumDoc = function() {
  document.getElementById("premiumDocModal")?.remove();
};

function openPremiumDocument(title, bodyHtml) {
  document.getElementById("premiumDocModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "premiumDocModal";
  modal.className = "premiumDocBackdrop";
  modal.innerHTML = `
    <div class="premiumDocActions">
      <button type="button" class="closeDoc" onclick="closePremiumDoc()">Cancel / Close</button>
      <button type="button" class="printDoc" onclick="window.print()">Print / Save PDF</button>
    </div>
    <div class="premiumDoc">
      ${bodyHtml}
    </div>
  `;

  document.body.appendChild(modal);
}


window.generateConsentForm = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;

  const type = await luxuryPrompt(
    "Consent type",
    "extraction / rct / implant / crown",
    "extraction"
  );

  if (!type) return;

  const clinicName = currentUser?.clinic_name || "Masri Dental Clinic";

  openPremiumDocument("Consent Form", `
    <h1>${safeText(clinicName)}</h1>
    <p style="color:#b8860b;font-weight:900;margin-top:6px;">Dental consent document</p>

    <h2>${safeText(type.toUpperCase())} Consent Form</h2>

    <div class="premiumDocBox">
      <b>Patient:</b> ${safeText(p.name || "-")}<br>
      <b>ID:</b> ${safeText(p.case_id || p.id)}<br>
      <b>Phone:</b> ${safeText(p.phone || "-")}
    </div>

    <div class="premiumDocBox">
      I acknowledge that the planned dental treatment, alternatives, benefits,
      risks, and possible complications have been explained to me. I had the
      chance to ask questions and agree to proceed.
    </div>

    <div class="premiumDocBox">
      <b>Treatment:</b> ${safeText(type)}<br>
      <b>Diagnosis:</b> ${safeText(p.diagnosis || "-")}<br>
      <b>Treatment plan:</b> ${safeText(p.treatment_plan || "-")}
    </div>

    <br><br>
    <p>Patient signature: ________________________</p>
    <p>Doctor signature: ________________________</p>
    <p>Date: ________________________</p>
  `);
};

window.generatePrescription = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;

  const type = await luxuryPrompt(
    "Prescription type",
    "pain / infection / extraction / implant",
    "pain"
  );

  if (!type) return;

  let meds = "Analgesic as prescribed\nFollow doctor's instructions";
  if (type.toLowerCase().includes("infection")) {
    meds = "Antibiotic as prescribed\nAnalgesic as needed\nWarm saline rinse";
  }
  if (type.toLowerCase().includes("extraction")) {
    meds = "Analgesic as prescribed\nPost-operative instructions\nAvoid smoking and vigorous rinsing for 24 hours";
  }
  if (type.toLowerCase().includes("implant")) {
    meds = "Analgesic as prescribed\nAntibiotic as prescribed if indicated\nCold packs for the first day\nFollow-up appointment";
  }

  const clinicName = currentUser?.clinic_name || "Masri Dental Clinic";

  openPremiumDocument("Prescription", `
    <h1>${safeText(clinicName)}</h1>
    <p style="color:#b8860b;font-weight:900;margin-top:6px;">Dental prescription</p>

    <h2>Prescription</h2>

    <div class="premiumDocBox">
      <b>Patient:</b> ${safeText(p.name || "-")}<br>
      <b>ID:</b> ${safeText(p.case_id || p.id)}<br>
      <b>Date:</b> ${new Date().toLocaleString()}
    </div>

    <div style="font-size:48px;font-weight:1000;color:#b8860b;margin:18px 0;">Rx</div>

    <div class="premiumDocBox" style="white-space:pre-wrap;font-size:18px;">
      ${safeText(meds)}
    </div>

    <br><br>
    <p>Doctor signature: ________________________</p>
  `);
};

window.generateSmartNote = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const keyword = await luxuryPrompt("Smart note", "extraction / rct / crown / scaling / filling", "follow-up");
  if (!keyword) return;
  const k = keyword.toLowerCase();
  let note = "Follow-up visit completed. Patient progress reviewed and instructions explained.";
  if (k.includes("extraction")) note = "Extraction completed atraumatically. Hemostasis achieved. Post-operative instructions explained.";
  if (k.includes("rct")) note = "RCT visit completed: canal preparation/irrigation performed, temporary restoration placed, next visit planned.";
  if (k.includes("crown")) note = "Crown procedure visit completed. Margins, occlusion and shade were reviewed.";
  if (k.includes("scaling")) note = "Scaling and oral hygiene instructions completed. Patient advised for maintenance visit.";
  if (k.includes("filling")) note = "Caries removed and restoration placed. Occlusion checked and polished.";
  const data = parseClinicData(p.progress_notes);
  data.visits.unshift({ date:new Date().toLocaleString(), treatment:keyword, note });
  await api(`patients?id=eq.${id}`, { method:"PATCH", body:JSON.stringify({ progress_notes:saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
};

window.setCasePriority = async function(id) {
  const priority = await luxuryPrompt("Case priority", "urgent / medium / routine", "routine");
  if (!priority) return;
  await api(`patients?id=eq.${id}`, { method:"PATCH", body:JSON.stringify({ priority }) });
  await refreshPatientKeepingScroll(id);
};

window.addInstallmentPlan = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const total = await luxuryPrompt("Installment total", "Example: 10000");
  if (!total) return;
  const first = await luxuryPrompt("First payment", "Example: 2000", "0");
  const data = parseClinicData(p.progress_notes);
  data.payments.unshift({ date:new Date().toLocaleString(), total:Number(total||0), paid:Number(first||0), note:"Installment plan" });
  await api(`patients?id=eq.${id}`, { method:"PATCH", body:JSON.stringify({ progress_notes:saveClinicData(data) }) });
  await refreshPatientKeepingScroll(id);
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


function renderAppointmentCalendar() {
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
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push({ id: p.id, patient: p.name || "Patient", note: a.note || "", status: a.status || "pending" });
      }
    });
  });

  return `<div class="calendarBoard">
    ${Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      const list = map[day] || [];
      const cls = list.length ? appointmentStatusColor(list[0].status) : "";
      return `<button class="calendarCell ${list.length ? "hasAppt" : ""} ${cls}" onclick="${list[0] ? `openPatient('${list[0].id}')` : ""}">
        ${day}
        ${list.length ? `<small>${list.length} appt</small>` : ""}
      </button>`;
    }).join("")}
  </div>`;
}

function renderInventoryMini() {
  const items = JSON.parse(localStorage.getItem("clinicInventory") || "[]");
  return items.length ? items.map((it, i) => `
    <div class="inventoryRow">
      <b>${safeText(it.name)}</b>
      <span class="pill">${safeText(it.qty)} left</span>
      <button class="secondary" onclick="removeInventoryItem(${i})">Remove</button>
    </div>
  `).join("") : `<p style="color:var(--muted);font-weight:800">No inventory items yet</p>`;
}

window.addInventoryItem = async function() {
  const name = await luxuryPrompt("Inventory item", "Composite / Anesthesia / Implant kit");
  if (!name) return;
  const qty = await luxuryPrompt("Quantity", "Example: 10", "1");
  const items = JSON.parse(localStorage.getItem("clinicInventory") || "[]");
  items.push({ name, qty: qty || "1", created_at: new Date().toISOString() });
  localStorage.setItem("clinicInventory", JSON.stringify(items));
  renderDashboard();
};

window.removeInventoryItem = function(index) {
  const items = JSON.parse(localStorage.getItem("clinicInventory") || "[]");
  items.splice(index, 1);
  localStorage.setItem("clinicInventory", JSON.stringify(items));
  renderDashboard();
};

function smartSearchInfo() {
  return "Search examples: unpaid, vip, high risk, crown, implant, rct, extraction, phone, patient ID, appointment";
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
      <button class="secondary" onclick="restoreBackup()">Restore</button><button class="secondary" onclick="openDoctorProfile()">Profile</button><button class="secondary" onclick="sendTomorrowReminders()">Reminders</button><button class="secondary" onclick="exportDailyBackup()">Daily Backup</button>${currentUser?.role === "admin" ? `<button class="secondary" onclick="manageUsers()">Users</button>` : ""}<button class="secondary" onclick="openThemePicker()">Theme</button>
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
      <h2>Treatment Stats</h2>
      ${Object.keys(treatmentStats()).length ? Object.entries(treatmentStats()).map(([k,v]) => `<span class="premiumChip">${safeText(k.toUpperCase())}: ${v}</span>`).join(" ") : `<p style="color:var(--muted);font-weight:800">No treatment stats yet</p>`}
    </div>

    
    
    <div class="dashboardPanel">
      <h2>Clinic Analytics</h2>
      ${clinicAnalyticsHTML()}
    </div>

<div class="dashboardPanel">
      <h2>Finance Pro</h2>
      ${financeProHTML()}
    </div>

    <div class="dashboardPanel">
      <h2>Appointment Calendar</h2>
      ${renderAppointmentCalendar()}
    </div>

    <div class="dashboardPanel">
      <h2>Inventory</h2>
      <button class="secondary" onclick="addInventoryItem()">+ Add inventory</button>
      ${renderInventoryMini()}
    </div>

    
    
    <div class="dashboardPanel">
      <h2>Smart Search Pro</h2>
      <p class="smartSearchHint">${smartSearchInfo()}</p>
    </div>

    ${dashboardPanel("Waiting List", patients.flatMap(p => {
      const data = parseClinicData(p.progress_notes);
      return (data.appointments || [])
        .filter(a => String(a.status || "").toLowerCase().includes("waiting"))
        .map(a => ({ patient: p.name || "Patient", phone: p.phone || "", date: a.date || "", note: a.note || "Waiting list", id: p.id }));
    }), "No waiting list patients")}

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
        <button class="primary" type="button" data-open-patient="${p.id}">Open</button>
        ${canEdit() ? `<button class="secondary" type="button" data-edit-patient="${p.id}">Edit</button>` : ""}
        <button class="secondary" type="button" data-qr-patient="${p.id}">QR</button>
        <button class="secondary whatsappBtn" type="button" data-wa-patient="${p.id}">WhatsApp</button>
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
    return `<svg viewBox="-50 -65 100 130" class="proToothSvg">
      <path d="M-18,-42 C-13,-57 13,-57 18,-42 C24,-12 18,24 8,48 C4,59 -4,59 -8,48 C-18,24 -24,-12 -18,-42 Z"/>
      <path class="shine" d="M-7,-34 C-11,-10 -9,18 -4,38"/>
      <path class="surfaceMark" d="M0,-35 C-2,-10 -2,18 0,42"/>
    </svg>`;
  }

  if (type === "canine") {
    return `<svg viewBox="-50 -65 100 130" class="proToothSvg">
      <path d="M-22,-39 C-14,-58 14,-58 22,-39 C31,-12 17,24 7,48 C3,59 -4,61 -9,48 C-24,18 -31,-12 -22,-39 Z"/>
      <path class="shine" d="M-9,-31 C-15,-6 -11,20 -5,38"/>
      <path class="surfaceMark" d="M4,-34 C0,-10 -2,18 -5,43"/>
    </svg>`;
  }

  return `<svg viewBox="-64 -58 128 116" class="proToothSvg">
    <path d="M-38,-25 C-31,-49 -10,-48 0,-34 C11,-49 33,-47 39,-24 C48,5 37,34 18,47 C8,55 -5,47 0,28 C-10,51 -31,57 -42,33 C-53,8 -51,-9 -38,-25 Z"/>
    <path class="surfaceMark" d="M-24,-9 C-8,5 12,5 30,-9"/>
    <path class="surfaceMark" d="M-30,16 C-9,8 14,9 31,18"/>
    <path class="surfaceMark" d="M0,-29 C-4,-5 -3,17 0,37"/>
    <path class="shine" d="M-26,-23 C-32,-7 -27,9 -18,19"/>
  </svg>`;
}

function getToothType(n) {
  n = Number(n);
  if ([11,12,21,22,31,32,41,42].includes(n)) return "incisor";
  if ([13,23,33,43].includes(n)) return "canine";
  return "molar";
}


window.setQuadrantFilter = function(q) {
  const map = {
    all: n => true,
    upperR: n => n >= 11 && n <= 18,
    upperL: n => n >= 21 && n <= 28,
    lowerL: n => n >= 31 && n <= 38,
    lowerR: n => n >= 41 && n <= 48
  };
  const fn = map[q] || map.all;
  document.querySelectorAll(".proTooth").forEach(btn => {
    const n = Number(btn.getAttribute("data-tooth") || btn.dataset.tooth || 0);
    btn.classList.toggle("hiddenByQuad", !fn(n));
  });
  document.querySelectorAll(".quadTabs button").forEach(b => b.classList.toggle("active", b.getAttribute("data-quad") === q));
};


function toothExtraOverlay(status) {
  if (status === "rct") {
    return `<svg viewBox="-40 -50 80 100" style="position:absolute;inset:6px;width:40px;height:48px;pointer-events:none;">
      <path class="toothRootLine" d="M-8,-8 C-8,12 -10,26 -15,42"/>
      <path class="toothRootLine" d="M8,-8 C8,12 10,26 15,42"/>
    </svg>`;
  }
  if (status === "implant") {
    return `<svg viewBox="-40 -50 80 100" style="position:absolute;inset:6px;width:40px;height:48px;pointer-events:none;">
      <path class="implantPost" d="M0,-2 L0,42"/>
      <path class="implantPost" d="M-10,14 L10,14"/>
      <path class="implantPost" d="M-8,26 L8,26"/>
    </svg>`;
  }
  return "";
}

function renderToothChart(p) {
  const data = parseClinicData(p.progress_notes);
  const teeth = data.teeth || {};
  const upper = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const lower = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

  const toothButton = (n) => {
    const toothInfo = teeth[n] || "healthy";
    const status = typeof toothInfo === "string" ? toothInfo : (toothInfo.status || "healthy");
    const surfaces = typeof toothInfo === "string" ? [] : (toothInfo.surfaces || []);
    const type = getToothType(n);

    return `
      <button type="button" class="proTooth ${safeText(status)} ${type}" data-tooth="${n}" onclick="window.openToothPopup('${p.id}', '${n}')">
        <span class="toothArt">${toothSvg(type)}${surfaceOverlayHTML(toothInfo)}${toothExtraOverlay(status)}</span>
        <span class="toothNo">${n}</span>${surfaces.length ? `<span class="toothSurfaceText">${safeText(surfaces.join(""))}</span>` : ""}
      </button>`;
  };

  return `
    <div class="quadTabs">
      <button class="active" data-quad="all" onclick="setQuadrantFilter('all')">All</button>
      <button data-quad="upperR" onclick="setQuadrantFilter('upperR')">UR</button>
      <button data-quad="upperL" onclick="setQuadrantFilter('upperL')">UL</button>
      <button data-quad="lowerL" onclick="setQuadrantFilter('lowerL')">LL</button>
      <button data-quad="lowerR" onclick="setQuadrantFilter('lowerR')">LR</button>
    </div>
    <div class="proMouthChart">
      <div class="odontogramWrap">
        <div class="odontogramJaw dentalArch upper">
          <div class="odontogramTitle">UPPER</div>
          <div class="odontogramRow">${upper.map(toothButton).join("")}</div>
        </div>
        <div class="odontogramJaw dentalArch lower">
          <div class="odontogramTitle">LOWER</div>
          <div class="odontogramRow lower">${lower.map(toothButton).join("")}</div>
        </div>
      </div>
    </div>`;
}
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
  const completed = String(patient.status || "").toLowerCase().includes("complete") || String(patient.treatment_plan || "").toLowerCase().includes("complete") || visits.some(v => String(v.note || v.treatment || "").toLowerCase().includes("complete"));
  items.push({ name: "Completed", state: completed ? "done" : "pending" });
  return items;
}

function medicalAlertBanner(patient) {
  const text = `${patient.medical_alerts || ""}`.trim();
  if (!text || text === "-" || /^n\/?a$/i.test(text) || /^nad$/i.test(text) || /^none$/i.test(text) || /^no$/i.test(text)) return "";
  return `<div class="alertBanner">Medical alert: ${safeText(text)}</div>`;
}

function renderTreatmentProgress(patient) {
  return `<div class="progressSteps">
    ${treatmentProgressItems(patient).map(s => `
      <div class="progressStep ${s.state}">
        <span>${s.state === "done" ? "Done" : s.state === "active" ? "Current" : "Pending"} - ${safeText(s.name)}</span>
        <span>${s.state === "done" ? "Done" : s.state === "active" ? "Current" : "Pending"}</span>
      </div>
    `).join("")}
  </div>`;
}

function renderLabMini(patientId) {
  const lab = JSON.parse(localStorage.getItem("clinicLab") || "[]")
    .map((x, i) => ({ ...x, index: i }))
    .filter(x => x.patientId === patientId);

  return lab.length ? lab.map(it => `
    <div class="labRow">
      <b>${safeText(it.item || "Lab work")}</b>
      <span class="pill">${safeText(it.status || "Sent")}</span>
      ${typeof labStepHTML === "function" ? labStepHTML(it.status || "Sent") : ""}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button class="secondary" onclick="editLabWork('${patientId}', ${it.index})">Edit</button>
        <button class="danger" onclick="deleteLabWork('${patientId}', ${it.index})">Delete</button>
      </div>
    </div>
  `).join("") : `<p style="color:var(--muted);font-weight:800">No lab work yet</p>`;
}

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
  if (!(await luxuryConfirm("Delete lab work?", "This will remove the lab item."))) return;
  lab.splice(index, 1);
  localStorage.setItem("clinicLab", JSON.stringify(lab));
  await refreshPatientKeepingScroll(patientId);
};



function patientProfilePhoto(patient) {
  const data = parseClinicData(patient.progress_notes);
  return data.profile_photo || (patient.photos || []).map(photoUrl).filter(Boolean)[0] || "";
}

window.changePatientProfilePhoto = async function(patientId) {
  const p = patients.find(x => x.id === patientId);
  if (!p) return;
  const photos = (p.photos || []).map(photoUrl).filter(Boolean);
  if (!photos.length) return alert("Add patient photos first, then choose one as profile photo.");

  const modal = document.createElement("div");
  modal.className = "luxuryModal";
  modal.innerHTML = `
    <div class="luxuryBox" style="max-width:720px;">
      <h2>Choose patient profile photo</h2>
      <div class="photoThumbs" style="display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:10px!important;overflow:visible!important;">
        ${photos.map(u => `<img src="${u}" style="width:100%!important;height:120px!important;object-fit:cover!important;border-radius:14px!important;" onclick="savePatientProfilePhoto('${patientId}', '${encodeURIComponent(u)}')">`).join("")}
      </div>
      <button class="secondary" style="width:100%;margin-top:12px;" onclick="this.closest('.luxuryModal').remove()">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);
};

window.savePatientProfilePhoto = async function(patientId, encodedUrl) {
  const p = patients.find(x => x.id === patientId);
  if (!p) return;

  const data = parseClinicData(p.progress_notes);
  data.profile_photo = decodeURIComponent(encodedUrl);

  await api(`patients?id=eq.${patientId}`, {
    method: "PATCH",
    body: JSON.stringify({ progress_notes: saveClinicData(data) })
  });

  document.querySelector(".luxuryModal")?.remove();
  await refreshPatientKeepingScroll(patientId);
};

function categorizedPhotos(patient) {
  const photos = (patient.photos || []).map((x, i) => ({
    url: photoUrl(x),
    category: String(x?.category || "").toLowerCase(),
    name: String(x?.name || x?.filename || "").toLowerCase(),
    index: i
  })).filter(x => x.url);

  const xrays = photos.filter(x =>
    x.category.includes("x") ||
    x.name.includes("xray") ||
    x.name.includes("x-ray") ||
    x.name.includes("radiograph")
  );

  const clinical = photos.filter(x => !xrays.includes(x));
  return { clinical, xrays };
}

window.photoGalleryState = window.photoGalleryState || {};

function renderPhotoGalleryPro(patient, type = "clinical") {
  const cats = categorizedPhotos(patient);
  const list = type === "xray" ? cats.xrays : cats.clinical;
  const fallback = type === "xray" ? cats.clinical : cats.xrays;
  const photos = list.length ? list : fallback;

  if (!photos.length) return `<p style="color:var(--muted);font-weight:800">No photos yet</p>`;

  const key = `${patient.id}-${type}`;
  const current = Math.min(window.photoGalleryState[key] || 0, photos.length - 1);
  const img = photos[current];

  return `
    <div class="photoSectionTabs">
      <button class="${type === "clinical" ? "active" : ""}" onclick="switchPhotoType('${patient.id}','clinical')">Clinical</button>
      <button class="${type === "xray" ? "active" : ""}" onclick="switchPhotoType('${patient.id}','xray')">X-ray</button>
    </div>

    <div class="photoGalleryHeader">
      <h3>${type === "xray" ? "X-ray Gallery" : "Clinical Gallery"}</h3>
      <div class="galleryControls">
        <button onclick="movePhotoGallery('${patient.id}','${type}',-1)">Prev</button>
        <button onclick="movePhotoGallery('${patient.id}','${type}',1)">Next</button>
      </div>
    </div>

    <div class="premiumPhotoViewer">
      <img src="${img.url}" onclick="openPhotoZoom('${img.url}')">
      <span class="photoTag">${current + 1} / ${photos.length}</span>
    </div>

    <div class="photoThumbs">
      ${photos.map((p, i) => `<img class="${i === current ? "active" : ""}" src="${p.url}" onclick="setPhotoGalleryIndex('${patient.id}','${type}',${i})">`).join("")}
    </div>
  `;
}

window.switchPhotoType = function(patientId, type) {
  const p = patients.find(x => x.id === patientId);
  if (!p) return;

  const target = document.getElementById("photoGalleryProBox");
  if (target) target.innerHTML = renderPhotoGalleryPro(p, type);
};

window.setPhotoGalleryIndex = function(patientId, type, index) {
  window.photoGalleryState[`${patientId}-${type}`] = index;
  switchPhotoType(patientId, type);
};

window.movePhotoGallery = function(patientId, type, step) {
  const p = patients.find(x => x.id === patientId);
  if (!p) return;

  const cats = categorizedPhotos(p);
  const list = type === "xray" ? cats.xrays : cats.clinical;
  const fallback = type === "xray" ? cats.clinical : cats.xrays;
  const photos = list.length ? list : fallback;

  if (!photos.length) return;

  const key = `${patientId}-${type}`;
  const current = window.photoGalleryState[key] || 0;
  window.photoGalleryState[key] = (current + step + photos.length) % photos.length;
  switchPhotoType(patientId, type);
};

window.openPhotoZoom = function(url) {
  document.getElementById("photoZoomOverlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "zoomOverlay";
  overlay.id = "photoZoomOverlay";
  overlay.dataset.scale = "1";
  overlay.style.setProperty("--zoomScale", "1");
  overlay.innerHTML = `
    <div class="zoomToolbar">
      <button onclick="zoomPhoto(-0.25)">-</button>
      <button onclick="zoomPhoto(0.25)">+</button>
      <button onclick="resetPhotoZoom()">Reset</button>
      <button onclick="closePhotoZoom()">Close</button>
    </div>
    <img src="${url}">
  `;

  document.body.appendChild(overlay);
};

window.zoomPhoto = function(step) {
  const overlay = document.getElementById("photoZoomOverlay");
  if (!overlay) return;

  const current = Number(overlay.dataset.scale || "1");
  const next = Math.max(1, Math.min(4, current + step));
  overlay.dataset.scale = String(next);
  overlay.style.setProperty("--zoomScale", String(next));
};

window.resetPhotoZoom = function() {
  const overlay = document.getElementById("photoZoomOverlay");
  if (!overlay) return;

  overlay.dataset.scale = "1";
  overlay.style.setProperty("--zoomScale", "1");
};

window.closePhotoZoom = function() {
  document.getElementById("photoZoomOverlay")?.remove();
};



function categorizedPhotos(patient) {
  const photos = (patient.photos || []).map((x, i) => ({
    url: photoUrl(x),
    category: String(x?.category || "").toLowerCase(),
    name: String(x?.name || x?.filename || "").toLowerCase(),
    index: i
  })).filter(x => x.url);
  const xrays = photos.filter(x => x.category.includes("x") || x.name.includes("xray") || x.name.includes("x-ray") || x.name.includes("radiograph"));
  const clinical = photos.filter(x => !xrays.includes(x));
  return { clinical, xrays };
}

window.simplePhotoState = window.simplePhotoState || {};

function renderSimplePhotos(patient, type = "clinical") {
  const cats = categorizedPhotos(patient);
  const list = type === "xray" ? cats.xrays : cats.clinical;
  const fallback = type === "xray" ? cats.clinical : cats.xrays;
  const photos = list.length ? list : fallback;
  if (!photos.length) return `<p style="color:var(--muted);font-weight:800">No photos yet</p>`;
  window.simplePhotoState[patient.id] = { type, photos };
  return `
    <div class="photoSectionTabs">
      <button class="${type === "clinical" ? "active" : ""}" onclick="switchSimplePhotoType('${patient.id}','clinical')">Clinical</button>
      <button class="${type === "xray" ? "active" : ""}" onclick="switchSimplePhotoType('${patient.id}','xray')">X-ray</button>
    </div>
    <div class="simplePhotoGrid">
      ${photos.map((p, i) => `<img src="${p.url}" onclick="openSimplePhotoViewer('${patient.id}', ${i})">`).join("")}
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
  const currentType = window.simplePhotoState[patientId]?.type || "clinical";
  const cats = categorizedPhotos(p);
  const list = currentType === "xray" ? cats.xrays : cats.clinical;
  const fallback = currentType === "xray" ? cats.clinical : cats.xrays;
  const photos = (list.length ? list : fallback).map(x => x.url);
  if (!photos.length) return;
  window.simplePhotoState[patientId] = { type: currentType, photos, index };

  document.getElementById("fullPhotoViewer")?.remove();
  const viewer = document.createElement("div");
  viewer.className = "fullPhotoViewer";
  viewer.id = "fullPhotoViewer";
  viewer.innerHTML = `
    <div class="fullPhotoTop">
      <span style="color:white;font-weight:1000">${index + 1} / ${photos.length}</span>
      <button onclick="closeSimplePhotoViewer()">Ã</button>
    </div>
    <img src="${photos[index]}">
    <div class="fullPhotoNav">
      <button onclick="moveSimplePhoto('${patientId}', -1)">Previous</button>
      <button onclick="moveSimplePhoto('${patientId}', 1)">Next</button>
    </div>`;
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

function patientDetailsHTML(p) {
  const data = parseClinicData(p.progress_notes);
  const money = paymentTotals(data);
  const photos = (p.photos || []);
  return `
    <div class="card">
      <div class="profileHero">
        <div>
          <h2>${safeText(p.name || "No name")}</h2>
          <div class="tagWrap">${patientRiskBadges(p)}</div>
        </div>
        <div>
          <div class="patientAvatar" onclick="changePatientProfilePhoto('${p.id}')">${patientProfilePhoto(p) ? `<img src="${patientProfilePhoto(p)}">` : safeText(patientInitials(p))}</div>
          <div class="completionRing" style="--p:${treatmentCompletionPercent(p)}%">
            <span>${treatmentCompletionPercent(p)}%</span>
          </div>
        </div>
      </div>
      <span class="pill">ID: ${safeText(p.case_id || "-")}</span>
      <span class="pill">${safeText(p.phone || "No phone")}</span>
      <span class="pill">${safeText(p.age || "-")} yrs</span>
      <span class="pill">${safeText(p.gender || "-")}</span>
      ${renderPatientTags(p)}

      <div class="kv cleanField"><b>Chief complaint</b><span>${safeText(p.chief_complaint || "-")}</span></div>
      <div class="kv cleanField"><b>Medical alerts</b><span>${safeText(p.medical_alerts || "-")}</span></div>
      <div class="kv cleanField"><b>Diagnosis</b><span>${safeText(p.diagnosis || "-")}</span></div>
      <div class="kv cleanField"><b>Treatment plan</b><span>${safeText(p.treatment_plan || "-")}</span></div>
      ${medicalAlertBanner(p)}
      <h3 class="sectionTitle">Treatment Progress</h3>
      ${renderTreatmentProgress(p)}

      <div class="actions" style="margin:14px 0;">
        <button class="secondary" onclick="sendWhatsAppReminder('${p.id}')">WhatsApp Reminder</button>
        <button class="secondary" onclick="addTreatmentTemplate('${p.id}')">Treatment Template</button><button class="secondary" onclick="generateAITreatmentPlan('${p.id}')">AI Plan</button>
        <button class="secondary" onclick="showCaseSummary('${p.id}')">Case Summary</button>
        <button class="secondary" onclick="addVoiceNote('${p.id}')">Voice Note</button><button class="secondary" onclick="generateSmartNote('${p.id}')">Smart Note</button><button class="secondary" onclick="generateSmartConsentPro('${p.id}')">Consent</button><button class="secondary" onclick="generatePrescriptionPro('${p.id}')">Prescription</button><button class="secondary" onclick="addLabWork('${p.id}')">Lab</button><button class="secondary" onclick="setCasePriority('${p.id}')">Priority</button><button class="secondary" onclick="addPatientTag('${p.id}')">Add Tag</button>
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
      <div class="actions"><button class="primary" onclick="openAppointmentManager('${p.id}')">+ Add Appointment</button></div>
      ${data.appointments.length ? data.appointments.map((a, i) => `<div class="appointment"><b>${safeText(a.date || "-")}</b><p>${safeText(a.note || "")}</p><button class="danger" onclick="deleteAppointment('${p.id}', ${i})">Delete</button></div>`).join("") : `<div class="kv"><span>No appointments yet</span></div>`}

      <h3 class="sectionTitle">Payments</h3>
      <div class="miniGrid"><div class="miniCard"><b>Total</b><span class="money">${money.total}</span></div><div class="miniCard"><b>Paid</b><span class="money">${money.paid}</span></div><div class="miniCard"><b>Remaining</b><span class="money unpaid">${money.remaining}</span></div></div>
      <div class="actions"><button class="primary" onclick="addPayment('${p.id}')">+ Add Payment</button><button class="secondary" onclick="addInstallmentPlan('${p.id}')">Installments</button></div>
      ${data.payments.length ? data.payments.map((pay, i) => `<div class="appointment"><b>${safeText(pay.date || "")}</b><p>Total: ${Number(pay.total || 0)} | Paid: ${Number(pay.paid || 0)} | Remaining: ${Number(pay.total || 0) - Number(pay.paid || 0)}</p><button class="danger" onclick="deletePayment('${p.id}', ${i})">Delete</button></div>`).join("") : `<div class="kv"><span>No payments yet</span></div>`}

      <h3 class="sectionTitle">Photos / X-rays</h3>
      <div class="actions"><button class="secondary" onclick="showBeforeAfter(\'${p.id}\')">Before / After</button></div>
      <div id="simplePhotosBox">${renderSimplePhotos(p, "clinical")}</div>

      <h3 class="sectionTitle">Patient Timeline</h3>
      <div class="patientCard">${renderTimeline(p)}</div>
      <h3 class="sectionTitle">Lab Tracking</h3>
      ${renderLabMini(p.id)}

      <div class="actions">
        ${canEdit() ? `<button class="primary" onclick="editPatient('${p.id}')">Edit</button>` : ""}
        <button class="secondary" type="button" data-qr-patient="${p.id}">QR</button>
        <button class="secondary whatsappBtn" type="button" data-wa-patient="${p.id}">WhatsApp</button>
        <button class="secondary" onclick="exportPDF('${p.id}')">PDF</button>
        ${canDelete() ? `<button class="danger" onclick="deletePatient('${p.id}')">Delete</button>` : ""}
      </div>
    </div>`;
}

window.openPatient = function(id) {
  try {
    const p = patients.find(x => String(x.id) === String(id));
    if (!p) return alert("Patient not found or you do not have access.");

    const details = $("details");
    if (!details) return alert("Details page is missing in index.html");

    details.innerHTML = patientDetailsHTML(p);
    showPage("detail");
    window.scrollTo(0, 0);
  } catch (err) {
    console.error("Open patient failed", err);
    alert("Open patient failed: " + err.message);
  }
};
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
window.deletePatient = async function(id) {
  if (!canDelete()) return alert("Only doctor/admin can delete patients");
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");
  if (!(await luxuryConfirm("Delete this patient?", "You can undo for a short time."))) return;

  localStorage.setItem("lastDeletedPatient", JSON.stringify(p));
  pushUndo({ type: "deletePatient", patient: p });
  await api(`patients?id=eq.${id}`, { method: "DELETE" });
  await loadPatients();
    startAutoRefresh();
  showPage("patients");
  showUndoToast(p.name);
};
let selectedToothPatientId = null;
let selectedToothNumber = null;

window.closeToothPopup = function() {
  document.getElementById("toothPopup")?.remove();
};

window.openToothPopup = function(patientId, toothNumber) {
  selectedToothPatientId = patientId;
  selectedToothNumber = toothNumber;

  document.getElementById("toothPopup")?.remove();

  const modal = document.createElement("div");
  modal.id = "toothPopup";
  modal.className = "luxuryModal";
  modal.innerHTML = `
    <div class="luxuryBox toothPopupBox">
      <h2>Tooth ${safeText(toothNumber)}</h2>
      <p>Choose surfaces, then choose status.</p>

      <div class="surfaceGrid">
        <button type="button" class="surfaceBtn" data-surface="M">M</button>
        <button type="button" class="surfaceBtn" data-surface="D">D</button>
        <button type="button" class="surfaceBtn" data-surface="O/I">O/I</button>
        <button type="button" class="surfaceBtn" data-surface="B">B</button>
        <button type="button" class="surfaceBtn" data-surface="L">L</button>
      </div>

      <div class="toothStatusGrid">
        ${["healthy","caries","filling","rct","crown","missing","extraction","implant"].map(s => `
          <button type="button" data-status="${s}">${safeText(s.toUpperCase())}</button>
        `).join("")}
      </div>

      <div class="luxuryActions">
        <button type="button" class="secondary" id="toothCancelBtn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("#toothCancelBtn").addEventListener("click", window.closeToothPopup);
  modal.querySelectorAll(".surfaceBtn").forEach(btn => {
    btn.addEventListener("click", () => btn.classList.toggle("active"));
  });
  modal.querySelectorAll("[data-status]").forEach(btn => {
    btn.addEventListener("click", () => window.setToothStatus(btn.dataset.status));
  });
};

window.setToothStatus = async function(status) {
  if (!selectedToothPatientId || !selectedToothNumber) return;

  const p = patients.find(x => x.id === selectedToothPatientId);
  if (!p) return alert("Patient not found.");

  const data = parseClinicData(p.progress_notes);
  if (!data.teeth) data.teeth = {};

  const selectedSurfaces = [...document.querySelectorAll("#toothPopup .surfaceBtn.active")]
    .map(btn => btn.dataset.surface);

  data.teeth[selectedToothNumber] = { status, surfaces: selectedSurfaces };

  await api(`patients?id=eq.${selectedToothPatientId}`, {
    method: "PATCH",
    body: JSON.stringify({ progress_notes: saveClinicData(data) })
  });

  window.closeToothPopup();
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



window.generateAITreatmentPlan = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");

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

  await api(`patients?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ treatment_plan: plan })
  });

  await refreshPatientKeepingScroll(id);
};


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




function clinicDocs(patient) {
  const data = parseClinicData(patient.progress_notes);
  data.docs = data.docs || [];
  return data.docs;
}

async function saveClinicDoc(patientId, doc) {
  const p = patients.find(x => x.id === patientId);
  if (!p) return;
  const data = parseClinicData(p.progress_notes);
  data.docs = data.docs || [];
  data.docs.unshift({
    id: "DOC-" + Date.now(),
    date: new Date().toLocaleString(),
    ...doc
  });

  await api(`patients?id=eq.${patientId}`, {
    method: "PATCH",
    body: JSON.stringify({ progress_notes: saveClinicData(data) })
  });

  await refreshPatientKeepingScroll(patientId);
}

window.openSignaturePad = function(title = "Signature") {
  return new Promise(resolve => {
    const modal = document.createElement("div");
    modal.className = "luxuryModal";
    modal.innerHTML = `
      <div class="luxuryBox">
        <h2>${safeText(title)}</h2>
        <canvas class="signaturePad" id="signatureCanvas"></canvas>
        <div class="luxuryActions">
          <button class="secondary" id="clearSig">Clear</button>
          <button class="secondary" id="cancelSig">Cancel</button>
          <button class="primary" id="saveSig">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const canvas = modal.querySelector("#signatureCanvas");
    const ctx = canvas.getContext("2d");
    let drawing = false;

    function resize() {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#111827";
    }

    setTimeout(resize, 30);

    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    canvas.onmousedown = canvas.ontouchstart = e => {
      drawing = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      e.preventDefault();
    };

    canvas.onmousemove = canvas.ontouchmove = e => {
      if (!drawing) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      e.preventDefault();
    };

    canvas.onmouseup = canvas.onmouseleave = canvas.ontouchend = () => drawing = false;

    modal.querySelector("#clearSig").onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
    modal.querySelector("#cancelSig").onclick = () => { modal.remove(); resolve(""); };
    modal.querySelector("#saveSig").onclick = () => {
      const img = canvas.toDataURL("image/png");
      modal.remove();
      resolve(img);
    };
  });
};

function premiumDocHTML(title, patient, body, signature = "") {
  const clinicName = currentUser?.clinic_name || "Masri Dental Clinic";
  const logo = currentUser?.clinic_logo || "";
  return `
    <h1>${logo ? `<img src="${logo}" style="width:74px;height:74px;object-fit:contain;vertical-align:middle;margin-right:12px;border-radius:16px;background:white;">` : ""}${safeText(clinicName)}</h1>
    <p style="color:#b8860b;font-weight:900;margin-top:6px;">${safeText(title)}</p>
    <div class="premiumDocBox">
      <b>Patient:</b> ${safeText(patient.name || "-")}<br>
      <b>ID:</b> ${safeText(patient.case_id || patient.id)}<br>
      <b>Phone:</b> ${safeText(patient.phone || "-")}<br>
      <b>Date:</b> ${new Date().toLocaleString()}
    </div>
    ${body}
    ${signature ? `<div class="premiumDocBox"><b>Signature</b><br><img src="${signature}" style="max-width:260px;background:white;border:1px solid #ddd;border-radius:12px;"></div>` : ""}
  `;
}

window.generateSmartConsentPro = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;

  const type = await luxuryPrompt("Consent type", "extraction / rct / implant / crown", "extraction");
  if (!type) return;

  const signature = await openSignaturePad("Patient signature");

  const body = `
    <h2>${safeText(type.toUpperCase())} Consent Form</h2>
    <div class="premiumDocBox">
      I acknowledge that the planned dental treatment, alternatives, benefits, risks,
      limitations, and possible complications have been explained to me. I had the chance
      to ask questions and agree to proceed.
    </div>
    <div class="premiumDocBox">
      <b>Diagnosis:</b> ${safeText(p.diagnosis || "-")}<br>
      <b>Treatment plan:</b> ${safeText(p.treatment_plan || "-")}<br>
      <b>Medical alerts:</b> ${safeText(p.medical_alerts || "-")}
    </div>
    <p>Doctor signature: ________________________</p>
  `;

  const html = premiumDocHTML("Smart Consent PDF", p, body, signature);
  openPremiumDocument("Consent", html);
  await saveClinicDoc(id, { type: "Consent", title: `${type} consent`, html });
};

window.generatePrescriptionPro = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;

  const type = await luxuryPrompt("Prescription template", "pain / infection / extraction / implant", "pain");
  if (!type) return;

  let meds = "Analgesic as prescribed\nFollow doctor's instructions";
  if (type.toLowerCase().includes("infection")) meds = "Antibiotic as prescribed\nAnalgesic as needed\nWarm saline rinse";
  if (type.toLowerCase().includes("extraction")) meds = "Analgesic as prescribed\nPost-operative instructions\nAvoid smoking and vigorous rinsing for 24 hours";
  if (type.toLowerCase().includes("implant")) meds = "Analgesic as prescribed\nAntibiotic as prescribed if indicated\nCold packs for the first day\nFollow-up appointment";

  const custom = await luxuryPrompt("Extra instructions", "Optional", "");
  if (custom) meds += "\n" + custom;

  const body = `
    <h2>Prescription</h2>
    <div style="font-size:48px;font-weight:1000;color:#b8860b;margin:18px 0;">Rx</div>
    <div class="premiumDocBox" style="white-space:pre-wrap;font-size:18px;">${safeText(meds)}</div>
    <div class="premiumDocBox">
      <b>Diagnosis:</b> ${safeText(p.diagnosis || "-")}<br>
      <b>Notes:</b> ${safeText(type)}
    </div>
    <p>Doctor signature: ________________________</p>
  `;

  const html = premiumDocHTML("Prescription", p, body, "");
  openPremiumDocument("Prescription", html);
  await saveClinicDoc(id, { type: "Prescription", title: `${type} prescription`, html });
};

window.openReportsCenter = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;

  const docs = clinicDocs(p);

  const modal = document.createElement("div");
  modal.className = "luxuryModal";
  modal.innerHTML = `
    <div class="luxuryBox" style="max-width:720px;">
      <h2>Reports Center</h2>
      <div class="reportCenterGrid">
        <button class="primary" onclick="generateSmartConsentPro('${id}')">Smart Consent</button>
        <button class="primary" onclick="generatePrescriptionPro('${id}')">Prescription Pro</button>
        <button class="secondary" onclick="exportPDF('${id}')">Patient Report</button>
        <button class="secondary" onclick="generateInvoicePro('${id}')">Invoice</button>
      </div>
      <h3 style="color:var(--gold);">Saved Documents</h3>
      ${docs.length ? docs.map(d => `
        <div class="docHistoryRow">
          <div>
            <b>${safeText(d.title || d.type)}</b><br>
            <small>${safeText(d.date || "")}</small>
          </div>
          <button class="secondary" data-open-doc="${safeText(d.id)}">Open</button>
        </div>
      `).join("") : `<p style="color:var(--muted);font-weight:800">No saved documents yet</p>`}
      <div class="luxuryActions">
        <button class="secondary" onclick="this.closest('.luxuryModal').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelectorAll("[data-open-doc]").forEach(btn => {
    btn.onclick = () => {
      const doc = docs.find(d => d.id === btn.dataset.openDoc);
      if (doc) openPremiumDocument(doc.title || doc.type || "Document", doc.html || "");
    };
  });
};

window.generateInvoicePro = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const data = parseClinicData(p.progress_notes);
  const money = paymentTotals(data);

  const body = `
    <h2>Invoice</h2>
    <div class="premiumDocBox">
      <b>Total:</b> ${money.total}<br>
      <b>Paid:</b> ${money.paid}<br>
      <b>Remaining:</b> ${money.remaining}
    </div>
    <div class="premiumDocBox">
      ${data.payments.length ? data.payments.map(pay => `
        <p><b>${safeText(pay.date || "")}</b>  Total: ${Number(pay.total || 0)} | Paid: ${Number(pay.paid || 0)}</p>
      `).join("") : "No payments recorded."}
    </div>
  `;

  const html = premiumDocHTML("Invoice", p, body, "");
  openPremiumDocument("Invoice", html);
  await saveClinicDoc(id, { type: "Invoice", title: "Financial invoice", html });
};

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
      if ($("status")) $("status").textContent = "Offline cache loaded";
    }
  } catch {}
}

window.exportDailyBackup = function() {
  const backup = {
    exported_at: new Date().toISOString(),
    user: currentUser,
    patients,
    inventory: JSON.parse(localStorage.getItem("clinicInventory") || "[]"),
    lab: JSON.parse(localStorage.getItem("clinicLab") || "[]")
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clinic-daily-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

function pushUndo(action) {
  const stack = JSON.parse(localStorage.getItem("clinicUndoStack") || "[]");
  stack.unshift({ time: new Date().toISOString(), ...action });
  localStorage.setItem("clinicUndoStack", JSON.stringify(stack.slice(0, 20)));
}

window.openWhatsAppAutomation = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;

  const type = await luxuryPrompt(
    "WhatsApp message",
    "appointment / missed / postop / followup",
    "appointment"
  );

  if (!type) return;

  let message = `Hello ${p.name || ""}, this is ${currentUser?.clinic_name || "the clinic"}.`;
  const lower = type.toLowerCase();

  if (lower.includes("missed")) message += " We missed you at your appointment. Please contact us to reschedule.";
  else if (lower.includes("post")) message += " Please follow the post-operative instructions. Contact us if you have severe pain, swelling, or bleeding.";
  else if (lower.includes("follow")) message += " This is a follow-up reminder from the clinic.";
  else {
    const data = parseClinicData(p.progress_notes);
    const next = nextAppointmentInfo(data);
    message += next?.date ? ` Reminder for your appointment: ${next.date}.` : " This is an appointment reminder.";
  }

  const custom = await luxuryPrompt("Edit message", "Message", message);
  if (!custom) return;

  const phone = normalizePhoneForWhatsApp(p.phone || "");
  if (!phone) return alert("No valid phone number.");
  const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(custom)}`;
  window.location.href = url;
};

window.smartSearchInfo = function() {
  return "Search examples: unpaid, vip, high risk, crown, implant, rct, extraction, phone, patient ID, appointment";
};


function appointmentStatusColor(status = "pending") {
  const s = String(status || "pending").toLowerCase();
  if (s.includes("confirmed")) return "statusConfirmed";
  if (s.includes("cancelled")) return "statusCancelled";
  if (s.includes("emergency")) return "statusEmergency";
  return "statusPending";
}

function treatmentCompletionPercent(patient) {
  const steps = treatmentProgressItems(patient);
  if (!steps.length) return 0;
  const done = steps.filter(s => s.state === "done").length;
  const active = steps.some(s => s.state === "active") ? 0.5 : 0;
  return Math.min(100, Math.round(((done + active) / steps.length) * 100));
}

function patientRiskBadges(patient) {
  const text = `${patient.medical_alerts || ""}`.toLowerCase();
  const tags = patientTags(patient).map(t => String(t).toLowerCase());
  const out = [];
  if (tags.includes("vip")) out.push(`<span class="patientTag vipBadge">VIP</span>`);
  if (text.includes("allergy")) out.push(`<span class="patientTag riskBadge">Allergy</span>`);
  if (text.includes("diabetes")) out.push(`<span class="patientTag riskBadge">Diabetes</span>`);
  if (text.includes("hypertension")) out.push(`<span class="patientTag riskBadge">Hypertension</span>`);
  if (text.includes("pregnancy")) out.push(`<span class="patientTag riskBadge">Pregnancy</span>`);
  return out.join("");
}

function patientInitials(patient) {
  return String(patient.name || "?").trim().split(/\s+/).slice(0,2).map(x => x[0] || "").join("").toUpperCase() || "?";
}

function financeProHTML() {
  let total = 0, paid = 0, unpaid = 0;
  const procedures = {};

  patients.forEach(p => {
    const data = parseClinicData(p.progress_notes);
    const money = paymentTotals(data);
    total += money.total;
    paid += money.paid;
    unpaid += money.remaining;

    const text = `${p.diagnosis || ""} ${p.treatment_plan || ""}`.toLowerCase();
    ["rct","crown","implant","extraction","scaling","filling"].forEach(k => {
      if (text.includes(k)) procedures[k] = (procedures[k] || 0) + money.paid;
    });
  });

  const top = Object.entries(procedures).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return `
    <div class="financeProGrid">
      <div class="financeProCard"><small>Total planned</small><strong>${total}</strong></div>
      <div class="financeProCard"><small>Paid</small><strong>${paid}</strong></div>
      <div class="financeProCard"><small>Unpaid</small><strong>${unpaid}</strong></div>
      <div class="financeProCard"><small>Collection rate</small><strong>${total ? Math.round((paid / total) * 100) : 0}%</strong></div>
    </div>
    <h3 style="color:var(--gold);margin:18px 0 10px;">Top procedures income</h3>
    ${top.length ? top.map(([k,v]) => `<div class="topProcedureRow"><b>${safeText(k.toUpperCase())}</b><span>${v}</span></div>`).join("") : `<p style="color:var(--muted);font-weight:800">No procedure income yet</p>`}
  `;
}

function labStepHTML(status = "Sent") {
  const steps = ["Impression", "Lab", "Ready", "Delivered"];
  const s = String(status || "").toLowerCase();
  let current = 0;
  if (s.includes("lab") || s.includes("waiting")) current = 1;
  if (s.includes("ready") || s.includes("returned")) current = 2;
  if (s.includes("deliver")) current = 3;
  return `<div class="labStepper">${steps.map((x,i)=>`<div class="labStep ${i <= current ? "done" : ""}">${x}</div>`).join("")}</div>`;
}

function surfaceOverlayHTML(toothInfo) {
  if (!toothInfo || typeof toothInfo === "string") return "";
  const status = toothInfo.status || "";
  const surfaces = toothInfo.surfaces || [];
  if (!surfaces.length || !status || status === "healthy") return "";

  const cls =
    status === "caries" ? "surfaceCaries" :
    status === "filling" ? "surfaceFilling" :
    status === "rct" ? "surfaceRCT" :
    status === "crown" ? "surfaceCrown" : "surfaceFilling";

  return `<div class="surfaceOverlay">
    <span class="${surfaces.includes("M") ? cls : ""}"></span>
    <span class="${surfaces.includes("D") ? cls : ""}"></span>
    <span class="${surfaces.includes("B") ? cls : ""}"></span>
    <span class="${surfaces.includes("L") ? cls : ""}"></span>
  </div>`;
}

window.openAppointmentManager = async function(id, index = null) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");
  const data = parseClinicData(p.progress_notes);
  const old = index !== null ? data.appointments[index] : null;

  const date = await luxuryPrompt("Appointment date / time", "Example: 2026-06-10 7:00 PM", old?.date || "");
  if (!date) return;

  const note = await luxuryPrompt("Appointment note", "Optional note", old?.note || "");
  const status = await luxuryPrompt("Status", "confirmed / pending / cancelled / emergency / waiting", old?.status || "pending");

  const item = { date, note: note || "", status: status || "pending" };

  if (index !== null) data.appointments[index] = item;
  else data.appointments.unshift(item);

  await api(`patients?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ progress_notes: saveClinicData(data) })
  });

  await refreshPatientKeepingScroll(id);
};

window.changeAppointmentStatus = async function(id, index) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const data = parseClinicData(p.progress_notes);
  const appt = data.appointments[index];
  if (!appt) return;

  const status = await luxuryPrompt("Appointment status", "confirmed / pending / cancelled / emergency / waiting", appt.status || "pending");
  if (!status) return;
  appt.status = status;

  await api(`patients?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ progress_notes: saveClinicData(data) })
  });

  await refreshPatientKeepingScroll(id);
};

window.openPhotoComparePro = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;

  const cats = typeof categorizedPhotos === "function"
    ? categorizedPhotos(p)
    : { clinical: (p.photos || []).map(x => ({ url: photoUrl(x) })), xrays: [] };

  const photos = [...cats.clinical, ...cats.xrays].map(x => x.url).filter(Boolean);
  if (photos.length < 2) return alert("Need at least 2 photos.");

  let beforeIndex = 0;
  let afterIndex = 1;

  const modal = document.createElement("div");
  modal.className = "luxuryModal";
  modal.innerHTML = `
    <div class="luxuryBox" style="max-width:780px;">
      <h2>Before / After Pro</h2>
      <p style="color:var(--muted);font-weight:800;margin-bottom:14px;">Clean comparison with preserved brightness.</p>

      <div class="baMorphWrap">
        <span class="baGhostLabel before">Before</span>
        <span class="baGhostLabel after">After</span>
        <img src="${photos[beforeIndex]}" id="baBeforeImg" class="baMorphBefore">
        <img src="${photos[afterIndex]}" id="baAfterImg" class="baMorphAfter">
      </div>

      <div class="baControlPanel">
        <input type="range" min="0" max="100" value="0" id="baMorphSlider">
        <button class="secondary" id="baPrevBefore">Prev Before</button>
        <button class="secondary" id="baNextAfter">Next After</button>
        <button class="primary" id="baAutoPlay">Auto</button>
        <button class="secondary" onclick="this.closest('.luxuryModal').remove()">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const slider = modal.querySelector("#baMorphSlider");
  const before = modal.querySelector("#baBeforeImg");
  const after = modal.querySelector("#baAfterImg");

  function updateMorph() {
    const v = Number(slider.value) / 100;
    before.style.opacity = String(1 - v);
    after.style.opacity = String(v);
    before.style.filter = "none";
    after.style.filter = "none";
    before.style.transform = "none";
    after.style.transform = "none";
  }

  function updateImages() {
    before.src = photos[beforeIndex];
    after.src = photos[afterIndex];
    updateMorph();
  }

  slider.oninput = updateMorph;
  updateMorph();

  modal.querySelector("#baPrevBefore").onclick = () => {
    beforeIndex = (beforeIndex - 1 + photos.length) % photos.length;
    if (beforeIndex === afterIndex) beforeIndex = (beforeIndex - 1 + photos.length) % photos.length;
    slider.value = 0;
    updateImages();
  };

  modal.querySelector("#baNextAfter").onclick = () => {
    afterIndex = (afterIndex + 1) % photos.length;
    if (afterIndex === beforeIndex) afterIndex = (afterIndex + 1) % photos.length;
    slider.value = 0;
    updateImages();
  };

  modal.querySelector("#baAutoPlay").onclick = () => {
    let v = 0;
    const timer = setInterval(() => {
      v += 2;
      slider.value = v;
      updateMorph();
      if (v >= 100) clearInterval(timer);
    }, 35);
  };
};

window.openPhotoZoom = function(url) {
  document.getElementById("photoZoomOverlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "zoomOverlay";
  overlay.id = "photoZoomOverlay";
  overlay.dataset.scale = "1";
  overlay.style.setProperty("--zoomScale", "1");
  overlay.innerHTML = `
    <div class="zoomToolbar">
      <button onclick="zoomPhoto(-0.25)">-</button>
      <button onclick="zoomPhoto(0.25)">+</button>
      <button onclick="resetPhotoZoom()">Reset</button>
      <button onclick="closePhotoZoom()">Close</button>
    </div>
    <img src="${url}">
  `;

  document.body.appendChild(overlay);
};


window.changeMyPassword = async function() {
  if (!currentUser || !currentUser.id) return alert("Please login first.");

  const oldPassword = await luxuryPrompt("Current password", "Enter current password");
  if (!oldPassword) return;

  if (oldPassword.trim() !== currentUser.password) {
    return alert("Current password is wrong.");
  }

  const newPassword = await luxuryPrompt("New password", "Enter new password");
  if (!newPassword) return;

  const confirmPassword = await luxuryPrompt("Confirm new password", "Re-enter new password");
  if (!confirmPassword) return;

  if (newPassword.trim() !== confirmPassword.trim()) {
    return alert("Passwords do not match.");
  }

  if (newPassword.trim().length < 4) {
    return alert("Password must be at least 4 characters.");
  }

  try {
    await api(`clinic_users?id=eq.${currentUser.id}`, {
      method: "PATCH",
      body: JSON.stringify({ password: newPassword.trim() })
    });

    currentUser.password = newPassword.trim();
    saveUser(currentUser);

    await luxuryConfirm("Password updated", "Your password was changed successfully.");
  } catch (err) {
    alert("Password update failed: " + err.message);
  }
};

window.openDoctorProfile = async function() {
  if (!currentUser) return alert("Please login first.");

  const modal = document.createElement("div");
  modal.className = "luxuryModal";
  modal.id = "doctorProfileModal";
  modal.innerHTML = `
    <div class="luxuryBox">
      <h2>Doctor Profile</h2>
      <div class="kv"><b>Name</b><span>${safeText(currentUser.full_name || currentUser.username || "-")}</span></div>
      <div class="kv"><b>Username</b><span>${safeText(currentUser.username || "-")}</span></div>
      <div class="kv"><b>Role</b><span>${safeText((currentUser.role || "doctor").toUpperCase())}</span></div>
      <div class="profileGrid">
        <button class="primary" id="editProfileBtn">Edit Profile</button>
        <button class="secondary" id="profilePasswordBtn">Change Password</button>
        <button class="secondary" id="setPinBtn">Set Local PIN</button>
        <button class="secondary" id="closeProfileBtn">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#closeProfileBtn").onclick = () => modal.remove();
  modal.querySelector("#profilePasswordBtn").onclick = () => window.changeMyPassword();
  modal.querySelector("#setPinBtn").onclick = () => window.setLocalPIN();

  modal.querySelector("#editProfileBtn").onclick = async () => {
    const full_name = await luxuryPrompt("Doctor name", "Full name", currentUser.full_name || "");
    if (!full_name) return;

    const username = await luxuryPrompt("Username", "Any username", currentUser.username || "");
    if (!username) return;

    const cleanUsername = username.trim();

    const existing = await api(`clinic_users?select=id&username=eq.${encodeURIComponent(cleanUsername)}`);
    if (existing.some(u => u.id !== currentUser.id)) {
      return alert("This username already exists.");
    }

    await api(`clinic_users?id=eq.${currentUser.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        full_name: full_name.trim(),
        username: cleanUsername
      })
    });

    currentUser.full_name = full_name.trim();
    currentUser.username = cleanUsername;
    saveUser(currentUser);
    applyUserBar();
  enhancePremiumHeader();

    await luxuryConfirm("Profile updated", "Your profile was updated successfully.");
    modal.remove();
  };
};

window.setLocalPIN = async function() {
  const pin = await luxuryPrompt("Set local PIN", "4 digits");
  if (!pin) return;
  if (!/^[0-9]{4,6}$/.test(pin.trim())) return alert("PIN must be 4-6 numbers.");
  localStorage.setItem("clinicLocalPIN-" + currentUser.id, pin.trim());
  await luxuryConfirm("PIN saved", "Local PIN saved on this device.");
};

window.manageUsers = async function() {
  if (!currentUser || currentUser.role !== "admin") {
    return alert("Only admin can manage users.");
  }

  const users = await api("clinic_users?select=*&order=created_at.desc");

  const modal = document.createElement("div");
  modal.className = "luxuryModal";
  modal.id = "usersModal";
  modal.innerHTML = `
    <div class="luxuryBox">
      <h2>Manage Users</h2>
      ${users.map(u => `
        <div class="manageRow">
          <div>
            <b>${safeText(u.full_name || u.username)}</b><br>
            <small>${safeText(u.username)} - ${safeText((u.role || "doctor").toUpperCase())}</small>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="secondary" data-edit-user="${u.id}">Role</button>
            ${u.id !== currentUser.id ? `<button class="danger" data-delete-user="${u.id}">Delete</button>` : ""}
          </div>
        </div>
      `).join("")}
      <div class="luxuryActions">
        <button class="secondary" id="closeUsersModal">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector("#closeUsersModal").onclick = () => modal.remove();

  modal.querySelectorAll("[data-edit-user]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.editUser;
      const role = await luxuryPrompt("User role", "admin / doctor / assistant", "doctor");
      if (!["admin", "doctor", "assistant"].includes(role)) return alert("Invalid role");
      await api(`clinic_users?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role })
      });
      modal.remove();
      await window.manageUsers();
    };
  });

  modal.querySelectorAll("[data-delete-user]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.deleteUser;
      if (!(await luxuryConfirm("Delete user?", "This removes this login account."))) return;
      await api(`clinic_users?id=eq.${id}`, { method: "DELETE" });
      modal.remove();
      await window.manageUsers();
    };
  });
};

function patientTags(patient) {
  const data = parseClinicData(patient.progress_notes);
  return data.tags || [];
}

window.addPatientTag = async function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");

  const tag = await luxuryPrompt("Patient tag", "VIP / High risk / Needs follow-up / Unpaid");
  if (!tag) return;

  const data = parseClinicData(p.progress_notes);
  data.tags = data.tags || [];
  if (!data.tags.includes(tag.trim())) data.tags.push(tag.trim());

  await api(`patients?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ progress_notes: saveClinicData(data) })
  });

  await refreshPatientKeepingScroll(id);
};

window.removePatientTag = async function(id, tag) {
  const p = patients.find(x => x.id === id);
  if (!p) return alert("Patient not found.");
  const data = parseClinicData(p.progress_notes);
  data.tags = (data.tags || []).filter(t => t !== tag);

  await api(`patients?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ progress_notes: saveClinicData(data) })
  });

  await refreshPatientKeepingScroll(id);
};

function renderPatientTags(patient) {
  const tags = patientTags(patient);
  return `
    <div class="tagWrap">
      ${tags.length ? tags.map(t => `
        <span class="patientTag" onclick="removePatientTag('${patient.id}', '${String(t).replace(/'/g, "\\'")}')">
          ${safeText(t)} 
        </span>
      `).join("") : `<span class="pill">No tags</span>`}
      <button class="secondary" onclick="addPatientTag('${patient.id}')">+ Tag</button>
    </div>
  `;
}

function clinicAnalyticsHTML() {
  const treatment = treatmentStats();
  let busiest = {};
  patients.forEach(p => {
    const data = parseClinicData(p.progress_notes);
    (data.appointments || []).forEach(a => {
      const d = new Date(a.date);
      if (!isNaN(d)) {
        const day = d.toLocaleString("en", { weekday: "short" });
        busiest[day] = (busiest[day] || 0) + 1;
      }
    });
  });

  const topTreatment = Object.entries(treatment).sort((a,b) => b[1]-a[1])[0];
  const busiestDay = Object.entries(busiest).sort((a,b) => b[1]-a[1])[0];
  const tagged = patients.reduce((n,p) => n + patientTags(p).length, 0);

  return `
    <div class="analyticsGrid">
      <div class="analyticsBox"><small>Top treatment</small><b>${safeText(topTreatment ? topTreatment[0].toUpperCase() : "-")}</b></div>
      <div class="analyticsBox"><small>Busiest day</small><b>${safeText(busiestDay ? busiestDay[0] : "-")}</b></div>
      <div class="analyticsBox"><small>Patient tags</small><b>${tagged}</b></div>
      <div class="analyticsBox"><small>Doctors/users</small><b>${currentUser?.role === "admin" ? "Admin" : "Active"}</b></div>
    </div>
  `;
}

window.sendTomorrowReminders = async function() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const items = [];

  patients.forEach(p => {
    const data = parseClinicData(p.progress_notes);
    (data.appointments || []).forEach(a => {
      const d = new Date(a.date);
      if (!isNaN(d) && d.toDateString() === tomorrow.toDateString()) {
        items.push({ patient: p, appointment: a });
      }
    });
  });

  if (!items.length) return alert("No appointments tomorrow.");

  const first = items[0];
  await luxuryConfirm("Tomorrow reminders", `${items.length} appointment(s) tomorrow. Opening first patient reminder.`);
  window.sendWhatsAppReminder(first.patient.id);
};

window.undoLastDelete = async function() {
  const raw = localStorage.getItem("lastDeletedPatient");
  if (!raw) return alert("No deleted patient to restore.");

  const p = JSON.parse(raw);
  if (!(await luxuryConfirm("Restore patient?", `Restore ${p.name || "patient"}?`))) return;

  await api("patients", {
    method: "POST",
    body: JSON.stringify(p)
  });

  localStorage.removeItem("lastDeletedPatient");
  await loadPatients();
  showPage("patients");
};

function showUndoToast(patientName) {
  document.getElementById("undoToast")?.remove();
  const toast = document.createElement("div");
  toast.id = "undoToast";
  toast.className = "toastUndo";
  toast.innerHTML = `
    <span>Deleted ${safeText(patientName || "patient")}</span>
    <button class="secondary" onclick="undoLastDelete();document.getElementById('undoToast')?.remove();">Undo</button>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 9000);
}


function lastPatientSignature() {
  return JSON.stringify(patients.map(p => [p.id, p.updated_at || p.created_at || "", p.name || ""]));
}

async function syncPatientsQuietly() {
  if (!currentUser || document.visibilityState !== "visible") return;

  const oldSignature = lastPatientSignature();

  try {
    const oldScroll = window.scrollY;
    await loadPatients();
    const newSignature = lastPatientSignature();

    if (oldSignature !== newSignature && $("status")) {
      $("status").textContent = "Cloud synced live";
      setTimeout(() => {
        if ($("status")) $("status").textContent = "Cloud connected";
      }, 1500);
    }

    requestAnimationFrame(() => window.scrollTo({ top: oldScroll, behavior: "instant" }));
  } catch (err) {
    console.warn("Live sync failed", err);
  }
}

function startAutoRefresh() {
  if (window.__clinicAutoRefresh) return;

  window.__clinicAutoRefresh = setInterval(() => {
    syncPatientsQuietly();
  }, 45000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncPatientsQuietly();
  });

  window.addEventListener("focus", () => syncPatientsQuietly());
}




window.saveClinicBranding = async function() {
  try {
    const clinicName = $("clinicName")?.value?.trim() || "";
    let logoUrl = currentUser.clinic_logo || "";
    const logoFile = $("clinicLogo")?.files?.[0];
    let logoWarning = "";

    if (logoFile) {
      try {
        const clean = logoFile.name.replace(/[^a-zA-Z0-9.]/g, "-");
        const path = `${currentUser.id}/logo-${Date.now()}-${clean}`;
        logoUrl = await uploadToBucket(LOGO_BUCKET, path, logoFile, logoFile.type || "image/png");
      } catch (uploadErr) {
        logoWarning = " Logo upload failed because storage bucket/policy needs setup, but clinic name was saved.";
      }
    }

    await api(`clinic_users?id=eq.${currentUser.id}`, {
      method: "PATCH",
      body: JSON.stringify({ clinic_name: clinicName, clinic_logo: logoUrl })
    });

    currentUser.clinic_name = clinicName;
    currentUser.clinic_logo = logoUrl;
    saveUser(currentUser);
    applyUserBar();

    await luxuryConfirm("Clinic branding", "Clinic branding saved successfully." + logoWarning);
  } catch (err) {
    alert("Save failed: " + err.message);
  }
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




window.launchHealthCheck = function() {
  const checks = {
    userLoaded: !!currentUser,
    patientsArray: Array.isArray(patients),
    canOpenPatient: typeof window.openPatient === "function",
    canEditPatient: typeof window.editPatient === "function",
    toothChart: typeof renderToothChart === "function",
    photoGallery: typeof renderPhotoGalleryPro === "function",
    zoom: typeof window.openPhotoZoom === "function",
    beforeAfter: typeof window.openPhotoComparePro === "function",
    reports: typeof window.exportPDF === "function"
  };
  console.table(checks);
  return checks;
};

document.addEventListener("click", function(e) {
  const openBtn = e.target.closest("[data-open-patient]");
  if (openBtn) {
    e.preventDefault();
    e.stopPropagation();
    window.openPatient(openBtn.dataset.openPatient);
    return;
  }

  const editBtn = e.target.closest("[data-edit-patient]");
  if (editBtn) {
    e.preventDefault();
    e.stopPropagation();
    window.editPatient(editBtn.dataset.editPatient);
    return;
  }

  const qrBtn = e.target.closest("[data-qr-patient]");
  if (qrBtn) {
    e.preventDefault();
    e.stopPropagation();
    window.showQR(qrBtn.dataset.qrPatient);
    return;
  }

  const waBtn = e.target.closest("[data-wa-patient]");
  if (waBtn) {
    e.preventDefault();
    e.stopPropagation();
    window.openWhatsAppReminder(waBtn.dataset.waPatient);
  }
});

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
    applyClinicTheme();
    if (location.search.includes("logout=1")) { localStorage.removeItem("clinicUser"); showLoginScreen(); return; }
    currentUser = getSavedUser();
    if (!currentUser || !currentUser.id || !currentUser.role) { localStorage.removeItem("clinicUser"); showLoginScreen(); return; }
    applyUserBar();
    await loadPatients();
  } catch (err) {
    document.body.innerHTML = "<pre style='padding:20px;color:red;white-space:pre-wrap'>" + safeText(err.message) + "</pre>";
  }
});

try { applySavedTheme(); } catch(e) {}
try { enhancePremiumHeader(); } catch(e) {}

try { enhancePremiumHeader(); } catch(e) {}

/* FINAL POLISH FUNCTION OVERRIDES */
window.setClinicTheme = function(theme) {
  const themes = ["gold","pink","red","blue","cyan","purple","green","orange"];
  themes.forEach(t => document.body.classList.remove(`theme-${t}`));
  const clean = themes.includes(theme) ? theme : "gold";
  document.body.classList.add(`theme-${clean}`);
  localStorage.setItem("clinicTheme", clean);
  document.querySelector(".luxuryModal")?.remove();
};
function applySavedTheme() { setClinicTheme(localStorage.getItem("clinicTheme") || "gold"); }
function enhancePremiumHeader() {
  const brand = document.querySelector(".brand");
  if (brand) {
    const h1 = brand.querySelector("h1");
    if (h1 && !brand.querySelector(".clinicLogoPremium")) h1.insertAdjacentHTML("beforebegin", clinicLogoMarkup());
    brand.classList.add("brandWrapPremium");
  }
  const holder = brand?.parentElement || document.body;
  if (!document.getElementById("hamburgerBtn")) {
    const btn = document.createElement("button");
    btn.id = "hamburgerBtn";
    btn.className = "hamburgerBtn";
    btn.type = "button";
    btn.onclick = openClinicMenu;
    holder.appendChild(btn);
  }
}
window.openThemeMenu = function() {
  const modal = document.createElement("div");
  modal.className = "luxuryModal";
  modal.innerHTML = `
    <div class="luxuryBox" style="max-width:520px;">
      <h2>Choose Theme</h2>
      <div class="themePalette">
        <button style="background:#d4af37" onclick="setClinicTheme('gold')">Gold</button>
        <button style="background:#ff4fa3" onclick="setClinicTheme('pink')">Pink</button>
        <button style="background:#ef4444" onclick="setClinicTheme('red')">Red</button>
        <button style="background:#3b82f6" onclick="setClinicTheme('blue')">Blue</button>
        <button style="background:#06b6d4" onclick="setClinicTheme('cyan')">Cyan</button>
        <button style="background:#8b5cf6" onclick="setClinicTheme('purple')">Purple</button>
        <button style="background:#22c55e" onclick="setClinicTheme('green')">Green</button>
        <button style="background:#f97316" onclick="setClinicTheme('orange')">Orange</button>
      </div>
      <button class="secondary" style="width:100%;margin-top:14px" onclick="this.closest('.luxuryModal').remove()">Close</button>
    </div>`;
  document.body.appendChild(modal);
};
window.openSimplePhotoViewer = function(patientId, index = 0) {
  const p = patients.find(x => x.id === patientId);
  if (!p) return;
  const currentType = window.simplePhotoState?.[patientId]?.type || "clinical";
  const cats = categorizedPhotos(p);
  const list = currentType === "xray" ? cats.xrays : cats.clinical;
  const fallback = currentType === "xray" ? cats.clinical : cats.xrays;
  const photos = (list.length ? list : fallback).map(x => x.url);
  if (!photos.length) return;
  window.simplePhotoState = window.simplePhotoState || {};
  window.simplePhotoState[patientId] = { type: currentType, photos, index };
  document.getElementById("fullPhotoViewer")?.remove();
  const viewer = document.createElement("div");
  viewer.className = "fullPhotoViewer";
  viewer.id = "fullPhotoViewer";
  viewer.innerHTML = `
    <div class="fullPhotoTop">
      <span class="fullPhotoCounter">${index + 1} / ${photos.length}</span>
      <button onclick="closeSimplePhotoViewer()">Ã</button>
    </div>
    <img src="${photos[index]}">
    <div class="fullPhotoNav">
      <button onclick="moveSimplePhoto('${patientId}', -1)">Previous</button>
      <button onclick="moveSimplePhoto('${patientId}', 1)">Next</button>
    </div>`;
  document.body.appendChild(viewer);
};
window.moveSimplePhoto = function(patientId, step) {
  const s = window.simplePhotoState?.[patientId];
  if (!s || !s.photos?.length) return;
  s.index = (s.index + step + s.photos.length) % s.photos.length;
  openSimplePhotoViewer(patientId, s.index);
};
window.closeSimplePhotoViewer = function() { document.getElementById("fullPhotoViewer")?.remove(); };
window.showBeforeAfter = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const photos = (p.photos || []).map(photoUrl).filter(Boolean);
  if (photos.length < 2) return alert("Need at least 2 photos.");
  const modal = document.createElement("div");
  modal.className = "luxuryModal";
  modal.innerHTML = `
    <div class="luxuryBox" style="max-width:760px;">
      <h2>Before / After</h2>
      <div class="beforeAfterSwipe">
        <span class="label before">Before</span>
        <span class="label after">After</span>
        <img src="${photos[0]}">
        <div class="afterClip" id="afterClip"><img src="${photos[1]}"></div>
        <input type="range" min="0" max="100" value="50" id="beforeAfterRange">
      </div>
      <button class="secondary" style="width:100%" onclick="this.closest('.luxuryModal').remove()">Close</button>
    </div>`;
  document.body.appendChild(modal);
  const range = modal.querySelector("#beforeAfterRange");
  const clip = modal.querySelector("#afterClip");
  range.oninput = () => clip.style.clipPath = `inset(0 0 0 ${range.value}%)`;
};
try { applySavedTheme(); enhancePremiumHeader(); } catch(e) {}
try { document.querySelectorAll('button').forEach(b => { if ((b.textContent || '').trim() === 'Settings') b.style.display = 'none'; }); } catch(e) {}


/* FINAL CLEAN OVERRIDES */
function enhancePremiumHeader() {
  const brand = document.querySelector(".brand");
  if (brand) {
    const h1 = brand.querySelector("h1");
    if (h1 && !brand.querySelector(".clinicLogoPremium")) h1.insertAdjacentHTML("beforebegin", clinicLogoMarkup());
    brand.classList.add("brandWrapPremium");
  }
  const holder = brand?.parentElement || document.body;
  if (!document.getElementById("hamburgerBtn")) {
    const btn = document.createElement("button");
    btn.id = "hamburgerBtn";
    btn.className = "hamburgerBtn";
    btn.type = "button";
    btn.textContent = "";
    btn.onclick = openClinicMenu;
    holder.appendChild(btn);
  } else {
    document.getElementById("hamburgerBtn").textContent = "Menu";
  }
}

window.openSimplePhotoViewer = function(patientId, index = 0) {
  const p = patients.find(x => x.id === patientId);
  if (!p) return;
  const currentType = window.simplePhotoState?.[patientId]?.type || "clinical";
  const cats = categorizedPhotos(p);
  const list = currentType === "xray" ? cats.xrays : cats.clinical;
  const fallback = currentType === "xray" ? cats.clinical : cats.xrays;
  const photos = (list.length ? list : fallback).map(x => x.url);
  if (!photos.length) return;
  window.simplePhotoState = window.simplePhotoState || {};
  window.simplePhotoState[patientId] = { type: currentType, photos, index };

  document.getElementById("fullPhotoViewer")?.remove();
  const viewer = document.createElement("div");
  viewer.className = "fullPhotoViewer";
  viewer.id = "fullPhotoViewer";
  viewer.innerHTML = `
    <div class="fullPhotoTop">
      <span class="fullPhotoCounter">${index + 1} / ${photos.length}</span>
      <button onclick="closeSimplePhotoViewer()" aria-label="Close"></button>
    </div>
    <img src="${photos[index]}">
    <div class="fullPhotoNav">
      <button onclick="moveSimplePhoto('${patientId}', -1)">Previous</button>
      <button onclick="moveSimplePhoto('${patientId}', 1)">Next</button>
    </div>`;
  document.body.appendChild(viewer);
};

try { enhancePremiumHeader(); } catch(e) {}


/* HOTFIX FUNCTION OVERRIDES */
function enhancePremiumHeader() {
  const brand = document.querySelector(".brand");
  if (brand) {
    const h1 = brand.querySelector("h1");
    if (h1 && !brand.querySelector(".clinicLogoPremium")) h1.insertAdjacentHTML("beforebegin", clinicLogoMarkup());
    brand.classList.add("brandWrapPremium");
  }

  const holder = brand?.parentElement || document.body;
  let btn = document.getElementById("hamburgerBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "hamburgerBtn";
    btn.className = "hamburgerBtn";
    btn.type = "button";
    btn.onclick = openClinicMenu;
    holder.appendChild(btn);
  }
  btn.textContent = "";
  btn.setAttribute("aria-label", "Menu");
}

window.openSimplePhotoViewer = function(patientId, index = 0) {
  const p = patients.find(x => x.id === patientId);
  if (!p) return;

  const currentType = window.simplePhotoState?.[patientId]?.type || "clinical";
  const cats = categorizedPhotos(p);
  const list = currentType === "xray" ? cats.xrays : cats.clinical;
  const fallback = currentType === "xray" ? cats.clinical : cats.xrays;
  const photos = (list.length ? list : fallback).map(x => x.url);
  if (!photos.length) return;

  window.simplePhotoState = window.simplePhotoState || {};
  window.simplePhotoState[patientId] = { type: currentType, photos, index };

  document.getElementById("fullPhotoViewer")?.remove();
  const viewer = document.createElement("div");
  viewer.className = "fullPhotoViewer";
  viewer.id = "fullPhotoViewer";
  viewer.innerHTML = `
    <div class="fullPhotoTop">
      <span class="fullPhotoCounter">${index + 1} / ${photos.length}</span>
      <button onclick="closeSimplePhotoViewer()" aria-label="Close"></button>
    </div>
    <img src="${photos[index]}">
    <div class="fullPhotoNav">
      <button onclick="moveSimplePhoto('${patientId}', -1)">Previous</button>
      <button onclick="moveSimplePhoto('${patientId}', 1)">Next</button>
    </div>`;
  document.body.appendChild(viewer);
};

try { enhancePremiumHeader(); } catch(e) {}


/* FINAL DRAWER AND BEFORE/AFTER OVERRIDES */
window.openClinicMenu = function() {
  closeClinicMenu();
  const overlay = document.createElement("div");
  overlay.className = "drawerOverlay";
  overlay.id = "drawerOverlay";
  overlay.onclick = closeClinicMenu;

  const drawer = document.createElement("aside");
  drawer.className = "sideDrawer";
  drawer.id = "sideDrawer";
  drawer.innerHTML = `
    <div class="drawerHead">
      <h2>Menu</h2>
      <button class="drawerClose" onclick="closeClinicMenu()" aria-label="Close">Ã</button>
    </div>
    <div class="drawerUser">
      <div>${safeText(currentUser?.full_name || currentUser?.username || "Doctor")}</div>
      <small>${safeText((currentUser?.role || "doctor").toUpperCase())}</small>
    </div>
    <div class="drawerMenu">
      <button class="primaryItem" onclick="closeClinicMenu(); showPage('dashboard')">Dashboard</button>
      <button onclick="closeClinicMenu(); showPage('patients')">Patients</button>
      <button onclick="closeClinicMenu(); showPage('settings')">Profile / Branding</button>
      <button onclick="closeClinicMenu(); backupData()">Backup</button>
      <button onclick="closeClinicMenu(); restoreBackup()">Restore</button>
      <button onclick="closeClinicMenu(); alert('Open a patient file and use WhatsApp Reminder from patient tools.')">Reminders</button>
      <button onclick="closeClinicMenu(); backupData()">Daily Backup</button>
      <button onclick="closeClinicMenu(); typeof addUser==='function' ? addUser() : alert('Users are managed by admin setup.')">Users</button>
      <button onclick="closeClinicMenu(); openThemeMenu()">Themes</button>
      <button class="dangerItem" onclick="logout()">Logout</button>
    </div>`;
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
};

window.showBeforeAfter = function(id) {
  const p = patients.find(x => x.id === id);
  if (!p) return;
  const photos = (p.photos || []).map(photoUrl).filter(Boolean);
  if (photos.length < 2) return alert("Need at least 2 photos.");

  let before = 0;
  let after = 1;

  const modal = document.createElement("div");
  modal.className = "luxuryModal";
  modal.innerHTML = `
    <div class="luxuryBox" style="max-width:760px;">
      <h2>Choose Before / After</h2>
      <p style="color:var(--muted);font-weight:900;margin:6px 0 10px">Select one before image and one after image.</p>
      <div class="baPickerGrid" id="baPickerGrid"></div>
      <button class="primary" style="width:100%;margin-top:8px" id="baShowBtn">Show Swipe</button>
      <button class="secondary" style="width:100%;margin-top:8px" onclick="this.closest('.luxuryModal').remove()">Close</button>
    </div>`;
  document.body.appendChild(modal);

  const grid = modal.querySelector("#baPickerGrid");
  const renderPicker = () => {
    grid.innerHTML = photos.map((url, i) => `
      <div class="baPickCard ${i === before ? "selectedBefore" : ""} ${i === after ? "selectedAfter" : ""}">
        <img src="${url}">
        <div class="baPickActions">
          <button class="${i === before ? "active" : ""}" data-i="${i}" data-kind="before">Before</button>
          <button class="${i === after ? "active" : ""}" data-i="${i}" data-kind="after">After</button>
        </div>
      </div>`).join("");
    grid.querySelectorAll("button").forEach(btn => {
      btn.onclick = () => {
        const i = Number(btn.dataset.i);
        if (btn.dataset.kind === "before") before = i;
        if (btn.dataset.kind === "after") after = i;
        if (before === after) after = (before + 1) % photos.length;
        renderPicker();
      };
    });
  };
  renderPicker();

  modal.querySelector("#baShowBtn").onclick = () => {
    modal.querySelector(".luxuryBox").innerHTML = `
      <h2>Before / After</h2>
      <div class="beforeAfterSwipe">
        <span class="label before">Before</span>
        <span class="label after">After</span>
        <img src="${photos[before]}">
        <div class="afterClip" id="afterClip"><img src="${photos[after]}"></div>
        <input type="range" min="0" max="100" value="50" id="beforeAfterRange">
      </div>
      <button class="secondary" style="width:100%" onclick="this.closest('.luxuryModal').remove()">Close</button>`;
    const range = modal.querySelector("#beforeAfterRange");
    const clip = modal.querySelector("#afterClip");
    range.oninput = () => clip.style.clipPath = `inset(0 0 0 ${range.value}%)`;
  };
};


/* ABSOLUTE FINAL DRAWER OVERRIDE */
window.openClinicMenu = function() {
  closeClinicMenu();
  const overlay = document.createElement("div");
  overlay.className = "drawerOverlay";
  overlay.id = "drawerOverlay";
  overlay.onclick = closeClinicMenu;

  const drawer = document.createElement("aside");
  drawer.className = "sideDrawer";
  drawer.id = "sideDrawer";
  drawer.innerHTML = `
    <div class="drawerHead">
      <h2>Menu</h2>
      <button class="drawerClose" onclick="closeClinicMenu()" aria-label="Close">Ã</button>
    </div>
    <div class="drawerUser">
      <div>${safeText(currentUser?.full_name || currentUser?.username || "Doctor")}</div>
      <small>${safeText((currentUser?.role || "doctor").toUpperCase())}</small>
    </div>
    <div class="drawerMenu">
      <button class="primaryItem" onclick="closeClinicMenu(); showPage('dashboard')">Dashboard</button>
      <button onclick="closeClinicMenu(); showPage('patients')">Patients</button>
      <button onclick="closeClinicMenu(); showPage('settings')">Profile / Branding</button>
      <button onclick="closeClinicMenu(); backupData()">Backup</button>
      <button onclick="closeClinicMenu(); restoreBackup()">Restore</button>
      <button onclick="closeClinicMenu(); alert('Open a patient file and use WhatsApp Reminder from patient tools.')">Reminders</button>
      <button onclick="closeClinicMenu(); backupData()">Daily Backup</button>
      <button onclick="closeClinicMenu(); typeof addUser==='function' ? addUser() : alert('Users are managed by admin setup.')">Users</button>
      <button onclick="closeClinicMenu(); openThemeMenu()">Themes</button>
      <button class="dangerItem" onclick="logout()">Logout</button>
    </div>`;
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
};


/* FINAL TIDY DRAWER OVERRIDE */
window.openClinicMenu = function() {
  closeClinicMenu();
  const overlay = document.createElement("div");
  overlay.className = "drawerOverlay";
  overlay.id = "drawerOverlay";
  overlay.onclick = closeClinicMenu;

  const drawer = document.createElement("aside");
  drawer.className = "sideDrawer";
  drawer.id = "sideDrawer";
  drawer.innerHTML = `
    <div class="drawerHead">
      <h2>Menu</h2>
      <button class="drawerClose" onclick="closeClinicMenu()" aria-label="Close">Ã</button>
    </div>
    <div class="drawerUser">
      <div>${safeText(currentUser?.full_name || currentUser?.username || "Doctor")}</div>
      <small>${safeText((currentUser?.role || "doctor").toUpperCase())}</small>
    </div>
    <div class="drawerMenu">
      <button class="primaryItem" onclick="closeClinicMenu(); showPage('dashboard')">Dashboard</button>
      <button onclick="closeClinicMenu(); showPage('patients')">Patients</button>
      <button onclick="closeClinicMenu(); showPage('settings')">Profile / Branding</button>
      <button onclick="closeClinicMenu(); backupData()">Backup</button>
      <button onclick="closeClinicMenu(); restoreBackup()">Restore</button>
      <button onclick="closeClinicMenu(); alert('Open a patient file and use WhatsApp Reminder from patient tools.')">Reminders</button>
      <button onclick="closeClinicMenu(); backupData()">Daily Backup</button>
      <button onclick="closeClinicMenu(); typeof addUser==='function' ? addUser() : alert('Users are managed by admin setup.')">Users</button>
      <button onclick="closeClinicMenu(); openThemeMenu()">Themes</button>
      <button class="dangerItem" onclick="logout()">Logout</button>
    </div>`;
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
};
