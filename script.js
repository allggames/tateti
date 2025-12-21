// script.js (corregido — preserva la barra de carga y añade tridentes en intro)
// Reemplaza tu script.js por este archivo y luego Ctrl+F5.

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

/* ----------------- Background helper ----------------- */
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

/* ---------- Populate global background (tridents + emojis) ---------- */
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
      node.style.position = 'absolute';
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      // inline animation so it always animates even if CSS loads later
      node.style.animationName = 'tridentIntroFloat';
      node.style.animationDuration = (4 + Math.random()*4).toFixed(2) + 's';
      node.style.animationDelay = (Math.random()*1.8).toFixed(2) + 's';
      node.style.animationTimingFunction = 'ease-in-out';
      node.style.animationIterationCount = 'infinite';
      node.style.animationDirection = 'alternate';
      container.appendChild(node);
    }
  }

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

/* ---------- Intro particles (only for the intro overlay) ---------- */
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

    // size
    const r = Math.random();
    node.style.fontSize = (r < 0.45 ? 12 : (r < 0.86 ? 16 : 22)) + 'px';

    node.style.opacity = (0.06 + Math.random()*0.12).toString();
    node.style.transform = `rotate(${(-12 + Math.random()*24).toFixed(1)}deg)`;

    // inline animation uses CSS keyframes tridentIntroFloat (we include CSS snippet separately)
    node.style.animationName = 'tridentIntroFloat';
    node.style.animationDuration = (3 + Math.random()*6).toFixed(2) + 's';
    node.style.animationDelay = (Math.random()*1.6).toFixed(2) + 's';
    node.style.animationTimingFunction = 'ease-in-out';
    node.style.animationIterationCount = 'infinite';
    node.style.animationDirection = 'alternate';

    introParticles.appendChild(node);
  }

  // add visible class for fade-in if CSS handles it
  requestAnimationFrame(()=> {
    if(introParticles) introParticles.classList.add('visible');
  });
}

/* ---------- Loading animation (robust) ----------
   IMPORTANT: this function ONLY updates existing loadingBar/loadingText
   elements that should be present in the HTML. It will NOT create duplicates.
*/
function animateLoading(duration){
  return new Promise(resolve=>{
    // If loading elements missing, fallback to a simple timeout
    if(!loadingBar || !loadingText) {
      setTimeout(resolve, duration);
      return;
    }

    const start = performance.now();
    // We'll use time-based progression ensuring predictable duration
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

  // show overlay (assumes intro markup contains loadingBar/loadingText)
  introOverlay.classList.remove('hidden');
  introOverlay.setAttribute('aria-hidden','false');

  // populate visuals (background MAY have been already created)
  try{ populateBackground(); }catch(e){ dbg('populateBackground err', e); }
  try{ populateIntroParticles(); }catch(e){ dbg('populateIntroParticles err', e); }

  try { await animateLoading(INTRO_DURATION); } catch(e){ console.error('animateLoading', e); }

  // fade out particles (if present) and hide overlay
  if(introParticles){
    introParticles.classList.remove('visible');
    // keep slight delay for fade
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
  // refs
  boardEl = by('board'); cells = Array.from(document.querySelectorAll('.cell')); messageEl = by('message');

  introOverlay = by('introOverlay'); introCard = introOverlay ? introOverlay.querySelector('.intro-card') : null;
  introParticles = by('introParticles'); // may be null at this moment

  opponentBanner = by('opponentBanner'); startBtn = by('startBtn');

  playerWinsEl = by('playerWins'); cpuWinsEl = by('cpuWins'); playerBonusPercentEl = by('playerBonusPercent'); cpuBonusPercentEl = by('cpuBonusPercent'); playsLeftEl = by('playsLeft');

  resultModal = by('resultModal'); modalPercent = by('modalPercent'); modalMessage = by('modalMessage'); modalClose = by('modalClose');
  boardLogo = by('boardLogo');

  // Very important: reference existing loading elements from DOM (do NOT recreate)
  loadingBar = by('loadingBar');
  loadingText = by('loadingText');

  if(!boardEl || !cells.length || !messageEl){
    console.error('FATAL: elementos faltantes');
    return;
  }

  if(modalClose) modalClose.addEventListener('click', ()=>{ if(resultModal) resultModal.classList.add('hidden'); });
  cells.forEach(c => c.addEventListener('click', onCellClick));
  document.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !sessionStarted && opponentBanner && !opponentBanner.classList.contains('hidden')){ hideBanner(); startGame(); } });

  setActiveChoice(); loadState(); resetBoardUI();

  // ensure overlays initial hidden state
  if(introOverlay) introOverlay.classList.add('hidden');
  if(opponentBanner) opponentBanner.classList.add('hidden');
  if(resultModal) resultModal.classList.add('hidden');

  // prepare backgrounds/particles early so they exist when intro shows
  try{ populateBackground(); }catch(e){ dbg('populateBackground error', e); }
  try{ populateIntroParticles(); }catch(e){ dbg('populateIntroParticles error', e); }

  // responsive: regenerate background on resize
  window.addEventListener('resize', ()=>{ try{ populateBackground(); }catch(e){} });

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
function showBoardLogo(){ if(!boardLogo) return; boardLogo.classList.remove('hidden'); boardLogo.style.display='block'; }
function hideBoardLogo(){ if(!boardLogo) return; boardLogo.classList.add('hidden'); boardLogo.style.display='none'; }
function loadState(){ try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw) state = JSON.parse(raw); }catch(e){ state={playerWins:0,cpuWins:0,plays:0}; } updateScoreboardUI(); updatePlaysUI(); checkPlaysLimitUI(); }
function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
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
    setTimeout(()=>{ board = Array(9).fill(null); resetBoardUI(); currentTurn = playerSymbol; running = true; message(`Siguiente partida iniciada — Partida ${state.plays + 1} de ${MAX_PLAYS}`); showBoardLogo(); }, 900);
  } else {
    setTimeout(()=>{ const bp = bonusPercent(state.playerWins); if(modalPercent) modalPercent.textContent = `${bp}%`; if(modalMessage) modalMessage.textContent = (bp>0) ? `Has obtenido ${bp}% por ${state.playerWins} victoria(s).` : `No obtuviste bono (0 victorias).`; if(resultModal) resultModal.classList.remove('hidden'); hideBoardLogo(); }, 700);
  }
}
