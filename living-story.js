/* KAIRO STHANA — Living Story (Supabase bersama + cadangan lokal jika Supabase belum tersambung) */
(() => {
  'use strict';
  const KEY='kairo_living_memory_v2';
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cfg=window.KAIRO_SUPABASE||{};
  const configured=!!(cfg.url&&cfg.anonKey&&!/YOUR[-_]/i.test(cfg.url+cfg.anonKey)&&window.supabase?.createClient);
  const sb=configured?(window.KairoSB||(window.KairoSB=window.supabase.createClient(cfg.url,cfg.anonKey))):null;
  let cache=[];
  const lread=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
  const lwrite=x=>localStorage.setItem(KEY,JSON.stringify(x));
  const read=()=>sb?cache:lread();
  const write=x=>{if(!sb)lwrite(x)};
  const approved=()=>read().filter(x=>x.status==='approved');
  const fromRow=r=>({id:r.id,author:r.author,type:r.type,title:r.title,story:r.story,status:r.status,chapter:r.chapter,createdAt:r.created_at});
  const chapters=items=>{const groups={};items.forEach(x=>{const d=new Date(x.createdAt);const key=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;(groups[key]??=[]).push(x)});return Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).map(([key,arr],i)=>{const [y,m]=key.split('-').map(Number);const period=new Date(Date.UTC(y,m-1,1)).toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'});const moments=arr.filter(x=>x.type==='moment').length,events=arr.filter(x=>x.type==='event').length,milestones=arr.filter(x=>x.type==='milestone').length;return{id:key,title:i===0?'THE CURRENT CHAPTER':`THE ${new Date(Date.UTC(y,m-1,1)).toLocaleDateString('en-US',{month:'long',timeZone:'UTC'}).toUpperCase()} CHRONICLE`,period,count:arr.length,moments,events,milestones,narrative:`Bab ini terbentuk dari ${arr.length} memory nyata yang dicatat penghuni pada ${period}. KAIRO menyimpan kejadian sebagaimana dikirim dan divalidasi, tanpa menambahkan kejadian fiktif.`}})};
  function render(){const ms=read(),pub=ms.filter(x=>x.status==='approved').sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)),ch=chapters(pub);$('#memoryCount').textContent=pub.length;$('#eventCount').textContent=pub.filter(x=>x.type!=='moment').length;$('#chapterCount').textContent=ch.length;const feed=$('#chronicleFeed');if(!pub.length){feed.innerHTML='<div class="chronicle-empty">Belum ada memory publik. KAIRO sedang menunggu cerita pertama.</div>';return}const c=ch[0];const intro=`<article class="chronicle-chapter"><div class="chronicle-chapter-kicker">CURRENT CHAPTER · ${esc(c.period)}</div><h3>${esc(c.title)}</h3><p>${esc(c.narrative)}</p><div class="chronicle-chapter-stats"><span>${c.count} memories</span><span>${c.events} events</span><span>${c.milestones} milestones</span></div></article>`;feed.innerHTML=intro+pub.map(x=>{const d=new Date(x.createdAt);return `<article class="chronicle-card"><div class="chronicle-meta"><span>${esc((x.type||'moment').toUpperCase())}</span><time>${d.toLocaleDateString('id-ID')} · ${d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</time></div><h3>${esc(x.title)}</h3><p>${esc(x.story)}</p><footer><span>✦ ${esc(x.author)}</span><span>${esc(x.chapter||'KAIRO MEMORY')}</span></footer></article>`}).join('')}
  async function load(){
    if(!sb){render();return}
    try{
      const {data,error}=await sb.from('kairo_memories').select('id,author,type,title,story,status,chapter,created_at').order('created_at',{ascending:false}).limit(200);
      if(!error&&data)cache=data.map(fromRow);
    }catch{}
    render();window.KairoWorld?.reload?.();window.KairoLivingAdmin?.render?.();
  }
  const chapterOf=id=>{const it=read().find(x=>x.id===id);if(!it)return null;return `${new Date(it.createdAt).toLocaleDateString('en-US',{month:'long'})} CHRONICLE`};
  async function setStatus(id,status){
    const chapter=status==='approved'?chapterOf(id):null;
    if(!sb){const arr=lread(),it=arr.find(x=>x.id===id);if(!it)return{ok:false,error:{message:'Memory tidak ditemukan'}};it.status=status;if(chapter)it.chapter=chapter;lwrite(arr);render();window.KairoWorld?.reload?.();return{ok:true}}
    const {error}=await sb.from('kairo_memories').update({status,chapter}).eq('id',id);
    if(error)return{ok:false,error};
    await load();return{ok:true};
  }
  const say=(a,b)=>{const s=$('#livingStatus'),h=$('#livingStatusHint');if(s)s.textContent=a;if(h)h.textContent=b};
  async function submit(e){
    e.preventDefault();
    const form=e.target,btn=form.querySelector?.('button');
    if(Date.now()-Number(localStorage.getItem('kairo_memory_last')||0)<30000){say('TUNGGU SEBENTAR','Tunggu 30 detik sebelum mengirim cerita lagi.');return}
    const item={author:$('#memoryAuthor').value.trim(),type:$('#memoryType').value,title:$('#memoryTitle').value.trim(),story:$('#memoryStory').value.trim()};
    if(!item.author||!item.title||!item.story)return;
    if(btn)btn.disabled=true;
    try{
      if(sb){const {error}=await sb.from('kairo_memories').insert(item);if(error)throw error}
      else{const arr=lread();arr.push({...item,id:crypto.randomUUID?.()||`local-${Date.now()}`,status:'pending',createdAt:new Date().toISOString()});lwrite(arr)}
      localStorage.setItem('kairo_memory_last',String(Date.now()));
      form.reset();
      say('MEMORY RECEIVED',sb?'Cerita masuk antrean admin dan tampil setelah disetujui.':'Moment masuk ke inbox admin di browser ini.');
      if(sb)await load();else{render();window.KairoLivingAdmin?.render?.()}
    }catch{say('GAGAL MENGIRIM','Cerita belum terkirim. Coba lagi sebentar lagi.')}
    finally{if(btn)btn.disabled=false}
  }
  window.KairoLiving={reload:load,render,read,write,KEY,chapters,approved,setStatus,remote:!!sb};
  $('#memoryForm')?.addEventListener('submit',submit);
  sb?.auth?.onAuthStateChange?.(()=>setTimeout(load,0));
  window.addEventListener('kairo:auth',()=>load());
  load();setInterval(load,sb?20000:5000);
})();
