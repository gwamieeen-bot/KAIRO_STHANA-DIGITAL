// ===============================
// KAIRO STHANA — MAIN SCRIPT
// ===============================

// Mobile navigation
const menuBtn = document.querySelector(".menu-btn");
const nav = document.querySelector(".nav-links");

if (menuBtn && nav) {
  menuBtn.addEventListener("click", () => {
    nav.classList.toggle("open");
    menuBtn.classList.toggle("active");
    menuBtn.setAttribute("aria-expanded", nav.classList.contains("open"));
  });

  document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuBtn.classList.remove("active");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });
}

// Active navigation + keyboard-friendly mobile menu
const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...document.querySelectorAll(".nav-links a")];
if ("IntersectionObserver" in window && sections.length && navLinks.length) {
  const navObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
    });
  }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });
  sections.forEach(section => navObserver.observe(section));
}

window.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (nav?.classList.contains("open")) {
    nav.classList.remove("open");
    menuBtn?.classList.remove("active");
    menuBtn?.setAttribute("aria-expanded", "false");
  }
});

// Scroll reveal
const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  revealElements.forEach(el => observer.observe(el));
} else {
  revealElements.forEach(el => el.classList.add("visible"));
}

// Smooth cursor glow
const glow = document.querySelector(".cursor-glow");

if (glow && window.matchMedia("(pointer:fine)").matches) {
  let mouseX = 0, mouseY = 0, glowX = 0, glowY = 0;

  window.addEventListener("mousemove", e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  function animateGlow() {
    glowX += (mouseX - glowX) * 0.12;
    glowY += (mouseY - glowY) * 0.12;
    glow.style.left = `${glowX}px`;
    glow.style.top = `${glowY}px`;
    requestAnimationFrame(animateGlow);
  }
  animateGlow();
}

// ===============================
// BACKGROUND PARTICLES
// ===============================
const canvas = document.querySelector("#particles");

if (canvas) {
  const ctx = canvas.getContext("2d");
  let particles = [];
  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const makeParticle = () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    size: Math.random() * 1.6 + 0.6,
    alpha: Math.random() * 0.45 + 0.12
  });

  const resetParticles = () => {
    const count = Math.min(65, Math.max(28, Math.floor(width / 19)));
    particles = Array.from({ length: count }, makeParticle);
  };

  const drawParticles = () => {
    if (document.hidden) { requestAnimationFrame(drawParticles); return; }
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(53,224,192,${p.alpha})`;
      ctx.fill();

      // Subtle connections
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 105) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(53,224,192,${0.045 * (1 - distance / 105)})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(drawParticles);
  };

  resize();
  resetParticles();
  window.addEventListener("resize", () => {
    resize();
    resetParticles();
  }, { passive: true });

  drawParticles();
}

// ===============================
// CIRCLE CHAT — LOCAL FALLBACK + SUPABASE REALTIME
// ===============================
const chatForm = document.querySelector("#chatForm");
const chatName = document.querySelector("#chatName");
const chatMessage = document.querySelector("#chatMessage");
const chatMessages = document.querySelector("#chatMessages");
const chatConnectionLabel = document.querySelector("#chatConnectionLabel");
const chatConnectionHint = document.querySelector("#chatConnectionHint");

const CHAT_ROOM = "kairo-illiyyin-loro";
const NAME_KEY = "kairoSthanaChatName";
const LOCAL_CHAT_KEY = "kairoSthanaLocalChat";
let chatData = [];
let realtimeChannel = null;
let supabaseClient = null;
let onlineMode = false;

const escapeHTML = value => {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
};

const formatTime = iso => {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

function setChatStatus(connected, hint = "") {
  if (chatConnectionLabel) chatConnectionLabel.textContent = connected ? "LIVE CHAT" : "CHAT SIAP";
  if (chatConnectionHint) chatConnectionHint.textContent = hint;
  document.querySelector(".status-dot")?.classList.toggle("offline", !connected);
}

function renderChat() {
  if (!chatMessages) return;
  if (!chatData.length) {
    chatMessages.innerHTML = '<div class="chat-empty">Belum ada pesan. Jadilah yang pertama 👋</div>';
    return;
  }
  const savedName = chatName?.value.trim() || "";
  chatMessages.innerHTML = chatData.map(msg => {
    const mine = savedName && msg.name === savedName ? " me" : "";
    return `<article class="chat-message${mine}">
      <div class="chat-meta"><span class="chat-name">${escapeHTML(msg.name)}</span><span class="chat-time">${escapeHTML(formatTime(msg.created_at || msg.time))}</span></div>
      <div class="chat-text">${escapeHTML(msg.message ?? msg.text)}</div>
    </article>`;
  }).join("");
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function loadLocalChat() {
  try { chatData = JSON.parse(localStorage.getItem(LOCAL_CHAT_KEY) || "[]"); }
  catch { chatData = []; }
  renderChat();
  setChatStatus(false, "Mode lokal aktif • pesan tersimpan di perangkat ini");
}

async function loadOnlineChat() {
  const cfg = window.KAIRO_SUPABASE || {};
  const configured = cfg.url && cfg.anonKey &&
    !cfg.url.includes("YOUR-PROJECT") && !cfg.anonKey.includes("YOUR_PUBLISHABLE") &&
    !cfg.anonKey.includes("YOUR_ANON");

  if (!configured || !window.supabase?.createClient) {
    loadLocalChat();
    return;
  }

  try {
    supabaseClient = window.KairoSB || (window.KairoSB = window.supabase.createClient(cfg.url, cfg.anonKey));
    const { data, error } = await supabaseClient
      .from("kairo_messages")
      .select("id, room, name, message, created_at")
      .eq("room", CHAT_ROOM)
      .order("created_at", { ascending: true })
      .limit(150);
    if (error) throw error;

    onlineMode = true;
    chatData = data || [];
    renderChat();

    realtimeChannel = supabaseClient.channel("kairo-circle-chat")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "kairo_messages",
        filter: `room=eq.${CHAT_ROOM}`
      }, payload => {
        if (!chatData.some(msg => msg.id === payload.new.id)) {
          chatData.push(payload.new);
          chatData = chatData.slice(-150);
          renderChat();
        }
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") setChatStatus(true, "Tersambung realtime • pesan masuk otomatis");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setChatStatus(false, "Koneksi realtime bermasalah");
      });
  } catch (error) {
    console.error("Kairo chat:", error);
    onlineMode = false;
    loadLocalChat();
    setChatStatus(false, "Supabase belum siap • mode lokal aktif");
  }
}

if (chatName) chatName.value = localStorage.getItem(NAME_KEY) || "";

chatForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const name = chatName.value.trim();
  const text = chatMessage.value.trim();
  if (!name || !text || name.length > 20 || text.length > 200) return;
  localStorage.setItem(NAME_KEY, name);

  if (onlineMode && supabaseClient) {
    const { data, error } = await supabaseClient
      .from("kairo_messages")
      .insert({ room: CHAT_ROOM, name, message: text })
      .select("id, room, name, message, created_at")
      .single();
    if (error) {
      console.error("Gagal kirim pesan:", error);
      setChatStatus(false, /cepat/i.test(error.message || "") ? "Terlalu cepat, tunggu sebentar" : "Pesan gagal dikirim • cek koneksi");
      return;
    }
    if (data && !chatData.some(msg => msg.id === data.id)) chatData.push(data);
  } else {
    const localMsg = { id: `local-${Date.now()}`, room: CHAT_ROOM, name, message: text, created_at: new Date().toISOString() };
    chatData.push(localMsg);
    chatData = chatData.slice(-150);
    localStorage.setItem(LOCAL_CHAT_KEY, JSON.stringify(chatData));
  }

  renderChat();
  chatMessage.value = "";
  chatMessage.focus();
});

chatName?.addEventListener("input", renderChat);
loadOnlineChat();
window.KairoChatReload = async () => {
  try { if (realtimeChannel && supabaseClient) await supabaseClient.removeChannel(realtimeChannel); } catch {}
  realtimeChannel = null;
  await loadOnlineChat();
};

// ===============================
// CONFETTI — NO EXTERNAL LIBRARY
// ===============================
const confettiBtn = document.querySelector("#confettiBtn");

function launchConfetti(amount = 90) {
  const pieces = [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  for (let i = 0; i < amount; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";

    const colors = [
      "#35e0c0", "#ecfffa", "#0aa98e",
      "#7ff3df", "#b5fff1", "#3b82f6", "#facc15"
    ];

    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.setProperty("--x", `${(Math.random() - 0.5) * 260}px`);
    piece.style.setProperty("--r", `${(Math.random() - 0.5) * 1100}deg`);
    piece.style.setProperty("--duration", `${1.8 + Math.random() * 2.1}s`);
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(piece);
    pieces.push(piece);
  }

  setTimeout(() => pieces.forEach(piece => piece.remove()), 4300);
}

confettiBtn?.addEventListener("click", () => launchConfetti(110));


// ===============================
// INTERACTIVE CONTENT CARDS + LIGHTBOX
// ===============================
(() => {
  const modal = document.querySelector('#interactiveModal');
  const title = document.querySelector('#interactiveModalTitle');
  const body = document.querySelector('#interactiveModalBody');
  const visual = document.querySelector('#interactiveModalVisual');
  if (!modal || !title || !body) return;

  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (visual) { visual.hidden = true; visual.innerHTML = ''; }
  };

  const open = (card) => {
    const type = card.dataset.interactive;
    const heading = card.querySelector('h3')?.textContent?.trim() || card.querySelector('span')?.textContent?.trim() || 'Kairo Sthana';
    const secondary = card.querySelector('p')?.textContent?.trim() || card.querySelector('small')?.textContent?.trim() || '';

    title.textContent = heading;
    body.textContent = secondary || 'Detail ini siap diisi dengan cerita, dokumentasi, atau informasi lengkap.';

    if (visual) {
      const bg = getComputedStyle(card).backgroundImage;
      const hasImage = bg && bg !== 'none' && bg.includes('url(');
      if (type === 'gallery' && hasImage) {
        visual.hidden = false;
        visual.style.backgroundImage = bg;
        body.textContent = secondary || 'Dokumentasi Kairo Sthana.';
      } else {
        visual.hidden = true;
        visual.style.backgroundImage = '';
      }
    }

    if (type === 'achievement') {
      const meta = card.querySelector('small')?.textContent?.trim();
      body.textContent = [secondary, meta].filter(Boolean).join(' • ') || 'Prestasi Kairo Sthana.';
    }
    if (type === 'talent') {
      body.textContent = `${secondary || 'Kemampuan'} — bagian dari semangat multitalenta Kairo Sthana. Detail dapat dikembangkan lagi melalui konten admin.`;
    }

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.interactive-close')?.focus();
  };

  document.querySelectorAll('[data-interactive]').forEach(card => {
    card.addEventListener('click', () => open(card));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(card);
      }
    });
  });

  modal.querySelectorAll('[data-close-interactive]').forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) close();
  });

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', link.getAttribute('href'));
    });
  });
})();

// ===============================
// PWA INSTALL PROMPT
// ===============================
let deferredInstallPrompt = null;
const installBtn = document.querySelector("#installBtn");

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installBtn) installBtn.hidden = false;
});

installBtn?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener("appinstalled", () => {
  if (installBtn) installBtn.hidden = true;
});

// ===============================
// PWA SERVICE WORKER
// ===============================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then(() => console.log("Kairo Sthana PWA aktif ✓"))
      .catch(err => console.warn("PWA service worker:", err));
  });
}


// ===============================
// TALKING ROBOT MASCOT (Text-to-Speech)
// ===============================
(() => {
  const mascot = document.querySelector("#robotMascot");
  const talkBtn = document.querySelector("#mascotTalkBtn");
  const speechBox = document.querySelector("#mascotSpeech");
  if (!mascot || !talkBtn || !speechBox) return;

  const greeting = "heyy bro, kenalin gw robot ai yang di ciptain ama alamm, gw di suruh nemenin lu lu pada di sini, jadi lako ada apa apa angger ngomong ya ke gw.";
  let speaking = false;

  const setSpeaking = (active, message) => {
    speaking = active;
    mascot.classList.toggle("is-speaking", active);
    talkBtn.setAttribute("aria-pressed", String(active));
    talkBtn.innerHTML = active
      ? '<span aria-hidden="true">■</span> Hentikan suara'
      : '<span aria-hidden="true">▶</span> Ajak ngobrol';
    if (message) speechBox.textContent = message;
  };

  talkBtn.addEventListener("click", () => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      speechBox.textContent = greeting + " (Fitur suara belum didukung browser ini.)";
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false, "Oke, suara aku hentikan. Kalau mau lanjut, tekan tombol Ajak ngobrol lagi ya!");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(greeting);
    utterance.lang = "id-ID";
    utterance.rate = 0.95;
    utterance.pitch = 1.08;
    utterance.onstart = () => setSpeaking(true, greeting);
    utterance.onend = () => setSpeaking(false, "hey, kenalin, gw robot ai yang di buat ama allam, lu klo mau tentang web ini bisa nanya langsung ke orang nya, kalo gk nanya ke gw gak papa, soalnya gw di progam buat nemenin lu lu pada.");
    utterance.onerror = () => setSpeaking(false, "Suara belum bisa diputar di browser ini. Coba tekan tombolnya lagi atau gunakan browser lain.");
    setSpeaking(true, greeting);
    window.speechSynthesis.speak(utterance);
  });

  window.addEventListener("pagehide", () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  });
})();

// =========================================================
// KAIRO DIGITAL HOME — EXTRA INTERACTIVE SYSTEMS
// =========================================================
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const STORAGE = {
    xp: 'kairo_xp_v1',
    visits: 'kairo_visits_v1',
    members: 'kairo_admin_data_v1'
  };

  const safeRead = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };

  const openInteractive = (title, text, emoji = '✦') => {
    const modal = $('#interactiveModal');
    const modalTitle = $('#interactiveModalTitle');
    const modalBody = $('#interactiveModalBody');
    const visual = $('#interactiveModalVisual');
    if (!modal || !modalTitle || !modalBody) return;
    modalTitle.textContent = title;
    modalBody.textContent = text;
    if (visual) {
      visual.hidden = false;
      visual.style.backgroundImage = 'none';
      visual.innerHTML = `<div class="detail-symbol">${emoji}</div>`;
    }
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.interactive-close')?.focus();
  };

  // Timeline detail cards
  const timelineDetails = [
    ['Rumah Pertama', 'Kamar Illiyyin Loro bukan cuma tempat tinggal. Ia menjadi ruang untuk belajar, ngobrol, menyusun ide, dan tumbuh bersama.', '⌂'],
    ['Mulai Berkompetisi', 'Semangat berani mencoba menjadi bagian dari perjalanan KAIRO. Detail lomba dan tahun dapat ditambahkan melalui data prestasi.', '⚡'],
    ['Banyak Talenta', 'Setiap penghuni membawa kemampuan yang berbeda. Kolaborasi membuat satu kamar terasa seperti banyak dunia kreatif.', '✦'],
    ['Digital Home', 'Website ini menjadi markas digital: arsip prestasi, timeline, gallery, circle, aktivitas, dan cerita KAIRO.', '◈']
  ];
  $$('.timeline-node').forEach(node => {
    const open = () => {
      const d = timelineDetails[Number(node.dataset.timeline)] || timelineDetails[0];
      $$('.timeline-node').forEach(n => n.classList.toggle('is-active', n === node));
      openInteractive(d[0], d[1], d[2]);
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  // Trophy room
  const trophyDetails = {
    gold: ['Gold Archive', 'Arsip kemenangan tingkat pertama. Gunakan dashboard admin untuk mengganti judul, lomba, tahun, dan cerita prestasi sebenarnya.', '🏆'],
    silver: ['Victory File', 'Ruang untuk menyimpan dokumentasi kemenangan dan proses di baliknya. Data bisa diperbarui tanpa mengubah desain utama.', '🥇'],
    legacy: ['Legacy', 'Tidak semua kemenangan berbentuk piala. Kedisiplinan, keberanian mencoba, dan kerja tim juga menjadi bagian dari warisan KAIRO.', '🏅']
  };
  $$('.trophy-display').forEach(btn => btn.addEventListener('click', () => {
    const d = trophyDetails[btn.dataset.trophy] || trophyDetails.gold;
    openInteractive(d[0], d[1], d[2]);
    addXP(5, 'Membuka Trophy Room');
  }));
  $('#celebrateTrophyBtn')?.addEventListener('click', () => {
    launchConfetti(130);
    addXP(15, 'Merayakan prestasi KAIRO');
    openInteractive('Prestasi dirayakan! 🎉', 'Semangat KAIRO bukan cuma tentang hasil akhir, tapi juga keberanian untuk mencoba dan terus berkarya.', '🎉');
  });

  // Virtual room hotspots
  const roomDetails = {
    bed: ['Area Istirahat', 'Tempat mengisi tenaga setelah belajar, latihan, atau kegiatan. Markas yang baik juga butuh waktu untuk istirahat.', '🛏️'],
    desk: ['Creative Desk', 'Meja ide: tempat menulis, menggambar, mengerjakan tugas, merancang karya, dan menyusun strategi lomba.', '💻'],
    trophy: ['Trophy Cabinet', 'Lemari simbol pencapaian. Nantinya bisa diisi foto piala dan dokumentasi prestasi asli KAIRO.', '🏆'],
    window: ['Jendela KAIRO', 'Sebuah pengingat bahwa kehidupan kamar tetap terhubung dengan dunia di luar: sekolah, pesantren, lomba, dan masyarakat.', '🌙']
  };
  $$('.room-hotspot').forEach(btn => btn.addEventListener('click', () => {
    const d = roomDetails[btn.dataset.room] || roomDetails.bed;
    openInteractive(d[0], d[1], d[2]);
    addXP(3, 'Eksplorasi Virtual Room');
  }));

  // Member randomizer uses the admin member list when available.
  const fallbackMembers = ['Kairo Sthana', 'Creative Crew', 'Competition Crew', 'Multitalent Crew', 'Teamwork Crew'];
  const memberRoles = ['Penghuni circle', 'Creative Crew', 'Competition Crew', 'Multitalent Crew', 'Teamwork Crew'];
  let lastMember = -1;
  function getMembers() {
    const data = safeRead(STORAGE.members, null);
    const list = Array.isArray(data?.members) ? data.members.filter(Boolean) : [];
    return list.length ? list : fallbackMembers;
  }
  function randomMember() {
    const list = getMembers();
    let idx = Math.floor(Math.random() * list.length);
    if (list.length > 1 && idx === lastMember) idx = (idx + 1) % list.length;
    lastMember = idx;
    const name = list[idx];
    const avatar = name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'KS';
    const avatarEl = $('#randomMemberAvatar');
    const nameEl = $('#randomMemberName');
    const roleEl = $('#randomMemberRole');
    if (avatarEl) avatarEl.textContent = avatar;
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = memberRoles[idx % memberRoles.length];
    addXP(5, 'Kenalan dengan penghuni KAIRO');
  }
  $('#randomMemberBtn')?.addEventListener('click', randomMember);

  // XP + achievement system
  const badges = [
    { id: 'arrival', icon: '🚪', title: 'First Arrival', note: 'COMING SOON yaa' },
    { id: 'explorer', icon: '🧭', title: 'Explorer', note: 'COMING SOON yaa' },
    { id: 'trophy', icon: '🏆', title: 'Trophy Hunter', note: 'SABHAR MASIH COMING SOON' },
    { id: 'circle', icon: '👥', title: 'Circle Mate', note: 'Kenalan dengan member' },
    { id: 'legend', icon: '👑', title: 'KAIRO Legend', note: 'Mencapai 100 XP' }
  ];
  let xp = Number(localStorage.getItem(STORAGE.xp) || 0);
  let unlocked = safeRead('kairo_badges_v1', ['arrival']);
  if (!Array.isArray(unlocked)) unlocked = ['arrival'];

  function renderXP() {
    const xpEl = $('#kairoXP');
    const fill = $('#xpFill');
    const levelEl = $('#xpLevel');
    const badgeBox = $('#achievementBadges');
    const level = Math.floor(xp / 25) + 1;
    const names = ['New Arrival', 'Rising', 'Active', 'Elite', 'Legend'];
    const levelName = names[Math.min(names.length - 1, level - 1)];
    if (xpEl) xpEl.textContent = `${xp} XP`;
    if (fill) fill.style.width = `${Math.min(100, (xp % 25) * 4)}%`;
    if (levelEl) levelEl.textContent = `Level ${level} · ${levelName}`;
    if (badgeBox) {
      badgeBox.innerHTML = badges.filter(b => unlocked.includes(b.id)).map(b => `<span class="badge-chip"><b>${b.icon} ${b.title}</b><small>${b.note}</small></span>`).join('');
    }
  }
  function unlock(id) {
    if (!unlocked.includes(id)) {
      unlocked.push(id);
      localStorage.setItem('kairo_badges_v1', JSON.stringify(unlocked));
      return true;
    }
    return false;
  }
  window.addXP = function addXP(amount, reason = '') {
    xp = Math.max(0, xp + amount);
    localStorage.setItem(STORAGE.xp, String(xp));
    if (xp >= 1) unlock('arrival');
    if (xp >= 20) unlock('explorer');
    if (xp >= 35) unlock('trophy');
    if (xp >= 55) unlock('circle');
    if (xp >= 100) unlock('legend');
    renderXP();
    if (reason) window.dispatchEvent(new CustomEvent('kairo:activity', { detail: { title: reason, text: `+${amount} XP`, icon: '✦' } }));
  };
  renderXP();
  $('#unlockAchievementBtn')?.addEventListener('click', () => {
    renderXP();
    openInteractive('Achievement Check', `${unlocked.length} achievement sudah terbuka. Terus eksplorasi fitur KAIRO untuk mengumpulkan XP dan membuka badge baru.`, '🏅');
  });

  // Live activity — benar-benar hidup: merespons aksi pengguna, bisa diklik,
  // dan berputar otomatis agar bagian "Markas yang terus bergerak" tidak menjadi pajangan.
  const baseActivities = [
    ['✦', 'Digital Home aktif', 'KAIRO Sthana punya markas digital baru.', '#home'],
    ['🏆', 'Trophy Room siap', 'Arsip prestasi bisa dibuka dari ruang piala.', '#trophy-room'],
    ['🤖', 'Maskot online', 'Robot KAIRO siap menemani eksplorasi.', '#home'],
    ['📸', 'Memory Wall', 'Gallery siap diisi dokumentasi kegiatan.', '#gallery']
  ];
  const activityFeed = $('#activityFeed');
  const activities = [...baseActivities];
  let activityCursor = 0;
  let activityTimer = null;

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[ch]));

  function renderActivity() {
    if (!activityFeed) return;
    const visible = activities.slice(-8).reverse();
    activityFeed.innerHTML = visible.map((a, index) => {
      const [icon, title, text, target] = a;
      const actionTarget = target || '';
      return `<article class="activity-item ${index === 0 ? 'is-live' : ''}" tabindex="0" role="button" data-activity-target="${escapeHTML(actionTarget)}" data-activity-title="${escapeHTML(title)}" data-activity-text="${escapeHTML(text)}">
        <span class="activity-icon">${escapeHTML(icon)}</span>
        <div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(text)}</p></div>
        <time>${index === 0 ? 'LIVE NOW' : 'RECENT'}</time>
      </article>`;
    }).join('');

    activityFeed.querySelectorAll('.activity-item').forEach(item => {
      const activate = () => {
        const target = item.dataset.activityTarget;
        const title = item.dataset.activityTitle || 'Aktivitas KAIRO';
        const text = item.dataset.activityText || 'Aktivitas KAIRO.';
        if (target) {
          document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          window.dispatchEvent(new CustomEvent('kairo:activity', { detail: { title: `Membuka ${title}`, text: 'Aktivitas berhasil dibuka.', icon: '↗' } }));
        } else {
          openInteractive(title, text, '✦');
        }
      };
      item.addEventListener('click', activate);
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    });
  }

  function rotateActivity() {
    if (!activityFeed || activities.length < 2 || document.hidden) return;
    const first = activities.shift();
    activities.push(first);
    activityCursor += 1;
    renderActivity();
  }

  window.addEventListener('kairo:activity', e => {
    const d = e.detail || {};
    const target = d.target || '';
    activities.push([d.icon || '✦', d.title || 'Aktivitas KAIRO', d.text || 'Aktivitas baru.', target]);
    renderActivity();
  });

  renderActivity();
  activityTimer = window.setInterval(rotateActivity, 4200);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    renderActivity();
  });
  window.addEventListener('pagehide', () => {
    if (activityTimer) clearInterval(activityTimer);
  });

  // Logo easter egg: five clicks reveal Secret Room.
  const logo = $('.brand .logo-mark');
  const secret = $('#secretRoom');
  let logoClicks = 0, logoReset;
  function openSecret() { if (!secret) return; secret.hidden = false; document.body.style.overflow = 'hidden'; addXP(10, 'Secret Room ditemukan'); }
  logo?.addEventListener('click', e => {
    e.preventDefault(); logoClicks += 1; clearTimeout(logoReset); logoReset = setTimeout(() => { logoClicks = 0; }, 1600);
    if (logoClicks >= 5) { logoClicks = 0; openSecret(); }
    else if (logoClicks === 1) { logo.classList.add('secret-tap'); setTimeout(() => logo.classList.remove('secret-tap'), 250); }
  });
  const closeSecret = () => { if (!secret) return; secret.hidden = true; document.body.style.overflow = ''; };
  $$('[data-close-secret]').forEach(el => el.addEventListener('click', closeSecret));
  $('#secretCelebrateBtn')?.addEventListener('click', () => { launchConfetti(160); addXP(20, 'Secret Room dibuka'); openInteractive('You found it. 👑', 'KAIRO SECRET ROOM berhasil dibuka. Easter egg ini menjadi tanda bahwa lu menjelajah sampai detail terkecil.', '👑'); closeSecret(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && secret && !secret.hidden) closeSecret(); });

  // Register a lightweight visit/activity signal.
  const visits = Number(localStorage.getItem(STORAGE.visits) || 0) + 1;
  localStorage.setItem(STORAGE.visits, String(visits));
  if (visits === 1) addXP(5, 'First visit ke Digital Home');
})();


/* ===== KAIRO DIGITAL HOME V3 FEATURE ENGINE ===== */
(() => {
  const $v = (s, r=document) => r.querySelector(s);
  const $$v = (s, r=document) => [...r.querySelectorAll(s)];
  const HUBKEY='kairo_hub_v3', GUEST='kairo_guestbook_v3', REACT='kairo_reactions_v3', AGENDA='kairo_agenda_v3', NOTIF='kairo_notifications_v3', BROAD='kairo_broadcast_v3';
  const read=(k,d)=>{try{const x=JSON.parse(localStorage.getItem(k));return x ?? d}catch{return d}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const hub=$v('#kairoHub'), output=$v('#hubOutput');
  let toastTimer;
  function toast(msg){const t=$v('#kairoToast');if(!t)return;t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,2600)}
  function saveNotif(title,text){const a=read(NOTIF,[]);a.unshift({title,text,time:new Date().toLocaleString('id-ID')});write(NOTIF,a.slice(0,40));}
  function go(target){document.querySelector(target)?.scrollIntoView({behavior:'smooth',block:'start'});hub.hidden=true;document.body.style.overflow='';}
  function openHub(){hub.hidden=false;document.body.style.overflow='hidden'}
  function closeHub(){hub.hidden=true;document.body.style.overflow=''}
  $v('#kairoHubBtn')?.addEventListener('click',openHub);$$v('[data-close-hub]').forEach(x=>x.addEventListener('click',closeHub));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!hub.hidden)closeHub()});
  $$v('.hub-tab').forEach(tab=>tab.addEventListener('click',()=>{$$v('.hub-tab').forEach(x=>x.classList.remove('active'));$$v('.hub-pane').forEach(x=>x.hidden=true);tab.classList.add('active');$v(`[data-hubpane="${tab.dataset.hubtab}"]`).hidden=false}));
  function box(title,body){output.innerHTML=`<div class="hub-box"><h3>${title}</h3>${body}</div>`}

  function searchUI(){
    box('Search KAIRO',`<form id="hubSearch" class="hub-form"><input id="hubSearchInput" placeholder="Cari anggota, prestasi, gallery, timeline..." autofocus></form><div id="hubSearchResults" class="hub-list" style="margin-top:10px"></div>`);
    const index=[];
    $$v('main h2, main h3, main p, .trophy, .talent, .gallery-box, .timeline-node, .instagram').forEach(el=>{const text=(el.innerText||'').trim();if(text)index.push({el,text,title:el.querySelector('h2,h3,strong,span')?.innerText||text.split('\n')[0]})});
    const render=()=>{const q=$v('#hubSearchInput').value.toLowerCase().trim();const hits=index.filter(x=>x.text.toLowerCase().includes(q)).slice(0,15);$v('#hubSearchResults').innerHTML=hits.length?hits.map((x,i)=>`<div class="search-result" data-i="${i}"><strong>${esc(x.title)}</strong><small>${esc(x.text.slice(0,130))}</small></div>`).join(''):'<div class="hub-pill">Nggak ketemu. Coba kata lain.</div>';$$v('.search-result').forEach(r=>r.onclick=()=>{hits[Number(r.dataset.i)].el.scrollIntoView({behavior:'smooth',block:'center'});closeHub();addXP?.(2,'Mencari isi KAIRO')})};
    $v('#hubSearch').addEventListener('submit',e=>e.preventDefault());$v('#hubSearchInput').addEventListener('input',render);render();
  }

  function agendaUI(){
    const data=read(AGENDA,[{date:'2026-09-28',title:'Belajar & Kreasi',note:'Agenda contoh — bisa diedit dari browser ini.'},{date:'2026-10-03',title:'Latihan Kompetisi',note:'Siapkan karya dan evaluasi tim.'}]);
    const rows=data.sort((a,b)=>a.date.localeCompare(b.date)).map((x,i)=>`<div class="hub-row"><span><strong>${esc(x.title)}</strong><br><small>${esc(x.date)} · ${esc(x.note)}</small></span><button class="reaction-btn" data-del-agenda="${i}">Hapus</button></div>`).join('');
    box('KAIRO Agenda',`<div class="hub-list">${rows||'<div class="hub-pill">Belum ada agenda.</div>'}</div><form id="agendaForm" class="hub-form" style="margin-top:12px"><input type="date" name="date" required><input name="title" placeholder="Nama kegiatan" required><input name="note" placeholder="Catatan singkat"><button class="btn btn-primary">TAMBAH AGENDA ↗</button></form>`);
    $v('#agendaForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);data.push({date:f.get('date'),title:f.get('title'),note:f.get('note')});write(AGENDA,data);saveNotif('Agenda baru',f.get('title'));toast('Agenda berhasil ditambahkan.');agendaUI();window.dispatchEvent(new CustomEvent('kairo:activity',{detail:{title:'Agenda diperbarui',text:String(f.get('title')),icon:'◷',target:'#activity'}}))};
    $$v('[data-del-agenda]').forEach(b=>b.onclick=()=>{data.splice(Number(b.dataset.delAgenda),1);write(AGENDA,data);agendaUI();toast('Agenda dihapus.')});
  }

  function guestbookUI(){
    const data=read(GUEST,[]);box('Guestbook',`<form id="guestForm" class="hub-form"><input name="name" maxlength="30" placeholder="Nama" required><textarea name="message" maxlength="240" rows="3" placeholder="Tulis pesan untuk KAIRO..." required></textarea><button class="btn btn-primary">KIRIM PESAN ↗</button></form><div class="hub-list" style="margin-top:12px">${data.slice(0,10).map(x=>`<div class="hub-row"><span><strong>${esc(x.name)}</strong><br><small>${esc(x.message)}</small></span><small>${esc(x.time)}</small></div>`).join('')||'<div class="hub-pill">Jadilah yang pertama meninggalkan pesan.</div>'}</div>`);
    $v('#guestForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);data.unshift({name:f.get('name'),message:f.get('message'),time:new Date().toLocaleDateString('id-ID')});write(GUEST,data.slice(0,50));saveNotif('Guestbook baru',`${f.get('name')} meninggalkan pesan`);addXP?.(5,'Menulis di Guestbook');toast('Pesan masuk ke Guestbook.');guestbookUI()};
  }

  function reactionsUI(){
    const r=read(REACT,{story:0,trophy:0,talent:0,gallery:0});box('Reaction Wall',`<p class="admin-muted">Reaksi tersimpan di browser ini.</p><div class="hub-inline">${[['story','KAIRO Story','🔥'],['trophy','Prestasi','🏆'],['talent','Talenta','⚡'],['gallery','Memory Wall','📸']].map(x=>`<button class="reaction-btn" data-react="${x[0]}">${x[2]} ${x[1]} <b>${r[x[0]]||0}</b></button>`).join('')}</div>`);
    $$v('[data-react]').forEach(b=>b.onclick=()=>{const k=b.dataset.react;r[k]=(r[k]||0)+1;write(REACT,r);saveNotif('Reaction baru',`Seseorang memberi reaksi ke ${k}`);toast('Reaction tersimpan.');reactionsUI()});
  }

  function broadcastUI(){let b=read(BROAD,{text:'',created:''});box('KAIRO Broadcast',`<form id="broadcastForm" class="hub-form"><input name="text" maxlength="160" placeholder="Tulis pengumuman..." value="${esc(b.text)}"><button class="btn btn-primary">TERBITKAN ↗</button></form>${b.text?`<div class="hub-box" style="margin-top:10px"><strong>Pengumuman aktif</strong><p>${esc(b.text)}</p><small>${esc(b.created)}</small></div>`:''}`);$v('#broadcastForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);b={text:f.get('text'),created:new Date().toLocaleString('id-ID')};write(BROAD,b);saveNotif('Broadcast',b.text);toast('Broadcast diterbitkan.');document.dispatchEvent(new Event('kairo:broadcast'));broadcastUI()}}

  function notificationsUI(){const n=read(NOTIF,[]);box('Notification Center',`<div class="hub-list">${n.length?n.slice(0,20).map(x=>`<div class="hub-row"><span><strong>${esc(x.title)}</strong><br><small>${esc(x.text)}</small></span><small>${esc(x.time)}</small></div>`).join(''):'<div class="hub-pill">Belum ada notifikasi.</div>'}</div><button id="clearNotif" class="reaction-btn" style="margin-top:10px">Hapus semua</button>`);$v('#clearNotif').onclick=()=>{write(NOTIF,[]);notificationsUI();toast('Notifikasi dibersihkan.')}}

  function statsUI(){const count=s=>document.querySelectorAll(s).length;const gallery=count('.gallery-box');const trophies=count('.trophy');const talents=count('.talent');const timeline=count('.timeline-node');const agenda=read(AGENDA,[]).length;box('Live Stats',`<div class="stat-grid"><div class="stat-box"><b>${trophies}</b><small>Prestasi</small></div><div class="stat-box"><b>${talents}</b><small>Talent</small></div><div class="stat-box"><b>${gallery}</b><small>Memory</small></div><div class="stat-box"><b>${timeline}</b><small>Timeline</small></div></div><div class="hub-inline" style="margin-top:12px"><span class="hub-pill">Agenda: ${agenda}</span><span class="hub-pill">Visits: ${localStorage.getItem('kairo_visits_v1')||0}</span><span class="hub-pill">XP: ${localStorage.getItem('kairo_xp_v2')||localStorage.getItem('kairo_xp_v1')||0}</span></div>`)}

  function profilesUI(){const md=read('kairo_admin_data_v1',{}); const list=Array.isArray(md?.members?.members)?md.members.members.filter(Boolean):[];box('Member Profiles',`<div class="hub-list">${list.map((name,i)=>`<button class="hub-row" data-profile="${i}" style="width:100%;text-align:left;background:transparent;color:inherit"><span><strong>${esc(name)}</strong><br><small>Penghuni Circle · klik untuk membuka profil</small></span><b>↗</b></button>`).join('')||'<div class="hub-pill">Belum ada member. Tambahkan dari Admin.</div>'}</div>`);$$v('[data-profile]').forEach(b=>b.onclick=()=>{const name=list[Number(b.dataset.profile)];openProfile(name)})}
  function openProfile(name){box('Member Profile',`<div class="share-card"><span class="hub-pill">KAIRO CIRCLE</span><h3>${esc(name)}</h3><p>Penghuni Kamar Illiyyin Loro. Profil ini terhubung dengan data Circle yang tersedia di website.</p><div class="hub-inline"><span class="hub-pill">Talent: Multitalent Crew</span><span class="hub-pill">Status: Circle</span></div></div><button id="profileShare" class="btn btn-primary" style="margin-top:10px">BAGIKAN PROFIL ↗</button>`);$v('#profileShare').onclick=()=>shareText(`Profil KAIRO — ${name}\nKamar Illiyyin Loro · Pondok Pesantren Darul Falah\n${location.href}`)}

  function shareText(text){if(navigator.share){navigator.share({title:'KAIRO STHANA',text:text||'KAIRO STHANA',url:location.href}).catch(()=>{})}else{navigator.clipboard?.writeText(text).then(()=>toast('Teks share sudah disalin.')).catch(()=>toast('Salin teks ini: '+text))}}
  function shareUI(){box('Share Card',`<div class="share-card"><span class="hub-pill">KAIRO STHANA</span><h3>Markas digital Kamar Illiyyin Loro</h3><p>Prestasi, talenta, cerita, dan aktivitas KAIRO dalam satu ruang digital.</p><small>Darul Falah · @kairo_sthana</small></div><button id="shareKairo" class="btn btn-primary" style="margin-top:10px">SHARE KAIRO ↗</button>`);$v('#shareKairo').onclick=()=>shareText('KAIRO STHANA — Markas digital Kamar Illiyyin Loro · Darul Falah · @kairo_sthana')}

  let audioCtx=null,ambientGain=null,ambientTimer=null;
  function ambientUI(){const on=document.body.classList.contains('ambient-on');box('Ambient Mode',`<p>${on?'Ambient sedang menyala.':'Aktifkan ambience setelah tombol ditekan; browser tidak akan memutar suara otomatis.'}</p><button id="ambientToggle" class="btn btn-primary">${on?'MATIKAN AMBIENT':'NYALAKAN AMBIENT'}</button>`);$v('#ambientToggle').onclick=()=>{if(on)stopAmbient();else startAmbient();ambientUI()}}
  function startAmbient(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();const osc=audioCtx.createOscillator();ambientGain=audioCtx.createGain();osc.type='sine';osc.frequency.value=174;ambientGain.gain.value=.018;osc.connect(ambientGain).connect(audioCtx.destination);osc.start();ambientTimer=osc;document.body.classList.add('ambient-on');toast('Ambient mode aktif.');saveNotif('Ambient Mode','Mode ambience dinyalakan')}catch{toast('Ambient tidak tersedia di browser ini.')}}
  function stopAmbient(){try{ambientTimer?.stop();}catch{}ambientTimer=null;document.body.classList.remove('ambient-on');toast('Ambient mode dimatikan.')}

  function achievementsUI(){const chips=$v('#achievementBadges')?.innerHTML||'<div class="hub-pill">Belum ada badge.</div>';box('Achievement Cabinet',`<div class="hub-list">${chips}</div><p style="color:var(--muted);font-size:12px">XP sekarang: <strong>${esc($v('#kairoXP')?.textContent||'0 XP')}</strong></p><button id="achGo" class="btn btn-primary">LIHAT CIRCLE ↗</button>`);$v('#achGo').onclick=()=>go('#circle')}
  function memoryUI(){const boxes=$$v('.gallery-box');box('Memory Wall',`<p class="admin-muted">Klik thumbnail untuk membuka gallery.</p><div class="hub-list">${boxes.map((b,i)=>`<button class="hub-row" data-memory="${i}" style="background:transparent;color:inherit;text-align:left"><span><strong>${esc(b.querySelector('span')?.textContent||'Memory')}</strong><br><small>${esc(b.querySelector('small')?.textContent||'')}</small></span><b>↗</b></button>`).join('')}</div>`);$$v('[data-memory]').forEach(b=>b.onclick=()=>{boxes[Number(b.dataset.memory)]?.click();closeHub()})}

  const actions={search:searchUI,agenda:agendaUI,guestbook:guestbookUI,reactions:reactionsUI,broadcast:broadcastUI,notifications:notificationsUI,stats:statsUI,profiles:profilesUI,share:shareUI,ambient:ambientUI,achievements:achievementsUI,memory:memoryUI};
  $$v('[data-hubaction]').forEach(b=>b.addEventListener('click',()=>actions[b.dataset.hubaction]?.()));

  document.addEventListener('kairo:broadcast',()=>{const b=read(BROAD,{text:''});const bar=$v('#announcementBar');if(bar&&b.text){bar.hidden=false;const t=bar.querySelector('#announcementText'); if(t) t.textContent=b.text;}});
  const initialBroadcast=read(BROAD,{text:''});if(initialBroadcast.text){const bar=$v('#announcementBar');if(bar){bar.hidden=false;const t=bar.querySelector('.announcement-text');if(t)t.textContent=initialBroadcast.text;}}
  window.addEventListener('kairo:activity',e=>{const d=e.detail||{};saveNotif(d.title||'Aktivitas KAIRO',d.text||'Aktivitas baru.')});
})();


/* ===== KAIRO PULSE V4 ===== */
(function(){
  const btn=document.getElementById('kairoPulseBtn'); if(!btn) return;
  const pulseData=()=>{
    const q=s=>document.querySelectorAll(s).length;
    const xp=localStorage.getItem('kairo_xp_v2')||localStorage.getItem('kairo_xp_v1')||'0';
    const visits=localStorage.getItem('kairo_visits_v1')||'0';
    const agenda=JSON.parse(localStorage.getItem('kairo_agenda_v3')||'[]');
    const next=agenda.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0];
    return {trophy:q('.trophy'),talent:q('.talent'),memory:q('.gallery-box'),timeline:q('.timeline-node'),xp,visits,next};
  };
  function open(){
    let m=document.getElementById('pulseModal');
    if(!m){
      m=document.createElement('div');m.id='pulseModal';m.className='admin-modal';
      m.innerHTML='<div class="admin-backdrop" data-pulse-close></div><section class="admin-dialog auth-dialog"><button class="admin-close" data-pulse-close type="button">×</button><p class="eyebrow"><span></span> LIVE DASHBOARD</p><h2>KAIRO <em>Pulse.</em></h2><div id="pulseContent"></div></section>';
      document.body.appendChild(m);
      m.querySelectorAll('[data-pulse-close]').forEach(x=>x.addEventListener('click',()=>{m.hidden=true;document.body.style.overflow=''}));
    }
    const d=pulseData();
    m.querySelector('#pulseContent').innerHTML=`<div class="stat-grid"><div class="stat-box"><b>${d.trophy}</b><small>Prestasi</small></div><div class="stat-box"><b>${d.talent}</b><small>Talent</small></div><div class="stat-box"><b>${d.memory}</b><small>Memory</small></div><div class="stat-box"><b>${d.xp}</b><small>XP</small></div></div><div class="hub-box" style="margin-top:12px"><span class="pulse-dot"></span><strong>LIVE</strong><p>Website sedang aktif. Kunjungan lokal: ${d.visits}.</p><small>${d.next?'Agenda berikutnya: '+d.next.title+' · '+d.next.date:'Belum ada agenda berikutnya.'}</small></div><div class="hub-inline" style="margin-top:12px"><button class="btn btn-primary" id="pulseHub">BUKA HUB ↗</button><button class="reaction-btn" id="pulseParty">🎉 PARTY</button></div>`;
    m.hidden=false;document.body.style.overflow='hidden';
    m.querySelector('#pulseHub').onclick=()=>{m.hidden=true;document.body.style.overflow='';document.getElementById('kairoHubBtn')?.click()};
    m.querySelector('#pulseParty').onclick=()=>document.getElementById('confettiBtn')?.click();
  }
  btn.addEventListener('click',open);
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='j'){e.preventDefault();open()}});
})();
/* KAIRO STHANA — BARBAR PACK + MASCOT AI MODE */
(() => {
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
  const store = (k,v)=>localStorage.setItem(k, JSON.stringify(v));
  const read = (k,d)=>{try{return JSON.parse(localStorage.getItem(k)) ?? d}catch{return d}};
  const esc = v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const toast = msg => { const t=$('#kairoToast'); if(!t)return; t.textContent=msg; t.hidden=false; clearTimeout(window.__kToast); window.__kToast=setTimeout(()=>t.hidden=true,2600); };
  const go = target => { document.querySelector(target)?.scrollIntoView({behavior:'smooth',block:'center'}); };
  const emit = (title,text,icon='✦',target='') => window.dispatchEvent(new CustomEvent('kairo:activity',{detail:{title,text,icon,target}}));

  // ---------- BARBAR STATE ----------
  const STATE='kairo_barbar_v1';
  const state=Object.assign({rooms:[],secrets:[],commands:0,night:false,started:Date.now(),pulse:0},read(STATE,{}));
  const save=()=>store(STATE,state);
  const mark=(arr,id)=>{if(!state[arr].includes(id)){state[arr].push(id);save();return true}return false};
  const xp=(n,r)=>window.addXP?.(n,r);

  // ---------- WORLD MAP / ROOM ENGINE ----------
  const world=$('#kairoWorld');
  function visitRoom(id,title,target){
    mark('rooms',id); state.pulse++; save(); xp(4,`Menjelajah ${title}`); emit(`Masuk ${title}`,`Lu menemukan bagian ${title}.`,'🗺️',target);
    if(id==='terminal') $('#kairoTerminal') && ($('#kairoTerminal').hidden=false, document.body.style.overflow='hidden', $('#terminalInput')?.focus());
    else if(id==='secret') { const s=$('#secretRoom'); if(s){s.hidden=false;document.body.style.overflow='hidden';} }
    else if(id==='core') { if(questSteps.every(x=>state.secrets.includes(x))) openCore(); else toast('KAIRO CORE masih terkunci — cari semua clue.'); }
    else go(target);
    renderWorld();
  }
  function renderWorld(){
    $$('.world-node').forEach(n=>n.classList.toggle('visited',state.rooms.includes(n.dataset.room)));
    const count=$('#worldCount'); if(count) count.textContent=`${state.rooms.length}/8 RUANG TERJELAJAH`;
  }
  world?.addEventListener('click',e=>{const n=e.target.closest('.world-node');if(!n)return;visitRoom(n.dataset.room,n.dataset.title,n.dataset.target)});
  world?.addEventListener('keydown',e=>{const n=e.target.closest('.world-node');if(n&&(e.key==='Enter'||e.key===' ')){e.preventDefault();visitRoom(n.dataset.room,n.dataset.title,n.dataset.target)}});
  renderWorld();

  // ---------- NIGHT MODE ----------
  const nightBtn=$('#nightModeBtn');
  function setNight(on){state.night=on;save();document.body.classList.toggle('night-archive',on); if(nightBtn)nightBtn.textContent=on?'☀️ DAY MODE':'🌙 NIGHT ARCHIVE'; toast(on?'NIGHT ARCHIVE ONLINE':'NIGHT ARCHIVE OFF'); emit(on?'Night Archive aktif':'Kembali ke mode siang',on?'Beberapa easter egg malam kini aktif.':'Mode normal kembali.','🌙');}
  nightBtn?.addEventListener('click',()=>setNight(!state.night));
  setNight(state.night);

  // ---------- ARG / SECRET QUEST ----------
  const questSteps=['markaz','trophy','archive','terminal','core'];
  function revealQuest(id){
    if(mark('secrets',id)){xp(8,`Clue rahasia ditemukan: ${id}`);toast(`CLUE UNLOCKED: ${id.toUpperCase()}`);emit('Clue rahasia ditemukan',`KAIRO ARG: ${id}`,'🕵️');}
    renderQuest();
    if(questSteps.every(x=>state.secrets.includes(x))) openCore();
  }
  function renderQuest(){
    const el=$('#questProgress'); if(!el)return; el.textContent=`${state.secrets.filter(x=>questSteps.includes(x)).length}/${questSteps.length} CLUES`; questSteps.forEach(id=>{$(`[data-clue="${id}"]`)?.classList.toggle('found',state.secrets.includes(id));});
  }
  $$('[data-clue]').forEach(x=>x.addEventListener('click',()=>revealQuest(x.dataset.clue)));
  renderQuest();

  // ---------- TERMINAL ----------
  const terminal=$('#kairoTerminal'); const termOut=$('#terminalOutput'); const termIn=$('#terminalInput');
  const commands={
    help:()=>`COMMANDS: help · status · rooms · secrets · members · trophies · timeline · night · matrix · mirror · core`,
    status:()=>`KAIRO CORE: ONLINE\nROOMS: ${state.rooms.length}/8\nSECRETS: ${state.secrets.length}\nCOMMANDS USED: ${state.commands}\nNIGHT ARCHIVE: ${state.night?'ON':'OFF'}`,
    rooms:()=>`ROOMS VISITED: ${state.rooms.join(', ')||'belum ada'}`,
    secrets:()=>`CLUES: ${state.secrets.join(', ')||'belum ada'}`,
    members:()=>`CIRCLE: ${document.querySelectorAll('.circle-card,.member-card,.member-preview-item').length || 'DATA'} entri terdeteksi.`,
    trophies:()=>`TROPHY ROOM: ${document.querySelectorAll('.trophy').length} display terdeteksi.`,
    timeline:()=>`CHRONICLE: ${document.querySelectorAll('.timeline-node').length} node terdeteksi.`,
    night:()=>{setNight(!state.night);return `NIGHT ARCHIVE ${state.night?'ON':'OFF'}`},
    matrix:()=>`01001011 01000001 01001001 01010010 01001111\nKAIRO SYSTEM IS WATCHING THE ARCHIVE.`,
    mirror:()=>openMirror(),
    core:()=>{if(questSteps.every(x=>state.secrets.includes(x))){openCore();return 'CORE ACCESS GRANTED.'}return 'ACCESS DENIED — cari semua clue dulu.'}
  };
  function terminalRun(raw){const cmd=raw.trim().toLowerCase();if(!cmd)return;state.commands++;save();xp(1,'KAIRO Terminal digunakan');let result=commands[cmd]?commands[cmd]():`UNKNOWN COMMAND: ${cmd}\nKetik help.`; if(result===undefined)result='OK'; termOut.innerHTML+=`<div class="term-line"><span>&gt;</span> ${esc(cmd)}</div><pre>${esc(result)}</pre>`;termOut.scrollTop=termOut.scrollHeight;}
  $('#terminalForm')?.addEventListener('submit',e=>{e.preventDefault();terminalRun(termIn.value);termIn.value='';});
  $('#terminalOpenBtn')?.addEventListener('click',()=>{terminal.hidden=false;document.body.style.overflow='hidden';termIn?.focus();});
  $$('[data-close-terminal]').forEach(x=>x.addEventListener('click',()=>{terminal.hidden=true;document.body.style.overflow=''}));

  // ---------- MIRROR MODE ----------
  function openMirror(){const m=$('#mirrorRoom');if(!m)return; const visits=Number(localStorage.getItem('kairo_visits_v1')||0); const xpNow=Number(localStorage.getItem('kairo_xp_v1')||0); $('#mirrorText').textContent=`Lu sudah berkunjung ${visits}x, mengumpulkan ${xpNow} XP, menjelajah ${state.rooms.length} ruang, dan menemukan ${state.secrets.length} clue rahasia. Jejak ini tersimpan lokal di browser lu.`;m.hidden=false;document.body.style.overflow='hidden';return 'MIRROR OPEN.';}
  $('#mirrorBtn')?.addEventListener('click',openMirror); $$('[data-close-mirror]').forEach(x=>x.addEventListener('click',()=>{$('#mirrorRoom').hidden=true;document.body.style.overflow=''}));

  // ---------- CORE ----------
  function openCore(){const c=$('#kairoCore');if(!c)return;c.hidden=false;document.body.style.overflow='hidden';xp(25,'KAIRO CORE terbuka');emit('KAIRO CORE terbuka','Semua clue ARG berhasil disatukan.','🧬');}
  $$('[data-close-core]').forEach(x=>x.addEventListener('click',()=>{$('#kairoCore').hidden=true;document.body.style.overflow=''}));
  $('#coreUnlockBtn')?.addEventListener('click',()=>{launchConfetti?.(220);toast('KAIRO UNIVERSE: CORE SYNCED');mark('secrets','core');});

  // ---------- DNA / LIVE COMMAND CENTER ----------
  function renderDNA(){
    const xpNow=Number(localStorage.getItem('kairo_xp_v1')||0); const visits=Number(localStorage.getItem('kairo_visits_v1')||0);
    $('#dnaRooms').textContent=state.rooms.length; $('#dnaSecrets').textContent=state.secrets.length; $('#dnaXP').textContent=xpNow; $('#dnaVisits').textContent=visits; $('#dnaLevel').textContent=`EXPLORER LEVEL ${Math.floor(xpNow/25)+1}`;
  }
  $('#dnaBtn')?.addEventListener('click',()=>{renderDNA();$('#dnaRoom').hidden=false;document.body.style.overflow='';xp(3,'KAIRO DNA dilihat');});
  $$('[data-close-dna]').forEach(x=>x.addEventListener('click',()=>$('#dnaRoom').hidden=true));
  setInterval(renderDNA,1800); renderDNA();

  // ---------- MASCOT AI MODE ----------
  const mascot={
    replies:[
      'Eh, lu balik lagi. Gue tadi jagain markaz sendirian 😭',
      'Trophy Room aman. Tapi kayaknya masih ada cerita yang belum dimasukin.',
      'Lu udah nemu Secret Room belum? Jangan bilang belum ya.',
      'Kalau lu bingung, pencet KAIRO HUB. Gue udah nyiapin jalannya.',
      'KAIRO bukan cuma halaman web. Ini arsip yang masih hidup.',
      'Gue bisa ngoceh, tapi kalau lu mau gue diem, tinggal matiin Auto Talk 😭',
      'Coba buka terminal. Jangan takut. Paling juga website doang.',
      'Nih gue kasih misi: temukan semua clue sebelum pergi.',
      'Ada yang bilang gue cuma pajangan. Fitnah. Gue lagi kerja.',
      'Kalau ada data asli KAIRO, masukin. Biar gue nggak cuma ngomong soal placeholder.'
    ],
    userReplies:[
      [/halo|hai|hi|p/, 'Halo juga! Akhirnya ada yang ngajak ngobrol. 😎'],
      [/siapa|kamu/, 'Gue maskot digital KAIRO STHANA. Anggap aja penjaga markaz versi online.'],
      [/kairo/, 'KAIRO STHANA. Kamar Illiyyin Loro. Markaz digitalnya ada di sini.'],
      [/secret|rahasia|clue/, 'Kalau soal rahasia, gue nggak boleh bocorin semua. Cari clue satu-satu. 😏'],
      [/game/, 'Game sudah diusir dari markaz. Lu sendiri yang minta. 😂'],
      [/makasih|terima kasih/, 'Santai. Gue memang dibayar pakai pixel.'],
      [/diam|stop|berhenti/, 'Oke, gue pause dulu. Tombol Auto Talk bisa dipakai kapan aja.']
    ],
    auto:true, voice:true, timer:null, last:-1
  };
  const speech=$('#mascotSpeech'); const aiLog=$('#mascotAiLog'); const input=$('#mascotAiInput'); const aiModal=$('#mascotAiModal');
  function say(text,voice=mascot.voice){
    if(speech)speech.textContent=text; if(aiLog){const d=document.createElement('div');d.className='mascot-msg bot';d.textContent=text;aiLog.appendChild(d);aiLog.scrollTop=aiLog.scrollHeight;while(aiLog.children.length>12)aiLog.firstChild.remove();}
    emit('Maskot AI ngoceh',text,'🤖');
    if(voice && 'speechSynthesis' in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='id-ID';u.rate=.96;u.pitch=1.08;speechSynthesis.speak(u);}
  }
  function reply(text){const low=text.toLowerCase();const found=mascot.userReplies.find(([re])=>re.test(low));return found?found[1]:`Gue nangkep: “${text}”. Kalau maksud lu spesifik, coba tanya lagi dengan kata yang lebih jelas. Gue masih versi browser, jadi otak gue belum sekelas server AI.`;}
  function autoTalk(){if(!mascot.auto||document.hidden)return;let i=Math.floor(Math.random()*mascot.replies.length);if(i===mascot.last)i=(i+1)%mascot.replies.length;mascot.last=i;say(mascot.replies[i]);}
  $('#mascotTalkBtn')?.addEventListener('click',()=>{aiModal.hidden=false;document.body.style.overflow='hidden';say(mascot.replies[Math.floor(Math.random()*mascot.replies.length)],false);});
  $('#mascotAiForm')?.addEventListener('submit',e=>{e.preventDefault();const v=input.value.trim();if(!v)return;const d=document.createElement('div');d.className='mascot-msg user';d.textContent=v;aiLog.appendChild(d);input.value='';say(reply(v));xp(2,'Ngobrol dengan Maskot AI');});
  $('#mascotAutoToggle')?.addEventListener('click',e=>{mascot.auto=!mascot.auto;e.currentTarget.textContent=mascot.auto?'AUTO TALK: ON':'AUTO TALK: OFF';if(mascot.auto)autoTalk();});
  $('#mascotVoiceToggle')?.addEventListener('click',e=>{mascot.voice=!mascot.voice;e.currentTarget.textContent=mascot.voice?'VOICE: ON':'VOICE: OFF';if(!mascot.voice&&'speechSynthesis'in window)speechSynthesis.cancel();});
  $$('[data-close-mascot]').forEach(x=>x.addEventListener('click',()=>{aiModal.hidden=true;document.body.style.overflow='';if('speechSynthesis'in window)speechSynthesis.cancel();}));
  setTimeout(autoTalk,3500); mascot.timer=setInterval(autoTalk,18000);

  // Optional real AI endpoint: set KAIRO_AI_ENDPOINT in config.js to your own backend.
  window.kairoAskRealAI=async function(message){
    const endpoint=window.KAIRO_AI_ENDPOINT;
    if(!endpoint)return null;
    try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,persona:'KAIRO STHANA mascot; friendly Indonesian; concise; playful; never reveal secrets unless allowed'})});if(!r.ok)throw new Error('AI endpoint error');const j=await r.json();return j.reply||j.text||null;}catch(e){return null;}
  };
  let lastUserMessage='';
  $('#mascotAiForm')?.addEventListener('submit',()=>{lastUserMessage=input?.value.trim()||lastUserMessage;});
  $('#mascotRealAiBtn')?.addEventListener('click',async()=>{const v=input?.value.trim()||lastUserMessage;if(!v){toast('Tulis pertanyaan dulu.');return;}const real=await window.kairoAskRealAI(v);if(real){say(real);xp(3,'Maskot AI backend menjawab')}else toast('Real AI belum dikonfigurasi. Local AI tetap aktif.');});

  // ---------- AUTO COMMAND CENTER ----------
  const live=$('#commandClock');
  setInterval(()=>{if(live)live.textContent=new Date().toLocaleTimeString('id-ID',{hour12:false});},1000);
})();
