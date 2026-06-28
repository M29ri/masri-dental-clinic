/* FINAL REPAIR 2026-06-28
   Replaces the broken duplicate menu/photo click handlers with one stable layer.
*/
(function(){
  'use strict';
  const $ = (id)=>document.getElementById(id);
  const esc = (v)=>String(v ?? '').replace(/[&<>'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
  const lang = ()=>localStorage.getItem('clinicLanguage') || 'en';
  const rtlLangs = new Set(['ar','ur','he','fa']);
  const WORDS = {
    en:{menu:'Menu',addPatient:'Add Patient',scanQR:'Scan QR',settings:'Settings',profile:'Profile',manageUsers:'Manage Users',logout:'Logout',clinical:'Clinical',xray:'X-ray',beforeAfter:'Before / After',general:'General',before:'Before',after:'After',photos:'Photos / X-rays',patientTimeline:'Patient Timeline',photoType:'Photo type',markAs:'Mark photo as',chooseBA:'Choose before and after',blendHint:'Move the blend bar for a soft transition.',noClinical:'No clinical photos yet',noXray:'No X-rays yet',close:'Close'},
    ar:{menu:'القائمة',addPatient:'إضافة مريض',scanQR:'مسح QR',settings:'الإعدادات',profile:'الملف الشخصي',manageUsers:'إدارة المستخدمين',logout:'تسجيل الخروج',clinical:'سريري',xray:'أشعة',beforeAfter:'قبل / بعد',general:'عام',before:'قبل',after:'بعد',photos:'الصور / الأشعة',patientTimeline:'تاريخ المريض',photoType:'نوع الصورة',markAs:'حدد نوع الصورة',chooseBA:'اختر صور قبل وبعد',blendHint:'حرك شريط الدمج لانتقال ناعم.',noClinical:'لا توجد صور سريرية',noXray:'لا توجد أشعة',close:'إغلاق'},
    fr:{menu:'Menu',addPatient:'Ajouter patient',scanQR:'Scanner QR',settings:'Paramètres',profile:'Profil',manageUsers:'Utilisateurs',logout:'Déconnexion',clinical:'Clinique',xray:'Radio',beforeAfter:'Avant / Après',general:'Général',before:'Avant',after:'Après',photos:'Photos / Radios',patientTimeline:'Timeline patient',photoType:'Type de photo',markAs:'Marquer la photo',chooseBA:'Choisir avant et après',blendHint:'Déplacez la barre pour une transition douce.',noClinical:'Aucune photo clinique',noXray:'Aucune radio',close:'Fermer'},
    es:{menu:'Menú',addPatient:'Añadir paciente',scanQR:'Escanear QR',settings:'Ajustes',profile:'Perfil',manageUsers:'Usuarios',logout:'Salir',clinical:'Clínica',xray:'Rayos X',beforeAfter:'Antes / Después',general:'General',before:'Antes',after:'Después',photos:'Fotos / Rayos X',patientTimeline:'Cronología',photoType:'Tipo de foto',markAs:'Marcar foto',chooseBA:'Elegir antes y después',blendHint:'Mueve la barra para una transición suave.',noClinical:'Sin fotos clínicas',noXray:'Sin rayos X',close:'Cerrar'}
  };
  function tr(k,fallback){ const p=WORDS[lang()] || WORDS.en; return p[k] || WORDS.en[k] || fallback || k; }
  function currentPatients(){ return window.patients || (typeof patients !== 'undefined' ? patients : []); }
  function currentUserObj(){ return window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null); }
  function closeMenu(){ $('drawerOverlay')?.remove(); $('sideDrawer')?.remove(); }
  function openMenu(){
    closeMenu();
    const user = currentUserObj() || {};
    const ov = document.createElement('div'); ov.id='drawerOverlay'; ov.className='drawer-overlay'; ov.setAttribute('data-final-repair','1');
    const d = document.createElement('aside'); d.id='sideDrawer'; d.className='side-drawer repair-menu'; d.setAttribute('data-final-repair','1');
    d.innerHTML = `<div class="drawer-head"><button type="button" class="drawer-close-btn repair-close" data-repair-action="close-menu">×</button><h2>${esc(tr('menu','Menu'))}</h2></div>
      <div class="drawer-user"><div>${esc(user.full_name || user.username || 'Doctor')}</div><small>${esc(String(user.role || 'doctor').toUpperCase())}</small></div>
      <div class="drawer-menu repair-menu-list">
        <button type="button" data-repair-page="form">${esc(tr('addPatient','Add Patient'))}</button>
        <button type="button" data-repair-page="scan">${esc(tr('scanQR','Scan QR'))}</button>
        <button type="button" class="primary-item" data-repair-page="settings">${esc(tr('settings','Settings'))}</button>
        <button type="button" data-repair-action="profile">${esc(tr('profile','Profile'))}</button>
        ${user.role === 'admin' ? `<button type="button" data-repair-action="manage-users">${esc(tr('manageUsers','Manage Users'))}</button>` : ''}
        <button type="button" class="danger-item" data-repair-action="logout">${esc(tr('logout','Logout'))}</button>
      </div>`;
    document.body.appendChild(ov); document.body.appendChild(d);
  }
  window.closeClinicMenu = closeMenu;
  window.openClinicMenu = openMenu;
  function bindMenuBtn(){
    const btn=$('menuBtn'); if(!btn || btn.dataset.repairBound==='1') return;
    const clone=btn.cloneNode(true); clone.dataset.repairBound='1'; clone.removeAttribute('onclick'); clone.textContent=tr('menu','Menu');
    clone.addEventListener('click', function(e){ e.preventDefault(); e.stopImmediatePropagation(); openMenu(); return false; }, true);
    btn.replaceWith(clone);
  }
  document.addEventListener('click', function(e){
    const menuBtn=e.target.closest && e.target.closest('#menuBtn');
    if(menuBtn){ e.preventDefault(); e.stopImmediatePropagation(); openMenu(); return; }
    if(e.target.id==='drawerOverlay'){ e.preventDefault(); closeMenu(); return; }
    const page=e.target.closest && e.target.closest('[data-repair-page]');
    if(page){ e.preventDefault(); e.stopPropagation(); closeMenu(); window.showPage && window.showPage(page.dataset.repairPage); return; }
    const act=e.target.closest && e.target.closest('[data-repair-action]');
    if(act){ e.preventDefault(); e.stopPropagation(); const a=act.dataset.repairAction; if(a==='close-menu') closeMenu(); if(a==='profile'&&window.openDoctorProfile) window.openDoctorProfile(); if(a==='manage-users'&&window.manageUsers) window.manageUsers(); if(a==='logout'&&window.logout) window.logout(); return; }
    const photoTab=e.target.closest && e.target.closest('[data-photo-tab]');
    if(photoTab){ e.preventDefault(); e.stopPropagation(); const p=findPatient(photoTab.dataset.patientId); const box=$('repairPhotoZone'); if(p&&box) box.innerHTML=renderPhotos(p, photoTab.dataset.photoTab); return; }
    const photoView=e.target.closest && e.target.closest('[data-photo-view]');
    if(photoView){ e.preventDefault(); e.stopPropagation(); openPhotoViewer(photoView.dataset.patientId, +photoView.dataset.photoView); return; }
    const photoDots=e.target.closest && e.target.closest('[data-photo-menu]');
    if(photoDots){ e.preventDefault(); e.stopPropagation(); openPhotoSheet(photoDots.dataset.patientId, +photoDots.dataset.photoMenu); return; }
    const set=e.target.closest && e.target.closest('[data-set-photo]');
    if(set){ e.preventDefault(); e.stopPropagation(); setPhotoMeta(set.dataset.patientId, +set.dataset.index, set.dataset.field, set.dataset.value); return; }
    const ba=e.target.closest && e.target.closest('[data-ba-open]');
    if(ba){ e.preventDefault(); e.stopPropagation(); openBeforeAfter(ba.dataset.baOpen); return; }
    const baPick=e.target.closest && e.target.closest('[data-ba-pick]');
    if(baPick){ e.preventDefault(); e.stopPropagation(); pickBA(baPick.dataset.baPick, +baPick.dataset.index); return; }
  }, true);

  function photoUrl(raw){ return typeof raw === 'string' ? raw : (raw?.url || raw?.publicUrl || raw?.path || raw?.src || ''); }
  function metaKey(pid){ return 'clinicPhotoMeta:' + pid; }
  function loadMeta(pid){ try{return JSON.parse(localStorage.getItem(metaKey(pid))||'{}')}catch{return {}} }
  function saveMeta(pid,m){ localStorage.setItem(metaKey(pid), JSON.stringify(m||{})); }
  function findPatient(id){ return currentPatients().find(p=>String(p.id)===String(id)); }
  function normalizePhoto(patient, raw, index){
    const url=photoUrl(raw); const meta=loadMeta(patient.id)[url] || {}; const name=String(raw?.name || raw?.filename || raw?.path || raw?.url || url || '').toLowerCase();
    let category=String(meta.category || raw?.category || raw?.photoCategory || raw?.type || '').toLowerCase();
    if(category==='x-ray') category='xray';
    if(category!=='clinical' && category!=='xray') category=(name.includes('xray') || name.includes('x-ray') || name.includes('radiograph') || name.includes('radio')) ? 'xray' : 'clinical';
    let stage=String(meta.stage || raw?.stage || raw?.photoStage || raw?.phase || '').toLowerCase();
    if(!['general','before','after'].includes(stage)) stage='general';
    return {raw,index,url,category,stage,name: raw?.name || raw?.filename || `Photo ${index+1}`};
  }
  function photosOf(patient){ return (patient.photos||[]).map((r,i)=>normalizePhoto(patient,r,i)).filter(x=>x.url); }
  window.categorizedPhotos = function(patient){ const all=photosOf(patient); return {all, clinical:all.filter(x=>x.category==='clinical'), xray:all.filter(x=>x.category==='xray'), xrays:all.filter(x=>x.category==='xray')}; };
  async function setPhotoMeta(pid,index,field,value){
    const p=findPatient(pid); if(!p) return;
    const raw=(p.photos||[])[index]; const url=photoUrl(raw); if(!url) return;
    const meta=loadMeta(pid); meta[url]=Object.assign({}, meta[url]||{}, {[field]:value}); saveMeta(pid,meta);
    if(typeof raw === 'object' && raw){ raw[field]=value; if(field==='category') raw.photoCategory=value; if(field==='stage') raw.photoStage=value; }
    else { p.photos[index]={url, path:url, name:`Photo ${index+1}`, category: field==='category'?value:'clinical', stage: field==='stage'?value:'general'}; }
    $('repairPhotoSheet')?.remove();
    const box=$('repairPhotoZone'); if(box) box.innerHTML=renderPhotos(p, window.__repairPhotoTab || 'clinical');
    try{ if(typeof api === 'function') await api(`patients?id=eq.${pid}`, {method:'PATCH', body:JSON.stringify({photos:p.photos})}); }catch(e){ console.warn('Photo update saved locally only', e); }
    if(typeof toast==='function') toast('Photo updated');
  }
  function renderPhotos(patient, tab='clinical'){
    window.__repairPhotoTab=tab;
    const all=photosOf(patient); const clinical=all.filter(x=>x.category==='clinical'); const xray=all.filter(x=>x.category==='xray'); const list=tab==='xray'?xray:clinical;
    return `<div class="repair-photo-tabs" data-photo-controls="1">
      <button type="button" class="${tab==='clinical'?'active':''}" data-patient-id="${esc(patient.id)}" data-photo-tab="clinical" onclick="return window.repairSetPhotoTab('${esc(patient.id)}','clinical',event)">${esc(tr('clinical'))} <small>${clinical.length}</small></button>
      <button type="button" class="${tab==='xray'?'active':''}" data-patient-id="${esc(patient.id)}" data-photo-tab="xray" onclick="return window.repairSetPhotoTab('${esc(patient.id)}','xray',event)">${esc(tr('xray'))} <small>${xray.length}</small></button>
      <button type="button" data-ba-open="${esc(patient.id)}" onclick="return window.repairOpenBeforeAfter('${esc(patient.id)}',event)">${esc(tr('beforeAfter'))}</button>
    </div>
    <div class="repair-photo-grid" data-photo-grid="1">${list.length ? list.map((ph,displayIndex)=>`<div class="repair-photo-card">
        <button type="button" class="repair-photo-image" data-patient-id="${esc(patient.id)}" data-photo-view="${displayIndex}" onclick="return window.repairOpenPhoto('${esc(patient.id)}',${displayIndex},event)"><img src="${esc(ph.url)}" alt=""><span>${esc(ph.category==='xray'?tr('xray'):tr('clinical'))} · ${esc(ph.stage==='before'?tr('before'):ph.stage==='after'?tr('after'):tr('general'))}</span></button>
        <button type="button" class="repair-photo-dots" aria-label="Photo options" data-patient-id="${esc(patient.id)}" data-photo-menu="${ph.index}" onclick="return window.repairOpenPhotoMenu('${esc(patient.id)}',${ph.index},event)">⋯</button>
      </div>`).join('') : `<div class="repair-photo-empty">${esc(tab==='xray'?tr('noXray'):tr('noClinical'))}</div>`}</div>`;
  }
  window.renderPhotoSection = function(p,type){ return renderPhotos(p,type); };
  window.switchSimplePhotoType = function(pid,type){ const p=findPatient(pid); const box=$('repairPhotoZone') || $('simplePhotosBox') || $('mdPhotoZone'); if(p&&box) box.innerHTML=renderPhotos(p,type); };
  function openPhotoViewer(pid, displayIndex){
    const p=findPatient(pid); if(!p) return; const c=window.categorizedPhotos(p); const list=(window.__repairPhotoTab==='xray'?c.xray:c.clinical); if(!list.length) return;
    window.currentPhotoList=list.map(x=>x.url); window.currentPhotoIndex=displayIndex||0;
    const v=$('photoViewer'), img=$('viewerImage'); if(v&&img){ img.src=window.currentPhotoList[window.currentPhotoIndex]; v.classList.remove('hidden'); }
  }
  function openPhotoSheet(pid,index){
    const p=findPatient(pid); if(!p) return; const ph=photosOf(p).find(x=>x.index===index); if(!ph) return;
    $('repairPhotoSheet')?.remove();
    const ov=document.createElement('div'); ov.id='repairPhotoSheet'; ov.className='repair-sheet-overlay';
    ov.innerHTML=`<div class="repair-sheet"><div class="repair-sheet-head"><div><b>${esc(tr('markAs'))}</b><span>${esc(ph.name)}</span></div><button type="button" onclick="document.getElementById('repairPhotoSheet')?.remove()">×</button></div>
      <img class="repair-sheet-preview" src="${esc(ph.url)}" alt="">
      <div class="repair-sheet-grid">
        <button type="button" class="${ph.category==='clinical'?'active':''}" data-patient-id="${esc(pid)}" data-index="${index}" data-field="category" data-value="clinical" data-set-photo="1">${esc(tr('clinical'))}</button>
        <button type="button" class="${ph.category==='xray'?'active':''}" data-patient-id="${esc(pid)}" data-index="${index}" data-field="category" data-value="xray" data-set-photo="1">${esc(tr('xray'))}</button>
        <button type="button" class="${ph.stage==='general'?'active':''}" data-patient-id="${esc(pid)}" data-index="${index}" data-field="stage" data-value="general" data-set-photo="1">${esc(tr('general'))}</button>
        <button type="button" class="${ph.stage==='before'?'active':''}" data-patient-id="${esc(pid)}" data-index="${index}" data-field="stage" data-value="before" data-set-photo="1">${esc(tr('before'))}</button>
        <button type="button" class="${ph.stage==='after'?'active':''}" data-patient-id="${esc(pid)}" data-index="${index}" data-field="stage" data-value="after" data-set-photo="1">${esc(tr('after'))}</button>
      </div></div>`;
    ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); }); document.body.appendChild(ov);
  }
  function openBeforeAfter(pid){
    const p=findPatient(pid); if(!p) return; const all=photosOf(p); if(all.length<2){ alert('Add at least two photos first.'); return; }
    let before=all.findIndex(x=>x.stage==='before'); if(before<0) before=0; let after=all.findIndex((x,i)=>x.stage==='after'&&i!==before); if(after<0) after=before===0?1:0;
    $('repairBA')?.remove();
    const ov=document.createElement('div'); ov.id='repairBA'; ov.className='repair-ba-overlay';
    ov.innerHTML=`<div class="repair-ba-dialog"><div class="repair-ba-head"><div><h2>${esc(tr('beforeAfter'))}</h2><p>${esc(tr('blendHint'))}</p></div><button type="button" onclick="document.getElementById('repairBA')?.remove()">×</button></div>
      <h4>${esc(tr('chooseBA'))}</h4><div id="repairBAChoices" class="repair-ba-choices"></div>
      <div class="repair-ba-stage"><img id="repairBABefore" class="repair-ba-before" src="${esc(all[before].url)}"><img id="repairBAAfter" class="repair-ba-after" src="${esc(all[after].url)}"><span class="repair-ba-label before">${esc(tr('before'))}</span><span class="repair-ba-label after">${esc(tr('after'))}</span><div id="repairBABlur" class="repair-ba-blur"></div><input id="repairBARange" type="range" min="0" max="100" value="50"></div></div>`;
    document.body.appendChild(ov); window.__repairBA={patient:p,all,before,after}; renderBAChoices(); $('repairBARange').addEventListener('input', updateBlend); ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); }); updateBlend();
  }
  function renderBAChoices(){
    const s=window.__repairBA; if(!s) return; const box=$('repairBAChoices'); if(!box) return;
    box.innerHTML=s.all.map((ph,i)=>`<div class="repair-ba-choice"><img src="${esc(ph.url)}" alt=""><div><b>${esc(ph.category==='xray'?tr('xray'):tr('clinical'))}</b><span>${esc(ph.stage==='before'?tr('before'):ph.stage==='after'?tr('after'):tr('general'))}</span></div><button type="button" class="${s.before===i?'active':''}" data-ba-pick="before" data-index="${i}">${esc(tr('before'))}</button><button type="button" class="${s.after===i?'active':''}" data-ba-pick="after" data-index="${i}">${esc(tr('after'))}</button></div>`).join('');
  }
  function pickBA(which,i){ const s=window.__repairBA; if(!s) return; s[which]=i; $('repairBABefore').src=s.all[s.before].url; $('repairBAAfter').src=s.all[s.after].url; renderBAChoices(); updateBlend(); }
  function updateBlend(){ const r=$('repairBARange'), after=$('repairBAAfter'), blur=$('repairBABlur'); if(!r||!after||!blur) return; const v=+r.value; after.style.opacity=(v/100).toFixed(2); after.style.filter=`blur(${Math.max(0, 10 - Math.abs(v-50)/5)}px)`; blur.style.left=v+'%'; }
  window.showBeforeAfter = openBeforeAfter;

  function replacePhotoSection(html, p){
    const title=`<h3 class="repair-section-title">${esc(tr('photos'))}</h3><div id="repairPhotoZone">${renderPhotos(p, window.__repairPhotoTab || 'clinical')}</div><h3 class="repair-section-title">${esc(tr('patientTimeline'))}</h3>`;
    let out = html.replace(/<h3[^>]*>Photos\s*\/\s*X-rays<\/h3>[\s\S]*?<h3[^>]*>Patient Timeline<\/h3>/i, title);
    out = out.replace(/<h3[^>]*>الصور\s*\/\s*الأشعة<\/h3>[\s\S]*?<h3[^>]*>تاريخ المريض<\/h3>/i, title);
    if(out===html && !html.includes('repairPhotoZone')) out += title;
    return out;
  }
  function wrapDetails(){
    if(typeof window.patientDetailsHTML === 'function' && !window.patientDetailsHTML.__repairWrapped){
      const old=window.patientDetailsHTML;
      const fn=function(p){ return replacePhotoSection(old(p), p); };
      fn.__repairWrapped=true;
      window.patientDetailsHTML = fn;
      try{ patientDetailsHTML = fn; }catch{}
    }
  }
  function sanitizeOpenMenu(){
    window.openClinicMenu=openMenu; window.closeClinicMenu=closeMenu;
    const d=$('sideDrawer'); if(d && !d.dataset.finalRepair){ openMenu(); }
  }
  const boot=()=>{ bindMenuBtn(); wrapDetails(); sanitizeOpenMenu(); document.documentElement.dir = rtlLangs.has(lang()) ? 'rtl' : 'ltr'; };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  const mo=new MutationObserver(()=>{ bindMenuBtn(); wrapDetails(); const d=$('sideDrawer'); if(d && !d.dataset.finalRepair){ d.remove(); openMenu(); } });
  try{ mo.observe(document.documentElement,{childList:true,subtree:true}); }catch{}
  setInterval(boot, 800);

  /* Robust mobile photo controls: iPhone Safari sometimes selects text instead of firing click.
     These public functions and capture listeners make the photo tabs, 3-dot menu, and before/after work reliably. */
  window.repairSetPhotoTab = function(pid, tab, ev){
    try{ if(ev){ev.preventDefault(); ev.stopPropagation();} }catch(e){}
    const p=findPatient(pid); const box=$('repairPhotoZone');
    if(p && box) box.innerHTML=renderPhotos(p, tab);
    return false;
  };
  window.repairOpenPhotoMenu = function(pid, index, ev){
    try{ if(ev){ev.preventDefault(); ev.stopPropagation();} }catch(e){}
    openPhotoSheet(pid, Number(index));
    return false;
  };
  window.repairOpenPhoto = function(pid, index, ev){
    try{ if(ev){ev.preventDefault(); ev.stopPropagation();} }catch(e){}
    openPhotoViewer(pid, Number(index));
    return false;
  };
  window.repairOpenBeforeAfter = function(pid, ev){
    try{ if(ev){ev.preventDefault(); ev.stopPropagation();} }catch(e){}
    openBeforeAfter(pid);
    return false;
  };

  let lastRepairTap=0;
  function repairHandleDirectTap(ev){
    const now=Date.now();
    if(now-lastRepairTap<180) return;
    const t=ev.target && (ev.target.closest('[data-photo-menu]') || ev.target.closest('[data-photo-tab]') || ev.target.closest('[data-ba-open]') || ev.target.closest('[data-photo-view]') || ev.target.closest('[data-set-photo]') || ev.target.closest('[data-ba-pick]'));
    if(!t) return;
    lastRepairTap=now;
    ev.preventDefault(); ev.stopPropagation();
    if(t.dataset.photoMenu!=null) return openPhotoSheet(t.dataset.patientId, Number(t.dataset.photoMenu));
    if(t.dataset.photoTab) { const p=findPatient(t.dataset.patientId); const box=$('repairPhotoZone'); if(p&&box) box.innerHTML=renderPhotos(p,t.dataset.photoTab); return; }
    if(t.dataset.baOpen) return openBeforeAfter(t.dataset.baOpen);
    if(t.dataset.photoView!=null) return openPhotoViewer(t.dataset.patientId, Number(t.dataset.photoView));
    if(t.dataset.setPhoto) return setPhotoMeta(t.dataset.patientId, Number(t.dataset.index), t.dataset.field, t.dataset.value);
    if(t.dataset.baPick) return pickBA(t.dataset.baPick, Number(t.dataset.index));
  }
  document.addEventListener('touchend', repairHandleDirectTap, true);
  document.addEventListener('pointerup', repairHandleDirectTap, true);
  document.addEventListener('click', repairHandleDirectTap, true);

})();
