/* KAIRO STHANA — Prestasi (Supabase): daftar publik + tambah/ubah/hapus untuk admin */
(() => {
  'use strict';
  const sb=window.KairoSB||null;
  const BUCKET='kairo-gallery',SHOW=9;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const grid=$('#achGrid'),root=$('#achAdminRoot');
  const API={};window.KairoAch=API;
  if(!sb){
    if(root)root.innerHTML='<p class="admin-note">Supabase belum tersambung, prestasi belum aktif.</p>';
    if(grid)grid.innerHTML='<p class="section-note">Data prestasi belum bisa dimuat.</p>';
    return;
  }
  const st=()=>sb.storage.from(BUCKET);
  const photoUrl=p=>st().getPublicUrl(p).data.publicUrl;
  const icon=t=>/juara\s*1\b|pertama/i.test(t)?'🥇':/juara\s*2\b|kedua/i.test(t)?'🥈':/juara\s*3\b|ketiga/i.test(t)?'🥉':/finalis|harapan/i.test(t)?'🏅':'🏆';
  const cols='id,title,event,note,year,photo_path,created_at';
  let items=[],showAll=false,editing=null,built=false;

  API.shrink=async file=>{
    let bmp;try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch{bmp=await createImageBitmap(file)}
    try{
      const s=Math.min(1,900/Math.max(bmp.width,bmp.height)),w=Math.max(1,Math.round(bmp.width*s)),h=Math.max(1,Math.round(bmp.height*s));
      const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(bmp,0,0,w,h);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.8));c.width=0;
      if(!blob)throw new Error('gagal memproses gambar');return blob;
    }finally{bmp.close?.()}
  };

  /* ---------- publik ---------- */
  const card=(x,i)=>{
    const meta=[x.year,x.note].filter(Boolean).join(' · ');
    const media=x.photo_path?`<img class="ach-photo" src="${esc(photoUrl(x.photo_path))}" alt="${esc(x.event)}" loading="lazy" decoding="async">`:`<div class="trophy-icon">${icon(x.title)}</div>`;
    return `<article class="trophy ach-card${i===0?' featured':''}"><span class="number">${String(i+1).padStart(2,'0')}</span>${media}<h3>${esc(x.title)}</h3><p>${esc(x.event)}</p>${meta?`<small>${esc(meta)}</small>`:''}</article>`;
  };
  function renderPublic(){
    if(!grid)return;
    const empty=$('#achEmpty'),more=$('#achMore');
    grid.innerHTML=(showAll?items:items.slice(0,SHOW)).map(card).join('');
    if(empty)empty.hidden=items.length>0;
    if(more){more.hidden=showAll||items.length<=SHOW;more.textContent=`Lihat semua (${items.length})`}
  }
  $('#achMore')?.addEventListener('click',()=>{showAll=true;renderPublic()});

  async function load(){
    const {data,error}=await sb.from('kairo_achievements').select(cols).order('year',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false});
    if(error||!data){if(grid&&!items.length)grid.innerHTML='<p class="section-note">Prestasi belum bisa dimuat.</p>';return}
    items=data;renderPublic();renderList();
  }

  /* ---------- admin ---------- */
  const status=t=>{const s=$('#achStatus');if(s)s.textContent=t||''};
  function build(){
    if(built||!root)return;built=true;
    root.innerHTML=`<p class="admin-note">Tambah prestasi satu per satu. Foto boleh dikosongkan, nanti tampil ikon piala. Daftar diurutkan dari tahun terbaru.</p>
<div class="admin-stack-form">
<label>Judul<input id="achTitle" maxlength="60" placeholder="Contoh: Juara 1"></label>
<label>Nama lomba<input id="achEvent" maxlength="120" placeholder="Contoh: Lomba Pidato Antar Pondok"></label>
<label>Tahun<input id="achYear" type="number" min="1990" max="2100" placeholder="2026"></label>
<label>Keterangan (opsional)<input id="achNote" maxlength="160" placeholder="Contoh: Tingkat Kabupaten"></label>
<label>Foto (opsional)<input id="achPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label>
<label id="achRmWrap" hidden><span><input id="achRm" type="checkbox"> Hapus foto yang sekarang</span></label>
<div class="pg-btnrow"><button type="button" id="achSave" class="pg-btn">Tambah prestasi</button><button type="button" id="achCancel" class="pg-btn danger" hidden>Batal</button></div>
<p id="achStatus" class="admin-note" role="status"></p>
</div>
<h4 class="pg-admin-h">Daftar prestasi</h4>
<div id="achList" class="ach-list"></div>`;
    $('#achSave').addEventListener('click',save);
    $('#achCancel').addEventListener('click',resetForm);
    $('#achList').addEventListener('click',listAction);
    renderList();
  }
  function renderList(){
    const box=$('#achList');if(!box)return;
    box.innerHTML=items.length?items.map(x=>`<div class="ach-row" data-id="${esc(x.id)}">${x.photo_path?`<img src="${esc(photoUrl(x.photo_path))}" alt="" loading="lazy">`:`<span class="ach-ico">${icon(x.title)}</span>`}<div><b>${esc(x.title)}</b>${esc(x.event)}${x.year?` · ${x.year}`:''}</div><button type="button" class="pg-btn small" data-act="edit">Ubah</button><button type="button" class="pg-btn small danger" data-act="del">Hapus</button></div>`).join(''):'<p class="admin-note">Belum ada prestasi.</p>';
  }
  function resetForm(){
    editing=null;
    ['#achTitle','#achEvent','#achYear','#achNote'].forEach(s=>{$(s).value=''});
    $('#achPhoto').value='';$('#achRm').checked=false;$('#achRmWrap').hidden=true;
    $('#achSave').textContent='Tambah prestasi';$('#achCancel').hidden=true;
  }
  async function listAction(e){
    const b=e.target.closest?.('[data-act]');if(!b)return;
    const row=b.closest('.ach-row'),x=items.find(i=>i.id===row.dataset.id);if(!x)return;
    if(b.dataset.act==='edit'){
      editing=x.id;
      $('#achTitle').value=x.title;$('#achEvent').value=x.event;$('#achYear').value=x.year??'';$('#achNote').value=x.note??'';
      $('#achPhoto').value='';$('#achRm').checked=false;$('#achRmWrap').hidden=!x.photo_path;
      $('#achSave').textContent='Simpan perubahan';$('#achCancel').hidden=false;status('Mengubah: '+x.title);
      $('#achTitle').focus?.();return;
    }
    if(!confirm(`Hapus prestasi "${x.title}"?`))return;
    const {error,count}=await sb.from('kairo_achievements').delete({count:'exact'}).eq('id',x.id);
    if(error||!count){alert('Gagal menghapus. Pastikan lu login sebagai admin.');return}
    if(x.photo_path)await st().remove([x.photo_path]);
    if(editing===x.id)resetForm();
    await load();
  }
  async function save(){
    const title=$('#achTitle').value.trim(),event=$('#achEvent').value.trim(),note=$('#achNote').value.trim();
    const year=$('#achYear').value?Number($('#achYear').value):null,file=$('#achPhoto').files?.[0];
    if(!title||!event){status('Judul dan nama lomba wajib diisi.');return}
    if(year!==null&&(!Number.isInteger(year)||year<1990||year>2100)){status('Tahun tidak valid.');return}
    if(file&&!/^image\/(jpeg|png|webp)$/.test(file.type)){status('Foto harus JPG, PNG, atau WebP.');return}
    const {data:s}=await sb.auth.getSession();if(!s?.session){status('Login admin dulu.');return}
    const btn=$('#achSave');btn.disabled=true;status('Menyimpan…');
    let newPath=null,committed=false;
    try{
      if(file){
        const blob=await API.shrink(file);newPath=`prestasi/${crypto.randomUUID()}.jpg`;
        const r=await st().upload(newPath,blob,{contentType:'image/jpeg',cacheControl:'31536000'});if(r.error)throw r.error;
      }
      const row={title,event,note:note||null,year},oldPath=editing?items.find(i=>i.id===editing)?.photo_path:null;
      if(newPath)row.photo_path=newPath;else if(editing&&$('#achRm').checked)row.photo_path=null;
      let res;
      if(editing){res=await sb.from('kairo_achievements').update(row,{count:'exact'}).eq('id',editing);if(!res.error&&!res.count)throw new Error('tidak ada yang berubah, pastikan lu login sebagai admin')}
      else res=await sb.from('kairo_achievements').insert(row);
      if(res.error)throw res.error;
      committed=true;
      if(oldPath&&(newPath||row.photo_path===null))await st().remove([oldPath]);
      resetForm();status('Tersimpan.');await load();
    }catch(err){
      if(newPath&&!committed)await st().remove([newPath]);
      status('Gagal: '+(err?.message||err));
    }finally{btn.disabled=false}
  }

  $('.admin-tab[data-tab="achievements"]')?.addEventListener('click',()=>{build();renderList()});
  window.addEventListener('kairo:auth',()=>{showAll=false;load()});
  load();
})();
