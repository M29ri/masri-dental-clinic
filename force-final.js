/* Force Final v3: simple menu + clean photo actions + blur before/after. */
(function(){
  'use strict';
  const $ = (id)=>document.getElementById(id);
  const esc = (v='') => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const txt = (k, fallback) => (typeof window.L === 'function' ? window.L(k) : (typeof window.t === 'function' ? window.t(k) : fallback || k));
  const menuAllowed = new Set(['add patient','scan qr','settings','profile','manage users','logout','إضافة مريض','مسح qr','الإعدادات','الملف الشخصي','إدارة المستخدمين','تسجيل الخروج']);

  function userName(){ try { return (window.currentUser && (currentUser.full_name || currentUser.username)) || 'Admin'; } catch { return 'Admin'; } }
  function userRole(){ try { return (window.currentUser && currentUser.role) || 'admin'; } catch { return 'admin'; } }

  function simpleMenuHTML(){
    const isAdmin = String(userRole()).toLowerCase()==='admin';
    return `<div class="drawer-head"><h2>${esc(txt('menu','Menu'))}</h2><button class="drawer-close-btn" onclick="closeClinicMenu()">×</button></div>
      <div class="drawer-user"><div>${esc(userName())}</div><small>${esc(String(userRole()).toUpperCase())}</small></div>
      <div class="drawer-menu clean-final-menu">
        <button onclick="closeClinicMenu();showPage('form')">${esc(txt('addPatient','Add Patient'))}</button>
        <button onclick="closeClinicMenu();showPage('scan')">${esc(txt('scanQR','Scan QR'))}</button>
        <button class="primary-item" onclick="closeClinicMenu();showPage('settings')">${esc(txt('settings','Settings'))}</button>
        <button onclick="closeClinicMenu();openDoctorProfile()">${esc(txt('profile','Profile'))}</button>
        ${isAdmin ? `<button onclick="closeClinicMenu();manageUsers()">${esc(txt('manageUsers','Manage Users'))}</button>` : ''}
        <button class="danger-item" onclick="logout()">${esc(txt('logout','Logout'))}</button>
      </div>`;
  }

  window.openClinicMenu = function(){
    $('drawerOverlay')?.remove(); $('sideDrawer')?.remove();
    const overlay = document.createElement('div'); overlay.id='drawerOverlay'; overlay.className='drawer-overlay'; overlay.onclick=()=>window.closeClinicMenu();
    const drawer = document.createElement('aside'); drawer.id='sideDrawer'; drawer.className='side-drawer final-simple-drawer'; drawer.innerHTML=simpleMenuHTML();
    document.body.appendChild(overlay); document.body.appendChild(drawer);
  };
  window.closeClinicMenu = function(){ $('drawerOverlay')?.remove(); $('sideDrawer')?.remove(); };

  function takeOverMenuButton(){
    const old = $('menuBtn'); if(!old || old.dataset.finalMenuBound==='1') return;
    const fresh = old.cloneNode(true); fresh.dataset.finalMenuBound='1'; fresh.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); window.openClinicMenu(); return false; };
    fresh.addEventListener('click', (e)=>{ e.preventDefault(); e.stopImmediatePropagation(); window.openClinicMenu(); }, true);
    old.replaceWith(fresh);
  }
  document.addEventListener('click', (e)=>{
    const btn = e.target && e.target.closest && e.target.closest('#menuBtn');
    if(btn){ e.preventDefault(); e.stopImmediatePropagation(); window.openClinicMenu(); }
  }, true);
  const mo = new MutationObserver(()=>{
    const d=$('sideDrawer'); if(d && !d.classList.contains('final-simple-drawer')){ d.className='side-drawer final-simple-drawer'; d.innerHTML=simpleMenuHTML(); }
  });
  try{ mo.observe(document.documentElement,{childList:true,subtree:true}); }catch{}

  function photoUrl(raw){ return !raw ? '' : (typeof raw === 'string' ? raw : (raw.url || raw.publicUrl || raw.path || raw.src || '')); }
  function metaKey(patientId){ return 'clinicPhotoMeta:' + patientId; }
  function loadMeta(patientId){ try{return JSON.parse(localStorage.getItem(metaKey(patientId))||'{}');}catch{return{};} }
  function saveMeta(patientId,meta){ localStorage.setItem(metaKey(patientId), JSON.stringify(meta||{})); }
  function allPhotos(patient){
    const meta = loadMeta(patient.id);
    return (patient.photos||[]).map((raw,index)=>{
      const url=photoUrl(raw); const m=meta[url]||{}; const name=String(raw?.name||raw?.filename||raw?.path||url||'').toLowerCase();
      let category=String(m.category || raw?.category || raw?.photoCategory || raw?.type || '').toLowerCase();
      if(category==='x-ray') category='xray';
      if(category!=='xray' && category!=='clinical') category=(name.includes('xray')||name.includes('x-ray')||name.includes('radiograph'))?'xray':'clinical';
      let stage=String(m.stage || raw?.stage || raw?.phase || '').toLowerCase(); if(!['general','before','after'].includes(stage)) stage='general';
      return {raw,index,url,category,stage,name: raw?.name || raw?.filename || `Photo ${index+1}`};
    }).filter(p=>p.url);
  }
  window.categorizedPhotos = function(patient){ const all=allPhotos(patient); return {all, clinical:all.filter(p=>p.category==='clinical'), xray:all.filter(p=>p.category==='xray')}; };

  window.setPhotoMeta = async function(patientId,index,field,value){
    const p=(window.patients||[]).find(x=>String(x.id)===String(patientId)); if(!p) return;
    const raw=(p.photos||[])[index]; const url=photoUrl(raw); if(!url) return;
    const meta=loadMeta(patientId); meta[url]=Object.assign({},meta[url]||{}, {[field]:value}); saveMeta(patientId,meta);
    if(typeof raw==='object' && raw){ raw[field]=value; }
    closePhotoActionMenu();
    const box=$('simplePhotosBox'); if(box) box.innerHTML=renderSimplePhotos(p, window.__photoTab||'clinical');
    try{ if(typeof api==='function') await api(`patients?id=eq.${patientId}`, {method:'PATCH', body:JSON.stringify({photos:p.photos})}); }catch(e){}
  };

  window.openPhotoActionMenu = function(patientId,index,anchor){
    closePhotoActionMenu();
    const p=(window.patients||[]).find(x=>String(x.id)===String(patientId)); if(!p) return;
    const ph=allPhotos(p).find(x=>x.index===index); if(!ph) return;
    const rect = anchor.getBoundingClientRect();
    const pop=document.createElement('div'); pop.id='photoActionMenu'; pop.className='photo-action-menu';
    pop.style.top=Math.min(window.innerHeight-260, rect.bottom+8)+'px'; pop.style.left=Math.max(12, Math.min(window.innerWidth-236, rect.left-190))+'px';
    pop.innerHTML=`<b>${esc(txt('photoType','Photo type'))}</b>
      <button class="${ph.category==='clinical'?'on':''}" onclick="setPhotoMeta('${esc(patientId)}',${index},'category','clinical')">${esc(txt('clinical','Clinical'))}</button>
      <button class="${ph.category==='xray'?'on':''}" onclick="setPhotoMeta('${esc(patientId)}',${index},'category','xray')">${esc(txt('xray','X-ray'))}</button>
      <hr>
      <button class="${ph.stage==='general'?'on':''}" onclick="setPhotoMeta('${esc(patientId)}',${index},'stage','general')">${esc(txt('general','General'))}</button>
      <button class="${ph.stage==='before'?'on':''}" onclick="setPhotoMeta('${esc(patientId)}',${index},'stage','before')">${esc(txt('before','Before'))}</button>
      <button class="${ph.stage==='after'?'on':''}" onclick="setPhotoMeta('${esc(patientId)}',${index},'stage','after')">${esc(txt('after','After'))}</button>`;
    document.body.appendChild(pop);
    setTimeout(()=>document.addEventListener('click', closePhotoActionMenu, {once:true}),0);
  };
  window.closePhotoActionMenu = function(){ $('photoActionMenu')?.remove(); };

  window.renderSimplePhotos = function(patient,type='clinical'){
    window.__photoTab=type;
    const c=window.categorizedPhotos(patient); const list=type==='xray'?c.xray:c.clinical;
    window.simplePhotoState = window.simplePhotoState || {}; window.simplePhotoState[patient.id]={type,photos:list};
    return `<div class="final-photo-tabs">
        <button class="${type==='clinical'?'active':''}" onclick="switchSimplePhotoType('${esc(patient.id)}','clinical')">${esc(txt('clinical','Clinical'))} <small>${c.clinical.length}</small></button>
        <button class="${type==='xray'?'active':''}" onclick="switchSimplePhotoType('${esc(patient.id)}','xray')">${esc(txt('xray','X-ray'))} <small>${c.xray.length}</small></button>
        <button onclick="showBeforeAfter('${esc(patient.id)}')">${esc(txt('beforeAfter','Before / After'))}</button>
      </div>
      <div class="final-photo-grid">${list.length ? list.map((ph,i)=>`<div class="final-photo-card"><button class="photo-img-btn" onclick="openSimplePhotoViewer('${esc(patient.id)}',${i})"><img src="${esc(ph.url)}" alt=""><span>${esc(ph.category==='xray'?txt('xray','X-ray'):txt('clinical','Clinical'))} · ${esc(ph.stage==='before'?txt('before','Before'):ph.stage==='after'?txt('after','After'):txt('general','General'))}</span></button><button class="photo-kebab" onclick="event.stopPropagation();openPhotoActionMenu('${esc(patient.id)}',${ph.index},this)">⋯</button></div>`).join('') : `<p class="muted final-empty-photo">${esc(type==='xray'?txt('noXray','No X-rays yet'):txt('noClinical','No clinical photos yet'))}</p>`}</div>`;
  };
  window.switchSimplePhotoType = function(patientId,type){ const p=(window.patients||[]).find(x=>String(x.id)===String(patientId)); const box=$('simplePhotosBox'); if(p&&box) box.innerHTML=renderSimplePhotos(p,type); };
  window.openSimplePhotoViewer = function(patientId,index){ const state=window.simplePhotoState?.[patientId]; if(!state?.photos?.length) return; window.currentPhotoList=state.photos.map(x=>x.url); window.currentPhotoIndex=index||0; const v=$('photoViewer'), img=$('viewerImage'); if(v&&img){ img.src=window.currentPhotoList[window.currentPhotoIndex]; v.classList.remove('hidden'); } };

  function photoChoiceGrid(patient, selectedBefore, selectedAfter){
    return allPhotos(patient).map((ph,i)=>`<div class="ba-choice-card ${i===selectedBefore?'before-sel':''} ${i===selectedAfter?'after-sel':''}" data-i="${i}"><img src="${esc(ph.url)}" alt=""><div><b>${esc(ph.category==='xray'?txt('xray','X-ray'):txt('clinical','Clinical'))}</b><span>${esc(ph.stage==='before'?txt('before','Before'):ph.stage==='after'?txt('after','After'):txt('general','General'))}</span></div><button onclick="selectBAPhoto('before',${i})">${esc(txt('before','Before'))}</button><button onclick="selectBAPhoto('after',${i})">${esc(txt('after','After'))}</button></div>`).join('');
  }

  window.showBeforeAfter = function(patientId){
    const p=(window.patients||[]).find(x=>String(x.id)===String(patientId)); if(!p) return;
    const all=allPhotos(p); if(all.length<2) return alert('Add at least two photos first.');
    let bi=all.findIndex(x=>x.stage==='before'); if(bi<0) bi=0; let ai=all.findIndex((x,i)=>x.stage==='after' && i!==bi); if(ai<0) ai=bi===0?1:0;
    $('forceBA')?.remove();
    const ov=document.createElement('div'); ov.id='forceBA'; ov.className='force-modal final-ba-modal';
    ov.innerHTML=`<div class="final-ba-box"><div class="force-modal-head"><div><h2>${esc(txt('beforeAfter','Before / After'))}</h2><p>${esc(txt('sliderHint','Move the bar for a soft blurry transition.'))}</p></div><button onclick="document.getElementById('forceBA')?.remove()">×</button></div>
      <div class="ba-choice-wrap"><h4>Choose photos</h4><div id="baChoiceGrid" class="ba-choice-grid"></div></div>
      <div class="final-blend-stage" id="finalBlendStage"><img id="baBeforeImg" class="blend-before" src="${esc(all[bi].url)}" alt=""><img id="baAfterImg" class="blend-after" src="${esc(all[ai].url)}" alt=""><span class="ba-label before">${esc(txt('before','Before'))}</span><span class="ba-label after">${esc(txt('after','After'))}</span><div id="baSoftBar" class="ba-soft-bar" style="left:50%"></div><input id="baBlendRange" type="range" min="0" max="100" value="50"></div></div>`;
    document.body.appendChild(ov);
    window.__baState={patient:p, all, before:bi, after:ai};
    const renderChoices=()=>{ $('baChoiceGrid').innerHTML=photoChoiceGrid(p, window.__baState.before, window.__baState.after); updateBlend(); };
    window.selectBAPhoto=function(which,i){ if(!window.__baState) return; window.__baState[which]=i; renderChoices(); };
    function updateBlend(){ const s=window.__baState; if(!s) return; $('baBeforeImg').src=s.all[s.before].url; $('baAfterImg').src=s.all[s.after].url; const v=+$('baBlendRange').value; $('baAfterImg').style.opacity=(v/100).toFixed(2); $('baSoftBar').style.left=v+'%'; }
    $('baBlendRange').oninput=updateBlend; renderChoices(); ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
  };

  function replacePhotoSection(html,p){
    const block=`<h3 style="color:var(--accent);margin-top:24px;">${esc(txt('photos','Photos / X-rays'))}</h3><div id="simplePhotosBox">${renderSimplePhotos(p, window.__photoTab||'clinical')}</div><h3 style="color:var(--accent);margin-top:24px;">${esc(txt('patientTimeline','Patient Timeline'))}</h3>`;
    let out = html.replace(/<h3[^>]*>Photos\s*\/\s*X-rays<\/h3>[\s\S]*?<h3[^>]*>Patient Timeline<\/h3>/i, block);
    out = out.replace(/<h3[^>]*>الصور\s*\/\s*الأشعة<\/h3>[\s\S]*?<h3[^>]*>تاريخ المريض<\/h3>/i, block);
    return out;
  }
  function wrapDetails(){
    if(typeof window.patientDetailsHTML === 'function' && !window.patientDetailsHTML.__finalWrapped){
      const prev=window.patientDetailsHTML;
      const next=function(p){ return replacePhotoSection(prev(p),p); };
      next.__finalWrapped=true;
      window.patientDetailsHTML = patientDetailsHTML = next;
    }
  }

  function boot(){ takeOverMenuButton(); wrapDetails(); try{ window.applyLanguage && window.applyLanguage(); }catch{} }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
  let tries=0; const timer=setInterval(()=>{ boot(); if(++tries>20) clearInterval(timer); },250);
})();
