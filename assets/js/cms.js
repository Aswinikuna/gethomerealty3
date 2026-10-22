/* =========================================================
   Get Home Realty — cms.js
   Applies content managed in the admin panel (window.GHR_CMS, set by
   /api/public/content.js) on top of the built-in content in data.js.
   When GHR_CMS is missing (site opened as static files, API down) nothing
   changes and every page keeps its built-in content.
   Load order: data.js → /api/public/content.js → cms.js → main.js
   ========================================================= */
(function(){
  'use strict';
  var G = window.GHR, C = window.GHR_CMS;
  G.cms = null;
  G.applyCms = function(){};
  if(!C || C.v !== 1) return;
  G.cms = C;

  /* Text from the admin is placed into templates that build HTML, so markup and
     quote characters are neutralised here; URLs were validated by the API. */
  function clean(s){
    return s==null ? '' : String(s).replace(/[<>`]/g,'').replace(/"/g,'”').replace(/'/g,'’');
  }
  function cleanAll(o){
    if(Array.isArray(o)) return o.map(cleanAll);
    if(o && typeof o==='object'){ var r={}; for(var k in o) r[k]=cleanAll(o[k]); return r; }
    return typeof o==='string' ? clean(o) : o;  // URLs never contain these characters (API-validated), so they pass unchanged
  }
  function el(tag, cls, text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
  function digits(s){ return String(s||'').replace(/\D/g,''); }

  /* ---------------- data overrides (run now, before main.js / maps.js) ---------------- */
  if(Array.isArray(C.properties)) G.GHR_PROPERTIES = cleanAll(C.properties);

  function adoptProject(p){
    if(p.images && p.images.length) G.GHR_IMAGES[p.id] = p.images; else delete G.GHR_IMAGES[p.id];
    var det = G.GHR_DETAILS[p.id] || {};
    if(p.description) det.tagline = p.description;
    if(p.amenities && p.amenities.length) det.amenities = p.amenities;
    if(p.floorplans && p.floorplans.length) det.plans = p.floorplans.map(function(f){ return [f.label || 'Floor plan', f.url]; });
    if(Object.keys(det).length) G.GHR_DETAILS[p.id] = det;
  }
  if(Array.isArray(C.projects)){
    var projects = cleanAll(C.projects);
    projects.forEach(adoptProject);
    // Only projects with coordinates can be plotted.
    G.GHR_DEVELOPERS = projects.filter(function(p){ return typeof p.lat==='number' && typeof p.lng==='number'; });
  }
  G.featuredProjects = cleanAll(C.featuredProjects || []);
  G.featuredProjects.forEach(adoptProject);

  /* Agents, in the shape about.html renders. */
  G.cmsAgents = cleanAll(C.agents || []).map(function(a){
    return { name:a.name, role:a.designation||'', photo:a.photo||'', phone:a.phone||'', mail:a.email||'',
      bio:a.bio||'', at:(a.areas||[]).join(', ') };
  });

  /* Contact / social / top bar / navigation → read by main.js when it builds the header & footer. */
  var ct = C.contact || {}, so = C.social || {}, tb = (C.homepage||{}).topbar || {}, nav = ((C.homepage||{}).navigation||{}).items || [];
  var office = (ct.offices||[])[0];
  var wa = digits(ct.whatsapp || tb.whatsapp);
  var cfg = {};
  var phone = ct.india_phone || ct.canada_phone;
  if(phone){ cfg.phone = clean(phone); cfg.phoneHref = 'tel:+' + digits(phone); }
  if(ct.email) cfg.email = clean(ct.email);
  if(wa) cfg.whatsapp = 'https://wa.me/' + wa;
  if(office && office.address) cfg.addr = clean(office.address);
  if(ct.business_hours) cfg.hours = clean(ct.business_hours);
  if(tb.phone){ cfg.tbPhone = clean(tb.phone); cfg.tbPhoneHref = 'tel:+' + digits(tb.phone); }
  if(tb.email) cfg.tbEmail = clean(tb.email);
  if(tb.whatsapp) cfg.tbWhatsapp = 'https://wa.me/' + digits(tb.whatsapp);
  if(tb.location_text) cfg.tag = clean(tb.location_text);
  cfg.social = { fb:so.facebook||'', ig:so.instagram||'', in:so.linkedin||'', yt:so.youtube||'', x:so.x||'' };
  if(nav.length) cfg.nav = nav.map(function(n){ return { label: clean(n.label), href: n.href }; });
  G.cmsConfig = cfg;

  /* ---------------- settings: favicon, analytics ---------------- */
  var st = C.settings || {};
  if(st.favicon){
    var fav = document.querySelector('link[rel="icon"]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel:'icon' }));
    fav.href = st.favicon;
  }
  if(st.ga && /^(G|GT|AW)-[A-Z0-9]+$/.test(st.ga)){
    var gs = document.createElement('script'); gs.async = true; gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + st.ga;
    document.head.appendChild(gs);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date()); window.gtag('config', st.ga);
  }
  if(st.pixel && /^\d+$/.test(st.pixel)){
    /* Standard Meta Pixel bootstrap */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
      s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', st.pixel); window.fbq('track', 'PageView');
  }

  /* ---------------- DOM updates (called by main.js after the page renders) ---------------- */
  function setText(sel, v){ var e=document.querySelector(sel); if(e && v) e.textContent = v; return e; }

  function applyHome(){
    var h = (C.homepage||{}).hero || {};
    setText('[data-cms="hero-kicker"]', h.location_text);
    var title = document.querySelector('[data-cms="hero-title"]');
    if(title && h.heading){
      var lines = h.heading.split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean);
      title.textContent = '';
      lines.forEach(function(line, i){ title.appendChild(el('span', 'ln' + (lines.length===3 && i===1 ? ' outline' : ''), line)); });
      title.setAttribute('aria-label', lines.join(' '));
    }
    setText('[data-cms="hero-lead"]', h.description);
    var cta = document.querySelector('[data-cms="hero-cta"]');
    if(cta){
      if(h.button_text){ cta.textContent = h.button_text + ' '; var ar = el('span', null, '→'); ar.setAttribute('aria-hidden','true'); cta.appendChild(ar); }
      if(h.button_url) cta.setAttribute('href', h.button_url);
    }
    var art = document.querySelector('[data-cms="hero-art"]');
    if(art && h.image){
      art.textContent = '';
      var img = el('img'); img.src = h.image; img.alt = ''; img.decoding = 'async';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:24px';
      art.appendChild(img);
    }

    var stats = ((C.homepage||{}).stats||{}).items || [];
    var band = document.querySelector('[data-cms="stats"]');
    if(band && stats.length){
      band.textContent = '';
      stats.forEach(function(s){ var d = el('div', 'stat anim-up in'); d.appendChild(el('b', null, s.value)); d.appendChild(el('span', null, s.label)); band.appendChild(d); });
    }

    var reviews = C.reviews || [];
    var grid = document.getElementById('testimonials');
    if(grid && reviews.length){
      grid.textContent = '';
      reviews.slice(0, 8).forEach(function(r){
        var a = el('article', 'story anim-up in');
        var top = el('div', 'story-top');
        var ic = el('span', 'story-ic');
        if(r.image){ ic.style.cssText = 'background:center/cover no-repeat url("' + encodeURI(r.image) + '")'; }
        else { ic.textContent = (r.name||'?').trim().charAt(0).toUpperCase(); ic.style.fontWeight = '700'; }
        top.appendChild(ic);
        var stars = '★★★★★'.slice(0, r.rating) + '☆☆☆☆☆'.slice(0, 5 - r.rating);
        var cat = el('span', 'story-cat', stars + (r.location ? ' · ' + r.location : ''));
        cat.setAttribute('aria-label', r.rating + ' out of 5' + (r.location ? ', ' + r.location : ''));
        top.appendChild(cat);
        a.appendChild(top);
        a.appendChild(el('h3', 'story-title', r.name));
        a.appendChild(el('p', 'story-text', r.text));
        grid.appendChild(a);
      });
    }

    var videos = C.videos || [];
    var vsec = document.querySelector('[data-cms="videos"]');
    if(vsec && videos.length){
      var vg = vsec.querySelector('[data-cms="video-grid"]');
      videos.forEach(function(v){
        var url = v.youtube || v.instagram; if(!url) return;
        var yt = (v.youtube||'').match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
        var thumb = v.thumbnail || (yt ? 'https://i.ytimg.com/vi/' + yt[1] + '/hqdefault.jpg' : '');
        // Each video has its own SEO page (/videos/<slug>); fall back to the video host.
        var card = el('a', 'card anim-up in');
        if(v.slug){ card.href = '/videos/' + v.slug; } else { card.href = url; card.target = '_blank'; card.rel = 'noopener'; }
        card.style.cssText = 'padding:0;overflow:hidden;display:flex;flex-direction:column;text-decoration:none';
        if(thumb){
          var im = el('img'); im.src = thumb; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
          im.style.cssText = 'width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#eee';
          card.appendChild(im);
        }
        var body = el('div'); body.style.cssText = 'padding:1.1rem 1.25rem 1.3rem';
        if(v.category) body.appendChild(el('p', 'eyebrow', v.category));
        body.appendChild(el('h3', null, v.title));
        if(v.description){ var p = el('p', null, v.description); p.style.marginTop = '.4rem'; body.appendChild(p); }
        card.appendChild(body);
        vg.appendChild(card);
      });
      if(vg.children.length) vsec.hidden = false;
    }

    // Title, description and social tags are rendered into the page source by the server.
  }

  function applyAbout(){
    var a = (C.homepage||{}).about || {};
    setText('[data-cms="about-heading"]', a.heading);
    setText('[data-cms="about-short"]', a.short_description);
    setText('[data-cms="about-company"]', a.company_description);
    var im = document.querySelector('[data-cms="about-image"]');
    if(im && a.image) im.style.backgroundImage = 'url("' + encodeURI(a.image) + '")';
  }

  G.applyCms = function(page){
    if(st.logo){
      document.querySelectorAll('.brand-logo--header').forEach(function(i){ i.src = st.logo; i.removeAttribute('width'); i.removeAttribute('height'); });
    }
    if(st.site_name) document.querySelectorAll('.brand').forEach(function(b){ b.setAttribute('aria-label', st.site_name); });
    if(page === 'index.html') applyHome();
    if(page === 'about.html') applyAbout();
    var hours = document.getElementById('cHours');
    if(hours && cfg.hours) hours.textContent = cfg.hours;
  };
})();
