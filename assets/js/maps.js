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
    const f=detFact(d,/saleable|built-?up|villa sizes|^sizes?$/i); if(f) return f;
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
    const GHR_TEL='+919963206933';
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
    // location already shows above in .dv-meta — the card grid carries the rest
    const cells=featuresOf(d).slice(1);
    const st=progress(d).status;
    if(d.rate&&d.rate!=='\u2014') cells.splice(1,0,['Price',d.rate,ICON.tag]);
    if(d.scale&&d.scale!=='\u2014') cells.push(['Project scale',d.scale,ICON.building]);
    // a figure we don't have is left out rather than shown as a placeholder
    const known=cells.filter(c=>c[1]&&c[1]!==NA);
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
        <div class="dv-feats">${featCells(known)}</div>
        <span class="dv-more">View details ${ICON.arrow}</span>
      </div>
    </div>`;
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
    const club=(x.clubLevels&&x.clubLevels.length)
      ? `<dl class="bro-levels">${x.clubLevels.map(l=>`<dt>${esc(l[0])}</dt><dd>${esc(l[1])}</dd>`).join('')}</dl>`
      : (x.clubhouse?`<p>${esc(x.clubhouse)}</p>`:'');
    const amen=(x.amenities&&x.amenities.length)
      ? `<ul class="bro-chips">${x.amenities.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>` : '';
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
  ${sec('Pros & cons',proscons)}
  ${sec('Configurations',units)}
  ${sec('Clubhouse',club)}
  ${sec('Amenities',amen)}
  ${sec('Location highlights',loc)}
  ${sec('Specifications',spec)}
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
  const GHR_TEL='+919963206933', GHR_WA='919963206933';
  // what the Call button shows — our projects desk, never the builder's line
  const GHR_TEL_DISP='+91 99632 06933';

  function detailFor(d){ return (window.GHR.GHR_DETAILS||{})[d.id]||null; }

  function devModalHtml(d){
    const x=detailFor(d)||{};
    const dev=x.developer||d.developer||'';
    const tags=[];
    if(d.status && d.status!=='—') tags.push(`<span class="pm-tag">${d.status}</span>`);
    if(d.config) tags.push(`<span class="pm-tag pm-tag--soft">${d.config}</span>`);
    const gridOf=rows=>`<div class="pm-facts">${rows.map(f=>`<div class="pm-fact"><span>${f[0]}</span><b>${f[1]}</b></div>`).join('')}</div>`;
    // the six standard features, always shown
    const feats=featuresOf(d).map(f=>[f[0],f[1]]);
    if(d.rate&&d.rate!=='\u2014') feats.splice(2,0,['Price',d.rate]);
    if(d.scale&&d.scale!=='\u2014') feats.push(['Project scale',d.scale]);
    const shown=feats.filter(f=>f[1]&&f[1]!==NA);
    const featHtml=`<div class="pm-sec"><h4>Project features</h4>${gridOf(shown)}</div>`;
    // builder-published specifics (RERA, land, structure…) — location lives in the features grid
    const extra=(x.facts||[]).filter(f=>!/^(locality|location)$/i.test(f[0]));
    const factsHtml=extra.length?`<div class="pm-sec"><h4>Project details</h4>${gridOf(extra)}</div>`:'';
    let tableHtml='';
    if(x.unitHead && x.unitRows && x.unitRows.length){
      tableHtml=`<div class="pm-sec"><h4>Configurations</h4><div class="pm-tablewrap"><table class="pm-table"><thead><tr>${x.unitHead.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${x.unitRows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    }
    let clubHtml='';
    if(x.clubLevels && x.clubLevels.length){
      clubHtml=`<div class="pm-sec"><h4>Clubhouse</h4><div class="pm-levels">${x.clubLevels.map(l=>`<div class="pm-level"><span>${l[0]}</span><p>${l[1]}</p></div>`).join('')}</div></div>`;
    } else if(x.clubhouse){
      clubHtml=`<div class="pm-sec"><h4>Clubhouse</h4><p class="pm-text">${x.clubhouse}</p></div>`;
    }
    // pros / cons — plain statements drawn from the project's own material
    const pcCol=(cls,title,items)=>`<div class="pm-pc-col pm-pc--${cls}"><h5>${title}</h5><ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;
    const hasPros=x.pros&&x.pros.length, hasCons=x.cons&&x.cons.length;
    const pcHtml=(hasPros||hasCons)?`<div class="pm-sec"><h4>Pros &amp; cons</h4><div class="pm-pc">` +
      (hasPros?pcCol('pro','Pros',x.pros):'') + (hasCons?pcCol('con','Good to know',x.cons):'') + `</div></div>`:'';
    const amenHtml=(x.amenities&&x.amenities.length)?`<div class="pm-sec"><h4>Amenities</h4><div class="pm-chips">${x.amenities.map(a=>`<span class="pm-chip">${a}</span>`).join('')}</div></div>`:'';
    const locHtml=(x.location&&x.location.length)?`<div class="pm-sec"><h4>Location highlights</h4><div class="pm-loc">${x.location.map(l=>`<div class="pm-locrow"><span>${l[0]}</span><b>${l[1]}</b></div>`).join('')}</div></div>`:'';
    const specHtml=(x.specs&&x.specs.length)?`<div class="pm-sec"><h4>Specifications</h4><div class="pm-specs">${specRows(x.specs)}</div></div>`:'';
    const noteHtml=x.note?`<p class="pm-note">${x.note}</p>`:'';
    const tagline=x.tagline?`<p class="pm-lead">${x.tagline}</p>`:'';
    const callDisp=GHR_TEL_DISP;
    const broHref=brochureUrl(d);
    const waMsg=encodeURIComponent('Hi, I would like details on '+d.name+' ('+d.area+').');
    const imgs=gallerySlides(d);
    const slides=imgs;
    const hasImg=slides.length>0;
    const multi=slides.length>1;
    const slidesHtml=slides.map((s,i)=>`<div class="pm-slide${s.stock?' pm-slide--stock':''}" style="background-image:${s.stock?`url('${s.u}'),${gradFor(d)}`:`url('${s.u}')`}" role="img" aria-label="${d.name} — image ${i+1} of ${slides.length}"></div>`).join('');
    const navHtml=multi?`<button type="button" class="pm-nav pm-prev" data-pm-prev aria-label="Previous image">&#8249;</button><button type="button" class="pm-nav pm-next" data-pm-next aria-label="Next image">&#8250;</button>`:'';
    const dotsHtml=multi?`<div class="pm-dots">${slides.map((_,i)=>`<button type="button" class="pm-dot${i===0?' is-on':''}" data-pm-dot="${i}" aria-label="Go to image ${i+1}"></button>`).join('')}</div>`:'';
    return `
    <button class="pm-close" data-pm-close aria-label="Close details">&times;</button>
    <div class="pm-gallery${hasImg?'':' pm-gallery--empty'}">
      <div class="pm-track" data-pm-track>${slidesHtml}</div>
      <div class="pm-shade"></div>
      <div class="pm-hero-in">
        ${dev?`<div class="pm-kicker">${dev}</div>`:''}
        <h3 class="pm-title">${d.name}</h3>
        ${tags.length?`<div class="pm-tags">${tags.join('')}</div>`:''}
      </div>
      ${navHtml}
      ${dotsHtml}
    </div>
    <div class="pm-body">
      ${tagline}
      ${featHtml}
      ${pcHtml}
      ${factsHtml}
      ${tableHtml}
      ${clubHtml}
      ${amenHtml}
      ${locHtml}
      ${specHtml}
      ${noteHtml}
      <div class="pm-cta">
        <a class="btn btn--sm" href="https://wa.me/${GHR_WA}?text=${waMsg}" target="_blank" rel="noopener">${ICON.whatsapp||''}WhatsApp Enquiry</a>
        <a class="btn btn--ghost btn--sm" href="tel:${GHR_TEL}">${ICON.phone||''}Call${callDisp?` · ${callDisp}`:''}</a>
        ${broHref
          ? `<a class="btn btn--ghost btn--sm" href="${broHref}" target="_blank" rel="noopener" download>${ICON.doc||''}Download brochure</a>`
          : `<button type="button" class="btn btn--ghost btn--sm" data-pm-brochure>${ICON.doc||''}Download brochure</button>`}
        ${_map?`<button type="button" class="btn btn--ghost btn--sm" data-pm-locate>${ICON.pin||''}Locate on map</button>`:''}
      </div>
    </div>`;
  }

  function ensureModal(){
    if(_modal) return;
    _modal=document.createElement('div');
    _modal.className='pm-scrim';
    _modal.innerHTML='<div class="pm-panel" role="dialog" aria-modal="true" aria-label="Project details"></div>';
    document.body.appendChild(_modal);
    _panel=_modal.querySelector('.pm-panel');
    _modal.addEventListener('click',e=>{ if(e.target===_modal||e.target.closest('[data-pm-close]')) closeModal(); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&_modal.classList.contains('open')) closeModal(); });
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
  function wireGallery(panel){
    const track=panel.querySelector('[data-pm-track]');
    if(!track) return;
    const slides=[].slice.call(track.children);
    if(slides.length<2) return;
    const dots=[].slice.call(panel.querySelectorAll('[data-pm-dot]'));
    const cur=()=>Math.round(track.scrollLeft/track.clientWidth);
    const go=i=>{ i=Math.max(0,Math.min(slides.length-1,i)); track.scrollTo({left:i*track.clientWidth,behavior:'smooth'}); };
    const prev=panel.querySelector('[data-pm-prev]'), next=panel.querySelector('[data-pm-next]');
    if(prev) prev.addEventListener('click',()=>go(cur()-1));
    if(next) next.addEventListener('click',()=>go(cur()+1));
    dots.forEach((dot,i)=>dot.addEventListener('click',()=>go(i)));
    track.addEventListener('scroll',()=>{ const c=cur(); dots.forEach((dot,i)=>dot.classList.toggle('is-on',i===c)); },{passive:true});
  }
  window.GHR.openProjectModal=function(d){
    if(!d) return;
    ensureModal();
    _panel.innerHTML=devModalHtml(d);
    _panel.scrollTop=0;
    _modal.classList.add('open');
    document.body.style.overflow='hidden';
    wireGallery(_panel);
    const loc=_panel.querySelector('[data-pm-locate]');
    if(loc) loc.addEventListener('click',()=>locateOnMap(d.id));
    const bro=_panel.querySelector('[data-pm-brochure]');
    if(bro) bro.addEventListener('click',()=>openBrochure(d));
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
              fd=dwrap.querySelector('[data-df="builder"]'),fy=dwrap.querySelector('[data-df="year"]');
        const who=fd?fd.value:'', when=fy?fy.value:'';
        if(chips) chips.querySelectorAll('.dev-chip').forEach(c=>c.classList.toggle('is-on',c.dataset.dev===who));
        let shown=0;
        devs.forEach(d=>{
          let vis=true;
          if(fa&&fa.value&&d.area!==fa.value)vis=false;
          if(fb&&fb.value&&rateBand(d)!==fb.value)vis=false;
          if(who&&d.developer!==who)vis=false;
          if(when) vis=vis&&(when==='ready'?isReady(d):handoverYears(d).indexOf(when)>-1);
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
