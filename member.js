/* KAIRO STHANA — Akun member: gerbang situs, daftar dengan KODE PRIBADI dari admin, nama terkunci, panel undangan */
(() => {
  'use strict';
  const sb=window.KairoSB||null;
  const root=document.documentElement;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const M={user:null,profile:null,admin:false};window.KairoMember=M;
  if(!sb){root.classList.remove('kairo-locked');return} // tanpa Supabase: situs tidak dikunci, chat mode lokal
  const gate=$('#chatGate'),sgate=$('#gateBody'),form=$('#chatForm'),nameIn=$('#chatName'),msgs=$('#chatMessages');
  const NAME_RX=/^[A-Za-z0-9_. ]{3,20}$/,CODE_RX=/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/;
  const NAME_HINT='Nama 3-20 karakter: huruf, angka, spasi, titik, atau garis bawah.';
  const clean=s=>String(s||'').trim().replace(/\s+/g,' ');
  const phoneNorm=v=>{let p=String(v||'').replace(/[^0-9]/g,'');if(p.startsWith('0'))p='62'+p.slice(1);else if(p.startsWith('8'))p='62'+p;return p};
  const PHONE_RX=/^[0-9]{9,15}$/;
  const canon=v=>{const s=String(v||'').trim().toLowerCase(),h=s.replace(/[^0-9a-z]/g,'');return /^[0-9a-f]{12}$/.test(h)?h.replace(/(.{4})(.{4})(.{4})/,'$1-$2-$3'):s};
  const errText=e=>{
    const m=String(e?.message||e||'');
    if(e?.code==='23505'||/duplicate key/i.test(m))return /pkey/.test(m)?'Akun ini sudah punya nama.':'Nama itu sudah dipakai akun lain. Hubungi admin.';
    return m||'Terjadi kesalahan.';
  };
  const claimMsg=r=>({ok:'',kode_salah:'Kode salah. Salin persis dari pesan admin, atau minta admin kirim ulang.',terpakai:'Kode ini sudah dipakai akun lain. Hubungi admin.',terlalu_banyak:'Terlalu banyak percobaan. Tunggu 10 menit.',wa_wajib:'Nomor WA wajib diisi.',sudah_punya_akun:'Akun ini sudah punya nama.'}[r]??'Gagal mengaktifkan kode.');
  const authErr=e=>{
    const m=String(e?.message||'');
    if(/already registered/i.test(m))return 'Email ini sudah terdaftar. Coba Masuk (password = kode dari admin). Lupa? Minta admin kirim ulang kodenya.';
    if(/rate limit|too many/i.test(m))return 'Terlalu sering mencoba. Tunggu beberapa menit.';
    return 'Gagal mendaftar: '+m;
  };

  /* tombol lihat/sembunyikan password */
  const eye=input=>{
    try{
      if(!input||typeof document.createElement!=='function'||!input.insertAdjacentElement)return;
      const b=document.createElement('button');b.type='button';b.className='eye';b.textContent='Lihat';
      b.setAttribute('aria-label','Tampilkan atau sembunyikan isi kolom');
      b.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';b.textContent=show?'Sembunyi':'Lihat'});
      input.insertAdjacentElement('afterend',b);
    }catch{}
  };
  eye($('#authPassword'));

  /* ---------- modal masuk / daftar ---------- */
  function setMode(m){
    const reg=m==='register';
    $('#authForm').hidden=reg;$('#authSwitchLogin').hidden=reg;
    $('#regForm').hidden=!reg;$('#authSwitchReg').hidden=!reg;
  }
  function openAuth(m){const modal=$('#authModal');if(!modal)return;setMode(m);modal.hidden=false;document.body.style.overflow='hidden'}
  function closeAuth(){const modal=$('#authModal');if(modal)modal.hidden=true;if(root.classList.contains('kairo-locked')===false&&$('#adminModal')?.hidden!==false)document.body.style.overflow=''}
  $('#authOpenBtn')?.addEventListener('click',()=>setMode('login'));
  $('#authToReg')?.addEventListener('click',()=>setMode('register'));
  $('#authToLogin')?.addEventListener('click',()=>setMode('login'));
  $('#regForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const err=$('#regError'),email=$('#regEmail').value.trim(),code=canon($('#regCode').value),wa=phoneNorm($('#regWa').value);
    if(!CODE_RX.test(code)){err.textContent='Kode nggak valid. Salin persis dari pesan admin (contoh: a1b2-c3d4-e5f6).';return}
    if(!PHONE_RX.test(wa)){err.textContent='Isi nomor WA yang valid, contoh 081234567890.';return}
    err.textContent='Mendaftar…';
    try{
      const {data,error}=await sb.auth.signUp({email,password:code});
      if(error){err.textContent=authErr(error);return}
      if(!data?.session){err.textContent='Akun dibuat, tapi masih butuh konfirmasi email. Hubungi admin.';return}
      const {data:res,error:e2}=await sb.rpc('kairo_claim',{p_code:code,p_phone:wa});
      if(e2||res!=='ok'){
        try{await sb.rpc('kairo_cleanup')}catch{}
        await sb.auth.signOut();
        err.textContent=e2?errText(e2):claimMsg(res);return;
      }
      err.textContent='';e.target.reset();closeAuth();await refresh();
    }catch{err.textContent='Gagal terhubung. Coba lagi.'}
  });

  /* ---------- gerbang situs + gerbang chat ---------- */
  const gateHTML=where=>{
    if(!M.user)return `<p>${where==='site'?'Website ini khusus member Kamar Illiyyin Loro. Masuk atau daftar dulu buat membukanya.':'Circle Chat khusus member. Masuk atau daftar dulu buat baca dan ikut ngobrol.'}</p><div class="pg-btnrow"><button type="button" class="pg-btn" data-g="login">Masuk</button><button type="button" class="pg-btn" data-g="register">Daftar</button></div>`;
    if(!M.profile)return M.admin
      ?`<p>Pilih nama tampilan buat akun admin lu. Nama ini terkunci ke akun.</p><div class="gate-row"><input class="g-name" maxlength="20" placeholder="Nama tampilan" autocomplete="nickname"><button type="button" class="pg-btn" data-g="savename">Simpan</button></div><p class="admin-error" role="alert"></p><button type="button" class="linklike" data-g="out">Keluar</button>`
      :`<p>Akun ini belum aktif. Masukkan kode pribadi dari admin. Nama lu otomatis terisi dan terkunci.</p><div class="gate-row"><input class="g-code" placeholder="Kode dari admin" autocomplete="off"><input class="g-wa" type="tel" inputmode="tel" placeholder="Nomor WA lu" autocomplete="tel"><button type="button" class="pg-btn" data-g="claim">Aktifkan</button></div><p class="admin-error" role="alert"></p><button type="button" class="linklike" data-g="out">Keluar</button>`;
    return `<p>Akun <b>${esc(M.profile.display_name)}</b> sedang dinonaktifkan oleh admin. Hubungi admin kalau ini keliru.</p><div class="pg-btnrow"><button type="button" class="pg-btn" data-g="check">Cek lagi</button><button type="button" class="linklike" data-g="out">Keluar</button></div>`;
  };
  function render(ok){
    const unlocked=ok||M.admin;
    root.classList.toggle('kairo-locked',!unlocked);
    if(!unlocked&&sgate)sgate.innerHTML=gateHTML('site');
    const au=$('#memoryAuthor');if(au&&ok){au.value=M.profile.display_name;au.readOnly=true}
    if(!gate)return;
    if(ok){gate.hidden=true;if(form)form.hidden=false;if(nameIn){nameIn.value=M.profile.display_name;nameIn.readOnly=true;nameIn.title='Nama terkunci ke akun lu'}return}
    if(form)form.hidden=true;gate.hidden=false;
    if(msgs)msgs.innerHTML='<div class="chat-empty">Chat khusus member yang sudah aktif 🔒</div>';
    gate.innerHTML=gateHTML('chat');
  }
  async function onGate(e,box){
    const b=e.target.closest?.('[data-g]');if(!b)return;
    const g=b.dataset.g,er=$('.admin-error',box);
    if(g==='login')openAuth('login');
    else if(g==='register')openAuth('register');
    else if(g==='check')await refresh();
    else if(g==='out')$('#logoutBtn')?.click();
    else if(g==='claim'){
      const code=canon($('.g-code',box).value),wa=phoneNorm($('.g-wa',box).value);
      if(!CODE_RX.test(code)){er.textContent='Kode nggak valid. Salin persis dari pesan admin.';return}
      if(!PHONE_RX.test(wa)){er.textContent='Isi nomor WA yang valid, contoh 081234567890.';return}
      const {data:res,error}=await sb.rpc('kairo_claim',{p_code:code,p_phone:wa});
      if(error){er.textContent=errText(error);return}
      if(res!=='ok'){er.textContent=claimMsg(res);return}
      await refresh();
    }else if(g==='savename'){
      const name=clean($('.g-name',box).value);
      if(!NAME_RX.test(name)){er.textContent=NAME_HINT;return}
      const {error}=await sb.rpc('kairo_register',{p_name:name});
      if(error){er.textContent=errText(error);return}
      await refresh();
    }
  }
  [gate,sgate].forEach(c=>{
    if(!c)return;
    c.addEventListener('click',e=>onGate(e,c));
    c.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();onGate({target:{closest:()=>({dataset:{g:M.admin?'savename':'claim'}})}},c)}});
  });

  let lastKey='',running=false,again=false;
  async function doRefresh(){
    const {data}=await sb.auth.getSession();
    M.user=data?.session?.user||null;M.profile=null;M.admin=false;
    if(M.user){
      const [p,a]=await Promise.all([
        sb.from('kairo_profiles').select('display_name,approved').eq('user_id',M.user.id).maybeSingle(),
        sb.from('kairo_admins').select('user_id').eq('user_id',M.user.id).maybeSingle()
      ]);
      M.profile=p.data||null;M.admin=!!a.data;
    }
    const ok=!!M.profile?.approved,key=(M.user?.id||'-')+':'+ok+':'+M.admin;
    render(ok);
    if(key!==lastKey){
      lastKey=key;
      await window.KairoChatReload?.();render(ok);
      window.dispatchEvent(new Event('kairo:auth'));
    }
    window.KairoAdminUI?.();
  }
  async function refresh(){
    if(running){again=true;return}
    running=true;
    try{do{again=false;await doRefresh()}while(again)}
    catch{if(sgate&&root.classList.contains('kairo-locked'))sgate.innerHTML='<p>Gagal memeriksa akun. Periksa internet lu, lalu muat ulang halaman.</p>'}
    finally{running=false}
  }
  M.refresh=refresh;

  /* ---------- panel admin: undangan, akun, pesan ---------- */
  let built=false,invites=[];
  const aroot=$('#memberAdminRoot');
  const fmt=iso=>{try{return new Date(iso).toLocaleDateString('id-ID')}catch{return ''}};
  const siteUrl=()=>location.origin+location.pathname;
  const waText=i=>`Halo ${i.display_name}, ini kode akses pribadi lu buat website Kairo Sthana:\n\n${i.code}\n\nCara: buka ${siteUrl()} lalu klik Daftar. Isi email lu dan kode di atas. Nama lu otomatis terisi. Kode ini juga jadi password buat masuk lagi, jadi simpan baik-baik dan jangan dikasih ke orang lain.`;
  function buildAdmin(){
    if(built||!aroot)return;built=true;
    aroot.innerHTML=`<h4 class="pg-admin-h">Undangan member</h4>
<p class="admin-note">Tempel daftar temen, satu baris per orang: <b>Nama</b> saja, atau <b>Nama, Nomor WA</b> kalau lu punya. Sistem bikin kode unik buat tiap orang. Temen daftar pakai email, kode, dan nomor WA mereka sendiri. Nomor WA cuma bisa dilihat admin.</p>
<textarea id="invText" class="inv-text" rows="6" placeholder="Budi Santoso&#10;Siti Aminah, 085712345678"></textarea>
<div class="pg-btnrow"><button type="button" class="pg-btn" id="invCreate">Buat kode</button><button type="button" class="pg-btn small" id="invCsv">Unduh data (CSV)</button></div>
<p id="invMsg" class="admin-note" role="status"></p>
<div class="gate-row"><input id="invSearch" placeholder="Cari nama atau nomor…"></div>
<h4 class="pg-admin-h" id="invH">Daftar undangan</h4><div id="invList" class="ach-list"></div>
<h4 class="pg-admin-h" id="accActiveH">Akun aktif</h4><div id="accActive" class="ach-list"></div>
<h4 class="pg-admin-h" id="accBlockedH">Dinonaktifkan</h4><div id="accBlocked" class="ach-list"></div>
<h4 class="pg-admin-h">Pesan terakhir</h4><div id="accMsgs" class="ach-list"></div>`;
    $('#invCreate').addEventListener('click',createInvites);
    $('#invCsv').addEventListener('click',downloadCsv);
    $('#invSearch').addEventListener('input',renderInvites);
    aroot.addEventListener('click',adminAction);
  }
  async function createInvites(){
    const msg=$('#invMsg'),lines=$('#invText').value.split('\n').map(l=>l.trim()).filter(Boolean);
    if(!lines.length){msg.textContent='Isi daftar dulu.';return}
    const btn=$('#invCreate');btn.disabled=true;
    const jobs=[],failed=[];
    for(const l of lines){
      const parts=l.split(/[,;\t]/),name=clean(parts[0]),raw=parts.slice(1).join('').replace(/[^0-9]/g,''),phone=raw?phoneNorm(raw):'';
      if(!NAME_RX.test(name)){failed.push([l,'nama tidak valid ('+NAME_HINT+')']);continue}
      if(phone&&!PHONE_RX.test(phone)){failed.push([l,'nomor WA tidak valid (kosongkan kalau belum ada)']);continue}
      jobs.push({l,name,phone});
    }
    let done=0,okCount=0;
    const tick=()=>{msg.textContent=`Memproses ${done}/${jobs.length}…`};tick();
    const queue=jobs.slice();
    const worker=async()=>{while(queue.length){const j=queue.shift();
      const {error}=await sb.rpc('kairo_invite_create',{p_name:j.name,p_phone:j.phone||null});
      if(error)failed.push([j.l,errText(error).replace('Nama itu sudah dipakai akun lain. Hubungi admin.','nama sudah ada di daftar atau sudah dipakai akun lain')]);else okCount++;
      done++;tick()}};
    await Promise.all([worker(),worker(),worker()]);
    btn.disabled=false;
    $('#invText').value=failed.map(f=>f[0]).join('\n');
    msg.textContent=`Selesai: ${okCount} kode dibuat${failed.length?`, ${failed.length} gagal. Baris yang gagal dibiarkan di kolom: ${failed.slice(0,3).map(f=>f[0].split(/[,;\t]/)[0]+' ('+f[1]+')').join('; ')}`:'.'}`;
    await loadAdmin();
  }
  function renderInvites(){
    const q=($('#invSearch')?.value||'').toLowerCase().trim(),box=$('#invList');if(!box)return;
    const rows=invites.filter(i=>!q||i.display_name.toLowerCase().includes(q)||(i.phone||'').includes(q.replace(/[^0-9]/g,'')||'§'));
    const claimed=invites.filter(i=>i.user_id).length;
    $('#invH').textContent=`Daftar undangan (${invites.length}, ${claimed} sudah daftar)`;
    box.innerHTML=rows.length?rows.slice(0,60).map(i=>`<div class="ach-row inv-row" data-id="${esc(i.id)}"><div><b>${esc(i.display_name)}</b>${i.phone?esc(i.phone):'belum ada nomor'} · ${i.user_id?'sudah daftar':'belum daftar'}<br><code class="inv-code">${esc(i.code)}</code></div>${i.phone?'<button type="button" class="pg-btn small" data-act="wa">Kirim WA</button>':''}<button type="button" class="pg-btn small" data-act="msg">Salin pesan</button><button type="button" class="pg-btn small" data-act="copy">Salin kode</button><button type="button" class="pg-btn small" data-act="rot">Kode baru</button><button type="button" class="pg-btn small danger" data-act="delinv">Hapus</button></div>`).join('')+(rows.length>60?`<p class="admin-note">${rows.length-60} lainnya disembunyikan, pakai kolom cari.</p>`:''):'<p class="admin-note">Belum ada undangan.</p>';
  }
  function downloadCsv(){
    const q=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
    const csv='\ufeff'+['Nama,WA,Kode,Status,Dibuat'].concat(invites.map(i=>[i.display_name,i.phone||'',i.code,i.user_id?'sudah daftar':'belum daftar',fmt(i.created_at)].map(q).join(','))).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='undangan-kairo.csv';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),500);
  }
  async function loadAdmin(){
    const [iv,p,m]=await Promise.all([
      sb.from('kairo_invites').select('id,display_name,phone,code,user_id,created_at,claimed_at').order('created_at',{ascending:false}).limit(1000),
      sb.from('kairo_profiles').select('user_id,display_name,approved,created_at').order('created_at',{ascending:false}).limit(500),
      sb.from('kairo_messages').select('id,name,message,created_at').order('created_at',{ascending:false}).limit(30)
    ]);
    invites=iv.data||[];renderInvites();
    const rows=p.data||[],blocked=rows.filter(x=>!x.approved),act=rows.filter(x=>x.approved);
    const row=(x,btns)=>`<div class="ach-row" data-id="${esc(x.user_id)}"><div><b>${esc(x.display_name)}</b>daftar ${esc(fmt(x.created_at))}</div>${btns}</div>`;
    $('#accActiveH').textContent=`Akun aktif (${act.length})`;
    $('#accBlockedH').textContent=`Dinonaktifkan (${blocked.length})`;
    $('#accActive').innerHTML=act.length?act.slice(0,100).map(x=>row(x,'<button type="button" class="pg-btn small danger" data-act="block">Nonaktifkan</button>')).join(''):'<p class="admin-note">Belum ada akun aktif.</p>';
    $('#accBlocked').innerHTML=blocked.length?blocked.map(x=>row(x,'<button type="button" class="pg-btn small" data-act="ok">Aktifkan</button><button type="button" class="pg-btn small danger" data-act="del">Hapus</button>')).join(''):'<p class="admin-note">Tidak ada.</p>';
    $('#accMsgs').innerHTML=(m.data||[]).length?m.data.map(x=>`<div class="ach-row" data-id="${esc(x.id)}"><div><b>${esc(x.name)}</b>${esc(x.message)}</div><button type="button" class="pg-btn small danger" data-act="delmsg">Hapus</button></div>`).join(''):'<p class="admin-note">Belum ada pesan.</p>';
  }
  async function adminAction(e){
    const b=e.target.closest?.('[data-act]');if(!b)return;
    const id=b.closest('.ach-row')?.dataset.id;if(!id)return;
    const act=b.dataset.act,inv=invites.find(i=>i.id===id);
    if(act==='msg'&&inv){try{await navigator.clipboard.writeText(waText(inv));b.textContent='Tersalin'}catch{prompt('Salin pesan ini:',waText(inv))}return}
    if(act==='wa'&&inv&&inv.phone){window.open('https://wa.me/'+inv.phone+'?text='+encodeURIComponent(waText(inv)),'_blank','noopener');return}
    if(act==='copy'&&inv){try{await navigator.clipboard.writeText(inv.code);b.textContent='Tersalin'}catch{prompt('Salin kode ini:',inv.code)}return}
    let res;
    if(act==='rot'&&inv){
      if(!confirm(`Bikin kode baru buat ${inv.display_name}? Kode lama langsung nggak berlaku${inv.user_id?', dan password akunnya ikut berganti':''}. Kirim kode barunya lewat WA.`))return;
      const {error}=await sb.rpc('kairo_invite_rotate',{p_id:id});
      if(error){alert('Gagal: '+errText(error));return}
      await loadAdmin();return;
    }
    if(act==='delinv'){if(!confirm('Hapus undangan ini? Kalau belum daftar, kodenya hangus. Akun yang sudah jadi tetap ada.'))return;res=await sb.from('kairo_invites').delete({count:'exact'}).eq('id',id)}
    else if(act==='ok')res=await sb.from('kairo_profiles').update({approved:true},{count:'exact'}).eq('user_id',id);
    else if(act==='block'){if(!confirm('Nonaktifkan akun ini? Dia nggak bisa membuka website sampai lu aktifkan lagi.'))return;res=await sb.from('kairo_profiles').update({approved:false},{count:'exact'}).eq('user_id',id)}
    else if(act==='del'){if(!confirm('Hapus akun ini? Namanya kebebas.'))return;res=await sb.from('kairo_profiles').delete({count:'exact'}).eq('user_id',id)}
    else if(act==='delmsg'){if(!confirm('Hapus pesan ini?'))return;res=await sb.from('kairo_messages').delete({count:'exact'}).eq('id',id)}
    else return;
    if(res.error||!res.count){alert('Gagal. Pastikan lu login sebagai admin.');return}
    await loadAdmin();
  }
  $('.admin-tab[data-tab="accounts"]')?.addEventListener('click',()=>{buildAdmin();loadAdmin()});

  sb.auth.onAuthStateChange(()=>setTimeout(refresh,0));
  refresh();
})();
