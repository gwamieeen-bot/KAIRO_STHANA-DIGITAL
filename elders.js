/* Perpustakaan biografi sesepuh — data contoh, silakan ganti dengan data terverifikasi. */
(() => {
  const records = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    name: `Nama Sesepuh 0${i + 1}`,
    role: i === 0 ? 'Pendiri / Pengasuh' : 'Pengasuh',
    born: '—', died: '—', period: '—',
    bio: 'Biografi belum ditambahkan. Isi bagian ini dengan kisah hidup sesepuh berdasarkan sumber yang dapat dipertanggungjawabkan.',
    edu: 'Data pendidikan belum ditambahkan.',
    contrib: 'Data peran dan kontribusi belum ditambahkan.',
    legacy: 'Nilai dan warisan keteladanan belum ditambahkan.'
  }));
  const cards = [...document.querySelectorAll('.elder-card')];
  const search = document.querySelector('#elderSearch');
  const count = document.querySelector('#elderCount');
  const noResults = document.querySelector('#elderNoResults');
  const modal = document.querySelector('#elderModal');
  const body = document.querySelector('#elderModalBody');
  let activeRecord = records[0];
  let activeTab = 'bio';

  const renderBody = () => {
    if (!activeRecord || !body) return;
    body.textContent = activeRecord[activeTab] || 'Data belum ditambahkan.';
    document.querySelectorAll('[data-elder-tab]').forEach(btn => {
      const active = btn.dataset.elderTab === activeTab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
  };
  const openRecord = (record) => {
    if (!record || !modal) return;
    activeRecord = record;
    activeTab = 'bio';
    document.querySelector('#elderModalName').textContent = record.name;
    document.querySelector('#elderModalRole').textContent = record.role;
    document.querySelector('#elderModalAvatar').textContent = 'KS';
    document.querySelector('#elderModalBorn').textContent = record.born;
    document.querySelector('#elderModalDied').textContent = record.died;
    document.querySelector('#elderModalPeriod').textContent = record.period;
    renderBody();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.elder-detail-close')?.focus();
  };
  const closeModal = () => {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  };
  cards.forEach(card => {
    const record = records[Number(card.dataset.elder)];
    const open = () => openRecord(record);
    card.addEventListener('click', open);
    card.querySelector('button')?.addEventListener('click', e => { e.stopPropagation(); open(); });
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  search?.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase('id');
    let visible = 0;
    cards.forEach((card, i) => {
      const match = records[i].name.toLocaleLowerCase('id').includes(query) || records[i].role.toLocaleLowerCase('id').includes(query);
      card.hidden = !match;
      if (match) visible++;
    });
    if (count) count.textContent = `${visible} arsip${query ? ' ditemukan' : ' contoh'}`;
    if (noResults) noResults.hidden = visible !== 0;
  });
  document.querySelectorAll('[data-elder-tab]').forEach(btn => btn.addEventListener('click', () => {
    activeTab = btn.dataset.elderTab;
    renderBody();
  }));
  modal?.querySelectorAll('[data-close-elder]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && search) {
      e.preventDefault(); search.focus(); search.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
})();
