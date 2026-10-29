/* ===== 에이도 v2 (2026-10-29): 체험 3개 + 공통 동작 =====
   3D 인트로는 intro3d.js. 여기서는 촬영·통역·통화 체험, 등장 효과, 버튼 연결. */
(function(){
  const $ = s => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- 공통: 메뉴, 등장 효과 ---------- */
  const nav = $('#nav');
  addEventListener('scroll', () => nav.classList.toggle('is-solid', scrollY > innerHeight * 6), { passive:true });

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) {
      const sib = [...e.target.parentElement.children].filter(x => x.classList.contains('reveal'));
      e.target.style.transitionDelay = (Math.max(0, sib.indexOf(e.target)) % 8) * 70 + 'ms';
      e.target.classList.add('is-in'); io.unobserve(e.target);
    }
  }), { threshold:.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  const turns = [...document.querySelectorAll('.turn')];
  let ti = 0;
  if (!reduce && turns.length > 1) setInterval(() => {
    turns[ti].classList.remove('is-on'); ti = (ti + 1) % turns.length; turns[ti].classList.add('is-on');
  }, 2600);

  const C = window.EIDO_CONFIG || {};
  const mail = C.CONTACT_EMAIL || '';
  document.querySelectorAll('.js-mail').forEach(a => { a.textContent = mail; a.href = 'mailto:' + mail; });
  document.querySelectorAll('.js-cta').forEach(a => {
    if (C.WADIZ_URL) { a.href = C.WADIZ_URL; a.target = '_blank'; a.rel = 'noopener'; }
    else if (a.closest('#notify')) { a.href = 'mailto:' + mail + '?subject=' + encodeURIComponent('에이도 출시 알림 신청'); }
  });

  /* ---------- 소리 도우미 ---------- */
  let actx;
  const audio = () => (actx ||= new (window.AudioContext || window.webkitAudioContext)());
  function shutterSound(){
    try {
      const ctx = audio(), t = ctx.currentTime;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(f).connect(g).connect(ctx.destination); src.start(t);
    } catch(e){}
  }
  const voices = () => (window.speechSynthesis ? speechSynthesis.getVoices() : []);
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
  // 좋은 목소리 우선 (macOS/Chrome/Windows). 'Albert', 'Bad News' 같은 장난 음성(쇳소리)은 제외.
  const GOOD = {
    en: ['Samantha','Google US English','Microsoft Aria Online','Microsoft Jenny','Microsoft Zira','Karen','Daniel','Moira','Tessa','Google UK English Female','Google UK English Male'],
    ja: ['Kyoko','O-ren','Google 日本語','Microsoft Nanami','Microsoft Ayumi','Hattori'],
    zh: ['Tingting','Meijia','Google 普通话（中国大陆）','Microsoft Xiaoxiao','Microsoft Huihui','Sinji'],
    vi: ['Linh','Google Tiếng Việt','Microsoft HoaiMy'],
    ko: ['유나','Yuna','Google 한국의','Microsoft SunHi','Microsoft Heami'],
  };
  const BAD = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Fred|Good News|Jester|Junior|Kathy|Organ|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/i;
  function pickVoice(lang){
    const all = voices(); if (!all.length) return null;
    const l2 = lang.toLowerCase().slice(0,2);
    const norm = v => (v.lang||'').replace('_','-').toLowerCase();
    const same = all.filter(v => norm(v).startsWith(l2));
    for (const name of GOOD[l2] || []) { const v = same.find(v => v.name === name || v.name.startsWith(name)); if (v) return v; }
    const ok = same.filter(v => !BAD.test(v.name));
    return ok.find(v => norm(v) === lang.toLowerCase()) || ok[0] || same[0] || null;
  }
  function speak(text, lang, { volume = 1, rate = 1, pitch = 1 } = {}){
    return new Promise(res => {
      const fallback = 900 + text.length * 85;
      if (!window.speechSynthesis) return setTimeout(res, fallback);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang; u.volume = volume; u.rate = rate; u.pitch = pitch;
      const v = pickVoice(lang);
      if (v) u.voice = v;
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, fallback + 4000);
      speechSynthesis.speak(u);
    });
  }

  /* ---------- 체험 1: 촬영 ---------- */
  const flash = $('#flash'), gallery = $('#gallery'), toast = $('#toast'), ledNote = $('#ledNote');
  const recBadge = $('#recBadge'), recTime = $('#recTime'), btnVideo = $('#btnVideo');
  let toastT;
  function showToast(msg){ toast.textContent = msg; toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), 1800); }
  function led(on){ ledNote.classList.toggle('on', on); }
  function addThumb(isVideo, dur){
    $('#galleryEmpty')?.remove();
    const bx = 25 + Math.random() * 50, by = 25 + Math.random() * 40;
    const th = document.createElement('div');
    th.className = 'thumb' + (isVideo ? ' vid' : '');
    th.style.backgroundImage = 'url(pov_shoot.jpg)';
    th.style.backgroundPosition = `${bx}% ${by}%`;
    th.dataset.kind = isVideo ? 'video' : 'photo'; th.dataset.bx = bx; th.dataset.by = by;
    th.setAttribute('role', 'button'); th.tabIndex = 0; th.title = isVideo ? '영상 재생' : '사진 보기';
    th.style.backgroundSize = '170%';
    if (isVideo) { th.dataset.dur = dur; th.style.backgroundSize = 'cover'; th.style.backgroundPosition = '50% 40%'; }
    // 화면 가운데에서 폰 갤러리로 날아가는 효과
    const sec = $('#exp-shoot').getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'fly';
    fly.style.backgroundImage = 'url(pov_shoot.jpg)';
    fly.style.backgroundPosition = `${bx}% ${by}%`;
    fly.style.backgroundSize = isVideo ? 'cover' : '170%';
    const w = Math.min(420, innerWidth * .5), h = w * 0.6;
    Object.assign(fly.style, { width: w + 'px', height: h + 'px', left: (sec.left + sec.width/2 - w/2) + 'px', top: (Math.max(sec.top, 0) + Math.min(sec.height, innerHeight)/2 - h/2) + 'px' });
    document.body.appendChild(fly);
    gallery.prepend(th);
    while (gallery.children.length > 10) gallery.lastChild.remove();
    th.style.visibility = 'hidden';
    const to = th.getBoundingClientRect(), from = fly.getBoundingClientRect();
    const anim = fly.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`, opacity: .9 }
    ], { duration: reduce ? 1 : 750, easing: 'cubic-bezier(.6,0,.2,1)', delay: 150 });
    fly.style.transformOrigin = '0 0';
    anim.onfinish = () => { fly.remove(); th.style.visibility = 'visible'; showToast(isVideo ? `영상 ${dur} · Wi-Fi로 폰에 저장됨` : '사진 · Wi-Fi로 폰에 저장됨'); };
  }
  $('#btnPhoto').addEventListener('click', () => {
    if (recording) return;
    shutterSound();
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    led(true); setTimeout(() => led(false), 700);
    addThumb(false);
  });
  let recording = false, recStart = 0, recTimer;
  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  btnVideo.addEventListener('click', () => {
    recording = !recording;
    btnVideo.classList.toggle('on', recording);
    btnVideo.querySelector('b').textContent = recording ? '멈추기' : '영상';
    recBadge.classList.toggle('on', recording);
    led(recording);
    if (recording) {
      shutterSound(); recStart = Date.now(); recTime.textContent = '00:00';
      recTimer = setInterval(() => {
        const s = Math.floor((Date.now() - recStart) / 1000);
        recTime.textContent = fmt(s);
        if (s >= 720) btnVideo.click();
      }, 250);
    } else {
      clearInterval(recTimer);
      const s = Math.max(1, Math.floor((Date.now() - recStart) / 1000));
      addThumb(true, fmt(s));
    }
  });

  /* ---------- 체험 2: 통역 ---------- */
  const LANGS = {
    ja: { label:'日本語', tts:'ja-JP', name:'일본어' },
    zh: { label:'中文', tts:'zh-CN', name:'중국어' },
    vi: { label:'Tiếng Việt', tts:'vi-VN', name:'베트남어' },
    en: { label:'English', tts:'en-US', name:'영어' },
  };
  const PHRASES = [
    { ko:'이거 얼마예요?',
      t:{ ja:'これはいくらですか？', zh:'这个多少钱？', vi:'Cái này bao nhiêu tiền?', en:'How much is this?' },
      r:{ ja:['一本三百円です。','한 개에 300엔이에요.'], zh:['一串十块钱。','한 꼬치에 10위안이에요.'], vi:['Ba mươi nghìn một xiên.','한 꼬치에 3만 동이에요.'], en:["It's five dollars each.",'하나에 5달러예요.'] } },
    { ko:'덜 맵게 해 주세요.',
      t:{ ja:'辛さを控えめにしてください。', zh:'请少放点辣。', vi:'Làm ít cay giúp tôi nhé.', en:'Less spicy, please.' },
      r:{ ja:['はい、控えめにしますね。','네, 덜 맵게 해 드릴게요.'], zh:['好的，少放辣。','네, 덜 맵게 할게요.'], vi:['Vâng, tôi sẽ làm ít cay.','네, 덜 맵게 해 드릴게요.'], en:["Sure, I'll make it mild.",'네, 순하게 해 드릴게요.'] } },
    { ko:'추천 메뉴가 뭐예요?',
      t:{ ja:'おすすめは何ですか？', zh:'有什么推荐的吗？', vi:'Món nào ngon nhất ạ?', en:'What do you recommend?' },
      r:{ ja:['一番人気はつくねです。','제일 인기 있는 건 츠쿠네예요.'], zh:['羊肉串卖得最好。','양꼬치가 제일 잘 팔려요.'], vi:['Thịt nướng bán chạy nhất.','고기 꼬치가 제일 잘 팔려요.'], en:['The chicken skewers are our best seller.','닭꼬치가 제일 잘 팔려요.'] } },
  ];
  let lang = 'ja', busy = false;
  const langRow = $('#langRow'), phraseRow = $('#phraseRow'), status = $('#talkStatus'), log = $('#talkLog'), snd = $('#sndTalk');
  Object.entries(LANGS).forEach(([k, v]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = v.label; b.setAttribute('role','radio');
    b.classList.toggle('on', k === lang);
    b.onclick = () => { if (busy) return; lang = k; [...langRow.children].forEach(x => x.classList.toggle('on', x === b)); };
    langRow.appendChild(b);
  });
  PHRASES.forEach(ph => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = ph.ko;
    b.onclick = () => runTalk(ph);
    phraseRow.appendChild(b);
  });
  const eq = '<span class="eq"><i></i><i></i><i></i><i></i></span>';
  // 장면 자막 (폰 대신, 2026-10-29 v10)
  const tcap = $('#tcap'), tcTag = $('#tcTag'), tcOrig = $('#tcOrig'), tcMain = $('#tcMain'), talkSec = $('#exp-talk');
  function cap(who, tag, orig, main){
    if (!tcap) return;
    tcap.classList.remove('show'); void tcap.offsetWidth;
    tcap.dataset.who = who; tcTag.textContent = tag; tcOrig.textContent = orig || ''; tcMain.textContent = main;
    tcap.classList.add('show', 'talking');
    talkSec.classList.toggle('them-talk', who === 'them');
  }
  function capQuiet(){ tcap && tcap.classList.remove('talking'); talkSec && talkSec.classList.remove('them-talk'); }
  // 야시장 배경음 (amb_market.m4a: 군중 웅성거림 + 철판 지글지글 + 숯불. Mixkit 무료 효과음 합성, 40초 루프)
  let amb, ambBuf, ambLoading, ambOffT;
  const AMB_LEVEL = 0.55, AMB_DUCK = 0.3;
  async function loadAmb(){
    if (ambBuf || ambLoading) return ambLoading;
    ambLoading = (async () => {
      try { const ctx = audio(); const ab = await (await fetch('amb_market.m4a')).arrayBuffer(); ambBuf = await ctx.decodeAudioData(ab); }
      catch(e){ ambBuf = null; }
    })();
    return ambLoading;
  }
  function ambience(on){
    try {
      const ctx = audio(); clearTimeout(ambOffT);
      if (on && !amb) {
        amb = { g: ctx.createGain() }; amb.g.gain.value = 0; amb.g.connect(ctx.destination);
        const start = () => {
          if (!amb || amb.src) return;
          if (ambBuf) {
            const src = ctx.createBufferSource(); src.buffer = ambBuf; src.loop = true;
            src.connect(amb.g); src.start(0, Math.random() * (ambBuf.duration - 5)); amb.src = src;
          } else { // 파일을 못 읽으면 예전 합성 웅성거림으로 대체
            const len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); let l = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; l = (l + 0.04 * w) / 1.04; d[i] = l * 2.2; } }
            const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
            src.connect(bp).connect(amb.g); src.start(); amb.src = src;
          }
          amb.g.gain.cancelScheduledValues(ctx.currentTime);
          amb.g.gain.setValueAtTime(0, ctx.currentTime);
          amb.g.gain.linearRampToValueAtTime(busy ? AMB_DUCK : AMB_LEVEL, ctx.currentTime + 1.2);
        };
        ambBuf ? start() : loadAmb().then(start);
      } else if (!on && amb) {
        const a = amb; amb = null;
        a.g.gain.cancelScheduledValues(ctx.currentTime);
        a.g.gain.setValueAtTime(a.g.gain.value, ctx.currentTime);
        a.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.5);
        setTimeout(() => { try { a.src && a.src.stop(); } catch(e){} }, 2700);
      }
    } catch(e){}
  }
  // 사람이 말할 때는 배경음을 살짝 낮춘다 (덕킹)
  function ambDuck(down){
    try { if (!amb || !amb.src) return; const ctx = audio(); const g = amb.g.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(g.value, ctx.currentTime); g.linearRampToValueAtTime(down ? AMB_DUCK : AMB_LEVEL, ctx.currentTime + 0.5); } catch(e){}
  }
  // 통역 섹션이 화면에서 벗어나면 배경음 끄기
  if (talkSec && 'IntersectionObserver' in window) {
    new IntersectionObserver(es => { es.forEach(e => { if (!e.isIntersecting && amb) ambience(false); }); }, { threshold: 0.05 }).observe(talkSec);
  }
  // 소리 켜기를 켠 상태에서 통역 섹션에 들어오면 배경음 파일을 미리 읽어둔다
  snd && snd.addEventListener('change', () => { if (snd.checked) loadAmb(); else ambience(false); });
  function addMsg(cls, main, sub){
    if (!log) return;
    log.querySelector('.empty')?.remove();
    const m = document.createElement('div'); m.className = 'msg ' + cls;
    m.innerHTML = `${main}${sub ? `<small>${sub}</small>` : ''}`;
    log.appendChild(m);
    while (log.children.length > 6) log.firstChild.remove();
  }
  async function runTalk(ph){
    if (busy) return; busy = true;
    [...phraseRow.children].forEach(b => b.disabled = true);
    const L = LANGS[lang], on = snd.checked;
    const out = ph.t[lang], [rep, repKo] = ph.r[lang];
    if (on) { ambience(true); ambDuck(true); }
    status.innerHTML = `${eq} 내 말: "${ph.ko}"`;
    cap('me', '나 · 한국어', '', ph.ko);
    await sleep(900);
    status.innerHTML = `${eq} 에이도가 ${L.name}로 말하는 중`;
    cap('me', `에이도 → 상대에게 · ${L.name}`, ph.ko, out);
    on ? await speak(out, L.tts, { rate: .95 }) : await sleep(1500);
    capQuiet();
    status.innerHTML = `${eq} 상대가 대답합니다`;
    await sleep(450);
    cap('them', `상대 · ${L.name}`, '', rep);
    on ? await speak(rep, L.tts, { rate: 1.0, volume: .9, pitch: .88 }) : await sleep(1500);
    status.innerHTML = `${eq} 내 귀에 한국어로`;
    cap('them', '내 귀에 · 한국어', rep, repKo);
    on ? await speak(repKo, 'ko-KR', { rate: 1.05 }) : await sleep(1500);
    capQuiet();
    if (on) { ambDuck(false); ambOffT = setTimeout(() => { if (!busy) ambience(false); }, 12000); }
    status.textContent = '다른 문장도 눌러 보세요.';
    [...phraseRow.children].forEach(b => b.disabled = false);
    busy = false;
  }

  /* ---------- 체험 3: 골전도 통화 ---------- */
  let mode = 'bone', playing = false, level = { noise: 0, voice: 0 };
  document.querySelectorAll('.seg button').forEach(b => b.onclick = () => {
    mode = b.dataset.mode; document.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b));
  });
  const wave = $('#wave'), wctx = wave.getContext('2d');
  let phase = 0;
  function drawWave(){
    const W = wave.width, H = wave.height; wctx.clearRect(0, 0, W, H);
    phase += 0.08;
    const tn = playing ? (mode === 'air' ? 1 : 0.08) : 0.05;
    const tv = playing && level.speaking ? (mode === 'air' ? 0.55 : 1) : 0;
    level.noise += (tn - level.noise) * 0.1; level.voice += (tv - level.voice) * 0.12;
    // 소음 (회색, 거친 선)
    wctx.strokeStyle = 'rgba(255,255,255,.28)'; wctx.lineWidth = 2; wctx.beginPath();
    for (let x = 0; x <= W; x += 6) { const y = H/2 + (Math.random()*2-1) * H * 0.42 * level.noise; x ? wctx.lineTo(x, y) : wctx.moveTo(x, y); }
    wctx.stroke();
    // 목소리 (금색, 부드러운 선)
    wctx.strokeStyle = '#f5f5f3'; wctx.lineWidth = 3.5; wctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const env = Math.sin(x / W * Math.PI);
      const y = H/2 + Math.sin(x * 0.045 + phase * 3) * Math.sin(x * 0.011 + phase) * H * 0.38 * level.voice * env;
      x ? wctx.lineTo(x, y) : wctx.moveTo(x, y);
    }
    wctx.stroke();
    requestAnimationFrame(drawWave);
  }
  drawWave();
  $('#btnCall').addEventListener('click', async () => {
    if (playing) return; playing = true;
    let src, g;
    try {
      const ctx = audio(); await ctx.resume();
      const len = ctx.sampleRate * 6, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0; // 바람·차 소리(브라운 노이즈)
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      g = ctx.createGain(); const t = ctx.currentTime;
      const target = mode === 'air' ? 0.9 : 0.05;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(target, t + 0.4);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.35; lg.gain.value = target * 0.4;
      lfo.connect(lg).connect(g.gain); lfo.start();
      src.connect(lp).connect(g).connect(ctx.destination); src.start();
    } catch(e){}
    await sleep(900);
    level.speaking = true;
    await speak('여보세요? 지금 다리 위인데요, 제 목소리 잘 들려요?', 'ko-KR', { volume: mode === 'air' ? 0.45 : 1, rate: 1.02 });
    level.speaking = false;
    await sleep(500);
    try { const ctx = audio(); g.gain.cancelScheduledValues(ctx.currentTime); g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5); setTimeout(() => src.stop(), 600); } catch(e){}
    playing = false;
  });
})();

/* ---------- 체험 4: 렌즈 바꿔 끼우기 (v6) ---------- */
(function(){
  const stage = document.getElementById('lensStage'); if (!stage) return;
  const base = document.getElementById('lsBase'), tint = document.getElementById('lsTint');
  const tag = document.getElementById('lsTag'), desc = document.getElementById('lensDesc');
  const L = {
    blue:  { img:'lens_blue.jpg',  tag:'렌즈 안쪽 · 블루라이트 차단', desc:'화면 앞에서 오래 일할 때. 모니터의 차가운 빛을 덜어 줍니다.' },
    sun:   { img:'lens_sun.jpg',   tag:'렌즈 안쪽 · 선글라스',       desc:'햇빛 강한 야외에서. 눈부심을 줄여 줍니다.' },
    photo: { img:'lens_photo.jpg', tag:'렌즈 안쪽 · 변색 (실내 → 실외)', desc:'실내에선 밝게, 햇빛 아래에선 스스로 어두워집니다. 하나로 안팎을 오갈 때.' },
  };
  [L.sun.img, L.photo.img].forEach(src => { const i = new Image(); i.src = src; });
  document.querySelectorAll('.lens-tabs button').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.type, d = L[t];
    document.querySelectorAll('.lens-tabs button').forEach(x => x.classList.toggle('on', x === b));
    stage.dataset.type = t; base.src = d.img; tint.src = d.img; tag.textContent = d.tag; desc.textContent = d.desc;
  }));
})();

/* ---------- v8: 첫 화면 뷰파인더 타임코드 ---------- */
(function(){
  const tc = document.getElementById('heroTC'); if (!tc) return;
  const t0 = performance.now(), p2 = n => String(n).padStart(2, '0');
  (function tick(now){
    const f = Math.floor((now - t0) / (1000 / 30)), s = Math.floor(f / 30);
    tc.textContent = `${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}:${p2(f % 30)}`;
    if (window.scrollY < innerHeight * 1.5) requestAnimationFrame(tick); else setTimeout(() => requestAnimationFrame(tick), 500);
  })(t0);
})();


/* ---------- v9: 갤러리 사진·영상 누르면 실제로 보기/재생 ---------- */
(function(){
  const gallery = document.getElementById('gallery'), vw = document.getElementById('viewer');
  if (!gallery || !vw) return;
  const photo = document.getElementById('vwPhoto'), vid = document.getElementById('vwVideo');
  const meta = document.getElementById('vwMeta'), bar = document.getElementById('vwBar'), prog = document.getElementById('vwProg');
  const time = document.getElementById('vwTime'), pp = document.getElementById('vwPlay');
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  let total = 0, elapsed = 0, last = 0, playing = false, raf;
  function tick(now){
    if (!playing) return;
    elapsed += (now - last) / 1000; last = now;
    if (elapsed >= total) { elapsed = total; stop(true); }
    prog.style.transform = `scaleX(${total ? elapsed / total : 0})`;
    time.textContent = `${fmt(elapsed)} / ${fmt(total)}`;
    if (playing) raf = requestAnimationFrame(tick);
  }
  function play(){ if (elapsed >= total) { elapsed = 0; vid.currentTime = 0; } playing = true; last = performance.now(); vid.play().catch(()=>{}); pp.classList.add('on'); pp.setAttribute('aria-label', '일시정지'); raf = requestAnimationFrame(tick); }
  function stop(end){ playing = false; vid.pause(); pp.classList.remove('on'); pp.setAttribute('aria-label', '재생'); cancelAnimationFrame(raf); if (end) vw.classList.add('ended'); }
  vid.addEventListener('ended', () => { if (playing && elapsed < total) { vid.currentTime = 0; vid.play().catch(()=>{}); } }); // 10초 넘는 영상은 이어서 반복
  pp.addEventListener('click', e => { e.stopPropagation(); vw.classList.remove('ended'); playing ? stop() : play(); });
  vid.addEventListener('click', () => pp.click());
  function open(th){
    vw.classList.remove('ended');
    const isV = th.dataset.kind === 'video';
    vw.dataset.kind = th.dataset.kind; vw.hidden = false; requestAnimationFrame(() => vw.classList.add('show'));
    document.body.style.overflow = 'hidden';
    if (isV) {
      const [m, s] = (th.dataset.dur || '00:02').split(':').map(Number); total = Math.max(1, m * 60 + s); elapsed = 0;
      meta.innerHTML = `<b>영상</b> 2.5K · ${fmt(total)} · Wi-Fi로 폰에 저장됨`;
      vid.currentTime = 0; time.textContent = `00:00 / ${fmt(total)}`; prog.style.transform = 'scaleX(0)';
      play();
    } else {
      photo.style.backgroundPosition = `${th.dataset.bx}% ${th.dataset.by}%`;
      meta.innerHTML = '<b>사진</b> 2,000만 화소 · Wi-Fi로 폰에 저장됨';
    }
  }
  function close(){ stop(); vw.classList.remove('show'); document.body.style.overflow = ''; setTimeout(() => { vw.hidden = true; }, 250); }
  gallery.addEventListener('click', e => { const th = e.target.closest('.thumb'); if (th) open(th); });
  gallery.addEventListener('keydown', e => { const th = e.target.closest('.thumb'); if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(th); } });
  vw.addEventListener('click', e => { if (e.target === vw || e.target.closest('.vw-close')) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !vw.hidden) close(); });
})();
