/* KAIRO STHANA — Akun member: gerbang situs, daftar/masuk, nama terkunci ke akun, persetujuan admin, moderasi */
(() => {
  'use strict';
  const sb=window.KairoSB||null;
  const root=document.documentElement;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const M={user:null,profile:null,admin:false};window.KairoMember=M;
  if(!sb){root.classList.remove('kairo-locked');return} // tanpa Supabase: situs tidak dikunci, chat mode lokal
  const gate=$('#chatGate'),sgate=$('#gateBody'),form=$('#chatForm'),nameIn=$('#chatName'),msgs=$('#chatMessages');
  const NAME_RX=/^[A-Za-z0-9_. ]{3,20}$/;
  const NAME_HINT='Nama 3-20 karakter: huruf, angka, spasi, titik, atau garis bawah.';
  const clean=s=>String(s||'').trim().replace(/\s+/g,' ');
  const errText=e=>{
    const m=String(e?.message||e||'');
    if(e?.code==='23505'||/duplicate key/i.test(m))return /pkey/.test(m)?'Akun ini sudah punya nama.':'Nama itu sudah dipakai, pilih yang lain.';
    return m||'Terjadi kesalahan.';
  };
  const codeMsg=r=>({ok:'',kode_salah:'Kode akses salah.',terlalu_banyak:'Terlalu banyak percobaan. Tunggu 10 menit.',kode_belum_diatur:'Kode akses belum diatur admin.'}[r]??'Gagal mendaftarkan nama.');
  const authErr=e=>{
    const m=String(e?.message||'');
    if(/already registered/i.test(m))return 'Email ini sudah terdaftar. Coba masuk.';
    if(/rate limit|too many/i.test(m))return 'Terlalu sering mencoba. Tunggu beberapa menit.';
    if(/password/i.test(m))return 'Password terlalu lemah. Pakai minimal 8 karakter.';
    return 'Gagal mendaftar: '+m;
  };

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
    const err=$('#regError'),email=$('#regEmail').value.trim(),pw=$('#regPassword').value,name=clean($('#regName').value),code=$('#regCode').value.trim();
    if(!NAME_RX.test(name)){err.textContent=NAME_HINT;return}
    if(pw.length<8){err.textContent='Password minimal 8 karakter.';return}
    err.textContent='Mendaftar…';
    try{
      const {data,error}=await sb.auth.signUp({email,password:pw});
      if(error){err.textContent=authErr(error);return}

      // Dengan Confirm Email OFF, signup biasanya langsung memberi session.
      // Jika provider tidak mengembalikannya, coba login sekali memakai kredensial
      // yang baru saja didaftarkan sebelum memanggil RPC yang membutuhkan auth.uid().
      let session=data?.session||null;
      if(!session){
        const {data:loginData,error:loginError}=await sb.auth.signInWithPassword({email,password:pw});
        session=loginData?.session||null;
        if(loginError||!session){
          err.textContent='Akun berhasil dibuat, tetapi sesi login belum aktif. Pastikan Confirm Email sudah OFF dan tersimpan. Coba masuk lewat tab Masuk; jika email masih meminta verifikasi, periksa pengaturan Email Supabase.';
          setMode('login');
          return;
        }
      }

      const {data:res,error:e2}=await sb.rpc('kairo_register',{p_name:name,p_code:code});
      const problem=e2?errText(e2):codeMsg(res);
      err.textContent='';e.target.reset();closeAuth();
      if(problem)setTimeout(()=>{const g=$('.admin-error',sgate)||$('.admin-error',gate);if(g)g.textContent=problem+' Isi nama dan kode lagi di sini.'},120);
      await refresh();
    }catch{err.textContent='Gagal terhubung. Coba lagi.'}
  });

  /* ---------- gerbang situs + gerbang chat ---------- */
  const gateHTML=where=>{
    if(!M.user)return `<p>${where==='site'?'Website ini khusus member Kamar Illiyyin Loro. Masuk atau daftar dulu buat membukanya.':'Circle Chat khusus member. Masuk atau daftar dulu buat baca dan ikut ngobrol.'}</p><div class="pg-btnrow"><button type="button" class="pg-btn" data-g="login">Masuk</button><button type="button" class="pg-btn" data-g="register">Daftar</button></div>`;
    if(!M.profile)return `<p>Pilih nama tampilan lu. Nama ini terkunci ke akun lu dan dipakai di chat dan cerita, jadi nggak ada yang bisa menyamar jadi lu.${M.admin?'':' Isi juga kode akses dari admin.'}</p><div class="gate-row"><input class="g-name" maxlength="20" placeholder="Nama tampilan" autocomplete="nickname">${M.admin?'':'<input class="g-code" placeholder="Kode akses dari admin" autocomplete="off">'}<button type="button" class="pg-btn" data-g="savename">Simpan</button></div><p class="admin-error" role="alert"></p><button type="button" class="linklike" data-g="out">Keluar</button>`;
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
    if(msgs)msgs.innerHTML='<div class="chat-empty">Chat khusus anggota KAIRO yang sudah aktif 🔒</div>';
    gate.innerHTML=gateHTML('chat');
  }
  async function onGate(e,box){
    const b=e.target.closest?.('[data-g]');if(!b)return;
    const g=b.dataset.g;
    if(g==='login')openAuth('login');
    else if(g==='register')openAuth('register');
    else if(g==='check')await refresh();
    else if(g==='out')$('#logoutBtn')?.click();
    else if(g==='savename'){
      const name=clean($('.g-name',box).value),codeEl=$('.g-code',box),er=$('.admin-error',box);
      if(!NAME_RX.test(name)){er.textContent=NAME_HINT;return}
      const {data:res,error}=await sb.rpc('kairo_register',{p_name:name,p_code:codeEl?codeEl.value.trim():null});
      if(error){er.textContent=errText(error);return}
      if(res!=='ok'){er.textContent=codeMsg(res);return}
      await refresh();
    }
  }
  [gate,sgate].forEach(c=>{
    if(!c)return;
    c.addEventListener('click',e=>onGate(e,c));
    c.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();onGate({target:{closest:()=>({dataset:{g:'savename'}})}},c)}});
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

  /* ---------- panel admin: kode akses, akun, dan pesan ---------- */
  let built=false;
  const aroot=$('#memberAdminRoot');
  function buildAdmin(){
    if(built||!aroot)return;built=true;
    aroot.innerHTML=`<h4 class="pg-admin-h">Kode akses</h4>
<p class="admin-note">Kasih kode ini ke temen-temen lewat chat pribadi. Mereka butuh kode ini buat daftar, dan akunnya langsung aktif. Kalau kode bocor ke orang yang salah, ganti di sini. Member yang sudah daftar nggak terpengaruh.</p>
<div class="gate-row"><input id="accCode" placeholder="Minimal 8 karakter" autocomplete="off"><button type="button" class="pg-btn small" id="accCodeSave">Simpan kode</button></div>
<p id="accCodeMsg" class="admin-note" role="status"></p>
<button type="button" class="pg-btn small" id="accReload">Muat ulang daftar</button>
<h4 class="pg-admin-h" id="accActiveH">Akun aktif</h4><div id="accActive" class="ach-list"></div>
<h4 class="pg-admin-h" id="accBlockedH">Dinonaktifkan</h4><div id="accBlocked" class="ach-list"></div>
<h4 class="pg-admin-h">Pesan terakhir</h4><div id="accMsgs" class="ach-list"></div>`;
    $('#accReload').addEventListener('click',loadAdmin);
    $('#accCodeSave').addEventListener('click',async()=>{
      const v=$('#accCode').value.trim(),m=$('#accCodeMsg');
      if(v.length<8){m.textContent='Kode minimal 8 karakter.';return}
      const {error}=await sb.rpc('kairo_set_code',{p_code:v});
      m.textContent=error?('Gagal: '+errText(error)):'Kode tersimpan.';
    });
    aroot.addEventListener('click',adminAction);
  }
  const fmt=iso=>{try{return new Date(iso).toLocaleDateString('id-ID')}catch{return ''}};
  async function loadAdmin(){
    const [p,m,c]=await Promise.all([
      sb.from('kairo_profiles').select('user_id,display_name,approved,created_at').order('created_at',{ascending:false}).limit(300),
      sb.from('kairo_messages').select('id,name,message,created_at').order('created_at',{ascending:false}).limit(30),
      sb.rpc('kairo_get_code')
    ]);
    if(typeof c.data==='string'&&!$('#accCode').value)$('#accCode').value=c.data;
    const rows=p.data||[],blocked=rows.filter(x=>!x.approved),act=rows.filter(x=>x.approved);
    const row=(x,btns)=>`<div class="ach-row" data-id="${esc(x.user_id)}"><div><b>${esc(x.display_name)}</b>daftar ${esc(fmt(x.created_at))}</div>${btns}</div>`;
    $('#accActiveH').textContent=`Akun aktif (${act.length})`;
    $('#accBlockedH').textContent=`Dinonaktifkan (${blocked.length})`;
    $('#accActive').innerHTML=act.length?act.map(x=>row(x,'<button type="button" class="pg-btn small danger" data-act="block">Nonaktifkan</button>')).join(''):'<p class="admin-note">Belum ada akun aktif.</p>';
    $('#accBlocked').innerHTML=blocked.length?blocked.map(x=>row(x,'<button type="button" class="pg-btn small" data-act="ok">Aktifkan</button><button type="button" class="pg-btn small danger" data-act="del">Hapus</button>')).join(''):'<p class="admin-note">Tidak ada.</p>';
    $('#accMsgs').innerHTML=(m.data||[]).length?m.data.map(x=>`<div class="ach-row" data-id="${esc(x.id)}"><div><b>${esc(x.name)}</b>${esc(x.message)}</div><button type="button" class="pg-btn small danger" data-act="delmsg">Hapus</button></div>`).join(''):'<p class="admin-note">Belum ada pesan.</p>';
  }
  async function adminAction(e){
    const b=e.target.closest?.('[data-act]');if(!b)return;
    const id=b.closest('.ach-row')?.dataset.id;if(!id)return;
    let res;
    if(b.dataset.act==='ok')res=await sb.from('kairo_profiles').update({approved:true},{count:'exact'}).eq('user_id',id);
    else if(b.dataset.act==='block'){if(!confirm('Nonaktifkan akun ini? Dia nggak bisa membuka website sampai lu aktifkan lagi.'))return;res=await sb.from('kairo_profiles').update({approved:false},{count:'exact'}).eq('user_id',id)}
    else if(b.dataset.act==='del'){if(!confirm('Hapus akun ini? Namanya kebebas dan dia harus daftar nama lagi pakai kode akses.'))return;res=await sb.from('kairo_profiles').delete({count:'exact'}).eq('user_id',id)}
    else if(b.dataset.act==='delmsg'){if(!confirm('Hapus pesan ini?'))return;res=await sb.from('kairo_messages').delete({count:'exact'}).eq('id',id)}
    else return;
    if(res.error||!res.count){alert('Gagal. Pastikan lu login sebagai admin.');return}
    await loadAdmin();
  }
  $('.admin-tab[data-tab="accounts"]')?.addEventListener('click',()=>{buildAdmin();loadAdmin()});

  sb.auth.onAuthStateChange(()=>setTimeout(refresh,0));
  refresh();
})();
