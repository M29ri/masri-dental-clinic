/* Force Fix v2: replaces the duplicated old menu/language/photo code with one clean implementation. */
(function(){
  'use strict';
  const $id = (id) => document.getElementById(id);
  const esc = (v='') => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  const BASE_KEYS = {
    menu:'Menu', addPatient:'Add Patient', scanQR:'Scan QR', settings:'Settings', profile:'Profile', manageUsers:'Manage Users', logout:'Logout',
    language:'Language', choose:'Choose language', hint:'Choose the language for the app interface.', theme:'Theme color', pdf:'PDF style', doctorCard:'Doctor card', signature:'Signature', backup:'Backup', restore:'Restore',
    clinical:'Clinical', xray:'X-ray', beforeAfter:'Before / After', all:'All', photoCategory:'Photo category', photoType:'Photo type', general:'General', before:'Before', after:'After', organize:'Organize photos',
    noClinical:'No clinical photos yet', noXray:'No X-rays yet', selectBefore:'Before photo', selectAfter:'After photo', sliderHint:'Drag the bar to compare before and after.', search:'Search by name, phone, ID, or diagnosis...',
    photos:'Photos / X-rays', patientTimeline:'Patient Timeline', save:'Save', close:'Close', edit:'Edit', delete:'Delete', receipt:'Receipt', payment:'Payment', payments:'Payments', visits:'Visits', appointments:'Appointments', lab:'Lab', prescription:'Prescription', consent:'Consent', summary:'Summary', smartNote:'Smart Note', aiPlan:'AI Plan', template:'Template', whatsapp:'WhatsApp', qrCode:'QR Code', exportPDF:'Export PDF', editPatient:'Edit Patient'
  };

  const LANG = {
    en:{native:'English',dir:'ltr'},
    ar:{native:'العربية',dir:'rtl', menu:'القائمة',addPatient:'إضافة مريض',scanQR:'مسح QR',settings:'الإعدادات',profile:'الملف الشخصي',manageUsers:'إدارة المستخدمين',logout:'تسجيل الخروج',language:'اللغة',choose:'اختر اللغة',hint:'اختر لغة واجهة التطبيق.',theme:'لون التطبيق',pdf:'شكل PDF',doctorCard:'بطاقة الطبيب',signature:'التوقيع',backup:'نسخة احتياطية',restore:'استرجاع',clinical:'سريري',xray:'أشعة',beforeAfter:'قبل / بعد',all:'الكل',photoCategory:'تصنيف الصورة',photoType:'نوع الصورة',general:'عام',before:'قبل',after:'بعد',organize:'تنظيم الصور',noClinical:'لا توجد صور سريرية',noXray:'لا توجد صور أشعة',selectBefore:'صورة قبل',selectAfter:'صورة بعد',sliderHint:'اسحب الشريط للمقارنة بين قبل وبعد.',search:'ابحث بالاسم أو الهاتف أو الكود أو التشخيص...',photos:'الصور / الأشعة',patientTimeline:'تاريخ المريض',close:'إغلاق',edit:'تعديل',delete:'حذف',receipt:'إيصال',payment:'دفعة',payments:'المدفوعات',visits:'الزيارات',appointments:'المواعيد',lab:'المعمل',prescription:'روشتة',consent:'موافقة',summary:'ملخص',smartNote:'ملاحظة ذكية',aiPlan:'خطة ذكية',template:'قالب',whatsapp:'واتساب',qrCode:'رمز QR',exportPDF:'تصدير PDF',editPatient:'تعديل المريض'},
    fr:{native:'Français',dir:'ltr', menu:'Menu',addPatient:'Ajouter patient',scanQR:'Scanner QR',settings:'Paramètres',profile:'Profil',manageUsers:'Utilisateurs',logout:'Déconnexion',language:'Langue',choose:'Choisir la langue',hint:'Choisissez la langue de l’interface.',theme:'Couleur',pdf:'Style PDF',doctorCard:'Carte médecin',signature:'Signature',backup:'Sauvegarde',restore:'Restaurer',clinical:'Clinique',xray:'Radio',beforeAfter:'Avant / Après',all:'Tout',photoCategory:'Catégorie photo',photoType:'Type photo',general:'Général',before:'Avant',after:'Après',organize:'Organiser les photos',noClinical:'Aucune photo clinique',noXray:'Aucune radio',selectBefore:'Photo avant',selectAfter:'Photo après',sliderHint:'Faites glisser la barre pour comparer.',search:'Rechercher nom, téléphone, ID ou diagnostic...',photos:'Photos / Radios',patientTimeline:'Chronologie patient',close:'Fermer',edit:'Modifier',delete:'Supprimer',receipt:'Reçu',payment:'Paiement',payments:'Paiements',visits:'Visites',appointments:'Rendez-vous'},
    es:{native:'Español',dir:'ltr', menu:'Menú',addPatient:'Añadir paciente',scanQR:'Escanear QR',settings:'Ajustes',profile:'Perfil',manageUsers:'Usuarios',logout:'Salir',language:'Idioma',choose:'Elegir idioma',hint:'Elige el idioma de la interfaz.',theme:'Color',pdf:'Estilo PDF',doctorCard:'Tarjeta doctor',signature:'Firma',backup:'Copia',restore:'Restaurar',clinical:'Clínica',xray:'Rayos X',beforeAfter:'Antes / Después',all:'Todo',photoCategory:'Categoría foto',photoType:'Tipo foto',general:'General',before:'Antes',after:'Después',organize:'Organizar fotos',noClinical:'Sin fotos clínicas',noXray:'Sin rayos X',selectBefore:'Foto antes',selectAfter:'Foto después',sliderHint:'Arrastra la barra para comparar.',search:'Buscar nombre, teléfono, ID o diagnóstico...',photos:'Fotos / Rayos X',patientTimeline:'Cronología del paciente',close:'Cerrar',edit:'Editar',delete:'Eliminar',receipt:'Recibo',payment:'Pago',payments:'Pagos',visits:'Visitas',appointments:'Citas'},
    de:{native:'Deutsch',dir:'ltr', menu:'Menü',addPatient:'Patient hinzufügen',scanQR:'QR scannen',settings:'Einstellungen',profile:'Profil',manageUsers:'Benutzer',logout:'Abmelden',language:'Sprache',choose:'Sprache wählen',hint:'Wählen Sie die Sprache der App.',theme:'Farbe',pdf:'PDF-Stil',doctorCard:'Arztkarte',signature:'Unterschrift',backup:'Backup',restore:'Wiederherstellen',clinical:'Klinisch',xray:'Röntgen',beforeAfter:'Vorher / Nachher',all:'Alle',photoCategory:'Fotokategorie',photoType:'Fototyp',general:'Allgemein',before:'Vorher',after:'Nachher',organize:'Fotos organisieren',noClinical:'Keine klinischen Fotos',noXray:'Keine Röntgenbilder',selectBefore:'Vorher-Foto',selectAfter:'Nachher-Foto',sliderHint:'Ziehen Sie die Leiste zum Vergleichen.',search:'Name, Telefon, ID oder Diagnose suchen...',photos:'Fotos / Röntgen',patientTimeline:'Patientenverlauf'},
    it:{native:'Italiano',dir:'ltr', menu:'Menu',addPatient:'Aggiungi paziente',scanQR:'Scansiona QR',settings:'Impostazioni',profile:'Profilo',manageUsers:'Utenti',logout:'Esci',language:'Lingua',choose:'Scegli lingua',hint:'Scegli la lingua dell’interfaccia.',theme:'Colore',pdf:'Stile PDF',doctorCard:'Scheda medico',signature:'Firma',backup:'Backup',restore:'Ripristina',clinical:'Clinica',xray:'Radiografia',beforeAfter:'Prima / Dopo',all:'Tutto',photoCategory:'Categoria foto',photoType:'Tipo foto',general:'Generale',before:'Prima',after:'Dopo',organize:'Organizza foto',noClinical:'Nessuna foto clinica',noXray:'Nessuna radiografia',selectBefore:'Foto prima',selectAfter:'Foto dopo',sliderHint:'Trascina la barra per confrontare.',search:'Cerca nome, telefono, ID o diagnosi...'},
    pt:{native:'Português',dir:'ltr', menu:'Menu',addPatient:'Adicionar paciente',scanQR:'Ler QR',settings:'Configurações',profile:'Perfil',manageUsers:'Usuários',logout:'Sair',language:'Idioma',choose:'Escolher idioma',hint:'Escolha o idioma da interface.',theme:'Cor',pdf:'Estilo PDF',doctorCard:'Cartão médico',signature:'Assinatura',backup:'Backup',restore:'Restaurar',clinical:'Clínico',xray:'Raio X',beforeAfter:'Antes / Depois',all:'Tudo',photoCategory:'Categoria da foto',photoType:'Tipo da foto',general:'Geral',before:'Antes',after:'Depois',organize:'Organizar fotos',noClinical:'Sem fotos clínicas',noXray:'Sem raio X',selectBefore:'Foto antes',selectAfter:'Foto depois',sliderHint:'Arraste a barra para comparar.',search:'Pesquisar nome, telefone, ID ou diagnóstico...'},
    tr:{native:'Türkçe',dir:'ltr', menu:'Menü',addPatient:'Hasta ekle',scanQR:'QR tara',settings:'Ayarlar',profile:'Profil',manageUsers:'Kullanıcılar',logout:'Çıkış',language:'Dil',choose:'Dil seç',hint:'Uygulama arayüz dilini seçin.',theme:'Renk',pdf:'PDF stili',doctorCard:'Doktor kartı',signature:'İmza',backup:'Yedek',restore:'Geri yükle',clinical:'Klinik',xray:'Röntgen',beforeAfter:'Önce / Sonra',all:'Tümü',photoCategory:'Fotoğraf kategorisi',photoType:'Fotoğraf tipi',general:'Genel',before:'Önce',after:'Sonra',organize:'Fotoğrafları düzenle',noClinical:'Klinik foto yok',noXray:'Röntgen yok',selectBefore:'Önce fotoğrafı',selectAfter:'Sonra fotoğrafı',sliderHint:'Karşılaştırmak için çubuğu sürükleyin.',search:'Ad, telefon, ID veya teşhis ara...'},
    ur:{native:'اردو',dir:'rtl', menu:'مینو',addPatient:'مریض شامل کریں',scanQR:'QR اسکین',settings:'ترتیبات',profile:'پروفائل',manageUsers:'صارفین',logout:'لاگ آؤٹ',language:'زبان',choose:'زبان منتخب کریں',hint:'ایپ کی زبان منتخب کریں۔',theme:'رنگ',pdf:'PDF انداز',doctorCard:'ڈاکٹر کارڈ',signature:'دستخط',backup:'بیک اپ',restore:'بحال کریں',clinical:'کلینیکل',xray:'ایکس رے',beforeAfter:'پہلے / بعد',all:'سب',photoCategory:'تصویر کی قسم',photoType:'تصویر کا مرحلہ',general:'عام',before:'پہلے',after:'بعد',organize:'تصاویر منظم کریں',noClinical:'کلینیکل تصاویر نہیں',noXray:'ایکس رے نہیں',selectBefore:'پہلے تصویر',selectAfter:'بعد تصویر',sliderHint:'موازنہ کے لیے بار کو سلائیڈ کریں۔',search:'نام، فون، ID یا تشخیص تلاش کریں...'}
  };
  const EXTRA_LOCALES = [
    ['af','Afrikaans'],['am','አማርኛ'],['az','Azərbaycanca'],['bg','Български'],['bn','বাংলা'],['ca','Català'],['cs','Čeština'],['da','Dansk'],['el','Ελληνικά'],['et','Eesti'],['fa','فارسی','rtl'],['fi','Suomi'],['he','עברית','rtl'],['hi','हिन्दी'],['hr','Hrvatski'],['hu','Magyar'],['id','Indonesia'],['ja','日本語'],['ko','한국어'],['lt','Lietuvių'],['lv','Latviešu'],['ms','Melayu'],['nl','Nederlands'],['no','Norsk'],['pl','Polski'],['ro','Română'],['ru','Русский'],['sk','Slovenčina'],['sl','Slovenščina'],['sr','Српски'],['sv','Svenska'],['sw','Kiswahili'],['ta','தமிழ்'],['te','తెలుగు'],['th','ไทย'],['uk','Українська'],['vi','Tiếng Việt'],['zh','中文']
  ];
  EXTRA_LOCALES.forEach(([code,native,dir]) => { if(!LANG[code]) LANG[code] = {native, dir:dir || 'ltr'}; });
  Object.keys(LANG).forEach(k => { LANG[k] = Object.assign({}, BASE_KEYS, LANG[k]); });
  function currentLang(){ return localStorage.getItem('clinicLanguage') || 'en'; }
  function L(key){ const lang = currentLang(); return (LANG[lang] && LANG[lang][key]) || LANG.en[key] || key; }
  window.L = L; window.t = L;

  function exactTextMap(){
    const keys = Object.keys(BASE_KEYS); const m = new Map();
    keys.forEach(key => { Object.keys(LANG).forEach(code => { const old = LANG[code][key] || BASE_KEYS[key]; if(old) m.set(old, L(key)); }); m.set(BASE_KEYS[key], L(key)); });
    m.set('Photos / X-rays', L('photos')); m.set('X-rays', L('xray')); m.set('X-ray', L('xray')); m.set('Before / After', L('beforeAfter'));
    return m;
  }
  function translateExistingDOM(root=document.body){
    const map = exactTextMap();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode(node){
      if(!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if(['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(node.parentElement?.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => { const raw=n.nodeValue.trim(); if(map.has(raw)) n.nodeValue = n.nodeValue.replace(raw, map.get(raw)); });
    document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el => { if(/Search|ابحث|Rechercher|Buscar|Suchen|Cerca|Pesquisar|ara|تلاش/.test(el.placeholder)) el.placeholder=L('search'); });
  }
  window.applyLanguage = function(){
    const lang = currentLang(), cfg = LANG[lang] || LANG.en;
    document.documentElement.lang = lang; document.documentElement.dir = cfg.dir || 'ltr'; document.body?.setAttribute('dir', cfg.dir || 'ltr');
    const menuBtn=$id('menuBtn'); if(menuBtn) menuBtn.textContent=L('menu');
    document.querySelector('[data-page="form"]') && (document.querySelector('[data-page="form"]').textContent=L('addPatient'));
    document.querySelector('[data-page="scan"]') && (document.querySelector('[data-page="scan"]').textContent=L('scanQR'));
    document.querySelector('[data-page="settings"]') && (document.querySelector('[data-page="settings"]').textContent=L('settings'));
    translateExistingDOM();
  };
  window.setUILanguage = function(lang){
    localStorage.setItem('clinicLanguage', LANG[lang] ? lang : 'en');
    window.applyLanguage();
    try { if(typeof renderSettingsPage==='function' && document.querySelector('#settingsPage:not(.hidden), #settings:not(.hidden)')) renderSettingsPage(); } catch(e){}
    closeLanguagePicker();
    setTimeout(window.applyLanguage, 50);
  };
  window.closeLanguagePicker = function(){ $id('forceLanguageModal')?.remove(); };
  window.openLanguagePicker = function(){
    closeLanguagePicker();
    const cur = currentLang();
    const overlay=document.createElement('div'); overlay.id='forceLanguageModal'; overlay.className='force-modal';
    overlay.innerHTML=`<div class="force-language-box" dir="${esc((LANG[cur]||LANG.en).dir)}"><div class="force-modal-head"><div><h2>${esc(L('choose'))}</h2><p>${esc(L('hint'))}</p></div><button type="button" onclick="closeLanguagePicker()">×</button></div><div class="force-language-grid">${Object.entries(LANG).map(([code,cfg])=>`<button type="button" class="force-lang ${cur===code?'selected':''}" dir="${esc(cfg.dir||'ltr')}" onclick="setUILanguage('${esc(code)}')"><b>${esc(cfg.native)}</b><span>${esc(code.toUpperCase())}</span></button>`).join('')}</div></div>`;
    document.body.appendChild(overlay); overlay.addEventListener('click',e=>{ if(e.target===overlay) closeLanguagePicker(); });
  };

  window.openClinicMenu = function(){
    $id('drawerOverlay')?.remove(); $id('sideDrawer')?.remove();
    const overlay=document.createElement('div'); overlay.className='drawer-overlay'; overlay.id='drawerOverlay'; overlay.onclick=()=>window.closeClinicMenu();
    const drawer=document.createElement('aside'); drawer.className='side-drawer force-simple-drawer'; drawer.id='sideDrawer';
    const isAdmin = (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin');
    drawer.innerHTML=`<div class="drawer-head"><h2>${esc(L('menu'))}</h2><button class="drawer-close-btn" onclick="closeClinicMenu()">×</button></div><div class="drawer-user"><div>${esc((typeof currentUser!=='undefined' && currentUser && (currentUser.full_name || currentUser.username)) || 'Doctor')}</div><small>${esc(((typeof currentUser!=='undefined' && currentUser && currentUser.role) || 'doctor').toUpperCase())}</small></div><div class="drawer-menu force-menu-only"><button onclick="closeClinicMenu();showPage('form')">${esc(L('addPatient'))}</button><button onclick="closeClinicMenu();showPage('scan')">${esc(L('scanQR'))}</button><button class="primary-item" onclick="closeClinicMenu();showPage('settings')">${esc(L('settings'))}</button><button onclick="closeClinicMenu();openDoctorProfile()">${esc(L('profile'))}</button>${isAdmin?`<button onclick="closeClinicMenu();manageUsers()">${esc(L('manageUsers'))}</button>`:''}<button class="danger-item" onclick="logout()">${esc(L('logout'))}</button></div>`;
    document.body.appendChild(overlay); document.body.appendChild(drawer);
  };
  window.closeClinicMenu = function(){ $id('drawerOverlay')?.remove(); $id('sideDrawer')?.remove(); };

  function photoUrl(raw){ return !raw ? '' : (typeof raw === 'string' ? raw : (raw.url || raw.publicUrl || raw.path || '')); }
  function metaKey(patientId){ return 'clinicPhotoMeta:' + patientId; }
  function loadMeta(patientId){ try{return JSON.parse(localStorage.getItem(metaKey(patientId))||'{}');}catch{return{};} }
  function saveMeta(patientId,meta){ localStorage.setItem(metaKey(patientId), JSON.stringify(meta||{})); }
  function normalizePhoto(patient,index,raw){
    const url=photoUrl(raw); const m=loadMeta(patient.id)[url] || {};
    const rawCat=String(m.category || raw?.category || raw?.photoCategory || raw?.type || '').toLowerCase();
    const name=String(raw?.name || raw?.filename || raw?.path || url || '').toLowerCase();
    const category = rawCat==='xray' || rawCat==='x-ray' || name.includes('xray') || name.includes('x-ray') || name.includes('radiograph') ? 'xray' : 'clinical';
    const rawStage=String(m.stage || raw?.stage || raw?.phase || '').toLowerCase();
    const stage = ['before','after','general'].includes(rawStage) ? rawStage : 'general';
    return {raw,index,url,category,stage,name: raw?.name || `Photo ${index+1}`};
  }
  window.categorizedPhotos = function(patient){ const all=(patient?.photos||[]).map((r,i)=>normalizePhoto(patient,i,r)).filter(x=>x.url); return {all, clinical:all.filter(x=>x.category==='clinical'), xray:all.filter(x=>x.category==='xray')}; };
  window.setPhotoMeta = async function(patientId,index,field,value){
    const p=(typeof patients!=='undefined'?patients:[]).find(x=>String(x.id)===String(patientId)); if(!p) return;
    const raw=(p.photos||[])[index]; const url=photoUrl(raw); if(!url) return;
    const meta=loadMeta(patientId); meta[url]=Object.assign({}, meta[url]||{}, {[field]:value}); saveMeta(patientId, meta);
    if(typeof raw === 'object' && raw){ raw[field]=value; }
    const box=$id('simplePhotosBox'); if(box) box.innerHTML=renderSimplePhotos(p, window.__photoTab || (value==='xray'?'xray':'clinical'));
    try { if(typeof api==='function') await api(`patients?id=eq.${patientId}`, {method:'PATCH', body:JSON.stringify({photos:p.photos})}); } catch(e){ console.warn('Saved photo type locally only:', e); }
  };
  window.renderSimplePhotos = function(patient,type='clinical'){
    window.__photoTab=type; const c=window.categorizedPhotos(patient); const list=type==='xray'?c.xray:c.clinical;
    window.simplePhotoState = window.simplePhotoState || {}; window.simplePhotoState[patient.id]={type,photos:list};
    return `<div class="force-photo-tabs"><button class="${type==='clinical'?'active':''}" onclick="switchSimplePhotoType('${esc(patient.id)}','clinical')">${esc(L('clinical'))} <small>${c.clinical.length}</small></button><button class="${type==='xray'?'active':''}" onclick="switchSimplePhotoType('${esc(patient.id)}','xray')">${esc(L('xray'))} <small>${c.xray.length}</small></button><button onclick="showBeforeAfter('${esc(patient.id)}')">${esc(L('beforeAfter'))}</button></div>${c.all.length?`<section class="force-organizer"><h4>${esc(L('organize'))}</h4>${c.all.map(ph=>`<div class="force-org-row"><img src="${esc(ph.url)}" alt=""><div class="force-org-controls"><div class="seg"><button class="${ph.category==='clinical'?'on':''}" onclick="setPhotoMeta('${esc(patient.id)}',${ph.index},'category','clinical')">${esc(L('clinical'))}</button><button class="${ph.category==='xray'?'on':''}" onclick="setPhotoMeta('${esc(patient.id)}',${ph.index},'category','xray')">${esc(L('xray'))}</button></div><div class="seg"><button class="${ph.stage==='general'?'on':''}" onclick="setPhotoMeta('${esc(patient.id)}',${ph.index},'stage','general')">${esc(L('general'))}</button><button class="${ph.stage==='before'?'on':''}" onclick="setPhotoMeta('${esc(patient.id)}',${ph.index},'stage','before')">${esc(L('before'))}</button><button class="${ph.stage==='after'?'on':''}" onclick="setPhotoMeta('${esc(patient.id)}',${ph.index},'stage','after')">${esc(L('after'))}</button></div></div></div>`).join('')}</section>`:''}<div class="force-photo-grid">${list.length?list.map((ph,i)=>`<button onclick="openSimplePhotoViewer('${esc(patient.id)}',${i})" class="force-photo-card"><img src="${esc(ph.url)}" alt=""><span>${esc(ph.category==='xray'?L('xray'):L('clinical'))} · ${esc(ph.stage==='before'?L('before'):ph.stage==='after'?L('after'):L('general'))}</span></button>`).join(''):`<p class="muted">${esc(type==='xray'?L('noXray'):L('noClinical'))}</p>`}</div>`;
  };
  window.switchSimplePhotoType = function(patientId,type){ const p=(typeof patients!=='undefined'?patients:[]).find(x=>String(x.id)===String(patientId)); const box=$id('simplePhotosBox'); if(p&&box) box.innerHTML=renderSimplePhotos(p,type); };
  window.openSimplePhotoViewer = function(patientId,index){ const state=window.simplePhotoState?.[patientId]; if(!state?.photos?.length) return; currentPhotoList=state.photos.map(x=>x.url); currentPhotoIndex=index||0; const v=$id('photoViewer'), img=$id('viewerImage'); if(v&&img){ img.src=currentPhotoList[currentPhotoIndex]; v.classList.remove('hidden'); } };

  window.showBeforeAfter = function(patientId){
    const p=(typeof patients!=='undefined'?patients:[]).find(x=>String(x.id)===String(patientId)); if(!p) return;
    const all=window.categorizedPhotos(p).all; if(all.length<2) return alert('Add at least two photos first.');
    let bi=all.findIndex(x=>x.stage==='before'); if(bi<0) bi=0; let ai=all.findIndex((x,i)=>x.stage==='after' && i!==bi); if(ai<0) ai=bi===0?1:0;
    $id('forceBA')?.remove();
    const opts=all.map((ph,i)=>`<option value="${i}">${i+1}. ${ph.category==='xray'?L('xray'):L('clinical')} · ${ph.stage==='before'?L('before'):ph.stage==='after'?L('after'):L('general')}</option>`).join('');
    const ov=document.createElement('div'); ov.id='forceBA'; ov.className='force-modal';
    ov.innerHTML=`<div class="force-ba-box"><div class="force-modal-head"><div><h2>${esc(L('beforeAfter'))}</h2><p>${esc(L('sliderHint'))}</p></div><button onclick="document.getElementById('forceBA')?.remove()">×</button></div><div class="force-ba-selects"><label>${esc(L('selectBefore'))}<select id="forceBefore">${opts}</select></label><label>${esc(L('selectAfter'))}<select id="forceAfter">${opts}</select></label></div><div class="force-ba-stage" id="forceBAStage"><img id="forceBeforeImg" src="${esc(all[bi].url)}" alt=""><div id="forceClip" class="force-ba-clip" style="width:50%"><img id="forceAfterImg" src="${esc(all[ai].url)}" alt=""></div><span class="pill before">${esc(L('before'))}</span><span class="pill after">${esc(L('after'))}</span><div id="forceBALine" class="force-ba-line" style="left:50%"><b></b></div><input id="forceBARange" class="force-ba-range" type="range" min="0" max="100" value="50"></div></div>`;
    document.body.appendChild(ov); const before=$id('forceBefore'), after=$id('forceAfter'), range=$id('forceBARange'), clip=$id('forceClip'), line=$id('forceBALine'); before.value=bi; after.value=ai;
    const updateImgs=()=>{ $id('forceBeforeImg').src=all[+before.value].url; $id('forceAfterImg').src=all[+after.value].url; };
    const updateSplit=()=>{ const v=+range.value; clip.style.width=v+'%'; line.style.left=v+'%'; };
    before.onchange=updateImgs; after.onchange=updateImgs; range.oninput=updateSplit;
    const drag=e=>{ const r=$id('forceBAStage').getBoundingClientRect(); range.value=Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)); updateSplit(); };
    $id('forceBAStage').addEventListener('pointerdown',drag); $id('forceBAStage').addEventListener('pointermove',e=>{ if(e.buttons===1) drag(e); }); ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
  };

  const oldUpload = (typeof uploadPhotos === 'function') ? uploadPhotos : null;
  if(oldUpload){
    window.uploadPhotos = uploadPhotos = async function(patientId){
      const category=$id('photoCategory')?.value || 'clinical'; const stage=$id('photoStage')?.value || 'general'; const uploaded=[];
      for(const file of (typeof pendingFiles!=='undefined'?pendingFiles:[])){
        const cleanName=file.name.replace(/[^a-zA-Z0-9.]/g,'_'); const path=`${patientId}/${Date.now()}-${cleanName}`;
        const blob=await compressImage(file, category==='xray' || file.name.toLowerCase().includes('xray'));
        uploaded.push({path,url:await uploadToBucket(PHOTO_BUCKET,path,blob,'image/jpeg'),name:file.name,category,stage,date:new Date().toLocaleString()});
      }
      return uploaded;
    };
  }
  function enhancePhotoUpload(){ const input=$id('photos'); if(!input || $id('photoUploadControls')) return; const div=document.createElement('div'); div.id='photoUploadControls'; div.className='photo-upload-controls'; div.innerHTML=`<label>${esc(L('photoCategory'))}<select id="photoCategory"><option value="clinical">${esc(L('clinical'))}</option><option value="xray">${esc(L('xray'))}</option></select></label><label>${esc(L('photoType'))}<select id="photoStage"><option value="general">${esc(L('general'))}</option><option value="before">${esc(L('before'))}</option><option value="after">${esc(L('after'))}</option></select></label>`; input.parentElement.insertBefore(div,input); }

  if(typeof patientDetailsHTML === 'function'){
    const oldPatientDetails = patientDetailsHTML;
    window.patientDetailsHTML = patientDetailsHTML = function(p){
      let html=oldPatientDetails(p);
      const photoBlock=`<h3 style="color:var(--accent);margin-top:24px;">${esc(L('photos'))}</h3><div id="simplePhotosBox">${renderSimplePhotos(p,'clinical')}</div><h3 style="color:var(--accent);margin-top:24px;">${esc(L('patientTimeline'))}</h3>`;
      html=html.replace(/<h3[^>]*>Photos\s*\/\s*X-rays<\/h3>[\s\S]*?<h3[^>]*>Patient Timeline<\/h3>/i, photoBlock);
      return html;
    };
  }
  if(typeof showPage === 'function'){
    const oldShowPage=showPage;
    window.showPage = showPage = function(page){ oldShowPage(page); if(page==='form') enhancePhotoUpload(); setTimeout(window.applyLanguage,0); };
  }
  const oldRenderSettings = (typeof renderSettingsPage === 'function') ? renderSettingsPage : null;
  if(oldRenderSettings){ window.renderSettingsPage = renderSettingsPage = function(){ oldRenderSettings(); setTimeout(window.applyLanguage,0); }; }

  function boot(){ try{window.applyLanguage(); enhancePhotoUpload();}catch(e){console.error('force fix boot',e);} }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  window.addEventListener('load',boot);
})();
