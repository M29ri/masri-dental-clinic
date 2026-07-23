/* === FINAL LANGUAGE PICKER NAME FIX: keep native names, do not translate language list === */
(function(){
  const RTL = new Set(['ar','he','ur','fa','ps','ku','sd','ug','yi']);
  const LANGUAGE_OPTIONS = [
    ['en','English'],['ar','العربية'],['fr','Français'],['es','Español'],['de','Deutsch'],['it','Italiano'],['pt','Português'],['tr','Türkçe'],['ur','اردو'],['fa','فارسی'],
    ['af','Afrikaans'],['am','አማርኛ'],['az','Azərbaycanca'],['bg','Български'],['bn','বাংলা'],['bs','Bosanski'],['ca','Català'],['cs','Čeština'],['cy','Cymraeg'],['da','Dansk'],
    ['el','Ελληνικά'],['et','Eesti'],['eu','Euskara'],['fi','Suomi'],['fil','Filipino'],['ga','Gaeilge'],['gl','Galego'],['gu','ગુજરાતી'],['he','עברית'],['hi','हिन्दी'],
    ['hr','Hrvatski'],['hu','Magyar'],['id','Bahasa Indonesia'],['is','Íslenska'],['ja','日本語'],['kn','ಕನ್ನಡ'],['kk','Қазақша'],['km','ភាសាខ្មែរ'],['ko','한국어'],['lo','ລາວ'],
    ['lt','Lietuvių'],['lv','Latviešu'],['mk','Македонски'],['ml','മലയാളം'],['mn','Монгол'],['mr','मराठी'],['ms','Bahasa Melayu'],['my','မြန်မာ'],['nb','Norsk Bokmål'],['ne','नेपाली'],
    ['nl','Nederlands'],['pa','ਪੰਜਾਬੀ'],['pl','Polski'],['ro','Română'],['ru','Русский'],['sk','Slovenčina'],['sl','Slovenščina'],['sq','Shqip'],['sr','Српски'],['sv','Svenska'],
    ['sw','Kiswahili'],['ta','தமிழ்'],['te','తెలుగు'],['th','ไทย'],['uk','Українська'],['vi','Tiếng Việt'],['zh','中文'],['zu','Zulu']
  ];
  const labelMap = Object.fromEntries(LANGUAGE_OPTIONS);
  function esc(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function langTitle(){ try { return (window.t && window.t('language')) || 'Language'; } catch(e){ return 'Language'; } }
  function langHelp(){ try { return (window.t && window.t('languageHelp')) || 'Choose the language for the app interface.'; } catch(e){ return 'Choose the language for the app interface.'; } }
  function refreshNativeNames(){
    document.querySelectorAll('#languageCleanOverlay [data-native-code]').forEach(btn=>{
      const code = btn.getAttribute('data-native-code');
      const strong = btn.querySelector('strong');
      const span = btn.querySelector('span');
      if(strong) strong.textContent = labelMap[code] || code.toUpperCase();
      if(span) span.textContent = code.toUpperCase();
      btn.dir = RTL.has(code) ? 'rtl' : 'ltr';
      btn.dataset.languageItem = (code + ' ' + (labelMap[code] || '')).toLowerCase();
    });
  }
  window.filterLanguagesFinal = function(q){
    q = String(q||'').toLowerCase().trim();
    document.querySelectorAll('#languageCleanOverlay [data-native-code]').forEach(btn=>{
      const hay = (btn.dataset.languageItem || '').toLowerCase();
      btn.style.display = !q || hay.includes(q) ? '' : 'none';
    });
  };
  window.openLanguagePicker = function(){
    document.getElementById('languageCleanOverlay')?.remove();
    const current = localStorage.getItem('clinicLanguage') || 'en';
    const overlay = document.createElement('div');
    overlay.id = 'languageCleanOverlay';
    overlay.className = 'clean-modal-overlay no-translate';
    overlay.setAttribute('translate','no');
    const optionsHtml = LANGUAGE_OPTIONS.map(([code,name]) => `
      <button type="button" translate="no" data-native-code="${esc(code)}" data-language-item="${esc((code+' '+name).toLowerCase())}" class="clean-language-item ${current===code?'active':''}" dir="${RTL.has(code)?'rtl':'ltr'}" onclick="setUILanguage('${esc(code)}')">
        <strong translate="no">${esc(name)}</strong><span translate="no">${esc(code.toUpperCase())}</span>
      </button>`).join('');
    overlay.innerHTML = `<div class="clean-modal clean-language-modal final-language-modal no-translate" role="dialog" aria-modal="true" dir="ltr" translate="no">
      <div class="clean-modal-head"><div><h2>${esc(langTitle())}</h2><p>${esc(langHelp())}</p></div><button type="button" onclick="document.getElementById('languageCleanOverlay')?.remove()">×</button></div>
      <div class="final-language-search"><input id="languageSearchInput" placeholder="Search language..." oninput="filterLanguagesFinal(this.value)"></div>
      <div class="clean-language-grid final-language-grid">${optionsHtml}</div>
    </div>`;
    overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    // Older language observer may run right after insertion; restore native names after it finishes.
    [0,80,180,400,900].forEach(ms=>setTimeout(refreshNativeNames, ms));
    setTimeout(()=>document.getElementById('languageSearchInput')?.focus(),120);
  };
  // Make setting a language use the selected code and then reapply the UI, without touching native names.
  const previousSet = window.setUILanguage;
  window.setUILanguage = function(code){
    localStorage.setItem('clinicLanguage', code || 'en');
    document.getElementById('languageCleanOverlay')?.remove();
    if(typeof previousSet === 'function') {
      try { previousSet(code); } catch(e) {}
    }
    try { window.applyLanguage && window.applyLanguage(); } catch(e) {}
    [0,120,350].forEach(ms=>setTimeout(()=>{ try { window.applyLanguage && window.applyLanguage(); } catch(e) {} }, ms));
  };
})();

/* === HARD GUARD: never translate language names in picker === */
(function(){
  const native = {
    en:'English', ar:'العربية', fr:'Français', es:'Español', de:'Deutsch', it:'Italiano', pt:'Português', tr:'Türkçe', ur:'اردو', fa:'فارسی',
    af:'Afrikaans', am:'አማርኛ', az:'Azərbaycanca', bg:'Български', bn:'বাংলা', bs:'Bosanski', ca:'Català', cs:'Čeština', cy:'Cymraeg', da:'Dansk', el:'Ελληνικά', et:'Eesti', eu:'Euskara', fi:'Suomi', fil:'Filipino', ga:'Gaeilge', gl:'Galego', gu:'ગુજરાતી', he:'עברית', hi:'हिन्दी', hr:'Hrvatski', hu:'Magyar', id:'Bahasa Indonesia', is:'Íslenska', ja:'日本語', kn:'ಕನ್ನಡ', kk:'Қазақша', km:'ភាសាខ្មែរ', ko:'한국어', lo:'ລາວ', lt:'Lietuvių', lv:'Latviešu', mk:'Македонски', ml:'മലയാളം', mn:'Монгол', mr:'मराठी', ms:'Bahasa Melayu', my:'မြန်မာ', nb:'Norsk Bokmål', ne:'नेपाली', nl:'Nederlands', pa:'ਪੰਜਾਬੀ', pl:'Polski', ro:'Română', ru:'Русский', sk:'Slovenčina', sl:'Slovenščina', sq:'Shqip', sr:'Српски', sv:'Svenska', sw:'Kiswahili', ta:'தமிழ்', te:'తెలుగు', th:'ไทย', uk:'Українська', vi:'Tiếng Việt', zh:'中文', zu:'Zulu'
  };
  const rtl = new Set(['ar','he','ur','fa','ps','ku','sd','ug','yi']);
  function restore(){
    const overlay = document.getElementById('languageCleanOverlay');
    if(!overlay) return;
    overlay.classList.add('no-translate'); overlay.setAttribute('translate','no'); overlay.dir='ltr';
    overlay.querySelectorAll('.clean-language-item,[data-native-code]').forEach(btn=>{
      const code = (btn.getAttribute('data-native-code') || (btn.querySelector('span')?.textContent||'').trim().toLowerCase());
      if(!native[code]) return;
      btn.setAttribute('translate','no'); btn.classList.add('no-translate'); btn.dir = rtl.has(code) ? 'rtl':'ltr';
      const strong = btn.querySelector('strong'); const span = btn.querySelector('span');
      if(strong){ strong.textContent = native[code]; strong.setAttribute('translate','no'); }
      if(span){ span.textContent = code.toUpperCase(); span.setAttribute('translate','no'); }
      btn.dataset.languageItem = (code+' '+native[code]).toLowerCase();
    });
  }
  const oldOpen = window.openLanguagePicker;
  window.openLanguagePicker = function(){
    const out = oldOpen ? oldOpen.apply(this, arguments) : undefined;
    [0,16,50,100,200,500,1000].forEach(ms=>setTimeout(restore,ms));
    return out;
  };
  new MutationObserver(()=>setTimeout(restore,0)).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
