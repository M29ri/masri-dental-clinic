/* CLEAN PHOTO + MENU REPAIR 2026-06-28
   This file intentionally replaces all previous photo repair logic with one simple click-based system.
*/
(function(){
  'use strict';
  const $ = (id)=>document.getElementById(id);
  const safe = (v)=>String(v ?? '').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const lang = ()=>localStorage.getItem('clinicLanguage') || 'en';
  const dict = {
    en:{menu:'Menu',addPatient:'Add Patient',scanQR:'Scan QR',settings:'Settings',profile:'Profile',manageUsers:'Manage Users',logout:'Logout',photos:'Photos / X-rays',clinical:'Clinical',xray:'X-ray',general:'General',before:'Before',after:'After',beforeAfter:'Before / After',patientTimeline:'Patient Timeline',noClinical:'No clinical photos yet',noXray:'No X-rays yet',photoOptions:'Photo options',view:'View photo',markClinical:'Mark as Clinical',markXray:'Mark as X-ray',markBefore:'Use as Before',markAfter:'Use as After',markGeneral:'Mark as General',chooseBeforeAfter:'Choose before and after photos',transition:'Transition',close:'Close'},
    ar:{menu:'القائمة',addPatient:'إضافة مريض',scanQR:'مسح QR',settings:'الإعدادات',profile:'الملف الشخصي',manageUsers:'إدارة المستخدمين',logout:'تسجيل الخروج',photos:'الصور / الأشعة',clinical:'سريري',xray:'أشعة',general:'عام',before:'قبل',after:'بعد',beforeAfter:'قبل / بعد',patientTimeline:'تاريخ المريض',noClinical:'لا توجد صور سريرية',noXray:'لا توجد أشعة',photoOptions:'خيارات الصورة',view:'عرض الصورة',markClinical:'تحديد كصورة سريرية',markXray:'تحديد كأشعة',markBefore:'استخدام كصورة قبل',markAfter:'استخدام كصورة بعد',markGeneral:'تحديد كصورة عامة',chooseBeforeAfter:'اختر صور قبل وبعد',transition:'الانتقال',close:'إغلاق'}
  };
  function t(k){ return (dict[lang()] && dict[lang()][k]) || dict.en[k] || k; }
  function patientsList(){ return window.patients || (typeof patients !== 'undefined' ? patients : []); }
  function userObj(){ return window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : {}) || {}; }
  function findPatient(id){ return patientsList().find(p=>String(p.id)===String(id)); }
  function photoUrl(ph){ return typeof ph === 'string' ? ph : (ph?.url || ph?.publicUrl || ph?.path || ph?.src || ''); }
  function photoName(ph, i){ return typeof ph === 'string' ? `Photo ${i+1}` : (ph?.name || ph?.filename || `Photo ${i+1}`); }
  function photoCategory(ph){
    const val = String(ph?.category || ph?.photoCategory || '').toLowerCase();
    const name = String(ph?.name || ph?.filename || ph?.url || ph?.path || '').toLowerCase();
    if(val.includes('xray') || val.includes('x-ray') || val.includes('radiograph') || name.includes('xray') || name.includes('x-ray') || name.includes('radiograph')) return 'xray';
    return 'clinical';
  }
  function photoStage(ph){
    const val = String(ph?.stage || ph?.photoStage || ph?.phase || '').toLowerCase();
    const name = String(ph?.name || ph?.filename || ph?.url || ph?.path || '').toLowerCase();
    if(val === 'before' || name.includes('before') || name.includes('pre')) return 'before';
    if(val === 'after' || name.includes('after') || name.includes('post')) return 'after';
    return 'general';
  }
  function allPhotos(patient){
    return (patient?.photos || []).map((raw,index)=>({raw,index,url:photoUrl(raw),name:photoName(raw,index),category:photoCategory(raw),stage:photoStage(raw)})).filter(x=>x.url);
  }
  function setPhotoLocal(patient, index, field, value){
    if(!patient || !patient.photos) return;
    const old = patient.photos[index];
    const url = photoUrl(old);
    const obj = typeof old === 'string' ? {url, path:url, name:`Photo ${index+1}`, category:'clinical', stage:'general'} : {...old};
    obj[field] = value;
    if(field === 'category') obj.photoCategory = value;
    if(field === 'stage') obj.photoStage = value;
    patient.photos[index] = obj;
  }
  async function savePhotoMeta(pid,index,field,value){
    const p = findPatient(pid); if(!p) return;
    setPhotoLocal(p,index,field,value);
    closeSheet();
    renderIntoCurrent(p);
    try{
      if(typeof api === 'function') await api(`patients?id=eq.${pid}`, {method:'PATCH', body:JSON.stringify({photos:p.photos})});
      if(typeof toast === 'function') toast('Photo updated');
    }catch(err){ console.warn('Photo saved locally only:', err); if(typeof toast === 'function') toast('Photo updated locally'); }
  }

  // Clean menu, with only the items requested.
  function closeMenu(){ $('drawerOverlay')?.remove(); $('sideDrawer')?.remove(); }
  function openMenu(){
    closeMenu();
    const u = userObj();
    const ov = document.createElement('div'); ov.id='drawerOverlay'; ov.className='drawer-overlay clean-menu-overlay';
    const d = document.createElement('aside'); d.id='sideDrawer'; d.className='side-drawer clean-menu-drawer';
    d.innerHTML = `<div class="drawer-head"><button type="button" class="drawer-close-btn" data-clean-action="close">×</button><h2>${safe(t('menu'))}</h2></div>
      <div class="drawer-user"><div>${safe(u.full_name || u.username || 'Admin')}</div><small>${safe(String(u.role || 'ADMIN').toUpperCase())}</small></div>
      <div class="drawer-menu clean-menu-list">
        <button type="button" data-clean-page="form">${safe(t('addPatient'))}</button>
        <button type="button" data-clean-page="scan">${safe(t('scanQR'))}</button>
        <button type="button" class="primary-item" data-clean-page="settings">${safe(t('settings'))}</button>
        <button type="button" data-clean-action="profile">${safe(t('profile'))}</button>
        ${(u.role === 'admin' || String(u.role||'').toLowerCase()==='admin') ? `<button type="button" data-clean-action="users">${safe(t('manageUsers'))}</button>` : ''}
        <button type="button" class="danger-item" data-clean-action="logout">${safe(t('logout'))}</button>
      </div>`;
    document.body.append(ov,d);
  }
  window.openClinicMenu = openMenu;
  window.closeClinicMenu = closeMenu;
  function bindMenu(){
    const btn=$('menuBtn'); if(!btn || btn.dataset.cleanBound==='1') return;
    const c=btn.cloneNode(true); c.dataset.cleanBound='1'; c.removeAttribute('onclick'); c.textContent=t('menu');
    c.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); openMenu(); }, false);
    btn.replaceWith(c);
  }
  document.addEventListener('click', e=>{
    const mb=e.target.closest?.('#menuBtn'); if(mb){ e.preventDefault(); e.stopPropagation(); openMenu(); return; }
    if(e.target.id==='drawerOverlay'){ closeMenu(); return; }
    const page=e.target.closest?.('[data-clean-page]'); if(page){ e.preventDefault(); closeMenu(); window.showPage?.(page.dataset.cleanPage); return; }
    const action=e.target.closest?.('[data-clean-action]');
    if(action){ e.preventDefault(); const a=action.dataset.cleanAction; if(a==='close') closeMenu(); if(a==='profile') window.openDoctorProfile?.(); if(a==='users') window.manageUsers?.(); if(a==='logout') window.logout?.(); return; }
  }, false);

  function renderPhotos(patient, tab){
    const photos = allPhotos(patient);
    const clinical = photos.filter(p=>p.category==='clinical');
    const xray = photos.filter(p=>p.category==='xray');
    const list = tab === 'xray' ? xray : clinical;
    window.__cleanPhotoTab = tab;
    return `<section class="clean-photo-section" data-patient-id="${safe(patient.id)}">
      <div class="clean-photo-tabs">
        <button type="button" class="${tab==='clinical'?'active':''}" data-clean-tab="clinical" data-patient-id="${safe(patient.id)}">${safe(t('clinical'))} <small>${clinical.length}</small></button>
        <button type="button" class="${tab==='xray'?'active':''}" data-clean-tab="xray" data-patient-id="${safe(patient.id)}">${safe(t('xray'))} <small>${xray.length}</small></button>
        <button type="button" data-clean-ba="${safe(patient.id)}">${safe(t('beforeAfter'))}</button>
      </div>
      <div class="clean-photo-grid">
        ${list.length ? list.map(ph=>`<article class="clean-photo-card">
          <button type="button" class="clean-photo-open" data-clean-view="${safe(patient.id)}" data-index="${ph.index}"><img src="${safe(ph.url)}" alt="${safe(ph.name)}"><span>${safe(ph.stage==='before'?t('before'):ph.stage==='after'?t('after'):t('general'))}</span></button>
          <button type="button" class="clean-photo-dots" data-clean-sheet="${safe(patient.id)}" data-index="${ph.index}" aria-label="${safe(t('photoOptions'))}">•••</button>
        </article>`).join('') : `<div class="clean-empty">${safe(tab==='xray'?t('noXray'):t('noClinical'))}</div>`}
      </div>
    </section>`;
  }
  function renderIntoCurrent(patient){
    const zone = $('cleanPhotoZone') || $('repairPhotoZone') || $('mdPhotoZone') || $('simplePhotosBox');
    if(zone) zone.outerHTML = `<div id="cleanPhotoZone">${renderPhotos(patient, window.__cleanPhotoTab || 'clinical')}</div>`;
  }
  function replacePhotoBlock(html, p){
    const block = `<h3 class="clean-photo-title">${safe(t('photos'))}</h3><div id="cleanPhotoZone">${renderPhotos(p, window.__cleanPhotoTab || 'clinical')}</div><h3 class="clean-timeline-title">${safe(t('patientTimeline'))}</h3>`;
    const patterns = [
      /<h3[^>]*>Photos\s*\/\s*X-rays<\/h3>[\s\S]*?<h3[^>]*>Patient Timeline<\/h3>/i,
      /<h3[^>]*>الصور\s*\/\s*الأشعة<\/h3>[\s\S]*?<h3[^>]*>تاريخ المريض<\/h3>/i,
      /<h3[^>]*class=["'][^"']*repair-section-title[^"']*["'][^>]*>[\s\S]*?Photos[\s\S]*?<\/h3>[\s\S]*?<h3[^>]*class=["'][^"']*repair-section-title[^"']*["'][^>]*>[\s\S]*?Patient Timeline[\s\S]*?<\/h3>/i,
      /<h3[^>]*class=["'][^"']*clean-photo-title[^"']*["'][^>]*>[\s\S]*?<\/h3>[\s\S]*?<h3[^>]*class=["'][^"']*clean-timeline-title[^"']*["'][^>]*>[\s\S]*?<\/h3>/i
    ];
    for(const re of patterns){ if(re.test(html)) return html.replace(re, block); }
    return html + block;
  }
  function wrapPatientDetails(){
    const current = window.patientDetailsHTML || (typeof patientDetailsHTML !== 'undefined' ? patientDetailsHTML : null);
    if(typeof current !== 'function' || current.__cleanPhotoWrapped) return;
    const fn = function(p){ return replacePhotoBlock(current(p), p); };
    fn.__cleanPhotoWrapped = true;
    window.patientDetailsHTML = fn;
    try{ patientDetailsHTML = fn; }catch{}
  }

  function openViewer(pid,index){
    const p=findPatient(pid); const ph=allPhotos(p).find(x=>x.index===Number(index)); if(!ph) return;
    closeViewer();
    const ov=document.createElement('div'); ov.id='cleanPhotoViewer'; ov.className='clean-photo-viewer';
    ov.innerHTML=`<button type="button" class="clean-view-close" data-clean-close-view>×</button><img src="${safe(ph.url)}" alt="${safe(ph.name)}"><div class="clean-view-caption">${safe(ph.name)}</div>`;
    document.body.appendChild(ov);
  }
  function closeViewer(){ $('cleanPhotoViewer')?.remove(); }
  function openSheet(pid,index){
    const p=findPatient(pid); const ph=allPhotos(p).find(x=>x.index===Number(index)); if(!ph) return;
    closeSheet();
    const ov=document.createElement('div'); ov.id='cleanPhotoSheet'; ov.className='clean-sheet-overlay';
    ov.innerHTML=`<div class="clean-sheet">
      <div class="clean-sheet-head"><b>${safe(t('photoOptions'))}</b><button type="button" data-clean-close-sheet>×</button></div>
      <img src="${safe(ph.url)}" alt="${safe(ph.name)}">
      <button type="button" data-set-photo="category:clinical" class="${ph.category==='clinical'?'active':''}">${safe(t('markClinical'))}</button>
      <button type="button" data-set-photo="category:xray" class="${ph.category==='xray'?'active':''}">${safe(t('markXray'))}</button>
      <button type="button" data-set-photo="stage:general" class="${ph.stage==='general'?'active':''}">${safe(t('markGeneral'))}</button>
      <button type="button" data-set-photo="stage:before" class="${ph.stage==='before'?'active':''}">${safe(t('markBefore'))}</button>
      <button type="button" data-set-photo="stage:after" class="${ph.stage==='after'?'active':''}">${safe(t('markAfter'))}</button>
    </div>`;
    ov.dataset.patientId=pid; ov.dataset.index=index;
    document.body.appendChild(ov);
  }
  function closeSheet(){ $('cleanPhotoSheet')?.remove(); }

  function openBeforeAfter(pid){
    const p=findPatient(pid); const photos=allPhotos(p); if(photos.length<2){ alert('Add at least two photos first.'); return; }
    let before = photos.findIndex(x=>x.stage==='before'); if(before<0) before=0;
    let after = photos.findIndex((x,i)=>x.stage==='after' && i!==before); if(after<0) after = before===0 ? 1 : 0;
    closeBA();
    const ov=document.createElement('div'); ov.id='cleanBA'; ov.className='clean-ba-overlay';
    ov.innerHTML=`<div class="clean-ba-dialog">
      <div class="clean-ba-head"><div><h2>${safe(t('beforeAfter'))}</h2><p>${safe(t('chooseBeforeAfter'))}</p></div><button type="button" data-clean-close-ba>×</button></div>
      <div class="clean-ba-stage"><img id="cleanBABefore" class="before" src="${safe(photos[before].url)}"><img id="cleanBAAfter" class="after" src="${safe(photos[after].url)}"><span>${safe(t('transition'))}</span></div>
      <input id="cleanBARange" class="clean-ba-range" type="range" min="0" max="100" value="50">
      <div class="clean-ba-picker"><h4>${safe(t('before'))}</h4>${photos.map((ph,i)=>`<button type="button" class="${i===before?'active':''}" data-ba-choose="before" data-index="${i}"><img src="${safe(ph.url)}"><small>${i+1}</small></button>`).join('')}</div>
      <div class="clean-ba-picker"><h4>${safe(t('after'))}</h4>${photos.map((ph,i)=>`<button type="button" class="${i===after?'active':''}" data-ba-choose="after" data-index="${i}"><img src="${safe(ph.url)}"><small>${i+1}</small></button>`).join('')}</div>
    </div>`;
    ov.__photos=photos; ov.__before=before; ov.__after=after;
    document.body.appendChild(ov); updateBA();
  }
  function closeBA(){ $('cleanBA')?.remove(); }
  function updateBA(){
    const ov=$('cleanBA'); if(!ov) return;
    const photos=ov.__photos; const b=photos[ov.__before], a=photos[ov.__after];
    $('cleanBABefore').src=b.url; $('cleanBAAfter').src=a.url;
    const val=Number($('cleanBARange')?.value || 50);
    const after=$('cleanBAAfter');
    after.style.opacity = String(val/100);
    after.style.filter = `blur(${Math.max(0, 8 - Math.abs(val-50)/6)}px)`;
    ov.querySelectorAll('[data-ba-choose="before"]').forEach(btn=>btn.classList.toggle('active', Number(btn.dataset.index)===ov.__before));
    ov.querySelectorAll('[data-ba-choose="after"]').forEach(btn=>btn.classList.toggle('active', Number(btn.dataset.index)===ov.__after));
  }
  window.showBeforeAfter = openBeforeAfter;

  document.addEventListener('click', e=>{
    const tab=e.target.closest?.('[data-clean-tab]'); if(tab){ e.preventDefault(); const p=findPatient(tab.dataset.patientId); const zone=$('cleanPhotoZone'); if(p&&zone) zone.innerHTML=renderPhotos(p,tab.dataset.cleanTab); return; }
    const ba=e.target.closest?.('[data-clean-ba]'); if(ba){ e.preventDefault(); openBeforeAfter(ba.dataset.cleanBa); return; }
    const view=e.target.closest?.('[data-clean-view]'); if(view){ e.preventDefault(); openViewer(view.dataset.cleanView, view.dataset.index); return; }
    const sheet=e.target.closest?.('[data-clean-sheet]'); if(sheet){ e.preventDefault(); e.stopPropagation(); openSheet(sheet.dataset.cleanSheet, sheet.dataset.index); return; }
    if(e.target.closest?.('[data-clean-close-view]') || e.target.id==='cleanPhotoViewer'){ e.preventDefault(); closeViewer(); return; }
    if(e.target.closest?.('[data-clean-close-sheet]') || e.target.id==='cleanPhotoSheet'){ e.preventDefault(); closeSheet(); return; }
    if(e.target.closest?.('[data-clean-close-ba]') || e.target.id==='cleanBA'){ e.preventDefault(); closeBA(); return; }
    const set=e.target.closest?.('[data-set-photo]'); if(set){ e.preventDefault(); const ov=$('cleanPhotoSheet'); const [field,value]=set.dataset.setPhoto.split(':'); savePhotoMeta(ov.dataset.patientId, Number(ov.dataset.index), field, value); return; }
    const choose=e.target.closest?.('[data-ba-choose]'); if(choose){ e.preventDefault(); const ov=$('cleanBA'); ov['__'+choose.dataset.baChoose]=Number(choose.dataset.index); updateBA(); return; }
  }, false);
  document.addEventListener('input', e=>{ if(e.target.id==='cleanBARange') updateBA(); }, false);

  function boot(){ bindMenu(); wrapPatientDetails(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  setInterval(boot, 700);
})();
