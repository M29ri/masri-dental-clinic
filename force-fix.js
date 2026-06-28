/* Real force-fix: loaded AFTER the old app to replace broken UI code instead of appending unused patches. */
(function(){
  'use strict';
  const $id = (id) => document.getElementById(id);
  const esc = (v='') => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  const LANG = {
    en:{native:'English',dir:'ltr',menu:'Menu',addPatient:'Add Patient',scanQR:'Scan QR',settings:'Settings',profile:'Profile',manageUsers:'Manage Users',logout:'Logout',language:'Language',choose:'Choose language',hint:'Choose the language for the app interface.',theme:'Theme color',pdf:'PDF style',doctorCard:'Doctor card',signature:'Signature',backup:'Backup',restore:'Restore',clinical:'Clinical',xray:'X-ray',beforeAfter:'Before / After',all:'All',photoCategory:'Photo category',photoType:'Photo type',general:'General',before:'Before',after:'After',organize:'Organize photos',noClinical:'No clinical photos yet',noXray:'No X-rays yet',selectBefore:'Before photo',selectAfter:'After photo',sliderHint:'Drag the bar to compare before and after.',search:'Search by name, phone, ID, or diagnosis...'},
    ar:{native:'العربية',dir:'rtl',menu:'القائمة',addPatient:'إضافة مريض',scanQR:'مسح QR',settings:'الإعدادات',profile:'الملف الشخصي',manageUsers:'إدارة المستخدمين',logout:'تسجيل الخروج',language:'اللغة',choose:'اختر اللغة',hint:'اختر لغة واجهة التطبيق.',theme:'لون التطبيق',pdf:'شكل PDF',doctorCard:'بطاقة الطبيب',signature:'التوقيع',backup:'نسخة احتياطية',restore:'استرجاع',clinical:'سريري',xray:'أشعة',beforeAfter:'قبل / بعد',all:'الكل',photoCategory:'تصنيف الصورة',photoType:'نوع الصورة',general:'عام',before:'قبل',after:'بعد',organize:'تنظيم الصور',noClinical:'لا توجد صور سريرية',noXray:'لا توجد صور أشعة',selectBefore:'صورة قبل',selectAfter:'صورة بعد',sliderHint:'اسحب الشريط للمقارنة بين قبل وبعد.',search:'ابحث بالاسم أو الهاتف أو الكود أو التشخيص...'},
    fr:{native:'Français',dir:'ltr',menu:'Menu',addPatient:'Ajouter patient',scanQR:'Scanner QR',settings:'Paramètres',profile:'Profil',manageUsers:'Utilisateurs',logout:'Déconnexion',language:'Langue',choose:'Choisir la langue',hint:'Choisissez la langue de l’interface.',theme:'Couleur',pdf:'Style PDF',doctorCard:'Carte médecin',signature:'Signature',backup:'Sauvegarde',restore:'Restaurer',clinical:'Clinique',xray:'Radio',beforeAfter:'Avant / Après',all:'Tout',photoCategory:'Catégorie photo',photoType:'Type photo',general:'Général',before:'Avant',after:'Après',organize:'Organiser les photos',noClinical:'Aucune photo clinique',noXray:'Aucune radio',selectBefore:'Photo avant',selectAfter:'Photo après',sliderHint:'Faites glisser la barre pour comparer.',search:'Rechercher nom, téléphone, ID ou diagnostic...'},
    es:{native:'Español',dir:'ltr',menu:'Menú',addPatient:'Añadir paciente',scanQR:'Escanear QR',settings:'Ajustes',profile:'Perfil',manageUsers:'Usuarios',logout:'Salir',language:'Idioma',choose:'Elegir idioma',hint:'Elige el idioma de la interfaz.',theme:'Color',pdf:'Estilo PDF',doctorCard:'Tarjeta doctor',signature:'Firma',backup:'Copia',restore:'Restaurar',clinical:'Clínica',xray:'Rayos X',beforeAfter:'Antes / Después',all:'Todo',photoCategory:'Categoría',photoType:'Tipo',general:'General',before:'Antes',after:'Después',organize:'Organizar fotos',noClinical:'Sin fotos clínicas',noXray:'Sin rayos X',selectBefore:'Foto antes',selectAfter:'Foto después',sliderHint:'Arrastra la barra para comparar.',search:'Buscar nombre, teléfono, ID o diagnóstico...'},
    de:{native:'Deutsch',dir:'ltr',menu:'Menü',addPatient:'Patient hinzufügen',scanQR:'QR scannen',settings:'Einstellungen',profile:'Profil',manageUsers:'Benutzer',logout:'Abmelden',language:'Sprache',choose:'Sprache wählen',hint:'Wählen Sie die Sprache der App.',theme:'Farbe',pdf:'PDF-Stil',doctorCard:'Arztkarte',signature:'Unterschrift',backup:'Backup',restore:'Wiederherstellen',clinical:'Klinisch',xray:'Röntgen',beforeAfter:'Vorher / Nachher',all:'Alle',photoCategory:'Fotokategorie',photoType:'Fototyp',general:'Allgemein',before:'Vorher',after:'Nachher',organize:'Fotos organisieren',noClinical:'Keine klinischen Fotos',noXray:'Keine Röntgenbilder',selectBefore:'Vorher-Foto',selectAfter:'Nachher-Foto',sliderHint:'Ziehen Sie die Leiste zum Vergleichen.',search:'Name, Telefon, ID oder Diagnose suchen...'},
    it:{native:'Italiano',dir:'ltr',menu:'Menu',addPatient:'Aggiungi paziente',scanQR:'Scansiona QR',settings:'Impostazioni',profile:'Profilo',manageUsers:'Utenti',logout:'Esci',language:'Lingua',choose:'Scegli lingua',hint:'Scegli la lingua dell’interfaccia.',theme:'Colore',pdf:'Stile PDF',doctorCard:'Scheda medico',signature:'Firma',backup:'Backup',restore:'Ripristina',clinical:'Clinica',xray:'Radiografia',beforeAfter:'Prima / Dopo',all:'Tutto',photoCategory:'Categoria foto',photoType:'Tipo foto',general:'Generale',before:'Prima',after:'Dopo',organize:'Organizza foto',noClinical:'Nessuna foto clinica',noXray:'Nessuna radiografia',selectBefore:'Foto prima',selectAfter:'Foto dopo',sliderHint:'Trascina la barra per confrontare.',search:'Cerca nome, telefono, ID o diagnosi...'},
    pt:{native:'Português',dir:'ltr',menu:'Menu',addPatient:'Adicionar paciente',scanQR:'Ler QR',settings:'Configurações',profile:'Perfil',manageUsers:'Usuários',logout:'Sair',language:'Idioma',choose:'Escolher idioma',hint:'Escolha o idioma da interface.',theme:'Cor',pdf:'Estilo PDF',doctorCard:'Cartão médico',signature:'Assinatura',backup:'Backup',restore:'Restaurar',clinical:'Clínico',xray:'Raio X',beforeAfter:'Antes / Depois',all:'Tudo',photoCategory:'Categoria da foto',photoType:'Tipo da foto',general:'Geral',before:'Antes',after:'Depois',organize:'Organizar fotos',noClinical:'Sem fotos clínicas',noXray:'Sem raio X',selectBefore:'Foto antes',selectAfter:'Foto depois',sliderHint:'Arraste a barra para comparar.',search:'Pesquisar nome, telefone, ID ou diagnóstico...'},
    tr:{native:'Türkçe',dir:'ltr',menu:'Menü',addPatient:'Hasta ekle',scanQR:'QR tara',settings:'Ayarlar',profile:'Profil',manageUsers:'Kullanıcılar',logout:'Çıkış',language:'Dil',choose:'Dil seç',hint:'Uygulama arayüz dilini seçin.',theme:'Renk',pdf:'PDF stili',doctorCard:'Doktor kartı',signature:'İmza',backup:'Yedek',restore:'Geri yükle',clinical:'Klinik',xray:'Röntgen',beforeAfter:'Önce / Sonra',all:'Tümü',photoCategory:'Foto kategori',photoType:'Foto tipi',general:'Genel',before:'Önce',after:'Sonra',organize:'Fotoğrafları düzenle',noClinical:'Klinik foto yok',noXray:'Röntgen yok',selectBefore:'Önce foto',selectAfter:'Sonra foto',sliderHint:'Karşılaştırmak için çubuğu sürükleyin.',search:'Ad, telefon, ID veya teşhis ara...'},
    ur:{native:'اردو',dir:'rtl',menu:'مینو',addPatient:'مریض شامل کریں',scanQR:'QR اسکین',settings:'ترتیبات',profile:'پروفائل',manageUsers:'صارفین',logout:'لاگ آؤٹ',language:'زبان',choose:'زبان منتخب کریں',hint:'ایپ کی زبان منتخب کریں۔',theme:'رنگ',pdf:'PDF انداز',doctorCard:'ڈاکٹر کارڈ',signature:'دستخط',backup:'بیک اپ',restore:'بحال',clinical:'کلینیکل',xray:'ایکس رے',beforeAfter:'پہلے / بعد',all:'سب',photoCategory:'تصویر زمرہ',photoType:'تصویر قسم',general:'عام',before:'پہلے',after:'بعد',organize:'تصاویر منظم کریں',noClinical:'کلینیکل تصاویر نہیں',noXray:'ایکس رے نہیں',selectBefore:'پہلے تصویر',selectAfter:'بعد تصویر',sliderHint:'موازنہ کے لیے بار کو حرکت دیں۔',search:'نام، فون، ID یا تشخیص تلاش کریں...'}
  };
  function lang(){ return LANG[localStorage.getItem('clinicLanguage')] ? localStorage.getItem('clinicLanguage') : 'en'; }
  function L(k){ return (LANG[lang()] || LANG.en)[k] || LANG.en[k] || k; }
  window.t = L;
  window.getLang = lang;
  window.applyLanguage = function(){
    const pack = LANG[lang()] || LANG.en;
    document.documentElement.lang = lang();
    document.documentElement.dir = pack.dir;
    document.body.classList.toggle('rtl-ui', pack.dir === 'rtl');
    const map = {dashboard:'dashboard', patients:'patients', form:'addPatient', scan:'scanQR', settings:'settings'};
    Object.entries(map).forEach(([page,key]) => { const el = document.querySelector(`[data-page="${page}"]`); if(el) el.textContent = L(key); });
    const m = $id('menuBtn'); if(m) m.textContent = L('menu');
    const s = $id('search'); if(s) s.placeholder = L('search');
  };
  window.setUILanguage = function(code){
    localStorage.setItem('clinicLanguage', LANG[code] ? code : 'en');
    window.applyLanguage();
    $id('realLangModal')?.remove();
    try { if (typeof renderDashboard === 'function') renderDashboard(); if (typeof renderPatients === 'function') renderPatients(); if (typeof renderSettingsPage === 'function') renderSettingsPage(); } catch(e) {}
    if (typeof toast === 'function') toast((LANG[code] || LANG.en).native + ' selected');
  };
  window.openLanguagePicker = openLanguagePicker = function(){
    $id('realLangModal')?.remove();
    const ov = document.createElement('div');
    ov.id = 'realLangModal';
    ov.className = 'real-modal';
    ov.innerHTML = `<div class="real-lang-box" dir="ltr"><div class="real-modal-head"><div><h2>${esc(L('language'))}</h2><p>${esc(L('hint'))}</p></div><button type="button" onclick="document.getElementById('realLangModal')?.remove()">×</button></div><div class="real-lang-grid">${Object.entries(LANG).map(([code,p])=>`<button type="button" class="${code===lang()?'active':''}" onclick="setUILanguage('${code}')"><b>${esc(p.native)}</b><span>${esc(code.toUpperCase())}</span></button>`).join('')}</div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if(e.target === ov) ov.remove(); });
  };

  window.openClinicMenu = openClinicMenu = function(){
    $id('drawerOverlay')?.remove(); $id('sideDrawer')?.remove();
    const overlay = document.createElement('div'); overlay.className='drawer-overlay'; overlay.id='drawerOverlay'; overlay.onclick=window.closeClinicMenu;
    const drawer = document.createElement('aside'); drawer.className='side-drawer real-menu-drawer'; drawer.id='sideDrawer';
    drawer.innerHTML = `<div class="drawer-head"><button class="drawer-close-btn" onclick="closeClinicMenu()" aria-label="Close">×</button><h2>${esc(L('menu'))}</h2></div><div class="drawer-user"><div>${esc(window.currentUser?.full_name || window.currentUser?.username || currentUser?.full_name || currentUser?.username || 'Doctor')}</div><small>${esc(((window.currentUser?.role || currentUser?.role || 'doctor')+'').toUpperCase())}</small></div><div class="drawer-menu real-menu-grid"><button onclick="closeClinicMenu();showPage('form')">${esc(L('addPatient'))}</button><button onclick="closeClinicMenu();showPage('scan')">${esc(L('scanQR'))}</button><button class="primary-item" onclick="closeClinicMenu();showPage('settings')">${esc(L('settings'))}</button><button onclick="closeClinicMenu();openDoctorProfile()">${esc(L('profile'))}</button>${(window.currentUser?.role || currentUser?.role)==='admin'?`<button onclick="closeClinicMenu();manageUsers()">${esc(L('manageUsers'))}</button>`:''}<button class="danger-item" onclick="logout()">${esc(L('logout'))}</button></div>`;
    document.body.appendChild(overlay); document.body.appendChild(drawer);
  };
  window.closeClinicMenu = closeClinicMenu = function(){ $id('drawerOverlay')?.remove(); $id('sideDrawer')?.remove(); };
  function rebindMenu(){
    const btn = $id('menuBtn'); if(!btn || btn.dataset.realMenuBound === '1') return;
    const nb = btn.cloneNode(true); nb.dataset.realMenuBound = '1'; nb.removeAttribute('onclick'); nb.textContent = L('menu'); nb.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); window.openClinicMenu(); }, true); btn.parentNode.replaceChild(nb, btn);
  }

  function photoURL(raw){ if(!raw) return ''; if(typeof raw === 'string') return raw; return raw.url || raw.path || raw.publicUrl || ''; }
  function photoCategory(raw){
    const c = String(raw?.category || raw?.photoCategory || raw?.type || '').toLowerCase();
    const n = String(raw?.name || raw?.filename || raw?.path || raw?.url || '').toLowerCase();
    if(c === 'xray' || c === 'x-ray' || c.includes('xray') || c.includes('x-ray') || c.includes('radiograph') || n.includes('xray') || n.includes('x-ray') || n.includes('radiograph')) return 'xray';
    return 'clinical';
  }
  function photoStage(raw){ const s = String(raw?.stage || raw?.phase || '').toLowerCase(); return ['before','after'].includes(s) ? s : 'general'; }
  window.categorizedPhotos = categorizedPhotos = function(patient){
    const all = (patient?.photos || []).map((raw,index)=>({raw,index,url:photoURL(raw),category:photoCategory(raw),stage:photoStage(raw),name:raw?.name || raw?.filename || `Photo ${index+1}`})).filter(x=>x.url);
    return {all, clinical: all.filter(x=>x.category==='clinical'), xrays: all.filter(x=>x.category==='xray')};
  };
  window.simplePhotoState = window.simplePhotoState || {};
  window.updatePhotoMeta = async function(pid,index,field,value){
    const p = (window.patients || patients || []).find(x=>String(x.id)===String(pid)); if(!p) return;
    const photos = [...(p.photos || [])]; const old = photos[index];
    photos[index] = typeof old === 'string' ? {url:old,path:old,name:`Photo ${index+1}`,category:'clinical',stage:'general'} : {...old};
    photos[index][field] = value;
    try { await api(`patients?id=eq.${pid}`, {method:'PATCH', body:JSON.stringify({photos})}); p.photos = photos; const box=$id('simplePhotosBox'); if(box) box.innerHTML = renderSimplePhotos(p, window.__photoTab || 'clinical'); if(typeof toast==='function') toast('Photo updated'); }
    catch(e){ alert('Could not save photo type: ' + e.message); }
  };
  window.renderSimplePhotos = renderSimplePhotos = function(patient, type='clinical'){
    window.__photoTab = type;
    const c = categorizedPhotos(patient); const list = type==='xray' ? c.xrays : c.clinical;
    window.simplePhotoState[patient.id] = {type, photos:list};
    return `<div class="photo-tabs real-photo-tabs"><button class="photo-tab ${type==='clinical'?'active':''}" onclick="switchSimplePhotoType('${patient.id}','clinical')">${esc(L('clinical'))} <small>${c.clinical.length}</small></button><button class="photo-tab ${type==='xray'?'active':''}" onclick="switchSimplePhotoType('${patient.id}','xray')">${esc(L('xray'))} <small>${c.xrays.length}</small></button><button class="photo-tab" onclick="showBeforeAfter('${patient.id}')">${esc(L('beforeAfter'))}</button></div>${c.all.length?`<div class="real-photo-organizer"><h4>${esc(L('organize'))}</h4>${c.all.map(ph=>`<div class="real-photo-row"><img src="${esc(ph.url)}" alt=""><select onchange="updatePhotoMeta('${patient.id}',${ph.index},'category',this.value)"><option value="clinical" ${ph.category==='clinical'?'selected':''}>${esc(L('clinical'))}</option><option value="xray" ${ph.category==='xray'?'selected':''}>${esc(L('xray'))}</option></select><select onchange="updatePhotoMeta('${patient.id}',${ph.index},'stage',this.value)"><option value="general" ${ph.stage==='general'?'selected':''}>${esc(L('general'))}</option><option value="before" ${ph.stage==='before'?'selected':''}>${esc(L('before'))}</option><option value="after" ${ph.stage==='after'?'selected':''}>${esc(L('after'))}</option></select></div>`).join('')}</div>`:''}<div class="simple-photo-grid real-photo-grid">${list.length?list.map((ph,i)=>`<button class="real-photo-card" onclick="openSimplePhotoViewer('${patient.id}',${i})"><img src="${esc(ph.url)}" alt=""><span>${esc(ph.category==='xray'?L('xray'):L('clinical'))} · ${esc(L(ph.stage) || ph.stage)}</span></button>`).join(''):`<p class="muted real-empty-photo">${esc(type==='xray'?L('noXray'):L('noClinical'))}</p>`}</div>`;
  };
  window.switchSimplePhotoType = function(patientId,type){ const p=(window.patients||patients||[]).find(x=>String(x.id)===String(patientId)); const box=$id('simplePhotosBox'); if(p && box) box.innerHTML = renderSimplePhotos(p,type); };
  window.openSimplePhotoViewer = function(patientId,index=0){ const s=window.simplePhotoState[patientId]; if(!s || !s.photos.length) return; const urls=s.photos.map(x=>x.url); currentPhotoList=urls; currentPhotoIndex=index; const v=$id('photoViewer'), img=$id('viewerImage'); if(v&&img){ img.src=urls[index]; v.classList.remove('hidden'); } };

  window.showBeforeAfter = showBeforeAfter = function(id){
    const p = (window.patients || patients || []).find(x=>String(x.id)===String(id)); if(!p) return;
    const all = categorizedPhotos(p).all; if(all.length < 2) return alert('Add at least 2 photos first.');
    let beforeIndex = Math.max(0, all.findIndex(x=>x.stage==='before'));
    let afterIndex = all.findIndex((x,i)=>x.stage==='after' && i!==beforeIndex); if(afterIndex < 0) afterIndex = beforeIndex === 0 ? 1 : 0;
    const options = all.map((ph,i)=>`<option value="${i}">${i+1}. ${esc(ph.category==='xray'?L('xray'):L('clinical'))} · ${esc(L(ph.stage) || ph.stage)}</option>`).join('');
    $id('realBA')?.remove(); const ov=document.createElement('div'); ov.id='realBA'; ov.className='real-modal real-ba-modal';
    ov.innerHTML = `<div class="real-ba-box"><div class="real-modal-head"><div><h2>${esc(L('beforeAfter'))}</h2><p>${esc(L('sliderHint'))}</p></div><button onclick="document.getElementById('realBA')?.remove()">×</button></div><div class="real-ba-selects"><label>${esc(L('selectBefore'))}<select id="baBefore">${options}</select></label><label>${esc(L('selectAfter'))}<select id="baAfter">${options}</select></label></div><div class="real-ba-stage" id="baStage"><img class="ba-img" id="baBeforeImg" src="${esc(all[beforeIndex].url)}" alt="Before"><div class="ba-after-clip" id="baClip" style="clip-path:inset(0 0 0 50%)"><img class="ba-img" id="baAfterImg" src="${esc(all[afterIndex].url)}" alt="After"></div><span class="ba-pill before">${esc(L('before'))}</span><span class="ba-pill after">${esc(L('after'))}</span><div class="ba-line" id="baLine" style="left:50%"><b></b></div><input class="ba-range" id="baRange" type="range" min="0" max="100" value="50"></div></div>`;
    document.body.appendChild(ov);
    const before=$id('baBefore'), after=$id('baAfter'), range=$id('baRange'), clip=$id('baClip'), line=$id('baLine'); before.value=beforeIndex; after.value=afterIndex;
    function updateImgs(){ $id('baBeforeImg').src=all[+before.value].url; $id('baAfterImg').src=all[+after.value].url; }
    function updateSplit(){ const v=+range.value; clip.style.clipPath = `inset(0 0 0 ${v}%)`; line.style.left = v+'%'; }
    before.onchange=updateImgs; after.onchange=updateImgs; range.oninput=updateSplit;
    $id('baStage').addEventListener('pointerdown', e => { const r=e.currentTarget.getBoundingClientRect(); range.value=Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)); updateSplit(); });
    $id('baStage').addEventListener('pointermove', e => { if(e.buttons!==1) return; const r=e.currentTarget.getBoundingClientRect(); range.value=Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)); updateSplit(); });
    ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
  };

  const oldUpload = window.uploadPhotos || (typeof uploadPhotos === 'function' ? uploadPhotos : null);
  window.uploadPhotos = uploadPhotos = async function(patientId){
    const category = $id('photoCategory')?.value || 'clinical'; const stage = $id('photoStage')?.value || 'general';
    const uploaded=[];
    for(const file of (window.pendingFiles || pendingFiles || [])){
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g,'_'); const path=`${patientId}/${Date.now()}-${cleanName}`;
      const blob = await compressImage(file, category==='xray' || file.name.toLowerCase().includes('xray'));
      const url = await uploadToBucket(PHOTO_BUCKET,path,blob,'image/jpeg'); uploaded.push({path,url,name:file.name,category,stage,date:new Date().toLocaleString()});
    }
    return uploaded;
  };
  function enhancePhotoUpload(){ const input=$id('photos'); if(!input || $id('photoUploadControls')) return; const div=document.createElement('div'); div.id='photoUploadControls'; div.className='photo-upload-controls'; div.innerHTML=`<label>${esc(L('photoCategory'))}<select id="photoCategory"><option value="clinical">${esc(L('clinical'))}</option><option value="xray">${esc(L('xray'))}</option></select></label><label>${esc(L('photoType'))}<select id="photoStage"><option value="general">${esc(L('general'))}</option><option value="before">${esc(L('before'))}</option><option value="after">${esc(L('after'))}</option></select></label>`; input.parentElement.insertBefore(div,input); }
  const oldShowPage = window.showPage;
  window.showPage = showPage = function(id){ if(oldShowPage) oldShowPage(id); if(id==='form') enhancePhotoUpload(); if(id==='settings' && typeof renderSettingsPage === 'function') renderSettingsPage(); window.applyLanguage(); rebindMenu(); };
  const oldPatientDetails = window.patientDetailsHTML || (typeof patientDetailsHTML === 'function' ? patientDetailsHTML : null);
  if(oldPatientDetails){ window.patientDetailsHTML = patientDetailsHTML = function(p){ let html=oldPatientDetails(p); html = html.replace(/<div class="photo-tabs">[\s\S]*?<div id="simplePhotosBox">[\s\S]*?<\/div>/, `<div id="simplePhotosBox">${renderSimplePhotos(p,'clinical')}</div>`); return html; }; }

  function boot(){ window.applyLanguage(); rebindMenu(); enhancePhotoUpload(); setTimeout(rebindMenu,100); setTimeout(rebindMenu,1000); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', boot);
  new MutationObserver(()=>rebindMenu()).observe(document.documentElement,{childList:true,subtree:true});
})();
