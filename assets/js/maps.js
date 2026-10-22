/* =========================================================
   Get Home Realty — maps.js  (Leaflet + OpenStreetMap)
   Plots project pins (red) for a city + a filterable directory.
   ========================================================= */
(function(){
  'use strict';
  const ICON=window.GHR.ICON;

  // red dot marker (reference style)
  function greenDot(){
    return L.divIcon({
      className:'gh-marker',
      html:`<div class="gh-pin"></div>`,
      iconSize:[22,22],iconAnchor:[11,11],popupAnchor:[0,-13]
    });
  }

  function rateBand(d){
    if(!d.rateLow) return '';
    if(d.rateLow<5000) return 'lt5';
    if(d.rateLow<8000) return '5to8';
    return 'gt8';
  }
  /* ---------------------------------------------------------------
     Project features — location, built-up area, configuration,
     property type, project status and completion.
     Values come only from the record itself or its GHR_DETAILS entry;
     anything we don't actually have is shown as "On request".
     ---------------------------------------------------------------- */
  const NA='On request';
  function detFact(d,re){
    const x=detailFor(d); if(!x||!x.facts) return '';
    const hit=x.facts.find(f=>re.test(f[0]));
    return hit?String(hit[1]):'';
  }
  const DATED=/(?:Q[1-4]\s*)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|(?:Q[1-4][\s-]*)?\b(?:19|20)\d{2}\b/i;
  // `status` mixes state and handover date ("Possession Nov 2027",
  // "60% complete · Dec 2025"). Split the two — never invent a date.
  function progress(d){
    const raw=(d.status&&d.status!=='\u2014')?String(d.status).trim():'';
    let status='',done='';
    if(/ready to move/i.test(raw)){ status='Ready to move'; done='Completed'; }
    else if(/^complet/i.test(raw)){ status='Completed'; done=(raw.match(DATED)||[''])[0]; }
    else if(raw){
      const parts=raw.split('\u00b7').map(p=>p.trim()).filter(Boolean);
      const plain=parts.filter(p=>!DATED.test(p));
      const dated=parts.filter(p=>DATED.test(p));
      if(plain.length) status=plain.join(' \u00b7 ');
      if(dated.length) done=dated.map(p=>p.replace(/^(possession|handover|completion)\s*(by|in|on)?\s*/i,'')).join(' \u00b7 ');
      if(!status) status='Under construction';
    }
    if(!done) done=detFact(d,/possession|completion|handover/i);
    if(!status&&done) status='Under construction';
    return {status:status||NA, completion:done||NA};
  }
  // handover years a project can be filtered by; a phased handover yields several
  function handoverYears(d){
    const c=progress(d).completion;
    if(!c||c===NA) return [];
    return [...new Set(String(c).match(/(?:19|20)\d{2}/g)||[])];
  }
  function isReady(d){ return /ready to move|completed/i.test(progress(d).status); }
  function typeOf(d){ return d.kind || detFact(d,/^type$/i) || NA; }
  function configOf(d){
    if(d.config) return d.config;
    const f=detFact(d,/^config/i); if(f) return f;
    const x=detailFor(d);
    if(x&&x.unitRows){
      const c=[...new Set(x.unitRows.map(r=>r[0]).filter(v=>/bhk|villa/i.test(v)))];
      if(c.length) return c.join(' \u00b7 ');
    }
    return NA;
  }
  // sizes on the record; else the builder's own saleable / built-up figures
  function builtUp(d){
    if(d.sizes&&d.sizes!=='\u2014'&&d.sizes!==NA) return d.sizes;
    const f=detFact(d,/^(?:saleable|built-?up|villa sizes|sizes?)$/i); if(f) return f;
    const x=detailFor(d);
    if(x&&x.unitHead&&x.unitRows){
      const i=x.unitHead.findIndex(h=>/size|saleable|built/i.test(h));
      if(i>=0){
        const v=[...new Set(x.unitRows.map(r=>r[i]).filter(Boolean))];
        if(v.length) return v.slice(0,3).join(' \u00b7 ')+(v.length>3?' \u2026':'');
      }
    }
    return NA;
  }
  // [label, value, icon] — the six features, in a fixed order on every project.
  function featuresOf(d){
    const p=progress(d);
    return [
      ['Location', d.area+(d.city?', '+d.city:''), ICON.pin],
      ['Built-up area', builtUp(d), ICON.area],
      ['Configuration', configOf(d), ICON.bed],
      ['Property type', typeOf(d), ICON.home],
      ['Project status', p.status, ICON.shield],
      ['Completion', p.completion, ICON.clock]
    ];
  }

  // --- Representative imagery -------------------------------------------------
  // Real builder photos always win. When a project has no official image, we show
  // a relevant, attractive photo (apartment tower / villa / plot, coastal for Vizag)
  // layered OVER a branded gradient — so if the photo ever fails to load, the
  // gradient shows through and a broken-image icon is impossible.
  const STOCK_GRAD='linear-gradient(135deg,#0e2a3a,#1c4257 55%,#C8102E)';
  const STOCK={
    apartment:['1545324418-cc1a3fa10c00','1560518883-ce09059eeffa','1486406146926-c627a92ad1ab','1512917774080-9991f1c4c750','1600585154340-be6161a56a0c','1494526585095-c41746248156','1522708323590-d24dbb6b0267','1493809842364-78817add7ffb','1460317442991-0ec209397118','1567496898669-ee935f5f647a','1516156008625-3a9d6067fab5','1449844908441-8829872d2607'],
    villa:['1613490493576-7fde63acd811','1564013799919-ab600027ffc6','1600596542815-ffad4c1539a9','1600607687939-ce8a6c25118c','1568605114967-8130f3a36994','1600585154526-990dced4db0d','1580587771525-78b9dba3b914','1576941089067-2de3c901e126'],
    plot:['1500382017468-9049fed747ef','1416879595882-3373a0480b5b','1501594907352-04cda38ebc29','1470770841072-f978cf4d019e']
  };
  function uPhoto(id){return 'https://images.unsplash.com/photo-'+id+'?auto=format&fit=crop&w=900&q=72';}
  function strHash(s){let h=0;for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))>>>0;}return h;}
  function realImgs(d){return ((window.GHR.GHR_IMAGES||{})[d.id])||((window.GHR.GHR_DETAILS||{})[d.id]||{}).images||[];}

  // Infer the visual category (villa / plot / apartment) for representative imagery.
  function kindOf(d){
    if(d.kind && STOCK[d.kind.toLowerCase()]) return d.kind.toLowerCase();
    const t=((window.GHR.GHR_DETAILS||{})[d.id]||{}).tagline||'';
    const s=((d.name||'')+' '+(d.config||'')+' '+t).toLowerCase();
    if(/\b(plot|plotted|land|venture)\b/.test(s)) return 'plot';
    if(/\b(villa|villas|bungalow|triplex|independent)\b/.test(s)) return 'villa';
    return 'apartment';
  }
  // Collision-free stock assignment: every project WITHOUT a real photo gets a DISTINCT
  // image from its category pool, cycled in listing order — so no two adjacent cards match
  // and any repeat (only if a pool is exhausted) is spread as far apart as possible.
  let _stockAssign=null;
  function buildStockAssign(){
    const map={}, ctr={};   // counter per city+category, so each CITY page stays distinct
    (window.GHR.GHR_DEVELOPERS||[]).forEach(d=>{
      if(realImgs(d).length) return;
      const k=STOCK[kindOf(d)]?kindOf(d):'apartment';
      const key=(d.city||'')+'|'+k; ctr[key]=ctr[key]||0;
      map[d.id]=uPhoto(STOCK[k][ctr[key]++ % STOCK[k].length]);
    });
    return map;
  }
  function stockForDev(d){
    if(!_stockAssign) _stockAssign=buildStockAssign();
    return _stockAssign[d.id] || uPhoto(STOCK.apartment[strHash(d.id)%STOCK.apartment.length]);
  }
  // Per-project fallback gradient (varied hue) — shows only if a photo fails to load,
  // so even fallback cards remain visually distinct rather than all identical.
  function gradFor(d){
    const h=strHash(d.id)%360;
    return 'linear-gradient(135deg,hsl('+((h+195)%360)+',44%,15%),hsl('+((h+220)%360)+',40%,27%) 55%,#C8102E)';
  }
  // First real image if present, else a representative photo (never returns '').
  function imgForDev(d){ const r=realImgs(d); return (r&&r[0])?r[0]:stockForDev(d); }
  function isRealImg(d){ const r=realImgs(d); return !!(r&&r[0]); }
  // Full CSS background-image value: representative photos get the gradient fallback layer.
  function bgForDev(d){
    return isRealImg(d) ? "url('"+imgForDev(d)+"')" : "url('"+stockForDev(d)+"'),"+gradFor(d);
  }
  // Gallery: each project's own real images (0–3). Falls back to one representative slide.
  function gallerySlides(d){
    const real=realImgs(d);
    const seen=new Set(); const out=[];
    for(const u of real){ if(u && !seen.has(u)){ seen.add(u); out.push({u,stock:false}); if(out.length===3) break; } }
    if(!out.length) out.push({u:stockForDev(d),stock:true});
    return out;
  }
  function devPopupHtml(d){
    const p=progress(d), ty=typeOf(d), cfg=configOf(d);
    const line2=[ty!==NA?ty:'', (d.scale&&d.scale!=='\u2014')?d.scale:''].filter(Boolean).join(' \u00b7 ');
    const tags=[];
    if(p.status!==NA) tags.push(`<span class="pop-tag">${p.status}</span>`);
    if(p.completion!==NA) tags.push(`<span class="pop-tag pop-tag--soft">${p.completion}</span>`);
    return `<div class="gh-pop gh-pop--dev">
      <div class="pop-img" style="background-image:${bgForDev(d)}"></div>
      <div class="pop-b">
        <div class="pop-kicker">${d.developer}</div>
        <h4>${d.name}</h4>
        <div class="pop-meta">${ICON.pin}<b>${d.area}</b>${cfg!==NA?` · ${cfg}`:''} · ${builtUp(d)}</div>
        ${line2?`<div class="pop-scale">${line2}</div>`:''}
        ${tags.length?`<div class="pop-tagrow">${tags.join('')}</div>`:''}
        <div class="pop-actions">
          <a class="primary" href="#" onclick="window.GHR.openProjectModalById('${d.id}');return false;">View Details</a>
          <a href="tel:${GHR_TEL}">Call</a>
        </div>
      </div></div>`;
  }
  function featCells(items){
    return items.map(f=>`<div class="dv-feat">${f[2]||''}<div><span>${f[0]}</span><b>${f[1]}</b></div></div>`).join('');
  }
  function devCard(d){
    // a short info line only — the full detail lives in the modal
    const st=progress(d).status;
    const price=(d.rate&&d.rate!=='\u2014'&&d.rate!==NA)?d.rate:'';
    const bits=[configOf(d),builtUp(d)].filter(v=>v&&v!==NA);
    return `<div class="dv" data-id="${d.id}" data-area="${d.area}" data-band="${rateBand(d)}">
      <div class="dv-img">
        <div class="dv-img-bg" style="background-image:${bgForDev(d)}"></div>
        ${d.config?`<span class="dv-config">${d.config}</span>`:''}
        ${st!==NA?`<span class="dv-status">${st}</span>`:''}
      </div>
      <div class="dv-body">
        <div class="dv-dev">${d.developer}</div>
        <h4 class="dv-name">${d.name}</h4>
        <div class="dv-meta">${ICON.pin}<span>${d.area}</span></div>
        <div class="dv-info">${price?`<b>${price}</b>`:''}${bits.length?`<span>${bits.join(' \u00b7 ')}</span>`:''}</div>
        <span class="dv-more">View details ${ICON.arrow}</span>
      </div>
    </div>`;
  }

  /* ---------------- Amenities ----------------
     Amenity lists are grouped for reading. A project can carry its own
     groups — either {Group:[items]} or [[group,[items]]] — and a plain list
     is sorted into these buckets by what each item says.
     -------------------------------------------------- */
  const AMEN_GROUPS=[
    ['Swimming & water',/pool|jacuzzi|aqua|wade|water plaza|lotus|koi|fish pond|water feature|fountain|outdoor shower/i],
    ['Sports & fitness',/gym|tennis|badminton|squash|basketball|volleyball|cricket|skat|table tennis|jog|cycl|walking track|golf|yoga|meditat|aerobic|pickleball|reflexolog|boxing|futsal|sport|fitness|trampoline|climb|workout|shuttle|chess|hopscotch/i],
    ['Clubhouse & recreation',/club|banquet|multi.?purpose|theatre|theater|library|billiard|indoor games|lounge|party|karaoke|arcade|gaming|music|dance|hobb|board game|spa|sauna|steam|silent disco|sky bar|simulator|cards|preview|reading|movie screen|sculpture/i],
    ['Family & community',/kid|child|cr[e\u00e8]che|play area|sand ?pit|toddler|tuition|day care|nann|senior|elder|swing|pet park|creative|school/i],
    ['Outdoors & landscape',/garden|landscap|park|lawn|barbeque|bbq|gazebo|pergola|deck|terrace|sky ?walk|walkway|seating|courtyard|temple|zen|palm|tot.?lot|treehouse|camping|star.?gaz|observatory|maze|greener|hardscape|bird|aroma|floral|herbal|butterfly|bonsai|amphitheatre|open.?air|barbecue|corner/i],
    ['Convenience & services',/supermarket|grocer|store|restaurant|caf|food|atm|laundry|clinic|doctor|pharmac|first aid|guest room|concierge|valet|mailbox|locker|car wash|charging|parking|washroom|dormitor|cowork|business|meeting|conference|pantry|reception|aquarium|shop|boutique|salon|kitchen|dining/i],
    ['Safety & utilities',/secur|cctv|camera|surveillance|gated|boom barrier|intercom|fire|power back|generator|backup|water supply|stp|sewage|rain ?water|harvest|lift|elevator|panic|grab rail|wheelchair|stretcher|access|energy|drain|footpath|internal road|meter|wi-?fi|common wall|entry|exit|first.?aid/i]
  ];
  function amenityGroups(list){
    if(!list) return [];
    if(!Array.isArray(list)) return Object.keys(list).map(k=>[k,list[k]]);
    if(list.length&&Array.isArray(list[0])) return list;
    const flat=list.filter(Boolean);
    if(flat.length<6) return [['',flat]];
    const buckets={};
    flat.forEach(a=>{
      const hit=AMEN_GROUPS.find(p=>p[1].test(a));
      const g=hit?hit[0]:'More amenities';
      (buckets[g]=buckets[g]||[]).push(a);
    });
    return AMEN_GROUPS.map(p=>p[0]).concat(['More amenities']).filter(g=>buckets[g]).map(g=>[g,buckets[g]]);
  }
  function hasAmenities(list){
    if(!list) return false;
    return Array.isArray(list) ? list.length>0 : Object.keys(list).length>0;
  }

  /* ---------------- Specifications ----------------
     A spec entry is [label, description] (a plain string still works and
     renders without a label). The icon is picked from the label, so new
     projects only need the text added in data.js.
     -------------------------------------------------- */
  const SPEC_MATCH=[
    [/structure|civil|rcc|masonry/i,'structure'],
    [/electric|wiring|switch/i,'electrical'],
    [/paint/i,'paint'],
    [/plaster|wall/i,'plaster'],
    [/plumb|water|sanitary ware|geyser/i,'plumbing'],
    [/kitchen/i,'kitchen'],
    [/lift|elevator/i,'elevator'],
    [/window/i,'windows'],
    [/floor/i,'flooring'],
    [/connect|intercom|network|internet/i,'connectivity'],
    [/door/i,'doors'],
    [/bath|toilet|sanitary/i,'sanitary'],
    [/security|cctv|surveillance/i,'security'],
    [/power|generator|backup|solar/i,'power'],
    [/fire|safety/i,'fire'],
    [/park/i,'parking'],
    [/gas\b/i,'fire'],
    [/landscap|garden/i,'green'],
    [/tile|dado|cladding/i,'flooring'],
    [/wardrobe|storage|cupboard/i,'doors'],
    [/ceiling|slab|height/i,'structure'],
    [/vaastu|design|facing|orientation/i,'design'],
    [/green|igbc|leed|rating/i,'green'],
    [/lobby|lobbies|entrance/i,'doors']
  ];
  function specIcon(label){
    const S=window.GHR.SPEC_ICON||{};
    const hit=SPEC_MATCH.find(p=>p[0].test(label||''));
    return (hit&&S[hit[1]])||S.generic||'';
  }
  function specPairs(list){
    return (list||[]).map(s=>Array.isArray(s)?[s[0]||'',s[1]||'']:['',String(s)]);
  }
  function specRows(list){
    return specPairs(list).map(p=>`<div class="pm-spec">${p[0]?specIcon(p[0]):(window.GHR.SPEC_ICON||{}).generic||''}
      <div><b>${p[0]||''}</b><p>${p[1]}</p></div></div>`).join('');
  }

  /* ---------------- Project brochure ----------------
     Built from the project's own data (no stock photos, no invented
     figures) as a branded print sheet — the browser's print dialog turns
     it into a PDF via "Save as PDF". If a real builder PDF is ever added
     (a brochure field on the record or on its GHR_DETAILS entry), the
     modal links that file directly instead.
     -------------------------------------------------- */
  function brochureUrl(d){
    const x=detailFor(d)||{};
    return d.brochure||x.brochure||'';
  }
  function esc(v){
    return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function broRows(rows){
    return rows.map(r=>`<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('');
  }
  function brochureHtml(d){
    const x=detailFor(d)||{};
    const cfg=window.GHR_CONFIG||{};
    const feats=featuresOf(d).map(f=>[f[0],f[1]]).filter(f=>f[1]&&f[1]!==NA);
    if(d.rate&&d.rate!=='—'&&d.rate!==NA) feats.splice(2,0,['Price',d.rate]);
    if(d.scale&&d.scale!=='—') feats.push(['Project scale',d.scale]);
    // gallery rule: this project's own photos only — never stock, never borrowed
    const imgs=realImgs(d).filter((u,i,a)=>u&&a.indexOf(u)===i).slice(0,3);
    const hero=imgs.length
      ? `<div class="bro-shots">${imgs.map((u,i)=>`<img class="${i?'sm':'lg'}" src="${esc(u)}" alt="${esc(d.name)}">`).join('')}</div>`
      : `<div class="bro-noimg">${esc(d.name)}</div>`;
    const sec=(title,body)=>body?`<section class="bro-sec"><h2>${esc(title)}</h2>${body}</section>`:'';
    const units=(x.unitHead&&x.unitRows&&x.unitRows.length)
      ? `<table class="bro-units"><thead><tr>${x.unitHead.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${x.unitRows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : '';
    const broPlans=(x.plans||[]).filter(pp=>pp&&pp[1]);
    const planSheet=broPlans.length?`<section class="bro-sec"><h2>Floor plans</h2><div class="bro-plans">` +
      broPlans.map(pp=>`<figure><img src="${esc(pp[1])}" alt="${esc((pp[0]||d.name)+' floor plan')}">` +
      (pp[0]?`<figcaption>${esc(pp[0])}</figcaption>`:'')+'</figure>').join('')+`</div></section>`:'';
    const broTables=(x.tables||[]).map(t=>
      `<section class="bro-sec"><h2>${esc(t.title)}</h2><table class="bro-units">` +
      `<thead><tr>${t.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>` +
      `<tbody>${t.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`).join('');
    const club=(x.clubLevels&&x.clubLevels.length)
      ? `<dl class="bro-levels">${x.clubLevels.map(l=>`<dt>${esc(l[0])}</dt><dd>${esc(l[1])}</dd>`).join('')}</dl>`
      : (x.clubhouse?`<p>${esc(x.clubhouse)}</p>`:'');
    const amen=hasAmenities(x.amenities)
      ? amenityGroups(x.amenities).map(g=>
          `${g[0]?`<b>${esc(g[0])}</b>`:''}<ul class="bro-chips">${g[1].map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`).join('') : '';
    const loc=(x.location&&x.location.length)
      ? `<table class="bro-kv">${broRows(x.location)}</table>` : '';
    const spec=(x.specs&&x.specs.length)
      ? `<table class="bro-kv">${broRows(specPairs(x.specs).map(p=>[p[0]||'Specification',p[1]]))}</table>` : '';
    const note=x.note?`<p class="bro-note">${esc(x.note)}</p>`:'';
    const proscons=((x.pros&&x.pros.length)?`<b>Pros</b><ul class="bro-list">${x.pros.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'')+
      ((x.cons&&x.cons.length)?`<b>Good to know</b><ul class="bro-list">${x.cons.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'');
    const when=new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<base href="${esc(location.href)}">
<title>${esc(d.name)} — Get Home Realty brochure</title>
<style>
  @page{size:A4;margin:13mm}
  *{box-sizing:border-box}
  body{margin:0;font:13px/1.5 "Inter",Segoe UI,Arial,sans-serif;color:#122340;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{max-width:820px;margin:0 auto;padding:18px}
  .bro-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:3px solid #CE1126;padding-bottom:10px}
  .bro-bar img{height:46px;width:auto}
  .bro-bar span{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6B7A90;font-weight:700}
  h1{font:700 26px/1.2 "Poppins",Georgia,serif;margin:16px 0 2px}
  .bro-dev{color:#CE1126;font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;margin-top:16px}
  .bro-where{color:#48566B;margin:2px 0 14px}
  .bro-shots{display:grid;grid-template-columns:2fr 1fr;grid-auto-rows:92px;gap:8px;margin-bottom:16px}
  .bro-shots img{width:100%;height:100%;object-fit:cover;border-radius:8px}
  .bro-shots .lg{grid-row:span 2;height:192px}
  .bro-shots img.lg:only-child{grid-column:span 2}
  .bro-shots:has(img:nth-child(2):last-child) img.sm{grid-row:span 2}
  .bro-noimg{height:150px;border-radius:8px;margin-bottom:16px;display:flex;align-items:center;justify-content:center;color:#fff;font:700 20px "Poppins",Georgia,serif;text-align:center;padding:0 20px;background:linear-gradient(135deg,#122340,#1c4257 55%,#CE1126)}
  .bro-sec{margin-bottom:16px;break-inside:avoid;page-break-inside:avoid}
  h2{font:700 14px/1.2 "Poppins",Georgia,serif;text-transform:uppercase;letter-spacing:.07em;margin:0 0 8px;padding-bottom:5px;border-bottom:1px solid #E3E7EE}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  .bro-kv th{width:38%}
  .bro-kv th,.bro-kv td,.bro-units th,.bro-units td{border:1px solid #E3E7EE;padding:6px 9px;text-align:left;vertical-align:top}
  .bro-kv th{background:#F5F7FA;font-weight:700;color:#48566B}
  .bro-units thead th{background:#122340;color:#fff;font-weight:700}
  .bro-plans{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .bro-plans figure{margin:0;border:1px solid #E3E7EE;border-radius:6px;padding:6px;background:#fff;break-inside:avoid}
  .bro-plans img{width:100%;height:auto;display:block}
  .bro-plans figcaption{font-size:11px;color:#48566B;margin-top:4px;text-align:center}
  .bro-chips{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:5px}
  .bro-chips li{background:#F5F7FA;border:1px solid #E3E7EE;border-radius:20px;padding:3px 10px;font-size:12px}
  .bro-list{margin:0;padding-left:18px}
  .bro-levels{margin:0}
  .bro-levels dt{font-weight:700;margin-top:7px}
  .bro-levels dd{margin:0;color:#48566B}
  .bro-note{color:#48566B;font-size:12px;margin:0}
  .bro-foot{margin-top:20px;border-top:3px solid #CE1126;padding-top:10px;font-size:12px}
  .bro-foot b{display:block;font:700 15px "Poppins",Georgia,serif;margin-bottom:3px}
  .bro-fine{color:#6B7A90;font-size:10.5px;margin-top:8px}
  .no-print{margin:0 auto 14px;max-width:820px;padding:0 18px;display:flex;gap:10px;align-items:center}
  .no-print button{font:600 13px "Inter",Arial,sans-serif;background:#CE1126;color:#fff;border:0;border-radius:8px;padding:9px 16px;cursor:pointer}
  .no-print em{color:#6B7A90;font-style:normal;font-size:12px}
  @media print{.no-print{display:none}.sheet{padding:0}}
</style></head><body>
<div class="no-print"><button type="button" onclick="window.print()">Print / Save as PDF</button>
  <em>Pick &ldquo;Save as PDF&rdquo; as the destination to download this brochure.</em></div>
<div class="sheet">
  <div class="bro-bar"><img src="assets/img/ghr-logo-header.png" alt="Get Home Realty"><span>Project Brochure</span></div>
  <div class="bro-dev">${esc(x.developer||d.developer||'')}</div>
  <h1>${esc(d.name)}</h1>
  <div class="bro-where">${esc(d.area)}${d.city?', '+esc(d.city):''}</div>
  ${hero}
  ${x.tagline?`<p>${esc(x.tagline)}</p>`:''}
  ${sec('Project features',`<table class="bro-kv">${broRows(feats)}</table>`)}
  ${sec('Project details',(x.facts&&x.facts.length)?`<table class="bro-kv">${broRows(x.facts)}</table>`:'')}
  ${sec('Configurations',units)}
  ${planSheet}
  ${broTables}
  ${sec('Clubhouse',club)}
  ${sec('Amenities',amen)}
  ${sec('Location highlights',loc)}
  ${sec('Specifications',spec)}
  ${sec('Pros & cons',proscons)}
  ${note}
  <div class="bro-foot">
    <b>Get Home Realty</b>
    Projects desk: ${esc(GHR_TEL)} &middot; WhatsApp: +${esc(GHR_WA)}${cfg.email?' &middot; '+esc(cfg.email):''}<br>
    ${cfg.addr?esc(cfg.addr)+'<br>':''}
    <div class="bro-fine">Prepared ${esc(when)}. Compiled from publicly available builder material and locality-level
      information; figures, approvals and timelines are indicative and must be verified against the builder's
      RERA-registered documents before any booking. Get Home Realty is a channel partner, not the developer.</div>
  </div>
</div></body></html>`;
  }
  function openBrochure(d){
    const html=brochureHtml(d);
    const w=window.open('','_blank');
    if(w){
      w.document.open(); w.document.write(html); w.document.close();
      w.onload=function(){ setTimeout(function(){ w.focus(); w.print(); },250); };
      return;
    }
    // popup blocked — print from a hidden iframe instead
    const fr=document.createElement('iframe');
    fr.setAttribute('aria-hidden','true');
    fr.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(fr);
    const doc=fr.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    fr.contentWindow.onload=function(){
      setTimeout(function(){ fr.contentWindow.focus(); fr.contentWindow.print(); document.body.removeChild(fr); },400);
    };
  }

  /* ---------------- Project details modal ---------------- */
  let _modal=null,_panel=null,_map=null,_markers={},_cluster=null;
  // Our projects desk, never the builder's line. Follows Contact Details in the
  // admin (via main.js GHR_CONFIG); the literals are the built-in fallback.
  const _cfg=window.GHR_CONFIG||{};
  const GHR_TEL_DISP=_cfg.phone||'+91 99632 06933';
  const GHR_TEL='+'+(GHR_TEL_DISP.replace(/\D/g,'')||'919963206933');
  const GHR_WA=((_cfg.whatsapp||'').match(/wa\.me\/(\d+)/)||[])[1]||'919963206933';

  function detailFor(d){ return (window.GHR.GHR_DETAILS||{})[d.id]||null; }

  /* ---------------- Project presentation (multi-slide modal) ----------------
     Seven content slides: Overview · Details · Floor plans · Amenities ·
     Master plan · Location · Availability. Slides with nothing to show are
     skipped. Content comes from the admin (fetched per project from
     /api/public/projects/<id> when opened) and falls back to GHR_DETAILS in
     data.js, so the site still works as plain static files.
     Later slides' images load only when that slide is reached.
     -------------------------------------------------------------------------- */
  const _slideCache={};
  let _deck=null;           // {d, slides, i, api}
  const SITE_PLAN=/site plan|master ?plan|layout plan/i;

  const AM_ICON={
    pool:'<path d="M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5S16 18 18 18s2-1.5 4-1.5M2 21.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M7 15V5a2 2 0 0 1 4 0M13 15V5a2 2 0 0 1 4 0M7 8h6M7 12h6"/>',
    gym:'<path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12"/>',
    clubhouse:'<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M9 11h.01M15 11h.01"/>',
    games:'<rect x="2" y="7" width="20" height="12" rx="4"/><path d="M7 11v4M5 13h4M15 12h.01M17.5 14h.01"/>',
    sports:'<circle cx="12" cy="12" r="9"/><path d="M12 3a14 14 0 0 1 0 18M3 12h18M5.5 5.5c3 2 10 2 13 0M5.5 18.5c3-2 10-2 13 0"/>',
    kids:'<path d="M4 21V9l4-3 4 3v12M12 13h8v8M16 13V9M14 21v-4h4v4M6 13h2"/>',
    garden:'<path d="M12 21v-8M12 13c-4 0-7-3-7-7 4 0 7 3 7 7zM12 13c4 0 7-3 7-7-4 0-7 3-7 7zM6 21h12"/>',
    track:'<circle cx="14" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2 1 4M10 9l3-1 2 3 3 1M7 13l3-4"/>',
    hall:'<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M8 21h8M12 17v4M7 9h10M7 12h6"/>',
    yoga:'<circle cx="12" cy="4.5" r="1.8"/><path d="M12 7v6M7 10l5 3 5-3M6 20l6-4 6 4"/>',
    spa:'<path d="M12 21c-4-2-7-5-7-9 2 0 5 1 7 4 2-3 5-4 7-4 0 4-3 7-7 9zM12 16c-1-3-1-6 0-9 1 3 1 6 0 9z"/>',
    security:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
    parking:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
    power:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    shop:'<path d="M4 7h16l-1.5 13h-13zM9 7V5a3 3 0 0 1 6 0v2"/>',
    water:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  };
  // First match wins — more specific ideas (spa, yoga, billiards, water features) before broad ones.
  const AM_MATCH=[[/spa|sauna|steam|massage|salon/i,'spa'],[/yoga|meditat|zen/i,'yoga'],
    [/billiard|snooker|indoor game|table tennis|chess|cards?|arcade|gaming|carrom|foosball/i,'games'],
    [/pool|swim|jacuzzi|aqua|splash/i,'pool'],[/gym|fitness|workout|cross.?fit/i,'gym'],
    [/court|tennis|badminton|basket|squash|cricket|football|volley|golf|skat|sport|futsal|pickle/i,'sports'],
    [/kid|child|play|cr[eè]che|toddler|tot.?lot/i,'kids'],[/jog|walk|track|cycl/i,'track'],
    [/water|rain|stp|fountain/i,'water'],
    [/hall|multi.?purpose|theatre|theater|library|business|cowork|conference|meeting|av room|preview/i,'hall'],
    [/club ?house|lounge|banquet|party|caf|restaurant/i,'clubhouse'],
    [/garden|landscap|park|lawn|green|tree|plaza|court ?yard|deck/i,'garden'],
    [/secur|cctv|gate|surveil/i,'security'],[/parking|car|ev /i,'parking'],[/power|generator|backup|solar|charging/i,'power'],
    [/shop|store|super ?market|grocer|atm|retail/i,'shop']];
  function amIcon(a){
    const k=(a.icon&&AM_ICON[a.icon])?a.icon:((AM_MATCH.find(m=>m[0].test(a.title||''))||[])[1]||'clubhouse');
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${AM_ICON[k]}</svg>`;
  }
  // Site-root path for stored media ("assets/…" works from any page depth).
  function mediaUrl(u){ return !u?'':(/^(https?:)?\/\//.test(u)||u.charAt(0)==='/'?u:'/'+u); }
  // Images on later slides carry data-src and are loaded when their slide is shown.
  function lazyImg(u,alt,cls){ return `<img${cls?` class="${cls}"`:''} data-src="${esc(mediaUrl(u))}" alt="${esc(alt)}" decoding="async">`; }
  const factRows=rows=>`<div class="pm-facts">${rows.map(f=>`<div class="pm-fact"><span>${esc(f[0])}</span><b>${esc(f[1])}</b></div>`).join('')}</div>`;

  /** Everything the slides show, merged: admin content (api) first, data.js second. */
  function slideData(d,api){
    const x=detailFor(d)||{}; api=api||{};
    const p=progress(d);
    const real=(api.images&&api.images.length)?api.images.map(im=>im.url):realImgs(d);
    const images=[...new Set(real.filter(Boolean))].slice(0,8);
    const plansStatic=(x.plans||[]).filter(pp=>pp&&pp[1]);
    const sitePlan=plansStatic.find(pp=>SITE_PLAN.test(pp[0]||''));
    const flatAm=a=>!a?[]:Array.isArray(a)?a.flatMap(v=>Array.isArray(v)?flatAm(v[1]):typeof v==='string'?[v]:[]):Object.values(a).flatMap(flatAm);
    const feats=featuresOf(d).map(f=>[f[0],f[1]]);
    if(d.rate&&d.rate!=='—'&&d.rate!==NA) feats.splice(2,0,['Price',d.rate]);
    const scale=api.scale||((d.scale&&d.scale!=='—')?d.scale:'');
    if(scale) feats.push(['Project scale',scale]);
    return {
      d,x,images,
      developer:api.developer||x.developer||d.developer||'',
      description:api.description||x.tagline||'',
      status:p.status, completion:p.completion,
      config:configOf(d), sizes:builtUp(d), price:(d.rate&&d.rate!=='—'&&d.rate!==NA)?d.rate:(api.price||''),
      features:feats.filter(f=>f[1]&&f[1]!==NA),
      details:(api.details&&api.details.length)?api.details.map(r=>[r.label,r.value]):(x.facts||[]).filter(f=>!/^(locality|location)$/i.test(f[0])),
      floorPlans:(api.floorPlans&&api.floorPlans.length)?api.floorPlans
        :plansStatic.filter(pp=>!SITE_PLAN.test(pp[0]||'')).map(pp=>({image:pp[1],description:pp[0]||''})),
      amenities:(api.amenities&&api.amenities.length)?api.amenities:flatAm(x.amenities).map(t=>({title:t})),
      masterPlan:api.masterPlan||(sitePlan?{image:sitePlan[1],notes:[]}:null),
      connectivity:(api.connectivity&&api.connectivity.length)?api.connectivity:(x.location||[]).map(l=>({place:l[0],time:l[1]})),
      availability:api.availability||{status:'On request',note:''},
      brochure:api.brochure||brochureUrl(d),
    };
  }

  function waHref(S,cfg){
    const page=location.origin+location.pathname+'?project='+encodeURIComponent(S.d.id);
    const msg=['Hi Get Home Realty, I would like to check availability.',
      'Project: '+S.d.name,'Location: '+[S.d.area,S.d.city].filter(Boolean).join(', '),
      'Requested configuration: '+(cfg||'Any'),'Page: '+page].join('\n');
    return 'https://wa.me/'+GHR_WA+'?text='+encodeURIComponent(msg);
  }

  // ---- slides ----
  function slideOverview(S){
    const d=S.d, stock=!S.images.length, hero=stock?stockForDev(d):S.images[0];
    const tags=[];
    if(S.status!==NA) tags.push(`<span class="pm-tag">${esc(S.status)}</span>`);
    if(S.completion!==NA) tags.push(`<span class="pm-tag">${/^(completed|ready)/i.test(S.completion)?'':'Possession '}${esc(S.completion)}</span>`);
    if(S.config!==NA) tags.push(`<span class="pm-tag pm-tag--soft">${esc(S.config)}</span>`);
    const key=[['Location',[d.area,d.city].filter(Boolean).join(', ')],['Configuration',S.config],['Possession',S.completion],['Starting price',S.price||NA]].filter(f=>f[1]&&f[1]!==NA);
    const thumbs=S.images.length>1?`<div class="pm-thumbs" aria-label="Photos">${S.images.map((u,i)=>
      `<button type="button" class="pm-thumb${i?'':' is-on'}" data-thumb="${esc(mediaUrl(u))}" aria-label="Show photo ${i+1}"><img src="${esc(mediaUrl(u))}" alt="" loading="lazy"></button>`).join('')}</div>`:'';
    return `<div class="pm-gallery pm-gallery--deck">
        <img class="pm-heroimg${stock?' pm-heroimg--stock':''}" data-hero src="${esc(mediaUrl(hero))}" alt="${esc(d.name)}" fetchpriority="high" style="background:${stock?gradFor(d):'#0b0a09'}">
        <div class="pm-shade"></div>
        <div class="pm-hero-in">
          ${S.developer?`<div class="pm-kicker">${esc(S.developer)}</div>`:''}
          <h3 class="pm-title">${esc(d.name)}</h3>
          ${tags.length?`<div class="pm-tags">${tags.join('')}</div>`:''}
        </div>
      </div>
      <div class="pm-body">
        <p class="pm-where">${ICON.pin||''}<span>${esc([d.area,d.city].filter(Boolean).join(', '))}</span></p>
        ${S.description?`<p class="pm-lead">${esc(S.description)}</p>`:''}
        ${key.length?factRows(key):''}
        ${thumbs}
        <div class="pm-cta" style="margin-top:1.2rem">
          <button type="button" class="btn btn--sm" data-go-label="Availability">Check availability</button>
          <a class="btn btn--ghost btn--sm" href="tel:${GHR_TEL}">${ICON.phone||''}Call · ${esc(GHR_TEL_DISP)}</a>
          ${S.brochure?`<a class="btn btn--ghost btn--sm" href="${esc(mediaUrl(S.brochure))}" target="_blank" rel="noopener" download>${ICON.doc||''}Brochure</a>`
            :`<button type="button" class="btn btn--ghost btn--sm" data-pm-brochure>${ICON.doc||''}Brochure</button>`}
          ${_map?`<button type="button" class="btn btn--ghost btn--sm" data-pm-locate>${ICON.pin||''}Locate on map</button>`:''}
          ${window.GHR_CMS?`<a class="btn btn--ghost btn--sm" href="/projects/${encodeURIComponent(d.id)}">Full project page</a>`:''}
        </div>
      </div>`;
  }
  /** What the project's own data says about one configuration (nothing is estimated). */
  function bhkFacts(S,k){
    const x=S.x, plans=S.floorPlans.filter(f=>bhkKey(f.bhk||f.description)===k);
    const head=x.unitHead||[], rows=(x.unitRows||[]).filter(r=>bhkKey(r[0])===k);
    const col=re=>head.findIndex(h=>re.test(h));
    const iSize=col(/saleable|built|size/i), iCarpet=col(/carpet/i), iTower=col(/tower/i), iFacing=col(/facing/i), iPrice=col(/price|base|cost|amount|₹/i);
    const uniq=a=>[...new Set(a.map(v=>String(v||'').trim()).filter(Boolean))];
    const num=v=>{ const m=String(v).replace(/,/g,'').match(/\d+(\.\d+)?/); return m?parseFloat(m[0]):NaN; };
    // "1,380 sq.ft" values → "1,380 – 2,355 sq.ft"; anything unparseable is listed as written
    const area=vals=>{ const u=uniq(vals).map(v=>/sq/i.test(v)?v:v+' sq.ft'); if(!u.length) return '';
      const n=u.map(num); if(n.some(isNaN)) return u.join(' · ');
      const lo=Math.min(...n), hi=Math.max(...n), f=v=>v.toLocaleString('en-IN');
      return lo===hi?`${f(lo)} sq.ft`:`${f(lo)} – ${f(hi)} sq.ft`; };
    const money=vals=>{ const u=uniq(vals); if(u.length<2) return u[0]||'';
      const val=v=>{ const n=num(v); return /cr/i.test(v)?n*1e7:/l(akh|ac)?/i.test(v)?n*1e5:n; };
      const sorted=u.slice().sort((a,b)=>val(a)-val(b)); return `${sorted[0]} – ${sorted[sorted.length-1]}`; };
    return {
      'Sizes':area([...plans.map(f=>f.size),...(iSize>=0?rows.map(r=>r[iSize]):[])]),
      'Carpet area':area([...plans.map(f=>f.carpet),...(iCarpet>=0?rows.map(r=>r[iCarpet]):[])]),
      'Towers':uniq([...plans.map(f=>f.tower),...(iTower>=0?rows.map(r=>r[iTower]):[])]).join(' · '),
      'Facing':uniq([...plans.map(f=>f.facing),...(iFacing>=0?rows.map(r=>r[iFacing]):[])]).join(' · '),
      'Price':iPrice>=0?money(rows.map(r=>r[iPrice])):'',
      'Floor plans':plans.length?String(plans.length):'',
    };
  }
  function slideDetails(S){
    const x=S.x;
    const specs=(x.specs&&x.specs.length)?`<div class="pm-sec"><h4>Specifications</h4><div class="pm-specs">${specPairs(x.specs).map(p=>
      `<div class="pm-spec">${p[0]?specIcon(p[0]):(window.GHR.SPEC_ICON||{}).generic||''}<div><b>${esc(p[0])}</b><p>${esc(p[1])}</p></div></div>`).join('')}</div></div>`:'';
    const pcCol=(cls,title,items)=>`<div class="pm-pc-col pm-pc--${cls}"><h5>${title}</h5><ul>${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`;
    const pc=((x.pros&&x.pros.length)||(x.cons&&x.cons.length))?`<div class="pm-sec"><h4>Pros &amp; cons</h4><div class="pm-pc">`+
      ((x.pros&&x.pros.length)?pcCol('pro','Pros',x.pros):'')+((x.cons&&x.cons.length)?pcCol('con','Good to know',x.cons):'')+'</div></div>':'';
    // configuration dropdown: per-BHK figures come only from the floor plans and the builder's unit table
    const keys=projectKeys(S).filter(k=>k!==OTHER_PLANS);
    const facts={}; keys.forEach(k=>{ facts[k]=bhkFacts(S,k); });
    const by=label=>{ const m={}; keys.forEach(k=>{ const v=facts[k][label]; if(v) m[k]=v; }); return m; };
    const swap={'Built-up area':by('Sizes'),'Price':by('Price'),'Configuration':Object.fromEntries(keys.map(k=>[k,k]))};
    const featRows=`<div class="pm-facts">${S.features.map(f=>{
      const m=swap[f[0]]; const attr=m&&Object.keys(m).length?` data-feat-all="${esc(f[1])}" data-feat-by="${esc(JSON.stringify(m))}"`:'';
      return `<div class="pm-fact"><span>${esc(f[0])}</span><b${attr}>${esc(f[1])}</b></div>`; }).join('')}</div>`;
    const glance=keys.map(k=>{
      const rows=['Sizes','Carpet area','Towers','Facing','Price','Floor plans'].map(l=>[l,facts[k][l]]).filter(r=>r[1]);
      return rows.length?`<div class="pm-glance" data-bhk-feat="${esc(k)}" hidden><h4>${esc(k)} at a glance</h4>${factRows(rows)}</div>`:'';
    }).join('');
    const filter=keys.length>1?`<select class="select pm-bhksel" data-bhk-select aria-label="Show features for a configuration">
      <option value="">All configurations</option>${keys.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select>`:'';
    return `<div class="pm-body">
      <div class="pm-slhead"><h3 class="pm-sltitle">Features &amp; details</h3>${filter}</div>
      ${glance}
      <div class="pm-cols">
        <div class="pm-sec"><h4>Project features</h4>${featRows}</div>
        ${S.details.length?`<div class="pm-sec"><h4>Project details</h4>${factRows(S.details)}</div>`:''}
      </div>
      ${specs}${pc}
      ${x.note?`<p class="pm-note">${esc(x.note)}</p>`:''}
    </div>`;
  }
  function bhkKey(s){
    const t=String(s||''), m=t.match(/(\d(?:\.\d)?)\s*bhk/i);
    if(m) return m[1]+' BHK';
    if(/studio/i.test(t)) return 'Studio';
    if(/villa/i.test(t)) return 'Villa';
    if(/plot/i.test(t)) return 'Plot';
    return '';
  }
  const OTHER_PLANS='Other plans';
  const sortKeys=keys=>keys.sort((a,b)=>(parseFloat(a)||99)-(parseFloat(b)||99)||a.localeCompare(b));
  function slidePlans(S){
    const x=S.x, d=S.d;
    const keyOf=f=>bhkKey(f.bhk||f.description)||OTHER_PLANS;
    const counts={}; S.floorPlans.forEach(f=>{ const k=keyOf(f); counts[k]=(counts[k]||0)+1; });
    const rowKey=r=>bhkKey(r[0])||OTHER_PLANS;
    if(x.unitRows) x.unitRows.forEach(r=>{ const k=rowKey(r); if(!(k in counts)) counts[k]=0; });
    const keys=sortKeys(Object.keys(counts).filter(k=>k!==OTHER_PLANS));
    if(OTHER_PLANS in counts&&counts[OTHER_PLANS]) keys.push(OTHER_PLANS);
    // configuration dropdown beside the title — only worth showing for 2+ configurations
    const filter=keys.length>1?`<select class="select pm-bhksel" data-bhk-select aria-label="Filter floor plans by configuration">
      <option value="">All configurations (${S.floorPlans.length})</option>
      ${keys.map(k=>`<option value="${esc(k)}">${esc(k)}${counts[k]?` (${counts[k]})`:''}</option>`).join('')}
    </select>`:'';
    const cards=S.floorPlans.map(f=>{
      const head=[f.bhk,f.size].filter(Boolean).join(' · ')||f.description||'Floor plan';
      const chips=[f.carpet&&['Carpet',f.carpet],f.tower&&['Tower',f.tower],f.facing&&['Facing',f.facing]].filter(Boolean);
      const alt=[d.name,f.bhk,f.size,f.facing&&f.facing+' facing','floor plan'].filter(Boolean).join(' — ');
      return `<figure class="pm-fp" data-bhk="${esc(keyOf(f))}">
        ${f.image?`<button type="button" class="pm-fp-img" data-zoom="${esc(mediaUrl(f.image))}" data-zoom-alt="${esc(alt)}" aria-label="Zoom ${esc(head)}">${lazyImg(f.image,alt)}<span class="pm-zoomhint">Tap to zoom</span></button>`:''}
        <figcaption><b>${esc(head)}</b>
          ${chips.length?`<span class="pm-fp-meta">${chips.map(c=>`<span><small>${c[0]}</small>${esc(c[1])}</span>`).join('')}</span>`:''}
          ${f.description&&(f.bhk||f.size)?`<p>${esc(f.description)}</p>`:''}</figcaption></figure>`;
    }).join('');
    const table=(x.unitHead&&x.unitRows&&x.unitRows.length)?`<div class="pm-sec"><h4>All configurations</h4><div class="pm-tablewrap"><table class="pm-table"><thead><tr>${x.unitHead.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${x.unitRows.map(r=>`<tr data-bhk="${esc(rowKey(r))}">${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`:'';
    const pdf=x.plansPdf||S.brochure;
    return `<div class="pm-body">
      <div class="pm-slhead"><h3 class="pm-sltitle">Floor plans</h3>${filter}</div>
      ${cards?`<div class="pm-fps">${cards}</div>`:''}
      <p class="pm-text" data-bhk-empty hidden>No floor-plan drawings for this configuration — see the table below, or ask us on WhatsApp.</p>
      ${table}
      ${pdf?`<a class="pm-planlink" href="${esc(mediaUrl(pdf))}" target="_blank" rel="noopener">${ICON.doc||''}${x.plansPdf?'All floor plans (PDF)':'Full floor plans are in the project brochure (PDF)'}</a>`:''}
    </div>`;
  }
  /** Configurations an amenity is limited to ("4 BHK only"); [] = shared by every home. */
  function amConfigs(a){ return String(a.configs||'').split(/[,;&\/]|\band\b/).map(t=>bhkKey(t.trim())).filter(Boolean); }
  /** The project's configurations, from its floor plans, its configuration text and amenity tags. */
  function projectKeys(S){
    const parts=String(S.config!==NA?S.config:'').split(/,|&|·|\band\b/).map(t=>t.trim()).map(t=>/^\d(\.\d)?$/.test(t)?t+' BHK':t);
    return sortKeys([...new Set([...S.floorPlans.map(f=>bhkKey(f.bhk||f.description)),...parts.map(bhkKey),...S.amenities.flatMap(amConfigs)].filter(Boolean))]);
  }
  function slideAmenities(S){
    const x=S.x;
    const only=a=>{ const c=amConfigs(a); return c.length?`<em class="pm-am-only">${esc(c.join(', '))} only</em>`:''; };
    const forAttr=a=>`data-am-for="${esc(amConfigs(a).join('|'))}"`;
    const withImg=S.amenities.filter(a=>a.image), plain=S.amenities.filter(a=>!a.image);
    const imgCards=withImg.length?`<div class="pm-amimgs">${withImg.map(a=>`<figure class="pm-amimg" ${forAttr(a)}>${lazyImg(a.image,a.title)}<figcaption><b>${esc(a.title)}</b>${only(a)}${a.description?`<span>${esc(a.description)}</span>`:''}</figcaption></figure>`).join('')}</div>`:'';
    const groups=amenityGroups(plain.map(a=>a.title));
    const byTitle={}; plain.forEach(a=>{byTitle[a.title]=a;});
    const iconCards=groups.map(g=>`<div class="pm-amgroup">${g[0]?`<h5>${esc(g[0])}</h5>`:''}<div class="pm-ams">${g[1].map(t=>{
      const a=byTitle[t]||{title:t};
      return `<div class="pm-am" ${forAttr(a)}>${amIcon(a)}<div><b>${esc(a.title)}</b>${only(a)}${a.description?`<span>${esc(a.description)}</span>`:''}</div></div>`;}).join('')}</div></div>`).join('');
    let club='';
    if(x.clubLevels&&x.clubLevels.length) club=`<div class="pm-sec"><h4>Clubhouse</h4><div class="pm-levels">${x.clubLevels.map(l=>`<div class="pm-level"><span>${esc(l[0])}</span><p>${esc(l[1])}</p></div>`).join('')}</div></div>`;
    else if(x.clubhouse) club=`<div class="pm-sec"><h4>Clubhouse</h4><p class="pm-text">${esc(x.clubhouse)}</p></div>`;
    const keys=projectKeys(S);
    const filter=keys.length>1||S.amenities.some(a=>amConfigs(a).length)?`<select class="select pm-bhksel" data-bhk-select aria-label="Show amenities for a configuration">
      <option value="">All configurations</option>${keys.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select>`:'';
    return `<div class="pm-body">
      <div class="pm-slhead"><h3 class="pm-sltitle">Amenities${S.amenities.length?` <small>${S.amenities.length}</small>`:''}</h3>${filter}</div>
      <p class="pm-amsum" data-am-summary hidden></p>
      ${imgCards}${iconCards}${club}</div>`;
  }

  /* One configuration choice for the whole deck: Floor Plans, Amenities and the
     Availability request all follow it, whichever slide it was picked on. */
  function applyBhk(k){
    if(!_deck) return;
    _deck.bhk=k||'';
    const panel=_panel, has=(sel,v)=>[...sel.options].some(o=>o.value===v);
    panel.querySelectorAll('[data-bhk-select]').forEach(sel=>{ sel.value=has(sel,k)?k:''; });
    // floor plans + configurations table
    panel.querySelectorAll('.pm-sl').forEach(sl=>{
      let shown=0, any=false;
      sl.querySelectorAll('.pm-fp[data-bhk]').forEach(el=>{ any=true; const vis=!k||el.getAttribute('data-bhk')===k; el.hidden=!vis; if(vis) shown++; });
      sl.querySelectorAll('tr[data-bhk]').forEach(el=>{ el.hidden=!!k&&el.getAttribute('data-bhk')!==k; });
      const empty=sl.querySelector('[data-bhk-empty]'); if(empty) empty.hidden=!any||shown>0;
    });
    // amenities: shared ones always, plus those limited to this configuration
    const ak=k===OTHER_PLANS?'':k;
    let total=0, excl=0;
    panel.querySelectorAll('[data-am-for]').forEach(el=>{
      const f=el.getAttribute('data-am-for'), vis=!ak||!f||f.split('|').indexOf(ak)>-1;
      el.hidden=!vis; if(vis){ total++; if(f) excl++; }
    });
    panel.querySelectorAll('.pm-amgroup,.pm-amimgs').forEach(g=>{ g.hidden=![...g.querySelectorAll('[data-am-for]')].some(x=>!x.hidden); });
    const sum=panel.querySelector('[data-am-summary]');
    if(sum){
      sum.hidden=!ak;
      if(ak) sum.textContent=excl
        ? `${total} amenities for ${ak} homes: ${total-excl} shared by every home, ${excl} only for ${ak}.`
        : `All ${total} amenities are shared by every home in this project, including ${ak}.`;
    }
    // features & details: "at a glance" box + per-configuration feature values
    const fk=k===OTHER_PLANS?'':k;
    panel.querySelectorAll('[data-bhk-feat]').forEach(el=>{ el.hidden=!fk||el.getAttribute('data-bhk-feat')!==fk; });
    panel.querySelectorAll('[data-feat-by]').forEach(el=>{
      let m={}; try{ m=JSON.parse(el.getAttribute('data-feat-by')); }catch(e){}
      el.textContent=(fk&&m[fk])||el.getAttribute('data-feat-all');
    });
    // availability request
    const cfg=panel.querySelector('[data-cfg]'), wa=panel.querySelector('[data-wa]');
    if(cfg&&wa){ cfg.value=has(cfg,k)?k:''; wa.href=waHref(slideData(_deck.d,_deck.api),cfg.value); }
  }

  function slideMaster(S){
    const m=S.masterPlan, alt=S.d.name+' master plan';
    return `<div class="pm-body"><h3 class="pm-sltitle">Master plan</h3>
      <button type="button" class="pm-master" data-zoom="${esc(mediaUrl(m.image))}" data-zoom-alt="${esc(alt)}" aria-label="Zoom the master plan">${lazyImg(m.image,alt)}<span class="pm-zoomhint">Tap to zoom</span></button>
      ${(m.notes||[]).length?`<ul class="pm-list" style="margin-top:1rem">${m.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`:''}
    </div>`;
  }
  function slideLocation(S){
    const d=S.d, has=typeof d.lat==='number'&&typeof d.lng==='number';
    const groups={}; S.connectivity.forEach(c=>{ const k=c.category||''; (groups[k]=groups[k]||[]).push(c); });
    const conn=Object.keys(groups).map(k=>`<div class="pm-sec">${k?`<h5 class="pm-subhead">${esc(k)}</h5>`:''}<div class="pm-loc">${groups[k].map(c=>
      `<div class="pm-locrow"><span>${esc(c.place)}</span>${c.time?`<b>${esc(c.time)}</b>`:''}</div>`).join('')}</div></div>`).join('');
    return `<div class="pm-body"><h3 class="pm-sltitle">Location &amp; connectivity</h3>
      <p class="pm-where">${ICON.pin||''}<span>${esc([d.area,d.city].filter(Boolean).join(', '))}</span></p>
      ${has&&typeof L!=='undefined'?`<div class="pm-minimap" data-minimap></div>`:''}
      ${conn?`<div class="pm-sec"><h4>Nearby &amp; travel times</h4>${conn}</div>`:''}
      ${has?`<a class="pm-planlink" href="https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}" target="_blank" rel="noopener">${ICON.pin||''}Open in Google Maps</a>`:''}
      <p class="pm-note" style="margin-top:1rem">Location shown at locality level.</p>
    </div>`;
  }
  function slideAvailability(S){
    const d=S.d;
    const cfgParts=String(S.config!==NA?S.config:'').split(/,|&|·|\band\b/).map(s=>s.trim()).map(s=>/^\d(\.\d)?$/.test(s)?s+' BHK':s);
    const opts=sortKeys([...new Set([...(S.floorPlans||[]).map(f=>bhkKey(f.bhk||f.description)),...cfgParts.map(bhkKey)].filter(Boolean))]);
    const rows=[['Configuration',S.config],['Size range',S.sizes],['Starting price',S.price||NA],['Current availability',S.availability.status||'On request']].filter(f=>f[1]&&f[1]!==NA);
    const tables=(S.x.tables||[]).map(t=>`<div class="pm-sec"><h4>${esc(t.title)}</h4><div class="pm-tablewrap"><table class="pm-table"><thead><tr>${t.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('');
    return `<div class="pm-body"><h3 class="pm-sltitle">Availability &amp; enquiry</h3>
      <div class="pm-avail">
        <span class="pm-avail-k">Available units</span>
        <b class="pm-avail-v">${esc(S.availability.status||'On request')}</b>
        ${S.availability.note?`<p>${esc(S.availability.note)}</p>`:''}
      </div>
      ${factRows(rows)}
      <div class="pm-sec" style="margin-top:1.2rem">
        ${opts.length?`<label class="pm-label" for="pm-cfg">Configuration you’re interested in</label>
          <select class="select" id="pm-cfg" data-cfg><option value="">Any configuration</option>${opts.map(o=>`<option>${esc(o)}</option>`).join('')}</select>`:''}
        <div class="pm-cta" style="margin-top:.9rem">
          <a class="btn btn--sm pm-wa" data-wa href="${esc(waHref(S,''))}" target="_blank" rel="noopener">${ICON.whatsapp||''}Request availability on WhatsApp</a>
          <a class="btn btn--ghost btn--sm" href="tel:${GHR_TEL}">${ICON.phone||''}Call · ${esc(GHR_TEL_DISP)}</a>
        </div>
      </div>
      ${tables}
      <p class="pm-note">Prices and availability are indicative and subject to change — confirm with our team.</p>
    </div>`;
  }

  function buildSlides(S){
    const x=S.x, list=[['Overview',slideOverview],['Details',slideDetails]];
    if(S.floorPlans.length||(x.unitRows&&x.unitRows.length)||x.plansPdf) list.push(['Floor Plans',slidePlans]);
    if(S.amenities.length||(x.clubLevels&&x.clubLevels.length)||x.clubhouse) list.push(['Amenities',slideAmenities]);
    if(S.masterPlan&&S.masterPlan.image) list.push(['Master Plan',slideMaster]);
    list.push(['Location',slideLocation],['Availability',slideAvailability]);
    return list.map(([label,fn])=>({label,html:fn(S)}));
  }

  function deckHtml(S,slides){
    return `<div class="pm-deckhead"><nav class="pm-steps" role="tablist" aria-label="${esc(S.d.name)} — sections">${slides.map((s,i)=>
      `<button type="button" role="tab" class="pm-step" data-go="${i}" aria-controls="pm-sl-${i}">${esc(s.label)}</button>`).join('')}</nav>
      <button class="pm-close" data-pm-close aria-label="Close details">&times;</button></div>
    <div class="pm-deck" data-deck><div class="pm-strack" data-strack>${slides.map((s,i)=>
      `<section class="pm-sl" id="pm-sl-${i}" role="tabpanel" aria-label="${esc(s.label)}" data-sl="${i}">${s.html}</section>`).join('')}</div></div>
    <div class="pm-deckfoot">
      <button type="button" class="pm-arrow" data-prev aria-label="Previous section">&#8249;<span> Previous</span></button>
      <span class="pm-count" aria-live="polite"><b data-count>1</b> / ${slides.length}</span>
      <button type="button" class="pm-arrow" data-next aria-label="Next section"><span>Next </span>&#8250;</button>
    </div>`;
  }

  function goSlide(i,instant){
    if(!_deck) return;
    const n=_deck.slides.length; i=Math.max(0,Math.min(n-1,i)); _deck.i=i;
    const track=_panel.querySelector('[data-strack]');
    track.style.transition=instant?'none':'';
    track.style.transform=`translateX(${-100*i}%)`;
    _panel.querySelectorAll('[data-go]').forEach((b,j)=>{ b.classList.toggle('is-on',j===i); b.setAttribute('aria-selected',j===i?'true':'false'); b.tabIndex=j===i?0:-1;
      if(j===i&&b.scrollIntoView) b.parentNode.scrollTo({left:b.offsetLeft-b.parentNode.clientWidth/2+b.clientWidth/2,behavior:instant?'auto':'smooth'}); });
    _panel.querySelectorAll('[data-sl]').forEach((s,j)=>{ s.setAttribute('aria-hidden',j===i?'false':'true'); if(j===i) s.scrollTop=0; s.inert=j!==i; });
    _panel.querySelector('[data-count]').textContent=i+1;
    _panel.querySelector('[data-prev]').disabled=i===0;
    _panel.querySelector('[data-next]').disabled=i===n-1;
    // load this slide's images, and the next slide's ahead of time
    [i,i+1].forEach(k=>{ const s=_panel.querySelector(`[data-sl="${k}"]`); if(s) s.querySelectorAll('img[data-src]').forEach(im=>{ im.src=im.getAttribute('data-src'); im.removeAttribute('data-src'); }); });
    const mm=_panel.querySelector(`[data-sl="${i}"] [data-minimap]`);
    if(mm&&!mm._map&&typeof L!=='undefined'){
      const d=_deck.d;
      mm._map=L.map(mm,{scrollWheelZoom:false,dragging:!L.Browser.mobile,tap:false}).setView([d.lat,d.lng],14);
      // Esri light-grey canvas (no API key needed) — CARTO basemaps now require a key.
      const esri='https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
      L.tileLayer(esri+'World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles &copy; Esri',maxZoom:16}).addTo(mm._map);
      L.tileLayer(esri+'World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',{maxZoom:16}).addTo(mm._map);
      L.marker([d.lat,d.lng],{icon:greenDot()}).addTo(mm._map);
      setTimeout(()=>mm._map.invalidateSize(),360);
    }
  }

  // Zoomable image viewer (floor plans, master plan).
  function openZoom(src,alt){
    let z=document.querySelector('.pm-zoom');
    if(!z){
      z=document.createElement('div'); z.className='pm-zoom'; z.setAttribute('role','dialog'); z.setAttribute('aria-modal','true');
      z.innerHTML='<div class="pm-zoom-bar"><button type="button" data-z="-" aria-label="Zoom out">&minus;</button><button type="button" data-z="+" aria-label="Zoom in">+</button><button type="button" data-z="x" aria-label="Close">&times;</button></div><div class="pm-zoom-stage"><img alt=""></div>';
      document.body.appendChild(z);
      const stage=z.querySelector('.pm-zoom-stage'), im=z.querySelector('img');
      const set=k=>{ z._k=Math.max(1,Math.min(4,k)); im.style.width=(z._k*100)+'%'; };
      z.addEventListener('click',e=>{ const b=e.target.closest('[data-z]'); if(!b) return;
        if(b.dataset.z==='x') z.classList.remove('open'); else set(z._k+(b.dataset.z==='+'?.75:-.75)); });
      im.addEventListener('dblclick',()=>set(z._k>1?1:2.5));
      stage.addEventListener('wheel',e=>{ if(e.ctrlKey||e.metaKey){ e.preventDefault(); set(z._k+(e.deltaY<0?.25:-.25)); } },{passive:false});
      document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&z.classList.contains('open')){ e.stopImmediatePropagation(); z.classList.remove('open'); } },true);
      z._set=set;
    }
    const im=z.querySelector('img'); im.src=src; im.alt=alt||''; z._set(1); z.classList.add('open');
    z.querySelector('[data-z="x"]').focus();
  }

  function wireDeck(){
    const panel=_panel;
    panel.querySelector('[data-prev]').addEventListener('click',()=>goSlide(_deck.i-1));
    panel.querySelector('[data-next]').addEventListener('click',()=>goSlide(_deck.i+1));
    panel.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>goSlide(+b.dataset.go)));
    panel.querySelectorAll('[data-go-label]').forEach(b=>b.addEventListener('click',()=>{
      const j=_deck.slides.findIndex(s=>s.label===b.dataset.goLabel); if(j>=0) goSlide(j); }));
    panel.querySelectorAll('[data-thumb]').forEach(t=>t.addEventListener('click',()=>{
      const h=panel.querySelector('[data-hero]'); h.src=t.dataset.thumb; h.classList.remove('pm-heroimg--stock');
      panel.querySelectorAll('[data-thumb]').forEach(x=>x.classList.toggle('is-on',x===t)); }));
    panel.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>openZoom(b.dataset.zoom,b.dataset.zoomAlt)));
    const cfg=panel.querySelector('[data-cfg]'), wa=panel.querySelector('[data-wa]');
    if(cfg) cfg.addEventListener('change',()=>applyBhk(cfg.value));
    panel.querySelectorAll('[data-bhk-select]').forEach(sel=>sel.addEventListener('change',()=>{ applyBhk(sel.value); sel.closest('.pm-sl').scrollTop=0; }));
    const loc=panel.querySelector('[data-pm-locate]'); if(loc) loc.addEventListener('click',()=>locateOnMap(_deck.d.id));
    const bro=panel.querySelector('[data-pm-brochure]'); if(bro) bro.addEventListener('click',()=>openBrochure(_deck.d));
    // swipe between slides (not when dragging a map, a wide table or a zoomed image)
    const deck=panel.querySelector('[data-deck]'); let sx=0,sy=0,ok=false;
    deck.addEventListener('touchstart',e=>{ const t=e.touches[0]; sx=t.clientX; sy=t.clientY;
      ok=e.touches.length===1&&!e.target.closest('.leaflet-container,.pm-tablewrap,.pm-thumbs,select'); },{passive:true});
    deck.addEventListener('touchend',e=>{ if(!ok) return; const t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy;
      if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5) goSlide(_deck.i+(dx<0?1:-1)); },{passive:true});
  }

  function renderDeck(d,api,keepLabel){
    const S=slideData(d,api), slides=buildSlides(S);
    const bhk=keepLabel&&_deck&&_deck.d.id===d.id?_deck.bhk:'';
    _deck={d,api,slides,i:0,bhk:''};
    _panel.innerHTML=deckHtml(S,slides);
    wireDeck();
    const j=keepLabel?slides.findIndex(s=>s.label===keepLabel):-1;
    goSlide(j>=0?j:0,true);
    if(bhk) applyBhk(bhk);   // keep the visitor's choice when admin content arrives
  }

  function ensureModal(){
    if(_modal) return;
    _modal=document.createElement('div');
    _modal.className='pm-scrim';
    _modal.innerHTML='<div class="pm-panel pm-panel--deck" role="dialog" aria-modal="true" aria-label="Project details"></div>';
    document.body.appendChild(_modal);
    _panel=_modal.querySelector('.pm-panel');
    _modal.addEventListener('click',e=>{ if(e.target===_modal||e.target.closest('[data-pm-close]')) closeModal(); });
    document.addEventListener('keydown',e=>{
      if(!_modal.classList.contains('open')) return;
      if(e.key==='Escape') closeModal();
      else if((e.key==='ArrowRight'||e.key==='ArrowLeft')&&!/^(INPUT|SELECT|TEXTAREA)$/.test((e.target||{}).tagName||'')&&!e.target.closest?.('.leaflet-container'))
        goSlide(_deck.i+(e.key==='ArrowRight'?1:-1));
    });
  }
  function closeModal(){ if(_modal){ _modal.classList.remove('open'); document.body.style.overflow=''; } }
  function locateOnMap(id){
    closeModal();
    const m=_markers[id];
    if(m&&_map){
      _map.getContainer().scrollIntoView({behavior:'smooth',block:'center'});
      if(_cluster&&_cluster.hasLayer(m)&&_cluster.getVisibleParent(m)!==m){
        _cluster.zoomToShowLayer(m,()=>m.openPopup());
      } else {
        _map.flyTo(m.getLatLng(),14,{duration:.6}); m.openPopup();
      }
    }
  }
  window.GHR.openProjectModal=function(d){
    if(!d) return;
    ensureModal();
    renderDeck(d,_slideCache[d.id]);
    _modal.classList.add('open');
    document.body.style.overflow='hidden';
    setTimeout(()=>{ const c=_panel.querySelector('[data-pm-close]'); if(c) c.focus(); },50);
    // Admin-managed slide content — only when the site is served with its API.
    if(window.GHR_CMS&&!_slideCache[d.id]){
      fetch('/api/public/projects/'+encodeURIComponent(d.id)).then(r=>r.ok?r.json():null).then(api=>{
        if(!api) return;
        _slideCache[d.id]=api;
        if(_deck&&_deck.d.id===d.id&&_modal.classList.contains('open')) renderDeck(d,api,_deck.slides[_deck.i].label);
      }).catch(()=>{});
    }
  };
  window.GHR.openProjectModalById=function(id){
    const d=(window.GHR.GHR_DEVELOPERS||[]).find(x=>x.id===id);
    if(d) window.GHR.openProjectModal(d);
  };

  window.GHR.initCityMap=function(opts){
    // opts: {mapId, center, city, devListId, devFiltersId, devEmptyId}
    if(!document.getElementById(opts.mapId)||typeof L==='undefined')return;
    const devs=(window.GHR.GHR_DEVELOPERS||[]).filter(d=>d.city===opts.city);

    const map=L.map(opts.mapId,{scrollWheelZoom:false}).setView(opts.center,12);
    // Muted light-gray basemap (matches the reference look)
    const lightBase=L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png',{
      attribution:'&copy; OpenStreetMap &copy; CARTO',maxZoom:20});
    const satBase=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
      attribution:'Imagery &copy; Esri, Maxar, Earthstar Geographics',maxZoom:19});
    const satLabels=L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}{r}.png',{maxZoom:20});
    lightBase.addTo(map);
    // optional street/satellite switch (light is default, matching reference)
    L.control.layers({'Map':lightBase,'Satellite':satBase},null,{position:'topright'}).addTo(map);
    satBase.on('add',()=>satLabels.addTo(map));
    satBase.on('remove',()=>map.removeLayer(satLabels));
    map.on('click',()=>map.scrollWheelZoom.enable());
    map.on('mouseout',()=>map.scrollWheelZoom.disable());

    const devList=opts.devListId&&document.getElementById(opts.devListId);
    if(!devs.length)return;

    // cluster group (green "+N" bubbles) when clustering is available, else plain layer
    const useCluster = typeof L.markerClusterGroup==='function';
    const cluster = useCluster ? L.markerClusterGroup({
      showCoverageOnHover:false, spiderfyOnMaxZoom:true, maxClusterRadius:48,
      iconCreateFunction:function(c){
        const n=c.getChildCount();
        return L.divIcon({html:'<div><span class="pl">+</span>'+n+'</div>',className:'gh-cluster'+(n>15?' lg':''),iconSize:[34,34]});
      }
    }) : null;
    function addMk(m){ if(useCluster) cluster.addLayer(m); else m.addTo(map); }
    function rmMk(m){ if(useCluster) cluster.removeLayer(m); else map.removeLayer(m); }

    const devMarkers={};
    devs.forEach(d=>{
      const m=L.marker([d.lat,d.lng],{icon:greenDot()});
      m.bindPopup(devPopupHtml(d),{closeButton:true,maxWidth:260});
      m.on('mouseover',()=>m.openPopup());
      m.on('click',()=>{map.flyTo(m.getLatLng(),Math.max(map.getZoom(),14),{duration:.5});m.openPopup();});
      devMarkers[d.id]=m;
      addMk(m);
    });
    if(useCluster) map.addLayer(cluster);
    _map=map; _markers=devMarkers; _cluster=cluster;

    if(devList){
      devList.innerHTML=devs.map(devCard).join('');
      devList.querySelectorAll('.dv').forEach(card=>{
        card.addEventListener('click',e=>{
          if(e.target.closest('a'))return;
          const id=card.dataset.id;
          devList.querySelectorAll('.dv').forEach(c=>c.classList.remove('active'));
          card.classList.add('active');
          const d=devs.find(x=>x.id===id);
          window.GHR.openProjectModal(d);
        });
      });
    }

    const dwrap=opts.devFiltersId&&document.getElementById(opts.devFiltersId);
    if(dwrap){
      const areaSel=dwrap.querySelector('[data-df="area"]');
      if(areaSel){
        [...new Set(devs.map(d=>d.area))].sort().forEach(a=>{
          const o=document.createElement('option');o.value=a;o.textContent=a;areaSel.appendChild(o);
        });
      }
      const devSel=dwrap.querySelector('[data-df="builder"]');
      if(devSel){
        [...new Set(devs.map(d=>d.developer))].sort().forEach(b=>{
          const o=document.createElement('option');o.value=b;o.textContent=b;devSel.appendChild(o);
        });
      }
      const statusSel=dwrap.querySelector('[data-df="status"]');
      if(statusSel){
        const tally={};
        devs.forEach(d=>{const s=progress(d).status; if(s&&s!==NA) tally[s]=(tally[s]||0)+1});
        Object.keys(tally).sort((a,b)=>tally[b]-tally[a]||a.localeCompare(b)).forEach(s=>{
          const o=document.createElement('option');o.value=s;o.textContent=s+' ('+tally[s]+')';statusSel.appendChild(o);
        });
      }
      const yearSel=dwrap.querySelector('[data-df="year"]');
      if(yearSel){
        const ready=devs.filter(isReady).length, tally={};
        devs.forEach(d=>handoverYears(d).forEach(y=>{tally[y]=(tally[y]||0)+1}));
        const opt=(v,label)=>{const o=document.createElement('option');o.value=v;o.textContent=label;yearSel.appendChild(o)};
        if(ready) opt('ready','Ready to move ('+ready+')');
        Object.keys(tally).sort().forEach(y=>opt(y,'Handover '+y+' ('+tally[y]+')'));
      }
      // builder chips (name + project count), busiest builders first
      let chips=null;
      const counts={};
      devs.forEach(d=>{counts[d.developer]=(counts[d.developer]||0)+1});
      const builders=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||a.localeCompare(b));
      if(builders.length>1){
        chips=document.createElement('div');
        chips.className='dev-chips';
        chips.innerHTML='<button type="button" class="dev-chip is-on" data-dev="">All builders <b>'+devs.length+'</b></button>'+
          builders.map(b=>'<button type="button" class="dev-chip" data-dev="'+esc(b)+'">'+esc(b)+' <b>'+counts[b]+'</b></button>').join('');
        dwrap.insertAdjacentElement('afterend',chips);
      }
      const dapply=()=>{
        const fa=dwrap.querySelector('[data-df="area"]'),fb=dwrap.querySelector('[data-df="band"]'),
              fd=dwrap.querySelector('[data-df="builder"]'),fy=dwrap.querySelector('[data-df="year"]'),
              fs=dwrap.querySelector('[data-df="status"]');
        const who=fd?fd.value:'', when=fy?fy.value:'', stage=fs?fs.value:'';
        if(chips) chips.querySelectorAll('.dev-chip').forEach(c=>c.classList.toggle('is-on',c.dataset.dev===who));
        let shown=0;
        devs.forEach(d=>{
          let vis=true;
          if(fa&&fa.value&&d.area!==fa.value)vis=false;
          if(fb&&fb.value&&rateBand(d)!==fb.value)vis=false;
          if(who&&d.developer!==who)vis=false;
          if(when) vis=vis&&(when==='ready'?isReady(d):handoverYears(d).indexOf(when)>-1);
          if(stage&&progress(d).status!==stage)vis=false;
          const m=devMarkers[d.id];if(m){vis?addMk(m):rmMk(m)}
          const card=devList&&devList.querySelector(`.dv[data-id="${d.id}"]`);if(card)card.style.display=vis?'':'none';
          if(vis)shown++;
        });
        const empty=opts.devEmptyId&&document.getElementById(opts.devEmptyId);
        if(empty)empty.style.display=shown?'none':'block';
      };
      dwrap.querySelectorAll('[data-df]').forEach(s=>s.addEventListener('change',dapply));
      if(chips) chips.addEventListener('click',e=>{
        const btn=e.target.closest('.dev-chip'); if(!btn) return;
        if(devSel) devSel.value=btn.dataset.dev;
        dapply();
        const list=devList&&devList.parentNode?devList:null;
        if(list) list.scrollIntoView({behavior:'smooth',block:'nearest'});
      });
    }

    // deep link: ?project=<id> opens that project's modal (e.g. from homepage featured)
    try{
      const pid=new URLSearchParams(window.location.search).get('project');
      if(pid){ const d=devs.find(x=>x.id===pid); if(d) setTimeout(()=>window.GHR.openProjectModal(d),250); }
    }catch(e){}
  };
})();
