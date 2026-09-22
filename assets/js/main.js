/* =========================================================
   Get Home Realty — main.js
   ========================================================= */
(function(){
  'use strict';
  const ICON = window.GHR.ICON, SOCIAL = window.GHR.SOCIAL;

  /* ---- editable contact config (single source of truth) ---- */
  const CONFIG = {
    phone:'+91 90328 27722',
    phoneHref:'tel:+919032827722',
    email:'india@gethomerealty.ca',
    whatsapp:'https://wa.me/919032827722',
    addr:'Louis Philippe Serilingampally, 4th Floor, 356 Old Mumbai Highway, Serilingampally (M), Telangana',
    hours:'Open 24/7',
    // social profiles — add a URL here and the icon appears in the footer
    social:{
      yt:'https://www.youtube.com/@gethomerealty7461',
      ig:'https://www.instagram.com/get_home_realty_india/',
      fb:'https://www.facebook.com/GetHomeRealty',
      in:'',
      x:'',
    },
  };
  window.GHR_CONFIG = CONFIG;

  const NAV = [
    {label:'Home', href:'index.html'},
    {label:'About Us', href:'about.html'},
    {label:'Services', href:'services.html', sub:[
      {label:'Hyderabad', href:'hyderabad.html'},
      {label:'Visakhapatnam', href:'visakhapatnam.html'},
    ]},
    {label:'Buyers', href:'buyers.html'},
    {label:'Sellers', href:'sellers.html'},
    {label:'Investors', href:'investors.html'},
    {label:'Join Our Brokerage', href:'join.html'},
    {label:'Contact', href:'contact.html'},
  ];

  const BRAND = `
    <a class="brand" href="index.html" aria-label="Get Home Realty — A Tradition of Trust">
      <img class="brand-logo brand-logo--header" src="assets/img/ghr-logo-header.png" alt="Get Home Realty — A Tradition of Trust" width="1433" height="440">
      <img class="brand-logo brand-logo--footer" src="assets/img/ghr-logo-footer.png" alt="Get Home Realty — A Tradition of Trust" width="923" height="297">
    </a>`;

  /* Footer social icons: one <a> per configured profile, in this order. */
  const SOCIAL_ORDER=[['fb','Facebook'],['ig','Instagram'],['in','LinkedIn'],['yt','YouTube'],['x','X']];
  function socialLinks(){
    const urls=CONFIG.social||{};
    return SOCIAL_ORDER.filter(s=>urls[s[0]]).map(s=>
      `<a href="${urls[s[0]]}" target="_blank" rel="noopener" aria-label="${s[1]}">${SOCIAL[s[0]]}</a>`).join('');
  }

  /* ---------------- HEADER ---------------- */
  function buildHeader(active){
    const navItems = NAV.map(n=>{
      const isActive = n.href===active || (n.sub && n.sub.some(s=>s.href===active));
      if(n.sub){
        const subs = n.sub.map(s=>`<li><a href="${s.href}"><span class="pin"></span>${s.label}</a></li>`).join('');
        return `<li class="has-sub"><a href="${n.href}" class="${isActive?'active':''}">${n.label}
          <svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></a>
          <ul class="submenu">${subs}</ul></li>`;
      }
      return `<li><a href="${n.href}" class="${isActive?'active':''}">${n.label}</a></li>`;
    }).join('');

    return `
    <div class="topbar"><div class="wrap">
      <div class="topbar-tag">Canada · Hyderabad · Visakhapatnam</div>
      <div class="topbar-right">
        <a href="${CONFIG.phoneHref}" aria-label="Call us">${ICON.phone}<span class="tb-text">${CONFIG.phone}</span></a>
        <a href="${CONFIG.whatsapp}" target="_blank" rel="noopener" aria-label="Message us on WhatsApp">${ICON.whatsapp}<span class="tb-text">WhatsApp</span></a>
        <a href="mailto:${CONFIG.email}" aria-label="Email us">${ICON.mail}<span class="tb-text">${CONFIG.email}</span></a>
      </div>
    </div></div>
    <header class="site-header" id="siteHeader"><div class="wrap"><nav class="nav" aria-label="Primary">
      ${BRAND}
      <ul class="nav-list">${navItems}</ul>
      <div class="nav-cta">
        <a class="btn btn--sm" href="contact.html">Get Started</a>
        <button class="burger" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav"><span></span></button>
      </div>
    </nav></div></header>
    <div class="scrim" id="scrim"></div>
    <aside class="mobile-nav" id="mobileNav" aria-label="Mobile menu" aria-hidden="true">
      <div class="m-head">${BRAND}<button class="close-x" id="closeNav" aria-label="Close menu">
        <svg viewBox="0 0 24 24" width="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <nav class="m-links" aria-label="Mobile primary">${buildMobileLinks(active)}</nav>
      <a class="btn btn--block m-cta" href="contact.html">Get Started ${ICON.arrow}</a>
    </aside>`;
  }

  function buildMobileLinks(active){
    // Flat list of the primary navigation links (Services is a single link on mobile).
    return NAV.map(n=>`<a href="${n.href}" class="m-link${n.href===active?' active':''}">${n.label}</a>`).join('');
  }

  /* ---------------- FOOTER ---------------- */
  function buildFooter(){
    const quick = ['index.html|Home','about.html|About Us','services.html|Services','buyers.html|Buyers',
      'sellers.html|Sellers','investors.html|Investors','join.html|Join Our Brokerage',
      'contact.html|Contact']
      .map(x=>{const[h,l]=x.split('|');return `<li><a href="${h}">${l}</a></li>`}).join('');
    return `
    <footer class="site-footer"><div class="wrap">
      <div class="footer-top">
        <div class="footer-about">
          ${BRAND}
          <p>A premium real estate brokerage helping buyers, sellers, investors, landlords, tenants and pre-construction clients across Canada, Hyderabad and Visakhapatnam.</p>
          <div class="footer-social" aria-label="Social media">
            ${socialLinks()}
          </div>
        </div>
        <div class="footer-col"><h4>Quick Links</h4><ul>${quick}</ul></div>
        <div class="footer-col"><h4>Service Areas</h4><ul>
          <li><a href="hyderabad.html">Hyderabad</a></li>
          <li><a href="visakhapatnam.html">Visakhapatnam</a></li>
          <li><a href="investors.html">Investors</a></li>
          <li><a href="join.html">Careers / Agents</a></li>
        </ul></div>
        <div class="footer-col"><h4>Get in Touch</h4><ul class="footer-contact">
          <li>${ICON.pin}<span>${CONFIG.addr}</span></li>
          <li>${ICON.phone}<a href="${CONFIG.phoneHref}">${CONFIG.phone}</a></li>
          <li>${ICON.mail}<a href="mailto:${CONFIG.email}">${CONFIG.email}</a></li>
          <li>${ICON.clock}<span>${CONFIG.hours}</span></li>
        </ul></div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} Get Home Realty. All rights reserved.</span>
        <div class="legal">
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms &amp; Conditions</a>
          <a href="#disclaimer">Disclaimer</a>
        </div>
      </div>
    </div>
    <div class="disclaimer" id="disclaimer">Information displayed on this website is for general information purposes only and should be verified independently. Property availability, pricing, and details are subject to change without notice.</div>
    </footer>
    <div class="wa-widget" id="waWidget">
      <div class="wa-card" id="waCard" role="dialog" aria-label="Chat with Get Home Realty on WhatsApp">
        <div class="wa-head">
          <span class="wa-logo"><svg viewBox="0 0 24 24" fill="none" stroke="#1F5E46" stroke-width="2"><path d="M3 11l9-7 9 7M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/></svg></span>
          <div class="wa-id"><b>Get Home Realty</b><span>Typically replies within minutes</span></div>
          <button class="wa-x" id="waClose" type="button" aria-label="Close chat">&times;</button>
        </div>
        <div class="wa-body">
          <div class="wa-bubble">
            <b>Get Home Realty</b>
            <p>Hi, there! 👋</p>
            <p>How can I help you?</p>
            <span class="wa-time">Online now</span>
          </div>
        </div>
        <div class="wa-foot">
          <a class="wa-start" href="${CONFIG.whatsapp}?text=${encodeURIComponent("Hi Get Home Realty, I'm interested in your properties.")}" target="_blank" rel="noopener">${ICON.whatsapp}<span>Start Chat</span></a>
        </div>
      </div>
      <button class="wa-launch" id="waLaunch" type="button" aria-label="Open WhatsApp chat">${ICON.whatsapp}</button>
    </div>`;
  }

  /* ---------------- behaviours ---------------- */
  function wireNav(){
    const header=document.getElementById('siteHeader');
    const onScroll=()=>header&&header.classList.toggle('is-stuck',window.scrollY>8);
    onScroll();window.addEventListener('scroll',onScroll,{passive:true});

    const burger=document.getElementById('burger'),drawer=document.getElementById('mobileNav'),
      scrim=document.getElementById('scrim'),closeBtn=document.getElementById('closeNav');
    // Relocate overlay to <body> so position:fixed is always viewport-relative (never trapped in a stacking context)
    if(drawer&&drawer.parentElement!==document.body) document.body.appendChild(drawer);
    if(scrim&&scrim.parentElement!==document.body) document.body.appendChild(scrim);
    let _sy=0;
    const open=()=>{
      _sy=window.scrollY||document.documentElement.scrollTop||0;
      drawer.classList.add('open');scrim.classList.add('open');
      burger.setAttribute('aria-expanded','true');drawer.setAttribute('aria-hidden','false');
      document.body.classList.add('nav-open');document.body.style.top='-'+_sy+'px'; // freeze page (iOS-safe)
    };
    const close=()=>{
      drawer.classList.remove('open');scrim.classList.remove('open');
      burger.setAttribute('aria-expanded','false');drawer.setAttribute('aria-hidden','true');
      document.body.classList.remove('nav-open');document.body.style.top='';
      window.scrollTo(0,_sy);
    };
    burger&&burger.addEventListener('click',()=>drawer.classList.contains('open')?close():open());
    closeBtn&&closeBtn.addEventListener('click',close);scrim&&scrim.addEventListener('click',close);
    drawer&&drawer.querySelectorAll('a.m-link, a.m-cta').forEach(a=>a.addEventListener('click',close));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    document.querySelectorAll('[data-msub]').forEach(btn=>{
      btn.addEventListener('click',()=>{btn.nextElementSibling.classList.toggle('open');
        btn.querySelector('.caret').style.transform=btn.nextElementSibling.classList.contains('open')?'rotate(180deg)':''});
    });
  }

  function wireReveal(){
    const els=document.querySelectorAll('.anim-up');
    if(!('IntersectionObserver'in window)){els.forEach(e=>e.classList.add('in'));return}
    const io=new IntersectionObserver((entries)=>{entries.forEach((e,i)=>{
      if(e.isIntersecting){setTimeout(()=>e.target.classList.add('in'),i*60);io.unobserve(e.target)}})},{threshold:.12});
    els.forEach(e=>io.observe(e));
  }

  /* ---------------- form validation ---------------- */
  function wireForms(){
    document.querySelectorAll('form.gh-form').forEach(form=>{
      form.setAttribute('novalidate','');
      form.addEventListener('submit',e=>{
        e.preventDefault();let ok=true;
        form.querySelectorAll('[required]').forEach(f=>{
          const field=f.closest('.field');let valid=!!f.value.trim();
          if(f.type==='email'&&valid)valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value);
          if(f.type==='tel'&&valid)valid=f.value.replace(/\D/g,'').length>=7;
          if(f.tagName==='SELECT'&&!f.value)valid=false;
          f.classList.toggle('invalid',!valid);
          field&&field.classList.toggle('show-err',!valid);
          if(!valid&&ok){ok=false;f.focus()}
        });
        if(ok){
          const note=form.querySelector('.form-success');
          if(note){note.classList.add('show');note.scrollIntoView({behavior:'smooth',block:'center'})}
          form.reset();
          form.querySelectorAll('.invalid').forEach(f=>f.classList.remove('invalid'));
        }
      });
      form.querySelectorAll('input,select,textarea').forEach(f=>{
        f.addEventListener('input',()=>{f.classList.remove('invalid');const fl=f.closest('.field');fl&&fl.classList.remove('show-err')});
      });
    });
  }

  /* ---------------- property rendering ---------------- */
  function rupeeMeta(p){
    const bits=[];
    if(p.beds)bits.push(`<span class="sp">${ICON.bed}${p.beds} Bed</span>`);
    if(p.baths)bits.push(`<span class="sp">${ICON.bath}${p.baths} Bath</span>`);
    if(p.parking)bits.push(`<span class="sp">${ICON.car}${p.parking} Park</span>`);
    bits.push(`<span class="sp">${ICON.area}${p.size}</span>`);
    return bits.join('');
  }
  function propCard(p){
    const status = p.status==='sold'
      ? '<span class="prop-status sold">Sold</span>'
      : '<span class="prop-status">Available</span>';
    return `<article class="prop anim-up" data-deal="${p.deal}" data-city="${p.city}" data-type="${p.type}" data-status="${p.status}" data-price="${p.price}" data-beds="${p.beds}" data-baths="${p.baths}" data-parking="${p.parking}">
      <div class="prop-media">
        <div class="prop-media-bg" style="background-image:url('${imgFor(p)}')"></div>
        <span class="prop-badge">${p.deal}</span>${status}
      </div>
      <div class="prop-body">
        <div class="prop-addr">${ICON.pin}<span>${p.area}, ${p.city}</span></div>
        <div class="prop-type">${p.type}</div>
        <div class="prop-specs">${rupeeMeta(p)}</div>
        <p class="prop-desc">${p.desc}</p>
        <div class="prop-actions">
          <a class="btn btn--sm" href="property-detail.html?id=${p.id}">View Details</a>
          <a class="btn btn--ghost btn--sm" href="contact.html">Contact</a>
        </div>
      </div>
    </article>`;
  }
  // deterministic placeholder image per property (Unsplash source by keyword)
  function imgFor(p){
    const seeds={Apartment:'1545324418-cc1a3fa10c00',Villa:'1613490493576-7fde63acd811',
      Plot:'1500382017468-9049fed747ef',Commercial:'1486406146926-c627a92ad1ab'};
    const id=seeds[p.type]||'1564013799919-ab600027ffc6';
    return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70`;
  }
  window.GHR.imgFor=imgFor;window.GHR.propCard=propCard;

  function renderProperties(){
    const grid=document.getElementById('propGrid');if(!grid)return;
    grid.innerHTML=window.GHR.GHR_PROPERTIES.map(propCard).join('');
    wireFilters();wireReveal();
  }
  function wireFilters(){
    const grid=document.getElementById('propGrid');if(!grid)return;
    const get=id=>document.getElementById(id);
    const apply=()=>{
      const f={deal:get('f-deal'),city:get('f-city'),type:get('f-type'),status:get('f-status'),
        price:get('f-price'),beds:get('f-beds'),baths:get('f-baths'),parking:get('f-parking')};
      let shown=0;
      grid.querySelectorAll('.prop').forEach(c=>{
        let vis=true;
        if(f.deal&&f.deal.value&&c.dataset.deal!==f.deal.value)vis=false;
        if(f.city&&f.city.value&&c.dataset.city!==f.city.value)vis=false;
        if(f.type&&f.type.value&&c.dataset.type!==f.type.value)vis=false;
        if(f.status&&f.status.value&&c.dataset.status!==f.status.value)vis=false;
        if(f.beds&&f.beds.value&&+c.dataset.beds<+f.beds.value)vis=false;
        if(f.baths&&f.baths.value&&+c.dataset.baths<+f.baths.value)vis=false;
        if(f.parking&&f.parking.value&&+c.dataset.parking<+f.parking.value)vis=false;
        if(f.price&&f.price.value){const[mn,mx]=f.price.value.split('-').map(Number);
          const pr=+c.dataset.price;if(pr<mn||(mx&&pr>mx))vis=false}
        c.style.display=vis?'':'none';if(vis)shown++;
      });
      const empty=document.getElementById('propEmpty');if(empty)empty.style.display=shown?'none':'block';
      const count=document.getElementById('propCount');if(count)count.textContent=shown;
    };
    document.querySelectorAll('[data-filter]').forEach(s=>s.addEventListener('change',apply));
    const reset=document.getElementById('filterReset');
    reset&&reset.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(s=>s.value='');apply()});
    apply();
  }

  /* ---------------- boot ---------------- */
  document.addEventListener('DOMContentLoaded',()=>{
    const page=document.body.getAttribute('data-page')||'index.html';
    const h=document.querySelector('[data-gh-header]');if(h)h.innerHTML=buildHeader(page);
    const f=document.querySelector('[data-gh-footer]');if(f)f.innerHTML=buildFooter();
    wireNav();wireForms();renderProperties();wireWhatsApp();
    if(window.GHR_PAGE_INIT)window.GHR_PAGE_INIT();
    wireReveal(); // run after page-specific content (e.g. What We Do / Client Stories) is injected
  });

  function wireWhatsApp(){
    const w=document.getElementById('waWidget');if(!w)return;
    const card=document.getElementById('waCard'),
          launch=document.getElementById('waLaunch'),
          close=document.getElementById('waClose');
    const KEY='gh_wa_closed';
    let closed=false; try{closed=localStorage.getItem(KEY)==='1';}catch(e){}
    function setOpen(open){
      w.classList.toggle('is-open',open);
      launch.setAttribute('aria-expanded',open?'true':'false');
      try{localStorage.setItem(KEY,open?'0':'1');}catch(e){}
    }
    // initially expanded unless the user closed it before
    setTimeout(()=>w.classList.add('ready'),150);
    setOpen(!closed);
    launch.addEventListener('click',()=>setOpen(!w.classList.contains('is-open')));
    close.addEventListener('click',()=>setOpen(false));
  }
})();
