// script.js — versión segura y corregida. Reemplazá completamente tu script.js por este archivo.
// Luego recargá con Ctrl+F5.

console.log('[tateti] script start');

const cpuName = 'NEXUS';
const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];
const MAX_PLAYS = 3;
const STORAGE_KEY = 'tatetiState_v2';
const DATE_KEY = 'tatetiLastDate_v1';
const INTRO_DURATION = 1600;

let board = Array(9).fill(null);
let playerSymbol = 'X';
let cpuSymbol = 'O';
let currentTurn = 'X';
let running = false;
let cpuThinking = false;
let sessionStarted = false;
let state = { playerWins:0, cpuWins:0, plays:0 };

// DOM refs (populated on DOMContentLoaded)
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

/* ---------- Daily helpers ---------- */
function getTodayKey(){
  return (new Date()).toISOString().slice(0,10); // YYYY-MM-DD
}

// Devuelve el texto final del premio según victorias (sólo esta función es nueva)
function finalBonusText(w) {
  if (!w || w <= 0) return { percent: 0, text: 'No obtuviste bono (0 victorias).' };
  if (w === 1) return { percent: 100, text: 'BONO DEL 100% + 1000 FICHAS GRATIS👀' };
  if (w === 2) return { percent: 150, text: 'BONO DEL 150% + 1500 FICHAS GRATIS🧐' };
  return          { percent: 200, text: 'BONO DEL 200% + 2000 FICHAS GRATIS🤯' };
}

/* ---------- Persistence ---------- */
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) state = JSON.parse(raw);
  }catch(e){
    state = {playerWins:0,cpuWins:0,plays:0};
  }
  updateScoreboardUI();
  updatePlaysUI();
  checkPlaysLimitUI();
}
function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }

/* ---------- Daily reset ---------- */
function checkAndResetDaily(){
  const today = getTodayKey();
  const last = localStorage.getItem(DATE_KEY);
  if(last !== today){
    state.plays = 0;
    state.playerWins = 0;
    state.cpuWins = 0;
    saveState();
    localStorage.setItem(DATE_KEY, today);
    dbg('Applied daily reset for', today);
  }
  updateScoreboardUI();
  updatePlaysUI();
  checkPlaysLimitUI();
}
function scheduleMidnightReset(){
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0, 0, 2);
  const ms = next - now;
  if(ms <= 0){
    setTimeout(()=>{ checkAndResetDaily(); scheduleMidnightReset(); }, 60*1000);
    return;
  }
  setTimeout(()=>{ checkAndResetDaily(); updateDateUI(); scheduleMidnightReset(); }, ms);
}

/* ---------- Background helpers ---------- */
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
  bgEmojis  = createBgLayer('bgEmojis');

  if(bgEmojis){
    bgEmojis.style.setProperty('display','block','important');
    bgEmojis.style.pointerEvents = 'none';
    bgEmojis.style.zIndex = '0';
  }

  if(bgTridents) bgTridents.innerHTML = '';
  if(bgEmojis)  bgEmojis.innerHTML = '';

  const W = Math.max(window.innerWidth, 800);
  const H = Math.max(window.innerHeight, 600);
  const mobile = window.innerWidth <= 480;
  const densityFactor = mobile ? 0.35 : 1;

  function place(container, count, factory, minDist = 60){
    if(!container) return;
    const placed = [];
    const padding = mobile ? 12 : 24;
    const N = Math.max(3, Math.round(count * densityFactor));
    for(let i=0;i<N;i++){
      let attempts = 0, x, y, ok;
      do {
        x = Math.random() * (W - padding*2) + padding;
        y = Math.random() * (H - padding*2) + padding;
        ok = true;
        for(const p of placed) if(Math.hypot(p.x-x,p.y-y) < minDist){ ok = false; break; }
        attempts++;
      } while(!ok && attempts < 40);
      placed.push({x,y});
      const node = factory();
      if(!node) continue;
      node.style.position = node.style.position || 'absolute';
      node.style.left = node.style.left || `${x}px`;
      node.style.top  = node.style.top  || `${y}px`;
      const dur = mobile ? (2.6 + Math.random()*2).toFixed(2) + 's' : (4 + Math.random()*4).toFixed(2) + 's';
      node.style.animationName = node.style.animationName || 'tridentIntroFloat';
      node.style.animationDuration = dur;
      node.style.animationDelay = (Math.random()*1.2).toFixed(2) + 's';
      node.style.animationTimingFunction = 'ease-in-out';
      node.style.animationIterationCount = 'infinite';
      node.style.animationDirection = 'alternate';
      container.appendChild(node);
    }
  }

  const trCount = Math.round(Math.max(6, Math.min(30, (W*H)/250000)));
  place(bgTridents, trCount, () => {
    const el = document.createElement('div');
    el.className = 'bg-item trident';
    el.textContent = '🔱';
    el.style.fontSize = `${10 + Math.floor(Math.random()*20)}px`;
    el.style.opacity = (mobile ? (0.04 + Math.random()*0.12) : (0.03 + Math.random()*0.08)).toString();
    el.style.transform = `rotate(${(-12 + Math.random()*24).toFixed(1)}deg)`;
    if(mobile){
      el.style.setProperty('filter','none','important');
      el.style.setProperty('color','rgba(255,255,255,0.95)','important');
    }
    return el;
  }, 50);

  const emojis = ['⭕','❌','🎁','✨'];
  const emCount = Math.round(Math.max(6, Math.min(18, (W*H)/300000)));
  place(bgEmojis, emCount, () => {
    const elIsMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 480;
    const ch = emojis[Math.floor(Math.random()*emojis.length)];
    if(elIsMobile){
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><g fill='none' fill-rule='evenodd'><rect x='2' y='6' width='20' height='12' rx='3' fill='%23FFD9B3' stroke='%23F17321' stroke-width='0.8'/><path d='M6 8c1.2-2 4-2.5 6-1.6C14 6.5 16.3 6 18 8' stroke='%23F17321' stroke-width='0.8' fill='none' stroke-linecap='round'/></g></svg>`;
      const img = document.createElement('img');
      img.className = 'bg-item emoji';
      img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
      img.style.width = `${10 + Math.floor(Math.random()*14)}px`;
      img.style.height = 'auto';
      img.style.opacity = (0.10 + Math.random()*0.16).toFixed(2);
      img.style.transform = `rotate(${(-25 + Math.random()*50).toFixed(1)}deg)`;
      img.style.pointerEvents = 'none';
      img.style.userSelect = 'none';
      img.style.setProperty('filter','none','important');
      img.style.setProperty('z-index','0','important');
      return img;
    } else {
      const el = document.createElement('div');
      el.className = 'bg-item emoji';
      el.textContent = ch;
      el.style.fontSize = `${12 + Math.floor(Math.random()*26)}px`;
      el.style.opacity = (0.02 + Math.random()*0.05).toString();
      el.style.transform = `rotate(${(-25 + Math.random()*50).toFixed(1)}deg)`;
      el.style.pointerEvents = 'none';
      el.style.userSelect = 'none';
      el.style.setProperty('font-family', '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla", sans-serif', 'important');
      el.style.setProperty('color', 'rgba(255,255,255,0.98)', 'important');
      el.style.setProperty('filter', 'none', 'important');
      return el;
    }
  }, 40);
}

/* ---------- Intro particles ---------- */
function ensureIntroParticlesContainer(){
  introOverlay = introOverlay || by('introOverlay');
  if(!introOverlay) return false;
  introParticles = introParticles || by('introParticles');
  if(!introParticles){
    introParticles = document.createElement('div');
    introParticles.id = 'introParticles';
    introParticles.style.position = 'absolute';
    introParticles.style.inset = '0';
    introParticles.style.zIndex = '2195';
    introParticles.style.pointerEvents = 'none';
    introOverlay.appendChild(introParticles);
  }
  return true;
}
function populateIntroParticles(){
  if(!ensureIntroParticlesContainer()) return;
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
    node.style.fontSize = (r < 0.45 ? 12 : (r < 0.86 ? 16 : 22)) + 'px';
    node.style.setProperty('color','rgba(255,255,255,0.98)','important');
    node.style.setProperty('opacity', (0.22 + Math.random()*0.12).toFixed(2), 'important');
    node.style.setProperty('filter','none','important');
    node.style.setProperty('text-shadow','0 2px 6px rgba(0,0,0,0.28)','important');
    node.style.animationName = 'tridentIntroFloat';
    node.style.animationDuration = (3 + Math.random()*6).toFixed(2) + 's';
    node.style.animationDelay = (Math.random()*1.6).toFixed(2) + 's';
    node.style.animationTimingFunction = 'ease-in-out';
    node.style.animationIterationCount = 'infinite';
    node.style.animationDirection = 'alternate';
    introParticles.appendChild(node);
  }
  requestAnimationFrame(()=> { if(introParticles) introParticles.classList.add('visible'); });
}

/* ---------- Date UI ---------- */
function updateDateUI(){
  let el = by('currentDate');
  if(!el){
    el = document.createElement('div');
    el.id = 'currentDate';
    el.style.position = 'fixed';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.bottom = '8px';
    el.style.padding = '6px 10px';
    el.style.borderRadius = '8px';
    el.style.background = 'rgba(0,0,0,0.08)';
    el.style.color = '#fff';
    el.style.fontWeight = '700';
    el.style.fontSize = '0.95rem';
    el.style.zIndex = '2350';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
  }
  const now = new Date();
  const opts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  el.textContent = now.toLocaleDateString(undefined, opts);
}

/* ---------- Loading animation ---------- */
function animateLoading(duration){
  return new Promise(resolve=>{
    if(!loadingBar || !loadingText) {
      setTimeout(resolve, duration);
      return;
    }
    const start = performance.now();
    function step(now){
      const pct = Math.min(1, (now - start) / duration);
      const p = Math.round(pct * 100);
      loadingBar.style.width = `${p}%`;
      loadingText.textContent = `Cargando el juego... ${p}%`;
      if(pct < 1) requestAnimationFrame(step);
      else {
        loadingText.textContent = 'Listo';
        setTimeout(resolve, 240);
      }
    }
    requestAnimationFrame(step);
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
  introOverlay = introOverlay || by('introOverlay');
  if(!introOverlay){ attachStartListener(); showBanner(); return; }
  introOverlay.classList.remove('hidden');
  introOverlay.setAttribute('aria-hidden','false');
  try{ populateBackground(); }catch(e){ dbg('populateBackground err', e); }
  try{ populateIntroParticles(); }catch(e){ dbg('populateIntroParticles err', e); }
  try { await animateLoading(INTRO_DURATION); } catch(e){ console.error('animateLoading', e); }
  if(introParticles){
    introParticles.classList.remove('visible');
    setTimeout(()=>{ if(introParticles) introParticles.innerHTML = ''; }, 300);
  }
  introOverlay.classList.add('hidden');
  introOverlay.setAttribute('aria-hidden','true');
  attachStartListener();
  showBanner();
  dbg('Intro finished; banner shown');
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  try{
    console.log('[tateti] DOMContentLoaded start');
    // refs
    boardEl = by('board'); cells = Array.from(document.querySelectorAll('.cell')); messageEl = by('message');
    introOverlay = by('introOverlay'); introCard = introOverlay ? introOverlay.querySelector('.intro-card') : null;
    introParticles = by('introParticles');
    opponentBanner = by('opponentBanner'); startBtn = by('startBtn');
    playerWinsEl = by('playerWins'); cpuWinsEl = by('cpuWins'); playerBonusPercentEl = by('playerBonusPercent'); cpuBonusPercentEl = by('cpuBonusPercent'); playsLeftEl = by('playsLeft');
    resultModal = by('resultModal'); modalPercent = by('modalPercent'); modalMessage = by('modalMessage'); modalClose = by('modalClose');
    boardLogo = by('boardLogo');
    loadingBar = by('loadingBar'); loadingText = by('loadingText');
    if(!boardEl || !cells.length || !messageEl){
      console.error('[tateti] FATAL: elementos faltantes', { boardEl, cellsLength: cells.length, messageEl });
      return;
    }
    if(modalClose) modalClose.addEventListener('click', ()=>{ if(resultModal) resultModal.classList.add('hidden'); });
    cells.forEach(c => c.addEventListener('click', onCellClick));
    document.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !sessionStarted && opponentBanner && !opponentBanner.classList.contains('hidden')){ hideBanner(); startGame(); } });
    // load state then check daily reset
    loadState();
    checkAndResetDaily();
    updateDateUI();
    scheduleMidnightReset();
    setActiveChoice(); resetBoardUI();
    if(introOverlay) introOverlay.classList.add('hidden');
    if(opponentBanner) opponentBanner.classList.add('hidden');
    if(resultModal) resultModal.classList.add('hidden');
    try{ populateBackground(); }catch(e){ dbg('populateBackground error', e); }
    try{ populateIntroParticles(); }catch(e){ dbg('populateIntroParticles error', e); }
    window.addEventListener('resize', ()=>{ try{ populateBackground(); }catch(e){} });
    if(state.plays >= MAX_PLAYS){
      const info = finalBonusText(state.playerWins);
      if(modalPercent){ modalPercent.textContent = ''; modalPercent.style.display = 'none'; }
      if(modalMessage){
        modalMessage.innerHTML = `
          <div style="font-size:1.18rem; font-weight:800; line-height:1.2; text-align:center;">
            ${info.text}
          </div>
          <div style="margin-top:10px; font-size:0.92rem; font-weight:700; text-align:center;">
            CON CARGA MÍNIMA
          </div>
        `;
      }
      if(resultModal) resultModal.classList.remove('hidden');
    } else {
      await showIntroThenProceed();
    }
    attachStartListener();
    dbg('Init complete');
  }catch(err){
    console.error('[tateti] error in DOMContentLoaded handler', err);
  }
});

/* ---------- Game logic (unchanged) ---------- */
function showBoardLogo(){ if(!boardLogo) return; boardLogo.classList.remove('hidden'); boardLogo.style.display='block'; }
function hideBoardLogo(){ if(!boardLogo) return; boardLogo.classList.add('hidden'); boardLogo.style.display='none'; }
function updateScoreboardUI(){ if(playerWinsEl) playerWinsEl.textContent = `${state.playerWins} / ${MAX_PLAYS}`; if(cpuWinsEl) cpuWinsEl.textContent = `${state.cpuWins} / ${MAX_PLAYS}`; if(playerBonusPercentEl) playerBonusPercentEl.textContent = `Bono: ${bonusPercent(state.playerWins)}%`; if(cpuBonusPercentEl) cpuBonusPercentEl.textContent = `Bono: ${bonusPercent(state.cpuWins)}%`; }
function updatePlaysUI(){ if(playsLeftEl) playsLeftEl.textContent = Math.max(0, MAX_PLAYS - state.plays); }
function bonusPercent(w){ if(w<=0) return 0; if(w===1) return 100; if(w===2) return 150; return 200; }
function checkPlaysLimitUI(){ if(!startBtn) return; if(state.plays >= MAX_PLAYS){ startBtn.disabled=true; startBtn.classList.add('disabled'); message('Has alcanzado el máximo de 3 partidas.'); hideBanner(); if(introOverlay) introOverlay.classList.add('hidden'); hideBoardLogo(); } else { if(sessionStarted){ startBtn.disabled=true; startBtn.classList.add('disabled'); } else { startBtn.disabled=false; startBtn.classList.remove('disabled'); } } }
function setActiveChoice(){ /* no-op; X fixed */ }
function resetBoardUI(){ cells.forEach(c=>{ c.innerHTML=''; c.classList.remove('disabled','win'); c.disabled=false; }); }

function startGame(){ if(state.plays >= MAX_PLAYS){ message('No puedes comenzar: alcanzaste el límite.'); return; } sessionStarted=true; checkPlaysLimitUI(); resetBoardUI(); board=Array(9).fill(null); currentTurn=playerSymbol; running=true; cpuThinking=false; message(`Juego iniciado — Tú: ${symbolToEmoji(playerSymbol)}  |  ${cpuName}: ${symbolToEmoji(cpuSymbol)}`); showBoardLogo(); }

function onCellClick(e){ if(!running || cpuThinking) return; const idx = Number(e.currentTarget.dataset.index); if(Number.isNaN(idx)) return; if(board[idx]) return; if(currentTurn !== playerSymbol) return; makeMove(idx, playerSymbol); afterMove(); setTimeout(()=>{ if(running && !cpuThinking && currentTurn===cpuSymbol) doCpuTurn(); }, 420); }
function makeMove(i,s){ board[i]=s; const c=cells[i]; if(c){ c.innerHTML=`<span>${symbolToEmoji(s)}</span>`; c.classList.add('disabled'); } }
function afterMove(){ const w = checkWinner(board); if(w){ handleEnd(w); return; } currentTurn = currentTurn==='X'?'O':'X'; if(running && currentTurn===cpuSymbol) doCpuTurn(); }
function doCpuTurn(){ cpuThinking=true; message(`${cpuName} está pensando...`); setTimeout(()=>{ const m = cpuVeryEasyMove(); if(m!==undefined && m!==null) makeMove(m,cpuSymbol); cpuThinking=false; afterMove(); }, 420); }
function cpuVeryEasyMove(){ const blockProb=0.30, heurProb=0.05; const block=findWinningMove(board, playerSymbol); if(block!==null && Math.random()<blockProb) return block; if(Math.random()<heurProb){ if(board[4]===null) return 4; const corners=[0,2,6,8].filter(i=>board[i]===null); if(corners.length) return corners[Math.floor(Math.random()*corners.length)]; const sides=[1,3,5,7].filter(i=>board[i]===null); if(sides.length) return sides[Math.floor(Math.random()*sides.length)]; } return cpuRandomMove(); }
function cpuRandomMove(){ const avail = availableMoves(board); if(avail.length===0) return null; return avail[Math.floor(Math.random()*avail.length)]; }
function availableMoves(b){ return b.map((v,i)=> v===null?i:null).filter(v=>v!==null); }
function findWinningMove(b,sym){ for(const i of availableMoves(b)){ b[i]=sym; const w=checkWinner(b); b[i]=null; if(w===sym) return i; } return null; }
function checkWinner(b){ for(const [a,b1,c] of WIN_COMBINATIONS){ if(b[a] && b[a]===b[b1] && b[a]===b[c]) return b[a]; } if(b.every(v=>v!==null)) return 'D'; return null; }

// handleEnd (with fixed block structure)
function handleEnd(winner){
  running=false;
  if(state.plays < MAX_PLAYS) state.plays += 1;
  if(winner === 'D'){ message('Empate 🙃 — no hay bono adicional'); }
  else {
    if(winner === playerSymbol){ state.playerWins = Math.min(MAX_PLAYS, state.playerWins + 1); message('¡Ganaste esta partida! 🎉'); }
    else { state.cpuWins = Math.min(MAX_PLAYS, state.cpuWins + 1); message(`${cpuName} gana esta partida 😢`); }
    for(const [a,b,c] of WIN_COMBINATIONS){
      if(board[a] && board[a] === board[b] && board[a] === board[c]){
        if(cells[a]) cells[a].classList.add('win');
        if(cells[b]) cells[b].classList.add('win');
        if(cells[c]) cells[c].classList.add('win');
        break;
      }
    }
  }
  cells.forEach(c=>c.classList.add('disabled'));
  saveState();
  updateScoreboardUI();
  updatePlaysUI();
  checkPlaysLimitUI();

  if(state.plays < MAX_PLAYS){
    setTimeout(()=>{
      board = Array(9).fill(null);
      resetBoardUI();
      currentTurn = playerSymbol;
      running = true;
      message(`Siguiente partida iniciada — Partida ${state.plays + 1} de ${MAX_PLAYS}`);
      showBoardLogo();
    }, 900);
  } else {
    setTimeout(()=>{
      try{
        const info = finalBonusText(state.playerWins);
        if(modalPercent){
          modalPercent.textContent = '';
          modalPercent.style.display = 'none';
        }
        if(modalMessage){
          modalMessage.innerHTML = `
            <div style="font-size:1.18rem; font-weight:800; line-height:1.2; text-align:center;">
              ${info.text}
            </div>
            <div style="margin-top:10px; font-size:0.92rem; font-weight:700; text-align:center;">
              CON CARGA MÍNIMA
            </div>
          `;
        }
        if(resultModal) resultModal.classList.remove('hidden');
        hideBoardLogo();
      }catch(err){
        console.error('[tateti] error showing final modal', err);
      }
    }, 700);
  }
}
