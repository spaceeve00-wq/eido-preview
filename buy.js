// 에이도 구입 페이지: 렌즈 선택 → 이미지·요약 바 변경 (2026-10-30)
(function(){
  const C = window.EIDO_CONFIG || {};
  const mail = C.CONTACT_EMAIL || '';
  document.querySelectorAll('.js-mail').forEach(a => { a.textContent = mail; a.href = 'mailto:' + mail; });
  document.querySelectorAll('.js-cta').forEach(a => {
    if (C.WADIZ_URL) { a.href = C.WADIZ_URL; a.target = '_blank'; a.rel = 'noopener'; }
    else { a.href = 'index.html#notify'; }
  });
  const L = {
    blue:  { name: '블루라이트 차단', img: 'buy_blue.webp' },
    sun:   { name: '선글라스',       img: 'buy_sun.webp' },
    photo: { name: '변색',           img: 'buy_photo.webp' },
  };
  Object.values(L).forEach(d => { const i = new Image(); i.src = d.img; });
  const img = document.getElementById('buyImg'), stage = document.getElementById('buyStage');
  const cap = document.getElementById('buyCap'), bar = document.getElementById('barLens');
  const opts = [...document.querySelectorAll('.opt[data-lens]')];
  function pick(k){
    const d = L[k]; if (!d) return;
    opts.forEach(o => { const on = o.dataset.lens === k; o.classList.toggle('on', on); o.setAttribute('aria-checked', on); });
    stage.dataset.lens = k; cap.textContent = d.name + ' 렌즈'; bar.textContent = d.name; const bx = document.getElementById('boxLens'); if (bx) bx.textContent = d.name;
    img.classList.add('is-swap');
    setTimeout(() => { img.src = d.img; img.alt = '에이도 정면, ' + d.name + ' 렌즈'; img.classList.remove('is-swap'); }, 180);
  }
  opts.forEach(o => o.addEventListener('click', () => pick(o.dataset.lens)));
})();
