/* KAIRO STHANA — Galeri Foto (Supabase Storage): tampilan publik + upload massal untuk admin */
(() => {
  'use strict';
  const sb=window.KairoSB||null;
  const BUCKET='kairo-gallery',PAGE=24;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KP={};window.KairoPhotos=KP;
  const wrap=$('#photoGallery'),adminRoot=$('#photoAdminRoot');
  if(!sb){if(adminRoot)adminRoot.innerHTML='<p class="admin-note">Supabase belum tersambung, galeri foto belum aktif.</p>';return}
  const pubUrl=p=>sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
  const labelOf=x=>x.caption||x.album;
  const slug=a=>a.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'umum';
  const cols='id,album,caption,path,thumb_path,width,height';

  /* ---------- kompres di browser ---------- */
  KP.makeVariants=async file=>{
    let bmp;try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch{bmp=await createImageBitmap(file)}
    const draw=async(max,q)=>{
      const s=Math.min(1,max/Math.max(bmp.width,bmp.height)),w=Math.max(1,Math.round(bmp.width*s)),h=Math.max(1,Math.round(bmp.height*s));
      const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(bmp,0,0,w,h);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',q));c.width=0;
      if(!blob)throw new Error('gagal memproses gambar');return{blob,w,h};
    };
    try{const full=await draw(1600,.82),thumb=await draw(480,.72);return{full:full.blob,thumb:thumb.blob,w:full.w,h:full.h}}
    finally{bmp.close?.()}
  };

  /* ---------- tampilan publik ---------- */
  const S={album:null,items:[],done:false,loading:false,albums:[]};
  const msg=t=>{const m=$('#pgMsg');if(m)m.textContent=t||''};
  function renderAlbums(){
    const total=S.albums.reduce((a,x)=>a+Number(x.total),0);
    if(wrap)wrap.hidden=total===0;
    const box=$('#pgAlbums');
    if(box)box.innerHTML=`<button type="button" class="pg-chip ${S.album?'':'on'}" data-album="">Semua <small>${total}</small></button>`+S.albums.map(a=>`<button type="button" class="pg-chip ${S.album===a.album?'on':''}" data-album="${esc(a.album)}">${esc(a.album)} <small>${a.total}</small></button>`).join('');
    const dl=$('#pgAlbumList');if(dl)dl.innerHTML=S.albums.map(a=>`<option value="${esc(a.album)}">`).join('');
    const sel=$('#pgAdminAlbum');if(sel)sel.innerHTML='<option value="">Semua album</option>'+S.albums.map(a=>`<option value="${esc(a.album)}" ${A.album===a.album?'selected':''}>${esc(a.album)} (${a.total})</option>`).join('');
  }
  async function loadAlbums(){const {data,error}=await sb.rpc('kairo_albums');if(!error&&data){S.albums=data;renderAlbums()}}
  function appendGrid(rows,startAt){
    const g=$('#pgGrid');if(!g)return;
    g.insertAdjacentHTML('beforeend',rows.map((x,i)=>`<button type="button" class="pg-item" data-i="${startAt+i}" aria-label="Buka foto: ${esc(labelOf(x))}"><img src="${esc(pubUrl(x.thumb_path))}" alt="${esc(labelOf(x))}" loading="lazy" decoding="async"></button>`).join(''));
  }
  async function loadMore(){
    if(S.loading||S.done)return;S.loading=true;
    let q=sb.from('kairo_photos').select(cols).order('created_at',{ascending:false}).order('id').range(S.items.length,S.items.length+PAGE-1);
    if(S.album)q=q.eq('album',S.album);
    const {data,error}=await q;S.loading=false;
    if(error||!data){msg('Foto belum bisa dimuat. Coba lagi nanti.');return}
    const start=S.items.length;S.items.push(...data);if(data.length<PAGE)S.done=true;
    appendGrid(data,start);
    msg(S.items.length===0?'Belum ada foto di album ini.':'');
    const more=$('#pgMore');if(more)more.hidden=S.done;
  }
  function resetPublic(){S.items=[];S.done=false;const g=$('#pgGrid');if(g)g.innerHTML='';renderAlbums();return loadMore()}
  $('#pgAlbums')?.addEventListener('click',e=>{const b=e.target.closest?.('.pg-chip');if(!b)return;S.album=b.dataset.album||null;resetPublic()});
  $('#pgMore')?.addEventListener('click',loadMore);
  $('#pgGrid')?.addEventListener('click',e=>{const b=e.target.closest?.('.pg-item');if(b)show(Number(b.dataset.i),b)});

  /* ---------- lightbox ---------- */
  const lb=document.createElement('div');lb.id='pgLightbox';lb.hidden=true;lb.setAttribute('role','dialog');lb.setAttribute('aria-modal','true');lb.setAttribute('aria-label','Penampil foto');
  lb.innerHTML='<button type="button" class="pg-lb-close" aria-label="Tutup">✕</button><button type="button" class="pg-lb-nav prev" aria-label="Foto sebelumnya">‹</button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="pg-lb-nav next" aria-label="Foto berikutnya">›</button>';
  document.body.appendChild(lb);
  let cur=0,opener=null;
  function show(i,from){
    if(!S.items.length)return;if(from)opener=from;
    cur=(i+S.items.length)%S.items.length;const x=S.items[cur];
    const img=$('img',lb);img.src=pubUrl(x.path);img.alt=labelOf(x);
    $('figcaption',lb).textContent=[x.album,x.caption].filter(Boolean).join(' · ');
    if(lb.hidden){lb.hidden=false;document.body.style.overflow='hidden';$('.pg-lb-close',lb)?.focus()}
  }
  function hide(){lb.hidden=true;document.body.style.overflow='';opener?.focus?.()}
  lb.addEventListener('click',e=>{
    if(e.target===lb||e.target.closest?.('.pg-lb-close'))return hide();
    if(e.target.closest?.('.prev'))return show(cur-1);
    if(e.target.closest?.('.next'))return show(cur+1);
  });
  document.addEventListener('keydown',e=>{
    if(lb.hidden)return;
    if(e.key==='Escape')hide();else if(e.key==='ArrowLeft')show(cur-1);else if(e.key==='ArrowRight')show(cur+1);
  });

  /* ---------- panel admin ---------- */
  const A={album:null,items:[],done:false,loading:false};
  let built=false;
  function build(){
    if(built||!adminRoot)return;built=true;
    adminRoot.innerHTML=`<p class="admin-note">Upload banyak foto sekaligus. Foto dikecilkan otomatis sebelum diunggah. Format JPG, PNG, atau WebP. Foto HEIC dari iPhone belum didukung, ubah ke JPG dulu. Upload paling nyaman per 50 foto.</p>
<div class="admin-stack-form">
<label>Album<input id="pgAlbumInput" list="pgAlbumList" maxlength="40" placeholder="Contoh: Lomba 2026"><datalist id="pgAlbumList"></datalist></label>
<label>Keterangan (opsional, dipakai untuk semua foto di batch ini)<input id="pgCaptionInput" maxlength="120"></label>
<label>Pilih foto<input id="pgFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
<button type="button" id="pgUploadBtn" class="pg-btn">Upload foto</button>
<div class="pg-progress" id="pgProgress" hidden><div id="pgBar"></div></div>
<p id="pgUpStatus" class="admin-note" role="status"></p>
</div>
<h4 class="pg-admin-h">Foto yang sudah ada</h4>
<label class="pg-admin-filter">Tampilkan album<select id="pgAdminAlbum"></select></label>
<div id="pgAdminGrid" class="pg-admin-grid"></div>
<p id="pgAdminMsg" class="admin-note"></p>
<button type="button" id="pgAdminMore" class="pg-btn" hidden>Muat lebih banyak</button>`;
    $('#pgUploadBtn').addEventListener('click',upload);
    $('#pgAdminAlbum').addEventListener('change',e=>{A.album=e.target.value||null;resetAdmin()});
    $('#pgAdminMore').addEventListener('click',adminMore);
    $('#pgAdminGrid').addEventListener('click',adminAction);
    renderAlbums();
  }
  const adminMsg=t=>{const m=$('#pgAdminMsg');if(m)m.textContent=t||''};
  async function adminMore(){
    if(A.loading||A.done)return;A.loading=true;
    let q=sb.from('kairo_photos').select(cols).order('created_at',{ascending:false}).order('id').range(A.items.length,A.items.length+PAGE-1);
    if(A.album)q=q.eq('album',A.album);
    const {data,error}=await q;A.loading=false;
    if(error||!data){adminMsg('Gagal memuat foto.');return}
    A.items.push(...data);if(data.length<PAGE)A.done=true;
    $('#pgAdminGrid').insertAdjacentHTML('beforeend',data.map(x=>`<figure class="pg-acard" data-id="${esc(x.id)}"><img src="${esc(pubUrl(x.thumb_path))}" alt="${esc(labelOf(x))}" loading="lazy"><figcaption><b>${esc(x.album)}</b>${x.caption?`<span>${esc(x.caption)}</span>`:''}</figcaption><div class="pg-acard-btns"><button type="button" class="pg-btn small" data-act="move">Pindah album</button><button type="button" class="pg-btn small danger" data-act="del">Hapus</button></div></figure>`).join(''));
    adminMsg(A.items.length?'':'Belum ada foto.');
    $('#pgAdminMore').hidden=A.done;
  }
  function resetAdmin(){A.items=[];A.done=false;const g=$('#pgAdminGrid');if(g)g.innerHTML='';return adminMore()}
  async function refreshAll(){await loadAlbums();await resetPublic();if(built)await resetAdmin()}
  async function adminAction(e){
    const btn=e.target.closest?.('[data-act]');if(!btn)return;
    const card=btn.closest('.pg-acard'),x=A.items.find(i=>i.id===card.dataset.id);if(!x)return;
    if(btn.dataset.act==='del'){
      if(!confirm('Hapus foto ini dari galeri?'))return;
      const {error,count}=await sb.from('kairo_photos').delete({count:'exact'}).eq('id',x.id);
      if(error||!count){alert('Gagal menghapus. Pastikan lu login sebagai admin.');return}
      await sb.storage.from(BUCKET).remove([x.path,x.thumb_path]);
    }else{
      const to=(prompt('Pindah ke album apa?',x.album)||'').trim().replace(/\s+/g,' ').slice(0,40);
      if(!to||to===x.album)return;
      const {error,count}=await sb.from('kairo_photos').update({album:to},{count:'exact'}).eq('id',x.id);
      if(error||!count){alert('Gagal memindahkan. Pastikan lu login sebagai admin.');return}
    }
    await refreshAll();
  }

  /* ---------- upload massal ---------- */
  async function uploadOne(file,album,caption){
    const v=await KP.makeVariants(file),id=crypto.randomUUID(),dir=slug(album);
    const path=`${dir}/${id}.jpg`,tpath=`${dir}/${id}-t.jpg`,st=sb.storage.from(BUCKET),opt={contentType:'image/jpeg',cacheControl:'31536000'};
    let r=await st.upload(path,v.full,opt);if(r.error)throw r.error;
    r=await st.upload(tpath,v.thumb,opt);if(r.error){await st.remove([path]);throw r.error}
    const ins=await sb.from('kairo_photos').insert({album,caption:caption||null,path,thumb_path:tpath,width:v.w,height:v.h});
    if(ins.error){await st.remove([path,tpath]);throw ins.error}
  }
  async function upload(){
    const status=t=>{$('#pgUpStatus').textContent=t};
    const album=$('#pgAlbumInput').value.trim().replace(/\s+/g,' ').slice(0,40),caption=$('#pgCaptionInput').value.trim().slice(0,120);
    const all=[...($('#pgFiles').files||[])];
    if(!album){status('Isi nama album dulu.');return}
    if(!all.length){status('Pilih foto dulu.');return}
    const {data:s}=await sb.auth.getSession();if(!s?.session){status('Login admin dulu.');return}
    const files=all.filter(f=>/^image\/(jpeg|png|webp)$/.test(f.type)),skipped=all.length-files.length;
    if(!files.length){status('Format foto tidak didukung. Pakai JPG, PNG, atau WebP.');return}
    const btn=$('#pgUploadBtn'),bar=$('#pgBar'),prog=$('#pgProgress');
    btn.disabled=true;prog.hidden=false;
    const queue=files.slice(),fails=[];let done=0;
    const tick=()=>{bar.style.width=Math.round(done/files.length*100)+'%';status(`Mengunggah ${done}/${files.length}…`)};
    tick();
    const worker=async()=>{while(queue.length){const f=queue.shift();try{await uploadOne(f,album,caption)}catch(err){fails.push(`${f.name}: ${err?.message||err}`)}done++;tick()}};
    await Promise.all([worker(),worker(),worker()]);
    btn.disabled=false;
    status(`Selesai: ${files.length-fails.length} foto terunggah${fails.length?`, ${fails.length} gagal (${fails.slice(0,2).join('; ')})`:''}${skipped?`, ${skipped} dilewati karena formatnya tidak didukung`:''}.`);
    $('#pgFiles').value='';
    await refreshAll();
  }

  $('.admin-tab[data-tab="photos"]')?.addEventListener('click',()=>{build();resetAdmin()});
  sb.auth.onAuthStateChange?.(()=>{});
  loadAlbums().then(()=>{if(!wrap?.hidden)loadMore()});
})();
