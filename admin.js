/* KAIRO STHANA — ADMIN/MEMBER PROTOTYPE
   Preserves the original site. Production roles belong in Supabase Auth + RLS. */
(() => {
  "use strict";
  const KEY="kairo_admin_data_v1", SESSION="kairo_role_session_v1";
  const sb=window.KairoSB||null; let isAdmin=false, remoteData=null;
  const defaults={
    content:{heroSubtitle:"Kamar Illiyyin Loro",heroText:"Sebuah kamar legendaris yang menjadi saksi lahirnya banyak karya, kompetisi, dan kemenangan.",aboutLead:"Kamar Illiyyin Loro adalah tempat berkumpulnya semangat, kreativitas, dan keberanian untuk terus mencoba.",aboutBody:"Dari sebuah ruang sederhana di lingkungan Pondok Pesantren Darul Falah, lahir cerita-cerita kompetisi dan pencapaian yang terus bertambah. Website ini menjadi ruang digital untuk menyimpan perjalanan tersebut.",quoteText:"Sak joosseh",instagram:"@kairo_sthana",announcement:""},
    achievements:[["Juara 1","Nama Lomba / Kompetisi","2026 · Placeholder"],["Juara 2","Nama Lomba / Kompetisi","2026 · Placeholder"],["Finalis","Nama Lomba / Kompetisi","2026 · Placeholder"]],
    gallery:[["","Dokumentasi lomba"],["","Piala & prestasi"],["","Kegiatan"],["","Coming soon"]],
    members:["Kairo Sthana"]
  };
  const clone=x=>JSON.parse(JSON.stringify(x));
  const load=()=>{if(sb)return Object.assign(clone(defaults),remoteData?clone(remoteData):{});try{return Object.assign(clone(defaults),JSON.parse(localStorage.getItem(KEY)||"{}"));}catch{return clone(defaults)}};
  let data=load(), $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const session=()=>isAdmin?{role:"admin"}:null;
  const setSession=role=>{isAdmin=role==="admin";ui()};
  const ui=()=>{let s=session(),a=s?.role==="admin";document.body.classList.toggle("admin-mode",a);const li=!!s||!!window.KairoMember?.user;$("#authOpenBtn").hidden=li;$("#adminOpenBtn").hidden=!a;$("#logoutBtn").hidden=!li};
  const open=m=>{m.hidden=false;document.body.style.overflow="hidden"}, close=m=>{m.hidden=true;if($("#authModal").hidden&&$("#adminModal").hidden)document.body.style.overflow=""};
  $("#authOpenBtn")?.addEventListener("click",()=>open($("#authModal")));
  $("#adminOpenBtn")?.addEventListener("click",()=>{if(session()?.role==="admin"){fill();open($("#adminModal"))}});
  $("#logoutBtn")?.addEventListener("click",async()=>{isAdmin=false;ui();try{await sb?.auth.signOut()}catch{}window.KairoLiving?.reload?.();window.KairoMember?.refresh?.()});
  $$("[data-close-auth]").forEach(x=>x.addEventListener("click",()=>close($("#authModal"))));
  $$("[data-close-admin]").forEach(x=>x.addEventListener("click",()=>close($("#adminModal"))));

  async function checkAdmin(uid){
    const {data:row}=await sb.from('kairo_admins').select('user_id').eq('user_id',uid).maybeSingle();
    if(row){setSession('admin');window.KairoLiving?.reload?.();return true}
    return false;
  }
  $("#authForm")?.addEventListener("submit",async e=>{
    e.preventDefault();const f=e.target,err=$("#authError");
    const email=$("#authUsername").value.trim(),pw=$("#authPassword").value;
    if(!sb){err.textContent="Supabase belum tersambung, login admin belum tersedia.";return}
    err.textContent="Memeriksa…";
    try{
      const {data:r,error}=await sb.auth.signInWithPassword({email,password:pw});
      if(error||!r?.user){err.textContent="Email atau password salah.";return}
      const isAdm=await checkAdmin(r.user.id);
      f.reset();err.textContent="";close($("#authModal"));
      if(isAdm){fill();open($("#adminModal"))}else window.KairoMember?.refresh?.();
    }catch{err.textContent="Gagal terhubung. Coba lagi."}
  });

  $$(".admin-tab").forEach(t=>t.addEventListener("click",()=>{
    $$(".admin-tab").forEach(x=>x.classList.toggle("active",x===t));
    $$(".admin-pane").forEach(x=>x.classList.toggle("active",x.dataset.pane===t.dataset.tab));
  }));
  const set=(f,n,v)=>{if(f?.elements?.namedItem(n))f.elements.namedItem(n).value=v??""};
  function fill(){
    data=load();let c=data.content,f=$("#contentForm");
    Object.entries(c).forEach(([k,v])=>set(f,k,v));
    let a=$("#achievementForm");data.achievements.forEach((x,i)=>{set(a,`a${i+1}t`,x[0]);set(a,`a${i+1}n`,x[1]);set(a,`a${i+1}m`,x[2])});
    let g=$("#galleryForm");data.gallery.forEach((x,i)=>{set(g,`g${i+1}u`,x[0]);set(g,`g${i+1}c`,x[1])});
    set($("#memberForm"),"members",data.members.join("\n"));renderMembers();
  }
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  async function persist(){
    if(!sb){localStorage.setItem(KEY,JSON.stringify(data));return}
    if(!isAdmin){alert("Login admin dulu untuk menyimpan.");return}
    const {error}=await sb.from('kairo_site').upsert({key:'site',value:data,updated_at:new Date().toISOString()});
    if(error)alert("Gagal menyimpan ke server: "+error.message);else remoteData=clone(data);
  }
  const url=s=>{try{let u=new URL(s,location.href);return ["http:","https:"].includes(u.protocol)?u.href:""}catch{return""}};
  function apply(){
    let c=data.content;
    $(".hero-subtitle").textContent=c.heroSubtitle;$(".hero-text").textContent=c.heroText;
    $(".about-copy .lead").innerHTML="<strong>Kamar Illiyyin Loro</strong> "+esc(c.aboutLead.replace(/^Kamar Illiyyin Loro\s*/i,""));
    $(".about-copy .lead + p").textContent=c.aboutBody;$(".quote-text").textContent=c.quoteText;
    $(".instagram strong").textContent=c.instagram.startsWith("@")?c.instagram:"@"+c.instagram;
    $(".instagram").href="https://instagram.com/"+c.instagram.replace(/^@/,"");
    $("#announcementText").textContent=c.announcement;$("#announcementBar").hidden=!c.announcement;
    $$(".trophy-grid .trophy[data-legacy]").forEach((card,i)=>{let x=data.achievements[i];if(!x)return;card.querySelector("h3").textContent=x[0];card.querySelector("p").textContent=x[1];card.querySelector("small").textContent=x[2]});
    $$(".gallery-grid .gallery-box").forEach((box,i)=>{let x=data.gallery[i];if(!x)return;box.querySelector("small").textContent=x[1];box.classList.toggle("has-image",!!x[0]);box.style.backgroundImage=x[0]?`url("${url(x[0])}")`:""});
  }
  function renderMembers(){$("#memberPreview").innerHTML=data.members.map(x=>`<span class="member-chip">👤 ${esc(x)}</span>`).join("")||"<span class='admin-muted'>Belum ada member.</span>"}
  $("#contentForm")?.addEventListener("submit",e=>{e.preventDefault();let f=e.target;data.content={heroSubtitle:f.heroSubtitle.value.trim(),heroText:f.heroText.value.trim(),aboutLead:f.aboutLead.value.trim(),aboutBody:f.aboutBody.value.trim(),quoteText:f.quoteText.value.trim(),instagram:f.instagram.value.trim(),announcement:f.announcement.value.trim()};persist();apply();alert("Konten tersimpan.")});
  $("#achievementForm")?.addEventListener("submit",e=>{e.preventDefault();let f=e.target;data.achievements=[1,2,3].map(i=>[f[`a${i}t`].value.trim(),f[`a${i}n`].value.trim(),f[`a${i}m`].value.trim()]);persist();apply();alert("Prestasi tersimpan.")});
  $("#galleryForm")?.addEventListener("submit",e=>{e.preventDefault();let f=e.target;data.gallery=[1,2,3,4].map(i=>[f[`g${i}u`].value.trim(),f[`g${i}c`].value.trim()]);persist();apply();alert("Gallery tersimpan.")});
  $("#memberForm")?.addEventListener("submit",e=>{e.preventDefault();data.members=e.target.members.value.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,100);persist();renderMembers();alert("Member tersimpan.")});
  $("#resetContentBtn")?.addEventListener("click",()=>{data.content=clone(defaults.content);persist();fill();apply()});
  $("#previewSiteBtn")?.addEventListener("click",()=>close($("#adminModal")));
  $("#exportDataBtn")?.addEventListener("click",()=>{let b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="kairo-admin-data.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)});
  // Living Story moderation — fully local, no server required.
  const LKEY="kairo_living_memory_v2";
  const lread=()=>{try{return JSON.parse(localStorage.getItem(LKEY)||"[]")}catch{return[]}};
  const lwrite=x=>localStorage.setItem(LKEY,JSON.stringify(x));
  const livingEsc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function renderLivingAdmin(){
    const all=window.KairoLiving?.read?.()||lread(),pub=all.filter(x=>x.status==='approved'),pending=all.filter(x=>x.status==='pending');
    $("#livingAdminTotal")&&( $("#livingAdminTotal").textContent=pub.length );
    $("#livingAdminPending")&&( $("#livingAdminPending").textContent=pending.length );
    $("#livingAdminEvents")&&( $("#livingAdminEvents").textContent=pub.filter(x=>x.type!=='moment').length );
    $("#livingAdminChapters")&&( $("#livingAdminChapters").textContent=(window.KairoLiving?.chapters?.(pub)||[]).length );
    const box=$("#livingAdminInbox"); if(!box)return;
    if(!all.length){box.innerHTML='<div class="admin-note">Belum ada memory masuk.</div>';return}
    box.innerHTML=all.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(x=>{const d=new Date(x.createdAt);return `<article class="living-admin-card ${x.status}"><div class="living-admin-meta"><span>${livingEsc((x.type||'moment').toUpperCase())} · ${livingEsc(x.status.toUpperCase())}</span><time>${d.toLocaleString('id-ID')}</time></div><h4>${livingEsc(x.title)}</h4><p>${livingEsc(x.story)}</p><div class="living-admin-meta" style="margin-top:10px"><span>✦ ${livingEsc(x.author)}</span><span>${livingEsc(x.chapter||'BELUM DIARSIPKAN')}</span></div>${x.status==='pending'?`<div class="living-admin-actions"><button class="ok" data-living-action="approved" data-id="${livingEsc(x.id)}">✓ ARCHIVE</button><button data-living-action="rejected" data-id="${livingEsc(x.id)}">× REJECT</button></div>`:''}</article>`}).join('');
    box.querySelectorAll('[data-living-action]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const r=await window.KairoLiving?.setStatus?.(btn.dataset.id,btn.dataset.livingAction);if(r&&!r.ok)alert('Gagal mengubah status: '+(r.error?.message||''));renderLivingAdmin();window.KairoWorld?.reload?.()}));
  }
  window.KairoLivingAdmin={render:renderLivingAdmin};
  $("#adminModal")?.addEventListener('click',e=>{if(e.target.matches('[data-tab="living"]'))renderLivingAdmin()});
    $("#resetAllBtn")?.addEventListener("click",()=>{if(confirm("Reset semua konten ke bawaan?")){localStorage.removeItem(KEY);data=clone(defaults);persist();apply();fill()}});
  $("#announcementClose")?.addEventListener("click",()=>$("#announcementBar").hidden=true);
  window.KairoAdminUI=ui;
  if(!sb)apply();
  ui();renderLivingAdmin();
  async function loadSite(){
    if(!sb)return;
    try{const {data:row}=await sb.from('kairo_site').select('value').eq('key','site').maybeSingle();if(row?.value)remoteData=row.value}catch{}
    data=load();apply();
  }
  (async()=>{
    if(!sb)return;
    await loadSite();
    try{const {data:s}=await sb.auth.getSession();if(s?.session)await checkAdmin(s.session.user.id)}catch{}
  })();
  window.addEventListener('kairo:auth',loadSite);
})();