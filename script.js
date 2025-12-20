// script.js
// Final, stable implementation per your specs:
// - Intro screen with atenuated 🔱 and emojis in the global background + intro particles
// - Reliable loading bar (setInterval). When it reaches 100%: hide intro, show banner "HOY JUGARÁS CON NEXUS🤖"
// - The user must click "Comenzar" to actually start the first game
// - Series of 3 games that run automatically one after the other
// - Bonus awarded at end: 1 win => 100%, 2 wins => 150%, 3 wins => 200%
// - Result card (right side) only appears after all 3 games with the computed bonus
// - Board controls (pick X/O, restart) are ignored/optional; logo is fixed under the board
//
// Replace your current script.js with this file and reload (Ctrl+F5).

const cpuName = 'NEXUS';
const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];
const MAX_PLAYS = 3;
const STORAGE_KEY = 'tatetiState_v2';
const INTRO_DURATION = 1600; // ms visual length of loading

// Game state
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

/* ---------- Background (global) ---------- */
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

  function place(container, count, factory, minDist = 60){
    const placed = [];
    const padding = 24;
    for(let i=0;i<count;i++){
      let attempts=0, x,y,ok;
      do {
        x = Math.random() * (W - padding*2) + padding;
        y = Math.random() * (H - padding*2) + padding;
        ok = true;
        for(const p of placed) if(Math.hypot(p.x-x,p.y-y) < minDist){ ok = false; break; }
        attempts++;
      } while(!ok && attempts < 40);
      placed.push({x,y});
      const node = factory();
      node.style.position = 'absolute';
      node.style.left = `${x}px`;
      node.style.top  = `${y}px`;
      node.style.pointerEvents = 'none';
      container.appendChild(node);
    }
  }

  // tridents (very subtle)
  const trCount = Math.round(Math.max(8, Math.min(22, (W*H)/180000)));
  place(bgTridents, trCount, ()=>{
    const n = document.createElement('div');
    n.className = 'bg-item trident';
    n.textContent = '🔱';
    n.style.fontSize = `${10 + Math.floor(Math.random()*18)}px`;
    n.style.opacity = `${0.03 + Math.random()*0.06}`;
    n.style.transform = `rotate(${(-12 + Math.random()*24).toFixed(1)}deg)`;
    n.style.filter = 'blur(.2px)';
    return n;
  }, 70);

  // emojis (subtle)
  const emojis = ['⭕','❌','🎁','✨'];
  const emCount = Math.round(Math.max(10, Math.min(22, (W*H)/150000)));
  place(bgEmojis, emCount, ()=>{
    const n = document.createElement('div');
    n.className = 'bg-item emoji';
    n.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    n.style.fontSize = `${14 + Math.floor(Math.random()*30)}px`;
    n.style.opacity = `${0.03 + Math.random()*0.06}`;
    n.style.transform = `rotate(${(-25 + Math.random()*50).toFixed(1)}deg)`;
    n.style.filter = 'blur(.25px)';
    return n;
  }, 60);
}

/* ---------- Intro particles and loading UI ---------- */
function ensureIntroUI(){
  introOverlay = introOverlay || by('introOverlay');
  if(!introOverlay) return false;
  introCard = introCard || introOverlay.querySelector('.intro-card');

  introParticles = by('introParticles');
  if(!introParticles){
    introParticles = document.createElement('div');
    introParticles.id = 'introParticles';
    introParticles.style.position = 'absolute';
    introParticles.style.inset = '0';
    introParticles.style.pointerEvents = 'none';
    introOverlay.appendChild(introParticles);
  }

  loadingBar = by('loadingBar');
  loadingText = by('loadingText');

  // if HTML already has them, fine; else create fallback (harmless)
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
  if(!introOverlay) return;
  ensureIntroUI();
  if(!introParticles) return;
  introParticles.innerHTML = '';
  const rect = introOverlay.getBoundingClientRect();
  const count = 12;
  for(let i=0;i<count;i++){
    const span = document.createElement('div');
    span.className = 'bg-item trident';
    span.textContent = '🔱';
    span.style.position = 'absolute';
    span.style.left = `${Math.random() * rect.width}px`;
    span.style.top = `${Math.random() * rect.height}px`;
    span.style.fontSize = `${12 + Math.round(Math.random()*22)}px`;
    span.style.opacity = `${0.03 + Math.random()*0.05}`;
    span.style.transform = `rotate(${(-20 + Math.random()*40).toFixed(1)}deg)`;
    span.style.filter = 'blur(.25px)';
    introParticles.appendChild(span);
  }
}

/* ---------- Robust loading animation (setInterval) ---------- */
function animateLoading(duration){
  return new Promise((resolve)=>{
    if(!ensureIntroUI()){
      setTimeout(resolve, duration);
      return;
    }

    const steps = Math.max(10, Math.round(duration / 80));
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
        setTimeout(resolve, 220);
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

/* ---------- Intro -> banner flow (no auto-start) ---------- */
async function showIntroThenProceed(){
  introOverlay = introOverlay || by('introOverlay');
  introCard = introCard || (introOverlay && introOverlay.querySelector('.intro-card'));
  if(!introOverlay){ attachStartListener(); showBanner(); return; }

  introOverlay.classList.remove('hidden');
  introOverlay.setAttribute('aria-hidden','false');

  populateBackground();
  populateIntroParticles();

  try { await animateLoading(INTRO_DURATION); } catch(e){ console.error('animateLoading', e); }

  introOverlay.classList.add('hidden');
  introOverlay.setAttribute('aria-hidden','true');

  attachStartListener();
  showBanner();
  dbg('Intro done; banner shown');
}

/* ---------- Initialization ---------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  boardEl = by('board');
  cells = Array.from(document.querySelectorAll('.cell'));
  messageEl = by('message');

  introOverlay = by('introOverlay');
  introCard = introOverlay ? introOverlay.querySelector('.intro-card') : null;

  opponentBanner = by('opponentBanner');
  startBtn = by('startBtn');
  restartBtn = by('restartBtn'); // optional in HTML
  pickX = by('pickX'); // optional
  pickO = by('pickO'); // optional

  playerWinsEl = by('playerWins'); cpuWinsEl = by('cpuWins');
  playerBonusPercentEl = by('playerBonusPercent'); cpuBonusPercentEl = by('cpuBonusPercent');
  playsLeftEl = by('playsLeft');

  resultModal = by('resultModal'); modalPercent = by('modalPercent'); modalMessage = by('modalMessage'); modalClose = by('modalClose');
  boardLogo = by('boardLogo');

  if(!boardEl || !cells.length || !messageEl){ console.error('FATAL: missing elements'); return; }

  // attach helpers (pick/reset optional)
  if(restartBtn) restartBtn.addEventListener('click', ()=> { localStorage.removeItem(STORAGE_KEY); state={playerWins:0,cpuWins:0,plays:0}; location.reload(); });
  if(modalClose) modalClose.addEventListener('click', hideModal);

  cells.forEach(c => c.addEventListener('click', onCellClick));
  document.addEventListener('keydown', (e)=> { if(e.key === 'Enter' && !sessionStarted && opponentBanner && !opponentBanner.classList.contains('hidden')){ hideBanner(); startGame(); } });

  setActiveChoice(); loadState(); resetBoardUI();

  // ensure overlays start hidden
  if(introOverlay) introOverlay.classList.add('hidden');
  if(opponentBanner) opponentBanner.classList.add('hidden');
  if(resultModal) resultModal.classList.add('hidden');

  if(state.plays >= MAX_PLAYS){
    // show result card with bonus (persistence case)
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

/* ---------- Game logic ---------- */
function showBoardLogo(){ if(!boardLogo) return; boardLogo.classList.remove('hidden'); boardLogo.style.display='block'; }
function hideBoardLogo(){ if(!boardLogo) return; boardLogo.classList.add('hidden'); boardLogo.style.display='none'; }

function loadState(){ try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw) state = JSON.parse(raw); }catch(e){ state={playerWins:0,cpuWins:0,plays:0}; } updateScoreboardUI(); updatePlaysUI(); checkPlaysLimitUI(); }
function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
function updateScoreboardUI(){ if(playerWinsEl) playerWinsEl.textContent = `${state.playerWins} / ${MAX_PLAYS}`; if(cpuWinsEl) cpuWinsEl.textContent = `${state.cpuWins} / ${MAX_PLAYS}`; if(playerBonusPercentEl) playerBonusPercentEl.textContent = `Bono: ${bonusPercent(state.playerWins)}%`; if(cpuBonusPercentEl) cpuBonusPercentEl.textContent = `Bono: ${bonusPercent(state.cpuWins)}%`; }
function updatePlaysUI(){ if(playsLeftEl) playsLeftEl.textContent = Math.max(0, MAX_PLAYS - state.plays); }
function bonusPercent(w){ if(w<=0) return 0; if(w===1) return 100; if(w===2) return 150; return 200; }

function checkPlaysLimitUI(){ if(!startBtn) return; if(state.plays >= MAX_PLAYS){ startBtn.disabled=true; startBtn.classList.add('disabled'); message('Has alcanzado el máximo de 3 partidas.'); hideBanner(); if(introOverlay) introOverlay.classList.add('hidden'); hideBoardLogo(); } else { if(sessionStarted){ startBtn.disabled=true; startBtn.classList.add('disabled'); } else { startBtn.disabled=false; startBtn.classList.remove('disabled'); } } }

// keep picks but don't require them
function setActiveChoice(){ /* no-op: we keep X by default */ }
function onPick(sym){ /* not used in requested flow */ }

function resetBoardUI(){ cells.forEach(c=>{ c.innerHTML=''; c.classList.remove('disabled','win'); c.disabled=false; }); }

function startGame(){
  if(state.plays >= MAX_PLAYS){ message('No puedes comenzar: alcanzaste el límite.'); return; }
  sessionStarted = true;
  checkPlaysLimitUI();
  resetBoardUI();
  board = Array(9).fill(null);
  currentTurn = playerSymbol;
  running = true;
  cpuThinking = false;
  message(`Juego iniciado — Tú: ${symbolToEmoji(playerSymbol)}  |  ${cpuName}: ${symbolToEmoji(cpuSymbol)}`);
  showBoardLogo();
}

function onCellClick(e){
  if(!running || cpuThinking) return;
  const idx = Number(e.currentTarget.dataset.index);
  if(Number.isNaN(idx)) return;
  if(board[idx]) return;
  if(currentTurn !== playerSymbol) return;
  makeMove(idx, playerSymbol);
  afterMove();
  setTimeout(()=>{ if(running && !cpuThinking && currentTurn===cpuSymbol) doCpuTurn(); }, 420);
}
function makeMove(i,s){ board[i]=s; const c=cells[i]; if(c){ c.innerHTML=`<span>${symbolToEmoji(s)}</span>`; c.classList.add('disabled'); } }
function afterMove(){ const w = checkWinner(board); if(w){ handleEnd(w); return; } currentTurn = currentTurn==='X'?'O':'X'; if(running && currentTurn===cpuSymbol) doCpuTurn(); }
function doCpuTurn(){ cpuThinking=true; message(`${cpuName} está pensando...`); setTimeout(()=>{ const m = cpuVeryEasyMove(); if(m!==undefined && m!==null) makeMove(m,cpuSymbol); cpuThinking=false; afterMove(); }, 420); }
function cpuVeryEasyMove(){ const blockProb=0.30, heurProb=0.05; const block=findWinningMove(board, playerSymbol); if(block!==null && Math.random()<blockProb) return block; if(Math.random()<heurProb){ if(board[4]===null) return 4; const corners=[0,2,6,8].filter(i=>board[i]===null); if(corners.length) return corners[Math.floor(Math.random()*corners.length)]; const sides=[1,3,5,7].filter(i=>board[i]===null); if(sides.length) return sides[Math.floor(Math.random()*sides.length)]; } return cpuRandomMove(); }
function cpuRandomMove(){ const avail = availableMoves(board); if(avail.length===0) return null; return avail[Math.floor(Math.random()*avail.length)]; }
function availableMoves(b){ return b.map((v,i)=> v===null?i:null).filter(v=>v!==null); }
function findWinningMove(b,sym){ for(const i of availableMoves(b)){ b[i]=sym; const w=checkWinner(b); b[i]=null; if(w===sym) return i; } return null; }
function checkWinner(b){ for(const [a,b1,c] of WIN_COMBINATIONS){ if(b[a] && b[a]===b[b1] && b[a]===b[c]) return b[a]; } if(b.every(v=>v!==null)) return 'D'; return null; }

function handleEnd(winner){
  running=false;
  if(state.plays < MAX_PLAYS) state.plays += 1;

  if(winner === 'D'){
    message('Empate 🙃 — no hay bono adicional');
  } else {
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
    // automatic next match start after small delay
    setTimeout(()=>{
      board = Array(9).fill(null);
      resetBoardUI();
      currentTurn = playerSymbol;
      running = true;
      cpuThinking = false;
      message(`Siguiente partida iniciada — Partida ${state.plays + 1} de ${MAX_PLAYS}`);
      showBoardLogo();
    }, 900);
  } else {
    // series finished -> show result modal with bonus
    setTimeout(()=>{
      const bp = bonusPercent(state.playerWins);
      if(modalPercent) modalPercent.textContent = `${bp}%`;
      if(modalMessage) modalMessage.textContent = (bp>0) ? `Has obtenido ${bp}% por ${state.playerWins} victoria(s).` : `No obtuviste bono (0 victorias).`;
      if(resultModal) resultModal.classList.remove('hidden');
      hideBoardLogo();
    }, 700);
  }
}

function showModal(){ if(resultModal) resultModal.classList.remove('hidden'); }
function hideModal(){ if(resultModal) resultModal.classList.add('hidden'); }
