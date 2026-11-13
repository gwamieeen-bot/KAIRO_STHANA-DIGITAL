/* KAIRO STHANA — Akun member: daftar/masuk, nama terkunci ke akun, persetujuan admin, moderasi chat */
(() => {
  'use strict';
  const sb=window.KairoSB||null;
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const M={user:null,profile:null};window.KairoMember=M;
  if(!sb)return; // tanpa Supabase, chat tetap mode lokal seperti sebelumnya
  const gate=$('#chatGate'),form=$('#chatForm'),nameIn=$('#chatName'),msgs=$('#chatMessages');
  const NAME_RX=/^[A-Za-z0-9_. ]{3,20}$/;
  const NAME_HINT='Nama 3-20 karakter: huruf, angka, spasi, titik, atau garis bawah.';
  const clean=s=>String(s||'').trim().replace(/\s+/g,' ');
  const errText=e=>{
    const m=String(e?.message||e||'');
    if(e?.code==='23505'||/duplicate key/i.test(m))return /pkey/.test(m)?'Akun ini sudah punya nama.':'Nama itu sudah dipakai, pilih yang lain.';
    return m||'Terjadi kesalahan.';
  };
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
  function closeAuth(){const modal=$('#authModal');if(modal)modal.hidden=true;if($('#adminModal')?.hidden!==false)document.body.style.overflow=''}
  $('#authOpenBtn')?.addEventListener('click',()=>setMode('login'));
  $('#authToReg')?.addEventListener('click',()=>setMode('register'));
  $('#authToLogin')?.addEventListener('click',()=>setMode('login'));
  $('#regForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const err=$('#regError'),email=$('#regEmail').value.trim(),pw=$('#regPassword').value,name=clean($('#regName').value);
    if(!NAME_RX.test(name)){err.textContent=NAME_HINT;return}
    if(pw.length<8){err.textContent='Password minimal 8 karakter.';return}
    err.textContent='Mendaftar…';
    try{
      const {data,error}=await sb.auth.signUp({email,password:pw});
      if(error){err.textContent=authErr(error);return}
      if(!data?.session){err.textContent='Akun dibuat, tapi masih butuh konfirmasi email. Hubungi admin.';return}
      const {error:e2}=await sb.rpc('kairo_register',{p_name:name});
      err.textContent='';e.target.reset();closeAuth();
      if(e2)setTimeout(()=>{const g=$('#gErr');if(g)g.textContent=errText(e2)+' Pilih nama lain.'},50);
      await refresh();
    }catch{err.textContent='Gagal terhubung. Coba lagi.'}
  });

  /* ---------- gerbang chat ---------- */
  function render(ok){
    if(!gate)return;
    if(ok){gate.hidden=true;if(form)form.hidden=false;if(nameIn){nameIn.value=M.profile.display_name;nameIn.readOnly=true;nameIn.title='Nama terkunci ke akun lu'}return}
    if(form)form.hidden=true;gate.hidden=false;
    if(msgs)msgs.innerHTML='<div class="chat-empty">Chat khusus member yang sudah disetujui 🔒</div>';
    if(!M.user)gate.innerHTML='<p>Circle Chat khusus member. Masuk atau daftar dulu buat baca dan ikut ngobrol.</p><div class="pg-btnrow"><button type="button" class="pg-btn" data-g="login">Masuk</button><button type="button" class="pg-btn" data-g="register">Daftar</button></div>';
    else if(!M.profile)gate.innerHTML='<p>Pilih nama tampilan lu. Nama ini terkunci ke akun lu dan dipakai di chat, jadi nggak ada yang bisa menyamar jadi lu.</p><div class="gate-row"><input id="gName" maxlength="20" placeholder="Nama tampilan" autocomplete="nickname"><button type="button" class="pg-btn" data-g="savename">Simpan nama</button></div><p id="gErr" class="admin-error" role="alert"></p><button type="button" class="linklike" data-g="out">Keluar</button>';
    else gate.innerHTML=`<p>Akun <b>${esc(M.profile.display_name)}</b> menunggu persetujuan admin. Kabari admin biar akun lu disetujui.</p><div class="pg-btnrow"><button type="button" class="pg-btn" data-g="check">Cek lagi</button><button type="button" class="linklike" data-g="out">Keluar</button></div>`;
  }
  gate?.addEventListener('click',async e=>{
    const b=e.target.closest?.('[data-g]');if(!b)return;
    const g=b.dataset.g;
    if(g==='login')openAuth('login');
    else if(g==='register')openAuth('register');
    else if(g==='check')await refresh();
    else if(g==='out')$('#logoutBtn')?.click();
    else if(g==='savename'){
      const name=clean($('#gName').value),er=$('#gErr');
      if(!NAME_RX.test(name)){er.textContent=NAME_HINT;return}
      const {error}=await sb.rpc('kairo_register',{p_name:name});
      if(error){er.textContent=errText(error);return}
      await refresh();
    }
  });

  let lastKey='',running=false,again=false;
  async function doRefresh(){
    const {data}=await sb.auth.getSession();
    M.user=data?.session?.user||null;M.profile=null;
    if(M.user){const {data:p}=await sb.from('kairo_profiles').select('display_name,approved').eq('user_id',M.user.id).maybeSingle();M.profile=p||null}
    const ok=!!M.profile?.approved,key=(M.user?.id||'-')+':'+ok;
    render(ok);
    if(key!==lastKey){lastKey=key;await window.KairoChatReload?.();render(ok)}
    window.KairoAdminUI?.();
  }
  async function refresh(){
    if(running){again=true;return}
    running=true;
    try{do{again=false;await doRefresh()}while(again)}catch{}finally{running=false}
  }
  M.refresh=refresh;

  /* ---------- panel admin: akun dan pesan ---------- */
  let built=false;
  const root=$('#memberAdminRoot');
  function buildAdmin(){
    if(built||!root)return;built=true;
    root.innerHTML=`<p class="admin-note">Setujui akun yang namanya benar-benar milik temen lu. Akun yang belum disetujui nggak bisa baca atau kirim chat.</p>
<button type="button" class="pg-btn small" id="accReload">Muat ulang</button>
<h4 class="pg-admin-h" id="accPendingH">Menunggu persetujuan</h4><div id="accPending" class="ach-list"></div>
<h4 class="pg-admin-h" id="accActiveH">Akun aktif</h4><div id="accActive" class="ach-list"></div>
<h4 class="pg-admin-h">Pesan terakhir</h4><div id="accMsgs" class="ach-list"></div>`;
    $('#accReload').addEventListener('click',loadAdmin);
    root.addEventListener('click',adminAction);
  }
  const fmt=iso=>{try{return new Date(iso).toLocaleDateString('id-ID')}catch{return ''}};
  async function loadAdmin(){
    const [p,m]=await Promise.all([
      sb.from('kairo_profiles').select('user_id,display_name,approved,created_at').order('created_at',{ascending:false}).limit(200),
      sb.from('kairo_messages').select('id,name,message,created_at').order('created_at',{ascending:false}).limit(30)
    ]);
    const rows=p.data||[],pend=rows.filter(x=>!x.approved),act=rows.filter(x=>x.approved);
    const row=(x,btns)=>`<div class="ach-row" data-id="${esc(x.user_id)}"><div><b>${esc(x.display_name)}</b>daftar ${esc(fmt(x.created_at))}</div>${btns}</div>`;
    $('#accPendingH').textContent=`Menunggu persetujuan (${pend.length})`;
    $('#accActiveH').textContent=`Akun aktif (${act.length})`;
    $('#accPending').innerHTML=pend.length?pend.map(x=>row(x,'<button type="button" class="pg-btn small" data-act="ok">Setujui</button><button type="button" class="pg-btn small danger" data-act="no">Tolak</button>')).join(''):'<p class="admin-note">Tidak ada yang menunggu.</p>';
    $('#accActive').innerHTML=act.length?act.map(x=>row(x,'<button type="button" class="pg-btn small danger" data-act="no">Cabut</button>')).join(''):'<p class="admin-note">Belum ada akun aktif.</p>';
    $('#accMsgs').innerHTML=(m.data||[]).length?m.data.map(x=>`<div class="ach-row" data-id="${esc(x.id)}"><div><b>${esc(x.name)}</b>${esc(x.message)}</div><button type="button" class="pg-btn small danger" data-act="delmsg">Hapus</button></div>`).join(''):'<p class="admin-note">Belum ada pesan.</p>';
  }
  async function adminAction(e){
    const b=e.target.closest?.('[data-act]');if(!b)return;
    const id=b.closest('.ach-row')?.dataset.id;if(!id)return;
    let res;
    if(b.dataset.act==='ok')res=await sb.from('kairo_profiles').update({approved:true},{count:'exact'}).eq('user_id',id);
    else if(b.dataset.act==='no'){if(!confirm('Yakin? Akun ini kehilangan namanya dan harus daftar nama lagi.'))return;res=await sb.from('kairo_profiles').delete({count:'exact'}).eq('user_id',id)}
    else if(b.dataset.act==='delmsg'){if(!confirm('Hapus pesan ini?'))return;res=await sb.from('kairo_messages').delete({count:'exact'}).eq('id',id)}
    else return;
    if(res.error||!res.count){alert('Gagal. Pastikan lu login sebagai admin.');return}
    await loadAdmin();
  }
  $('.admin-tab[data-tab="accounts"]')?.addEventListener('click',()=>{buildAdmin();loadAdmin()});

  sb.auth.onAuthStateChange(()=>setTimeout(refresh,0));
  refresh();
})();
