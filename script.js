// script.js (reparado para asegurar tridentes en intro)
// Reemplaza todo tu script.js por este archivo y recarga (Ctrl+F5).

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
  // clear existing
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

      // force animation inline (works even if CSS isn't ready yet)
      n.style.animationName = 'tatetiFloat';
      n.style.animationDuration = (4 + Math.random()*4).toFixed(2) + 's';
      n.style.animationDelay = (Math.random()*1.8).toFixed(2) + 's';
      n.style.animationTimingFunction = 'ease-in-out';
      n.style.animationIterationCount = 'infinite';
      n.style.animationDirection = 'alternate';

      container.appendChild(n);
    }
  };

  // tridents
  const trCount = Math.round(Math.max(8, Math.min(22, (W*H)/180000)));
  place(bgTridents, trCount, () => {
    const el = document.createElement('div');
    el.className = 'bg-item trident';
    el.textContent = '🔱';
    el.style.fontSize = `${10 + Math.floor(Math.random()*20)}px`;
    el.style.opacity = (0.03 + Math.random()*0.06).toString();
    el.style.transform = `rotate(${(-12 + Math.random()*24).toFixed(1)}deg)`;
    return el;
  }, 60);

  // emojis
  const emojis = ['⭕','❌','🎁','✨'];
  const emCount = Math.round(Math.max(10, Math.min(22, (W*H)/150000)));
  place(bgEmojis, emCount, () => {
    const el = document.createElement('div');
    el.className = 'bg-item emoji';
    el.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    el.style.fontSize = `${12 + Math.floor(Math.random()*28)}px`;
    el.style.opacity = (0.02 + Math.random()*0.05).toString();
    el.style.transform = `rotate(${(-25 + Math.random()*50).toFixed(1)}deg)`;
    return el;
  }, 50);
}

/* ----------------- Intro particles & loading UI ----------------- */
function ensureIntroUI(){
  introOverlay = introOverlay || by('introOverlay');
  if(!introOverlay){
    // If HTML lacks introOverlay, create a simplified overlay so particles still show
    introOverlay = document.createElement('div');
    introOverlay.id = 'introOverlay';
    introOverlay.className = 'intro-overlay';
    document.body.appendChild(introOverlay);
  }

  // ensure overlay positioning supports children
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
    // ensure z-index consistent
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
  ensureIntroUI(); // guarantees introParticles exists
  if(!introParticles) return;
  introParticles.innerHTML = '';

  const rect = introOverlay.getBoundingClientRect();
  const W = Math.max(rect.width, window.innerWidth);
  const H = Math.max(rect.height, window.innerHeight);
  const count = 12;

  for(let i=0;i<count;i++){
    const span = document.createElement('div');
    span.className = 'bg-item trident';
    span.textContent = '🔱';
    span.style.position = 'absolute';
    span.style.left = `${Math.random() * W}px`;
    span.style.top  = `${Math.random() * H}px`;
    span.style.fontSize = `${12 + Math.round(Math.random()*26)}px`;
    span.style.opacity = (0.03 + Math.random()*0.06).toString();
    span.style.transform = `rotate(${(-20 + Math.random()*40).toFixed(1)}deg)`;
    span.style.filter = 'blur(.22px)';

    // enforce animation inline so even if CSS loads late it animates
    span.style.animationName = 'tatetiFloat';
    span.style.animationDuration = (3 + Math.random()*5).toFixed(2) + 's';
    span.style.animationDelay = (Math.random()*1.8).toFixed(2) + 's';
    span.style.animationTimingFunction = 'ease-in-out';
    span.style.animationIterationCount = 'infinite';
    span.style.animationDirection = 'alternate';

    introParticles.appendChild(span);
  }

  // safety: if nothing was added (rare), create visible test tridents
  if(introParticles.childElementCount === 0){
    for(let i=0;i<6;i++){
      const t = document.createElement('div');
      t.className = 'bg-item trident';
      t.textContent = '🔱';
      t.style.position = 'absolute';
      t.style.left = `${20 + i*40}px`;
      t.style.top = `${80 + i*10}px`;
      t.style.fontSize = '28px';
      t.style.opacity = '0.12';
      t.style.color = 'rgba(255,255,255,0.9)';
      introParticles.appendChild(t);
    }
    dbg('Se crearon tridentes de prueba (fallback).');
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

  // make sure overlays start hidden
  if(introOverlay) introOverlay.classList.add('hidden');
  if(opponentBanner) opponentBanner.classList.add('hidden');
  if(resultModal) resultModal.classList.add('hidden');

  // populate background early so tridents are ready
  populateBackground();
  populateIntroParticles();

  // responsiveness: repopulate background on resize
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
// (rest of game functions unchanged; omitted here for brevity but included in file)
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
