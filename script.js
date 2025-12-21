// script.js (versión corregida — asegura tridentes en la intro)
// Reemplaza tu script.js por este archivo y recarga (Ctrl+F5).

const cpuName = 'NEXUS';
const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];
const MAX_PLAYS = 3;
const STORAGE_KEY = 'tatetiState_v2';
const INTRO_DURATION = 1600;

let board = Array(9).fill(null);
let playerSymbol = 'X';
let cpuSymbol = 'O';
let currentTurn = 'X';
let running = false;
let cpuThinking = false;
let sessionStarted = false;
let state = { playerWins:0, cpuWins:0, plays:0 };

// DOM refs
let boardEl, cells, messageEl;
let introOverlay, introCard, introParticles;
let loadingBar, loadingText;
let opponentBanner, startBtn;
let playerWinsEl, cpuWinsEl, playerBonusPercentEl, cpuBonusPercentEl, playsLeftEl;
let resultModal, modalPercent, modalMessage, modalClose;
let boardLogo, bgTridents, bgEmojis;

function by(id){ return document.getElementById(id); }
function dbg(...a){ console.debug('[tateti]', ...a); }
function symbolToEmoji(s){ return s === 'X' ? '❌' : (s === 'O' ? '⭕' : s); }
function message(txt){ if(messageEl) messageEl.textContent = txt; }

/* ----------------- Background helpers ----------------- */
function createBgLayer(id){
  let el = by(id);
  if(!el){
    el = document.createElement('div');
    el.id = id;
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.zIndex = '0';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
  }
  return el;
}

function populateBackground(){
  bgTridents = createBgLayer('bgTridents');
  bgEmojis = createBgLayer('bgEmojis');
  bgTridents.innerHTML = '';
  bgEmojis.innerHTML = '';

  const W = Math.max(window.innerWidth, 800);
  const H = Math.max(window.innerHeight, 600);

  const place = (container, count, factory, minDist = 60) => {
    const placed = [];
    const padding = 24;
    for(let i=0;i<count;i++){
      let attempts = 0, x, y, ok;
      do {
        x = Math.random() * (W - padding*2) + padding;
        y = Math.random() * (H - padding*2) + padding;
        ok = true;
        for(const p of placed){
          if(Math.hypot(p.x - x, p.y - y) < minDist){ ok = false; break; }
        }
        attempts++;
      } while(!ok && attempts < 40);
      placed.push({x,y});
      const n = factory();
      n.style.position = 'absolute';
      n.style.left = `${x}px`;
      n.style.top  = `${y}px`;

      // inline animation (name must exist in CSS: tridentIntroFloat)
      n.style.animationName = 'tridentIntroFloat';
      n.style.animationDuration = (4 + Math.random()*4).toFixed(2) + 's';
      n.style.animationDelay = (Math.random()*1.8).toFixed(2) + 's';
      n.style.animationTimingFunction = 'ease-in-out';
      n.style.animationIterationCount = 'infinite';
      n.style.animationDirection = 'alternate';

      container.appendChild(n);
    }
  };

  const trCount = Math.round(Math.max(8, Math.min(30, (W*H)/250000)));
  place(bgTridents, trCount, () => {
    const el = document.createElement('div');
    el.className = 'bg-item trident';
    el.textContent = '🔱';
    el.style.fontSize = `${10 + Math.floor(Math.random()*20)}px`;
    el.style.opacity = (0.03 + Math.random()*0.08).toString();
    el.style.transform = `rotate(${(-12 + Math.random()*24).toFixed(1)}deg)`;
    return el;
  }, 50);

  const emojis = ['⭕','❌','🎁','✨'];
  const emCount = Math.round(Math.max(8, Math.min(18, (W*H)/300000)));
  place(bgEmojis, emCount, () => {
    const el = document.createElement('div');
    el.className = 'bg-item emoji';
    el.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    el.style.fontSize = `${12 + Math.floor(Math.random()*26)}px`;
    el.style.opacity = (0.02 + Math.random()*0.05).toString();
    el.style.transform = `rotate(${(-25 + Math.random()*50).toFixed(1)}deg)`;
    return el;
  }, 40);
}

/* ----------------- Intro particles & loading UI ----------------- */
function ensureIntroUI(){
  introOverlay = introOverlay || by('introOverlay');
  if(!introOverlay){
    // create minimal overlay if missing (so dev/test works)
    introOverlay = document.createElement('div');
    introOverlay.id = 'introOverlay';
    introOverlay.className = 'intro-overlay';
    document.body.appendChild(introOverlay);
  }

  // ensure overlay supports absolute children
  if(getComputedStyle(introOverlay).position === 'static'){
    introOverlay.style.position = 'fixed';
    introOverlay.style.inset = '0';
  }

  introCard = introCard || introOverlay.querySelector('.intro-card');

  introParticles = by('introParticles');
  if(!introParticles){
    introParticles = document.createElement('div');
    introParticles.id = 'introParticles';
    introParticles.style.position = 'absolute';
    introParticles.style.inset = '0';
    introParticles.style.zIndex = '2195';
    introParticles.style.pointerEvents = 'none';
    introOverlay.appendChild(introParticles);
  } else {
    introParticles.style.zIndex = '2195';
    introParticles.style.pointerEvents = 'none';
  }

  loadingBar = by('loadingBar');
  loadingText = by('loadingText');

  if(!loadingBar || !loadingText){
    const outer = document.createElement('div');
    outer.className = 'loading-bar-outer';
    outer.style.width = '72%';
    outer.style.maxWidth = '560px';
    outer.style.height = '12px';
    outer.style.background = 'rgba(0,0,0,0.12)';
    outer.style.borderRadius = '10px';
    outer.style.overflow = 'hidden';
    outer.style.marginTop = '12px';
    outer.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04)';
    outer.style.alignSelf = 'center';

    const inner = document.createElement('div');
    inner.id = 'loadingBar';
    inner.className = 'loading-bar';
    inner.style.height = '100%';
    inner.style.width = '0%';
    inner.style.background = 'linear-gradient(90deg,#ffd9b3,var(--orange-bright))';
    inner.style.borderRadius = '8px';
    outer.appendChild(inner);

    const text = document.createElement('div');
    text.id = 'loadingText';
    text.className = 'loading-text';
    text.style.marginTop = '8px';
    text.style.color = '#fff';
    text.style.fontWeight = '700';
    text.style.textAlign = 'center';
    text.textContent = 'Cargando el juego... 0%';

    if(introCard){
      const logo = introCard.querySelector('#introLogo') || introCard.querySelector('img');
      if(logo && logo.parentNode === introCard){
        logo.insertAdjacentElement('afterend', outer);
        outer.insertAdjacentElement('afterend', text);
      } else {
        introCard.appendChild(outer);
        introCard.appendChild(text);
      }
    } else {
      introOverlay.appendChild(outer);
      introOverlay.appendChild(text);
    }

    loadingBar = inner;
    loadingText = text;
  }
  return true;
}

function populateIntroParticles(){
  ensureIntroUI();
  if(!introParticles) return;
  introParticles.innerHTML = '';

  const rect = introOverlay.getBoundingClientRect();
  const W = Math.max(rect.width, window.innerWidth);
  const H = Math.max(rect.height, window.innerHeight);

  const count = Math.round(Math.max(8, Math.min(18, (W*H)/280000)));

  for(let i=0;i<count;i++){
    const node = document.createElement('div');
    node.className = 'bg-item trident';
    node.textContent = '🔱';

    node.style.position = 'absolute';
    node.style.left = `${Math.random() * Math.max(200, W)}px`;
    node.style.top  = `${Math.random() * Math.max(200, H)}px`;

    const r = Math.random();
    if(r < 0.45) node.style.fontSize = '12px';
    else if(r < 0.86) node.style.fontSize = '16px';
    else node.style.fontSize = '22px';

    node.style.opacity = (0.06 + Math.random()*0.12).toString();
    node.style.transform = `rotate(${(-12 + Math.random()*24).toFixed(1)}deg)`;

    // inline animation using CSS keyframes tridentIntroFloat (make sure CSS has it)
    node.style.animationName = 'tridentIntroFloat';
    node.style.animationDuration = (3 + Math.random()*6).toFixed(2) + 's';
    node.style.animationDelay = (Math.random()*1.6).toFixed(2) + 's';
    node.style.animationTimingFunction = 'ease-in-out';
    node.style.animationIterationCount = 'infinite';
    node.style.animationDirection = 'alternate';

    introParticles.appendChild(node);
  }

  // fade in
  requestAnimationFrame(()=> introParticles.classList.add('visible'));

  // fallback: if none created, create visible test tridents
  if(introParticles.childElementCount === 0){
    for(let i=0;i<6;i++){
      const t = document.createElement('div');
      t.className = 'bg-item trident';
      t.textContent = '🔱';
      t.style.position = 'absolute';
      t.style.left = `${40 + i*60}px`;
      t.style.top = `${80 + i*12}px`;
      t.style.fontSize = '28px';
      t.style.opacity = '0.12';
      introParticles.appendChild(t);
    }
    dbg('Fallback test tridents created.');
  }
}

/* ---------- Loading animation (robusta) ---------- */
function animateLoading(duration){
  return new Promise((resolve)=>{
    if(!ensureIntroUI()){
      setTimeout(resolve, duration);
      return;
    }
    const steps = Math.max(12, Math.round(duration / 60));
    let i = 0;
    if(loadingBar) loadingBar.style.width = '0%';
    if(loadingText) loadingText.textContent = 'Cargando el juego... 0%';
    const interval = setInterval(()=>{
      i++;
      const pct = Math.min(100, Math.round((i / steps) * 100));
      if(loadingBar) loadingBar.style.width = `${pct}%`;
      if(loadingText) loadingText.textContent = `Cargando el juego... ${pct}%`;
      if(pct >= 100){
        clearInterval(interval);
        if(loadingText) loadingText.textContent = 'Listo';
        setTimeout(resolve, 240);
      }
    }, Math.max(40, Math.floor(duration / steps)));
  });
}

/* ---------- Banner control ---------- */
function attachStartListener(){
  startBtn = startBtn || by('startBtn');
  if(!startBtn) return;
  startBtn.type = 'button';
  if(startBtn._h) startBtn.removeEventListener('click', startBtn._h);
  startBtn._h = ()=>{ hideBanner(); startGame(); };
  startBtn.addEventListener('click', startBtn._h);
  startBtn.disabled = false;
  startBtn.classList.remove('disabled');
}
function showBanner(){ const b = by('opponentBanner'); if(!b) return; b.classList.remove('hidden'); b.setAttribute('aria-hidden','false'); }
function hideBanner(){ const b = by('opponentBanner'); if(!b) return; b.classList.add('hidden'); b.setAttribute('aria-hidden','true'); }

/* ---------- Flow ---------- */
async function showIntroThenProceed(){
  ensureIntroUI();
  introOverlay.classList.remove('hidden');
  introOverlay.setAttribute('aria-hidden','false');

  // populate backgrounds and particles BEFORE animating
  populateBackground();
  populateIntroParticles();

  try { await animateLoading(INTRO_DURATION); } catch(e){ console.error('animateLoading', e); }

  // fade out intro particles
  if(introParticles) {
    introParticles.classList.remove('visible');
    setTimeout(()=>{ if(introParticles) introParticles.innerHTML = ''; }, 280);
  }

  introOverlay.classList.add('hidden');
  introOverlay.setAttribute('aria-hidden','true');

  attachStartListener();
  showBanner();
  dbg('Intro finished; banner shown');
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  boardEl = by('board'); cells = Array.from(document.querySelectorAll('.cell')); messageEl = by('message');
  introOverlay = by('introOverlay'); introCard = introOverlay ? introOverlay.querySelector('.intro-card') : null;
  opponentBanner = by('opponentBanner'); startBtn = by('startBtn');
  playerWinsEl = by('playerWins'); cpuWinsEl = by('cpuWins'); playerBonusPercentEl = by('playerBonusPercent'); cpuBonusPercentEl = by('cpuBonusPercent'); playsLeftEl = by('playsLeft');
  resultModal = by('resultModal'); modalPercent = by('modalPercent'); modalMessage = by('modalMessage'); modalClose = by('modalClose');
  boardLogo = by('boardLogo');

  if(!boardEl || !cells.length || !messageEl){
    console.error('FATAL: elementos faltantes');
    return;
  }

  if(modalClose) modalClose.addEventListener('click', ()=>{ if(resultModal) resultModal.classList.add('hidden'); });
  cells.forEach(c => c.addEventListener('click', onCellClick));
  document.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !sessionStarted && opponentBanner && !opponentBanner.classList.contains('hidden')){ hideBanner(); startGame(); } });

  setActiveChoice(); loadState(); resetBoardUI();

  // initial hidden states
  if(introOverlay) introOverlay.classList.add('hidden');
  if(opponentBanner) opponentBanner.classList.add('hidden');
  if(resultModal) resultModal.classList.add('hidden');

  // prepare visuals (so tridents are ready even before showing intro)
  try{ populateBackground(); }catch(e){ dbg('populateBackground error', e); }
  try{ populateIntroParticles(); }catch(e){ dbg('populateIntroParticles error', e); }

  // ensure responsive regeneration
  window.addEventListener('resize', ()=>{ try{ populateBackground(); populateIntroParticles(); }catch(e){} });

  if(state.plays >= MAX_PLAYS){
    const bp = bonusPercent(state.playerWins);
    if(modalPercent) modalPercent.textContent = `${bp}%`;
    if(modalMessage) modalMessage.textContent = (bp>0)?`Has obtenido ${bp}% por ${state.playerWins} victoria(s).`:`No obtuviste bono (0 victorias).`;
    if(resultModal) resultModal.classList.remove('hidden');
  } else {
    await showIntroThenProceed();
  }

  attachStartListener();
  dbg('Init complete');
});

/* ---------- Game logic (unchanged) ---------- */
/* ... keep the rest of your game logic functions below (handleEnd, cpu moves, etc.) ... */

// The remaining functions (game logic) should be kept as in your previous file.
// (I left them out here for brevity but make sure they are present in your final script.)
