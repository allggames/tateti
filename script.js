```javascript name=script.js
// script.js (reemplazar todo)
// Versión robusta y simple: garantiza que la barra de carga exista y avance,
// crea partículas intro (🔱) dentro del overlay, y siempre transiciona al
// cartel "HOY JUGARÁS CONTRA NEXUS" cuando termine la "carga".
// Incluye logs por console.debug para ayudarte a depurar si vuelve a quedarse.
//
// Pega este archivo reemplazando tu script.js actual.

const cpuName = 'NEXUS';
const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];
const MAX_PLAYS = 3;
const STORAGE_KEY = 'tatetiState_v2';
const INTRO_DURATION = 1800; // ms de "carga"

let board = Array(9).fill(null);
let playerSymbol = 'X';
let cpuSymbol = 'O';
let currentTurn = 'X';
let running = false;
let cpuThinking = false;
let sessionStarted = false;
let state = { playerWins: 0, cpuWins: 0, plays: 0 };

// DOM refs (rellenados en init)
let boardEl, cells, messageEl;
let introOverlay, introCard, introParticlesContainer, loadingBar, loadingText;
let opponentBanner, startBtn, restartBtn, pickX, pickO;
let playerWinsEl, cpuWinsEl, playerBonusPercentEl, cpuBonusPercentEl, playsLeftEl;
let resultModal, modalPercent, modalMessage, modalClose;
let boardLogo, bgTridents, bgEmojis;

// util simple
function symbolToEmoji(sym){ if(sym==='X') return '❌'; if(sym==='O') return '⭕'; return sym; }
function dbg(...a){ console.debug('[tateti]', ...a); }
function message(text){ if(messageEl) messageEl.textContent = text; }

// ------------------ Intro/Background helpers ------------------

function createLoadingUIIfMissing(){
  introCard = introCard || (introOverlay && introOverlay.querySelector('.intro-card'));
  if(!introCard) return;

  loadingBar = document.getElementById('loadingBar');
  loadingText = document.getElementById('loadingText');

  if(loadingBar && loadingText) return; // already present

  // create elements
  const outer = document.createElement('div');
  outer.className = 'loading-bar-outer';
  outer.style.width = '72%';
  outer.style.maxWidth = '520px';
  outer.style.height = '12px';
  outer.style.background = 'rgba(0,0,0,0.12)';
  outer.style.borderRadius = '8px';
  outer.style.overflow = 'hidden';
  outer.style.marginTop = '12px';
  outer.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04)';

  const inner = document.createElement('div');
  inner.id = 'loadingBar';
  inner.className = 'loading-bar';
  inner.style.height = '100%';
  inner.style.width = '0%';
  inner.style.background = 'linear-gradient(90deg, #ffd9b3, var(--orange-bright))';
  inner.style.borderRadius = '8px';
  inner.style.transition = 'width .08s linear';

  outer.appendChild(inner);

  const text = document.createElement('div');
  text.id = 'loadingText';
  text.className = 'loading-text';
  text.style.marginTop = '8px';
  text.style.color = '#fff';
  text.style.fontWeight = '700';
  text.style.textAlign = 'center';
  text.textContent = 'Cargando el juego... 0%';

  // append after logo if present
  const logo = introCard.querySelector('#introLogo') || introCard.querySelector('img');
  if(logo && logo.parentNode === introCard){
    logo.insertAdjacentElement('afterend', outer);
    outer.insertAdjacentElement('afterend', text);
  } else {
    introCard.appendChild(outer);
    introCard.appendChild(text);
  }

  // refresh refs
  loadingBar = inner;
  loadingText = text;
  dbg('Loading UI created');
}

function populateIntroParticles(){
  if(!introOverlay) return;
  // create container if missing
  introParticlesContainer = document.getElementById('introParticles');
  if(!introParticlesContainer){
    introParticlesContainer = document.createElement('div');
    introParticlesContainer.id = 'introParticles';
    introParticlesContainer.style.position = 'absolute';
    introParticlesContainer.style.inset = '0';
    introParticlesContainer.style.pointerEvents = 'none';
    introOverlay.appendChild(introParticlesContainer);
  }
  introParticlesContainer.innerHTML = '';

  // compute area roughly inside overlay
  const rect = introOverlay.getBoundingClientRect();
  const count = 12;
  for(let i=0;i<count;i++){
    const size = 12 + Math.round(Math.random()*26);
    const opacity = 0.06 + Math.random()*0.08;
    const rot = (-20 + Math.random()*40).toFixed(1);
    const px = Math.random() * rect.width;
    const py = Math.random() * rect.height;
    const span = document.createElement('div');
    span.className = 'bg-item trident';
    span.textContent = '🔱';
    span.style.position = 'absolute';
    span.style.left = `${px}px`;
    span.style.top = `${py}px`;
    span.style.fontSize = `${size}px`;
    span.style.opacity = `${opacity}`;
    span.style.transform = `rotate(${rot}deg)`;
    span.style.filter = 'blur(.2px)';
    introParticlesContainer.appendChild(span);
  }
  dbg('Intro particles populated');
}

// Global background (outside intro) — keep simple
function populateBackground(){
  bgTridents = document.getElementById('bgTridents') || createBgLayer('bgTridents');
  bgEmojis   = document.getElementById('bgEmojis')   || createBgLayer('bgEmojis');
  bgTridents.innerHTML = '';
  bgEmojis.innerHTML = '';

  const W = Math.max(window.innerWidth, 800);
  const H = Math.max(window.innerHeight, 600);

  function place(container, count, minDist, factory){
    const placed = [];
    const padding = 24;
    for(let i=0;i<count;i++){
      let attempts=0, x,y,ok;
      do{
        x = Math.random() * (W - padding*2) + padding;
        y = Math.random() * (H - padding*2) + padding;
        ok = true;
        for(const p of placed){ if(Math.hypot(p.x-x,p.y-y)<minDist){ ok=false; break; } }
        attempts++;
      } while(!ok && attempts < 40);
      placed.push({x,y});
      const n = factory(x,y,i);
      n.style.position='absolute';
      n.style.left=`${x}px`;
      n.style.top=`${y}px`;
      n.style.pointerEvents='none';
      container.appendChild(n);
    }
  }

  const trCount = Math.round(Math.max(8, Math.min(22, (W*H)/(200000))));
  place(bgTridents, trCount, 90, ()=>{
    const s = 10 + Math.floor(Math.random()*20);
    const op = (0.04 + Math.random()*0.08).toFixed(3);
    const rot = (-12 + Math.random()*24).toFixed(1);
    const d = document.createElement('div');
    d.className='bg-item trident';
    d.textContent='🔱';
    d.style.fontSize = `${s}px`;
    d.style.opacity = op;
    d.style.transform = `rotate(${rot}deg)`;
    d.style.filter = 'blur(.2px)';
    return d;
  });

  const emojis = ['⭕','❌','🎁','✨'];
  const emCount = Math.round(Math.max(10, Math.min(20, (W*H)/(180000))));
  place(bgEmojis, emCount, 80, ()=>{
    const s = 16 + Math.floor(Math.random()*38);
    const op = (0.03 + Math.random()*0.08).toFixed(3);
    const rot = (-25 + Math.random()*50).toFixed(1);
    const d = document.createElement('div');
    d.className='bg-item emoji';
    d.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    d.style.fontSize = `${s}px`;
    d.style.opacity = op;
    d.style.transform = `rotate(${rot}deg)`;
    d.style.filter = 'blur(.25px)';
    return d;
  });

  bgTridents.style.zIndex=0;
  bgEmojis.style.zIndex=0;
}

function createBgLayer(id){
  const el = document.createElement('div');
  el.id = id;
  el.style.position='fixed';
  el.style.inset='0';
  el.style.zIndex='0';
  el.style.pointerEvents='none';
  document.body.appendChild(el);
  return el;
}

// ------------------ Loading animation (timed) ------------------

function startLoadingBar(duration){
  return new Promise((resolve) => {
    createLoadingUIIfMissing();
    if(!loadingBar || !loadingText){
      dbg('No loading UI — fallback timeout');
      setTimeout(resolve, duration);
      return;
    }
    const start = performance.now();
    function tick(now){
      const elapsed = now - start;
      const pct = Math.min(1, elapsed / duration);
      loadingBar.style.width = `${Math.round(pct*100)}%`;
      loadingText.textContent = `Cargando el juego... ${Math.round(pct*100)}%`;
      if(pct < 1) requestAnimationFrame(tick);
      else {
        loadingText.textContent = 'Listo';
        setTimeout(resolve, 220);
      }
    }
    requestAnimationFrame(tick);
  });
}

// ------------------ Intro -> Banner flow ------------------

function attachStartListener(){
  if(!startBtn) return;
  startBtn.type = 'button';
  if(startBtn._handler) startBtn.removeEventListener('click', startBtn._handler);
  startBtn._handler = ()=>{ hideBanner(); startGame(); };
  startBtn.addEventListener('click', startBtn._handler);
  startBtn.disabled = false;
  startBtn.classList.remove('disabled');
  dbg('start listener attached');
}

function showIntroThenBanner(){
  if(!introOverlay) return;
  showIntro();
  populateIntroParticles();
  // ensure global background exists
  populateBackground();
  // start loading
  startLoadingBar(INTRO_DURATION).then(()=>{
    dbg('loading finished, transitioning to banner');
    // hide intro and show banner after tiny delay for smoothness
    hideIntro();
    setTimeout(()=>{ attachStartListener(); showBanner(); }, 160);
  }).catch(err=>{
    console.error('Error during loading animation', err);
    hideIntro();
    setTimeout(()=>{ attachStartListener(); showBanner(); }, 160);
  });
}

function showIntro(){
  if(!introOverlay) return;
  introOverlay.classList.remove('hidden');
  introOverlay.setAttribute('aria-hidden','false');
  if(opponentBanner) opponentBanner.classList.add('hidden');
  hideBoardLogo();
  createLoadingUIIfMissing();
  if(loadingBar) loadingBar.style.width = '0%';
  if(loadingText) loadingText.textContent = 'Cargando el juego... 0%';
  dbg('Intro shown');
}
function hideIntro(){ if(!introOverlay) return; introOverlay.classList.add('hidden'); introOverlay.setAttribute('aria-hidden','true'); dbg('Intro hidden'); }

function populateIntroParticles(){
  // create small tridents around logo area
  if(!introOverlay) return;
  introParticlesContainer = document.getElementById('introParticles');
  if(!introParticlesContainer){
    introParticlesContainer = document.createElement('div');
    introParticlesContainer.id = 'introParticles';
    introParticlesContainer.style.position = 'absolute';
    introParticlesContainer.style.inset = '0';
    introParticlesContainer.style.pointerEvents = 'none';
    introOverlay.appendChild(introParticlesContainer);
  }
  introParticlesContainer.innerHTML = '';
  const rect = introOverlay.getBoundingClientRect();
  const count = 12;
  for(let i=0;i<count;i++){
    const size = 12 + Math.round(Math.random()*26);
    const opacity = 0.06 + Math.random()*0.08;
    const rot = (-20 + Math.random()*40).toFixed(1);
    const px = Math.random() * rect.width;
    const py = Math.random() * rect.height;
    const span = document.createElement('div');
    span.className = 'bg-item trident';
    span.textContent = '🔱';
    span.style.position='absolute';
    span.style.left = `${px}px`;
    span.style.top  = `${py}px`;
    span.style.fontSize = `${size}px`;
    span.style.opacity = `${opacity}`;
    span.style.transform = `rotate(${rot}deg)`;
    span.style.filter = 'blur(.2px)';
    span.style.pointerEvents='none';
    introParticlesContainer.appendChild(span);
  }
  dbg('Intro particles created');
}

// ------------------ Banner helpers ------------------

function showBanner(){ if(!opponentBanner) return; opponentBanner.classList.remove('hidden'); opponentBanner.setAttribute('aria-hidden','false'); dbg('Banner shown'); attachStartListener(); }
function hideBanner(){ if(!opponentBanner) return; opponentBanner.classList.add('hidden'); opponentBanner.setAttribute('aria-hidden','true'); }

// ------------------ global init ------------------

document.addEventListener('DOMContentLoaded', ()=>{
  // basic refs used by background/population
  introOverlay = document.getElementById('introOverlay');
  introCard = introOverlay ? introOverlay.querySelector('.intro-card') : null;
  loadingBar = document.getElementById('loadingBar');
  loadingText = document.getElementById('loadingText');

  // populate static background
  populateBackground();

  // re-populate on resize
  window.addEventListener('resize', debounce(()=>{
    try{ const bt=document.getElementById('bgTridents'); const be=document.getElementById('bgEmojis'); if(bt) bt.innerHTML=''; if(be) be.innerHTML=''; populateBackground(); if(introOverlay && !introOverlay.classList.contains('hidden')) populateIntroParticles(); }catch(e){ console.error(e); }
  }, 220));
});

// ------------------ game init & logic (keeps behavior) ------------------

document.addEventListener('DOMContentLoaded', ()=>{
  boardEl = document.getElementById('board');
  cells = Array.from(document.querySelectorAll('.cell'));
  messageEl = document.getElementById('message');

  opponentBanner = document.getElementById('opponentBanner');
  startBtn = document.getElementById('startBtn');
  restartBtn = document.getElementById('restartBtn');
  pickX = document.getElementById('pickX');
  pickO = document.getElementById('pickO');

  playerWinsEl = document.getElementById('playerWins');
  cpuWinsEl = document.getElementById('cpuWins');
  playerBonusPercentEl = document.getElementById('playerBonusPercent');
  cpuBonusPercentEl = document.getElementById('cpuBonusPercent');
  playsLeftEl = document.getElementById('playsLeft');

  resultModal = document.getElementById('resultModal');
  modalPercent = document.getElementById('modalPercent');
  modalMessage = document.getElementById('modalMessage');
  modalClose = document.getElementById('modalClose');

  boardLogo = document.getElementById('boardLogo');

  if(!boardEl || !cells.length || !messageEl){
    console.error('FATAL: elementos del tablero faltantes.');
    return;
  }

  // UI listeners
  if(pickX) pickX.addEventListener('click', ()=> onPick('X'));
  if(pickO) pickO.addEventListener('click', ()=> onPick('O'));
  if(restartBtn) restartBtn.addEventListener('click', resetGame);
  if(modalClose) modalClose.addEventListener('click', hideModal);
  cells.forEach(c => c.addEventListener('click', onCellClick));

  document.addEventListener('keydown', (e)=> {
    if(e.key === 'Enter' && !sessionStarted && opponentBanner && !opponentBanner.classList.contains('hidden')){
      hideBanner();
      startGame();
    }
  });

  setActiveChoice();
  loadState();
  resetBoardUI();

  if(state.plays >= MAX_PLAYS){
    hideIntro();
    hideBanner();
    hideBoardLogo();
  } else {
    // THIS is the flow: show intro with particles + loading bar, then banner
    showIntroThenBanner();
  }

  attachStartListener();
  dbg('Game initialized');
});

// ---------- game functions (unchanged core) ----------
function showBoardLogo(){ if(!boardLogo) return; boardLogo.classList.remove('hidden'); boardLogo.style.display='block'; }
function hideBoardLogo(){ if(!boardLogo) return; boardLogo.classList.add('hidden'); boardLogo.style.display='none'; }

function loadState(){ try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw) state = JSON.parse(raw); } catch(e){ state = {playerWins:0,cpuWins:0,plays:0}; } updateScoreboardUI(); updatePlaysUI(); checkPlaysLimitUI(); }
function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
function updateScoreboardUI(){ if(playerWinsEl) playerWinsEl.textContent = `${state.playerWins} / ${MAX_PLAYS}`; if(cpuWinsEl) cpuWinsEl.textContent = `${state.cpuWins} / ${MAX_PLAYS}`; if(playerBonusPercentEl) playerBonusPercentEl.textContent = `Bono: ${bonusPercent(state.playerWins)}%`; if(cpuBonusPercentEl) cpuBonusPercentEl.textContent = `Bono: ${bonusPercent(state.cpuWins)}%`; }
function updatePlaysUI(){ if(playsLeftEl) playsLeftEl.textContent = Math.max(0, MAX_PLAYS - state.plays); }
function bonusPercent(w){ if(w<=0) return 0; if(w===1) return 100; if(w===2) return 150; return 200; }
function checkPlaysLimitUI(){ if(!startBtn) return; if(state.plays >= MAX_PLAYS){ startBtn.disabled=true; startBtn.classList.add('disabled'); message('Has alcanzado el máximo de 3 partidas.'); hideBanner(); hideIntro(); hideBoardLogo(); } else { if(sessionStarted){ startBtn.disabled=true; startBtn.classList.add('disabled'); } else { startBtn.disabled=false; startBtn.classList.remove('disabled'); } } }
function setActiveChoice(){ if(!pickX||!pickO) return; pickX.classList.toggle('active', playerSymbol==='X'); pickO.classList.toggle('active', playerSymbol==='O'); }
function onPick(sym){ if(sessionStarted) return; if(sym==='X'){ playerSymbol='X'; cpuSymbol='O'; } else { playerSymbol='O'; cpuSymbol='X'; } setActiveChoice(); }
function resetBoardUI(){ cells.forEach(c=>{ c.innerHTML=''; c.classList.remove('disabled','win'); c.disabled=false; }); }

function startGame(){
  if(state.plays >= MAX_PLAYS){ message('No puedes comenzar: alcanzaste el límite.'); return; }
  sessionStarted=true; checkPlaysLimitUI();
  resetBoardUI(); board = Array(9).fill(null);
  currentTurn = playerSymbol; running=true; cpuThinking=false;
  message(`Juego iniciado — Tú: ${symbolToEmoji(playerSymbol)}  |  ${cpuName}: ${symbolToEmoji(cpuSymbol)}`);
  showBoardLogo();
}

function resetGame(){
  running=false; cpuThinking=false; board = Array(9).fill(null); resetBoardUI();
  if(sessionStarted && state.plays < MAX_PLAYS){ currentTurn=playerSymbol; running=true; message('Partida reiniciada — continúa la serie'); showBoardLogo(); }
  else { sessionStarted=false; showIntroThenBanner(); message('Juego reiniciado. Mostrando presentación...'); hideBoardLogo(); }
}

function onCellClick(e){
  if(!running || cpuThinking) return;
  const idx = Number(e.currentTarget.dataset.index);
  if(Number.isNaN(idx)) return;
  if(board[idx]) return;
  if(currentTurn !== playerSymbol) return;
  makeMove(idx, playerSymbol);
  afterMove();
  setTimeout(()=>{ if(running && !cpuThinking && currentTurn===cpuSymbol) doCpuTurn(); }, 350);
}
function makeMove(i,s){ board[i]=s; const c=cells[i]; if(c){ c.innerHTML=`<span>${symbolToEmoji(s)}</span>`; c.classList.add('disabled'); } }
function afterMove(){ const w = checkWinner(board); if(w){ handleEnd(w); return; } currentTurn = currentTurn==='X'?'O':'X'; if(running && currentTurn===cpuSymbol) doCpuTurn(); }
function doCpuTurn(){ cpuThinking=true; message(`${cpuName} está pensando...`); setTimeout(()=>{ const m = cpuVeryEasyMove(); if(m!==undefined && m!==null) makeMove(m,cpuSymbol); cpuThinking=false; afterMove(); }, 420); }
function cpuVeryEasyMove(){ const blockProb=0.30, heurProb=0.05; const block=findWinningMove(board, playerSymbol); if(block!==null && Math.random()<blockProb) return block; if(Math.random()<heurProb){ if(board[4]===null) return 4; const corners=[0,2,6,8].filter(i=>board[i]===null); if(corners.length) return corners[Math.floor(Math.random()*corners.length)]; const sides=[1,3,5,7].filter(i=>board[i]===null); if(sides.length) return sides[Math.floor(Math.random()*sides.length)]; } return cpuRandomMove(); }
function cpuRandomMove(){ const avail = availableMoves(board); if(avail.length===0) return null; return avail[Math.floor(Math.random()*avail.length)]; }
function availableMoves(b){ return b.map((v,i)=> v===null?i:null).filter(v=>v!==null); }
function findWinningMove(b,sym){ for(const i of availableMoves(b)){ b[i]=sym; const w=checkWinner(b); b[i]=null; if(w===sym) return i; } return null; }

function checkWinner(b){ for(const [a,b1,c] of WIN_COMBINATIONS){ if(b[a] && b[a]===b[b1] && b[a]===b[c]) return b[a]; } if(b.every(v=>v!==null)) return 'D'; return null; }
function handleEnd(winner){ running=false; if(state.plays < MAX_PLAYS) state.plays += 1; if(winner==='D') message('Empate 🙃 — no hay bono adicional'); else { if(winner===playerSymbol){ state.playerWins = Math.min(MAX_PLAYS, state.playerWins + 1); message('¡Ganaste esta partida! 🎉'); } else { state.cpuWins = Math.min(MAX_PLAYS, state.cpuWins + 1); message(`${cpuName} gana esta partida 😢`); } for(const [a,b,c] of WIN_COMBINATIONS){ if(board[a] && board[a]===board[b] && board[a]===board[c]){ if(cells[a]) cells[a].classList.add('win'); if(cells[b]) cells[b].classList.add('win'); if(cells[c]) cells[c].classList.add('win'); break; } } } cells.forEach(c=>c.classList.add('disabled')); saveState(); updateScoreboardUI(); updatePlaysUI(); checkPlaysLimitUI(); if(state.plays < MAX_PLAYS){ setTimeout(()=>{ board=Array(9).fill(null); resetBoardUI(); currentTurn=playerSymbol; running=true; message(`Siguiente partida iniciada — Partida ${state.plays + 1} de ${MAX_PLAYS}`); showBoardLogo(); }, 900); } else { setTimeout(()=>{ const bp = bonusPercent(state.playerWins); if(modalPercent) modalPercent.textContent = `${bp}%`; if(modalMessage) modalMessage.textContent = (bp>0)?`Has obtenido ${bp}% por ${state.playerWins} victoria(s).`:`No obtuviste bono (0 victorias).`; showModal(); hideBoardLogo(); }, 700); } }
function showModal(){ if(resultModal) resultModal.classList.remove('hidden'); }
function hideModal(){ if(resultModal) resultModal.classList.add('hidden'); }
```
